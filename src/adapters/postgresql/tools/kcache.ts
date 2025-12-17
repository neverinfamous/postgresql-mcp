/**
 * PostgreSQL pg_stat_kcache Extension Tools
 * 
 * OS-level performance visibility: CPU, memory, and I/O statistics per query.
 * 7 tools total.
 * 
 * pg_stat_kcache extends pg_stat_statements with kernel-level resource metrics:
 * - CPU time (user and system)
 * - Filesystem reads/writes
 * - Page faults (memory pressure indicators)
 * 
 * Requires pg_stat_statements to be installed.
 */

import type { PostgresAdapter } from '../PostgresAdapter.js';
import type { ToolDefinition, RequestContext } from '../../../types/index.js';
import { z } from 'zod';
import { readOnly, write, destructive } from '../../../utils/annotations.js';
import {
    KcacheQueryStatsSchema,
    KcacheDatabaseStatsSchema,
    KcacheResourceAnalysisSchema
} from '../types.js';

/**
 * Get all pg_stat_kcache tools
 */
export function getKcacheTools(adapter: PostgresAdapter): ToolDefinition[] {
    return [
        createKcacheExtensionTool(adapter),
        createKcacheQueryStatsTool(adapter),
        createKcacheTopCpuTool(adapter),
        createKcacheTopIoTool(adapter),
        createKcacheDatabaseStatsTool(adapter),
        createKcacheResourceAnalysisTool(adapter),
        createKcacheResetTool(adapter)
    ];
}

/**
 * Enable the pg_stat_kcache extension
 */
function createKcacheExtensionTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_kcache_create_extension',
        description: `Enable the pg_stat_kcache extension for OS-level performance metrics. 
Requires pg_stat_statements to be installed first. Both extensions must be in shared_preload_libraries.`,
        group: 'kcache',
        inputSchema: z.object({}),
        annotations: write('Create Kcache Extension'),
        handler: async (_params: unknown, _context: RequestContext) => {
            const statementsCheck = await adapter.executeQuery(`
                SELECT EXISTS(
                    SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements'
                ) as installed
            `);

            const hasStatements = statementsCheck.rows?.[0]?.['installed'] as boolean ?? false;
            if (!hasStatements) {
                return {
                    success: false,
                    error: 'pg_stat_statements must be installed before pg_stat_kcache',
                    hint: 'Run: CREATE EXTENSION IF NOT EXISTS pg_stat_statements'
                };
            }

            await adapter.executeQuery('CREATE EXTENSION IF NOT EXISTS pg_stat_kcache');
            return {
                success: true,
                message: 'pg_stat_kcache extension enabled',
                note: 'Ensure pg_stat_kcache is in shared_preload_libraries for full functionality'
            };
        }
    };
}

/**
 * Query stats with CPU/IO metrics joined from pg_stat_statements
 */
function createKcacheQueryStatsTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_kcache_query_stats',
        description: `Get query statistics with OS-level CPU and I/O metrics. 
Joins pg_stat_statements with pg_stat_kcache to show what SQL did AND what system resources it consumed.`,
        group: 'kcache',
        inputSchema: KcacheQueryStatsSchema,
        annotations: readOnly('Kcache Query Stats'),
        handler: async (params: unknown, _context: RequestContext) => {
            const { limit, orderBy, minCalls } = KcacheQueryStatsSchema.parse(params);

            const limitVal = limit ?? 25;
            const orderColumn = orderBy === 'cpu_time'
                ? '(k.user_time + k.system_time)'
                : orderBy === 'reads'
                    ? 'k.reads'
                    : orderBy === 'writes'
                        ? 'k.writes'
                        : 's.total_exec_time';

            const conditions: string[] = [];
            const queryParams: unknown[] = [];
            let paramIndex = 1;

            if (minCalls !== undefined) {
                conditions.push(`s.calls >= $${String(paramIndex++)}`);
                queryParams.push(minCalls);
            }

            const whereClause = conditions.length > 0
                ? `WHERE ${conditions.join(' AND ')}`
                : '';

            const sql = `
                SELECT 
                    s.queryid,
                    LEFT(s.query, 100) as query_preview,
                    s.calls,
                    s.total_exec_time as total_time_ms,
                    s.mean_exec_time as mean_time_ms,
                    k.user_time,
                    k.system_time,
                    (k.user_time + k.system_time) as total_cpu_time,
                    k.reads,
                    k.reads_blks,
                    k.writes,
                    k.writes_blks,
                    k.minflts as minor_page_faults,
                    k.majflts as major_page_faults
                FROM pg_stat_statements s
                JOIN pg_stat_kcache() k ON s.queryid = k.queryid 
                    AND s.userid = k.userid 
                    AND s.dbid = k.dbid
                ${whereClause}
                ORDER BY ${orderColumn} DESC
                LIMIT ${String(limitVal)}
            `;

            const result = await adapter.executeQuery(sql, queryParams);

            return {
                queries: result.rows ?? [],
                count: result.rows?.length ?? 0,
                orderBy: orderBy ?? 'total_time'
            };
        }
    };
}

/**
 * Top CPU-consuming queries
 */
function createKcacheTopCpuTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_kcache_top_cpu',
        description: `Get top CPU-consuming queries. Shows which queries spend the most time 
in user CPU (application code) vs system CPU (kernel operations).`,
        group: 'kcache',
        inputSchema: z.object({
            limit: z.number().optional().describe('Number of top queries to return (default: 10)')
        }),
        annotations: readOnly('Kcache Top CPU'),
        handler: async (params: unknown, _context: RequestContext) => {
            const parsed = params as { limit?: number };
            const limitVal = parsed.limit ?? 10;

            const sql = `
                SELECT 
                    s.queryid,
                    LEFT(s.query, 100) as query_preview,
                    s.calls,
                    k.user_time,
                    k.system_time,
                    (k.user_time + k.system_time) as total_cpu_time,
                    CASE 
                        WHEN (k.user_time + k.system_time) > 0 
                        THEN ROUND((k.user_time / (k.user_time + k.system_time) * 100)::numeric, 2)
                        ELSE 0 
                    END as user_cpu_percent,
                    s.total_exec_time as total_time_ms,
                    CASE 
                        WHEN s.total_exec_time > 0 
                        THEN ROUND(((k.user_time + k.system_time) / s.total_exec_time * 100)::numeric, 2)
                        ELSE 0 
                    END as cpu_time_percent
                FROM pg_stat_statements s
                JOIN pg_stat_kcache() k ON s.queryid = k.queryid 
                    AND s.userid = k.userid 
                    AND s.dbid = k.dbid
                WHERE (k.user_time + k.system_time) > 0
                ORDER BY (k.user_time + k.system_time) DESC
                LIMIT ${String(limitVal)}
            `;

            const result = await adapter.executeQuery(sql);

            return {
                topCpuQueries: result.rows ?? [],
                count: result.rows?.length ?? 0,
                description: 'Queries ranked by total CPU time (user + system)'
            };
        }
    };
}

/**
 * Top I/O-consuming queries
 */
function createKcacheTopIoTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_kcache_top_io',
        description: `Get top I/O-consuming queries. Shows filesystem-level reads and writes, 
which represent actual disk access (not just shared buffer hits).`,
        group: 'kcache',
        inputSchema: z.object({
            type: z.enum(['reads', 'writes', 'both']).optional()
                .describe('I/O type to rank by (default: both)'),
            limit: z.number().optional().describe('Number of top queries to return (default: 10)')
        }),
        annotations: readOnly('Kcache Top IO'),
        handler: async (params: unknown, _context: RequestContext) => {
            const parsed = params as { type?: 'reads' | 'writes' | 'both'; limit?: number };
            const ioType = parsed.type ?? 'both';
            const limitVal = parsed.limit ?? 10;

            const orderColumn = ioType === 'reads'
                ? 'k.reads'
                : ioType === 'writes'
                    ? 'k.writes'
                    : '(k.reads + k.writes)';

            const sql = `
                SELECT 
                    s.queryid,
                    LEFT(s.query, 100) as query_preview,
                    s.calls,
                    k.reads as read_bytes,
                    k.reads_blks as read_blocks,
                    k.writes as write_bytes,
                    k.writes_blks as write_blocks,
                    (k.reads + k.writes) as total_io_bytes,
                    pg_size_pretty(k.reads::bigint) as reads_pretty,
                    pg_size_pretty(k.writes::bigint) as writes_pretty,
                    s.total_exec_time as total_time_ms
                FROM pg_stat_statements s
                JOIN pg_stat_kcache() k ON s.queryid = k.queryid 
                    AND s.userid = k.userid 
                    AND s.dbid = k.dbid
                WHERE (k.reads + k.writes) > 0
                ORDER BY ${orderColumn} DESC
                LIMIT ${String(limitVal)}
            `;

            const result = await adapter.executeQuery(sql);

            return {
                topIoQueries: result.rows ?? [],
                count: result.rows?.length ?? 0,
                ioType,
                description: `Queries ranked by ${ioType === 'both' ? 'total I/O' : ioType}`
            };
        }
    };
}

/**
 * Database-level aggregated stats
 */
function createKcacheDatabaseStatsTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_kcache_database_stats',
        description: `Get aggregated OS-level statistics for a database. 
Shows total CPU time, I/O, and page faults across all queries.`,
        group: 'kcache',
        inputSchema: KcacheDatabaseStatsSchema,
        annotations: readOnly('Kcache Database Stats'),
        handler: async (params: unknown, _context: RequestContext) => {
            const { database } = KcacheDatabaseStatsSchema.parse(params);

            let sql: string;
            const queryParams: unknown[] = [];

            if (database !== undefined) {
                sql = `
                    SELECT 
                        d.datname as database,
                        SUM(k.user_time) as total_user_time,
                        SUM(k.system_time) as total_system_time,
                        SUM(k.user_time + k.system_time) as total_cpu_time,
                        SUM(k.reads) as total_reads,
                        SUM(k.writes) as total_writes,
                        pg_size_pretty(SUM(k.reads)::bigint) as total_reads_pretty,
                        pg_size_pretty(SUM(k.writes)::bigint) as total_writes_pretty,
                        SUM(k.minflts) as total_minor_faults,
                        SUM(k.majflts) as total_major_faults,
                        COUNT(DISTINCT k.queryid) as unique_queries
                    FROM pg_stat_kcache k
                    JOIN pg_database d ON k.datname = d.datname
                    WHERE d.datname = $1
                    GROUP BY d.datname
                `;
                queryParams.push(database);
            } else {
                sql = `
                    SELECT 
                        datname as database,
                        SUM(user_time) as total_user_time,
                        SUM(system_time) as total_system_time,
                        SUM(user_time + system_time) as total_cpu_time,
                        SUM(reads) as total_reads,
                        SUM(writes) as total_writes,
                        pg_size_pretty(SUM(reads)::bigint) as total_reads_pretty,
                        pg_size_pretty(SUM(writes)::bigint) as total_writes_pretty,
                        SUM(minflts) as total_minor_faults,
                        SUM(majflts) as total_major_faults,
                        COUNT(DISTINCT queryid) as unique_queries
                    FROM pg_stat_kcache
                    GROUP BY datname
                    ORDER BY SUM(user_time + system_time) DESC
                `;
            }

            const result = await adapter.executeQuery(sql, queryParams);

            return {
                databaseStats: result.rows ?? [],
                count: result.rows?.length ?? 0
            };
        }
    };
}

/**
 * Classify queries as CPU-bound vs I/O-bound
 */
function createKcacheResourceAnalysisTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_kcache_resource_analysis',
        description: `Analyze queries to classify them as CPU-bound, I/O-bound, or balanced.
Helps identify the root cause of performance issues - is the query computation-heavy or disk-heavy?`,
        group: 'kcache',
        inputSchema: KcacheResourceAnalysisSchema,
        annotations: readOnly('Kcache Resource Analysis'),
        handler: async (params: unknown, _context: RequestContext) => {
            const { queryId, threshold } = KcacheResourceAnalysisSchema.parse(params);
            const thresholdVal = threshold ?? 0.5;

            const conditions: string[] = [];
            const queryParams: unknown[] = [];
            let paramIndex = 1;

            if (queryId !== undefined) {
                conditions.push(`s.queryid::text = $${String(paramIndex++)}`);
                queryParams.push(queryId);
            }

            conditions.push('(k.user_time + k.system_time + k.reads + k.writes) > 0');

            const whereClause = conditions.length > 0
                ? `WHERE ${conditions.join(' AND ')}`
                : '';

            const sql = `
                WITH query_metrics AS (
                    SELECT 
                        s.queryid,
                        LEFT(s.query, 100) as query_preview,
                        s.calls,
                        s.total_exec_time as total_time_ms,
                        (k.user_time + k.system_time) as cpu_time,
                        (k.reads + k.writes) as io_bytes,
                        k.user_time,
                        k.system_time,
                        k.reads,
                        k.writes
                    FROM pg_stat_statements s
                    JOIN pg_stat_kcache() k ON s.queryid = k.queryid 
                        AND s.userid = k.userid 
                        AND s.dbid = k.dbid
                    ${whereClause}
                )
                SELECT 
                    queryid,
                    query_preview,
                    calls,
                    total_time_ms,
                    cpu_time,
                    io_bytes,
                    CASE 
                        WHEN cpu_time > 0 AND io_bytes > 0 THEN
                            CASE 
                                WHEN (cpu_time / NULLIF(io_bytes::float / 1000000, 0)) > ${String(1 / thresholdVal)} THEN 'CPU-bound'
                                WHEN (io_bytes::float / 1000000 / NULLIF(cpu_time, 0)) > ${String(1 / thresholdVal)} THEN 'I/O-bound'
                                ELSE 'Balanced'
                            END
                        WHEN cpu_time > 0 THEN 'CPU-bound'
                        WHEN io_bytes > 0 THEN 'I/O-bound'
                        ELSE 'Unknown'
                    END as resource_classification,
                    user_time,
                    system_time,
                    reads,
                    writes,
                    pg_size_pretty(io_bytes::bigint) as io_pretty
                FROM query_metrics
                ORDER BY total_time_ms DESC
                LIMIT 50
            `;

            const result = await adapter.executeQuery(sql, queryParams);
            const rows = result.rows ?? [];

            const cpuBound = rows.filter((r: Record<string, unknown>) =>
                r['resource_classification'] === 'CPU-bound').length;
            const ioBound = rows.filter((r: Record<string, unknown>) =>
                r['resource_classification'] === 'I/O-bound').length;
            const balanced = rows.filter((r: Record<string, unknown>) =>
                r['resource_classification'] === 'Balanced').length;

            return {
                queries: rows,
                count: rows.length,
                summary: {
                    cpuBound,
                    ioBound,
                    balanced,
                    threshold: thresholdVal
                },
                recommendations: [
                    cpuBound > ioBound
                        ? 'Most resource-intensive queries are CPU-bound. Consider query optimization or more CPU resources.'
                        : ioBound > cpuBound
                            ? 'Most resource-intensive queries are I/O-bound. Consider more memory, faster storage, or better indexing.'
                            : 'Resource usage is balanced between CPU and I/O.'
                ]
            };
        }
    };
}

/**
 * Reset kcache statistics
 */
function createKcacheResetTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_kcache_reset',
        description: `Reset pg_stat_kcache statistics. Use this to start fresh measurements. 
Note: This also resets pg_stat_statements statistics.`,
        group: 'kcache',
        inputSchema: z.object({}),
        annotations: destructive('Reset Kcache Stats'),
        handler: async (_params: unknown, _context: RequestContext) => {
            await adapter.executeQuery('SELECT pg_stat_kcache_reset()');
            return {
                success: true,
                message: 'pg_stat_kcache statistics reset',
                note: 'pg_stat_statements statistics were also reset'
            };
        }
    };
}
