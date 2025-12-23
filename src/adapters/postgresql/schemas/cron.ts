/**
 * postgres-mcp - pg_cron Tool Schemas
 * 
 * Input validation schemas for scheduled job management.
 */

import { z } from 'zod';

/**
 * Helper type for raw cron input with common aliases
 */
interface RawCronInput {
    command?: string;
    sql?: string;        // Alias → command
    query?: string;      // Alias → command
    database?: string;
    db?: string;         // Alias → database
    olderThanDays?: number;
    days?: number;       // Alias → olderThanDays
    [key: string]: unknown;
}

/**
 * Preprocess cron parameters to normalize common input patterns
 */
function preprocessCronParams(input: unknown): unknown {
    if (typeof input !== 'object' || input === null) {
        return input;
    }

    const raw = input as RawCronInput;
    const result = { ...raw };

    // Alias: sql/query → command
    if (!result.command) {
        if (raw.sql !== undefined) {
            result.command = raw.sql;
        } else if (raw.query !== undefined) {
            result.command = raw.query;
        }
    }

    // Alias: db → database
    if (raw.db !== undefined && !result.database) {
        result.database = raw.db;
    }

    // Alias: days → olderThanDays
    if (raw.days !== undefined && result.olderThanDays === undefined) {
        result.olderThanDays = raw.days;
    }

    return result;
}

/**
 * Coercible job ID schema that accepts both numbers and numeric strings.
 * Handles PostgreSQL BIGINT values that may be returned as strings.
 */
const CoercibleJobId = z.union([z.number(), z.string().regex(/^\d+$/, 'Invalid job ID format')])
    .transform(v => Number(v))
    .describe('Job ID (accepts number or numeric string)');

/**
 * Schedule for cron jobs. Supports:
 * - Standard cron: "0 10 * * *" (daily at 10:00)
 * - Interval: "30 seconds" (every 30 seconds)
 * - Special: "0 12 $ * *" (noon on last day of month)
 * 
 * Accepts 'name' as alias for 'jobName'.
 * Accepts 'sql' or 'query' as alias for 'command'.
 * Uses base schema for MCP exposure and transform schema for validation.
 */
export const CronScheduleSchemaBase = z.object({
    schedule: z.string().describe('Cron schedule expression (e.g., "0 10 * * *" or "30 seconds")'),
    command: z.string().describe('SQL command to execute'),
    sql: z.string().optional().describe('Alias for command'),
    query: z.string().optional().describe('Alias for command'),
    jobName: z.string().optional().describe('Optional unique name for the job'),
    name: z.string().optional().describe('Alias for jobName')
});

export const CronScheduleSchema = z.preprocess(
    preprocessCronParams,
    CronScheduleSchemaBase.transform((data) => {
        // Handle alias: name -> jobName
        const resolvedJobName = data.jobName ?? data.name;
        return {
            schedule: data.schedule,
            command: data.command,
            jobName: resolvedJobName
        };
    })
);

/**
 * Schedule for cross-database cron jobs.
 * Accepts 'name' as alias for 'jobName'.
 * Accepts 'sql'/'query' as alias for 'command'.
 * Accepts 'db' as alias for 'database'.
 * Uses base schema for MCP exposure and transform schema for validation.
 */
export const CronScheduleInDatabaseSchemaBase = z.object({
    jobName: z.string().optional().describe('Unique name for the job'),
    name: z.string().optional().describe('Alias for jobName'),
    schedule: z.string().describe('Cron schedule expression'),
    command: z.string().describe('SQL command to execute'),
    sql: z.string().optional().describe('Alias for command'),
    query: z.string().optional().describe('Alias for command'),
    database: z.string().describe('Target database name'),
    db: z.string().optional().describe('Alias for database'),
    username: z.string().optional().describe('User to run the job as'),
    active: z.boolean().optional().describe('Whether the job is active (default: true)')
});

export const CronScheduleInDatabaseSchema = z.preprocess(
    preprocessCronParams,
    CronScheduleInDatabaseSchemaBase.transform((data) => {
        // Handle alias: name -> jobName
        const resolvedJobName = data.jobName ?? data.name;
        return {
            jobName: resolvedJobName,
            schedule: data.schedule,
            command: data.command,
            database: data.database,
            username: data.username,
            active: data.active
        };
    }).refine((data) => data.jobName !== undefined, {
        message: 'jobName (or name alias) is required'
    })
);

export const CronUnscheduleSchema = z.object({
    jobId: CoercibleJobId.optional().describe('Job ID to remove'),
    jobName: z.string().optional().describe('Job name to remove')
}).refine(
    data => data.jobId !== undefined || data.jobName !== undefined,
    { message: 'Either jobId or jobName must be provided' }
);

export const CronAlterJobSchema = z.object({
    jobId: CoercibleJobId.describe('Job ID to modify'),
    schedule: z.string().optional().describe('New cron schedule'),
    command: z.string().optional().describe('New SQL command'),
    database: z.string().optional().describe('New target database'),
    username: z.string().optional().describe('New username'),
    active: z.boolean().optional().describe('Enable/disable the job')
});

export const CronJobRunDetailsSchema = z.object({
    jobId: CoercibleJobId.optional().describe('Filter by job ID'),
    status: z.enum(['running', 'succeeded', 'failed']).optional().describe('Filter by status'),
    limit: z.number().optional().describe('Maximum records to return (default: 100)')
}).default({});

export const CronCleanupHistorySchemaBase = z.object({
    olderThanDays: z.number().optional().describe('Delete records older than N days (default: 7)'),
    days: z.number().optional().describe('Alias for olderThanDays'),
    jobId: CoercibleJobId.optional().describe('Clean up only for specific job')
});

export const CronCleanupHistorySchema = z.preprocess(
    (input) => preprocessCronParams(input ?? {}),
    CronCleanupHistorySchemaBase.transform((data) => ({
        olderThanDays: data.olderThanDays,
        jobId: data.jobId
    }))
);
