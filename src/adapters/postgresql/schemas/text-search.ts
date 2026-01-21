/**
 * postgres-mcp - Text Search Tool Schemas
 *
 * Input validation schemas for full-text search and pattern matching.
 */

import { z } from "zod";

/**
 * Preprocess text tool parameters to normalize common input patterns:
 * - tableName → table
 * - col → column
 * - Parse schema.table format (embedded schema takes priority)
 */
function preprocessTextParams(input: unknown): unknown {
  if (typeof input !== "object" || input === null) {
    return input;
  }
  const result = { ...(input as Record<string, unknown>) };

  // Alias: tableName → table
  if (result["tableName"] !== undefined && result["table"] === undefined) {
    result["table"] = result["tableName"];
  }
  // Alias: col → column
  if (result["col"] !== undefined && result["column"] === undefined) {
    result["column"] = result["col"];
  }
  // Alias: filter → where
  if (result["filter"] !== undefined && result["where"] === undefined) {
    result["where"] = result["filter"];
  }
  // Alias: text → value (for trigram/fuzzy tools)
  if (result["text"] !== undefined && result["value"] === undefined) {
    result["value"] = result["text"];
  }
  // Alias: indexName → name (for FTS index tool)
  if (result["indexName"] !== undefined && result["name"] === undefined) {
    result["name"] = result["indexName"];
  }
  // Alias: column (singular) → columns (array) for text search
  if (
    result["column"] !== undefined &&
    result["columns"] === undefined &&
    typeof result["column"] === "string"
  ) {
    result["columns"] = [result["column"]];
  }

  // Parse schema.table format (embedded schema takes priority)
  if (typeof result["table"] === "string" && result["table"].includes(".")) {
    const parts = result["table"].split(".");
    if (parts.length === 2 && parts[0] && parts[1]) {
      // Only override schema if not already explicitly set
      if (result["schema"] === undefined) {
        result["schema"] = parts[0];
      }
      result["table"] = parts[1];
    }
  }

  return result;
}

export const TextSearchSchema = z.preprocess(
  preprocessTextParams,
  z.object({
    table: z.string().describe("Table name"),
    columns: z.array(z.string()).describe("Text columns to search"),
    query: z.string().describe("Search query"),
    config: z
      .string()
      .optional()
      .describe("Text search config (default: english)"),
    select: z.array(z.string()).optional().describe("Columns to return"),
    limit: z.number().optional().describe("Max results"),
    schema: z.string().optional().describe("Schema name (default: public)"),
  }),
);

export const TrigramSimilaritySchema = z.preprocess(
  preprocessTextParams,
  z.object({
    table: z.string().describe("Table name"),
    column: z.string().describe("Column to compare"),
    value: z.string().describe("Value to compare against"),
    threshold: z
      .number()
      .optional()
      .describe(
        "Similarity threshold (0-1, default 0.3; use 0.1-0.2 for partial matches)",
      ),
    select: z.array(z.string()).optional().describe("Columns to return"),
    limit: z.number().optional().describe("Max results"),
    where: z.string().optional().describe("Additional WHERE clause filter"),
    schema: z.string().optional().describe("Schema name (default: public)"),
  }),
);

export const RegexpMatchSchema = z.preprocess(
  preprocessTextParams,
  z.object({
    table: z.string().describe("Table name"),
    column: z.string().describe("Column to match"),
    pattern: z.string().describe("POSIX regex pattern"),
    flags: z.string().optional().describe("Regex flags (i, g, etc.)"),
    select: z.array(z.string()).optional().describe("Columns to return"),
    limit: z.number().optional().describe("Max results"),
    where: z.string().optional().describe("Additional WHERE clause filter"),
    schema: z.string().optional().describe("Schema name (default: public)"),
  }),
);
