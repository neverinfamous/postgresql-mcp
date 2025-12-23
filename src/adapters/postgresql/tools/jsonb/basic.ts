/**
 * PostgreSQL JSONB Tools - Basic Operations
 * 
 * Core JSONB operations including extract, set, insert, delete, contains, path query, aggregation, and type checks.
 */

import type { PostgresAdapter } from '../../PostgresAdapter.js';
import type { ToolDefinition, RequestContext } from '../../../../types/index.js';
import { z } from 'zod';
import { readOnly, write } from '../../../../utils/annotations.js';
import { getToolIcons } from '../../../../utils/icons.js';
import {
    JsonbExtractSchema,
    JsonbSetSchema,
    JsonbContainsSchema,
    JsonbPathQuerySchema,
    JsonbInsertSchema,
    JsonbDeleteSchema,
    normalizePathToArray,
    normalizePathForInsert,
    parseJsonbValue
} from '../../schemas/index.js';

/**
 * Convert value to a valid JSON string for PostgreSQL's ::jsonb cast
 * Always uses JSON.stringify to ensure proper encoding
 */
function toJsonString(value: unknown): string {
    return JSON.stringify(value);
}

export function createJsonbExtractTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_jsonb_extract',
        description: 'Extract value from JSONB at specified path. Returns null if path does not exist in data structure.',
        group: 'jsonb',
        inputSchema: JsonbExtractSchema,
        annotations: readOnly('JSONB Extract'),
        icons: getToolIcons('jsonb', readOnly('JSONB Extract')),
        handler: async (params: unknown, _context: RequestContext) => {
            const parsed = JsonbExtractSchema.parse(params);
            const whereClause = parsed.where ? ` WHERE ${parsed.where}` : '';
            // Use normalizePathToArray for PostgreSQL #> operator
            const pathArray = normalizePathToArray(parsed.path);
            const sql = `SELECT "${parsed.column}" #> $1 as value FROM "${parsed.table}"${whereClause}`;
            const result = await adapter.executeQuery(sql, [pathArray]);
            const results = result.rows?.map(r => r['value']);
            // Check if all results are null (path may not exist)
            const allNulls = results?.every(v => v === null) ?? false;
            const response: { results: unknown; count: number; hint?: string } = { results, count: results?.length ?? 0 };
            if (allNulls && (results?.length ?? 0) > 0) {
                response.hint = 'All values are null - path may not exist in data. Use pg_jsonb_typeof to check.';
            }
            return response;
        }
    };
}

export function createJsonbSetTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_jsonb_set',
        description: 'Set value in JSONB at path. Uses dot-notation by default; for literal dots in keys use array format ["key.with.dots"].',
        group: 'jsonb',
        inputSchema: JsonbSetSchema,
        annotations: write('JSONB Set'),
        icons: getToolIcons('jsonb', write('JSONB Set')),
        handler: async (params: unknown, _context: RequestContext) => {
            const parsed = JsonbSetSchema.parse(params);
            const { table, column, value, where, createMissing } = parsed;

            // Normalize path to array format
            const path = normalizePathToArray(parsed.path);

            // Validate required 'where' parameter
            if (!where || where.trim() === '') {
                throw new Error('pg_jsonb_set requires a WHERE clause to identify rows to update. Example: where: "id = 1"');
            }

            // Validate value is provided (undefined would set column to null)
            if (value === undefined) {
                throw new Error('pg_jsonb_set requires a value parameter. To remove a key, use pg_jsonb_delete instead.');
            }

            const createFlag = createMissing !== false;

            // For deep nested paths with createMissing=true, build intermediate objects
            // PostgreSQL's jsonb_set only creates one level, so we nest calls for deep paths
            let sql: string;
            if (createFlag && path.length > 1) {
                // Build nested jsonb_set calls to ensure each intermediate path exists
                // Start with COALESCE to handle NULL columns
                let expr = `COALESCE("${column}", '{}'::jsonb)`;

                // For each intermediate level, wrap in jsonb_set to initialize to {}
                for (let i = 0; i < path.length - 1; i++) {
                    const subPath = path.slice(0, i + 1);
                    const pathStr = '{' + subPath.join(',') + '}';
                    // Use COALESCE on the extraction from current expr, not original column
                    // This properly chains the nested creation
                    expr = `jsonb_set(${expr}, '${pathStr}'::text[], COALESCE((${expr}) #> '${pathStr}'::text[], '{}'::jsonb), true)`;
                }
                // Final set with actual value
                const fullPathStr = '{' + path.join(',') + '}';
                expr = `jsonb_set(${expr}, '${fullPathStr}'::text[], $1::jsonb, true)`;
                sql = `UPDATE "${table}" SET "${column}" = ${expr} WHERE ${where}`;
                const result = await adapter.executeQuery(sql, [toJsonString(value)]);
                return { rowsAffected: result.rowsAffected, hint: 'rowsAffected counts matched rows, not path creations' };
            } else {
                // Use COALESCE to handle NULL columns - initialize to empty object
                sql = `UPDATE "${table}" SET "${column}" = jsonb_set(COALESCE("${column}", '{}'::jsonb), $1, $2::jsonb, $3) WHERE ${where}`;
                const result = await adapter.executeQuery(sql, [path, toJsonString(value), createFlag]);
                const hint = createFlag
                    ? 'NULL columns initialized to {}; createMissing creates path if absent'
                    : 'createMissing=false: path must exist or value won\'t be set';
                return { rowsAffected: result.rowsAffected, hint };
            }
        }
    };
}

export function createJsonbInsertTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_jsonb_insert',
        description: 'Insert value into JSONB array. Index -1 inserts BEFORE last element; use insertAfter:true with -1 to append at end.',
        group: 'jsonb',
        inputSchema: JsonbInsertSchema,
        annotations: write('JSONB Insert'),
        icons: getToolIcons('jsonb', write('JSONB Insert')),
        handler: async (params: unknown, _context: RequestContext) => {
            const parsed = JsonbInsertSchema.parse(params);

            // Normalize path - convert numeric segments to numbers for PostgreSQL
            const path = normalizePathForInsert(parsed.path);

            // Validate required 'where' parameter
            if (!parsed.where || parsed.where.trim() === '') {
                throw new Error('pg_jsonb_insert requires a WHERE clause to identify rows to update. Example: where: "id = 1"');
            }

            // Check for NULL columns first - jsonb_insert requires existing array context
            const checkSql = `SELECT COUNT(*) as null_count FROM "${parsed.table}" WHERE ${parsed.where} AND "${parsed.column}" IS NULL`;
            const checkResult = await adapter.executeQuery(checkSql);
            const nullCount = Number(checkResult.rows?.[0]?.['null_count'] ?? 0);
            if (nullCount > 0) {
                throw new Error(`pg_jsonb_insert cannot operate on NULL columns. Use pg_jsonb_set to initialize the column first: pg_jsonb_set({table: "${parsed.table}", column: "${parsed.column}", path: "myarray", value: [], where: "..."})`);
            }

            // Validate target path points to an array, not an object
            // Get the parent path (one level up from where we're inserting)
            const parentPath = path.slice(0, -1);
            if (parentPath.length === 0) {
                // Inserting at root level - check column type
                const typeCheckSql = `SELECT jsonb_typeof("${parsed.column}") as type FROM "${parsed.table}" WHERE ${parsed.where} LIMIT 1`;
                const typeResult = await adapter.executeQuery(typeCheckSql);
                const columnType = typeResult.rows?.[0]?.['type'] as string | undefined;
                if (columnType && columnType !== 'array') {
                    throw new Error(`pg_jsonb_insert requires an array target. Column contains '${columnType}'. Use pg_jsonb_set for objects.`);
                }
            } else {
                // Check the parent path type
                const typeCheckSql = `SELECT jsonb_typeof("${parsed.column}" #> $1) as type FROM "${parsed.table}" WHERE ${parsed.where} LIMIT 1`;
                const parentPathStrings = parentPath.map(p => String(p));
                const typeResult = await adapter.executeQuery(typeCheckSql, [parentPathStrings]);
                const targetType = typeResult.rows?.[0]?.['type'] as string | undefined;
                if (targetType && targetType !== 'array') {
                    throw new Error(`pg_jsonb_insert requires an array target. Path '${parentPathStrings.join('.')}' contains '${targetType}'. Use pg_jsonb_set for objects.`);
                }
            }

            const sql = `UPDATE "${parsed.table}" SET "${parsed.column}" = jsonb_insert("${parsed.column}", $1, $2::jsonb, $3) WHERE ${parsed.where}`; try {
                const result = await adapter.executeQuery(sql, [path, toJsonString(parsed.value), parsed.insertAfter ?? false]);
                return { rowsAffected: result.rowsAffected };
            } catch (error) {
                // Improve PostgreSQL error messages
                if (error instanceof Error && error.message.includes('cannot replace existing key')) {
                    throw new Error(`pg_jsonb_insert is for arrays only. For objects, use pg_jsonb_set. If updating an existing array element, use pg_jsonb_set.`);
                }
                if (error instanceof Error && error.message.includes('path element is not an integer')) {
                    throw new Error(`pg_jsonb_insert requires numeric index for array position. Use array format with number: ["tags", 0] not ["tags", "0"] or "tags.0"`);
                }
                throw error;
            }
        }
    };
}

export function createJsonbDeleteTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_jsonb_delete',
        description: 'Delete a key or array element from a JSONB column. Accepts path as string or array. Note: rowsAffected reflects matched rows, not whether key existed.',
        group: 'jsonb',
        inputSchema: JsonbDeleteSchema,
        annotations: write('JSONB Delete'),
        icons: getToolIcons('jsonb', write('JSONB Delete')),
        handler: async (params: unknown, _context: RequestContext) => {
            const parsed = JsonbDeleteSchema.parse(params);

            // Validate required 'where' parameter
            if (!parsed.where || parsed.where.trim() === '') {
                throw new Error('pg_jsonb_delete requires a WHERE clause to identify rows to update. Example: where: "id = 1"');
            }

            // Validate path is not empty
            if (parsed.path === '' || (Array.isArray(parsed.path) && parsed.path.length === 0)) {
                throw new Error('pg_jsonb_delete requires a non-empty path. Provide a key name or path to delete.');
            }

            // Determine if path should be treated as nested (array path) or single key
            // - Array paths: ["a", "b"], ["0"], [1]
            // - Bare number: 0, 1 (treat as array index)
            // - Dot notation: "a.b.c"
            // - Numeric string: "0", "1" (treat as array index)
            // - Single key: "mykey" (use - operator, not #-)
            let pathForPostgres: string | string[];
            let useArrayOperator = false;

            if (typeof parsed.path === 'number') {
                // Bare number - treat as array index
                pathForPostgres = [String(parsed.path)];
                useArrayOperator = true;
            } else if (Array.isArray(parsed.path)) {
                // Already an array - normalize to string array
                pathForPostgres = normalizePathToArray(parsed.path);
                useArrayOperator = true;
            } else if (parsed.path.includes('.')) {
                // Dot notation - convert to array
                pathForPostgres = parsed.path.split('.').filter(p => p !== '');
                useArrayOperator = true;
            } else if (/^\d+$/.test(parsed.path)) {
                // Pure numeric string - treat as array index
                pathForPostgres = [parsed.path];
                useArrayOperator = true;
            } else {
                // Single key - use simple - operator
                pathForPostgres = parsed.path;
                useArrayOperator = false;
            }

            const pathExpr = useArrayOperator ? `#- $1` : `- $1`;
            const sql = `UPDATE "${parsed.table}" SET "${parsed.column}" = "${parsed.column}" ${pathExpr} WHERE ${parsed.where}`;
            const result = await adapter.executeQuery(sql, [pathForPostgres]);
            return { rowsAffected: result.rowsAffected, hint: 'rowsAffected counts matched rows, not whether key existed' };
        }
    };
}

export function createJsonbContainsTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_jsonb_contains',
        description: 'Find rows where JSONB column contains the specified value. Note: Empty object {} matches all rows.',
        group: 'jsonb',
        inputSchema: JsonbContainsSchema,
        annotations: readOnly('JSONB Contains'),
        icons: getToolIcons('jsonb', readOnly('JSONB Contains')),
        handler: async (params: unknown, _context: RequestContext) => {
            const parsed = JsonbContainsSchema.parse(params);
            const { table, column, select, where } = parsed;
            // Parse JSON string values from MCP clients
            const value = parseJsonbValue(parsed.value);

            const selectCols = select !== undefined && select.length > 0 ? select.map(c => `"${c}"`).join(', ') : '*';
            // Build WHERE clause combining containment check with optional filter
            const containsClause = `"${column}" @> $1::jsonb`;
            const whereClause = where ? ` AND ${where}` : '';
            const sql = `SELECT ${selectCols} FROM "${table}" WHERE ${containsClause}${whereClause}`;
            const result = await adapter.executeQuery(sql, [toJsonString(value)]);
            // Warn if empty object was passed (matches all rows)
            const isEmptyObject = typeof value === 'object' && value !== null && !Array.isArray(value) && Object.keys(value).length === 0;
            const response: { rows: unknown; count: number; warning?: string } = { rows: result.rows, count: result.rows?.length ?? 0 };
            if (isEmptyObject) {
                response.warning = 'Empty {} matches ALL rows - this is PostgreSQL containment semantics';
            }
            return response;
        }
    };
}

export function createJsonbPathQueryTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_jsonb_path_query',
        description: 'Query JSONB using SQL/JSON path expressions (PostgreSQL 12+). Note: Recursive descent (..) syntax is not supported by PostgreSQL.',
        group: 'jsonb',
        inputSchema: JsonbPathQuerySchema,
        annotations: readOnly('JSONB Path Query'),
        icons: getToolIcons('jsonb', readOnly('JSONB Path Query')),
        handler: async (params: unknown, _context: RequestContext) => {
            const { table, column, path, vars, where } = JsonbPathQuerySchema.parse(params);
            const whereClause = where ? ` WHERE ${where}` : '';
            const varsJson = vars ? JSON.stringify(vars) : '{}';
            const sql = `SELECT jsonb_path_query("${column}", $1::jsonpath, $2::jsonb) as result FROM "${table}"${whereClause}`;
            const result = await adapter.executeQuery(sql, [path, varsJson]);
            const results = result.rows?.map(r => r['result']);
            return { results, count: results?.length ?? 0 };
        }
    };
}

export function createJsonbAggTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_jsonb_agg',
        description: 'Aggregate rows into a JSONB array. With groupBy, returns all groups with their aggregated items.',
        group: 'jsonb',
        inputSchema: z.object({
            table: z.string(),
            select: z.array(z.string()).optional(),
            where: z.string().optional(),
            groupBy: z.string().optional().describe('Column or expression to group by. Returns {groups: [{group_key, items}], count}')
        }),
        annotations: readOnly('JSONB Aggregate'),
        icons: getToolIcons('jsonb', readOnly('JSONB Aggregate')),
        handler: async (params: unknown, _context: RequestContext) => {
            const parsed = (params as { table: string; select?: string[]; where?: string; groupBy?: string });
            const selectExpr = parsed.select !== undefined && parsed.select.length > 0
                ? `jsonb_build_object(${parsed.select.map(c => `'${c}', "${c}"`).join(', ')})`
                : 'to_jsonb(t.*)';
            const whereClause = parsed.where ? ` WHERE ${parsed.where}` : '';
            // Support raw JSONB expressions (containing -> or ->> operators) without quoting
            const hasJsonbOperator = parsed.groupBy?.includes('->') ?? false;

            if (parsed.groupBy) {
                // Return all groups with their aggregated items
                const groupExpr = hasJsonbOperator ? parsed.groupBy : `"${parsed.groupBy}"`;
                const groupClause = ` GROUP BY ${groupExpr}`;
                const sql = `SELECT ${groupExpr} as group_key, jsonb_agg(${selectExpr}) as items FROM "${parsed.table}" t${whereClause}${groupClause}`;
                const result = await adapter.executeQuery(sql);
                // Return result (groups is deprecated alias for backward compat)
                return { result: result.rows, count: result.rows?.length ?? 0, grouped: true };
            } else {
                const sql = `SELECT jsonb_agg(${selectExpr}) as result FROM "${parsed.table}" t${whereClause}`;
                const result = await adapter.executeQuery(sql);
                const arr = result.rows?.[0]?.['result'] ?? [];
                const count = Array.isArray(arr) ? arr.length : 0;
                const response: { result: unknown; count: number; grouped: boolean; hint?: string } = { result: arr, count, grouped: false };
                if (count === 0) {
                    response.hint = 'No rows matched - returns empty array []';
                }
                return response;
            }
        }
    };
}

// Schema for pg_jsonb_object - accepts direct key-value pairs, defaults to empty
const JsonbObjectSchema = z.record(z.string(), z.unknown()).default({}).describe('Key-value pairs to build into a JSONB object. Pass keys directly: {name: "John", age: 30}');

export function createJsonbObjectTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_jsonb_object',
        description: 'Build a JSONB object. Pass key-value pairs directly: {name: "John", age: 30}. Returns {object: {...}}.',
        group: 'jsonb',
        inputSchema: JsonbObjectSchema,
        annotations: readOnly('JSONB Object'),
        icons: getToolIcons('jsonb', readOnly('JSONB Object')),
        handler: async (params: unknown, _context: RequestContext) => {
            // Parse the input
            const parsed = JsonbObjectSchema.parse(params);

            // Backward compatibility: if input is {pairs: {...}} unwrap it
            // (old format had pairs wrapper, new format is direct key-value)
            let pairs: Record<string, unknown> = parsed;
            if (Object.keys(parsed).length === 1 && 'pairs' in parsed && typeof parsed['pairs'] === 'object' && parsed['pairs'] !== null && !Array.isArray(parsed['pairs'])) {
                pairs = parsed['pairs'] as Record<string, unknown>;
            }

            const entries = Object.entries(pairs);

            // Handle empty pairs - return empty object
            if (entries.length === 0) {
                return { object: {} };
            }

            const args = entries.flatMap(([k, v]) => [k, toJsonString(v)]);
            const placeholders = entries.map((_, i) => `$${String(i * 2 + 1)}::text, $${String(i * 2 + 2)}::jsonb`).join(', ');
            const sql = `SELECT jsonb_build_object(${placeholders}) as result`;
            const result = await adapter.executeQuery(sql, args);
            return { object: result.rows?.[0]?.['result'] ?? {} };
        }
    };
}

export function createJsonbArrayTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_jsonb_array',
        description: 'Build a JSONB array from values. Returns {array: [...]}.',
        group: 'jsonb',
        inputSchema: z.object({
            values: z.array(z.unknown())
        }),
        annotations: readOnly('JSONB Array'),
        icons: getToolIcons('jsonb', readOnly('JSONB Array')),
        handler: async (params: unknown, _context: RequestContext) => {
            const parsed = (params as { values: unknown[] });
            const placeholders = parsed.values.map((_, i) => `$${String(i + 1)}::jsonb`).join(', ');
            const sql = `SELECT jsonb_build_array(${placeholders}) as result`;
            const result = await adapter.executeQuery(sql, parsed.values.map(v => toJsonString(v)));
            return { array: result.rows?.[0]?.['result'] };
        }
    };
}

export function createJsonbKeysTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_jsonb_keys',
        description: 'Get all unique keys from a JSONB object column (deduplicated across rows).',
        group: 'jsonb',
        inputSchema: z.object({
            table: z.string(),
            column: z.string(),
            where: z.string().optional()
        }),
        annotations: readOnly('JSONB Keys'),
        icons: getToolIcons('jsonb', readOnly('JSONB Keys')),
        handler: async (params: unknown, _context: RequestContext) => {
            const parsed = (params as { table: string; column: string; where?: string });
            const whereClause = parsed.where ? ` WHERE ${parsed.where}` : '';
            const sql = `SELECT DISTINCT jsonb_object_keys("${parsed.column}") as key FROM "${parsed.table}"${whereClause}`;
            try {
                const result = await adapter.executeQuery(sql);
                const keys = result.rows?.map(r => r['key']) as string[];
                return { keys, count: keys?.length ?? 0, hint: 'Returns unique keys deduplicated across all matching rows' };
            } catch (error) {
                // Improve error for array columns
                if (error instanceof Error && error.message.includes('cannot call jsonb_object_keys')) {
                    throw new Error(`pg_jsonb_keys requires object columns. For array columns, use pg_jsonb_normalize with mode: 'array'.`);
                }
                throw error;
            }
        }
    };
}

export function createJsonbStripNullsTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_jsonb_strip_nulls',
        description: 'Remove null values from a JSONB column. Use preview=true to see changes without modifying data.',
        group: 'jsonb',
        inputSchema: z.object({
            table: z.string(),
            column: z.string(),
            where: z.string(),
            preview: z.boolean().optional().describe('Preview what would be stripped without modifying data')
        }),
        annotations: write('JSONB Strip Nulls'),
        icons: getToolIcons('jsonb', write('JSONB Strip Nulls')),
        handler: async (params: unknown, _context: RequestContext) => {
            const parsed = (params as { table: string; column: string; where: string; preview?: boolean });
            // Validate required 'where' parameter before SQL execution
            if (!parsed.where || parsed.where.trim() === '') {
                throw new Error('pg_jsonb_strip_nulls requires a WHERE clause to identify rows to update. Example: where: "id = 1"');
            }

            if (parsed.preview === true) {
                // Preview mode - show before/after without modifying
                const previewSql = `SELECT "${parsed.column}" as before, jsonb_strip_nulls("${parsed.column}") as after FROM "${parsed.table}" WHERE ${parsed.where}`;
                const result = await adapter.executeQuery(previewSql);
                return { preview: true, rows: result.rows, count: result.rows?.length ?? 0, hint: 'No changes made - preview only' };
            }

            const sql = `UPDATE "${parsed.table}" SET "${parsed.column}" = jsonb_strip_nulls("${parsed.column}") WHERE ${parsed.where}`;
            const result = await adapter.executeQuery(sql);
            return { rowsAffected: result.rowsAffected };
        }
    };
}

export function createJsonbTypeofTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_jsonb_typeof',
        description: 'Get JSONB type at path. Uses dot-notation (a.b.c), not JSONPath ($). Response includes columnNull to distinguish NULL columns.',
        group: 'jsonb',
        inputSchema: z.object({
            table: z.string(),
            column: z.string(),
            path: z.union([z.string(), z.array(z.union([z.string(), z.number()]))]).optional().describe('Path to check type of nested value (string or array format)'),
            where: z.string().optional()
        }),
        annotations: readOnly('JSONB Typeof'),
        icons: getToolIcons('jsonb', readOnly('JSONB Typeof')),
        handler: async (params: unknown, _context: RequestContext) => {
            const parsed = (params as { table: string; column: string; path?: string | (string | number)[]; where?: string });
            const whereClause = parsed.where ? ` WHERE ${parsed.where}` : '';
            // Normalize path to array format (accepts both string and array)
            const pathArray = parsed.path !== undefined ? normalizePathToArray(parsed.path) : undefined;
            const pathExpr = pathArray !== undefined ? ` #> $1` : '';
            // Include column IS NULL check to disambiguate NULL column vs null path result
            const sql = `SELECT jsonb_typeof("${parsed.column}"${pathExpr}) as type, ("${parsed.column}" IS NULL) as column_null FROM "${parsed.table}"${whereClause}`;
            const queryParams = pathArray ? [pathArray] : [];
            const result = await adapter.executeQuery(sql, queryParams);
            const types = result.rows?.map(r => r['type']) as (string | null)[];
            const columnNull = result.rows?.some(r => r['column_null'] === true) ?? false;
            return { types, count: types?.length ?? 0, columnNull };
        }
    };
}
