/**
 * postgres-mcp - pgvector Tool Schemas
 *
 * Input validation schemas for vector similarity search.
 * Supports parameter smoothing: col -> column, tableName -> table
 */

import { z } from "zod";

/**
 * Validates that an array contains only finite numbers (rejects Infinity, -Infinity, NaN).
 * Provides clear error message instead of confusing "expected number, received number".
 */
export const FiniteNumberArray = z
  .array(z.number())
  .superRefine((arr: number[], ctx) => {
    const invalidIndexes: number[] = arr
      .map((n: number, i: number) => (Number.isFinite(n) ? -1 : i))
      .filter((i: number) => i >= 0);

    if (invalidIndexes.length > 0) {
      const invalidValues = invalidIndexes
        .map((i: number) => String(arr[i]))
        .join(", ");
      ctx.addIssue({
        code: "custom",
        message: `Vector contains invalid values at index ${invalidIndexes.join(", ")}: ${invalidValues}. Only finite numbers are allowed (no Infinity or NaN).`,
      });
    }
  });

// Base schema for MCP exposure (shows all accepted parameters)
const VectorSearchSchemaBase = z.object({
  table: z.string().optional().describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
  column: z.string().optional().describe("Vector column name"),
  col: z.string().optional().describe("Alias for column"),
  vector: FiniteNumberArray.describe("Query vector"),
  metric: z
    .enum(["l2", "cosine", "inner_product"])
    .optional()
    .describe("Distance metric"),
  limit: z.number().optional().describe("Number of results"),
  select: z
    .array(z.string())
    .optional()
    .describe("Additional columns to return"),
  where: z.string().optional().describe("Filter condition"),
  filter: z.string().optional().describe("Alias for where"),
  schema: z.string().optional().describe("Database schema (default: public)"),
  excludeNull: z
    .boolean()
    .optional()
    .describe("Exclude rows with NULL vectors (default: false)"),
});

// Transformed schema with alias resolution
export const VectorSearchSchema = VectorSearchSchemaBase.transform((data) => ({
  table: data.table ?? data.tableName ?? "",
  column: data.column ?? data.col ?? "",
  vector: data.vector,
  metric: data.metric,
  limit: data.limit,
  select: data.select,
  where: data.where ?? data.filter,
  schema: data.schema,
  excludeNull: data.excludeNull,
}));

// Base schema for MCP exposure
const VectorCreateIndexSchemaBase = z.object({
  table: z.string().optional().describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
  column: z.string().optional().describe("Vector column name"),
  col: z.string().optional().describe("Alias for column"),
  type: z.enum(["ivfflat", "hnsw"]).describe("Index type"),
  metric: z
    .enum(["l2", "cosine", "inner_product"])
    .optional()
    .describe("Distance metric (default: l2)"),
  ifNotExists: z
    .boolean()
    .optional()
    .describe("Skip if index already exists (default: false)"),
  lists: z.number().optional().describe("Number of lists for IVFFlat"),
  m: z.number().optional().describe("HNSW m parameter"),
  efConstruction: z
    .number()
    .optional()
    .describe("HNSW ef_construction parameter"),
  schema: z.string().optional().describe("Database schema (default: public)"),
});

// Transformed schema with alias resolution
export const VectorCreateIndexSchema = VectorCreateIndexSchemaBase.transform(
  (data) => ({
    table: data.table ?? data.tableName ?? "",
    column: data.column ?? data.col ?? "",
    type: data.type,
    metric: data.metric ?? "l2",
    ifNotExists: data.ifNotExists,
    lists: data.lists,
    m: data.m,
    efConstruction: data.efConstruction,
    schema: data.schema,
  }),
);
