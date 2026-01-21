/**
 * postgres-mcp - Monitoring Tool Schemas
 *
 * Input validation schemas for database monitoring.
 */

import { z } from "zod";

// Helper to handle undefined params (allows tools to be called without {})
const defaultToEmpty = (val: unknown): unknown => val ?? {};

export const DatabaseSizeSchema = z.preprocess(
  defaultToEmpty,
  z.object({
    database: z
      .string()
      .optional()
      .describe("Database name (current if omitted)"),
  }),
);

export const TableSizesSchema = z.preprocess(
  defaultToEmpty,
  z.object({
    schema: z.string().optional().describe("Schema name"),
    limit: z.number().optional().describe("Max tables to return"),
  }),
);

export const ShowSettingsSchema = z.preprocess(
  defaultToEmpty,
  z
    .object({
      pattern: z
        .string()
        .optional()
        .describe("Setting name pattern (LIKE syntax with %)"),
      setting: z
        .string()
        .optional()
        .describe("Alias for pattern - setting name or pattern"),
      name: z
        .string()
        .optional()
        .describe("Alias for pattern - setting name or pattern"),
      limit: z
        .number()
        .optional()
        .describe(
          "Max settings to return (default: 50 when no pattern specified)",
        ),
    })
    .transform((data) => {
      // Resolve alias: setting or name → pattern
      const pattern = data.pattern ?? data.setting ?? data.name;
      // Default limit to 50 only when NO filter is specified (to avoid 415+ results)
      const limit = data.limit ?? (pattern === undefined ? 50 : undefined);
      return { pattern, limit };
    }),
);
