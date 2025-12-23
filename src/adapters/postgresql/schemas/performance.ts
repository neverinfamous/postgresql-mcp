/**
 * postgres-mcp - Performance Tool Schemas
 * 
 * Input validation schemas for query analysis and performance monitoring.
 */

import { z } from 'zod';

// Helper to handle undefined params (allows tools to be called without {})
const defaultToEmpty = (val: unknown): unknown => val ?? {};

// Base schema for MCP visibility
const ExplainSchemaBase = z.object({
    sql: z.string().optional().describe('Query to explain'),
    query: z.string().optional().describe('Alias for sql'),
    params: z.array(z.unknown()).optional().describe('Query parameters'),
    analyze: z.boolean().optional().describe('Run EXPLAIN ANALYZE'),
    buffers: z.boolean().optional().describe('Include buffer usage'),
    format: z.enum(['text', 'json', 'xml', 'yaml']).optional().describe('Output format')
});

// Transformed schema with alias resolution
export const ExplainSchema = ExplainSchemaBase.transform((data) => ({
    sql: data.sql ?? data.query ?? '',
    params: data.params,
    analyze: data.analyze,
    buffers: data.buffers,
    format: data.format
})).refine((data) => data.sql !== '', {
    message: 'sql (or query alias) is required'
});

export const IndexStatsSchema = z.preprocess(
    defaultToEmpty,
    z.object({
        table: z.string().optional().describe('Table name (all tables if omitted)'),
        schema: z.string().optional().describe('Schema name')
    })
);

export const TableStatsSchema = z.preprocess(
    defaultToEmpty,
    z.object({
        table: z.string().optional().describe('Table name (all tables if omitted)'),
        schema: z.string().optional().describe('Schema name')
    })
);

