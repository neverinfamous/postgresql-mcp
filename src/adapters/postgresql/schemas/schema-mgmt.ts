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
// Exported so MCP Direct Tool Calls can show parameter schema
export const CreateSequenceSchemaBase = z.object({
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

// Valid checkOption values for views
const CHECK_OPTION_VALUES = ["cascaded", "local", "none"] as const;

// Base schema for MCP visibility (shows both name and viewName, query/sql/definition)
// Exported so MCP Direct Tool Calls can show parameter schema
export const CreateViewSchemaBase = z.object({
  name: z
    .string()
    .optional()
    .describe("View name (supports schema.name format)"),
  viewName: z.string().optional().describe("Alias for name"),
  schema: z.string().optional().describe("Schema name"),
  query: z.string().optional().describe("SELECT query for view"),
  sql: z.string().optional().describe("Alias for query"),
  definition: z.string().optional().describe("Alias for query"),
  materialized: z.boolean().optional().describe("Create materialized view"),
  orReplace: z.boolean().optional().describe("Replace if exists"),
  checkOption: z
    .enum(CHECK_OPTION_VALUES)
    .optional()
    .describe("WITH CHECK OPTION: 'cascaded', 'local', or 'none'"),
});

/**
 * Preprocess view create params to handle schema.name format
 */
function preprocessCreateViewParams(input: unknown): unknown {
  if (typeof input !== "object" || input === null) return input;
  const result = { ...(input as Record<string, unknown>) };

  // Get the name from either name or viewName
  const nameVal = result["name"] ?? result["viewName"];
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
export const CreateViewSchema = z
  .preprocess(preprocessCreateViewParams, CreateViewSchemaBase)
  .transform((data) => ({
    name: data.name ?? data.viewName ?? "",
    schema: data.schema,
    query: data.query ?? data.sql ?? data.definition ?? "",
    materialized: data.materialized,
    orReplace: data.orReplace,
    checkOption: data.checkOption,
  }))
  .refine((data) => data.name !== "", {
    message: "name (or viewName alias) is required",
  })
  .refine((data) => data.query !== "", {
    message: "query (or sql/definition alias) is required",
  });

// =============================================================================
// Drop Schemas - Split Schema pattern for MCP visibility
// =============================================================================

/**
 * Base schema for dropping sequences - used for MCP inputSchema visibility.
 */
export const DropSequenceSchemaBase = z.object({
  name: z.string().describe("Sequence name (supports schema.name format)"),
  schema: z.string().optional().describe("Schema name (default: public)"),
  ifExists: z.boolean().optional().describe("Use IF EXISTS to avoid errors"),
  cascade: z.boolean().optional().describe("Drop dependent objects"),
});

/**
 * Preprocess sequence drop params to handle schema.name format
 */
function preprocessDropSequenceParams(input: unknown): unknown {
  if (typeof input !== "object" || input === null) return input;
  const result = { ...(input as Record<string, unknown>) };

  // Parse schema.name format
  if (
    typeof result["name"] === "string" &&
    result["name"].includes(".") &&
    result["schema"] === undefined
  ) {
    const parts = result["name"].split(".");
    if (parts.length === 2) {
      result["schema"] = parts[0];
      result["name"] = parts[1];
    }
  }

  return result;
}

/**
 * Full schema with preprocessing for alias support.
 */
export const DropSequenceSchema = z.preprocess(
  preprocessDropSequenceParams,
  DropSequenceSchemaBase,
);

/**
 * Base schema for dropping views - used for MCP inputSchema visibility.
 */
export const DropViewSchemaBase = z.object({
  name: z.string().describe("View name (supports schema.name format)"),
  schema: z.string().optional().describe("Schema name (default: public)"),
  materialized: z
    .boolean()
    .optional()
    .describe("Whether the view is materialized"),
  ifExists: z.boolean().optional().describe("Use IF EXISTS to avoid errors"),
  cascade: z.boolean().optional().describe("Drop dependent objects"),
});

/**
 * Preprocess view drop params to handle schema.name format
 */
function preprocessDropViewParams(input: unknown): unknown {
  if (typeof input !== "object" || input === null) return input;
  const result = { ...(input as Record<string, unknown>) };

  // Parse schema.name format
  if (
    typeof result["name"] === "string" &&
    result["name"].includes(".") &&
    result["schema"] === undefined
  ) {
    const parts = result["name"].split(".");
    if (parts.length === 2) {
      result["schema"] = parts[0];
      result["name"] = parts[1];
    }
  }

  return result;
}

/**
 * Full schema with preprocessing for alias support.
 */
export const DropViewSchema = z.preprocess(
  preprocessDropViewParams,
  DropViewSchemaBase,
);

// =============================================================================
// List Functions Schema - Split Schema pattern for MCP visibility
// =============================================================================

/**
 * Base schema for listing functions - used for MCP inputSchema visibility.
 * All parameters are visible to MCP clients.
 */
export const ListFunctionsSchemaBase = z.object({
  schema: z.string().optional().describe("Filter to specific schema"),
  exclude: z
    .array(z.string())
    .optional()
    .describe(
      'Array of extension names/schemas to exclude, e.g., ["postgis", "ltree", "pgcrypto"]',
    ),
  language: z
    .string()
    .optional()
    .describe('Filter by language (e.g., "plpgsql", "sql", "c")'),
  limit: z
    .number()
    .optional()
    .describe(
      "Max results (default: 500). Increase for databases with many extensions.",
    ),
});

/**
 * Full schema with preprocessing that handles null/undefined params.
 * Used in the handler for validation.
 */
export const ListFunctionsSchema = z.preprocess(
  (val: unknown) => val ?? {},
  ListFunctionsSchemaBase,
);
