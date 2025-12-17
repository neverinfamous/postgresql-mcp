/**
 * PostgreSQL Performance Tools
 * 
 * Query analysis, statistics, and performance monitoring.
 * 16 tools total.
 */

import type { PostgresAdapter } from '../PostgresAdapter.js';
import type { ToolDefinition, RequestContext } from '../../../types/index.js';
import { z } from 'zod';
import { readOnly } from '../../../utils/annotations.js';
import { ExplainSchema, IndexStatsSchema, TableStatsSchema } from '../types.js';

/**
 * Get all performance tools
 */
export function getPerformanceTools(adapter: PostgresAdapter): ToolDefinition[] {
    return [
        createExplainTool(adapter),
        createExplainAnalyzeTool(adapter),
        createExplainBuffersTool(adapter),
        createIndexStatsTool(adapter),
        createTableStatsTool(adapter),
        createStatStatementsTool(adapter),
        createStatActivityTool(adapter),
        createLocksTool(adapter),
        createBloatCheckTool(adapter),
        createCacheHitRatioTool(adapter),
        createSeqScanTablesTool(adapter),
        createIndexRecommendationsTool(adapter),
        createQueryPlanCompareTool(adapter),
        createPerformanceBaselineTool(adapter),
        createConnectionPoolOptimizeTool(adapter),
        createPartitionStrategySuggestTool(adapter)
    ];
}

function createExplainTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_explain',
        description: 'Show query execution plan without running the query.',
        group: 'performance',
        inputSchema: ExplainSchema,
        annotations: readOnly('Explain Query'),
        handler: async (params: unknown, _context: RequestContext) => {
            const { sql, format } = ExplainSchema.parse(params);
            const fmt = format ?? 'text';
            const explainSql = `EXPLAIN (FORMAT ${fmt.toUpperCase()}) ${sql}`;
            const result = await adapter.executeQuery(explainSql);

            if (fmt === 'json') {
                return { plan: result.rows?.[0]?.['QUERY PLAN'] };
            }
            return { plan: result.rows?.map(r => Object.values(r)[0]).join('\n') };
        }
    };
}

function createExplainAnalyzeTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_explain_analyze',
        description: 'Run query and show actual execution plan with timing.',
        group: 'performance',
        inputSchema: ExplainSchema,
        annotations: readOnly('Explain Analyze'),
        handler: async (params: unknown, _context: RequestContext) => {
            const { sql, format } = ExplainSchema.parse(params);
            const fmt = format ?? 'text';
            const explainSql = `EXPLAIN (ANALYZE, FORMAT ${fmt.toUpperCase()}) ${sql}`;
            const result = await adapter.executeQuery(explainSql);

            if (fmt === 'json') {
                return { plan: result.rows?.[0]?.['QUERY PLAN'] };
            }
            return { plan: result.rows?.map(r => Object.values(r)[0]).join('\n') };
        }
    };
}

function createExplainBuffersTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_explain_buffers',
        description: 'Show query plan with buffer usage statistics.',
        group: 'performance',
        inputSchema: ExplainSchema,
        annotations: readOnly('Explain Buffers'),
        handler: async (params: unknown, _context: RequestContext) => {
            const { sql, format } = ExplainSchema.parse(params);
            const fmt = format ?? 'json';
            const explainSql = `EXPLAIN (ANALYZE, BUFFERS, FORMAT ${fmt.toUpperCase()}) ${sql}`;
            const result = await adapter.executeQuery(explainSql);

            if (fmt === 'json') {
                return { plan: result.rows?.[0]?.['QUERY PLAN'] };
            }
            return { plan: result.rows?.map(r => Object.values(r)[0]).join('\n') };
        }
    };
}

function createIndexStatsTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_index_stats',
        description: 'Get index usage statistics.',
        group: 'performance',
        inputSchema: IndexStatsSchema,
        annotations: readOnly('Index Stats'),
        handler: async (params: unknown, _context: RequestContext) => {
            const { table, schema } = IndexStatsSchema.parse(params);
            let whereClause = "schemaname NOT IN ('pg_catalog', 'information_schema')";
            if (schema) whereClause += ` AND schemaname = '${schema}'`;
            if (table) whereClause += ` AND relname = '${table}'`;

            const sql = `SELECT schemaname, relname as table_name, indexrelname as index_name,
                        idx_scan as scans, idx_tup_read as tuples_read, idx_tup_fetch as tuples_fetched,
                        pg_size_pretty(pg_relation_size(indexrelid)) as size
                        FROM pg_stat_user_indexes
                        WHERE ${whereClause}
                        ORDER BY idx_scan DESC`;

            const result = await adapter.executeQuery(sql);
            return { indexes: result.rows };
        }
    };
}

function createTableStatsTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_table_stats',
        description: 'Get table access statistics.',
        group: 'performance',
        inputSchema: TableStatsSchema,
        annotations: readOnly('Table Stats'),
        handler: async (params: unknown, _context: RequestContext) => {
            const { table, schema } = TableStatsSchema.parse(params);
            let whereClause = "schemaname NOT IN ('pg_catalog', 'information_schema')";
            if (schema) whereClause += ` AND schemaname = '${schema}'`;
            if (table) whereClause += ` AND relname = '${table}'`;

            const sql = `SELECT schemaname, relname as table_name,
                        seq_scan, seq_tup_read, idx_scan, idx_tup_fetch,
                        n_tup_ins as inserts, n_tup_upd as updates, n_tup_del as deletes,
                        n_live_tup as live_tuples, n_dead_tup as dead_tuples,
                        last_vacuum, last_autovacuum, last_analyze, last_autoanalyze
                        FROM pg_stat_user_tables
                        WHERE ${whereClause}
                        ORDER BY seq_scan DESC`;

            const result = await adapter.executeQuery(sql);
            return { tables: result.rows };
        }
    };
}

function createStatStatementsTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_stat_statements',
        description: 'Get query statistics from pg_stat_statements (requires extension).',
        group: 'performance',
        inputSchema: z.object({
            limit: z.number().optional(),
            orderBy: z.enum(['total_time', 'calls', 'mean_time', 'rows']).optional()
        }),
        annotations: readOnly('Query Statistics'),
        handler: async (params: unknown, _context: RequestContext) => {
            const parsed = (params as { limit?: number; orderBy?: string });
            const limit = parsed.limit ?? 20;
            const orderBy = parsed.orderBy ?? 'total_time';

            const sql = `SELECT query, calls, total_exec_time as total_time, 
                        mean_exec_time as mean_time, rows,
                        shared_blks_hit, shared_blks_read
                        FROM pg_stat_statements
                        ORDER BY ${orderBy === 'total_time' ? 'total_exec_time' : orderBy} DESC
                        LIMIT ${String(limit)}`;

            const result = await adapter.executeQuery(sql);
            return { statements: result.rows };
        }
    };
}

function createStatActivityTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_stat_activity',
        description: 'Get currently running queries and connections.',
        group: 'performance',
        inputSchema: z.object({
            includeIdle: z.boolean().optional()
        }),
        annotations: readOnly('Activity Stats'),
        handler: async (params: unknown, _context: RequestContext) => {
            const parsed = (params as { includeIdle?: boolean });
            const idleClause = parsed.includeIdle ? '' : "AND state != 'idle'";

            const sql = `SELECT pid, usename, datname, client_addr, state,
                        query_start, state_change,
                        now() - query_start as duration,
                        query
                        FROM pg_stat_activity
                        WHERE pid != pg_backend_pid() ${idleClause}
                        ORDER BY query_start`;

            const result = await adapter.executeQuery(sql);
            return { connections: result.rows, count: result.rows?.length ?? 0 };
        }
    };
}

function createLocksTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_locks',
        description: 'View current lock information.',
        group: 'performance',
        inputSchema: z.object({
            showBlocked: z.boolean().optional()
        }),
        annotations: readOnly('Lock Information'),
        handler: async (params: unknown, _context: RequestContext) => {
            const parsed = (params as { showBlocked?: boolean });

            let sql: string;
            if (parsed.showBlocked) {
                sql = `SELECT blocked.pid as blocked_pid, blocked.query as blocked_query,
                        blocking.pid as blocking_pid, blocking.query as blocking_query
                        FROM pg_stat_activity blocked
                        JOIN pg_locks bl ON blocked.pid = bl.pid
                        JOIN pg_locks lk ON bl.locktype = lk.locktype 
                            AND bl.relation = lk.relation 
                            AND bl.pid != lk.pid
                        JOIN pg_stat_activity blocking ON lk.pid = blocking.pid
                        WHERE NOT bl.granted`;
            } else {
                sql = `SELECT l.locktype, l.relation::regclass, l.mode, l.granted,
                        a.pid, a.usename, a.query, a.state
                        FROM pg_locks l
                        JOIN pg_stat_activity a ON l.pid = a.pid
                        WHERE l.pid != pg_backend_pid()
                        ORDER BY l.granted, l.pid`;
            }

            const result = await adapter.executeQuery(sql);
            return { locks: result.rows };
        }
    };
}

function createBloatCheckTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_bloat_check',
        description: 'Check for table and index bloat.',
        group: 'performance',
        inputSchema: z.object({
            schema: z.string().optional()
        }),
        annotations: readOnly('Bloat Check'),
        handler: async (params: unknown, _context: RequestContext) => {
            const parsed = (params as { schema?: string });
            const schemaClause = parsed.schema ? `AND schemaname = '${parsed.schema}'` : '';

            const sql = `SELECT schemaname, relname as table_name,
                        n_live_tup as live_tuples, n_dead_tup as dead_tuples,
                        CASE WHEN n_live_tup > 0 THEN round(100.0 * n_dead_tup / n_live_tup, 2) ELSE 0 END as dead_pct,
                        pg_size_pretty(pg_table_size(relid)) as table_size
                        FROM pg_stat_user_tables
                        WHERE n_dead_tup > 0 ${schemaClause}
                        ORDER BY n_dead_tup DESC
                        LIMIT 20`;

            const result = await adapter.executeQuery(sql);
            return { bloatedTables: result.rows };
        }
    };
}

function createCacheHitRatioTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_cache_hit_ratio',
        description: 'Get buffer cache hit ratio statistics.',
        group: 'performance',
        inputSchema: z.object({}),
        annotations: readOnly('Cache Hit Ratio'),
        handler: async (_params: unknown, _context: RequestContext) => {
            const sql = `SELECT 
                        sum(heap_blks_read) as heap_read,
                        sum(heap_blks_hit) as heap_hit,
                        CASE WHEN sum(heap_blks_read) + sum(heap_blks_hit) > 0 
                            THEN round(100.0 * sum(heap_blks_hit) / (sum(heap_blks_hit) + sum(heap_blks_read)), 2)
                            ELSE 100 END as cache_hit_ratio
                        FROM pg_statio_user_tables`;

            const result = await adapter.executeQuery(sql);
            return result.rows?.[0];
        }
    };
}

function createSeqScanTablesTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_seq_scan_tables',
        description: 'Find tables with high sequential scan counts (potential missing indexes).',
        group: 'performance',
        inputSchema: z.object({
            minScans: z.number().optional()
        }),
        annotations: readOnly('Sequential Scan Tables'),
        handler: async (params: unknown, _context: RequestContext) => {
            const parsed = (params as { minScans?: number });
            const minScans = parsed.minScans ?? 100;

            const sql = `SELECT schemaname, relname as table_name,
                        seq_scan, seq_tup_read, 
                        idx_scan, idx_tup_fetch,
                        CASE WHEN idx_scan > 0 THEN round(100.0 * seq_scan / (seq_scan + idx_scan), 2) ELSE 100 END as seq_scan_pct
                        FROM pg_stat_user_tables
                        WHERE seq_scan > ${String(minScans)}
                        ORDER BY seq_scan DESC`;

            const result = await adapter.executeQuery(sql);
            return { tables: result.rows };
        }
    };
}

function createIndexRecommendationsTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_index_recommendations',
        description: 'Suggest missing indexes based on table statistics.',
        group: 'performance',
        inputSchema: z.object({
            table: z.string().optional()
        }),
        annotations: readOnly('Index Recommendations'),
        handler: async (params: unknown, _context: RequestContext) => {
            const parsed = (params as { table?: string });
            const tableClause = parsed.table ? `AND relname = '${parsed.table}'` : '';

            const sql = `SELECT schemaname, relname as table_name,
                        seq_scan, idx_scan,
                        n_live_tup as row_count,
                        pg_size_pretty(pg_table_size(relid)) as size,
                        CASE 
                            WHEN idx_scan = 0 AND seq_scan > 100 THEN 'HIGH - No index usage, many seq scans'
                            WHEN idx_scan > 0 AND seq_scan > idx_scan * 10 THEN 'MEDIUM - Seq scans dominate'
                            ELSE 'LOW - Good index usage'
                        END as recommendation
                        FROM pg_stat_user_tables
                        WHERE seq_scan > 50 ${tableClause}
                        ORDER BY seq_scan DESC
                        LIMIT 20`;

            const result = await adapter.executeQuery(sql);
            return { recommendations: result.rows };
        }
    };
}

/**
 * Compare two query execution plans
 */
function createQueryPlanCompareTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_query_plan_compare',
        description: 'Compare execution plans of two SQL queries to identify performance differences.',
        group: 'performance',
        inputSchema: z.object({
            query1: z.string().describe('First SQL query'),
            query2: z.string().describe('Second SQL query'),
            analyze: z.boolean().optional().describe('Run EXPLAIN ANALYZE (executes queries)')
        }),
        annotations: readOnly('Query Plan Compare'),
        handler: async (params: unknown, _context: RequestContext) => {
            const parsed = (params as { query1: string; query2: string; analyze?: boolean });
            const explainType = parsed.analyze ? 'EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)' : 'EXPLAIN (FORMAT JSON)';

            const [result1, result2] = await Promise.all([
                adapter.executeQuery(`${explainType} ${parsed.query1}`),
                adapter.executeQuery(`${explainType} ${parsed.query2}`)
            ]);

            const row1 = result1.rows?.[0];
            const row2 = result2.rows?.[0];
            const queryPlan1 = row1?.['QUERY PLAN'] as unknown[] | undefined;
            const queryPlan2 = row2?.['QUERY PLAN'] as unknown[] | undefined;
            const plan1 = queryPlan1?.[0] as Record<string, unknown> | undefined;
            const plan2 = queryPlan2?.[0] as Record<string, unknown> | undefined;

            const comparison = {
                query1: {
                    planningTime: plan1?.['Planning Time'],
                    executionTime: plan1?.['Execution Time'],
                    totalCost: (plan1?.['Plan'] as Record<string, unknown> | undefined)?.['Total Cost'],
                    sharedBuffersHit: plan1?.['Shared Hit Blocks'],
                    sharedBuffersRead: plan1?.['Shared Read Blocks']
                },
                query2: {
                    planningTime: plan2?.['Planning Time'],
                    executionTime: plan2?.['Execution Time'],
                    totalCost: (plan2?.['Plan'] as Record<string, unknown> | undefined)?.['Total Cost'],
                    sharedBuffersHit: plan2?.['Shared Hit Blocks'],
                    sharedBuffersRead: plan2?.['Shared Read Blocks']
                },
                analysis: {
                    costDifference: plan1 && plan2
                        ? Number((plan1['Plan'] as Record<string, unknown>)?.['Total Cost']) -
                        Number((plan2['Plan'] as Record<string, unknown>)?.['Total Cost'])
                        : null,
                    recommendation: ''
                },
                fullPlans: { plan1, plan2 }
            };

            if (comparison.analysis.costDifference !== null) {
                if (comparison.analysis.costDifference > 0) {
                    comparison.analysis.recommendation = 'Query 2 has lower estimated cost';
                } else if (comparison.analysis.costDifference < 0) {
                    comparison.analysis.recommendation = 'Query 1 has lower estimated cost';
                } else {
                    comparison.analysis.recommendation = 'Both queries have similar estimated cost';
                }
            }

            return comparison;
        }
    };
}

/**
 * Establish performance baseline
 */
function createPerformanceBaselineTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_performance_baseline',
        description: 'Capture current database performance metrics as a baseline for comparison.',
        group: 'performance',
        inputSchema: z.object({
            name: z.string().optional().describe('Baseline name for reference')
        }),
        annotations: readOnly('Performance Baseline'),
        handler: async (params: unknown, _context: RequestContext) => {
            const parsed = (params as { name?: string });
            const baselineName = parsed.name ?? `baseline_${new Date().toISOString()}`;

            const [cacheHit, tableStats, indexStats, connections, dbSize] = await Promise.all([
                adapter.executeQuery(`
                    SELECT 
                        sum(heap_blks_hit) as heap_hits,
                        sum(heap_blks_read) as heap_reads,
                        round(100.0 * sum(heap_blks_hit) / NULLIF(sum(heap_blks_hit) + sum(heap_blks_read), 0), 2) as cache_hit_ratio
                    FROM pg_statio_user_tables
                `),
                adapter.executeQuery(`
                    SELECT 
                        sum(seq_scan) as total_seq_scans,
                        sum(idx_scan) as total_idx_scans,
                        sum(n_tup_ins) as total_inserts,
                        sum(n_tup_upd) as total_updates,
                        sum(n_tup_del) as total_deletes,
                        sum(n_live_tup) as total_live_tuples,
                        sum(n_dead_tup) as total_dead_tuples
                    FROM pg_stat_user_tables
                `),
                adapter.executeQuery(`
                    SELECT 
                        count(*) as total_indexes,
                        sum(idx_scan) as total_index_scans
                    FROM pg_stat_user_indexes
                `),
                adapter.executeQuery(`
                    SELECT 
                        count(*) as total_connections,
                        count(*) FILTER (WHERE state = 'active') as active_connections,
                        count(*) FILTER (WHERE state = 'idle') as idle_connections
                    FROM pg_stat_activity
                    WHERE backend_type = 'client backend'
                `),
                adapter.executeQuery(`SELECT pg_database_size(current_database()) as size_bytes`)
            ]);

            return {
                name: baselineName,
                timestamp: new Date().toISOString(),
                metrics: {
                    cache: cacheHit.rows?.[0],
                    tables: tableStats.rows?.[0],
                    indexes: indexStats.rows?.[0],
                    connections: connections.rows?.[0],
                    databaseSize: dbSize.rows?.[0]
                }
            };
        }
    };
}

/**
 * Connection pool optimization recommendations
 */
function createConnectionPoolOptimizeTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_connection_pool_optimize',
        description: 'Analyze connection usage and provide pool optimization recommendations.',
        group: 'performance',
        inputSchema: z.object({}),
        annotations: readOnly('Connection Pool Optimize'),
        handler: async (_params: unknown, _context: RequestContext) => {
            const [connStats, settings, waitEvents] = await Promise.all([
                adapter.executeQuery(`
                    SELECT 
                        count(*) as total_connections,
                        count(*) FILTER (WHERE state = 'active') as active,
                        count(*) FILTER (WHERE state = 'idle') as idle,
                        count(*) FILTER (WHERE state = 'idle in transaction') as idle_in_transaction,
                        count(*) FILTER (WHERE wait_event_type IS NOT NULL) as waiting,
                        max(EXTRACT(EPOCH FROM (now() - backend_start))) as max_connection_age_seconds,
                        avg(EXTRACT(EPOCH FROM (now() - backend_start))) as avg_connection_age_seconds
                    FROM pg_stat_activity
                    WHERE backend_type = 'client backend'
                `),
                adapter.executeQuery(`
                    SELECT 
                        current_setting('max_connections')::int as max_connections,
                        current_setting('superuser_reserved_connections')::int as reserved_connections
                `),
                adapter.executeQuery(`
                    SELECT wait_event_type, wait_event, count(*) as count
                    FROM pg_stat_activity
                    WHERE wait_event IS NOT NULL AND backend_type = 'client backend'
                    GROUP BY wait_event_type, wait_event
                    ORDER BY count DESC
                    LIMIT 10
                `)
            ]);

            const conn = connStats.rows?.[0];
            const config = settings.rows?.[0];

            const recommendations: string[] = [];

            if (conn && config) {
                const totalConnections = Number(conn['total_connections'] ?? 0);
                const maxConnections = Number(config['max_connections'] ?? 1);
                const idleInTransaction = Number(conn['idle_in_transaction'] ?? 0);
                const active = Number(conn['active'] ?? 0);
                const idle = Number(conn['idle'] ?? 0);
                const maxConnectionAge = Number(conn['max_connection_age_seconds'] ?? 0);

                const utilization = (totalConnections / maxConnections) * 100;

                if (utilization > 80) {
                    recommendations.push('Connection utilization is high (>80%). Consider increasing max_connections or using a connection pooler like PgBouncer.');
                }
                if (idleInTransaction > active) {
                    recommendations.push('Many idle-in-transaction connections. Check for uncommitted transactions or application issues.');
                }
                if (idle > active * 3) {
                    recommendations.push('High ratio of idle to active connections. Consider reducing pool size or idle timeout.');
                }
                if (maxConnectionAge > 3600) {
                    recommendations.push('Long-lived connections detected. Consider connection recycling.');
                }
            }

            return {
                current: conn,
                config,
                waitEvents: waitEvents.rows,
                recommendations: recommendations.length > 0 ? recommendations : ['Connection pool appears healthy']
            };
        }
    };
}

/**
 * Partition strategy suggestions
 */
function createPartitionStrategySuggestTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_partition_strategy_suggest',
        description: 'Analyze a table and suggest optimal partitioning strategy.',
        group: 'performance',
        inputSchema: z.object({
            table: z.string().describe('Table to analyze'),
            schema: z.string().optional().describe('Schema name')
        }),
        annotations: readOnly('Partition Strategy Suggest'),
        handler: async (params: unknown, _context: RequestContext) => {
            const parsed = (params as { table: string; schema?: string });
            const schemaName = parsed.schema ?? 'public';

            const [tableInfo, columnInfo, tableSize] = await Promise.all([
                adapter.executeQuery(`
                    SELECT 
                        relname, n_live_tup, n_dead_tup,
                        seq_scan, idx_scan
                    FROM pg_stat_user_tables
                    WHERE relname = $1 AND schemaname = $2
                `, [parsed.table, schemaName]),
                adapter.executeQuery(`
                    SELECT 
                        a.attname as column_name,
                        t.typname as data_type,
                        s.n_distinct,
                        s.null_frac
                    FROM pg_attribute a
                    JOIN pg_class c ON a.attrelid = c.oid
                    JOIN pg_namespace n ON c.relnamespace = n.oid
                    JOIN pg_type t ON a.atttypid = t.oid
                    LEFT JOIN pg_stats s ON s.tablename = c.relname 
                        AND s.attname = a.attname 
                        AND s.schemaname = n.nspname
                    WHERE c.relname = $1 AND n.nspname = $2
                        AND a.attnum > 0 AND NOT a.attisdropped
                    ORDER BY a.attnum
                `, [parsed.table, schemaName]),
                adapter.executeQuery(`
                    SELECT pg_size_pretty(pg_table_size($1::regclass)) as table_size,
                           pg_table_size($1::regclass) as size_bytes
                `, [`"${schemaName}"."${parsed.table}"`])
            ]);

            const table = tableInfo.rows?.[0];
            const columns = columnInfo.rows;
            const size = tableSize.rows?.[0];

            const suggestions: { strategy: string; column: string; reason: string }[] = [];

            if (columns) {
                for (const col of columns) {
                    const colName = col['column_name'] as string;
                    const dataType = col['data_type'] as string;
                    const nDistinct = col['n_distinct'] as number;

                    if (['date', 'timestamp', 'timestamptz'].includes(dataType)) {
                        suggestions.push({
                            strategy: 'RANGE',
                            column: colName,
                            reason: `${dataType} column ideal for time-based range partitioning (monthly/yearly)`
                        });
                    }

                    if (nDistinct > 0 && nDistinct < 20) {
                        suggestions.push({
                            strategy: 'LIST',
                            column: colName,
                            reason: `Low cardinality (${String(nDistinct)} distinct values) - good for list partitioning`
                        });
                    }

                    if (['int4', 'int8', 'integer', 'bigint'].includes(dataType) && (nDistinct < 0 || nDistinct > 100)) {
                        suggestions.push({
                            strategy: 'HASH',
                            column: colName,
                            reason: 'High cardinality integer - suitable for hash partitioning to distribute load'
                        });
                    }
                }
            }

            const rowCount = Number(table?.['n_live_tup'] ?? 0);
            const sizeBytes = Number(size?.['size_bytes'] ?? 0);

            let partitioningRecommended = false;
            let reason = '';

            if (rowCount > 10_000_000) {
                partitioningRecommended = true;
                reason = `Table has ${String(rowCount)} rows - partitioning recommended for manageability`;
            } else if (sizeBytes > 1_000_000_000) {
                partitioningRecommended = true;
                reason = 'Table is over 1GB - partitioning can improve query performance and maintenance';
            }

            return {
                table: `${schemaName}.${parsed.table}`,
                tableStats: table,
                tableSize: size,
                partitioningRecommended,
                reason,
                suggestions: suggestions.slice(0, 5),
                note: 'Consider your query patterns when choosing partition key. Range partitioning on date columns is most common.'
            };
        }
    };
}
