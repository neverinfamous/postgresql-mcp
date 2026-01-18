/**
 * PostgreSQL pg_cron Extension Tools
 *
 * Job scheduling and management using pg_cron.
 * 8 tools total.
 *
 * pg_cron enables scheduling of SQL commands using familiar cron syntax.
 * Supports standard cron (minute granularity) and interval scheduling.
 */

import type { PostgresAdapter } from "../PostgresAdapter.js";
import type { ToolDefinition, RequestContext } from "../../../types/index.js";
import { z } from "zod";
import { readOnly, write, destructive } from "../../../utils/annotations.js";
import { getToolIcons } from "../../../utils/icons.js";
import {
  CronScheduleSchema,
  CronScheduleSchemaBase,
  CronScheduleInDatabaseSchema,
  CronScheduleInDatabaseSchemaBase,
  CronAlterJobSchema,
  CronUnscheduleSchema,
  CronJobRunDetailsSchema,
  CronCleanupHistorySchema,
  CronCleanupHistorySchemaBase,
} from "../schemas/index.js";

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
    createCronCleanupHistoryTool(adapter),
  ];
}

/**
 * Enable the pg_cron extension
 */
function createCronExtensionTool(adapter: PostgresAdapter): ToolDefinition {
  return {
    name: "pg_cron_create_extension",
    description:
      "Enable the pg_cron extension for job scheduling. Requires superuser privileges.",
    group: "cron",
    inputSchema: z.object({}),
    annotations: write("Create Cron Extension"),
    icons: getToolIcons("cron", write("Create Cron Extension")),
    handler: async (_params: unknown, _context: RequestContext) => {
      await adapter.executeQuery("CREATE EXTENSION IF NOT EXISTS pg_cron");
      return { success: true, message: "pg_cron extension enabled" };
    },
  };
}

/**
 * Schedule a new cron job
 */
function createCronScheduleTool(adapter: PostgresAdapter): ToolDefinition {
  return {
    name: "pg_cron_schedule",
    description: `Schedule a new cron job. Supports standard cron syntax (e.g., "0 2 * * *" for 2 AM daily) 
or interval syntax (e.g., "30 seconds"). Note: pg_cron allows duplicate job names; use unique names to avoid confusion. Returns the job ID.`,
    group: "cron",
    // Use base schema for MCP so properties are properly exposed
    inputSchema: CronScheduleSchemaBase,
    annotations: write("Schedule Cron Job"),
    icons: getToolIcons("cron", write("Schedule Cron Job")),
    handler: async (params: unknown, _context: RequestContext) => {
      // Use transformed schema with alias resolution for validation
      const { schedule, command, jobName } = CronScheduleSchema.parse(params);

      let sql: string;
      let queryParams: unknown[];

      if (jobName !== undefined) {
        sql = "SELECT cron.schedule($1, $2, $3) as jobid";
        queryParams = [jobName, schedule, command];
      } else {
        sql = "SELECT cron.schedule($1, $2) as jobid";
        queryParams = [schedule, command];
      }

      const result = await adapter.executeQuery(sql, queryParams);
      const jobId = result.rows?.[0]?.["jobid"];

      return {
        success: true,
        jobId,
        jobName: jobName ?? null,
        schedule,
        command,
        message: `Job scheduled with ID ${String(jobId)}`,
        hint: jobName
          ? "Use pg_cron_list_jobs to verify job was created with expected name"
          : undefined,
      };
    },
  };
}

/**
 * Schedule a job in a different database
 */
function createCronScheduleInDatabaseTool(
  adapter: PostgresAdapter,
): ToolDefinition {
  return {
    name: "pg_cron_schedule_in_database",
    description: `Schedule a cron job to run in a different database. Useful for cross-database 
maintenance tasks. Returns the job ID.`,
    group: "cron",
    // Use base schema for MCP so properties are properly exposed
    inputSchema: CronScheduleInDatabaseSchemaBase,
    annotations: write("Schedule Cron in Database"),
    icons: getToolIcons("cron", write("Schedule Cron in Database")),
    handler: async (params: unknown, _context: RequestContext) => {
      // Use transformed schema with alias resolution for validation
      const { jobName, schedule, command, database, username, active } =
        CronScheduleInDatabaseSchema.parse(params);

      const activeVal = active ?? true;
      const sql = `SELECT cron.schedule_in_database($1, $2, $3, $4, $5, $6) as jobid`;
      const queryParams = [
        jobName,
        schedule,
        command,
        database,
        username ?? null,
        activeVal,
      ];

      const result = await adapter.executeQuery(sql, queryParams);
      const jobId = result.rows?.[0]?.["jobid"];

      return {
        success: true,
        jobId,
        jobName,
        schedule,
        command,
        database,
        username: username ?? null,
        active: activeVal,
        message: `Job scheduled in database '${database}' with ID ${String(jobId)}`,
      };
    },
  };
}

/**
 * Remove a scheduled job
 */
function createCronUnscheduleTool(adapter: PostgresAdapter): ToolDefinition {
  return {
    name: "pg_cron_unschedule",
    description:
      "Remove a scheduled cron job by its ID or name. If both are provided, jobName takes precedence. Job ID accepts numbers or numeric strings. Works for both active and inactive jobs.",
    group: "cron",
    inputSchema: CronUnscheduleSchema,
    annotations: destructive("Unschedule Cron Job"),
    icons: getToolIcons("cron", destructive("Unschedule Cron Job")),
    handler: async (params: unknown, _context: RequestContext) => {
      const parsed = CronUnscheduleSchema.parse(params);

      // Prefer jobName over jobId when both provided
      const useJobName = parsed.jobName !== undefined;
      const warning =
        parsed.jobId !== undefined && parsed.jobName !== undefined
          ? "Both jobId and jobName provided; using jobName"
          : undefined;

      // Look up job info before deletion to return complete response
      let jobInfo: { jobid: number; jobname: string | null } | null = null;
      try {
        const lookupSql = useJobName
          ? "SELECT jobid, jobname FROM cron.job WHERE jobname = $1"
          : "SELECT jobid, jobname FROM cron.job WHERE jobid = $1::bigint";
        const lookupResult = await adapter.executeQuery(lookupSql, [
          useJobName ? parsed.jobName : parsed.jobId,
        ]);
        if (lookupResult.rows && lookupResult.rows.length > 0) {
          const row = lookupResult.rows[0] as {
            jobid: unknown;
            jobname: unknown;
          };
          jobInfo = {
            jobid: Number(row.jobid),
            jobname: row.jobname as string | null,
          };
        }
      } catch {
        // Lookup failed, continue with unschedule attempt
      }

      // Use explicit type casting to ensure correct pg_cron function overload:
      // - cron.unschedule(bigint) works for both active and inactive jobs
      // - cron.unschedule(text) only finds active jobs by name
      let sql: string;
      let queryParams: unknown[];
      if (useJobName) {
        sql = "SELECT cron.unschedule($1::text) as removed";
        queryParams = [parsed.jobName];
      } else {
        sql = "SELECT cron.unschedule($1::bigint) as removed";
        queryParams = [parsed.jobId];
      }

      const result = await adapter.executeQuery(sql, queryParams);
      const removed = result.rows?.[0]?.["removed"] as boolean;

      // Return complete job info from lookup
      const resolvedJobId = jobInfo?.jobid ?? parsed.jobId ?? null;
      const resolvedJobName = jobInfo?.jobname ?? parsed.jobName ?? null;

      return {
        success: removed,
        jobId: resolvedJobId,
        jobName: resolvedJobName,
        usedIdentifier: useJobName ? "jobName" : "jobId",
        warning,
        message: removed
          ? `Job ${resolvedJobId !== null ? `ID ${String(resolvedJobId)}` : `"${String(resolvedJobName)}"`} removed successfully`
          : "Job not found",
      };
    },
  };
}

/**
 * Modify an existing job
 */
function createCronAlterJobTool(adapter: PostgresAdapter): ToolDefinition {
  return {
    name: "pg_cron_alter_job",
    description: `Modify an existing cron job. Can change schedule, command, database, username, 
or active status. Only specify the parameters you want to change.`,
    group: "cron",
    inputSchema: CronAlterJobSchema,
    annotations: write("Alter Cron Job"),
    icons: getToolIcons("cron", write("Alter Cron Job")),
    handler: async (params: unknown, _context: RequestContext) => {
      const { jobId, schedule, command, database, username, active } =
        CronAlterJobSchema.parse(params);

      const sql = `SELECT cron.alter_job($1, $2, $3, $4, $5, $6)`;
      const queryParams = [
        jobId,
        schedule ?? null,
        command ?? null,
        database ?? null,
        username ?? null,
        active ?? null,
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
          active: active ?? undefined,
        },
        message: `Job ${String(jobId)} updated successfully`,
      };
    },
  };
}

/**
 * List all scheduled jobs
 */
function createCronListJobsTool(adapter: PostgresAdapter): ToolDefinition {
  const ListJobsSchema = z.object({
    active: z.boolean().optional().describe("Filter by active status"),
  });

  return {
    name: "pg_cron_list_jobs",
    description:
      "List all scheduled cron jobs. Shows job ID, name, schedule, command, and status. Jobs without names (jobname: null) must be referenced by jobId.",
    group: "cron",
    inputSchema: ListJobsSchema,
    annotations: readOnly("List Cron Jobs"),
    icons: getToolIcons("cron", readOnly("List Cron Jobs")),
    handler: async (params: unknown, _context: RequestContext) => {
      const parsed = ListJobsSchema.parse(params ?? {});

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
        sql += " WHERE active = $1";
        queryParams.push(parsed.active);
      }

      sql += " ORDER BY jobid";

      const result = await adapter.executeQuery(sql, queryParams);

      // Normalize jobid to number (PostgreSQL BIGINT may return as string)
      const jobs = (result.rows ?? []).map((row: Record<string, unknown>) => ({
        ...row,
        jobid:
          row["jobid"] !== null && row["jobid"] !== undefined
            ? Number(row["jobid"])
            : null,
      }));

      // Count unnamed jobs for hint
      const unnamedCount = jobs.filter(
        (j) => (j as Record<string, unknown>)["jobname"] === null,
      ).length;

      return {
        jobs,
        count: jobs.length,
        hint:
          unnamedCount > 0
            ? `${String(unnamedCount)} job(s) have no name. Use jobId to reference them with alterJob or unschedule.`
            : undefined,
      };
    },
  };
}

/**
 * View job execution history
 */
function createCronJobRunDetailsTool(adapter: PostgresAdapter): ToolDefinition {
  return {
    name: "pg_cron_job_run_details",
    description: `View execution history for cron jobs. Shows start/end times, status, and return messages. 
Useful for monitoring and debugging scheduled jobs.`,
    group: "cron",
    inputSchema: CronJobRunDetailsSchema,
    annotations: readOnly("Cron Job Run Details"),
    icons: getToolIcons("cron", readOnly("Cron Job Run Details")),
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

      const whereClause =
        conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

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

      // Normalize runid and jobid to numbers (PostgreSQL BIGINT may return as strings)
      const rows = (result.rows ?? []).map((r: Record<string, unknown>) => ({
        ...r,
        runid:
          r["runid"] !== null && r["runid"] !== undefined
            ? Number(r["runid"])
            : null,
        jobid:
          r["jobid"] !== null && r["jobid"] !== undefined
            ? Number(r["jobid"])
            : null,
      }));
      const succeeded = rows.filter(
        (r: Record<string, unknown>) => r["status"] === "succeeded",
      ).length;
      const failed = rows.filter(
        (r: Record<string, unknown>) => r["status"] === "failed",
      ).length;
      const running = rows.filter(
        (r: Record<string, unknown>) => r["status"] === "running",
      ).length;

      return {
        runs: rows,
        count: rows.length,
        summary: {
          succeeded,
          failed,
          running,
        },
      };
    },
  };
}

/**
 * Clean up old job run history
 */
function createCronCleanupHistoryTool(
  adapter: PostgresAdapter,
): ToolDefinition {
  return {
    name: "pg_cron_cleanup_history",
    description: `Delete old job run history records. Helps prevent the cron.job_run_details table 
from growing too large. By default, removes records older than 7 days.`,
    group: "cron",
    // Use base schema for MCP visibility
    inputSchema: CronCleanupHistorySchemaBase,
    annotations: destructive("Cleanup Cron History"),
    icons: getToolIcons("cron", destructive("Cleanup Cron History")),
    handler: async (params: unknown, _context: RequestContext) => {
      // Use transformed schema for validation with alias support
      const { olderThanDays, jobId } = CronCleanupHistorySchema.parse(params);

      const days = olderThanDays ?? 7;
      const conditions: string[] = [
        `end_time < now() - interval '${String(days)} days'`,
      ];
      const queryParams: unknown[] = [];

      if (jobId !== undefined) {
        conditions.push("jobid = $1");
        queryParams.push(jobId);
      }

      const sql = `
                DELETE FROM cron.job_run_details
                WHERE ${conditions.join(" AND ")}
            `;

      const result = await adapter.executeQuery(sql, queryParams);

      return {
        success: true,
        deletedCount: result.rowsAffected ?? 0,
        olderThanDays: days,
        jobId: jobId ?? null,
        message: `Deleted ${String(result.rowsAffected ?? 0)} old job run records`,
      };
    },
  };
}
