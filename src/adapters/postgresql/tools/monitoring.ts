/**
 * PostgreSQL Monitoring Tools
 * 
 * Database health, sizes, connections, and replication status.
 * 8 tools total.
 */

import type { PostgresAdapter } from '../PostgresAdapter.js';
import type { ToolDefinition, RequestContext } from '../../../types/index.js';
import { z } from 'zod';
import { DatabaseSizeSchema, TableSizesSchema, ShowSettingsSchema } from '../types.js';

/**
 * Get all monitoring tools
 */
export function getMonitoringTools(adapter: PostgresAdapter): ToolDefinition[] {
    return [
        createDatabaseSizeTool(adapter),
        createTableSizesTool(adapter),
        createConnectionStatsTool(adapter),
        createReplicationStatusTool(adapter),
        createServerVersionTool(adapter),
        createShowSettingsTool(adapter),
        createUptimeTool(adapter),
        createRecoveryStatusTool(adapter),
        createCapacityPlanningTool(adapter),
        createResourceUsageAnalyzeTool(adapter),
        createAlertThresholdSetTool(adapter)
    ];
}

function createDatabaseSizeTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_database_size',
        description: 'Get the size of a database.',
        group: 'monitoring',
        inputSchema: DatabaseSizeSchema,
        handler: async (params: unknown, _context: RequestContext) => {
            const { database } = DatabaseSizeSchema.parse(params);
            // Database size query - using database param directly
            const sql = database
                ? `SELECT pg_database_size($1) as bytes, pg_size_pretty(pg_database_size($1)) as size`
                : `SELECT pg_database_size(current_database()) as bytes, pg_size_pretty(pg_database_size(current_database())) as size`;
            const result = await adapter.executeQuery(sql, database ? [database] : []);
            return result.rows?.[0];
        }
    };
}

function createTableSizesTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_table_sizes',
        description: 'Get sizes of all tables with indexes and total.',
        group: 'monitoring',
        inputSchema: TableSizesSchema,
        handler: async (params: unknown, _context: RequestContext) => {
            const { schema, limit } = TableSizesSchema.parse(params);
            const schemaClause = schema ? `AND n.nspname = '${schema}'` : '';
            const limitClause = limit !== undefined && limit > 0 ? ` LIMIT ${String(limit)}` : ' LIMIT 50';

            const sql = `SELECT n.nspname as schema, c.relname as table_name,
                        pg_size_pretty(pg_table_size(c.oid)) as table_size,
                        pg_size_pretty(pg_indexes_size(c.oid)) as indexes_size,
                        pg_size_pretty(pg_total_relation_size(c.oid)) as total_size,
                        pg_total_relation_size(c.oid) as total_bytes
                        FROM pg_class c
                        LEFT JOIN pg_namespace n ON n.oid = c.relnamespace
                        WHERE c.relkind IN ('r', 'p')
                        AND n.nspname NOT IN ('pg_catalog', 'information_schema')
                        ${schemaClause}
                        ORDER BY pg_total_relation_size(c.oid) DESC${limitClause}`;

            const result = await adapter.executeQuery(sql);
            return { tables: result.rows };
        }
    };
}

function createConnectionStatsTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_connection_stats',
        description: 'Get connection statistics by database and state.',
        group: 'monitoring',
        inputSchema: z.object({}),
        handler: async (_params: unknown, _context: RequestContext) => {
            const sql = `SELECT datname, state, count(*) as connections
                        FROM pg_stat_activity
                        WHERE pid != pg_backend_pid()
                        GROUP BY datname, state
                        ORDER BY datname, state`;

            const result = await adapter.executeQuery(sql);

            // Also get max connections
            const maxResult = await adapter.executeQuery(`SHOW max_connections`);
            const maxConnections = maxResult.rows?.[0]?.['max_connections'];

            const totalResult = await adapter.executeQuery(
                `SELECT count(*) as total FROM pg_stat_activity`
            );

            return {
                byDatabaseAndState: result.rows,
                totalConnections: totalResult.rows?.[0]?.['total'],
                maxConnections
            };
        }
    };
}

function createReplicationStatusTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_replication_status',
        description: 'Check replication status and lag.',
        group: 'monitoring',
        inputSchema: z.object({}),
        handler: async (_params: unknown, _context: RequestContext) => {
            // Check if this is a replica
            const recoveryResult = await adapter.executeQuery(`SELECT pg_is_in_recovery() as is_replica`);
            const isReplica = recoveryResult.rows?.[0]?.['is_replica'];

            if (isReplica === true) {
                // Get replica lag info
                const sql = `SELECT 
                            now() - pg_last_xact_replay_timestamp() as replay_lag,
                            pg_last_wal_receive_lsn() as receive_lsn,
                            pg_last_wal_replay_lsn() as replay_lsn`;
                const result = await adapter.executeQuery(sql);
                return { role: 'replica', ...result.rows?.[0] };
            } else {
                // Get primary replication info
                const sql = `SELECT client_addr, state, sent_lsn, write_lsn, flush_lsn, replay_lsn,
                            now() - backend_start as connection_duration
                            FROM pg_stat_replication`;
                const result = await adapter.executeQuery(sql);
                return { role: 'primary', replicas: result.rows };
            }
        }
    };
}

function createServerVersionTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_server_version',
        description: 'Get PostgreSQL server version information.',
        group: 'monitoring',
        inputSchema: z.object({}),
        handler: async (_params: unknown, _context: RequestContext) => {
            const sql = `SELECT version() as full_version,
                        current_setting('server_version') as version,
                        current_setting('server_version_num') as version_num`;
            const result = await adapter.executeQuery(sql);
            return result.rows?.[0];
        }
    };
}

function createShowSettingsTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_show_settings',
        description: 'Show current PostgreSQL configuration settings.',
        group: 'monitoring',
        inputSchema: ShowSettingsSchema,
        handler: async (params: unknown, _context: RequestContext) => {
            const { pattern } = ShowSettingsSchema.parse(params);
            const whereClause = pattern ? `WHERE name LIKE $1` : '';

            const sql = `SELECT name, setting, unit, category, short_desc
                        FROM pg_settings
                        ${whereClause}
                        ORDER BY category, name`;

            const result = await adapter.executeQuery(sql, pattern ? [pattern] : []);
            return { settings: result.rows };
        }
    };
}

function createUptimeTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_uptime',
        description: 'Get server uptime and startup time.',
        group: 'monitoring',
        inputSchema: z.object({}),
        handler: async (_params: unknown, _context: RequestContext) => {
            const sql = `SELECT pg_postmaster_start_time() as start_time,
                        now() - pg_postmaster_start_time() as uptime`;
            const result = await adapter.executeQuery(sql);
            return result.rows?.[0];
        }
    };
}

function createRecoveryStatusTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_recovery_status',
        description: 'Check if server is in recovery mode (replica).',
        group: 'monitoring',
        inputSchema: z.object({}),
        handler: async (_params: unknown, _context: RequestContext) => {
            const sql = `SELECT pg_is_in_recovery() as in_recovery,
                        CASE WHEN pg_is_in_recovery() 
                            THEN pg_last_xact_replay_timestamp() 
                            ELSE NULL 
                        END as last_replay_timestamp`;
            const result = await adapter.executeQuery(sql);
            return result.rows?.[0];
        }
    };
}

/**
 * Capacity planning analysis
 */
function createCapacityPlanningTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_capacity_planning',
        description: 'Analyze database growth trends and provide capacity planning forecasts.',
        group: 'monitoring',
        inputSchema: z.object({
            projectionDays: z.number().optional().describe('Days to project growth (default: 90)')
        }),
        handler: async (params: unknown, _context: RequestContext) => {
            const parsed = (params as { projectionDays?: number });
            const projectionDays = parsed.projectionDays ?? 90;

            // Get current database size
            const [dbSize, tableStats, connStats] = await Promise.all([
                adapter.executeQuery(`
                    SELECT 
                        pg_database_size(current_database()) as current_size_bytes,
                        pg_size_pretty(pg_database_size(current_database())) as current_size
                `),
                adapter.executeQuery(`
                    SELECT 
                        count(*) as table_count,
                        sum(n_live_tup) as total_rows,
                        sum(n_tup_ins) as total_inserts,
                        sum(n_tup_del) as total_deletes
                    FROM pg_stat_user_tables
                `),
                adapter.executeQuery(`
                    SELECT 
                        current_setting('max_connections')::int as max_connections,
                        count(*) as current_connections
                    FROM pg_stat_activity
                    WHERE backend_type = 'client backend'
                `)
            ]);

            const currentBytes = Number(dbSize.rows?.[0]?.['current_size_bytes'] ?? 0);
            const tableData = tableStats.rows?.[0];
            const connData = connStats.rows?.[0];

            // Estimate daily growth (simplified - would need historical data for accuracy)
            const totalInserts = Number(tableData?.['total_inserts'] ?? 0);
            const totalDeletes = Number(tableData?.['total_deletes'] ?? 0);
            const netRowGrowth = totalInserts - totalDeletes;

            // Assume average row size based on current data
            const totalRows = Number(tableData?.['total_rows'] ?? 1);
            const avgRowSize = currentBytes / Math.max(totalRows, 1);

            // Project growth (very rough estimate)
            const dailyGrowthEstimate = (netRowGrowth * avgRowSize) / 30; // Assume stats accumulated over ~30 days
            const projectedGrowthBytes = dailyGrowthEstimate * projectionDays;
            const projectedTotalBytes = currentBytes + projectedGrowthBytes;

            return {
                current: {
                    databaseSize: dbSize.rows?.[0],
                    tableCount: tableData?.['table_count'],
                    totalRows: tableData?.['total_rows'],
                    connections: `${String(Number(connData?.['current_connections'] ?? 0))}/${String(Number(connData?.['max_connections'] ?? 0))}`
                },
                growth: {
                    totalInserts: tableData?.['total_inserts'],
                    totalDeletes: tableData?.['total_deletes'],
                    netRowGrowth,
                    estimatedDailyGrowthBytes: Math.round(dailyGrowthEstimate)
                },
                projection: {
                    days: projectionDays,
                    projectedSizeBytes: Math.round(projectedTotalBytes),
                    projectedSizePretty: `${(projectedTotalBytes / (1024 * 1024 * 1024)).toFixed(2)} GB`,
                    growthPercentage: ((projectedGrowthBytes / currentBytes) * 100).toFixed(1)
                },
                recommendations: [
                    projectedTotalBytes > 100 * 1024 * 1024 * 1024 ? 'Consider archiving old data or implementing table partitioning' : null,
                    (Number(connData?.['current_connections'] ?? 0)) > (Number(connData?.['max_connections'] ?? 100)) * 0.7 ? 'Connection usage is high, consider increasing max_connections' : null
                ].filter(Boolean)
            };
        }
    };
}

/**
 * Resource usage analysis
 */
function createResourceUsageAnalyzeTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_resource_usage_analyze',
        description: 'Analyze current resource usage including CPU, memory, and I/O patterns.',
        group: 'monitoring',
        inputSchema: z.object({}),
        handler: async (_params: unknown, _context: RequestContext) => {
            // Get comprehensive resource usage metrics
            const [bgWriter, checkpoints, connections, buffers, activity] = await Promise.all([
                adapter.executeQuery(`
                    SELECT 
                        buffers_checkpoint, buffers_clean, buffers_backend,
                        maxwritten_clean, buffers_alloc
                    FROM pg_stat_bgwriter
                `),
                adapter.executeQuery(`
                    SELECT 
                        checkpoints_timed, checkpoints_req,
                        checkpoint_write_time, checkpoint_sync_time
                    FROM pg_stat_bgwriter
                `),
                adapter.executeQuery(`
                    SELECT 
                        state, wait_event_type, wait_event,
                        count(*) as count
                    FROM pg_stat_activity
                    WHERE backend_type = 'client backend'
                    GROUP BY state, wait_event_type, wait_event
                `),
                adapter.executeQuery(`
                    SELECT 
                        sum(heap_blks_read) as heap_reads,
                        sum(heap_blks_hit) as heap_hits,
                        sum(idx_blks_read) as index_reads,
                        sum(idx_blks_hit) as index_hits
                    FROM pg_statio_user_tables
                `),
                adapter.executeQuery(`
                    SELECT 
                        count(*) FILTER (WHERE state = 'active') as active_queries,
                        count(*) FILTER (WHERE state = 'idle') as idle_connections,
                        count(*) FILTER (WHERE wait_event_type = 'Lock') as lock_waiting,
                        count(*) FILTER (WHERE wait_event_type = 'IO') as io_waiting
                    FROM pg_stat_activity
                    WHERE backend_type = 'client backend'
                `)
            ]);

            const bufferData = buffers.rows?.[0];
            const heapHits = Number(bufferData?.['heap_hits'] ?? 0);
            const heapReads = Number(bufferData?.['heap_reads'] ?? 0);
            const indexHits = Number(bufferData?.['index_hits'] ?? 0);
            const indexReads = Number(bufferData?.['index_reads'] ?? 0);

            return {
                backgroundWriter: bgWriter.rows?.[0],
                checkpoints: checkpoints.rows?.[0],
                connectionDistribution: connections.rows,
                bufferUsage: {
                    ...bufferData,
                    heapHitRate: heapHits + heapReads > 0
                        ? ((heapHits / (heapHits + heapReads)) * 100).toFixed(2) + '%'
                        : 'N/A',
                    indexHitRate: indexHits + indexReads > 0
                        ? ((indexHits / (indexHits + indexReads)) * 100).toFixed(2) + '%'
                        : 'N/A'
                },
                activity: activity.rows?.[0],
                analysis: {
                    checkpointPressure: Number(checkpoints.rows?.[0]?.['checkpoints_req'] ?? 0) > Number(checkpoints.rows?.[0]?.['checkpoints_timed'] ?? 0)
                        ? 'HIGH - More forced checkpoints than scheduled'
                        : 'Normal',
                    ioPattern: Number(activity.rows?.[0]?.['io_waiting'] ?? 0) > 0
                        ? 'Some queries waiting on I/O'
                        : 'No I/O wait bottlenecks detected',
                    lockContention: Number(activity.rows?.[0]?.['lock_waiting'] ?? 0) > 0
                        ? `${String(Number(activity.rows?.[0]?.['lock_waiting'] ?? 0))} queries waiting on locks`
                        : 'No lock contention'
                }
            };
        }
    };
}

/**
 * Alert threshold configuration
 */
function createAlertThresholdSetTool(_adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_alert_threshold_set',
        description: 'Get recommended alert thresholds for monitoring key database metrics.',
        group: 'monitoring',
        inputSchema: z.object({
            metric: z.enum([
                'connection_usage',
                'cache_hit_ratio',
                'replication_lag',
                'dead_tuples',
                'long_running_queries',
                'lock_wait_time'
            ]).optional().describe('Specific metric to get thresholds for, or all if not specified')
        }),
        // eslint-disable-next-line @typescript-eslint/require-await
        handler: async (params: unknown, _context: RequestContext) => {
            const parsed = (params as { metric?: string });

            const thresholds: Record<string, { warning: string; critical: string; description: string }> = {
                connection_usage: {
                    warning: '70%',
                    critical: '90%',
                    description: 'Percentage of max_connections in use'
                },
                cache_hit_ratio: {
                    warning: '< 95%',
                    critical: '< 80%',
                    description: 'Buffer cache hit ratio - lower is worse'
                },
                replication_lag: {
                    warning: '> 1 minute',
                    critical: '> 5 minutes',
                    description: 'Replication lag from primary to replica'
                },
                dead_tuples: {
                    warning: '> 10% of live tuples',
                    critical: '> 25% of live tuples',
                    description: 'Dead tuples indicating need for VACUUM'
                },
                long_running_queries: {
                    warning: '> 5 minutes',
                    critical: '> 30 minutes',
                    description: 'Queries running longer than threshold'
                },
                lock_wait_time: {
                    warning: '> 30 seconds',
                    critical: '> 5 minutes',
                    description: 'Time spent waiting for locks'
                }
            };

            if (parsed.metric && thresholds[parsed.metric]) {
                return {
                    metric: parsed.metric,
                    threshold: thresholds[parsed.metric]
                };
            }

            return {
                thresholds,
                note: 'These are recommended starting thresholds. Adjust based on your specific workload and requirements.'
            };
        }
    };
}

