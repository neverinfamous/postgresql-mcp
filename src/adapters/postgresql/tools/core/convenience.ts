/**
 * PostgreSQL Core Tools - Convenience Operations
 *
 * Common database operations wrapped for convenience:
 * - pg_upsert: INSERT ... ON CONFLICT UPDATE
 * - pg_batch_insert: Multi-row insert
 * - pg_count: COUNT(*) wrapper
 * - pg_exists: Check if row exists
 * - pg_truncate: TRUNCATE TABLE wrapper
 */

import type { PostgresAdapter } from "../../PostgresAdapter.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../types/index.js";
import { z } from "zod";
import { readOnly, write } from "../../../../utils/annotations.js";
import { getToolIcons } from "../../../../utils/icons.js";

// =============================================================================
// Schemas
// =============================================================================

/**
 * Preprocess table parameters:
 * - Alias: tableName/name → table
 * - Parse schema.table format
 */
function preprocessTableParams(input: unknown): unknown {
  if (typeof input !== "object" || input === null) return input;
  const result = { ...(input as Record<string, unknown>) };

  // Alias: tableName/name → table
  if (result["table"] === undefined) {
    if (result["tableName"] !== undefined)
      result["table"] = result["tableName"];
    else if (result["name"] !== undefined) result["table"] = result["name"];
  }

  // Parse schema.table format
  if (
    typeof result["table"] === "string" &&
    result["table"].includes(".") &&
    result["schema"] === undefined
  ) {
    const parts = result["table"].split(".");
    if (parts.length === 2) {
      result["schema"] = parts[0];
      result["table"] = parts[1];
    }
  }

  return result;
}

/**
 * Preprocess upsert params:
 * - All table params from preprocessTableParams
 * - Alias: values → data
 */
function preprocessUpsertParams(input: unknown): unknown {
  const result = preprocessTableParams(input);
  if (typeof result !== "object" || result === null) return result;
  const obj = result as Record<string, unknown>;

  // Alias: values → data
  if (obj["data"] === undefined && obj["values"] !== undefined) {
    obj["data"] = obj["values"];
  }

  return obj;
}

// Base schema for upsert
const UpsertSchemaBase = z.object({
  table: z
    .string()
    .optional()
    .describe("Table name (supports schema.table format)"),
  tableName: z.string().optional().describe("Alias for table"),
  schema: z.string().optional().describe("Schema name (default: public)"),
  data: z
    .record(z.string(), z.unknown())
    .optional()
    .describe("Column-value pairs to insert"),
  values: z
    .record(z.string(), z.unknown())
    .optional()
    .describe("Alias for data"),
  conflictColumns: z
    .array(z.string())
    .describe("Columns that form the unique constraint (ON CONFLICT)"),
  updateColumns: z
    .array(z.string())
    .optional()
    .describe(
      "Columns to update on conflict (default: all except conflict columns)",
    ),
  returning: z.array(z.string()).optional().describe("Columns to return"),
});

export const UpsertSchema = z
  .preprocess(preprocessUpsertParams, UpsertSchemaBase)
  .transform((d) => ({
    ...d,
    table: d.table ?? d.tableName ?? "",
    data: d.data ?? d.values ?? {},
  }))
  .refine((d) => d.table !== "", {
    message: "table (or tableName alias) is required",
  })
  .refine((d) => Object.keys(d.data).length > 0, {
    message: "data (or values alias) is required",
  })
  .refine((d) => d.conflictColumns.length > 0, {
    message:
      "conflictColumns must not be empty - specify columns for ON CONFLICT clause",
  });

// Base schema for batch insert
const BatchInsertSchemaBase = z.object({
  table: z
    .string()
    .optional()
    .describe("Table name (supports schema.table format)"),
  tableName: z.string().optional().describe("Alias for table"),
  schema: z.string().optional().describe("Schema name (default: public)"),
  rows: z
    .array(z.record(z.string(), z.unknown()))
    .describe("Array of row objects to insert"),
  returning: z.array(z.string()).optional().describe("Columns to return"),
});

export const BatchInsertSchema = z
  .preprocess(preprocessTableParams, BatchInsertSchemaBase)
  .transform((data) => ({
    ...data,
    table: data.table ?? data.tableName ?? "",
  }))
  .refine((data) => data.table !== "", {
    message: "table (or tableName alias) is required",
  })
  .refine((data) => data.rows.length > 0, {
    message: "rows must not be empty",
  });

// Base schema for count
const CountSchemaBase = z.object({
  table: z
    .string()
    .optional()
    .describe("Table name (supports schema.table format)"),
  tableName: z.string().optional().describe("Alias for table"),
  schema: z.string().optional().describe("Schema name (default: public)"),
  where: z
    .string()
    .optional()
    .describe("WHERE clause (supports $1, $2 placeholders)"),
  params: z
    .array(z.unknown())
    .optional()
    .describe("Parameters for WHERE clause placeholders"),
  column: z
    .string()
    .optional()
    .describe("Column to count (default: * for all rows)"),
});

export const CountSchema = z
  .preprocess(
    (val: unknown) => preprocessTableParams(val ?? {}),
    CountSchemaBase,
  )
  .transform((data) => ({
    ...data,
    table: data.table ?? data.tableName ?? "",
  }))
  .refine((data) => data.table !== "", {
    message: "table (or tableName alias) is required",
  });

// Base schema for exists
const ExistsSchemaBase = z.object({
  table: z
    .string()
    .optional()
    .describe("Table name (supports schema.table format)"),
  tableName: z.string().optional().describe("Alias for table"),
  schema: z.string().optional().describe("Schema name (default: public)"),
  where: z
    .string()
    .optional()
    .describe("WHERE clause (supports $1, $2 placeholders)"),
  params: z
    .array(z.unknown())
    .optional()
    .describe("Parameters for WHERE clause placeholders"),
  condition: z.string().optional().describe("Alias for where"),
  filter: z.string().optional().describe("Alias for where"),
});

/**
 * Preprocess exists params:
 * - All table params from preprocessTableParams
 * - Alias: condition/filter → where
 */
function preprocessExistsParams(input: unknown): unknown {
  const result = preprocessTableParams(input);
  if (typeof result !== "object" || result === null) return result;
  const obj = result as Record<string, unknown>;

  // Alias: condition/filter → where
  if (obj["where"] === undefined) {
    if (obj["condition"] !== undefined) obj["where"] = obj["condition"];
    else if (obj["filter"] !== undefined) obj["where"] = obj["filter"];
  }

  return obj;
}

export const ExistsSchema = z
  .preprocess(preprocessExistsParams, ExistsSchemaBase)
  .transform((data) => ({
    ...data,
    table: data.table ?? data.tableName ?? "",
    where: data.where ?? data.condition ?? data.filter,
  }))
  .refine((data) => data.table !== "", {
    message: "table (or tableName alias) is required",
  });

// Base schema for truncate
const TruncateSchemaBase = z.object({
  table: z
    .string()
    .optional()
    .describe("Table name (supports schema.table format)"),
  tableName: z.string().optional().describe("Alias for table"),
  schema: z.string().optional().describe("Schema name (default: public)"),
  cascade: z
    .boolean()
    .optional()
    .describe("Use CASCADE to truncate dependent tables"),
  restartIdentity: z
    .boolean()
    .optional()
    .describe("Restart identity sequences"),
});

export const TruncateSchema = z
  .preprocess(preprocessTableParams, TruncateSchemaBase)
  .transform((data) => ({
    ...data,
    table: data.table ?? data.tableName ?? "",
  }))
  .refine((data) => data.table !== "", {
    message: "table (or tableName alias) is required",
  });

// =============================================================================
// Tools
// =============================================================================

/**
 * Upsert (INSERT ... ON CONFLICT UPDATE)
 */
export function createUpsertTool(adapter: PostgresAdapter): ToolDefinition {
  return {
    name: "pg_upsert",
    description:
      "Insert a row or update if it already exists (INSERT ... ON CONFLICT DO UPDATE). Specify conflict columns for uniqueness check. Use data or values for column-value pairs.",
    group: "core",
    inputSchema: UpsertSchema,
    annotations: write("Upsert"),
    icons: getToolIcons("core", write("Upsert")),
    handler: async (params: unknown, _context: RequestContext) => {
      const parsed = UpsertSchema.parse(params);
      const schemaName = parsed.schema ?? "public";
      const qualifiedTable = `"${schemaName}"."${parsed.table}"`;

      const columns = Object.keys(parsed.data);
      const values = Object.values(parsed.data);

      // Build INSERT clause
      const columnList = columns.map((c) => `"${c}"`).join(", ");
      const placeholders = columns
        .map((_, i) => `$${String(i + 1)}`)
        .join(", ");

      // Build ON CONFLICT clause
      const conflictCols = parsed.conflictColumns
        .map((c) => `"${c}"`)
        .join(", ");

      // Determine columns to update (default: all except conflict columns)
      const updateCols =
        parsed.updateColumns ??
        columns.filter((c) => !parsed.conflictColumns.includes(c));

      let conflictAction: string;
      if (updateCols.length === 0) {
        // No columns to update, just do nothing
        conflictAction = "DO NOTHING";
      } else {
        const updateSet = updateCols
          .map((c) => `"${c}" = EXCLUDED."${c}"`)
          .join(", ");
        conflictAction = `DO UPDATE SET ${updateSet}`;
      }

      // Build RETURNING clause - always include xmax to detect insert vs update
      const returningCols = parsed.returning ?? [];
      const hasReturning = returningCols.length > 0;
      // Always add xmax to detect if it was insert (xmax=0) or update (xmax>0)
      const xmaxClause = "xmax::text::int as _xmax";
      const returningClause = hasReturning
        ? ` RETURNING ${returningCols.map((c) => `"${c}"`).join(", ")}, ${xmaxClause}`
        : ` RETURNING ${xmaxClause}`;

      const sql = `INSERT INTO ${qualifiedTable} (${columnList}) VALUES (${placeholders}) ON CONFLICT (${conflictCols}) ${conflictAction}${returningClause}`;

      try {
        const result = await adapter.executeQuery(sql, values);
        // Determine if it was an insert or update from xmax
        // xmax = 0 means INSERT, xmax > 0 means UPDATE
        const firstRow = result.rows?.[0];
        const xmaxValue = Number(firstRow?.["_xmax"] ?? 0);
        const operation = xmaxValue === 0 ? "insert" : "update";

        // Remove _xmax from returned rows if not explicitly requested
        const cleanedRows = result.rows?.map((row) => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { _xmax, ...rest } = row;
          return rest;
        });

        return {
          success: true,
          operation, // 'insert' or 'update'
          rowsAffected: result.rowsAffected ?? 0,
          affectedRows: result.rowsAffected ?? 0, // Alias for common API naming
          rowCount: 1, // Upsert always affects one row
          // Only include rows when RETURNING clause was explicitly requested
          ...(hasReturning &&
            cleanedRows &&
            cleanedRows.length > 0 && { rows: cleanedRows }),
          sql,
        };
      } catch (error: unknown) {
        // Provide clearer error message for constraint issues
        if (error instanceof Error) {
          const msg = error.message.toLowerCase();
          if (msg.includes("no unique or exclusion constraint")) {
            throw new Error(
              `conflictColumns [${parsed.conflictColumns.join(", ")}] must reference columns with a UNIQUE constraint or PRIMARY KEY. ` +
                `Create a unique constraint first: ALTER TABLE ${qualifiedTable} ADD CONSTRAINT unique_name UNIQUE (${conflictCols})`,
            );
          }
        }
        throw error;
      }
    },
  };
}

/**
 * Batch insert (multi-row INSERT)
 */
export function createBatchInsertTool(
  adapter: PostgresAdapter,
): ToolDefinition {
  return {
    name: "pg_batch_insert",
    description:
      "Insert multiple rows in a single statement. More efficient than individual inserts. Rows array must not be empty.",
    group: "core",
    inputSchema: BatchInsertSchema,
    annotations: write("Batch Insert"),
    icons: getToolIcons("core", write("Batch Insert")),
    handler: async (params: unknown, _context: RequestContext) => {
      const parsed = BatchInsertSchema.parse(params);

      // Validate rows array is not empty
      if (parsed.rows.length === 0) {
        throw new Error(
          "rows array must not be empty. Provide at least one row to insert, " +
            'e.g., rows: [{column: "value"}]',
        );
      }

      const schemaName = parsed.schema ?? "public";
      const qualifiedTable = `"${schemaName}"."${parsed.table}"`;

      // Get all unique columns from all rows
      const allColumns = new Set<string>();
      for (const row of parsed.rows) {
        for (const col of Object.keys(row)) {
          allColumns.add(col);
        }
      }
      const columns = Array.from(allColumns);

      // Handle SERIAL-only tables (empty objects)
      if (columns.length === 0) {
        // Use INSERT ... DEFAULT VALUES for each row
        const returningClause =
          parsed.returning !== undefined && parsed.returning.length > 0
            ? ` RETURNING ${parsed.returning.map((c) => `"${c}"`).join(", ")}`
            : "";

        // Execute individual DEFAULT VALUES inserts for each row
        let totalAffected = 0;
        const allRows: Record<string, unknown>[] = [];
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        for (const _row of parsed.rows) {
          const sql = `INSERT INTO ${qualifiedTable} DEFAULT VALUES${returningClause}`;
          const result = await adapter.executeQuery(sql);
          totalAffected += result.rowsAffected ?? 1;
          if (result.rows && result.rows.length > 0) {
            allRows.push(...result.rows);
          }
        }
        return {
          success: true,
          rowsAffected: totalAffected,
          affectedRows: totalAffected,
          insertedCount: totalAffected, // Semantic alias for insert operations
          rowCount: parsed.rows.length,
          hint: "Used DEFAULT VALUES for SERIAL-only table (no columns specified)",
          ...(allRows.length > 0 && { rows: allRows }),
        };
      }

      // Build values placeholders
      const values: unknown[] = [];
      const rowPlaceholders: string[] = [];
      let paramIndex = 1;

      for (const row of parsed.rows) {
        const rowValues: string[] = [];
        for (const col of columns) {
          values.push(row[col] ?? null);
          rowValues.push(`$${String(paramIndex)}`);
          paramIndex++;
        }
        rowPlaceholders.push(`(${rowValues.join(", ")})`);
      }

      const columnList = columns.map((c) => `"${c}"`).join(", ");
      const returningClause =
        parsed.returning !== undefined && parsed.returning.length > 0
          ? ` RETURNING ${parsed.returning.map((c) => `"${c}"`).join(", ")}`
          : "";

      const sql = `INSERT INTO ${qualifiedTable} (${columnList}) VALUES ${rowPlaceholders.join(", ")}${returningClause}`;

      const result = await adapter.executeQuery(sql, values);
      return {
        success: true,
        rowsAffected: result.rowsAffected ?? 0,
        affectedRows: result.rowsAffected ?? 0, // Alias for common API naming
        insertedCount: result.rowsAffected ?? 0, // Semantic alias for insert operations
        rowCount: parsed.rows.length,
        // Only include returned rows when RETURNING clause is used
        ...(result.rows && result.rows.length > 0 && { rows: result.rows }),
      };
    },
  };
}

/**
 * Count rows
 */
export function createCountTool(adapter: PostgresAdapter): ToolDefinition {
  return {
    name: "pg_count",
    description:
      "Count rows in a table, optionally with a WHERE clause or specific column.",
    group: "core",
    inputSchema: CountSchema,
    annotations: readOnly("Count"),
    icons: getToolIcons("core", readOnly("Count")),
    handler: async (params: unknown, _context: RequestContext) => {
      const parsed = CountSchema.parse(params);
      const schemaName = parsed.schema ?? "public";
      const qualifiedTable = `"${schemaName}"."${parsed.table}"`;

      const countExpr =
        parsed.column !== undefined ? `"${parsed.column}"` : "*";
      // Treat empty where string as no where clause
      const whereClause =
        parsed.where !== undefined && parsed.where.trim() !== ""
          ? ` WHERE ${parsed.where}`
          : "";

      const sql = `SELECT COUNT(${countExpr}) as count FROM ${qualifiedTable}${whereClause}`;
      const result = await adapter.executeQuery(sql, parsed.params);

      const count = Number(result.rows?.[0]?.["count"]) || 0;
      return { count };
    },
  };
}

/**
 * Check if row exists
 */
export function createExistsTool(adapter: PostgresAdapter): ToolDefinition {
  return {
    name: "pg_exists",
    description:
      "Check if rows exist in a table. WHERE clause is optional: with WHERE = checks matching rows; without WHERE = checks if table has any rows at all. For table *schema* existence, use pg_list_tables.",
    group: "core",
    inputSchema: ExistsSchema,
    annotations: readOnly("Exists"),
    icons: getToolIcons("core", readOnly("Exists")),
    handler: async (params: unknown, _context: RequestContext) => {
      const parsed = ExistsSchema.parse(params);
      const schemaName = parsed.schema ?? "public";
      const qualifiedTable = `"${schemaName}"."${parsed.table}"`;

      // Build SQL with optional WHERE clause
      const whereValue = parsed.where ?? "";
      const hasWhere = whereValue.trim() !== "";
      const whereClause = hasWhere ? ` WHERE ${whereValue}` : "";
      const sql = `SELECT EXISTS(SELECT 1 FROM ${qualifiedTable}${whereClause}) as exists`;

      const result = await adapter.executeQuery(sql, parsed.params);

      const exists = result.rows?.[0]?.["exists"] === true;
      return {
        exists,
        table: `${schemaName}.${parsed.table}`,
        // Add clarifying context based on usage
        mode: hasWhere ? "filtered" : "any_rows",
        ...(hasWhere && { where: whereValue }),
        ...(!hasWhere && {
          hint: "No WHERE clause provided. Checked if table has any rows. To check specific conditions, add where/condition/filter parameter.",
        }),
      };
    },
  };
}

/**
 * Truncate table
 */
export function createTruncateTool(adapter: PostgresAdapter): ToolDefinition {
  return {
    name: "pg_truncate",
    description:
      "Truncate a table, removing all rows quickly. Use cascade to truncate dependent tables.",
    group: "core",
    inputSchema: TruncateSchema,
    annotations: write("Truncate"),
    icons: getToolIcons("core", write("Truncate")),
    handler: async (params: unknown, _context: RequestContext) => {
      const parsed = TruncateSchema.parse(params);
      const schemaName = parsed.schema ?? "public";
      const qualifiedTable = `"${schemaName}"."${parsed.table}"`;

      let sql = `TRUNCATE TABLE ${qualifiedTable}`;

      if (parsed.restartIdentity === true) {
        sql += " RESTART IDENTITY";
      }

      if (parsed.cascade === true) {
        sql += " CASCADE";
      }

      await adapter.executeQuery(sql);
      return {
        success: true,
        table: `${schemaName}.${parsed.table}`,
        cascade: parsed.cascade ?? false,
        restartIdentity: parsed.restartIdentity ?? false,
      };
    },
  };
}

/**
 * Get all convenience tools
 */
export function getConvenienceTools(
  adapter: PostgresAdapter,
): ToolDefinition[] {
  return [
    createUpsertTool(adapter),
    createBatchInsertTool(adapter),
    createCountTool(adapter),
    createExistsTool(adapter),
    createTruncateTool(adapter),
  ];
}
