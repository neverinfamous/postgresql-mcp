/**
 * postgres-mcp - PostgreSQL Zod Schemas
 * 
 * Input validation schemas for all PostgreSQL tools.
 */

import { z } from 'zod';

// =============================================================================
// Core Tool Schemas
// =============================================================================

export const ReadQuerySchema = z.object({
    sql: z.string().describe('SELECT query to execute'),
    params: z.array(z.unknown()).optional().describe('Query parameters ($1, $2, etc.)')
});

export const WriteQuerySchema = z.object({
    sql: z.string().describe('INSERT/UPDATE/DELETE query to execute'),
    params: z.array(z.unknown()).optional().describe('Query parameters ($1, $2, etc.)')
});

export const ListTablesSchema = z.object({
    schema: z.string().optional().describe('Schema name (default: all user schemas)')
});

export const DescribeTableSchema = z.object({
    table: z.string().describe('Table name'),
    schema: z.string().optional().describe('Schema name (default: public)')
});

export const CreateTableSchema = z.object({
    name: z.string().describe('Table name'),
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

export const DropTableSchema = z.object({
    table: z.string().describe('Table name'),
    schema: z.string().optional().describe('Schema name (default: public)'),
    ifExists: z.boolean().optional().describe('Use IF EXISTS'),
    cascade: z.boolean().optional().describe('Use CASCADE')
});

export const GetIndexesSchema = z.object({
    table: z.string().describe('Table name'),
    schema: z.string().optional().describe('Schema name (default: public)')
});

export const CreateIndexSchema = z.object({
    name: z.string().describe('Index name'),
    table: z.string().describe('Table name'),
    schema: z.string().optional().describe('Schema name (default: public)'),
    columns: z.array(z.string()).describe('Columns to index'),
    unique: z.boolean().optional().describe('Create a unique index'),
    type: z.enum(['btree', 'hash', 'gist', 'gin', 'spgist', 'brin']).optional().describe('Index type'),
    where: z.string().optional().describe('Partial index condition'),
    concurrently: z.boolean().optional().describe('Create index concurrently')
});

// =============================================================================
// Transaction Schemas
// =============================================================================

export const BeginTransactionSchema = z.object({
    isolationLevel: z.enum([
        'READ UNCOMMITTED',
        'READ COMMITTED',
        'REPEATABLE READ',
        'SERIALIZABLE'
    ]).optional().describe('Transaction isolation level')
});

export const TransactionIdSchema = z.object({
    transactionId: z.string().describe('Transaction ID from pg_transaction_begin')
});

export const SavepointSchema = z.object({
    transactionId: z.string().describe('Transaction ID'),
    name: z.string().describe('Savepoint name')
});

export const ExecuteInTransactionSchema = z.object({
    transactionId: z.string().describe('Transaction ID'),
    sql: z.string().describe('SQL to execute'),
    params: z.array(z.unknown()).optional().describe('Query parameters')
});

export const TransactionExecuteSchema = z.object({
    statements: z.array(z.object({
        sql: z.string(),
        params: z.array(z.unknown()).optional()
    })).describe('Statements to execute atomically'),
    isolationLevel: z.string().optional().describe('Transaction isolation level')
});

// =============================================================================
// JSONB Schemas
// =============================================================================

export const JsonbExtractSchema = z.object({
    table: z.string().describe('Table name'),
    column: z.string().describe('JSONB column name'),
    path: z.string().describe('JSON path (e.g., "$.key" or "{key,subkey}")'),
    where: z.string().optional().describe('WHERE clause')
});

export const JsonbSetSchema = z.object({
    table: z.string().describe('Table name'),
    column: z.string().describe('JSONB column name'),
    path: z.array(z.string()).describe('Path as array of keys'),
    value: z.unknown().describe('Value to set (will be converted to JSONB)'),
    where: z.string().describe('WHERE clause to identify rows'),
    createMissing: z.boolean().optional().describe('Create path if missing')
});

export const JsonbContainsSchema = z.object({
    table: z.string().describe('Table name'),
    column: z.string().describe('JSONB column name'),
    value: z.unknown().describe('Value to check containment'),
    select: z.array(z.string()).optional().describe('Columns to select')
});

export const JsonbPathQuerySchema = z.object({
    table: z.string().describe('Table name'),
    column: z.string().describe('JSONB column name'),
    path: z.string().describe('JSONPath expression'),
    vars: z.record(z.string(), z.unknown()).optional().describe('Variables for JSONPath'),
    where: z.string().optional().describe('WHERE clause')
});

// =============================================================================
// Text/FTS Schemas
// =============================================================================

export const TextSearchSchema = z.object({
    table: z.string().describe('Table name'),
    columns: z.array(z.string()).describe('Text columns to search'),
    query: z.string().describe('Search query'),
    config: z.string().optional().describe('Text search config (default: english)'),
    select: z.array(z.string()).optional().describe('Columns to return'),
    limit: z.number().optional().describe('Max results')
});

export const TrigramSimilaritySchema = z.object({
    table: z.string().describe('Table name'),
    column: z.string().describe('Column to compare'),
    value: z.string().describe('Value to compare against'),
    threshold: z.number().optional().describe('Similarity threshold (0-1)'),
    limit: z.number().optional().describe('Max results')
});

export const RegexpMatchSchema = z.object({
    table: z.string().describe('Table name'),
    column: z.string().describe('Column to match'),
    pattern: z.string().describe('POSIX regex pattern'),
    flags: z.string().optional().describe('Regex flags (i, g, etc.)'),
    select: z.array(z.string()).optional().describe('Columns to return')
});

// =============================================================================
// Performance Schemas
// =============================================================================

export const ExplainSchema = z.object({
    sql: z.string().describe('Query to explain'),
    params: z.array(z.unknown()).optional().describe('Query parameters'),
    analyze: z.boolean().optional().describe('Run EXPLAIN ANALYZE'),
    buffers: z.boolean().optional().describe('Include buffer usage'),
    format: z.enum(['text', 'json', 'xml', 'yaml']).optional().describe('Output format')
});

export const IndexStatsSchema = z.object({
    table: z.string().optional().describe('Table name (all tables if omitted)'),
    schema: z.string().optional().describe('Schema name')
});

export const TableStatsSchema = z.object({
    table: z.string().optional().describe('Table name (all tables if omitted)'),
    schema: z.string().optional().describe('Schema name')
});

// =============================================================================
// Admin Schemas
// =============================================================================

export const VacuumSchema = z.object({
    table: z.string().optional().describe('Table name (all tables if omitted)'),
    schema: z.string().optional().describe('Schema name'),
    full: z.boolean().optional().describe('Full vacuum (rewrites table)'),
    analyze: z.boolean().optional().describe('Update statistics'),
    verbose: z.boolean().optional().describe('Print progress')
});

export const AnalyzeSchema = z.object({
    table: z.string().optional().describe('Table name (all tables if omitted)'),
    schema: z.string().optional().describe('Schema name'),
    columns: z.array(z.string()).optional().describe('Specific columns to analyze')
});

export const ReindexSchema = z.object({
    target: z.enum(['table', 'index', 'schema', 'database']).describe('What to reindex'),
    name: z.string().describe('Name of table/index/schema'),
    concurrently: z.boolean().optional().describe('Reindex concurrently')
});

export const TerminateBackendSchema = z.object({
    pid: z.number().describe('Process ID to terminate')
});

export const CancelBackendSchema = z.object({
    pid: z.number().describe('Process ID to cancel')
});

// =============================================================================
// Monitoring Schemas
// =============================================================================

export const DatabaseSizeSchema = z.object({
    database: z.string().optional().describe('Database name (current if omitted)')
});

export const TableSizesSchema = z.object({
    schema: z.string().optional().describe('Schema name'),
    limit: z.number().optional().describe('Max tables to return')
});

export const ShowSettingsSchema = z.object({
    pattern: z.string().optional().describe('Setting name pattern (LIKE)')
});

// =============================================================================
// Backup Schemas
// =============================================================================

export const CopyExportSchema = z.object({
    query: z.string().describe('SELECT query for data to export'),
    format: z.enum(['csv', 'text', 'binary']).optional().describe('Output format'),
    header: z.boolean().optional().describe('Include header row'),
    delimiter: z.string().optional().describe('Field delimiter')
});

export const DumpSchemaSchema = z.object({
    table: z.string().optional().describe('Table name'),
    schema: z.string().optional().describe('Schema name')
});

// =============================================================================
// Schema Management Schemas
// =============================================================================

export const CreateSchemaSchema = z.object({
    name: z.string().describe('Schema name'),
    authorization: z.string().optional().describe('Owner role'),
    ifNotExists: z.boolean().optional().describe('Use IF NOT EXISTS')
});

export const DropSchemaSchema = z.object({
    name: z.string().describe('Schema name'),
    cascade: z.boolean().optional().describe('Drop objects in schema'),
    ifExists: z.boolean().optional().describe('Use IF EXISTS')
});

export const CreateSequenceSchema = z.object({
    name: z.string().describe('Sequence name'),
    schema: z.string().optional().describe('Schema name'),
    start: z.number().optional().describe('Start value'),
    increment: z.number().optional().describe('Increment'),
    minValue: z.number().optional().describe('Minimum value'),
    maxValue: z.number().optional().describe('Maximum value'),
    cycle: z.boolean().optional().describe('Cycle when limit reached')
});

export const CreateViewSchema = z.object({
    name: z.string().describe('View name'),
    schema: z.string().optional().describe('Schema name'),
    query: z.string().describe('SELECT query for view'),
    materialized: z.boolean().optional().describe('Create materialized view'),
    orReplace: z.boolean().optional().describe('Replace if exists')
});

// =============================================================================
// Vector (pgvector) Schemas
// =============================================================================

export const VectorSearchSchema = z.object({
    table: z.string().describe('Table name'),
    column: z.string().describe('Vector column name'),
    vector: z.array(z.number()).describe('Query vector'),
    metric: z.enum(['l2', 'cosine', 'inner_product']).optional().describe('Distance metric'),
    limit: z.number().optional().describe('Number of results'),
    select: z.array(z.string()).optional().describe('Additional columns to return'),
    where: z.string().optional().describe('Filter condition')
});

export const VectorCreateIndexSchema = z.object({
    table: z.string().describe('Table name'),
    column: z.string().describe('Vector column name'),
    type: z.enum(['ivfflat', 'hnsw']).describe('Index type'),
    lists: z.number().optional().describe('Number of lists for IVFFlat'),
    m: z.number().optional().describe('HNSW m parameter'),
    efConstruction: z.number().optional().describe('HNSW ef_construction parameter')
});

// =============================================================================
// PostGIS Schemas
// =============================================================================

export const GeometryDistanceSchema = z.object({
    table: z.string().describe('Table name'),
    column: z.string().describe('Geometry column'),
    point: z.object({
        lat: z.number(),
        lng: z.number()
    }).describe('Reference point'),
    limit: z.number().optional().describe('Max results'),
    maxDistance: z.number().optional().describe('Max distance in meters')
});

export const PointInPolygonSchema = z.object({
    table: z.string().describe('Table with polygons'),
    column: z.string().describe('Geometry column'),
    point: z.object({
        lat: z.number(),
        lng: z.number()
    }).describe('Point to check')
});

export const SpatialIndexSchema = z.object({
    table: z.string().describe('Table name'),
    column: z.string().describe('Geometry column'),
    name: z.string().optional().describe('Index name')
});

// =============================================================================
// Partitioning Schemas
// =============================================================================

export const CreatePartitionedTableSchema = z.object({
    name: z.string().describe('Table name'),
    schema: z.string().optional().describe('Schema name'),
    columns: z.array(z.object({
        name: z.string(),
        type: z.string(),
        nullable: z.boolean().optional()
    })).describe('Column definitions'),
    partitionBy: z.enum(['range', 'list', 'hash']).describe('Partition strategy'),
    partitionKey: z.string().describe('Partition key column(s)')
});

export const CreatePartitionSchema = z.object({
    parent: z.string().describe('Parent table name'),
    name: z.string().describe('Partition name'),
    schema: z.string().optional().describe('Schema name'),
    forValues: z.string().describe('Partition bounds (e.g., "FROM (\'2024-01-01\') TO (\'2024-02-01\')")')
});

export const AttachPartitionSchema = z.object({
    parent: z.string().describe('Parent table name'),
    partition: z.string().describe('Table to attach'),
    forValues: z.string().describe('Partition bounds')
});

export const DetachPartitionSchema = z.object({
    parent: z.string().describe('Parent table name'),
    partition: z.string().describe('Partition to detach'),
    concurrently: z.boolean().optional().describe('Detach concurrently')
});

// =============================================================================
// pg_cron Schemas
// =============================================================================

/**
 * Schedule for cron jobs. Supports:
 * - Standard cron: "0 10 * * *" (daily at 10:00)
 * - Interval: "30 seconds" (every 30 seconds)
 * - Special: "0 12 $ * *" (noon on last day of month)
 */
export const CronScheduleSchema = z.object({
    schedule: z.string().describe('Cron schedule expression (e.g., "0 10 * * *" or "30 seconds")'),
    command: z.string().describe('SQL command to execute'),
    jobName: z.string().optional().describe('Optional unique name for the job')
});

export const CronScheduleInDatabaseSchema = z.object({
    jobName: z.string().describe('Unique name for the job'),
    schedule: z.string().describe('Cron schedule expression'),
    command: z.string().describe('SQL command to execute'),
    database: z.string().describe('Target database name'),
    username: z.string().optional().describe('User to run the job as'),
    active: z.boolean().optional().describe('Whether the job is active (default: true)')
});

export const CronUnscheduleSchema = z.object({
    jobId: z.number().optional().describe('Job ID to remove'),
    jobName: z.string().optional().describe('Job name to remove')
}).refine(
    data => data.jobId !== undefined || data.jobName !== undefined,
    { message: 'Either jobId or jobName must be provided' }
);

export const CronAlterJobSchema = z.object({
    jobId: z.number().describe('Job ID to modify'),
    schedule: z.string().optional().describe('New cron schedule'),
    command: z.string().optional().describe('New SQL command'),
    database: z.string().optional().describe('New target database'),
    username: z.string().optional().describe('New username'),
    active: z.boolean().optional().describe('Enable/disable the job')
});

export const CronJobRunDetailsSchema = z.object({
    jobId: z.number().optional().describe('Filter by job ID'),
    status: z.enum(['running', 'succeeded', 'failed']).optional().describe('Filter by status'),
    limit: z.number().optional().describe('Maximum records to return (default: 100)')
});

export const CronCleanupHistorySchema = z.object({
    olderThanDays: z.number().optional().describe('Delete records older than N days (default: 7)'),
    jobId: z.number().optional().describe('Clean up only for specific job')
});
