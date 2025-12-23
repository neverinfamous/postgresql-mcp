/**
 * postgres-mcp - Admin Tool Schemas
 * 
 * Input validation schemas for database administration operations.
 * 
 * DUAL-SCHEMA PATTERN:
 * Base schemas (*SchemaBase) are exported for MCP visibility (shows parameters).
 * Preprocess schemas (*Schema) are used by handlers for validation + alias resolution.
 */

import { z } from 'zod';

// Helper to handle undefined params (allows tools to be called without {})
const defaultToEmpty = (val: unknown): unknown => val ?? {};

// ============== VACUUM SCHEMA ==============
// Base schema for MCP visibility
export const VacuumSchemaBase = z.object({
    table: z.string().optional().describe('Table name (all tables if omitted)'),
    schema: z.string().optional().describe('Schema name'),
    full: z.boolean().optional().describe('Full vacuum (rewrites table)'),
    analyze: z.boolean().optional().describe('Update statistics'),
    verbose: z.boolean().optional().describe('Print progress')
});

// Preprocess schema for handlers (accepts no-args)
export const VacuumSchema = z.preprocess(defaultToEmpty, VacuumSchemaBase);

// ============== ANALYZE SCHEMA ==============
// Base schema for MCP visibility
export const AnalyzeSchemaBase = z.object({
    table: z.string().optional().describe('Table name (all tables if omitted)'),
    schema: z.string().optional().describe('Schema name'),
    columns: z.array(z.string()).optional().describe('Specific columns to analyze')
});

// Preprocess schema for handlers (accepts no-args)
export const AnalyzeSchema = z.preprocess(defaultToEmpty, AnalyzeSchemaBase);

// ============== REINDEX SCHEMA ==============
/**
 * Preprocess reindex parameters:
 * - Alias: tableName/table/indexName → name
 */
function preprocessReindexParams(input: unknown): unknown {
    if (typeof input !== 'object' || input === null) {
        return input;
    }
    const result = { ...input as Record<string, unknown> };
    // Alias: tableName → name
    if (result['tableName'] !== undefined && result['name'] === undefined) {
        result['name'] = result['tableName'];
    }
    // Alias: table → name (when target is 'table')
    if (result['table'] !== undefined && result['name'] === undefined) {
        result['name'] = result['table'];
    }
    // Alias: indexName → name (when target is 'index')
    if (result['indexName'] !== undefined && result['name'] === undefined) {
        result['name'] = result['indexName'];
    }
    return result;
}

// Base schema for MCP visibility (shows all parameters including aliases)
export const ReindexSchemaBase = z.object({
    target: z.enum(['table', 'index', 'schema', 'database']).describe('What to reindex'),
    name: z.string().optional().describe('Name of table/index/schema (defaults to current database when target is database)'),
    table: z.string().optional().describe('Alias for name (when target is table)'),
    tableName: z.string().optional().describe('Alias for name'),
    indexName: z.string().optional().describe('Alias for name (when target is index)'),
    concurrently: z.boolean().optional().describe('Reindex concurrently')
});

// Preprocess schema for handlers (resolves aliases, name is now optional for database target)
export const ReindexSchema = z.preprocess(
    preprocessReindexParams,
    z.object({
        target: z.enum(['table', 'index', 'schema', 'database']).describe('What to reindex'),
        name: z.string().optional().describe('Name of table/index/schema (defaults to current database when target is database)'),
        concurrently: z.boolean().optional().describe('Reindex concurrently')
    })
).refine((data) => {
    // name is required for table, index, and schema targets
    const parsed = data as { target: string; name?: string };
    if (parsed.target !== 'database' && parsed.name === undefined) {
        return false;
    }
    return true;
}, {
    message: 'name is required when target is table, index, or schema'
});

// ============== TERMINATE/CANCEL BACKEND SCHEMAS ==============
/**
 * Preprocess backend PID parameters:
 * - Alias: processId → pid
 */
function preprocessPidParams(input: unknown): unknown {
    if (typeof input !== 'object' || input === null) {
        return input;
    }
    const result = { ...input as Record<string, unknown> };
    // Alias: processId → pid
    if (result['processId'] !== undefined && result['pid'] === undefined) {
        result['pid'] = result['processId'];
    }
    return result;
}

// Base schema for MCP visibility (shows pid and alias)
export const TerminateBackendSchemaBase = z.object({
    pid: z.number().optional().describe('Process ID to terminate'),
    processId: z.number().optional().describe('Alias for pid')
});

// Preprocess schema for handlers
export const TerminateBackendSchema = z.preprocess(
    preprocessPidParams,
    z.object({
        pid: z.number().describe('Process ID to terminate')
    })
);

// Base schema for MCP visibility (shows pid and alias)
export const CancelBackendSchemaBase = z.object({
    pid: z.number().optional().describe('Process ID to cancel'),
    processId: z.number().optional().describe('Alias for pid')
});

// Preprocess schema for handlers
export const CancelBackendSchema = z.preprocess(
    preprocessPidParams,
    z.object({
        pid: z.number().describe('Process ID to cancel')
    })
);
