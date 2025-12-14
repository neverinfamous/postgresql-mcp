/**
 * PostgreSQL pg_cron Extension Tools
 * 
 * Job scheduling and management using pg_cron.
 * 8 tools total.
 * 
 * pg_cron enables scheduling of SQL commands using familiar cron syntax.
 * Supports standard cron (minute granularity) and interval scheduling.
 */

import type { PostgresAdapter } from '../PostgresAdapter.js';
import type { ToolDefinition, RequestContext } from '../../../types/index.js';
import { z } from 'zod';
import {
    CronScheduleSchema,
    CronScheduleInDatabaseSchema,
    CronAlterJobSchema,
    CronJobRunDetailsSchema,
    CronCleanupHistorySchema
} from '../types.js';

/**
 * Get all pg_cron tools
 */
export function getCronTools(adapter: PostgresAdapter): ToolDefinition[] {
    return [
        createCronExtensionTool(adapter),
        createCronScheduleTool(adapter),
        createCronScheduleInDatabaseTool(adapter),
        createCronUnscheduleTool(adapter),
        createCronAlterJobTool(adapter),
        createCronListJobsTool(adapter),
        createCronJobRunDetailsTool(adapter),
        createCronCleanupHistoryTool(adapter)
    ];
}

/**
 * Enable the pg_cron extension
 */
function createCronExtensionTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_cron_create_extension',
        description: 'Enable the pg_cron extension for job scheduling. Requires superuser privileges.',
        group: 'cron',
        inputSchema: z.object({}),
        handler: async (_params: unknown, _context: RequestContext) => {
            await adapter.executeQuery('CREATE EXTENSION IF NOT EXISTS pg_cron');
            return { success: true, message: 'pg_cron extension enabled' };
        }
    };
}

/**
 * Schedule a new cron job
 */
function createCronScheduleTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_cron_schedule',
        description: `Schedule a new cron job. Supports standard cron syntax (e.g., "0 2 * * *" for 2 AM daily) 
or interval syntax (e.g., "30 seconds"). Returns the job ID.`,
        group: 'cron',
        inputSchema: CronScheduleSchema,
        handler: async (params: unknown, _context: RequestContext) => {
            const { schedule, command, jobName } = CronScheduleSchema.parse(params);

            let sql: string;
            let queryParams: unknown[];

            if (jobName !== undefined) {
                sql = 'SELECT cron.schedule($1, $2, $3) as jobid';
                queryParams = [jobName, schedule, command];
            } else {
                sql = 'SELECT cron.schedule($1, $2) as jobid';
                queryParams = [schedule, command];
            }

            const result = await adapter.executeQuery(sql, queryParams);
            const jobId = result.rows?.[0]?.['jobid'];

            return {
                success: true,
                jobId,
                jobName: jobName ?? null,
                schedule,
                command,
                message: `Job scheduled with ID ${String(jobId)}`
            };
        }
    };
}

/**
 * Schedule a job in a different database
 */
function createCronScheduleInDatabaseTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_cron_schedule_in_database',
        description: `Schedule a cron job to run in a different database. Useful for cross-database 
maintenance tasks. Returns the job ID.`,
        group: 'cron',
        inputSchema: CronScheduleInDatabaseSchema,
        handler: async (params: unknown, _context: RequestContext) => {
            const { jobName, schedule, command, database, username, active } =
                CronScheduleInDatabaseSchema.parse(params);

            const activeVal = active ?? true;
            const sql = `SELECT cron.schedule_in_database($1, $2, $3, $4, $5, $6) as jobid`;
            const queryParams = [jobName, schedule, command, database, username ?? null, activeVal];

            const result = await adapter.executeQuery(sql, queryParams);
            const jobId = result.rows?.[0]?.['jobid'];

            return {
                success: true,
                jobId,
                jobName,
                schedule,
                command,
                database,
                username: username ?? null,
                active: activeVal,
                message: `Job scheduled in database '${database}' with ID ${String(jobId)}`
            };
        }
    };
}

/**
 * Remove a scheduled job
 */
function createCronUnscheduleTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_cron_unschedule',
        description: 'Remove a scheduled cron job by its ID or name. Returns true if the job was removed.',
        group: 'cron',
        inputSchema: z.object({
            jobId: z.number().optional().describe('Job ID to remove'),
            jobName: z.string().optional().describe('Job name to remove')
        }),
        handler: async (params: unknown, _context: RequestContext) => {
            const parsed = params as { jobId?: number; jobName?: string };

            if (parsed.jobId === undefined && parsed.jobName === undefined) {
                return { success: false, error: 'Either jobId or jobName must be provided' };
            }

            let sql: string;
            let queryParams: unknown[];

            if (parsed.jobId !== undefined) {
                sql = 'SELECT cron.unschedule($1) as removed';
                queryParams = [parsed.jobId];
            } else {
                sql = 'SELECT cron.unschedule($1) as removed';
                queryParams = [parsed.jobName];
            }

            const result = await adapter.executeQuery(sql, queryParams);
            const removed = result.rows?.[0]?.['removed'] as boolean;

            return {
                success: removed,
                jobId: parsed.jobId ?? null,
                jobName: parsed.jobName ?? null,
                message: removed ? 'Job removed successfully' : 'Job not found'
            };
        }
    };
}

/**
 * Modify an existing job
 */
function createCronAlterJobTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_cron_alter_job',
        description: `Modify an existing cron job. Can change schedule, command, database, username, 
or active status. Only specify the parameters you want to change.`,
        group: 'cron',
        inputSchema: CronAlterJobSchema,
        handler: async (params: unknown, _context: RequestContext) => {
            const { jobId, schedule, command, database, username, active } =
                CronAlterJobSchema.parse(params);

            // Build the function call with named parameters for non-null values
            const sql = `SELECT cron.alter_job($1, $2, $3, $4, $5, $6)`;
            const queryParams = [
                jobId,
                schedule ?? null,
                command ?? null,
                database ?? null,
                username ?? null,
                active ?? null
            ];

            await adapter.executeQuery(sql, queryParams);

            return {
                success: true,
                jobId,
                changes: {
                    schedule: schedule ?? undefined,
                    command: command ?? undefined,
                    database: database ?? undefined,
                    username: username ?? undefined,
                    active: active ?? undefined
                },
                message: `Job ${String(jobId)} updated successfully`
            };
        }
    };
}

/**
 * List all scheduled jobs
 */
function createCronListJobsTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_cron_list_jobs',
        description: 'List all scheduled cron jobs. Shows job ID, name, schedule, command, and status.',
        group: 'cron',
        inputSchema: z.object({
            active: z.boolean().optional().describe('Filter by active status')
        }),
        handler: async (params: unknown, _context: RequestContext) => {
            const parsed = params as { active?: boolean };

            let sql = `
                SELECT 
                    jobid,
                    jobname,
                    schedule,
                    command,
                    nodename,
                    nodeport,
                    database,
                    username,
                    active
                FROM cron.job
            `;

            const queryParams: unknown[] = [];
            if (parsed.active !== undefined) {
                sql += ' WHERE active = $1';
                queryParams.push(parsed.active);
            }

            sql += ' ORDER BY jobid';

            const result = await adapter.executeQuery(sql, queryParams);

            return {
                jobs: result.rows ?? [],
                count: result.rows?.length ?? 0
            };
        }
    };
}

/**
 * View job execution history
 */
function createCronJobRunDetailsTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_cron_job_run_details',
        description: `View execution history for cron jobs. Shows start/end times, status, and return messages. 
Useful for monitoring and debugging scheduled jobs.`,
        group: 'cron',
        inputSchema: CronJobRunDetailsSchema,
        handler: async (params: unknown, _context: RequestContext) => {
            const { jobId, status, limit } = CronJobRunDetailsSchema.parse(params);

            const conditions: string[] = [];
            const queryParams: unknown[] = [];
            let paramIndex = 1;

            if (jobId !== undefined) {
                conditions.push(`jobid = $${String(paramIndex++)}`);
                queryParams.push(jobId);
            }

            if (status !== undefined) {
                conditions.push(`status = $${String(paramIndex++)}`);
                queryParams.push(status);
            }

            const whereClause = conditions.length > 0
                ? `WHERE ${conditions.join(' AND ')}`
                : '';

            const limitVal = limit ?? 100;

            const sql = `
                SELECT 
                    runid,
                    jobid,
                    job_pid,
                    database,
                    username,
                    command,
                    status,
                    return_message,
                    start_time,
                    end_time
                FROM cron.job_run_details
                ${whereClause}
                ORDER BY start_time DESC
                LIMIT ${String(limitVal)}
            `;

            const result = await adapter.executeQuery(sql, queryParams);

            // Calculate summary stats
            const rows = result.rows ?? [];
            const succeeded = rows.filter((r: Record<string, unknown>) => r['status'] === 'succeeded').length;
            const failed = rows.filter((r: Record<string, unknown>) => r['status'] === 'failed').length;
            const running = rows.filter((r: Record<string, unknown>) => r['status'] === 'running').length;

            return {
                runs: rows,
                count: rows.length,
                summary: {
                    succeeded,
                    failed,
                    running
                }
            };
        }
    };
}

/**
 * Clean up old job run history
 */
function createCronCleanupHistoryTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_cron_cleanup_history',
        description: `Delete old job run history records. Helps prevent the cron.job_run_details table 
from growing too large. By default, removes records older than 7 days.`,
        group: 'cron',
        inputSchema: CronCleanupHistorySchema,
        handler: async (params: unknown, _context: RequestContext) => {
            const { olderThanDays, jobId } = CronCleanupHistorySchema.parse(params);

            const days = olderThanDays ?? 7;
            const conditions: string[] = [`end_time < now() - interval '${String(days)} days'`];
            const queryParams: unknown[] = [];

            if (jobId !== undefined) {
                conditions.push('jobid = $1');
                queryParams.push(jobId);
            }

            const sql = `
                DELETE FROM cron.job_run_details
                WHERE ${conditions.join(' AND ')}
            `;

            const result = await adapter.executeQuery(sql, queryParams);

            return {
                success: true,
                deletedCount: result.rowsAffected ?? 0,
                olderThanDays: days,
                jobId: jobId ?? null,
                message: `Deleted ${String(result.rowsAffected ?? 0)} old job run records`
            };
        }
    };
}
