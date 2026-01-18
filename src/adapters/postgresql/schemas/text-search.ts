/**
 * postgres-mcp - Text Search Tool Schemas
 *
 * Input validation schemas for full-text search and pattern matching.
 */

import { z } from "zod";

export const TextSearchSchema = z.object({
  table: z.string().describe("Table name"),
  columns: z.array(z.string()).describe("Text columns to search"),
  query: z.string().describe("Search query"),
  config: z
    .string()
    .optional()
    .describe("Text search config (default: english)"),
  select: z.array(z.string()).optional().describe("Columns to return"),
  limit: z.number().optional().describe("Max results"),
});

export const TrigramSimilaritySchema = z.object({
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
});

export const RegexpMatchSchema = z.object({
  table: z.string().describe("Table name"),
  column: z.string().describe("Column to match"),
  pattern: z.string().describe("POSIX regex pattern"),
  flags: z.string().optional().describe("Regex flags (i, g, etc.)"),
  select: z.array(z.string()).optional().describe("Columns to return"),
  limit: z.number().optional().describe("Max results"),
});
