/**
 * postgres-mcp - Performance Tool Schemas
 *
 * Input validation schemas for query analysis and performance monitoring.
 */

import { z } from "zod";

// Helper to handle undefined params (allows tools to be called without {})
const defaultToEmpty = (val: unknown): unknown => val ?? {};

/**
 * Preprocess explain params to normalize aliases.
 * Exported so tools can apply it in their handlers.
 */
export function preprocessExplainParams(input: unknown): unknown {
  if (typeof input !== "object" || input === null) {
    return input;
  }
  const result = { ...(input as Record<string, unknown>) };

  // Alias: query → sql
  if (result["query"] !== undefined && result["sql"] === undefined) {
    result["sql"] = result["query"];
  }

  return result;
}

// =============================================================================
// Base Schema (for MCP inputSchema visibility - no preprocess)
// =============================================================================

/**
 * Base schema for EXPLAIN tools - used for MCP inputSchema visibility.
 * Shows sql as required so MCP clients prompt for it.
 */
export const ExplainSchemaBase = z.object({
  sql: z.string().describe("Query to explain"),
  params: z.array(z.unknown()).optional().describe("Query parameters"),
  analyze: z.boolean().optional().describe("Run EXPLAIN ANALYZE"),
  buffers: z.boolean().optional().describe("Include buffer usage"),
  format: z
    .enum(["text", "json", "xml", "yaml"])
    .optional()
    .describe("Output format"),
});

// =============================================================================
// Full Schema (with preprocess - for handler parsing)
// =============================================================================

/**
 * Full schema with preprocessing for alias support.
 * Used in handler to parse params after MCP has collected them.
 */
export const ExplainSchema = z.preprocess(
  preprocessExplainParams,
  ExplainSchemaBase,
);

export const IndexStatsSchema = z.preprocess(
  defaultToEmpty,
  z.object({
    table: z.string().optional().describe("Table name (all tables if omitted)"),
    schema: z.string().optional().describe("Schema name"),
  }),
);

export const TableStatsSchema = z.preprocess(
  defaultToEmpty,
  z.object({
    table: z.string().optional().describe("Table name (all tables if omitted)"),
    schema: z.string().optional().describe("Schema name"),
  }),
);
