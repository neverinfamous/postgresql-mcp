/**
 * Database Health Check Prompt
 *
 * Comprehensive health assessment workflow for PostgreSQL databases.
 */

import type { PromptDefinition, RequestContext } from "../../../types/index.js";

export function createDatabaseHealthCheckPrompt(): PromptDefinition {
  return {
    name: "pg_database_health_check",
    description:
      "Comprehensive database health assessment covering indexes, connections, vacuum, replication, and buffer cache.",
    arguments: [
      {
        name: "focus",
        description:
          "Health area to focus on: all, indexes, connections, vacuum, replication, buffer",
        required: false,
      },
    ],
    // eslint-disable-next-line @typescript-eslint/require-await
    handler: async (
      args: Record<string, string>,
      _context: RequestContext,
    ): Promise<string> => {
      const focus = args["focus"] ?? "all";

      let content = `# Database Health Check - Focus: ${focus.charAt(0).toUpperCase() + focus.slice(1)}

## Health Check Categories

### 1. Extension Availability

First, verify critical extensions are installed:

\`\`\`sql
SELECT extname, extversion FROM pg_extension WHERE extname IN ('pg_stat_statements', 'hypopg', 'vector', 'postgis');
\`\`\`

Use \`pg_list_extensions\` to see all installed extensions.

### 2. Database Health Analysis

Use \`pg_analyze_db_health\` with health_type: "${focus}"

This runs comprehensive checks on:
`;

      if (focus === "indexes" || focus === "all") {
        content += `
**Index Health:**
- Invalid indexes (need rebuilding)
- Duplicate indexes (waste space)
- Bloated indexes (need REINDEX)
- Unused indexes (candidates for removal)
`;
      }

      if (focus === "connections" || focus === "all") {
        content += `
**Connection Health:**
- Current connection count vs. max_connections
- Connection pool utilization
- Idle connections consuming resources
- Long-running transactions blocking others
`;
      }

      if (focus === "vacuum" || focus === "all") {
        content += `
**Vacuum Health:**
- Transaction ID wraparound risk (CRITICAL)
- Autovacuum effectiveness
- Table bloat estimates
- Dead tuple accumulation
`;
      }

      if (focus === "replication" || focus === "all") {
        content += `
**Replication Health:**
- Replication lag in milliseconds
- Replication slot status
- WAL sender/receiver status
`;
      }

      if (focus === "buffer" || focus === "all") {
        content += `
**Buffer Cache Health:**
- Cache hit ratio for tables (should be > 99%)
- Cache hit ratio for indexes (should be > 99%)
- Shared buffers effectiveness
`;
      }

      content += `
### 3. Performance Metrics

Check query performance using \`pg_stat_statements\`:
- Queries with mean_exec_time > 1000ms
- High variation in execution times
- Queries dominating total database time

### 4. Capacity Planning

Use \`pg_capacity_planning\` to analyze growth:
- Database size growth rate
- Estimated time to disk full
- Table growth patterns

### 5. Alert Thresholds

Use \`pg_alert_threshold_set\` for:
- Connection limits (warning: 80%, critical: 95%)
- Cache hit ratio (warning: 95%, critical: 90%)
- Replication lag (warning: 5s, critical: 30s)

## Health Report

After running checks, I'll provide:
- **Health Score:** Overall status (Good/Warning/Critical)
- **Critical Issues:** Fix immediately
- **Warnings:** Plan to fix
- **Recommendations:** Maintenance schedule

**Pro Tip:** Run health checks during low-traffic periods for accurate baselines!`;

      return content;
    },
  };
}
