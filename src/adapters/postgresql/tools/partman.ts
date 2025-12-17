/**
 * PostgreSQL pg_partman Extension Tools
 * 
 * Automated partition lifecycle management using pg_partman.
 * 10 tools total.
 * 
 * pg_partman provides automated creation, maintenance, and retention
 * of partitioned tables. Supports time-based and integer-based partitioning.
 */

import type { PostgresAdapter } from '../PostgresAdapter.js';
import type { ToolDefinition, RequestContext } from '../../../types/index.js';
import { z } from 'zod';
import { readOnly, write, destructive } from '../../../utils/annotations.js';
import {
    PartmanCreateParentSchema,
    PartmanRunMaintenanceSchema,
    PartmanShowPartitionsSchema,
    PartmanCheckDefaultSchema,
    PartmanPartitionDataSchema,
    PartmanRetentionSchema,
    PartmanUndoPartitionSchema
} from '../types.js';

/**
 * Get all pg_partman tools
 */
export function getPartmanTools(adapter: PostgresAdapter): ToolDefinition[] {
    return [
        createPartmanExtensionTool(adapter),
        createPartmanCreateParentTool(adapter),
        createPartmanRunMaintenanceTool(adapter),
        createPartmanShowPartitionsTool(adapter),
        createPartmanShowConfigTool(adapter),
        createPartmanCheckDefaultTool(adapter),
        createPartmanPartitionDataTool(adapter),
        createPartmanSetRetentionTool(adapter),
        createPartmanUndoPartitionTool(adapter),
        createPartmanAnalyzeHealthTool(adapter)
    ];
}

/**
 * Enable the pg_partman extension
 */
function createPartmanExtensionTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_partman_create_extension',
        description: 'Enable the pg_partman extension for automated partition management. Requires superuser privileges.',
        group: 'partman',
        inputSchema: z.object({}),
        annotations: write('Create Partman Extension'),
        handler: async (_params: unknown, _context: RequestContext) => {
            await adapter.executeQuery('CREATE EXTENSION IF NOT EXISTS pg_partman');
            return { success: true, message: 'pg_partman extension enabled' };
        }
    };
}

/**
 * Create a partition set with pg_partman
 */
function createPartmanCreateParentTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_partman_create_parent',
        description: `Create a new partition set using pg_partman's create_parent() function. 
Supports time-based and integer-based partitioning with automatic child partition creation.
The parent table must already exist before calling this function.`,
        group: 'partman',
        inputSchema: PartmanCreateParentSchema,
        annotations: write('Create Partition Parent'),
        handler: async (params: unknown, _context: RequestContext) => {
            const {
                parentTable,
                controlColumn,
                interval,
                premake,
                startPartition,
                templateTable,
                epochType,
                defaultPartition
            } = PartmanCreateParentSchema.parse(params);

            const args: string[] = [
                `p_parent_table := '${parentTable}'`,
                `p_control := '${controlColumn}'`,
                `p_type := 'native'`,
                `p_interval := '${interval}'`
            ];

            if (premake !== undefined) {
                args.push(`p_premake := ${String(premake)}`);
            }
            if (startPartition !== undefined) {
                args.push(`p_start_partition := '${startPartition}'`);
            }
            if (templateTable !== undefined) {
                args.push(`p_template_table := '${templateTable}'`);
            }
            if (epochType !== undefined) {
                args.push(`p_epoch := '${epochType}'`);
            }
            if (defaultPartition !== undefined) {
                args.push(`p_default_table := ${String(defaultPartition)}`);
            }

            const sql = `SELECT partman.create_parent(${args.join(', ')})`;
            await adapter.executeQuery(sql);

            return {
                success: true,
                parentTable,
                controlColumn,
                interval,
                premake: premake ?? 4,
                message: `Partition set created for ${parentTable} on column ${controlColumn}`
            };
        }
    };
}

/**
 * Run partition maintenance
 */
function createPartmanRunMaintenanceTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_partman_run_maintenance',
        description: `Run partition maintenance to create new child partitions and enforce retention policies.
Should be executed regularly (e.g., via pg_cron) to keep partitions current.
Maintains all partition sets if no specific parent table is specified.`,
        group: 'partman',
        inputSchema: PartmanRunMaintenanceSchema,
        annotations: write('Run Partition Maintenance'),
        handler: async (params: unknown, _context: RequestContext) => {
            const { parentTable, analyze } = PartmanRunMaintenanceSchema.parse(params);

            const args: string[] = [];
            if (parentTable !== undefined) {
                args.push(`p_parent_table := '${parentTable}'`);
            }
            if (analyze !== undefined) {
                args.push(`p_analyze := ${String(analyze)}`);
            }

            const sql = args.length > 0
                ? `SELECT partman.run_maintenance(${args.join(', ')})`
                : 'SELECT partman.run_maintenance()';

            await adapter.executeQuery(sql);

            return {
                success: true,
                parentTable: parentTable ?? 'all',
                analyze: analyze ?? true,
                message: parentTable !== undefined
                    ? `Maintenance completed for ${parentTable}`
                    : 'Maintenance completed for all partition sets'
            };
        }
    };
}

/**
 * Show partitions managed by pg_partman
 */
function createPartmanShowPartitionsTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_partman_show_partitions',
        description: 'List all child partitions for a partition set managed by pg_partman.',
        group: 'partman',
        inputSchema: PartmanShowPartitionsSchema,
        annotations: readOnly('Show Partman Partitions'),
        handler: async (params: unknown, _context: RequestContext) => {
            const { parentTable, includeDefault, order } = PartmanShowPartitionsSchema.parse(params);

            const orderDir = order === 'desc' ? 'DESC' : 'ASC';
            const includeDefaultVal = includeDefault ?? false;

            const sql = `
                SELECT * FROM partman.show_partitions(
                    p_parent_table := '${parentTable}',
                    p_include_default := ${String(includeDefaultVal)},
                    p_order := '${orderDir}'
                )
            `;

            const result = await adapter.executeQuery(sql);

            return {
                parentTable,
                partitions: result.rows ?? [],
                count: result.rows?.length ?? 0
            };
        }
    };
}

/**
 * Show partition configuration
 */
function createPartmanShowConfigTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_partman_show_config',
        description: 'View the configuration for a partition set from partman.part_config table.',
        group: 'partman',
        inputSchema: z.object({
            parentTable: z.string().optional().describe('Parent table name (all configs if omitted)')
        }),
        annotations: readOnly('Show Partman Config'),
        handler: async (params: unknown, _context: RequestContext) => {
            const parsed = params as { parentTable?: string };

            let sql = `
                SELECT 
                    parent_table,
                    control,
                    partition_interval,
                    partition_type,
                    premake,
                    automatic_maintenance,
                    template_table,
                    retention,
                    retention_keep_table,
                    epoch,
                    inherit_fk,
                    default_table
                FROM partman.part_config
            `;

            const queryParams: unknown[] = [];
            if (parsed.parentTable !== undefined) {
                sql += ' WHERE parent_table = $1';
                queryParams.push(parsed.parentTable);
            }

            sql += ' ORDER BY parent_table';

            const result = await adapter.executeQuery(sql, queryParams);

            return {
                configs: result.rows ?? [],
                count: result.rows?.length ?? 0
            };
        }
    };
}

/**
 * Check for data in default partition
 */
function createPartmanCheckDefaultTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_partman_check_default',
        description: `Check if any data exists in the default partition that should be moved to child partitions.
Data in default indicates partitions may be missing for certain time/value ranges.`,
        group: 'partman',
        inputSchema: PartmanCheckDefaultSchema,
        annotations: readOnly('Check Partman Default'),
        handler: async (params: unknown, _context: RequestContext) => {
            const { parentTable } = PartmanCheckDefaultSchema.parse(params);

            const sql = `
                SELECT 
                    c.relname as default_partition,
                    n.nspname as schema,
                    c.reltuples::bigint as estimated_rows
                FROM pg_inherits i
                JOIN pg_class c ON c.oid = i.inhrelid
                JOIN pg_namespace n ON n.oid = c.relnamespace
                JOIN pg_class p ON p.oid = i.inhparent
                JOIN pg_namespace pn ON pn.oid = p.relnamespace
                WHERE (pn.nspname || '.' || p.relname) = $1
                  AND c.relname LIKE '%_default'
            `;

            const result = await adapter.executeQuery(sql, [parentTable]);
            const defaultInfo = result.rows?.[0];

            if (!defaultInfo) {
                return {
                    parentTable,
                    hasDefault: false,
                    message: 'No default partition found'
                };
            }

            const hasData = (defaultInfo['estimated_rows'] as number) > 0;

            return {
                parentTable,
                hasDefault: true,
                defaultPartition: `${String(defaultInfo['schema'])}.${String(defaultInfo['default_partition'])}`,
                estimatedRows: defaultInfo['estimated_rows'],
                hasDataInDefault: hasData,
                recommendation: hasData
                    ? 'Run pg_partman_partition_data to move data to appropriate child partitions'
                    : 'Default partition is empty - no action needed'
            };
        }
    };
}

/**
 * Move data from default to child partitions
 */
function createPartmanPartitionDataTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_partman_partition_data',
        description: `Move data from the default partition to appropriate child partitions.
Creates new partitions if needed for the data being moved.`,
        group: 'partman',
        inputSchema: PartmanPartitionDataSchema,
        annotations: write('Partition Data'),
        handler: async (params: unknown, _context: RequestContext) => {
            const { parentTable, batchSize, lockWaitSeconds } = PartmanPartitionDataSchema.parse(params);

            const args: string[] = [
                `p_parent_table := '${parentTable}'`
            ];

            if (batchSize !== undefined) {
                args.push(`p_batch_count := ${String(batchSize)}`);
            }
            if (lockWaitSeconds !== undefined) {
                args.push(`p_lock_wait := ${String(lockWaitSeconds)}`);
            }

            const configResult = await adapter.executeQuery(`
                SELECT control, epoch 
                FROM partman.part_config 
                WHERE parent_table = $1
            `, [parentTable]);

            const config = configResult.rows?.[0];
            if (!config) {
                return {
                    success: false,
                    error: `No pg_partman configuration found for ${parentTable}`
                };
            }

            const sql = `SELECT partman.partition_data_proc(${args.join(', ')})`;
            const result = await adapter.executeQuery(sql);
            const rowsMoved = result.rows?.[0]?.['partition_data_proc'] as number ?? 0;

            return {
                success: true,
                parentTable,
                rowsMoved,
                message: rowsMoved > 0
                    ? `Moved ${String(rowsMoved)} rows from default to child partitions`
                    : 'No rows needed to be moved'
            };
        }
    };
}

/**
 * Configure retention policies
 */
function createPartmanSetRetentionTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_partman_set_retention',
        description: `Configure retention policy for a partition set. 
Partitions older than the retention period will be dropped or detached during maintenance.`,
        group: 'partman',
        inputSchema: PartmanRetentionSchema,
        annotations: write('Set Partition Retention'),
        handler: async (params: unknown, _context: RequestContext) => {
            const { parentTable, retention, retentionKeepTable } = PartmanRetentionSchema.parse(params);

            const updates: string[] = [`retention = '${retention}'`];
            if (retentionKeepTable !== undefined) {
                updates.push(`retention_keep_table = ${String(retentionKeepTable)}`);
            }

            const sql = `
                UPDATE partman.part_config
                SET ${updates.join(', ')}
                WHERE parent_table = $1
            `;

            const result = await adapter.executeQuery(sql, [parentTable]);

            if ((result.rowsAffected ?? 0) === 0) {
                return {
                    success: false,
                    error: `No pg_partman configuration found for ${parentTable}`
                };
            }

            return {
                success: true,
                parentTable,
                retention,
                retentionKeepTable: retentionKeepTable ?? false,
                message: `Retention policy set: partitions older than ${retention} will be ${retentionKeepTable === true ? 'detached' : 'dropped'}`
            };
        }
    };
}

/**
 * Undo partitioning - convert back to regular table
 */
function createPartmanUndoPartitionTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_partman_undo_partition',
        description: `Convert a partitioned table back to a regular table by moving all data 
from child partitions to the parent (or a target table) and removing partition configuration.`,
        group: 'partman',
        inputSchema: PartmanUndoPartitionSchema,
        annotations: destructive('Undo Partitioning'),
        handler: async (params: unknown, _context: RequestContext) => {
            const { parentTable, targetTable, batchSize, keepTable } =
                PartmanUndoPartitionSchema.parse(params);

            const args: string[] = [
                `p_parent_table := '${parentTable}'`
            ];

            if (targetTable !== undefined) {
                args.push(`p_target_table := '${targetTable}'`);
            }
            if (batchSize !== undefined) {
                args.push(`p_batch_count := ${String(batchSize)}`);
            }
            if (keepTable !== undefined) {
                args.push(`p_keep_table := ${String(keepTable)}`);
            }

            const sql = `SELECT partman.undo_partition_proc(${args.join(', ')})`;
            const result = await adapter.executeQuery(sql);
            const rowsMoved = result.rows?.[0]?.['undo_partition_proc'] as number ?? 0;

            return {
                success: true,
                parentTable,
                targetTable: targetTable ?? parentTable,
                rowsMoved,
                message: `Partition set removed. ${String(rowsMoved)} rows consolidated.`
            };
        }
    };
}

/**
 * Analyze partition health and provide recommendations
 */
function createPartmanAnalyzeHealthTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_partman_analyze_partition_health',
        description: `Analyze the health of partition sets managed by pg_partman.
Checks for issues like data in default partitions, missing premake partitions, 
stale maintenance, and retention configuration.`,
        group: 'partman',
        inputSchema: z.object({
            parentTable: z.string().optional().describe('Specific parent table to analyze (all if omitted)')
        }),
        annotations: readOnly('Analyze Partition Health'),
        handler: async (params: unknown, _context: RequestContext) => {
            const parsed = params as { parentTable?: string };

            let configSql = `
                SELECT 
                    parent_table,
                    control,
                    partition_interval,
                    premake,
                    retention,
                    retention_keep_table,
                    automatic_maintenance,
                    template_table
                FROM partman.part_config
            `;

            const queryParams: unknown[] = [];
            if (parsed.parentTable !== undefined) {
                configSql += ' WHERE parent_table = $1';
                queryParams.push(parsed.parentTable);
            }

            const configResult = await adapter.executeQuery(configSql, queryParams);
            const configs = configResult.rows ?? [];

            const healthChecks: {
                parentTable: string;
                issues: string[];
                warnings: string[];
                recommendations: string[];
                partitionCount: number;
                hasDataInDefault: boolean;
            }[] = [];

            for (const config of configs) {
                const parentTable = config['parent_table'] as string;
                const issues: string[] = [];
                const warnings: string[] = [];
                const recommendations: string[] = [];

                const partCountResult = await adapter.executeQuery(`
                    SELECT COUNT(*) as count 
                    FROM partman.show_partitions(p_parent_table := $1)
                `, [parentTable]);
                const partitionCount = Number(partCountResult.rows?.[0]?.['count'] ?? 0);

                const premake = config['premake'] as number ?? 4;
                if (partitionCount < premake) {
                    warnings.push(`Only ${String(partitionCount)} partitions exist, premake is set to ${String(premake)}`);
                    recommendations.push('Run pg_partman_run_maintenance to create premake partitions');
                }

                const defaultCheckResult = await adapter.executeQuery(`
                    SELECT c.reltuples::bigint as rows
                    FROM pg_inherits i
                    JOIN pg_class c ON c.oid = i.inhrelid
                    JOIN pg_class p ON p.oid = i.inhparent
                    JOIN pg_namespace pn ON pn.oid = p.relnamespace
                    WHERE (pn.nspname || '.' || p.relname) = $1
                      AND c.relname LIKE '%_default'
                `, [parentTable]);

                const defaultRows = Number(defaultCheckResult.rows?.[0]?.['rows'] ?? 0);
                const hasDataInDefault = defaultRows > 0;

                if (hasDataInDefault) {
                    issues.push(`Approximately ${String(defaultRows)} rows in default partition`);
                    recommendations.push('Run pg_partman_partition_data to move data to child partitions');
                }

                const retention = config['retention'] as string | null;
                if (!retention) {
                    warnings.push('No retention policy configured');
                    recommendations.push('Consider setting retention with pg_partman_set_retention');
                }

                const autoMaint = config['automatic_maintenance'] as string;
                if (autoMaint !== 'on') {
                    warnings.push('Automatic maintenance is not enabled');
                    recommendations.push('Schedule regular maintenance with pg_cron or enable automatic_maintenance');
                }

                healthChecks.push({
                    parentTable,
                    issues,
                    warnings,
                    recommendations,
                    partitionCount,
                    hasDataInDefault
                });
            }

            const totalIssues = healthChecks.reduce((sum, h) => sum + h.issues.length, 0);
            const totalWarnings = healthChecks.reduce((sum, h) => sum + h.warnings.length, 0);

            return {
                partitionSets: healthChecks,
                summary: {
                    totalPartitionSets: healthChecks.length,
                    totalIssues,
                    totalWarnings,
                    overallHealth: totalIssues === 0
                        ? (totalWarnings === 0 ? 'healthy' : 'warnings')
                        : 'issues_found'
                }
            };
        }
    };
}
