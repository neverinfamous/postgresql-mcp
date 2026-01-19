/**
 * postgres-mcp - Backup Tool Schemas
 *
 * Input validation schemas for backup and export operations.
 */

import { z } from "zod";

/**
 * Base schema for MCP visibility (shows all parameters in JSON Schema).
 * This schema is used for tool registration so MCP clients can see the parameters.
 */
export const CopyExportSchemaBase = z.object({
  query: z.string().optional().describe("SELECT query for data to export"),
  sql: z.string().optional().describe("Alias for query parameter"),
  table: z
    .string()
    .optional()
    .describe(
      "Table name to export (auto-generates SELECT *). Supports 'schema.table' format",
    ),
  schema: z
    .string()
    .optional()
    .describe("Schema name when using table (default: public)"),
  format: z
    .enum(["csv", "text", "binary"])
    .optional()
    .describe("Output format (default: csv)"),
  header: z.boolean().optional().describe("Include header row (default: true)"),
  delimiter: z.string().optional().describe("Field delimiter"),
  limit: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Maximum number of rows to export"),
});

/**
 * Transformed schema with alias resolution, table shortcut, and schema.table parsing.
 */
export const CopyExportSchema = CopyExportSchemaBase.transform((input) => {
  // Apply alias: sql → query
  let query = input.query ?? input.sql;
  let conflictWarning: string | undefined;

  // Check for conflicting parameters
  if (
    (input.query !== undefined || input.sql !== undefined) &&
    input.table !== undefined
  ) {
    conflictWarning =
      "Both query and table parameters provided. Using query parameter (table ignored).";
  }

  // Auto-generate query from table if provided
  if ((query === undefined || query === "") && input.table !== undefined) {
    // Parse schema.table format (e.g., 'public.users' -> schema='public', table='users')
    // If table contains a dot, always parse it as schema.table (embedded schema takes priority)
    let tableName = input.table;
    let schemaName = input.schema ?? "public";

    if (input.table.includes(".")) {
      const parts = input.table.split(".");
      if (parts.length === 2 && parts[0] && parts[1]) {
        schemaName = parts[0];
        tableName = parts[1];
      }
    }

    // Build query with optional LIMIT
    query = `SELECT * FROM "${schemaName}"."${tableName}"`;
    if (input.limit !== undefined) {
      query += ` LIMIT ${String(input.limit)}`;
    }
  } else if (query !== undefined && input.limit !== undefined) {
    // If a custom query is provided and limit is specified, wrap or append LIMIT
    // Only append if query doesn't already have LIMIT
    if (!/\bLIMIT\s+\d+\s*$/i.test(query)) {
      query += ` LIMIT ${String(input.limit)}`;
    }
  }

  if (query === undefined || query === "") {
    throw new Error("Either query/sql or table parameter is required");
  }
  return { ...input, query, conflictWarning };
});

export const DumpSchemaSchema = z.object({
  table: z.string().optional().describe("Table name"),
  schema: z.string().optional().describe("Schema name"),
  filename: z
    .string()
    .optional()
    .describe("Output filename (default: backup.dump)"),
});
