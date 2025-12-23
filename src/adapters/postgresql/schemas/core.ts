/**
 * postgres-mcp - Core Tool Schemas
 * 
 * Input validation schemas for core database operations.
 */

import { z } from 'zod';

// Helper to handle undefined params (allows tools to be called without {})
const defaultToEmpty = (val: unknown): unknown => val ?? {};

// =============================================================================
// Query Schemas
// =============================================================================

// Base schema for MCP visibility (shows both sql and query)
const ReadQuerySchemaBase = z.object({
    sql: z.string().optional().describe('SELECT query to execute'),
    query: z.string().optional().describe('Alias for sql'),
    params: z.array(z.unknown()).optional().describe('Query parameters ($1, $2, etc.)'),
    transactionId: z.string().optional().describe('Transaction ID to execute within (from pg_transaction_begin)'),
    txId: z.string().optional().describe('Alias for transactionId'),
    tx: z.string().optional().describe('Alias for transactionId')
});

// Transformed schema with alias resolution
export const ReadQuerySchema = ReadQuerySchemaBase.transform((data) => ({
    sql: data.sql ?? data.query ?? '',
    params: data.params,
    transactionId: data.transactionId ?? data.txId ?? data.tx
})).refine((data) => data.sql !== '', {
    message: 'sql (or query alias) is required'
});

// Base schema for MCP visibility (shows both sql and query)
const WriteQuerySchemaBase = z.object({
    sql: z.string().optional().describe('INSERT/UPDATE/DELETE query to execute'),
    query: z.string().optional().describe('Alias for sql'),
    params: z.array(z.unknown()).optional().describe('Query parameters ($1, $2, etc.)'),
    transactionId: z.string().optional().describe('Transaction ID to execute within (from pg_transaction_begin)'),
    txId: z.string().optional().describe('Alias for transactionId'),
    tx: z.string().optional().describe('Alias for transactionId')
});

// Transformed schema with alias resolution
export const WriteQuerySchema = WriteQuerySchemaBase.transform((data) => ({
    sql: data.sql ?? data.query ?? '',
    params: data.params,
    transactionId: data.transactionId ?? data.txId ?? data.tx
})).refine((data) => data.sql !== '', {
    message: 'sql (or query alias) is required'
});

// =============================================================================
// Table Schemas
// =============================================================================

/**
 * Preprocess table parameters:
 * - Alias: tableName/name → table
 * - Parse schema.table format (e.g., 'public.users' → schema: 'public', table: 'users')
 */
function preprocessTableParams(input: unknown): unknown {
    if (typeof input !== 'object' || input === null) return input;
    const result = { ...input as Record<string, unknown> };

    // Alias: tableName/name → table
    if (result['table'] === undefined) {
        if (result['tableName'] !== undefined) result['table'] = result['tableName'];
        else if (result['name'] !== undefined) result['table'] = result['name'];
    }

    // Parse schema.table format
    if (typeof result['table'] === 'string' && result['table'].includes('.') && result['schema'] === undefined) {
        const parts = result['table'].split('.');
        if (parts.length === 2) {
            result['schema'] = parts[0];
            result['table'] = parts[1];
        }
    }

    return result;
}

export const ListTablesSchema = z.preprocess(
    defaultToEmpty,
    z.object({
        schema: z.string().optional().describe('Schema name (default: all user schemas)')
    })
);

// Base schema for MCP visibility (shows both table and tableName)
const DescribeTableSchemaBase = z.object({
    table: z.string().optional().describe('Table name (supports schema.table format)'),
    tableName: z.string().optional().describe('Alias for table'),
    schema: z.string().optional().describe('Schema name (default: public)')
});

// Transformed schema with alias resolution and schema.table parsing
export const DescribeTableSchema = z.preprocess(
    preprocessTableParams,
    DescribeTableSchemaBase
).transform((data) => ({
    table: data.table ?? data.tableName ?? '',
    schema: data.schema
})).refine((data) => data.table !== '', {
    message: 'table (or tableName alias) is required'
});

// Base schema for MCP visibility
const CreateTableSchemaBase = z.object({
    name: z.string().optional().describe('Table name'),
    table: z.string().optional().describe('Alias for name'),
    schema: z.string().optional().describe('Schema name (default: public)'),
    columns: z.array(z.object({
        name: z.string(),
        type: z.string(),
        nullable: z.boolean().optional(),
        primaryKey: z.boolean().optional(),
        unique: z.boolean().optional(),
        default: z.string().optional(),
        references: z.object({
            table: z.string(),
            column: z.string(),
            onDelete: z.string().optional(),
            onUpdate: z.string().optional()
        }).optional()
    })).describe('Column definitions'),
    ifNotExists: z.boolean().optional().describe('Use IF NOT EXISTS')
});

// Transformed schema with alias resolution
export const CreateTableSchema = CreateTableSchemaBase.transform((data) => ({
    name: data.name ?? data.table ?? '',
    schema: data.schema,
    columns: data.columns,
    ifNotExists: data.ifNotExists
})).refine((data) => data.name !== '', {
    message: 'name (or table alias) is required'
}).refine((data) => data.columns.length > 0, {
    message: 'columns must not be empty'
});

// Base schema for MCP visibility
const DropTableSchemaBase = z.object({
    table: z.string().optional().describe('Table name (supports schema.table format)'),
    tableName: z.string().optional().describe('Alias for table'),
    name: z.string().optional().describe('Alias for table'),
    schema: z.string().optional().describe('Schema name (default: public)'),
    ifExists: z.boolean().optional().describe('Use IF EXISTS'),
    cascade: z.boolean().optional().describe('Use CASCADE')
});

// Transformed schema with alias resolution and schema.table parsing
export const DropTableSchema = z.preprocess(
    preprocessTableParams,
    DropTableSchemaBase
).transform((data) => ({
    table: data.table ?? data.tableName ?? data.name ?? '',
    schema: data.schema,
    ifExists: data.ifExists,
    cascade: data.cascade
})).refine((data) => data.table !== '', {
    message: 'table (or tableName/name alias) is required'
});

// =============================================================================
// Index Schemas
// =============================================================================

// Base schema for MCP visibility
const GetIndexesSchemaBase = z.object({
    table: z.string().optional().describe('Table name (supports schema.table format). Omit to list all indexes.'),
    tableName: z.string().optional().describe('Alias for table'),
    schema: z.string().optional().describe('Schema name (default: public)')
});

// Transformed schema with alias resolution and schema.table parsing
// Note: table is now optional - when omitted, lists all indexes in database
export const GetIndexesSchema = z.preprocess(
    (val: unknown) => {
        // First apply default empty object, then preprocess table params
        const result = preprocessTableParams(val ?? {});
        return result;
    },
    GetIndexesSchemaBase
).transform((data) => ({
    table: data.table ?? data.tableName,
    schema: data.schema
}));

/**
 * Preprocess create index params:
 * - Parse JSON-encoded columns array
 * - Handle single column string → array
 */
function preprocessCreateIndexParams(input: unknown): unknown {
    if (typeof input !== 'object' || input === null) return input;
    const result = { ...input as Record<string, unknown> };

    // Parse JSON-encoded columns array
    if (typeof result['columns'] === 'string') {
        try {
            const parsed: unknown = JSON.parse(result['columns']);
            if (Array.isArray(parsed) && parsed.every((item): item is string => typeof item === 'string')) {
                result['columns'] = parsed;
            }
        } catch {
            // Not JSON, might be single column - let schema handle it
        }
    }

    return result;
}

// Base schema for MCP visibility
const CreateIndexSchemaBase = z.object({
    name: z.string().optional().describe('Index name'),
    indexName: z.string().optional().describe('Alias for name'),
    table: z.string().describe('Table name'),
    schema: z.string().optional().describe('Schema name (default: public)'),
    columns: z.array(z.string()).optional().describe('Columns to index'),
    column: z.string().optional().describe('Single column (auto-wrapped to array)'),
    unique: z.boolean().optional().describe('Create a unique index'),
    type: z.enum(['btree', 'hash', 'gist', 'gin', 'spgist', 'brin']).optional().describe('Index type'),
    where: z.string().optional().describe('Partial index condition'),
    concurrently: z.boolean().optional().describe('Create index concurrently'),
    ifNotExists: z.boolean().optional().describe('Use IF NOT EXISTS (silently succeeds if index exists)')
});

// Transformed schema with alias resolution and preprocessing
export const CreateIndexSchema = z.preprocess(
    preprocessCreateIndexParams,
    CreateIndexSchemaBase
).transform((data) => {
    // Handle column → columns smoothing (wrap string in array)
    const columns = data.columns ?? (data.column ? [data.column] : []);

    // Auto-generate index name if not provided: idx_{table}_{columns}
    let name = data.name ?? data.indexName ?? '';
    if (name === '' && columns.length > 0) {
        name = `idx_${data.table}_${columns.join('_')}`;
    }

    return {
        name,
        table: data.table,
        schema: data.schema,
        columns,
        unique: data.unique,
        type: data.type,
        where: data.where,
        concurrently: data.concurrently,
        ifNotExists: data.ifNotExists
    };
}).refine((data) => data.name !== '', {
    message: 'name is required (or provide table and columns to auto-generate)'
}).refine((data) => data.columns.length > 0, {
    message: 'columns (or column alias) is required'
});

// =============================================================================
// Transaction Schemas
// =============================================================================

/**
 * Preprocess transaction begin params:
 * - Normalize isolationLevel case (serializable → SERIALIZABLE)
 * - Handle shorthand forms (ru → READ UNCOMMITTED, etc.)
 */
function preprocessBeginParams(input: unknown): unknown {
    const normalized = defaultToEmpty(input) as Record<string, unknown>;
    if (typeof normalized['isolationLevel'] === 'string') {
        const level = normalized['isolationLevel'].toUpperCase().trim();
        // Map shorthands
        const levelMap: Record<string, string> = {
            'RU': 'READ UNCOMMITTED',
            'RC': 'READ COMMITTED',
            'RR': 'REPEATABLE READ',
            'S': 'SERIALIZABLE',
            'READUNCOMMITTED': 'READ UNCOMMITTED',
            'READCOMMITTED': 'READ COMMITTED',
            'REPEATABLEREAD': 'REPEATABLE READ'
        };
        normalized['isolationLevel'] = levelMap[level.replace(/\s+/g, '')] ?? level;
    }
    return normalized;
}

export const BeginTransactionSchema = z.preprocess(
    preprocessBeginParams,
    z.object({
        isolationLevel: z.enum([
            'READ UNCOMMITTED',
            'READ COMMITTED',
            'REPEATABLE READ',
            'SERIALIZABLE'
        ]).optional().describe('Transaction isolation level')
    })
);

// Base schema for MCP visibility (shows transactionId and aliases)
export const TransactionIdSchemaBase = z.object({
    transactionId: z.string().optional().describe('Transaction ID from pg_transaction_begin'),
    txId: z.string().optional().describe('Alias for transactionId'),
    tx: z.string().optional().describe('Alias for transactionId')
});

// Transformed schema with alias resolution and undefined handling
export const TransactionIdSchema = z.preprocess(
    defaultToEmpty,
    TransactionIdSchemaBase
).transform((data) => ({
    transactionId: data.transactionId ?? data.txId ?? data.tx ?? ''
})).refine((data) => data.transactionId !== '', {
    message: 'transactionId is required. Get one from pg_transaction_begin first, then pass {transactionId: "..."}'
});

// Base schema for MCP visibility
export const SavepointSchemaBase = z.object({
    transactionId: z.string().optional().describe('Transaction ID'),
    txId: z.string().optional().describe('Alias for transactionId'),
    tx: z.string().optional().describe('Alias for transactionId'),
    name: z.string().optional().describe('Savepoint name'),
    savepoint: z.string().optional().describe('Alias for name')
});

// Transformed schema with alias resolution and undefined handling
export const SavepointSchema = z.preprocess(
    defaultToEmpty,
    SavepointSchemaBase
).transform((data) => ({
    transactionId: data.transactionId ?? data.txId ?? data.tx ?? '',
    name: data.name ?? data.savepoint ?? ''
})).refine((data) => data.transactionId !== '' && data.name !== '', {
    message: 'Both transactionId and name are required. Example: {transactionId: "...", name: "sp1"}'
}).refine((data) => data.name === '' || /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(data.name), {
    message: 'Savepoint name must be a valid SQL identifier (letters, numbers, underscores only)'
});

// Base schema for MCP visibility
const ExecuteInTransactionSchemaBase = z.object({
    transactionId: z.string().optional().describe('Transaction ID'),
    txId: z.string().optional().describe('Alias for transactionId'),
    tx: z.string().optional().describe('Alias for transactionId'),
    sql: z.string().describe('SQL to execute'),
    params: z.array(z.unknown()).optional().describe('Query parameters')
});

// Transformed schema with alias resolution
export const ExecuteInTransactionSchema = ExecuteInTransactionSchemaBase.transform((data) => ({
    transactionId: data.transactionId ?? data.txId ?? data.tx ?? '',
    sql: data.sql,
    params: data.params
})).refine((data) => data.transactionId !== '', {
    message: 'transactionId (or txId/tx alias) is required'
});

// Base schema for MCP visibility (pg_transaction_execute)
export const TransactionExecuteSchemaBase = z.object({
    statements: z.array(z.object({
        sql: z.string().describe('SQL statement to execute'),
        params: z.array(z.unknown()).optional().describe('Query parameters')
    })).optional().describe('Statements to execute atomically. Each must be an object with {sql: "..."} format.'),
    isolationLevel: z.string().optional().describe('Transaction isolation level')
});

// Schema with undefined handling for pg_transaction_execute
export const TransactionExecuteSchema = z.preprocess(
    defaultToEmpty,
    TransactionExecuteSchemaBase
).transform((data) => ({
    statements: data.statements ?? [],
    isolationLevel: data.isolationLevel
})).refine((data) => data.statements.length > 0, {
    message: 'statements is required. Format: {statements: [{sql: "INSERT INTO..."}, {sql: "UPDATE..."}]}. Each statement must be an object with "sql" property, not a raw string.'
});
