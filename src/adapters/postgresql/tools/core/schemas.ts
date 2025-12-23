/**
 * PostgreSQL Core Tools - Additional Schemas
 * 
 * Schemas that are defined in core tools but not in the main schemas directory.
 */

import { z } from 'zod';

// Helper to handle undefined params (allows tools to be called without {})
const defaultToEmpty = (val: unknown): unknown => val ?? {};

export const ListObjectsSchema = z.preprocess(
    defaultToEmpty,
    z.object({
        schema: z.string().optional().describe('Schema name (default: all user schemas)'),
        types: z.array(z.enum(['table', 'view', 'materialized_view', 'function', 'procedure', 'sequence', 'index', 'trigger'])).optional().describe('Object types to include')
    })
);

export const ObjectDetailsSchema = z.preprocess(
    (val: unknown) => {
        const obj = (val ?? {}) as Record<string, unknown>;
        // Support 'table' as alias for 'name'
        if (obj['table'] !== undefined && obj['name'] === undefined) {
            obj['name'] = obj['table'];
        }
        // Normalize 'type' to lowercase for case-insensitivity
        if (typeof obj['type'] === 'string') {
            obj['type'] = obj['type'].toLowerCase();
        }
        return obj;
    },
    z.object({
        name: z.string().describe('Object name'),
        schema: z.string().optional().describe('Schema name (default: public)'),
        type: z.enum(['table', 'view', 'function', 'sequence', 'index']).optional().describe('Object type hint (case-insensitive)')
    })
);

export const AnalyzeDbHealthSchema = z.preprocess(
    defaultToEmpty,
    z.object({
        includeIndexes: z.boolean().optional().describe('Include index health analysis'),
        includeVacuum: z.boolean().optional().describe('Include vacuum/bloat analysis'),
        includeConnections: z.boolean().optional().describe('Include connection analysis')
    })
);

export const AnalyzeWorkloadIndexesSchema = z.preprocess(
    defaultToEmpty,
    z.object({
        topQueries: z.number().optional().describe('Number of top queries to analyze (default: 20)'),
        minCalls: z.number().optional().describe('Minimum call count threshold')
    })
);

// Base schema for MCP visibility
const AnalyzeQueryIndexesSchemaBase = z.object({
    sql: z.string().optional().describe('Query to analyze for index recommendations'),
    query: z.string().optional().describe('Alias for sql'),
    params: z.array(z.unknown()).optional().describe('Query parameters')
});

// Transformed schema with alias resolution
export const AnalyzeQueryIndexesSchema = AnalyzeQueryIndexesSchemaBase.transform((data) => ({
    sql: data.sql ?? data.query ?? '',
    params: data.params
})).refine((data) => data.sql !== '', {
    message: 'sql (or query alias) is required'
});

