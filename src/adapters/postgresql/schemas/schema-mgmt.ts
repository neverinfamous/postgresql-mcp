/**
 * postgres-mcp - Schema Management Tool Schemas
 *
 * Input validation schemas for schema, sequence, and view management.
 */

import { z } from "zod";

export const CreateSchemaSchema = z.object({
  name: z.string().describe("Schema name"),
  authorization: z.string().optional().describe("Owner role"),
  ifNotExists: z.boolean().optional().describe("Use IF NOT EXISTS"),
});

export const DropSchemaSchema = z.object({
  name: z.string().describe("Schema name"),
  cascade: z.boolean().optional().describe("Drop objects in schema"),
  ifExists: z.boolean().optional().describe("Use IF EXISTS"),
});

// Base schema for MCP visibility (shows both name and sequenceName)
const CreateSequenceSchemaBase = z.object({
  name: z.string().optional().describe("Sequence name"),
  sequenceName: z.string().optional().describe("Alias for name"),
  schema: z.string().optional().describe("Schema name"),
  start: z.number().optional().describe("Start value"),
  increment: z.number().optional().describe("Increment by (default: 1)"),
  minValue: z.number().optional().describe("Minimum value"),
  maxValue: z.number().optional().describe("Maximum value"),
  cache: z
    .number()
    .optional()
    .describe("Number of sequence values to pre-allocate (default: 1)"),
  cycle: z
    .boolean()
    .optional()
    .describe("Cycle when limit reached (default: no cycle)"),
  ownedBy: z
    .string()
    .optional()
    .describe(
      "Column that owns this sequence (format: table.column or schema.table.column)",
    ),
  ifNotExists: z
    .boolean()
    .optional()
    .describe("Use IF NOT EXISTS to avoid error if sequence already exists"),
});

/**
 * Preprocess sequence create params to handle schema.name format
 */
function preprocessCreateSequenceParams(input: unknown): unknown {
  if (typeof input !== "object" || input === null) return input;
  const result = { ...(input as Record<string, unknown>) };

  // Get the name from either name or sequenceName
  const nameVal = result["name"] ?? result["sequenceName"];
  if (
    typeof nameVal === "string" &&
    nameVal.includes(".") &&
    result["schema"] === undefined
  ) {
    const parts = nameVal.split(".");
    if (parts.length === 2) {
      result["schema"] = parts[0];
      result["name"] = parts[1];
    }
  }

  return result;
}

// Transformed schema with alias resolution and schema.name preprocessing
export const CreateSequenceSchema = z.preprocess(
  preprocessCreateSequenceParams,
  CreateSequenceSchemaBase.transform((data) => ({
    name: data.name ?? data.sequenceName ?? "",
    schema: data.schema,
    start: data.start,
    increment: data.increment,
    minValue: data.minValue,
    maxValue: data.maxValue,
    cache: data.cache,
    cycle: data.cycle,
    ownedBy: data.ownedBy,
    ifNotExists: data.ifNotExists,
  })).refine((data) => data.name !== "", {
    message: "name (or sequenceName alias) is required",
  }),
);

// Base schema for MCP visibility (shows both name and viewName, query/sql/definition)
const CreateViewSchemaBase = z.object({
  name: z.string().optional().describe("View name"),
  viewName: z.string().optional().describe("Alias for name"),
  schema: z.string().optional().describe("Schema name"),
  query: z.string().optional().describe("SELECT query for view"),
  sql: z.string().optional().describe("Alias for query"),
  definition: z.string().optional().describe("Alias for query"),
  materialized: z.boolean().optional().describe("Create materialized view"),
  orReplace: z.boolean().optional().describe("Replace if exists"),
});

// Transformed schema with alias resolution
export const CreateViewSchema = CreateViewSchemaBase.transform((data) => ({
  name: data.name ?? data.viewName ?? "",
  schema: data.schema,
  query: data.query ?? data.sql ?? data.definition ?? "",
  materialized: data.materialized,
  orReplace: data.orReplace,
}))
  .refine((data) => data.name !== "", {
    message: "name (or viewName alias) is required",
  })
  .refine((data) => data.query !== "", {
    message: "query (or sql/definition alias) is required",
  });
