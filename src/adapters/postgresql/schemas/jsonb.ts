/**
 * postgres-mcp - JSONB Tool Schemas
 *
 * Input validation schemas for JSONB operations.
 *
 * DUAL-SCHEMA PATTERN:
 * Base schemas are exported for MCP (visible parameters).
 * Preprocess functions are exported for handlers to normalize inputs.
 * This ensures MCP clients see parameters while handlers get normalized data.
 *
 * PATH FORMAT NORMALIZATION:
 * All tools now accept BOTH formats for paths:
 * - STRING: 'a.b[0]' or 'a.b.0' (dot notation)
 * - ARRAY: ['a', 'b', '0']
 */

import { z } from "zod";

/**
 * Convert a string path to array format
 * 'a.b[0].c' → ['a', 'b', '0', 'c']
 * 'a.b.0' → ['a', 'b', '0']
 */
export function stringPathToArray(path: string): string[] {
  // Handle JSONPath format ($.a.b) - strip leading $. if present
  let normalized = path.startsWith("$.") ? path.slice(2) : path;
  // Remove leading $ if present
  if (normalized.startsWith("$")) normalized = normalized.slice(1);
  if (normalized.startsWith(".")) normalized = normalized.slice(1);

  // Replace array notation [0] with .0
  normalized = normalized.replace(/\[(\d+)\]/g, ".$1");

  // Split by dot and filter empty strings
  return normalized.split(".").filter((p) => p !== "");
}

/**
 * Convert array path to string format for extract
 * ['a', 'b', '0'] → 'a.b.0'
 */
export function arrayPathToString(path: string[]): string {
  return path.join(".");
}

/**
 * Normalize path to array format (for set/insert handlers)
 * Accepts both string paths and arrays with mixed string/number elements
 */
export function normalizePathToArray(
  path: string | (string | number)[],
): string[] {
  if (typeof path === "string") {
    return stringPathToArray(path);
  }
  // Convert all elements to strings
  return path.map((p) => String(p));
}

/**
 * Normalize path for jsonb_insert - converts numeric path segments to numbers
 * PostgreSQL jsonb_insert requires integer indices for array access
 * 'tags.0' → ['tags', 0] (number, not string)
 * 0 → [0] (bare number wrapped in array)
 */
export function normalizePathForInsert(
  path: string | number | (string | number)[],
): (string | number)[] {
  // Handle bare numbers (e.g., 0, -1 for array positions)
  if (typeof path === "number") {
    return [path];
  }
  if (typeof path === "string") {
    const segments = stringPathToArray(path);
    // Convert numeric strings to numbers for array access
    return segments.map((p) => (/^-?\d+$/.test(p) ? parseInt(p, 10) : p));
  }
  // Already mixed types - ensure numbers stay as numbers
  return path.map((p) =>
    typeof p === "number" ? p : /^-?\d+$/.test(p) ? parseInt(p, 10) : p,
  );
}

/**
 * Normalize path to string format (for extract handler)
 * Accepts both string paths and arrays with mixed string/number elements
 */
export function normalizePathToString(
  path: string | (string | number)[],
): string {
  if (Array.isArray(path)) {
    return path.map((p) => String(p)).join(".");
  }
  return path;
}

/**
 * Parse JSON string values for JSONB value parameters
 * MCP clients may send objects as JSON strings
 */
export function parseJsonbValue(value: unknown): unknown {
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return value; // Keep as string if not valid JSON
    }
  }
  return value;
}

// ============== EXTRACT SCHEMA ==============
export const JsonbExtractSchema = z.object({
  table: z.string().describe("Table name"),
  column: z.string().describe("JSONB column name"),
  path: z
    .union([
      z.string().describe('Path as string (e.g., "a.b.c" or "a[0].b")'),
      z
        .array(z.union([z.string(), z.number()]))
        .describe('Path as array (e.g., ["a", 0, "b"])'),
    ])
    .describe(
      "Path to extract. Accepts both string and array formats with numeric indices.",
    ),
  select: z
    .array(z.string())
    .optional()
    .describe(
      'Additional columns to include in result for row identification (e.g., ["id"])',
    ),
  where: z.string().optional().describe("WHERE clause"),
  limit: z.number().optional().describe("Maximum number of rows to return"),
});

// ============== SET SCHEMA ==============
export const JsonbSetSchema = z.object({
  table: z.string().describe("Table name"),
  column: z.string().describe("JSONB column name"),
  path: z
    .union([
      z.string().describe('Path as string (e.g., "a.b.c" or "a[0].b")'),
      z
        .array(z.union([z.string(), z.number()]))
        .describe('Path as array (e.g., ["a", 0, "b"])'),
    ])
    .describe(
      "Path to the value. Accepts both string and array formats with numeric indices.",
    ),
  value: z
    .unknown()
    .describe("New value to set at the path (will be converted to JSONB)"),
  where: z.string().describe("WHERE clause to identify rows to update"),
  createMissing: z
    .boolean()
    .optional()
    .describe(
      "Create intermediate keys if path does not exist (default: true)",
    ),
});

// ============== CONTAINS SCHEMA ==============
export const JsonbContainsSchema = z.object({
  table: z.string().describe("Table name"),
  column: z.string().describe("JSONB column name"),
  value: z
    .unknown()
    .describe('JSON value to check if contained (e.g., {"status": "active"})'),
  select: z
    .array(z.string())
    .optional()
    .describe("Columns to select in result"),
  where: z.string().optional().describe("Additional WHERE clause filter"),
});

// ============== PATH QUERY SCHEMA ==============
export const JsonbPathQuerySchema = z.object({
  table: z.string().describe("Table name"),
  column: z.string().describe("JSONB column name"),
  path: z
    .string()
    .describe(
      'JSONPath expression (e.g., "$.items[*].name" or "$.* ? (@.price > 10)")',
    ),
  vars: z
    .record(z.string(), z.unknown())
    .optional()
    .describe("Variables for JSONPath (access with $var_name)"),
  where: z.string().optional().describe("WHERE clause"),
});

// ============== INSERT SCHEMA ==============
export const JsonbInsertSchema = z.object({
  table: z.string().describe("Table name"),
  column: z.string().describe("JSONB column name"),
  path: z
    .union([
      z.string().describe('Path as string (e.g., "tags.0")'),
      z.number().describe("Array index position (e.g., 0, -1)"),
      z
        .array(z.union([z.string(), z.number()]))
        .describe('Path as array (e.g., ["tags", 0])'),
    ])
    .describe(
      "Path to insert at (for arrays). Accepts both string and array formats.",
    ),
  value: z.unknown().describe("Value to insert"),
  where: z.string().describe("WHERE clause"),
  insertAfter: z
    .boolean()
    .optional()
    .describe("Insert after the specified position (default: false)"),
});

// ============== DELETE SCHEMA ==============
export const JsonbDeleteSchema = z.object({
  table: z.string().describe("Table name"),
  column: z.string().describe("JSONB column name"),
  path: z
    .union([
      z.string().describe("Key to delete (single key) or dot-notation path"),
      z.number().describe("Array index to delete (e.g., 0, 1, 2)"),
      z
        .array(z.union([z.string(), z.number()]))
        .describe('Path as array (e.g., ["nested", 0])'),
    ])
    .describe("Key or path to delete. Supports numeric indices for arrays."),
  where: z.string().describe("WHERE clause"),
});
