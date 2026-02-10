/**
 * pg_stat_kcache Setup Prompt
 *
 * Complete guide for setting up OS-level performance monitoring with pg_stat_kcache.
 */

import type { PromptDefinition, RequestContext } from "../../../types/index.js";

export function createSetupKcachePrompt(): PromptDefinition {
  return {
    name: "pg_setup_kcache",
    description:
      "Complete guide for setting up OS-level CPU and I/O performance monitoring with pg_stat_kcache.",
    arguments: [
      {
        name: "focus",
        description: "Analysis focus: cpu, io, memory, all",
        required: false,
      },
    ],
    handler: (
      args: Record<string, string>,
      _context: RequestContext,
    ): Promise<string> => {
      const focus = args["focus"] ?? "all";

      return Promise.resolve(`# pg_stat_kcache Setup Guide - ${focus.toUpperCase()} Analysis

## pg_stat_kcache Overview

pg_stat_kcache extends pg_stat_statements with OS-level metrics:
- **CPU time** (user + system)
- **I/O statistics** (reads/writes)
- **Memory faults** (minor/major page faults)

This enables identifying whether queries are:
- **CPU-bound** — High CPU time, low I/O
- **I/O-bound** — High I/O, lower CPU time
- **Memory-bound** — High page faults

## Prerequisites

pg_stat_kcache requires **pg_stat_statements** to be installed first.

## Setup Steps

### 1. Configure postgresql.conf

\`\`\`
# Both extensions required in shared_preload_libraries
shared_preload_libraries = 'pg_stat_statements,pg_stat_kcache'

# pg_stat_statements settings
pg_stat_statements.track = all
pg_stat_statements.max = 10000
\`\`\`

**Restart PostgreSQL after configuration!**

### 2. Install Extensions

\`\`\`sql
-- Must install pg_stat_statements first
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
CREATE EXTENSION IF NOT EXISTS pg_stat_kcache;

-- Verify installation
SELECT * FROM pg_extension WHERE extname IN ('pg_stat_statements', 'pg_stat_kcache');
\`\`\`

### 3. Understanding the Metrics

| Metric | Description | Unit |
|--------|-------------|------|
| \`user_time\` | CPU time in user mode | seconds |
| \`system_time\` | CPU time in kernel mode | seconds |
| \`reads\` | Bytes read from disk | bytes |
| \`writes\` | Bytes written to disk | bytes |
| \`minflts\` | Minor page faults (soft) | count |
| \`majflts\` | Major page faults (hard) | count |

${
  focus === "cpu" || focus === "all"
    ? `
### 4. CPU Analysis

**Find CPU-intensive queries:**
\`\`\`sql
SELECT 
    substring(query, 1, 80) as query_preview,
    calls,
    round((user_time + system_time)::numeric, 3) as total_cpu_sec,
    round(((user_time + system_time) / calls)::numeric, 6) as cpu_per_call
FROM pg_stat_kcache k
JOIN pg_stat_statements s USING (queryid, dbid, userid)
ORDER BY (user_time + system_time) DESC
LIMIT 10;
\`\`\`

Or use: \`pg_kcache_top_cpu\`

**CPU-bound indicators:**
- High user_time + system_time
- Low reads/writes relative to CPU
- Common causes: complex calculations, string operations, JSON processing
`
    : ""
}

${
  focus === "io" || focus === "all"
    ? `
### 5. I/O Analysis

**Find I/O-intensive queries:**
\`\`\`sql
SELECT 
    substring(query, 1, 80) as query_preview,
    calls,
    pg_size_pretty(reads::bigint) as total_reads,
    pg_size_pretty(writes::bigint) as total_writes,
    pg_size_pretty((reads / NULLIF(calls, 0))::bigint) as reads_per_call
FROM pg_stat_kcache k
JOIN pg_stat_statements s USING (queryid, dbid, userid)
ORDER BY reads DESC
LIMIT 10;
\`\`\`

Or use: \`pg_kcache_top_io\`

**I/O-bound indicators:**
- High reads/writes
- Lower CPU time relative to I/O
- Common causes: sequential scans, missing indexes, large result sets
`
    : ""
}

${
  focus === "memory" || focus === "all"
    ? `
### 6. Memory Analysis

**Find queries with memory pressure:**
\`\`\`sql
SELECT 
    substring(query, 1, 80) as query_preview,
    calls,
    minflts as minor_page_faults,
    majflts as major_page_faults,
    minflts / NULLIF(calls, 0) as minflts_per_call
FROM pg_stat_kcache k
JOIN pg_stat_statements s USING (queryid, dbid, userid)
ORDER BY majflts DESC
LIMIT 10;
\`\`\`

**Memory-bound indicators:**
- High major page faults (disk access for memory)
- High minor faults relative to data size
- Common causes: insufficient shared_buffers, work_mem too low
`
    : ""
}

### 7. Resource Classification

Use \`pg_kcache_resource_analysis\` to automatically classify queries:

\`\`\`sql
-- Classify as CPU-bound vs I/O-bound
WITH metrics AS (
    SELECT 
        queryid,
        (user_time + system_time) as cpu_time,
        reads + writes as io_bytes
    FROM pg_stat_kcache
)
SELECT 
    CASE 
        WHEN cpu_time > io_bytes / 1000000 THEN 'CPU-bound'
        ELSE 'I/O-bound'
    END as classification,
    COUNT(*) as query_count
FROM metrics
GROUP BY 1;
\`\`\`

## Available Tools

| Tool | Purpose |
|------|---------|
| \`pg_kcache_create_extension\` | Enable pg_stat_kcache |
| \`pg_kcache_query_stats\` | Query stats with CPU/IO |
| \`pg_kcache_top_cpu\` | Top CPU consumers |
| \`pg_kcache_top_io\` | Top I/O consumers |
| \`pg_kcache_database_stats\` | Database-level aggregates |
| \`pg_kcache_resource_analysis\` | CPU vs I/O classification |
| \`pg_kcache_reset\` | Reset statistics |

## Optimization Strategies

### CPU-Bound Queries
1. Simplify complex expressions
2. Move computation to application layer
3. Consider materialized views for expensive calculations
4. Check for inefficient functions

### I/O-Bound Queries
1. Add missing indexes
2. Reduce result set size with better filtering
3. Use covering indexes to avoid heap fetches
4. Consider partitioning for large tables

### Memory-Bound Queries
1. Increase \`shared_buffers\`
2. Increase \`work_mem\` for sorts/hashes
3. Use \`LIMIT\` to reduce memory pressure
4. Consider query restructuring

## Best Practices

1. **Reset stats periodically** — Analyze recent workload
2. **Correlate with pg_stat_statements** — Full picture
3. **Monitor during peak hours** — Realistic workload
4. **Track over time** — Identify regressions
5. **Use with EXPLAIN ANALYZE** — Validate findings

## Common Pitfalls

- ❌ Forgetting pg_stat_statements prerequisite
- ❌ Not restarting after shared_preload_libraries change
- ❌ Analyzing stale statistics
- ❌ Ignoring the difference between user and system CPU

**Pro Tip:** Combine pg_stat_kcache with EXPLAIN (ANALYZE, BUFFERS) for complete query diagnostics!`);
    },
  };
}
