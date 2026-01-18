/**
 * pg_partman Setup Prompt
 *
 * Complete guide for setting up automated partition management with pg_partman.
 */

import type { PromptDefinition, RequestContext } from "../../../types/index.js";

export function createSetupPartmanPrompt(): PromptDefinition {
  return {
    name: "pg_setup_partman",
    description:
      "Complete guide for setting up automated partition lifecycle management with pg_partman including time-based and serial partitioning.",
    arguments: [
      {
        name: "partitionType",
        description: "Partition type: time, serial, id",
        required: false,
      },
      {
        name: "interval",
        description: "Partition interval: daily, weekly, monthly, yearly",
        required: false,
      },
    ],
    // eslint-disable-next-line @typescript-eslint/require-await
    handler: async (
      args: Record<string, string>,
      _context: RequestContext,
    ): Promise<string> => {
      const partitionType = args["partitionType"] ?? "time";
      const interval = args["interval"] ?? "daily";

      let content = `# pg_partman Setup Guide - ${partitionType.charAt(0).toUpperCase() + partitionType.slice(1)} Partitioning

## pg_partman Overview

pg_partman automates partition lifecycle management:
- Automatic child partition creation
- Retention policy enforcement
- Background maintenance
- Native partitioning support (PostgreSQL 10+)

## Setup Steps

### 1. Install pg_partman

\`\`\`sql
CREATE EXTENSION IF NOT EXISTS pg_partman;
SELECT * FROM pg_extension WHERE extname = 'pg_partman';
\`\`\`

### 2. Create Parent Table

**Important:** Create the parent as a native partitioned table first.

`;

      if (partitionType === "time") {
        content += `\`\`\`sql
-- Time-based partitioning (${interval})
CREATE TABLE events (
    id BIGSERIAL,
    event_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    event_type VARCHAR(50),
    payload JSONB,
    PRIMARY KEY (id, event_time)
) PARTITION BY RANGE (event_time);

-- Create default partition for safety
CREATE TABLE events_default PARTITION OF events DEFAULT;
\`\`\`

### 3. Configure pg_partman

\`\`\`sql
SELECT partman.create_parent(
    p_parent_table => 'public.events',
    p_control => 'event_time',
    p_type => 'native',
    p_interval => '${interval === "daily" ? "1 day" : interval === "weekly" ? "1 week" : interval === "monthly" ? "1 month" : "1 year"}',
    p_premake => 4,  -- Create 4 future partitions
    p_start_partition => (NOW() - INTERVAL '1 month')::text
);
\`\`\`
`;
      } else if (partitionType === "serial" || partitionType === "id") {
        content += `\`\`\`sql
-- ID/Serial-based partitioning
CREATE TABLE orders (
    id BIGSERIAL,
    order_date TIMESTAMPTZ DEFAULT NOW(),
    customer_id INTEGER,
    total DECIMAL(10,2),
    PRIMARY KEY (id)
) PARTITION BY RANGE (id);

-- Create default partition
CREATE TABLE orders_default PARTITION OF orders DEFAULT;
\`\`\`

### 3. Configure pg_partman

\`\`\`sql
SELECT partman.create_parent(
    p_parent_table => 'public.orders',
    p_control => 'id',
    p_type => 'native',
    p_interval => '1000000',  -- 1 million rows per partition
    p_premake => 4
);
\`\`\`
`;
      }

      content += `
### 4. Set Retention Policy

\`\`\`sql
UPDATE partman.part_config
SET retention = '${interval === "daily" ? "90 days" : interval === "weekly" ? "52 weeks" : interval === "monthly" ? "24 months" : "5 years"}',
    retention_keep_table = false,  -- Drop old partitions
    retention_keep_index = false
WHERE parent_table = 'public.events';
\`\`\`

Or use the tool: \`pg_partman_set_retention\`

### 5. Schedule Maintenance

**Option A: Using pg_cron (recommended)**
\`\`\`sql
-- Run maintenance every hour
SELECT cron.schedule('partman-maintenance', '0 * * * *',
    $$CALL partman.run_maintenance_proc()$$);
\`\`\`

**Option B: External scheduler**
\`\`\`bash
# Add to crontab
0 * * * * psql -d mydb -c "CALL partman.run_maintenance_proc()"
\`\`\`

### 6. View Configuration

Use \`pg_partman_show_config\` or:
\`\`\`sql
SELECT * FROM partman.part_config
WHERE parent_table = 'public.events';
\`\`\`

### 7. Monitor Partitions

Use \`pg_partman_show_partitions\` or:
\`\`\`sql
SELECT * FROM partman.show_partitions('public.events');
\`\`\`

### 8. Check for Data in Default Partition

Use \`pg_partman_check_default\` — data in default means partitions need adjustment.

## Available Tools

| Tool | Purpose |
|------|---------|
| \`pg_partman_create_parent\` | Create managed partition set |
| \`pg_partman_run_maintenance\` | Execute maintenance |
| \`pg_partman_show_partitions\` | List partitions |
| \`pg_partman_show_config\` | View configuration |
| \`pg_partman_check_default\` | Check default partition |
| \`pg_partman_partition_data\` | Move data to partitions |
| \`pg_partman_set_retention\` | Configure retention |
| \`pg_partman_undo_partition\` | Convert back to regular table |
| \`pg_partman_analyze_partition_health\` | Health check |

## Best Practices

1. **Always create a default partition** — Catches data that doesn't match ranges
2. **Pre-create future partitions** — Avoid write failures
3. **Schedule regular maintenance** — At least hourly for active tables
4. **Monitor default partition** — Data there indicates problems
5. **Use appropriate retention** — Balance storage vs query history needs
6. **Add indexes to parent** — They propagate to children

## Common Pitfalls

- ❌ Forgetting to schedule maintenance
- ❌ Not creating default partition
- ❌ Ignoring data in default partition
- ❌ Retention too aggressive (losing needed data)
- ❌ Not considering query patterns when choosing partition key

## Migration: Converting Existing Table

\`\`\`sql
-- 1. Rename existing table
ALTER TABLE events RENAME TO events_old;

-- 2. Create new partitioned table
CREATE TABLE events (...) PARTITION BY RANGE (event_time);

-- 3. Configure pg_partman
SELECT partman.create_parent(...);

-- 4. Migrate data in batches
INSERT INTO events SELECT * FROM events_old
WHERE event_time >= '2024-01-01' AND event_time < '2024-02-01';
-- Repeat for each period

-- 5. Drop old table when complete
DROP TABLE events_old;
\`\`\`

**Pro Tip:** pg_partman + pg_cron = fully automated partition lifecycle!`;

      return content;
    },
  };
}
