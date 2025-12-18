/**
 * postgres-mcp - PostgreSQL Adapter
 * 
 * Main PostgreSQL database adapter with connection pooling,
 * query execution, and tool registration.
 */

import type { PoolClient } from 'pg';
import { DatabaseAdapter } from '../DatabaseAdapter.js';
import { ConnectionPool } from '../../pool/ConnectionPool.js';
import type {
    DatabaseConfig,
    QueryResult,
    SchemaInfo,
    TableInfo,
    ColumnInfo,
    IndexInfo,
    HealthStatus,
    AdapterCapabilities,
    ToolDefinition,
    ResourceDefinition,
    PromptDefinition,
    ToolGroup
} from '../../types/index.js';
import { ConnectionError, QueryError, TransactionError } from '../../types/index.js';
import { logger } from '../../utils/logger.js';

// Import tool modules (will be created next)
import { getCoreTools } from './tools/core/index.js';
import { getTransactionTools } from './tools/transactions.js';
import { getJsonbTools } from './tools/jsonb/index.js';
import { getTextTools } from './tools/text.js';
import { getPerformanceTools } from './tools/performance/index.js';
import { getAdminTools } from './tools/admin.js';
import { getMonitoringTools } from './tools/monitoring.js';
import { getBackupTools } from './tools/backup/index.js';
import { getSchemaTools } from './tools/schema.js';
import { getVectorTools } from './tools/vector/index.js';
import { getPostgisTools } from './tools/postgis/index.js';
import { getPartitioningTools } from './tools/partitioning.js';
import { getStatsTools } from './tools/stats/index.js';
import { getCronTools } from './tools/cron.js';
import { getPartmanTools } from './tools/partman/index.js';
import { getKcacheTools } from './tools/kcache.js';
import { getCitextTools } from './tools/citext.js';
import { getLtreeTools } from './tools/ltree.js';
import { getPgcryptoTools } from './tools/pgcrypto.js';
import { getCodeModeTools } from './tools/codemode/index.js';
import { getPostgresResources } from './resources/index.js';
import { getPostgresPrompts } from './prompts/index.js';

/**
 * PostgreSQL Database Adapter
 */
/**
 * Metadata cache entry with TTL support
 */
interface CacheEntry<T> {
    data: T;
    timestamp: number;
}

/**
 * Default cache TTL in milliseconds (configurable via CACHE_TTL_MS env var)
 */
const DEFAULT_CACHE_TTL_MS = parseInt(process.env['METADATA_CACHE_TTL_MS'] ?? '30000', 10);

export class PostgresAdapter extends DatabaseAdapter {
    readonly type = 'postgresql' as const;
    readonly name = 'PostgreSQL Adapter';
    readonly version = '0.1.0';

    private pool: ConnectionPool | null = null;
    private activeTransactions = new Map<string, PoolClient>();

    // Performance optimization: cache tool definitions (immutable after creation)
    private cachedToolDefinitions: ToolDefinition[] | null = null;

    // Performance optimization: cache metadata with TTL
    private metadataCache = new Map<string, CacheEntry<unknown>>();
    private cacheTtlMs = DEFAULT_CACHE_TTL_MS;

    /**
     * Get cached value if not expired
     */
    private getCached(key: string): unknown {
        const entry = this.metadataCache.get(key);
        if (!entry) return undefined;
        if (Date.now() - entry.timestamp > this.cacheTtlMs) {
            this.metadataCache.delete(key);
            return undefined;
        }
        return entry.data;
    }

    /**
     * Set cache value
     */
    private setCache(key: string, data: unknown): void {
        this.metadataCache.set(key, { data, timestamp: Date.now() });
    }

    /**
     * Clear all cached metadata (useful after schema changes)
     */
    clearMetadataCache(): void {
        this.metadataCache.clear();
    }

    // =========================================================================
    // Connection Lifecycle
    // =========================================================================

    async connect(config: DatabaseConfig): Promise<void> {
        if (this.connected) {
            logger.warn('Already connected');
            return;
        }

        // Build pool configuration
        const poolConfig = {
            host: config.host ?? 'localhost',
            port: config.port ?? 5432,
            user: config.username ?? 'postgres',
            password: config.password ?? '',
            database: config.database ?? 'postgres',
            pool: config.pool,
            ssl: config.options?.ssl as boolean | undefined,
            statementTimeout: config.options?.statementTimeout,
            applicationName: config.options?.applicationName ?? 'postgres-mcp'
        };

        this.pool = new ConnectionPool(poolConfig);

        try {
            await this.pool.initialize();
            this.connected = true;
            logger.info('PostgreSQL adapter connected', {
                host: poolConfig.host,
                port: poolConfig.port,
                database: poolConfig.database
            });
        } catch (error) {
            this.pool = null;
            throw new ConnectionError(`Failed to connect: ${String(error)}`);
        }
    }

    async disconnect(): Promise<void> {
        if (!this.connected || !this.pool) {
            return;
        }

        // Close any active transactions
        for (const [id, client] of this.activeTransactions) {
            try {
                await client.query('ROLLBACK');
                client.release();
                logger.warn(`Rolled back orphaned transaction: ${id}`);
            } catch {
                // Ignore errors during cleanup
            }
        }
        this.activeTransactions.clear();

        await this.pool.shutdown();
        this.pool = null;
        this.connected = false;
        logger.info('PostgreSQL adapter disconnected');
    }

    async getHealth(): Promise<HealthStatus> {
        if (!this.pool) {
            return {
                connected: false,
                error: 'Not connected'
            };
        }

        return this.pool.checkHealth();
    }

    // =========================================================================
    // Query Execution
    // =========================================================================

    async executeReadQuery(sql: string, params?: unknown[]): Promise<QueryResult> {
        this.validateQuery(sql, true);
        return this.executeQuery(sql, params);
    }

    async executeWriteQuery(sql: string, params?: unknown[]): Promise<QueryResult> {
        this.validateQuery(sql, false);
        return this.executeQuery(sql, params);
    }

    async executeQuery(sql: string, params?: unknown[]): Promise<QueryResult> {
        if (!this.pool) {
            throw new ConnectionError('Not connected to database');
        }

        const startTime = Date.now();

        try {
            const result = await this.pool.query(sql, params);
            const executionTimeMs = Date.now() - startTime;

            return {
                rows: result.rows,
                rowsAffected: result.rowCount ?? undefined,
                command: result.command,
                executionTimeMs,
                fields: result.fields?.map(f => ({
                    name: f.name,
                    tableID: f.tableID,
                    columnID: f.columnID,
                    dataTypeID: f.dataTypeID,
                    dataTypeSize: f.dataTypeSize,
                    dataTypeModifier: f.dataTypeModifier,
                    format: f.format
                }))
            };
        } catch (error) {
            const err = error as Error;
            throw new QueryError(`Query failed: ${err.message}`, { sql });
        }
    }

    /**
     * Execute a query on a specific connection (for transactions)
     */
    async executeOnConnection(
        client: PoolClient,
        sql: string,
        params?: unknown[]
    ): Promise<QueryResult> {
        const startTime = Date.now();

        try {
            const result = await client.query(sql, params);
            const executionTimeMs = Date.now() - startTime;

            return {
                rows: result.rows as Record<string, unknown>[],
                rowsAffected: result.rowCount ?? undefined,
                command: result.command,
                executionTimeMs
            };
        } catch (error) {
            const err = error as Error;
            throw new QueryError(`Query failed: ${err.message}`, { sql });
        }
    }

    // =========================================================================
    // Transaction Support
    // =========================================================================

    /**
     * Begin a transaction
     */
    async beginTransaction(isolationLevel?: string): Promise<string> {
        if (!this.pool) {
            throw new ConnectionError('Not connected');
        }

        const client = await this.pool.getConnection();
        const transactionId = crypto.randomUUID();

        try {
            let beginCmd = 'BEGIN';
            if (isolationLevel) {
                beginCmd = `BEGIN ISOLATION LEVEL ${isolationLevel}`;
            }
            await client.query(beginCmd);
            this.activeTransactions.set(transactionId, client);
            return transactionId;
        } catch (error) {
            client.release();
            throw new TransactionError(`Failed to begin transaction: ${String(error)}`);
        }
    }

    /**
     * Commit a transaction
     */
    async commitTransaction(transactionId: string): Promise<void> {
        const client = this.activeTransactions.get(transactionId);
        if (!client) {
            throw new TransactionError(`Transaction not found: ${transactionId}`);
        }

        try {
            await client.query('COMMIT');
        } finally {
            client.release();
            this.activeTransactions.delete(transactionId);
        }
    }

    /**
     * Rollback a transaction
     */
    async rollbackTransaction(transactionId: string): Promise<void> {
        const client = this.activeTransactions.get(transactionId);
        if (!client) {
            throw new TransactionError(`Transaction not found: ${transactionId}`);
        }

        try {
            await client.query('ROLLBACK');
        } finally {
            client.release();
            this.activeTransactions.delete(transactionId);
        }
    }

    /**
     * Create a savepoint
     */
    async createSavepoint(transactionId: string, savepointName: string): Promise<void> {
        const client = this.activeTransactions.get(transactionId);
        if (!client) {
            throw new TransactionError(`Transaction not found: ${transactionId}`);
        }

        await client.query(`SAVEPOINT ${savepointName}`);
    }

    /**
     * Release a savepoint
     */
    async releaseSavepoint(transactionId: string, savepointName: string): Promise<void> {
        const client = this.activeTransactions.get(transactionId);
        if (!client) {
            throw new TransactionError(`Transaction not found: ${transactionId}`);
        }

        await client.query(`RELEASE SAVEPOINT ${savepointName}`);
    }

    /**
     * Rollback to a savepoint
     */
    async rollbackToSavepoint(transactionId: string, savepointName: string): Promise<void> {
        const client = this.activeTransactions.get(transactionId);
        if (!client) {
            throw new TransactionError(`Transaction not found: ${transactionId}`);
        }

        await client.query(`ROLLBACK TO SAVEPOINT ${savepointName}`);
    }

    /**
     * Get connection for a transaction
     */
    getTransactionConnection(transactionId: string): PoolClient | undefined {
        return this.activeTransactions.get(transactionId);
    }

    // =========================================================================
    // Schema Operations
    // =========================================================================

    async getSchema(): Promise<SchemaInfo> {
        const tables = await this.listTables();
        const views = tables.filter(t => t.type === 'view');
        const materializedViews = tables.filter(t => t.type === 'materialized_view');
        const realTables = tables.filter(t => t.type === 'table' || t.type === 'partitioned_table');

        // Performance optimization: fetch all indexes in a single query instead of N+1
        const indexes = await this.getAllIndexes();

        return {
            tables: realTables,
            views,
            materializedViews,
            indexes
        };
    }

    /**
     * Get all indexes across all user tables in a single query
     * Performance optimization: eliminates N+1 query pattern
     */
    private async getAllIndexes(): Promise<IndexInfo[]> {
        // Check cache first
        const cached = this.getCached('all_indexes') as IndexInfo[] | undefined;
        if (cached) return cached;

        const result = await this.executeQuery(`
            SELECT 
                i.relname as name,
                t.relname as table_name,
                n.nspname as schema_name,
                am.amname as type,
                ix.indisunique as is_unique,
                pg_get_indexdef(ix.indexrelid) as definition,
                array_agg(a.attname ORDER BY x.ordinality) as columns,
                pg_relation_size(i.oid) as size_bytes,
                COALESCE(pg_stat_get_numscans(i.oid), 0) as num_scans
            FROM pg_index ix
            JOIN pg_class t ON t.oid = ix.indrelid
            JOIN pg_class i ON i.oid = ix.indexrelid
            JOIN pg_namespace n ON n.oid = t.relnamespace
            JOIN pg_am am ON am.oid = i.relam
            CROSS JOIN LATERAL unnest(ix.indkey) WITH ORDINALITY AS x(attnum, ordinality)
            LEFT JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = x.attnum
            WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
              AND n.nspname !~ '^pg_toast'
            GROUP BY i.relname, t.relname, n.nspname, am.amname, ix.indisunique, ix.indexrelid, i.oid
            ORDER BY n.nspname, t.relname, i.relname
        `);

        const indexes = (result.rows ?? []).map(row => ({
            name: row['name'] as string,
            tableName: row['table_name'] as string,
            schemaName: row['schema_name'] as string,
            columns: row['columns'] as string[],
            unique: row['is_unique'] as boolean,
            type: row['type'] as IndexInfo['type'],
            sizeBytes: Number(row['size_bytes']) || undefined,
            numberOfScans: Number(row['num_scans']) || undefined
        }));

        this.setCache('all_indexes', indexes);
        return indexes;
    }

    async listTables(): Promise<TableInfo[]> {
        const result = await this.executeQuery(`
            SELECT 
                c.relname as name,
                n.nspname as schema,
                CASE c.relkind
                    WHEN 'r' THEN 'table'
                    WHEN 'v' THEN 'view'
                    WHEN 'm' THEN 'materialized_view'
                    WHEN 'f' THEN 'foreign_table'
                    WHEN 'p' THEN 'partitioned_table'
                END as type,
                pg_catalog.pg_get_userbyid(c.relowner) as owner,
                c.reltuples::bigint as row_count,
                pg_catalog.pg_table_size(c.oid) as size_bytes,
                pg_catalog.pg_total_relation_size(c.oid) as total_size_bytes,
                obj_description(c.oid, 'pg_class') as comment
            FROM pg_catalog.pg_class c
            LEFT JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
            WHERE c.relkind IN ('r', 'v', 'm', 'f', 'p')
              AND n.nspname NOT IN ('pg_catalog', 'information_schema')
              AND n.nspname !~ '^pg_toast'
            ORDER BY n.nspname, c.relname
        `);

        return (result.rows ?? []).map(row => ({
            name: row['name'] as string,
            schema: row['schema'] as string,
            type: row['type'] as TableInfo['type'],
            owner: row['owner'] as string,
            rowCount: Number(row['row_count']) || undefined,
            sizeBytes: Number(row['size_bytes']) || undefined,
            totalSizeBytes: Number(row['total_size_bytes']) || undefined,
            comment: row['comment'] as string | undefined
        }));
    }

    async describeTable(tableName: string, schemaName = 'public'): Promise<TableInfo> {
        // Get column information
        const columnsResult = await this.executeQuery(`
            SELECT 
                a.attname as name,
                pg_catalog.format_type(a.atttypid, a.atttypmod) as type,
                NOT a.attnotnull as nullable,
                COALESCE(
                    (SELECT true FROM pg_constraint c 
                     WHERE c.conrelid = a.attrelid 
                     AND a.attnum = ANY(c.conkey) 
                     AND c.contype = 'p'), 
                    false
                ) as primary_key,
                pg_get_expr(d.adbin, d.adrelid) as default_value,
                a.attgenerated != '' as is_generated,
                pg_get_expr(d.adbin, d.adrelid) as generated_expression,
                col_description(a.attrelid, a.attnum) as comment
            FROM pg_catalog.pg_attribute a
            LEFT JOIN pg_catalog.pg_attrdef d ON (a.attrelid, a.attnum) = (d.adrelid, d.adnum)
            WHERE a.attrelid = ($1 || '.' || $2)::regclass
              AND a.attnum > 0
              AND NOT a.attisdropped
            ORDER BY a.attnum
        `, [schemaName, tableName]);

        const columns: ColumnInfo[] = (columnsResult.rows ?? []).map(row => ({
            name: row['name'] as string,
            type: row['type'] as string,
            nullable: row['nullable'] as boolean,
            primaryKey: row['primary_key'] as boolean,
            defaultValue: row['default_value'],
            isGenerated: row['is_generated'] as boolean,
            generatedExpression: row['generated_expression'] as string | undefined,
            comment: row['comment'] as string | undefined
        }));

        // Get table info
        const tableResult = await this.executeQuery(`
            SELECT 
                CASE c.relkind
                    WHEN 'r' THEN 'table'
                    WHEN 'v' THEN 'view'
                    WHEN 'm' THEN 'materialized_view'
                    WHEN 'f' THEN 'foreign_table'
                    WHEN 'p' THEN 'partitioned_table'
                END as type,
                pg_catalog.pg_get_userbyid(c.relowner) as owner,
                c.reltuples::bigint as row_count,
                obj_description(c.oid, 'pg_class') as comment,
                c.relkind = 'p' as is_partitioned,
                pg_get_partkeydef(c.oid) as partition_key
            FROM pg_catalog.pg_class c
            LEFT JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
            WHERE c.relname = $1
              AND n.nspname = $2
        `, [tableName, schemaName]);

        const tableRow = tableResult.rows?.[0];

        return {
            name: tableName,
            schema: schemaName,
            type: (tableRow?.['type'] as TableInfo['type']) ?? 'table',
            owner: tableRow?.['owner'] as string | undefined,
            rowCount: Number(tableRow?.['row_count']) || undefined,
            comment: tableRow?.['comment'] as string | undefined,
            isPartitioned: tableRow?.['is_partitioned'] as boolean,
            partitionKey: tableRow?.['partition_key'] as string | undefined,
            columns
        };
    }

    async listSchemas(): Promise<string[]> {
        const result = await this.executeQuery(`
            SELECT nspname 
            FROM pg_catalog.pg_namespace 
            WHERE nspname NOT IN ('pg_catalog', 'information_schema')
              AND nspname !~ '^pg_toast'
              AND nspname !~ '^pg_temp'
            ORDER BY nspname
        `);
        return (result.rows ?? []).map(row => row['nspname'] as string);
    }

    /**
     * Get indexes for a table
     */
    async getTableIndexes(tableName: string, schemaName = 'public'): Promise<IndexInfo[]> {
        const result = await this.executeQuery(`
            SELECT 
                i.relname as name,
                am.amname as type,
                ix.indisunique as is_unique,
                pg_get_indexdef(ix.indexrelid) as definition,
                array_agg(a.attname ORDER BY x.ordinality) as columns,
                pg_relation_size(i.oid) as size_bytes,
                COALESCE(pg_stat_get_numscans(i.oid), 0) as num_scans
            FROM pg_index ix
            JOIN pg_class t ON t.oid = ix.indrelid
            JOIN pg_class i ON i.oid = ix.indexrelid
            JOIN pg_namespace n ON n.oid = t.relnamespace
            JOIN pg_am am ON am.oid = i.relam
            CROSS JOIN LATERAL unnest(ix.indkey) WITH ORDINALITY AS x(attnum, ordinality)
            LEFT JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = x.attnum
            WHERE t.relname = $1
              AND n.nspname = $2
            GROUP BY i.relname, am.amname, ix.indisunique, ix.indexrelid, i.oid
            ORDER BY i.relname
        `, [tableName, schemaName]);

        return (result.rows ?? []).map(row => ({
            name: row['name'] as string,
            tableName,
            schemaName,
            columns: row['columns'] as string[],
            unique: row['is_unique'] as boolean,
            type: row['type'] as IndexInfo['type'],
            sizeBytes: Number(row['size_bytes']) || undefined,
            numberOfScans: Number(row['num_scans']) || undefined
        }));
    }

    /**
     * Check if an extension is available
     */
    async isExtensionAvailable(extensionName: string): Promise<boolean> {
        const result = await this.executeQuery(`
            SELECT EXISTS(
                SELECT 1 FROM pg_extension WHERE extname = $1
            ) as available
        `, [extensionName]);
        return result.rows?.[0]?.['available'] as boolean ?? false;
    }

    // =========================================================================
    // Capabilities
    // =========================================================================

    getCapabilities(): AdapterCapabilities {
        return {
            json: true,
            fullTextSearch: true,
            vector: true, // With pgvector extension
            geospatial: true, // With PostGIS extension
            transactions: true,
            preparedStatements: true,
            connectionPooling: true,
            partitioning: true,
            replication: true,
            cte: true,
            windowFunctions: true
        };
    }

    getSupportedToolGroups(): ToolGroup[] {
        return [
            'core',
            'transactions',
            'jsonb',
            'text',
            'performance',
            'admin',
            'monitoring',
            'backup',
            'schema',
            'vector',
            'postgis',
            'partitioning',
            'stats',
            'cron',
            'partman',
            'kcache',
            'citext',
            'ltree',
            'pgcrypto',
            'codemode'
        ];
    }

    // =========================================================================
    // Tool/Resource/Prompt Registration
    // =========================================================================

    getToolDefinitions(): ToolDefinition[] {
        // Performance optimization: cache tool definitions (immutable after creation)
        if (this.cachedToolDefinitions) {
            return this.cachedToolDefinitions;
        }

        this.cachedToolDefinitions = [
            ...getCoreTools(this),
            ...getTransactionTools(this),
            ...getJsonbTools(this),
            ...getTextTools(this),
            ...getPerformanceTools(this),
            ...getAdminTools(this),
            ...getMonitoringTools(this),
            ...getBackupTools(this),
            ...getSchemaTools(this),
            ...getVectorTools(this),
            ...getPostgisTools(this),
            ...getPartitioningTools(this),
            ...getStatsTools(this),
            ...getCronTools(this),
            ...getPartmanTools(this),
            ...getKcacheTools(this),
            ...getCitextTools(this),
            ...getLtreeTools(this),
            ...getPgcryptoTools(this),
            ...getCodeModeTools(this)
        ];

        return this.cachedToolDefinitions;
    }

    getResourceDefinitions(): ResourceDefinition[] {
        return getPostgresResources(this);
    }

    getPromptDefinitions(): PromptDefinition[] {
        return getPostgresPrompts(this);
    }

    // =========================================================================
    // Helpers
    // =========================================================================

    /**
     * Get the connection pool (for monitoring tools)
     */
    getPool(): ConnectionPool | null {
        return this.pool;
    }
}
