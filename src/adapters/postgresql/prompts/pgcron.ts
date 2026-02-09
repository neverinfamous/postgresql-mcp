/**
 * pg_cron Setup Prompt
 *
 * Complete guide for setting up job scheduling with pg_cron.
 */

import type { PromptDefinition, RequestContext } from "../../../types/index.js";

export function createSetupPgcronPrompt(): PromptDefinition {
  return {
    name: "pg_setup_pgcron",
    description:
      "Complete guide for setting up job scheduling with pg_cron including cron syntax, common patterns, and monitoring.",
    arguments: [
      {
        name: "useCase",
        description: "Use case: maintenance, cleanup, reporting, etl, backup",
        required: false,
      },
    ],
    handler: (
      args: Record<string, string>,
      _context: RequestContext,
    ): Promise<string> => {
      const useCase = args["useCase"] ?? "maintenance";

      let content = `# pg_cron Setup Guide - ${useCase.charAt(0).toUpperCase() + useCase.slice(1)}

## pg_cron Overview

pg_cron enables scheduling SQL commands using familiar cron syntax directly in PostgreSQL:
- No external scheduler needed
- Jobs run as database superuser
- Supports cross-database scheduling
- Persistent job history

## Setup Steps

### 1. Install pg_cron

\`\`\`sql
-- Requires shared_preload_libraries configuration
CREATE EXTENSION IF NOT EXISTS pg_cron;
SELECT * FROM pg_extension WHERE extname = 'pg_cron';
\`\`\`

**postgresql.conf:**
\`\`\`
shared_preload_libraries = 'pg_cron'
cron.database_name = 'postgres'  -- Database where cron runs
\`\`\`

**Restart PostgreSQL after configuration!**

### 2. Cron Expression Syntax

\`\`\`
┌───────────── minute (0 - 59)
│ ┌───────────── hour (0 - 23)
│ │ ┌───────────── day of month (1 - 31)
│ │ │ ┌───────────── month (1 - 12)
│ │ │ │ ┌───────────── day of week (0 - 6) (Sunday = 0)
│ │ │ │ │
* * * * *
\`\`\`

**Common patterns:**
- \`0 * * * *\` — Every hour at minute 0
- \`0 0 * * *\` — Daily at midnight
- \`0 0 * * 0\` — Weekly on Sunday at midnight
- \`0 0 1 * *\` — Monthly on the 1st at midnight
- \`*/5 * * * *\` — Every 5 minutes
- \`0 2 * * 1-5\` — Weekdays at 2 AM

`;

      if (useCase === "maintenance") {
        content += `### 3. Maintenance Jobs

\`\`\`sql
-- Daily VACUUM ANALYZE at 3 AM
SELECT cron.schedule('vacuum-analyze', '0 3 * * *',
    'VACUUM ANALYZE');

-- Weekly REINDEX on weekends
SELECT cron.schedule('weekend-reindex', '0 4 * * 0',
    'REINDEX DATABASE CONCURRENTLY current_database()');

-- Hourly statistics refresh
SELECT cron.schedule('refresh-stats', '0 * * * *',
    'ANALYZE');
\`\`\`
`;
      } else if (useCase === "cleanup") {
        content += `### 3. Cleanup Jobs

\`\`\`sql
-- Delete old logs daily at 2 AM
SELECT cron.schedule('cleanup-logs', '0 2 * * *',
    $$DELETE FROM logs WHERE created_at < NOW() - INTERVAL '30 days'$$);

-- Purge expired sessions hourly
SELECT cron.schedule('purge-sessions', '0 * * * *',
    $$DELETE FROM sessions WHERE expires_at < NOW()$$);

-- Clean pg_cron history weekly
SELECT cron.schedule('cleanup-cron-history', '0 5 * * 0',
    $$DELETE FROM cron.job_run_details 
      WHERE end_time < NOW() - INTERVAL '7 days'$$);
\`\`\`
`;
      } else if (useCase === "reporting") {
        content += `### 3. Reporting Jobs

\`\`\`sql
-- Daily summary at 6 AM
SELECT cron.schedule('daily-summary', '0 6 * * *',
    $$INSERT INTO daily_reports (report_date, total_orders, revenue)
      SELECT CURRENT_DATE - 1, COUNT(*), SUM(amount)
      FROM orders WHERE created_at::date = CURRENT_DATE - 1$$);

-- Weekly aggregation on Monday
SELECT cron.schedule('weekly-rollup', '0 1 * * 1',
    $$REFRESH MATERIALIZED VIEW CONCURRENTLY weekly_metrics$$);

-- Monthly report on 1st at midnight
SELECT cron.schedule('monthly-report', '0 0 1 * *',
    $$CALL generate_monthly_report()$$);
\`\`\`
`;
      } else if (useCase === "etl") {
        content += `### 3. ETL Jobs

\`\`\`sql
-- Incremental data load every 15 minutes
SELECT cron.schedule('incremental-load', '*/15 * * * *',
    $$CALL load_incremental_data()$$);

-- Full data sync daily at 1 AM
SELECT cron.schedule('full-sync', '0 1 * * *',
    $$CALL full_data_sync()$$);

-- Refresh staging tables before business hours
SELECT cron.schedule('refresh-staging', '0 5 * * 1-5',
    $$TRUNCATE staging_tables; CALL populate_staging()$$);
\`\`\`
`;
      } else {
        content += `### 3. Backup Jobs

\`\`\`sql
-- Note: pg_cron runs SQL, not shell commands
-- For backup, schedule a function that logs backup requests

SELECT cron.schedule('backup-checkpoint', '0 2 * * *',
    $$CHECKPOINT; SELECT pg_switch_wal()$$);

-- Log backup request for external pickup
SELECT cron.schedule('request-backup', '0 3 * * *',
    $$INSERT INTO backup_requests (requested_at, status)
      VALUES (NOW(), 'pending')$$);
\`\`\`
`;
      }

      content += `
### 4. Managing Jobs

**List jobs:** Use \`pg_cron_list_jobs\`

**View history:** Use \`pg_cron_job_run_details\`

**Modify job:** Use \`pg_cron_alter_job\`

**Remove job:** Use \`pg_cron_unschedule\`

### 5. Cross-Database Scheduling

\`\`\`sql
-- Schedule job in another database
SELECT cron.schedule_in_database(
    'other-db-cleanup',
    '0 4 * * *',
    $$DELETE FROM logs WHERE age > INTERVAL '30 days'$$,
    'other_database'
);
\`\`\`

### 6. Monitoring Best Practices

1. **Check job history regularly:**
   \`\`\`sql
   SELECT * FROM cron.job_run_details
   WHERE status = 'failed'
   ORDER BY end_time DESC LIMIT 10;
   \`\`\`

2. **Set up alerts for failed jobs**

3. **Clean up old history to prevent bloat**

4. **Monitor job duration trends**

## Available Tools

| Tool | Purpose |
|------|---------|
| \`pg_cron_create_extension\` | Enable pg_cron extension |
| \`pg_cron_schedule\` | Schedule a new job |
| \`pg_cron_schedule_in_database\` | Schedule job in another database |
| \`pg_cron_unschedule\` | Remove a scheduled job |
| \`pg_cron_alter_job\` | Modify job schedule or command |
| \`pg_cron_list_jobs\` | List all scheduled jobs |
| \`pg_cron_job_run_details\` | View job execution history |
| \`pg_cron_enable_job\` | Enable a disabled job |
| \`pg_cron_disable_job\` | Disable a job without removing |

## Best Practices

1. **Use descriptive job names** — Makes management easier
2. **Schedule during low-traffic periods**
3. **Add CONCURRENTLY for maintenance on production**
4. **Wrap multi-statement jobs in transactions**
5. **Monitor the cron.job_run_details table size**

## Common Pitfalls

- ❌ Running heavy jobs during peak hours
- ❌ Forgetting to clean up job history
- ❌ Not checking job failure status
- ❌ Overlapping job schedules causing conflicts

**Pro Tip:** Combine pg_cron with pg_partman for automatic partition maintenance!`;

      return Promise.resolve(content);
    },
  };
}
