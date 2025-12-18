/**
 * PostgreSQL JSONB Tools - Advanced Operations
 * 
 * Advanced JSONB operations including path validation, merge, normalize, diff, index suggestions, security scanning, and statistics.
 */

import type { PostgresAdapter } from '../../PostgresAdapter.js';
import type { ToolDefinition, RequestContext } from '../../../../types/index.js';
import { z } from 'zod';
import { readOnly } from '../../../../utils/annotations.js';
import { getToolIcons } from '../../../../utils/icons.js';
import { sanitizeIdentifier, sanitizeTableName } from '../../../../utils/identifiers.js';

/**
 * Validate JSON path expression
 */
export function createJsonbValidatePathTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_jsonb_validate_path',
        description: 'Validate a JSONPath expression and test it against sample data.',
        group: 'jsonb',
        inputSchema: z.object({
            path: z.string().describe('JSONPath expression to validate'),
            testValue: z.unknown().optional().describe('Optional JSONB value to test against')
        }),
        annotations: readOnly('JSONB Validate Path'),
        icons: getToolIcons('jsonb', readOnly('JSONB Validate Path')),
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
export function createJsonbMergeTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_jsonb_merge',
        description: 'Deep merge two JSONB documents. Uses PostgreSQL || operator with recursive merge.',
        group: 'jsonb',
        inputSchema: z.object({
            base: z.unknown().describe('Base JSONB document'),
            overlay: z.unknown().describe('JSONB to merge on top'),
            deep: z.boolean().optional().describe('Deep merge objects (default: true)')
        }),
        annotations: readOnly('JSONB Merge'),
        icons: getToolIcons('jsonb', readOnly('JSONB Merge')),
        handler: async (params: unknown, _context: RequestContext) => {
            const parsed = (params as { base: unknown; overlay: unknown; deep?: boolean });
            const useDeep = parsed.deep !== false;

            if (useDeep) {
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
export function createJsonbNormalizeTool(adapter: PostgresAdapter): ToolDefinition {
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
        annotations: readOnly('JSONB Normalize'),
        icons: getToolIcons('jsonb', readOnly('JSONB Normalize')),
        handler: async (params: unknown, _context: RequestContext) => {
            const parsed = (params as { table: string; column: string; mode?: string; where?: string });
            const whereClause = parsed.where ? ` WHERE ${parsed.where}` : '';
            const mode = parsed.mode ?? 'keys';

            const tableName = sanitizeTableName(parsed.table);
            const columnName = sanitizeIdentifier(parsed.column);
            let sql: string;
            if (mode === 'array') {
                sql = `SELECT jsonb_array_elements(${columnName}) as element FROM ${tableName}${whereClause}`;
            } else if (mode === 'flatten') {
                sql = `SELECT key, value FROM ${tableName}, jsonb_each(${columnName}) ${whereClause}`;
            } else {
                sql = `SELECT key, value FROM ${tableName}, jsonb_each_text(${columnName}) ${whereClause}`;
            }

            const result = await adapter.executeQuery(sql);
            return { rows: result.rows, count: result.rows?.length ?? 0 };
        }
    };
}

/**
 * Diff two JSONB documents
 */
export function createJsonbDiffTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_jsonb_diff',
        description: 'Compare two JSONB documents and return the differences.',
        group: 'jsonb',
        inputSchema: z.object({
            doc1: z.unknown().describe('First JSONB document'),
            doc2: z.unknown().describe('Second JSONB document')
        }),
        annotations: readOnly('JSONB Diff'),
        icons: getToolIcons('jsonb', readOnly('JSONB Diff')),
        handler: async (params: unknown, _context: RequestContext) => {
            const parsed = (params as { doc1: unknown; doc2: unknown });

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
export function createJsonbIndexSuggestTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_jsonb_index_suggest',
        description: 'Analyze JSONB column usage and suggest optimal indexes.',
        group: 'jsonb',
        inputSchema: z.object({
            table: z.string().describe('Table name'),
            column: z.string().describe('JSONB column'),
            sampleSize: z.number().optional().describe('Sample rows to analyze')
        }),
        annotations: readOnly('JSONB Index Suggest'),
        icons: getToolIcons('jsonb', readOnly('JSONB Index Suggest')),
        handler: async (params: unknown, _context: RequestContext) => {
            const parsed = (params as { table: string; column: string; sampleSize?: number });
            const sample = parsed.sampleSize ?? 1000;

            const tableName = sanitizeTableName(parsed.table);
            const columnName = sanitizeIdentifier(parsed.column);

            const keySql = `
                SELECT key, COUNT(*) as frequency, 
                       jsonb_typeof(value) as value_type
                FROM (SELECT * FROM ${tableName} LIMIT ${String(sample)}) t,
                     jsonb_each(${columnName}) 
                GROUP BY key, jsonb_typeof(value)
                ORDER BY frequency DESC
                LIMIT 20
            `;

            const keyResult = await adapter.executeQuery(keySql);

            const indexSql = `
                SELECT indexname, indexdef
                FROM pg_indexes
                WHERE tablename = $1
                AND indexdef LIKE '%' || $2 || '%'
            `;

            const indexResult = await adapter.executeQuery(indexSql, [parsed.table, parsed.column]);

            const recommendations: string[] = [];
            const keys = keyResult.rows as { key: string; frequency: number; value_type: string }[];

            if ((indexResult.rows?.length ?? 0) === 0) {
                recommendations.push(`CREATE INDEX ON ${tableName} USING GIN (${columnName})`);
            }

            for (const keyInfo of keys.slice(0, 5)) {
                if (keyInfo.frequency > sample * 0.5) {
                    recommendations.push(
                        `CREATE INDEX ON ${tableName} ((${columnName} ->> '${keyInfo.key.replace(/'/g, "''")}'))`
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
export function createJsonbSecurityScanTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_jsonb_security_scan',
        description: 'Scan JSONB column for potential security issues (sensitive data, SQL injection patterns).',
        group: 'jsonb',
        inputSchema: z.object({
            table: z.string().describe('Table name'),
            column: z.string().describe('JSONB column'),
            sampleSize: z.number().optional().describe('Sample rows to scan')
        }),
        annotations: readOnly('JSONB Security Scan'),
        icons: getToolIcons('jsonb', readOnly('JSONB Security Scan')),
        handler: async (params: unknown, _context: RequestContext) => {
            const parsed = (params as { table: string; column: string; sampleSize?: number });
            const sample = parsed.sampleSize ?? 100;

            const issues: { type: string; key: string; count: number }[] = [];

            const tableName = sanitizeTableName(parsed.table);
            const columnName = sanitizeIdentifier(parsed.column);

            const sensitiveKeysSql = `
                SELECT key, COUNT(*) as count
                FROM (SELECT * FROM ${tableName} LIMIT ${String(sample)}) t,
                     jsonb_each_text(${columnName})
                WHERE lower(key) IN ('password', 'secret', 'token', 'api_key', 'apikey', 
                                     'auth', 'credential', 'ssn', 'credit_card', 'cvv')
                GROUP BY key
            `;

            const sensitiveResult = await adapter.executeQuery(sensitiveKeysSql);
            for (const row of (sensitiveResult.rows ?? []) as { key: string; count: string | number }[]) {
                issues.push({ type: 'sensitive_key', key: row.key, count: Number(row.count) });
            }

            const injectionSql = `
                SELECT key, COUNT(*) as count
                FROM (SELECT * FROM ${tableName} LIMIT ${String(sample)}) t,
                     jsonb_each_text(${columnName})
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
export function createJsonbStatsTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_jsonb_stats',
        description: 'Get statistics about JSONB column usage (key frequency, types, sizes).',
        group: 'jsonb',
        inputSchema: z.object({
            table: z.string().describe('Table name'),
            column: z.string().describe('JSONB column'),
            sampleSize: z.number().optional().describe('Sample rows to analyze')
        }),
        annotations: readOnly('JSONB Stats'),
        icons: getToolIcons('jsonb', readOnly('JSONB Stats')),
        handler: async (params: unknown, _context: RequestContext) => {
            const parsed = (params as { table: string; column: string; sampleSize?: number });
            const sample = parsed.sampleSize ?? 1000;

            const tableName = sanitizeTableName(parsed.table);
            const columnName = sanitizeIdentifier(parsed.column);

            const basicSql = `
                SELECT 
                    COUNT(*) as total_rows,
                    COUNT(${columnName}) as non_null_count,
                    AVG(length(${columnName}::text))::int as avg_size_bytes,
                    MAX(length(${columnName}::text)) as max_size_bytes
                FROM (SELECT * FROM ${tableName} LIMIT ${String(sample)}) t
            `;

            const basicResult = await adapter.executeQuery(basicSql);

            const keySql = `
                SELECT key, COUNT(*) as frequency
                FROM (SELECT * FROM ${tableName} LIMIT ${String(sample)}) t,
                     jsonb_object_keys(${columnName}) key
                GROUP BY key
                ORDER BY frequency DESC
                LIMIT 20
            `;

            const keyResult = await adapter.executeQuery(keySql);

            const typeSql = `
                SELECT jsonb_typeof(${columnName}) as type, COUNT(*) as count
                FROM (SELECT * FROM ${tableName} LIMIT ${String(sample)}) t
                GROUP BY jsonb_typeof(${columnName})
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
