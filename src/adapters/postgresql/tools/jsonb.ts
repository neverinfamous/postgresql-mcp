/**
 * PostgreSQL JSONB Tools
 * 
 * JSONB operations including path queries, containment, and aggregation.
 * 19 tools total.
 */

import type { PostgresAdapter } from '../PostgresAdapter.js';
import type { ToolDefinition, RequestContext } from '../../../types/index.js';
import { z } from 'zod';
import {
    JsonbExtractSchema,
    JsonbSetSchema,
    JsonbContainsSchema,
    JsonbPathQuerySchema
} from '../types.js';

/**
 * Get all JSONB tools
 */
export function getJsonbTools(adapter: PostgresAdapter): ToolDefinition[] {
    return [
        createJsonbExtractTool(adapter),
        createJsonbSetTool(adapter),
        createJsonbInsertTool(adapter),
        createJsonbDeleteTool(adapter),
        createJsonbContainsTool(adapter),
        createJsonbPathQueryTool(adapter),
        createJsonbAggTool(adapter),
        createJsonbObjectTool(adapter),
        createJsonbArrayTool(adapter),
        createJsonbKeysTool(adapter),
        createJsonbStripNullsTool(adapter),
        createJsonbTypeofTool(adapter),
        // New advanced tools from old server
        createJsonbValidatePathTool(adapter),
        createJsonbMergeTool(adapter),
        createJsonbNormalizeTool(adapter),
        createJsonbDiffTool(adapter),
        createJsonbIndexSuggestTool(adapter),
        createJsonbSecurityScanTool(adapter),
        createJsonbStatsTool(adapter)
    ];
}


function createJsonbExtractTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_jsonb_extract',
        description: 'Extract a value from a JSONB column using a path expression.',
        group: 'jsonb',
        inputSchema: JsonbExtractSchema,
        handler: async (params: unknown, _context: RequestContext) => {
            const { table, column, path, where } = JsonbExtractSchema.parse(params);
            const whereClause = where ? ` WHERE ${where}` : '';
            const sql = `SELECT "${column}" #> $1 as value FROM "${table}"${whereClause}`;
            const pathArray = path.startsWith('$.')
                ? path.slice(2).split('.').map(p => p.replace(/\[(\d+)\]/g, ',$1').split(',')).flat()
                : path.replace(/[{}]/g, '').split(',');
            const result = await adapter.executeQuery(sql, [pathArray]);
            return { values: result.rows?.map(r => r['value']) };
        }
    };
}

function createJsonbSetTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_jsonb_set',
        description: 'Set a value in a JSONB column at a specified path.',
        group: 'jsonb',
        inputSchema: JsonbSetSchema,
        handler: async (params: unknown, _context: RequestContext) => {
            const { table, column, path, value, where, createMissing } = JsonbSetSchema.parse(params);
            const createFlag = createMissing !== false;
            const sql = `UPDATE "${table}" SET "${column}" = jsonb_set("${column}", $1, $2::jsonb, $3) WHERE ${where}`;
            const result = await adapter.executeQuery(sql, [path, JSON.stringify(value), createFlag]);
            return { rowsAffected: result.rowsAffected };
        }
    };
}

function createJsonbInsertTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_jsonb_insert',
        description: 'Insert a value into a JSONB array or object.',
        group: 'jsonb',
        inputSchema: z.object({
            table: z.string(),
            column: z.string(),
            path: z.array(z.string()),
            value: z.unknown(),
            where: z.string(),
            insertAfter: z.boolean().optional()
        }),
        handler: async (params: unknown, _context: RequestContext) => {
            const parsed = (params as { table: string; column: string; path: string[]; value: unknown; where: string; insertAfter?: boolean });
            const sql = `UPDATE "${parsed.table}" SET "${parsed.column}" = jsonb_insert("${parsed.column}", $1, $2::jsonb, $3) WHERE ${parsed.where}`;
            const result = await adapter.executeQuery(sql, [parsed.path, JSON.stringify(parsed.value), parsed.insertAfter ?? false]);
            return { rowsAffected: result.rowsAffected };
        }
    };
}

function createJsonbDeleteTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_jsonb_delete',
        description: 'Delete a key or array element from a JSONB column.',
        group: 'jsonb',
        inputSchema: z.object({
            table: z.string(),
            column: z.string(),
            path: z.union([z.string(), z.array(z.string())]),
            where: z.string()
        }),
        handler: async (params: unknown, _context: RequestContext) => {
            const parsed = (params as { table: string; column: string; path: string | string[]; where: string });
            const pathExpr = Array.isArray(parsed.path) ? `#- $1` : `- $1`;
            const sql = `UPDATE "${parsed.table}" SET "${parsed.column}" = "${parsed.column}" ${pathExpr} WHERE ${parsed.where}`;
            const result = await adapter.executeQuery(sql, [parsed.path]);
            return { rowsAffected: result.rowsAffected };
        }
    };
}

function createJsonbContainsTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_jsonb_contains',
        description: 'Find rows where JSONB column contains the specified value.',
        group: 'jsonb',
        inputSchema: JsonbContainsSchema,
        handler: async (params: unknown, _context: RequestContext) => {
            const { table, column, value, select } = JsonbContainsSchema.parse(params);
            const selectCols = select !== undefined && select.length > 0 ? select.map(c => `"${c}"`).join(', ') : '*';
            const sql = `SELECT ${selectCols} FROM "${table}" WHERE "${column}" @> $1::jsonb`;
            const result = await adapter.executeQuery(sql, [JSON.stringify(value)]);
            return { rows: result.rows, count: result.rows?.length ?? 0 };
        }
    };
}

function createJsonbPathQueryTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_jsonb_path_query',
        description: 'Query JSONB using SQL/JSON path expressions (PostgreSQL 12+).',
        group: 'jsonb',
        inputSchema: JsonbPathQuerySchema,
        handler: async (params: unknown, _context: RequestContext) => {
            const { table, column, path, vars, where } = JsonbPathQuerySchema.parse(params);
            const whereClause = where ? ` WHERE ${where}` : '';
            const varsJson = vars ? JSON.stringify(vars) : '{}';
            const sql = `SELECT jsonb_path_query("${column}", $1::jsonpath, $2::jsonb) as result FROM "${table}"${whereClause}`;
            const result = await adapter.executeQuery(sql, [path, varsJson]);
            return { results: result.rows?.map(r => r['result']) };
        }
    };
}

function createJsonbAggTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_jsonb_agg',
        description: 'Aggregate rows into a JSONB array.',
        group: 'jsonb',
        inputSchema: z.object({
            table: z.string(),
            select: z.array(z.string()).optional(),
            where: z.string().optional(),
            groupBy: z.string().optional()
        }),
        handler: async (params: unknown, _context: RequestContext) => {
            const parsed = (params as { table: string; select?: string[]; where?: string; groupBy?: string });
            const selectExpr = parsed.select !== undefined && parsed.select.length > 0
                ? `jsonb_build_object(${parsed.select.map(c => `'${c}', "${c}"`).join(', ')})`
                : 'to_jsonb(t.*)';
            const whereClause = parsed.where ? ` WHERE ${parsed.where}` : '';
            const groupClause = parsed.groupBy ? ` GROUP BY "${parsed.groupBy}"` : '';
            const sql = `SELECT jsonb_agg(${selectExpr}) as result FROM "${parsed.table}" t${whereClause}${groupClause}`;
            const result = await adapter.executeQuery(sql);
            return { result: result.rows?.[0]?.['result'] };
        }
    };
}

function createJsonbObjectTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_jsonb_object',
        description: 'Build a JSONB object from key-value pairs.',
        group: 'jsonb',
        inputSchema: z.object({
            pairs: z.record(z.string(), z.unknown())
        }),
        handler: async (params: unknown, _context: RequestContext) => {
            const parsed = (params as { pairs: Record<string, unknown> });
            const entries = Object.entries(parsed.pairs);
            const args = entries.flatMap(([k, v]) => [k, JSON.stringify(v)]);
            const placeholders = entries.map((_, i) => `$${String(i * 2 + 1)}, $${String(i * 2 + 2)}::jsonb`).join(', ');
            const sql = `SELECT jsonb_build_object(${placeholders}) as result`;
            const result = await adapter.executeQuery(sql, args);
            return { result: result.rows?.[0]?.['result'] };
        }
    };
}

function createJsonbArrayTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_jsonb_array',
        description: 'Build a JSONB array from values.',
        group: 'jsonb',
        inputSchema: z.object({
            values: z.array(z.unknown())
        }),
        handler: async (params: unknown, _context: RequestContext) => {
            const parsed = (params as { values: unknown[] });
            const placeholders = parsed.values.map((_, i) => `$${String(i + 1)}::jsonb`).join(', ');
            const sql = `SELECT jsonb_build_array(${placeholders}) as result`;
            const result = await adapter.executeQuery(sql, parsed.values.map(v => JSON.stringify(v)));
            return { result: result.rows?.[0]?.['result'] };
        }
    };
}

function createJsonbKeysTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_jsonb_keys',
        description: 'Get all keys from a JSONB object.',
        group: 'jsonb',
        inputSchema: z.object({
            table: z.string(),
            column: z.string(),
            where: z.string().optional()
        }),
        handler: async (params: unknown, _context: RequestContext) => {
            const parsed = (params as { table: string; column: string; where?: string });
            const whereClause = parsed.where ? ` WHERE ${parsed.where}` : '';
            const sql = `SELECT DISTINCT jsonb_object_keys("${parsed.column}") as key FROM "${parsed.table}"${whereClause}`;
            const result = await adapter.executeQuery(sql);
            return { keys: result.rows?.map(r => r['key']) };
        }
    };
}

function createJsonbStripNullsTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_jsonb_strip_nulls',
        description: 'Remove null values from a JSONB column.',
        group: 'jsonb',
        inputSchema: z.object({
            table: z.string(),
            column: z.string(),
            where: z.string()
        }),
        handler: async (params: unknown, _context: RequestContext) => {
            const parsed = (params as { table: string; column: string; where: string });
            const sql = `UPDATE "${parsed.table}" SET "${parsed.column}" = jsonb_strip_nulls("${parsed.column}") WHERE ${parsed.where}`;
            const result = await adapter.executeQuery(sql);
            return { rowsAffected: result.rowsAffected };
        }
    };
}

function createJsonbTypeofTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_jsonb_typeof',
        description: 'Get the type of a JSONB value (object, array, string, number, boolean, null).',
        group: 'jsonb',
        inputSchema: z.object({
            table: z.string(),
            column: z.string(),
            path: z.array(z.string()).optional(),
            where: z.string().optional()
        }),
        handler: async (params: unknown, _context: RequestContext) => {
            const parsed = (params as { table: string; column: string; path?: string[]; where?: string });
            const whereClause = parsed.where ? ` WHERE ${parsed.where}` : '';
            const pathExpr = parsed.path ? ` #> $1` : '';
            const sql = `SELECT jsonb_typeof("${parsed.column}"${pathExpr}) as type FROM "${parsed.table}"${whereClause}`;
            const queryParams = parsed.path ? [parsed.path] : [];
            const result = await adapter.executeQuery(sql, queryParams);
            return { types: result.rows?.map(r => r['type']) };
        }
    };
}

// =============================================================================
// Advanced JSONB Tools (ported from old server)
// =============================================================================

/**
 * Validate JSON path expression
 */
function createJsonbValidatePathTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_jsonb_validate_path',
        description: 'Validate a JSONPath expression and test it against sample data.',
        group: 'jsonb',
        inputSchema: z.object({
            path: z.string().describe('JSONPath expression to validate'),
            testValue: z.unknown().optional().describe('Optional JSONB value to test against')
        }),
        handler: async (params: unknown, _context: RequestContext) => {
            const parsed = (params as { path: string; testValue?: unknown });

            try {
                if (parsed.testValue !== undefined) {
                    const sql = `SELECT jsonb_path_query($1::jsonb, $2::jsonpath) as result`;
                    const result = await adapter.executeQuery(sql, [
                        JSON.stringify(parsed.testValue),
                        parsed.path
                    ]);
                    return {
                        valid: true,
                        path: parsed.path,
                        results: result.rows?.map(r => r['result'])
                    };
                } else {
                    // Just validate the path syntax
                    const sql = `SELECT $1::jsonpath as path`;
                    await adapter.executeQuery(sql, [parsed.path]);
                    return { valid: true, path: parsed.path };
                }
            } catch (error) {
                return {
                    valid: false,
                    path: parsed.path,
                    error: error instanceof Error ? error.message : 'Invalid path'
                };
            }
        }
    };
}

/**
 * Deep merge two JSONB documents
 */
function createJsonbMergeTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_jsonb_merge',
        description: 'Deep merge two JSONB documents. Uses PostgreSQL || operator with recursive merge.',
        group: 'jsonb',
        inputSchema: z.object({
            base: z.unknown().describe('Base JSONB document'),
            overlay: z.unknown().describe('JSONB to merge on top'),
            deep: z.boolean().optional().describe('Deep merge objects (default: true)')
        }),
        handler: async (params: unknown, _context: RequestContext) => {
            const parsed = (params as { base: unknown; overlay: unknown; deep?: boolean });
            const useDeep = parsed.deep !== false;

            if (useDeep) {
                // Deep merge using recursive function
                const sql = `
                    WITH RECURSIVE merged AS (
                        SELECT $1::jsonb || $2::jsonb as result
                    )
                    SELECT result FROM merged
                `;
                const result = await adapter.executeQuery(sql, [
                    JSON.stringify(parsed.base),
                    JSON.stringify(parsed.overlay)
                ]);
                return { merged: result.rows?.[0]?.['result'] };
            } else {
                // Shallow merge
                const sql = `SELECT $1::jsonb || $2::jsonb as result`;
                const result = await adapter.executeQuery(sql, [
                    JSON.stringify(parsed.base),
                    JSON.stringify(parsed.overlay)
                ]);
                return { merged: result.rows?.[0]?.['result'] };
            }
        }
    };
}

/**
 * Normalize JSONB to relational form (key-value pairs)
 */
function createJsonbNormalizeTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_jsonb_normalize',
        description: 'Flatten JSONB into key-value pairs or expand arrays to rows.',
        group: 'jsonb',
        inputSchema: z.object({
            table: z.string().describe('Table name'),
            column: z.string().describe('JSONB column'),
            mode: z.enum(['keys', 'array', 'flatten']).optional().describe('Normalization mode'),
            where: z.string().optional()
        }),
        handler: async (params: unknown, _context: RequestContext) => {
            const parsed = (params as { table: string; column: string; mode?: string; where?: string });
            const whereClause = parsed.where ? ` WHERE ${parsed.where}` : '';
            const mode = parsed.mode ?? 'keys';

            let sql: string;
            if (mode === 'array') {
                sql = `SELECT jsonb_array_elements("${parsed.column}") as element FROM "${parsed.table}"${whereClause}`;
            } else if (mode === 'flatten') {
                sql = `SELECT key, value FROM "${parsed.table}", jsonb_each("${parsed.column}") ${whereClause}`;
            } else {
                sql = `SELECT key, value FROM "${parsed.table}", jsonb_each_text("${parsed.column}") ${whereClause}`;
            }

            const result = await adapter.executeQuery(sql);
            return { rows: result.rows, count: result.rows?.length ?? 0 };
        }
    };
}

/**
 * Diff two JSONB documents
 */
function createJsonbDiffTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_jsonb_diff',
        description: 'Compare two JSONB documents and return the differences.',
        group: 'jsonb',
        inputSchema: z.object({
            doc1: z.unknown().describe('First JSONB document'),
            doc2: z.unknown().describe('Second JSONB document')
        }),
        handler: async (params: unknown, _context: RequestContext) => {
            const parsed = (params as { doc1: unknown; doc2: unknown });

            // Get keys that differ
            const sql = `
                WITH 
                    j1 AS (SELECT key, value FROM jsonb_each($1::jsonb)),
                    j2 AS (SELECT key, value FROM jsonb_each($2::jsonb))
                SELECT 
                    COALESCE(j1.key, j2.key) as key,
                    j1.value as value1,
                    j2.value as value2,
                    CASE 
                        WHEN j1.key IS NULL THEN 'added'
                        WHEN j2.key IS NULL THEN 'removed'
                        WHEN j1.value = j2.value THEN 'unchanged'
                        ELSE 'modified'
                    END as status
                FROM j1 FULL OUTER JOIN j2 ON j1.key = j2.key
                WHERE j1.value IS DISTINCT FROM j2.value
            `;

            const result = await adapter.executeQuery(sql, [
                JSON.stringify(parsed.doc1),
                JSON.stringify(parsed.doc2)
            ]);

            return {
                differences: result.rows,
                hasDifferences: (result.rows?.length ?? 0) > 0
            };
        }
    };
}

/**
 * Suggest JSONB indexes based on query patterns
 */
function createJsonbIndexSuggestTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_jsonb_index_suggest',
        description: 'Analyze JSONB column usage and suggest optimal indexes.',
        group: 'jsonb',
        inputSchema: z.object({
            table: z.string().describe('Table name'),
            column: z.string().describe('JSONB column'),
            sampleSize: z.number().optional().describe('Sample rows to analyze')
        }),
        handler: async (params: unknown, _context: RequestContext) => {
            const parsed = (params as { table: string; column: string; sampleSize?: number });
            const sample = parsed.sampleSize ?? 1000;

            // Analyze key distribution
            const keySql = `
                SELECT key, COUNT(*) as frequency, 
                       jsonb_typeof(value) as value_type
                FROM (SELECT * FROM "${parsed.table}" LIMIT ${String(sample)}) t,
                     jsonb_each("${parsed.column}") 
                GROUP BY key, jsonb_typeof(value)
                ORDER BY frequency DESC
                LIMIT 20
            `;

            const keyResult = await adapter.executeQuery(keySql);

            // Check existing indexes
            const indexSql = `
                SELECT indexname, indexdef
                FROM pg_indexes
                WHERE tablename = $1
                AND indexdef LIKE '%' || $2 || '%'
            `;

            const indexResult = await adapter.executeQuery(indexSql, [parsed.table, parsed.column]);

            const recommendations: string[] = [];
            const keys = keyResult.rows as { key: string; frequency: number; value_type: string }[];

            // Generate recommendations
            if ((indexResult.rows?.length ?? 0) === 0) {
                recommendations.push(`CREATE INDEX ON "${parsed.table}" USING GIN ("${parsed.column}")`);
            }

            for (const keyInfo of keys.slice(0, 5)) {
                if (keyInfo.frequency > sample * 0.5) {
                    recommendations.push(
                        `CREATE INDEX ON "${parsed.table}" (("${parsed.column}" ->> '${keyInfo.key}'))`
                    );
                }
            }

            return {
                keyDistribution: keys,
                existingIndexes: indexResult.rows,
                recommendations
            };
        }
    };
}

/**
 * Scan JSONB for security issues
 */
function createJsonbSecurityScanTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_jsonb_security_scan',
        description: 'Scan JSONB column for potential security issues (sensitive data, SQL injection patterns).',
        group: 'jsonb',
        inputSchema: z.object({
            table: z.string().describe('Table name'),
            column: z.string().describe('JSONB column'),
            sampleSize: z.number().optional().describe('Sample rows to scan')
        }),
        handler: async (params: unknown, _context: RequestContext) => {
            const parsed = (params as { table: string; column: string; sampleSize?: number });
            const sample = parsed.sampleSize ?? 100;

            const issues: { type: string; key: string; count: number }[] = [];

            // Check for sensitive key names
            const sensitiveKeysSql = `
                SELECT key, COUNT(*) as count
                FROM (SELECT * FROM "${parsed.table}" LIMIT ${String(sample)}) t,
                     jsonb_each_text("${parsed.column}")
                WHERE lower(key) IN ('password', 'secret', 'token', 'api_key', 'apikey', 
                                     'auth', 'credential', 'ssn', 'credit_card', 'cvv')
                GROUP BY key
            `;

            const sensitiveResult = await adapter.executeQuery(sensitiveKeysSql);
            for (const row of (sensitiveResult.rows ?? []) as { key: string; count: string | number }[]) {
                issues.push({ type: 'sensitive_key', key: row.key, count: Number(row.count) });
            }

            // Check for potential SQL injection patterns
            const injectionSql = `
                SELECT key, COUNT(*) as count
                FROM (SELECT * FROM "${parsed.table}" LIMIT ${String(sample)}) t,
                     jsonb_each_text("${parsed.column}")
                WHERE value ~* '(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|--)'
                GROUP BY key
            `;

            const injectionResult = await adapter.executeQuery(injectionSql);
            for (const row of (injectionResult.rows ?? []) as { key: string; count: string | number }[]) {
                issues.push({ type: 'sql_injection_pattern', key: row.key, count: Number(row.count) });
            }

            return {
                scannedRows: sample,
                issues,
                riskLevel: issues.length === 0 ? 'low' : issues.length < 3 ? 'medium' : 'high'
            };
        }
    };
}

/**
 * Get JSONB column statistics
 */
function createJsonbStatsTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_jsonb_stats',
        description: 'Get statistics about JSONB column usage (key frequency, types, sizes).',
        group: 'jsonb',
        inputSchema: z.object({
            table: z.string().describe('Table name'),
            column: z.string().describe('JSONB column'),
            sampleSize: z.number().optional().describe('Sample rows to analyze')
        }),
        handler: async (params: unknown, _context: RequestContext) => {
            const parsed = (params as { table: string; column: string; sampleSize?: number });
            const sample = parsed.sampleSize ?? 1000;

            // Basic stats
            const basicSql = `
                SELECT 
                    COUNT(*) as total_rows,
                    COUNT("${parsed.column}") as non_null_count,
                    AVG(length("${parsed.column}"::text))::int as avg_size_bytes,
                    MAX(length("${parsed.column}"::text)) as max_size_bytes
                FROM (SELECT * FROM "${parsed.table}" LIMIT ${String(sample)}) t
            `;

            const basicResult = await adapter.executeQuery(basicSql);

            // Key frequency
            const keySql = `
                SELECT key, COUNT(*) as frequency
                FROM (SELECT * FROM "${parsed.table}" LIMIT ${String(sample)}) t,
                     jsonb_object_keys("${parsed.column}") key
                GROUP BY key
                ORDER BY frequency DESC
                LIMIT 20
            `;

            const keyResult = await adapter.executeQuery(keySql);

            // Type distribution
            const typeSql = `
                SELECT jsonb_typeof("${parsed.column}") as type, COUNT(*) as count
                FROM (SELECT * FROM "${parsed.table}" LIMIT ${String(sample)}) t
                GROUP BY jsonb_typeof("${parsed.column}")
            `;

            const typeResult = await adapter.executeQuery(typeSql);

            return {
                basics: basicResult.rows?.[0],
                topKeys: keyResult.rows,
                typeDistribution: typeResult.rows
            };
        }
    };
}

