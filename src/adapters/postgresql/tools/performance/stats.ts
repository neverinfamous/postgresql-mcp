/**
 * PostgreSQL Performance Tools - Statistics
 */

import type { PostgresAdapter } from "../../PostgresAdapter.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../types/index.js";
import { z } from "zod";
import { readOnly } from "../../../../utils/annotations.js";
import { getToolIcons } from "../../../../utils/icons.js";
import { IndexStatsSchema, TableStatsSchema } from "../../schemas/index.js";

// Helper to handle undefined params (allows tools to be called without {})
const defaultToEmpty = (val: unknown): unknown => val ?? {};

export function createIndexStatsTool(adapter: PostgresAdapter): ToolDefinition {
  return {
    name: "pg_index_stats",
    description: "Get index usage statistics.",
    group: "performance",
    inputSchema: IndexStatsSchema,
    annotations: readOnly("Index Stats"),
    icons: getToolIcons("performance", readOnly("Index Stats")),
    handler: async (params: unknown, _context: RequestContext) => {
      const { table, schema } = IndexStatsSchema.parse(params);
      let whereClause =
        "schemaname NOT IN ('pg_catalog', 'information_schema')";
      if (schema) whereClause += ` AND schemaname = '${schema}'`;
      if (table) whereClause += ` AND relname = '${table}'`;

      const sql = `SELECT schemaname, relname as table_name, indexrelname as index_name,
                        idx_scan as scans, idx_tup_read as tuples_read, idx_tup_fetch as tuples_fetched,
                        pg_size_pretty(pg_relation_size(indexrelid)) as size
                        FROM pg_stat_user_indexes
                        WHERE ${whereClause}
                        ORDER BY idx_scan DESC`;

      const result = await adapter.executeQuery(sql);
      return { indexes: result.rows };
    },
  };
}

export function createTableStatsTool(adapter: PostgresAdapter): ToolDefinition {
  return {
    name: "pg_table_stats",
    description: "Get table access statistics.",
    group: "performance",
    inputSchema: TableStatsSchema,
    annotations: readOnly("Table Stats"),
    icons: getToolIcons("performance", readOnly("Table Stats")),
    handler: async (params: unknown, _context: RequestContext) => {
      const { table, schema } = TableStatsSchema.parse(params);
      let whereClause =
        "schemaname NOT IN ('pg_catalog', 'information_schema')";
      if (schema) whereClause += ` AND schemaname = '${schema}'`;
      if (table) whereClause += ` AND relname = '${table}'`;

      const sql = `SELECT schemaname, relname as table_name,
                        seq_scan, seq_tup_read, idx_scan, idx_tup_fetch,
                        n_tup_ins as inserts, n_tup_upd as updates, n_tup_del as deletes,
                        n_live_tup as live_tuples, n_dead_tup as dead_tuples,
                        last_vacuum, last_autovacuum, last_analyze, last_autoanalyze
                        FROM pg_stat_user_tables
                        WHERE ${whereClause}
                        ORDER BY seq_scan DESC`;

      const result = await adapter.executeQuery(sql);
      return { tables: result.rows };
    },
  };
}

export function createStatStatementsTool(
  adapter: PostgresAdapter,
): ToolDefinition {
  const StatStatementsSchema = z.preprocess(
    defaultToEmpty,
    z.object({
      limit: z.number().optional(),
      orderBy: z.enum(["total_time", "calls", "mean_time", "rows"]).optional(),
    }),
  );

  return {
    name: "pg_stat_statements",
    description:
      "Get query statistics from pg_stat_statements (requires extension).",
    group: "performance",
    inputSchema: StatStatementsSchema,
    annotations: readOnly("Query Statistics"),
    icons: getToolIcons("performance", readOnly("Query Statistics")),
    handler: async (params: unknown, _context: RequestContext) => {
      const parsed = StatStatementsSchema.parse(params);
      const limit = parsed.limit ?? 20;
      const orderBy = parsed.orderBy ?? "total_time";

      const sql = `SELECT query, calls, total_exec_time as total_time, 
                        mean_exec_time as mean_time, rows,
                        shared_blks_hit, shared_blks_read
                        FROM pg_stat_statements
                        ORDER BY ${orderBy === "total_time" ? "total_exec_time" : orderBy} DESC
                        LIMIT ${String(limit)}`;

      const result = await adapter.executeQuery(sql);
      return { statements: result.rows };
    },
  };
}

export function createStatActivityTool(
  adapter: PostgresAdapter,
): ToolDefinition {
  const StatActivitySchema = z.preprocess(
    defaultToEmpty,
    z.object({
      includeIdle: z.boolean().optional(),
    }),
  );

  return {
    name: "pg_stat_activity",
    description: "Get currently running queries and connections.",
    group: "performance",
    inputSchema: StatActivitySchema,
    annotations: readOnly("Activity Stats"),
    icons: getToolIcons("performance", readOnly("Activity Stats")),
    handler: async (params: unknown, _context: RequestContext) => {
      const parsed = StatActivitySchema.parse(params);
      const idleClause =
        parsed.includeIdle === true ? "" : "AND state != 'idle'";

      const sql = `SELECT pid, usename, datname, client_addr, state,
                        query_start, state_change,
                        now() - query_start as duration,
                        query
                        FROM pg_stat_activity
                        WHERE pid != pg_backend_pid() ${idleClause}
                        ORDER BY query_start`;

      const result = await adapter.executeQuery(sql);
      return { connections: result.rows, count: result.rows?.length ?? 0 };
    },
  };
}

export function createUnusedIndexesTool(
  adapter: PostgresAdapter,
): ToolDefinition {
  const UnusedIndexesSchema = z.preprocess(
    defaultToEmpty,
    z.object({
      schema: z
        .string()
        .optional()
        .describe("Schema to filter (default: all user schemas)"),
      minSize: z
        .string()
        .optional()
        .describe('Minimum index size to include (e.g., "1 MB")'),
    }),
  );

  return {
    name: "pg_unused_indexes",
    description:
      "Find indexes that have never been used (idx_scan = 0). Candidates for removal.",
    group: "performance",
    inputSchema: UnusedIndexesSchema,
    annotations: readOnly("Unused Indexes"),
    icons: getToolIcons("performance", readOnly("Unused Indexes")),
    handler: async (params: unknown, _context: RequestContext) => {
      const parsed = UnusedIndexesSchema.parse(params);
      let whereClause =
        "schemaname NOT IN ('pg_catalog', 'information_schema') AND idx_scan = 0";
      if (parsed.schema !== undefined)
        whereClause += ` AND schemaname = '${parsed.schema}'`;

      const sql = `SELECT schemaname, relname as table_name, indexrelname as index_name,
                        idx_scan as scans, idx_tup_read as tuples_read,
                        pg_size_pretty(pg_relation_size(indexrelid)) as size,
                        pg_relation_size(indexrelid) as size_bytes
                        FROM pg_stat_user_indexes
                        WHERE ${whereClause}
                        ${parsed.minSize !== undefined ? `AND pg_relation_size(indexrelid) >= pg_size_bytes('${parsed.minSize}')` : ""}
                        ORDER BY pg_relation_size(indexrelid) DESC`;

      const result = await adapter.executeQuery(sql);
      return {
        unusedIndexes: result.rows,
        count: result.rows?.length ?? 0,
        hint: "These indexes have never been used. Consider removing them to save disk space and improve write performance.",
      };
    },
  };
}

export function createDuplicateIndexesTool(
  adapter: PostgresAdapter,
): ToolDefinition {
  const DuplicateIndexesSchema = z.preprocess(
    defaultToEmpty,
    z.object({
      schema: z
        .string()
        .optional()
        .describe("Schema to filter (default: all user schemas)"),
    }),
  );

  return {
    name: "pg_duplicate_indexes",
    description:
      "Find duplicate or overlapping indexes (same leading columns). Candidates for consolidation.",
    group: "performance",
    inputSchema: DuplicateIndexesSchema,
    annotations: readOnly("Duplicate Indexes"),
    icons: getToolIcons("performance", readOnly("Duplicate Indexes")),
    handler: async (params: unknown, _context: RequestContext) => {
      const parsed = DuplicateIndexesSchema.parse(params);
      const schemaFilter =
        parsed.schema !== undefined
          ? `AND n.nspname = '${parsed.schema}'`
          : "AND n.nspname NOT IN ('pg_catalog', 'information_schema')";

      // Find indexes with the same leading column(s) on the same table
      const sql = `WITH index_cols AS (
                SELECT
                    n.nspname as schemaname,
                    t.relname as tablename,
                    i.relname as indexname,
                    array_agg(a.attname ORDER BY k.n) as columns,
                    pg_relation_size(i.oid) as size_bytes,
                    pg_size_pretty(pg_relation_size(i.oid)) as size
                FROM pg_class t
                JOIN pg_namespace n ON t.relnamespace = n.oid
                JOIN pg_index idx ON t.oid = idx.indrelid
                JOIN pg_class i ON idx.indexrelid = i.oid
                CROSS JOIN LATERAL unnest(idx.indkey) WITH ORDINALITY AS k(attnum, n)
                JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = k.attnum
                WHERE t.relkind = 'r' ${schemaFilter}
                GROUP BY n.nspname, t.relname, i.relname, i.oid
            )
            SELECT
                a.schemaname, a.tablename,
                a.indexname as index1, a.columns as index1_columns, a.size as index1_size,
                b.indexname as index2, b.columns as index2_columns, b.size as index2_size,
                CASE
                    WHEN a.columns = b.columns THEN 'EXACT_DUPLICATE'
                    WHEN a.columns[1:array_length(b.columns, 1)] = b.columns THEN 'OVERLAPPING'
                    ELSE 'SUBSET'
                END as duplicate_type
            FROM index_cols a
            JOIN index_cols b ON a.schemaname = b.schemaname
                AND a.tablename = b.tablename
                AND a.indexname < b.indexname
                AND (a.columns = b.columns
                    OR a.columns[1:array_length(b.columns, 1)] = b.columns
                    OR b.columns[1:array_length(a.columns, 1)] = a.columns)
            ORDER BY a.schemaname, a.tablename, a.size_bytes DESC`;

      const result = await adapter.executeQuery(sql);
      return {
        duplicateIndexes: result.rows,
        count: result.rows?.length ?? 0,
        hint: "EXACT_DUPLICATE: Remove one. OVERLAPPING/SUBSET: Smaller index may be redundant.",
      };
    },
  };
}

export function createVacuumStatsTool(
  adapter: PostgresAdapter,
): ToolDefinition {
  const VacuumStatsSchema = z.preprocess(
    defaultToEmpty,
    z.object({
      schema: z.string().optional().describe("Schema to filter"),
      table: z.string().optional().describe("Table name to filter"),
    }),
  );

  return {
    name: "pg_vacuum_stats",
    description:
      "Get detailed vacuum statistics including dead tuples, last vacuum times, and wraparound risk.",
    group: "performance",
    inputSchema: VacuumStatsSchema,
    annotations: readOnly("Vacuum Stats"),
    icons: getToolIcons("performance", readOnly("Vacuum Stats")),
    handler: async (params: unknown, _context: RequestContext) => {
      const parsed = VacuumStatsSchema.parse(params);
      let whereClause =
        "schemaname NOT IN ('pg_catalog', 'information_schema')";
      if (parsed.schema !== undefined)
        whereClause += ` AND schemaname = '${parsed.schema}'`;
      if (parsed.table !== undefined)
        whereClause += ` AND relname = '${parsed.table}'`;

      const sql = `SELECT
                s.schemaname, s.relname as table_name,
                s.n_live_tup as live_tuples, s.n_dead_tup as dead_tuples,
                CASE WHEN s.n_live_tup > 0 THEN round((100.0 * s.n_dead_tup / s.n_live_tup)::numeric, 2) ELSE 0 END as dead_pct,
                s.last_vacuum, s.last_autovacuum,
                s.vacuum_count, s.autovacuum_count,
                s.last_analyze, s.last_autoanalyze,
                s.analyze_count, s.autoanalyze_count,
                age(c.relfrozenxid) as xid_age,
                CASE
                    WHEN age(c.relfrozenxid) > 1000000000 THEN 'CRITICAL'
                    WHEN age(c.relfrozenxid) > 500000000 THEN 'WARNING'
                    ELSE 'OK'
                END as wraparound_risk
                FROM pg_stat_user_tables s
                JOIN pg_class c ON c.relname = s.relname
                    AND c.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = s.schemaname)
                WHERE ${whereClause.replace(/schemaname/g, "s.schemaname").replace(/relname/g, "s.relname")}
                ORDER BY s.n_dead_tup DESC`;

      const result = await adapter.executeQuery(sql);
      return {
        vacuumStats: result.rows,
        count: result.rows?.length ?? 0,
      };
    },
  };
}

export function createQueryPlanStatsTool(
  adapter: PostgresAdapter,
): ToolDefinition {
  const QueryPlanStatsSchema = z.preprocess(
    defaultToEmpty,
    z.object({
      limit: z
        .number()
        .optional()
        .describe("Number of queries to return (default: 20)"),
    }),
  );

  return {
    name: "pg_query_plan_stats",
    description:
      "Get query plan statistics showing planning time vs execution time (requires pg_stat_statements).",
    group: "performance",
    inputSchema: QueryPlanStatsSchema,
    annotations: readOnly("Query Plan Stats"),
    icons: getToolIcons("performance", readOnly("Query Plan Stats")),
    handler: async (params: unknown, _context: RequestContext) => {
      const parsed = QueryPlanStatsSchema.parse(params);
      const limit = parsed.limit ?? 20;

      // Check if pg_stat_statements is available with planning time columns
      const sql = `SELECT
                query,
                calls,
                total_plan_time,
                mean_plan_time,
                total_exec_time,
                mean_exec_time,
                rows,
                CASE
                    WHEN total_plan_time + total_exec_time > 0
                    THEN round((100.0 * total_plan_time / (total_plan_time + total_exec_time))::numeric, 2)
                    ELSE 0
                END as plan_pct,
                shared_blks_hit,
                shared_blks_read,
                CASE
                    WHEN shared_blks_hit + shared_blks_read > 0
                    THEN round((100.0 * shared_blks_hit / (shared_blks_hit + shared_blks_read))::numeric, 2)
                    ELSE 100
                END as cache_hit_pct
                FROM pg_stat_statements
                ORDER BY total_plan_time + total_exec_time DESC
                LIMIT ${String(limit)}`;

      const result = await adapter.executeQuery(sql);
      return {
        queryPlanStats: result.rows,
        count: result.rows?.length ?? 0,
        hint: "High plan_pct indicates queries spending significant time in planning. Consider prepared statements.",
      };
    },
  };
}
