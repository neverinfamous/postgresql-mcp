/**
 * PostgreSQL Admin Tools
 * 
 * Database maintenance: VACUUM, ANALYZE, REINDEX, configuration.
 * 10 tools total.
 */

import type { PostgresAdapter } from '../PostgresAdapter.js';
import type { ToolDefinition, RequestContext } from '../../../types/index.js';
import { z } from 'zod';
import { admin, destructive } from '../../../utils/annotations.js';
import { VacuumSchema, AnalyzeSchema, ReindexSchema, TerminateBackendSchema, CancelBackendSchema } from '../types.js';

/**
 * Get all admin tools
 */
export function getAdminTools(adapter: PostgresAdapter): ToolDefinition[] {
    return [
        createVacuumTool(adapter),
        createVacuumAnalyzeTool(adapter),
        createAnalyzeTool(adapter),
        createReindexTool(adapter),
        createTerminateBackendTool(adapter),
        createCancelBackendTool(adapter),
        createReloadConfTool(adapter),
        createSetConfigTool(adapter),
        createResetStatsTool(adapter),
        createClusterTool(adapter)
    ];
}

function createVacuumTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_vacuum',
        description: 'Run VACUUM to reclaim storage and update visibility map.',
        group: 'admin',
        inputSchema: VacuumSchema,
        annotations: admin('Vacuum'),
        handler: async (params: unknown, _context: RequestContext) => {
            const { table, schema, full, verbose } = VacuumSchema.parse(params);
            const fullClause = full ? 'FULL ' : '';
            const verboseClause = verbose ? 'VERBOSE ' : '';
            const target = table ? (schema ? `"${schema}"."${table}"` : `"${table}"`) : '';

            const sql = `VACUUM ${fullClause}${verboseClause}${target}`;
            await adapter.executeQuery(sql);
            return { success: true, message: `VACUUM ${full === true ? 'FULL ' : ''}completed` };
        }
    };
}

function createVacuumAnalyzeTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_vacuum_analyze',
        description: 'Run VACUUM and ANALYZE together for optimal performance.',
        group: 'admin',
        inputSchema: VacuumSchema,
        annotations: admin('Vacuum Analyze'),
        handler: async (params: unknown, _context: RequestContext) => {
            const { table, schema, verbose } = VacuumSchema.parse(params);
            const verboseClause = verbose ? 'VERBOSE ' : '';
            const target = table ? (schema ? `"${schema}"."${table}"` : `"${table}"`) : '';

            const sql = `VACUUM ${verboseClause}ANALYZE ${target}`;
            await adapter.executeQuery(sql);
            return { success: true, message: 'VACUUM ANALYZE completed' };
        }
    };
}

function createAnalyzeTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_analyze',
        description: 'Update table statistics for the query planner.',
        group: 'admin',
        inputSchema: AnalyzeSchema,
        annotations: admin('Analyze'),
        handler: async (params: unknown, _context: RequestContext) => {
            const { table, schema, columns } = AnalyzeSchema.parse(params);
            const target = table ? (schema ? `"${schema}"."${table}"` : `"${table}"`) : '';
            const columnClause = columns !== undefined && columns.length > 0 ? `(${columns.map(c => `"${c}"`).join(', ')})` : '';

            const sql = `ANALYZE ${target}${columnClause}`;
            await adapter.executeQuery(sql);
            return { success: true, message: 'ANALYZE completed' };
        }
    };
}

function createReindexTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_reindex',
        description: 'Rebuild indexes to improve performance.',
        group: 'admin',
        inputSchema: ReindexSchema,
        annotations: admin('Reindex'),
        handler: async (params: unknown, _context: RequestContext) => {
            const { target, name, concurrently } = ReindexSchema.parse(params);
            const concurrentlyClause = concurrently ? 'CONCURRENTLY ' : '';

            const sql = `REINDEX ${target.toUpperCase()} ${concurrentlyClause}"${name}"`;
            await adapter.executeQuery(sql);
            return { success: true, message: `Reindexed ${target}: ${name}` };
        }
    };
}

function createTerminateBackendTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_terminate_backend',
        description: 'Terminate a database connection (forceful, use with caution).',
        group: 'admin',
        inputSchema: TerminateBackendSchema,
        annotations: destructive('Terminate Backend'),
        handler: async (params: unknown, _context: RequestContext) => {
            const { pid } = TerminateBackendSchema.parse(params);
            const sql = `SELECT pg_terminate_backend($1)`;
            const result = await adapter.executeQuery(sql, [pid]);
            const terminated = result.rows?.[0]?.['pg_terminate_backend'] === true;
            return { success: terminated, pid, message: terminated ? 'Backend terminated' : 'Failed to terminate' };
        }
    };
}

function createCancelBackendTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_cancel_backend',
        description: 'Cancel a running query (graceful, preferred over terminate).',
        group: 'admin',
        inputSchema: CancelBackendSchema,
        annotations: admin('Cancel Backend'),
        handler: async (params: unknown, _context: RequestContext) => {
            const { pid } = CancelBackendSchema.parse(params);
            const sql = `SELECT pg_cancel_backend($1)`;
            const result = await adapter.executeQuery(sql, [pid]);
            const cancelled = result.rows?.[0]?.['pg_cancel_backend'] === true;
            return { success: cancelled, pid, message: cancelled ? 'Query cancelled' : 'Failed to cancel' };
        }
    };
}

function createReloadConfTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_reload_conf',
        description: 'Reload PostgreSQL configuration without restart.',
        group: 'admin',
        inputSchema: z.object({}),
        annotations: admin('Reload Configuration'),
        handler: async (_params: unknown, _context: RequestContext) => {
            const sql = `SELECT pg_reload_conf()`;
            const result = await adapter.executeQuery(sql);
            return { success: result.rows?.[0]?.['pg_reload_conf'], message: 'Configuration reloaded' };
        }
    };
}

function createSetConfigTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_set_config',
        description: 'Set a configuration parameter for the current session.',
        group: 'admin',
        inputSchema: z.object({
            name: z.string().describe('Configuration parameter name'),
            value: z.string().describe('New value'),
            isLocal: z.boolean().optional().describe('Apply only to current transaction')
        }),
        annotations: admin('Set Configuration'),
        handler: async (params: unknown, _context: RequestContext) => {
            const parsed = (params as { name: string; value: string; isLocal?: boolean });
            const local = parsed.isLocal ?? false;
            const sql = `SELECT set_config($1, $2, $3)`;
            const result = await adapter.executeQuery(sql, [parsed.name, parsed.value, local]);
            return { success: true, parameter: parsed.name, value: result.rows?.[0]?.['set_config'] };
        }
    };
}

function createResetStatsTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_reset_stats',
        description: 'Reset statistics counters (requires superuser).',
        group: 'admin',
        inputSchema: z.object({
            type: z.enum(['database', 'all']).optional()
        }),
        annotations: admin('Reset Statistics'),
        handler: async (params: unknown, _context: RequestContext) => {
            const parsed = (params as { type?: string });
            let sql: string;
            if (parsed.type === 'all') {
                sql = `SELECT pg_stat_reset()`;
            } else {
                sql = `SELECT pg_stat_reset()`;
            }
            await adapter.executeQuery(sql);
            return { success: true, message: 'Statistics reset' };
        }
    };
}

function createClusterTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_cluster',
        description: 'Physically reorder table data based on an index.',
        group: 'admin',
        inputSchema: z.object({
            table: z.string().describe('Table name'),
            index: z.string().describe('Index to cluster on'),
            schema: z.string().optional()
        }),
        annotations: admin('Cluster Table'),
        handler: async (params: unknown, _context: RequestContext) => {
            const parsed = (params as { table: string; index: string; schema?: string });
            const tableName = parsed.schema ? `"${parsed.schema}"."${parsed.table}"` : `"${parsed.table}"`;
            const sql = `CLUSTER ${tableName} USING "${parsed.index}"`;
            await adapter.executeQuery(sql);
            return { success: true, table: parsed.table, index: parsed.index };
        }
    };
}
