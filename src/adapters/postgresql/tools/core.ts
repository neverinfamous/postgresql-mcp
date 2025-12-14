/**
 * PostgreSQL Core Database Tools
 * 
 * Fundamental database operations: read, write, table management, indexes.
 * 13 tools total.
 */

import type { PostgresAdapter } from '../PostgresAdapter.js';
import type { ToolDefinition, RequestContext } from '../../../types/index.js';
import { z } from 'zod';
import {
    ReadQuerySchema,
    WriteQuerySchema,
    ListTablesSchema,
    DescribeTableSchema,
    CreateTableSchema,
    DropTableSchema,
    GetIndexesSchema,
    CreateIndexSchema
} from '../types.js';

// Additional schemas for new core tools
export const ListObjectsSchema = z.object({
    schema: z.string().optional().describe('Schema name (default: all user schemas)'),
    types: z.array(z.enum(['table', 'view', 'materialized_view', 'function', 'procedure', 'sequence', 'index', 'trigger'])).optional().describe('Object types to include')
});

export const ObjectDetailsSchema = z.object({
    name: z.string().describe('Object name'),
    schema: z.string().optional().describe('Schema name (default: public)'),
    type: z.enum(['table', 'view', 'function', 'sequence', 'index']).optional().describe('Object type hint')
});

export const AnalyzeDbHealthSchema = z.object({
    includeIndexes: z.boolean().optional().describe('Include index health analysis'),
    includeVacuum: z.boolean().optional().describe('Include vacuum/bloat analysis'),
    includeConnections: z.boolean().optional().describe('Include connection analysis')
});

export const AnalyzeWorkloadIndexesSchema = z.object({
    topQueries: z.number().optional().describe('Number of top queries to analyze (default: 20)'),
    minCalls: z.number().optional().describe('Minimum call count threshold')
});

export const AnalyzeQueryIndexesSchema = z.object({
    sql: z.string().describe('Query to analyze for index recommendations'),
    params: z.array(z.unknown()).optional().describe('Query parameters')
});

/**
 * Get all core database tools
 */
export function getCoreTools(adapter: PostgresAdapter): ToolDefinition[] {
    return [
        createReadQueryTool(adapter),
        createWriteQueryTool(adapter),
        createListTablesTool(adapter),
        createDescribeTableTool(adapter),
        createCreateTableTool(adapter),
        createDropTableTool(adapter),
        createGetIndexesTool(adapter),
        createCreateIndexTool(adapter),
        createListObjectsTool(adapter),
        createObjectDetailsTool(adapter),
        createAnalyzeDbHealthTool(adapter),
        createAnalyzeWorkloadIndexesTool(adapter),
        createAnalyzeQueryIndexesTool(adapter)
    ];
}

/**
 * Execute a read-only SQL query
 */
function createReadQueryTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_read_query',
        description: 'Execute a read-only SQL query (SELECT, WITH). Returns rows as JSON.',
        group: 'core',
        inputSchema: ReadQuerySchema,
        handler: async (params: unknown, _context: RequestContext) => {
            const { sql, params: queryParams } = ReadQuerySchema.parse(params);
            const result = await adapter.executeReadQuery(sql, queryParams);
            return {
                rows: result.rows,
                rowCount: result.rows?.length ?? 0,
                executionTimeMs: result.executionTimeMs
            };
        }
    };
}

/**
 * Execute a write SQL query
 */
function createWriteQueryTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_write_query',
        description: 'Execute a write SQL query (INSERT, UPDATE, DELETE). Returns affected row count.',
        group: 'core',
        inputSchema: WriteQuerySchema,
        handler: async (params: unknown, _context: RequestContext) => {
            const { sql, params: queryParams } = WriteQuerySchema.parse(params);
            const result = await adapter.executeWriteQuery(sql, queryParams);
            return {
                rowsAffected: result.rowsAffected,
                command: result.command,
                executionTimeMs: result.executionTimeMs
            };
        }
    };
}

/**
 * List all tables in the database
 */
function createListTablesTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_list_tables',
        description: 'List all tables, views, and materialized views with metadata.',
        group: 'core',
        inputSchema: ListTablesSchema,
        handler: async (params: unknown, _context: RequestContext) => {
            const { schema } = ListTablesSchema.parse(params);
            let tables = await adapter.listTables();

            if (schema) {
                tables = tables.filter(t => t.schema === schema);
            }

            return {
                tables,
                count: tables.length
            };
        }
    };
}

/**
 * Describe a table's structure
 */
function createDescribeTableTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_describe_table',
        description: 'Get detailed table structure including columns, types, and constraints.',
        group: 'core',
        inputSchema: DescribeTableSchema,
        handler: async (params: unknown, _context: RequestContext) => {
            const { table, schema } = DescribeTableSchema.parse(params);
            return adapter.describeTable(table, schema);
        }
    };
}

/**
 * Create a new table
 */
function createCreateTableTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_create_table',
        description: 'Create a new table with specified columns and constraints.',
        group: 'core',
        inputSchema: CreateTableSchema,
        handler: async (params: unknown, _context: RequestContext) => {
            const { name, schema, columns, ifNotExists } = CreateTableSchema.parse(params);

            const schemaPrefix = schema ? `"${schema}".` : '';
            const ifNotExistsClause = ifNotExists ? 'IF NOT EXISTS ' : '';

            const columnDefs = columns.map(col => {
                const parts = [`"${col.name}"`, col.type];

                if (col.primaryKey) {
                    parts.push('PRIMARY KEY');
                }
                if (col.unique && !col.primaryKey) {
                    parts.push('UNIQUE');
                }
                if (col.nullable === false) {
                    parts.push('NOT NULL');
                }
                if (col.default !== undefined) {
                    parts.push(`DEFAULT ${col.default}`);
                }
                if (col.references) {
                    let ref = `REFERENCES "${col.references.table}"("${col.references.column}")`;
                    if (col.references.onDelete) {
                        ref += ` ON DELETE ${col.references.onDelete}`;
                    }
                    if (col.references.onUpdate) {
                        ref += ` ON UPDATE ${col.references.onUpdate}`;
                    }
                    parts.push(ref);
                }

                return parts.join(' ');
            });

            const sql = `CREATE TABLE ${ifNotExistsClause}${schemaPrefix}"${name}" (\n  ${columnDefs.join(',\n  ')}\n)`;

            await adapter.executeQuery(sql);

            return {
                success: true,
                table: `${schema ?? 'public'}.${name}`,
                sql
            };
        }
    };
}

/**
 * Drop a table
 */
function createDropTableTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_drop_table',
        description: 'Drop a table from the database.',
        group: 'core',
        inputSchema: DropTableSchema,
        handler: async (params: unknown, _context: RequestContext) => {
            const { table, schema, ifExists, cascade } = DropTableSchema.parse(params);

            const schemaPrefix = schema ? `"${schema}".` : '';
            const ifExistsClause = ifExists ? 'IF EXISTS ' : '';
            const cascadeClause = cascade ? ' CASCADE' : '';

            const sql = `DROP TABLE ${ifExistsClause}${schemaPrefix}"${table}"${cascadeClause}`;

            await adapter.executeQuery(sql);

            return {
                success: true,
                dropped: `${schema ?? 'public'}.${table}`
            };
        }
    };
}

/**
 * Get indexes for a table
 */
function createGetIndexesTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_get_indexes',
        description: 'List all indexes on a table with usage statistics.',
        group: 'core',
        inputSchema: GetIndexesSchema,
        handler: async (params: unknown, _context: RequestContext) => {
            const { table, schema } = GetIndexesSchema.parse(params);
            const indexes = await adapter.getTableIndexes(table, schema);
            return { indexes, count: indexes.length };
        }
    };
}

/**
 * Create an index
 */
function createCreateIndexTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_create_index',
        description: 'Create an index on a table. Supports btree, hash, gin, gist, brin index types.',
        group: 'core',
        inputSchema: CreateIndexSchema,
        handler: async (params: unknown, _context: RequestContext) => {
            const { name, table, schema, columns, unique, type, where, concurrently } =
                CreateIndexSchema.parse(params);

            const schemaPrefix = schema ? `"${schema}".` : '';
            const uniqueClause = unique ? 'UNIQUE ' : '';
            const concurrentlyClause = concurrently ? 'CONCURRENTLY ' : '';
            const usingClause = type ? `USING ${type} ` : '';
            const whereClause = where ? ` WHERE ${where}` : '';

            const columnList = columns.map(c => `"${c}"`).join(', ');

            const sql = `CREATE ${uniqueClause}INDEX ${concurrentlyClause}"${name}" ` +
                `ON ${schemaPrefix}"${table}" ${usingClause}(${columnList})${whereClause}`;

            await adapter.executeQuery(sql);

            return {
                success: true,
                index: name,
                table: `${schema ?? 'public'}.${table}`,
                sql
            };
        }
    };
}

/**
 * List database objects
 */
function createListObjectsTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_list_objects',
        description: 'List all database objects (tables, views, functions, sequences, indexes, triggers) with metadata.',
        group: 'core',
        inputSchema: ListObjectsSchema,
        handler: async (params: unknown, _context: RequestContext) => {
            const { schema, types } = ListObjectsSchema.parse(params);

            const schemaFilter = schema
                ? `AND n.nspname = '${schema}'`
                : `AND n.nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast')`;

            const typeFilters: string[] = [];
            const selectedTypes = types ?? ['table', 'view', 'materialized_view', 'function', 'sequence'];

            if (selectedTypes.includes('table')) typeFilters.push(`('r', 'table')`);
            if (selectedTypes.includes('view')) typeFilters.push(`('v', 'view')`);
            if (selectedTypes.includes('materialized_view')) typeFilters.push(`('m', 'materialized_view')`);
            if (selectedTypes.includes('sequence')) typeFilters.push(`('S', 'sequence')`);

            const objects: { type: string; schema: string; name: string; owner: string }[] = [];

            // Get tables, views, materialized views, sequences
            if (typeFilters.length > 0) {
                const sql = `
                    SELECT 
                        CASE c.relkind 
                            ${selectedTypes.includes('table') ? `WHEN 'r' THEN 'table'` : ''}
                            ${selectedTypes.includes('view') ? `WHEN 'v' THEN 'view'` : ''}
                            ${selectedTypes.includes('materialized_view') ? `WHEN 'm' THEN 'materialized_view'` : ''}
                            ${selectedTypes.includes('sequence') ? `WHEN 'S' THEN 'sequence'` : ''}
                        END as type,
                        n.nspname as schema,
                        c.relname as name,
                        pg_get_userbyid(c.relowner) as owner
                    FROM pg_class c
                    JOIN pg_namespace n ON n.oid = c.relnamespace
                    WHERE c.relkind IN (${selectedTypes.map(t => {
                    if (t === 'table') return `'r'`;
                    if (t === 'view') return `'v'`;
                    if (t === 'materialized_view') return `'m'`;
                    if (t === 'sequence') return `'S'`;
                    return null;
                }).filter(Boolean).join(', ')})
                    ${schemaFilter}
                    ORDER BY n.nspname, c.relname
                `;
                const result = await adapter.executeQuery(sql);
                objects.push(...(result.rows as typeof objects));
            }

            // Get functions
            if (selectedTypes.includes('function') || selectedTypes.includes('procedure')) {
                const kindFilter = [];
                if (selectedTypes.includes('function')) kindFilter.push(`'f'`, `'a'`);
                if (selectedTypes.includes('procedure')) kindFilter.push(`'p'`);

                const sql = `
                    SELECT 
                        CASE p.prokind WHEN 'p' THEN 'procedure' ELSE 'function' END as type,
                        n.nspname as schema,
                        p.proname as name,
                        pg_get_userbyid(p.proowner) as owner
                    FROM pg_proc p
                    JOIN pg_namespace n ON n.oid = p.pronamespace
                    WHERE p.prokind IN (${kindFilter.join(', ')})
                    ${schema
                        ? `AND n.nspname = '${schema}'`
                        : `AND n.nspname NOT IN ('pg_catalog', 'information_schema')`}
                    ORDER BY n.nspname, p.proname
                `;
                const result = await adapter.executeQuery(sql);
                objects.push(...(result.rows as typeof objects));
            }

            // Get indexes
            if (selectedTypes.includes('index')) {
                const sql = `
                    SELECT 
                        'index' as type,
                        n.nspname as schema,
                        c.relname as name,
                        pg_get_userbyid(c.relowner) as owner
                    FROM pg_class c
                    JOIN pg_namespace n ON n.oid = c.relnamespace
                    WHERE c.relkind = 'i'
                    ${schemaFilter}
                    ORDER BY n.nspname, c.relname
                `;
                const result = await adapter.executeQuery(sql);
                objects.push(...(result.rows as typeof objects));
            }

            // Get triggers
            if (selectedTypes.includes('trigger')) {
                const sql = `
                    SELECT DISTINCT
                        'trigger' as type,
                        n.nspname as schema,
                        t.tgname as name,
                        pg_get_userbyid(c.relowner) as owner
                    FROM pg_trigger t
                    JOIN pg_class c ON c.oid = t.tgrelid
                    JOIN pg_namespace n ON n.oid = c.relnamespace
                    WHERE NOT t.tgisinternal
                    ${schemaFilter}
                    ORDER BY n.nspname, t.tgname
                `;
                const result = await adapter.executeQuery(sql);
                objects.push(...(result.rows as typeof objects));
            }

            // Fix syntax in list objects tool
            return {
                objects,
                count: objects.length,
                byType: objects.reduce<Record<string, number>>((acc, obj) => {
                    acc[obj.type] = (acc[obj.type] ?? 0) + 1;
                    return acc;
                }, {})
            };
        }
    };
}

/**
 * Get object details
 */
function createObjectDetailsTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_object_details',
        description: 'Get detailed metadata for a specific database object (table, view, function, sequence, index).',
        group: 'core',
        inputSchema: ObjectDetailsSchema,
        handler: async (params: unknown, _context: RequestContext) => {
            const { name, schema, type } = ObjectDetailsSchema.parse(params);
            const schemaName = schema ?? 'public';

            // First, determine the object type if not provided
            let objectType = type;
            if (!objectType) {
                const detectSql = `
                    SELECT 
                        CASE 
                            WHEN EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace 
                                        WHERE c.relname = $1 AND n.nspname = $2 AND c.relkind = 'r') THEN 'table'
                            WHEN EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace 
                                        WHERE c.relname = $1 AND n.nspname = $2 AND c.relkind = 'v') THEN 'view'
                            WHEN EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace 
                                        WHERE c.relname = $1 AND n.nspname = $2 AND c.relkind = 'i') THEN 'index'
                            WHEN EXISTS (SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace 
                                        WHERE c.relname = $1 AND n.nspname = $2 AND c.relkind = 'S') THEN 'sequence'
                            WHEN EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace 
                                        WHERE p.proname = $1 AND n.nspname = $2) THEN 'function'
                        END as object_type
                `;
                const detectResult = await adapter.executeQuery(detectSql, [name, schemaName]);
                objectType = (detectResult.rows?.[0] as { object_type: string } | undefined)?.object_type as typeof type;
            }

            if (!objectType) {
                return { error: `Object '${schemaName}.${name}' not found` };
            }

            let details: Record<string, unknown> = {
                name,
                schema: schemaName,
                type: objectType
            };

            if (objectType === 'table' || objectType === 'view') {
                const tableDetails = await adapter.describeTable(name, schemaName);
                details = { ...details, ...tableDetails };
            } else if (objectType === 'function') {
                const sql = `
                    SELECT 
                        p.proname as name,
                        pg_get_function_arguments(p.oid) as arguments,
                        pg_get_function_result(p.oid) as return_type,
                        p.prosrc as source,
                        l.lanname as language,
                        p.provolatile as volatility,
                        pg_get_userbyid(p.proowner) as owner
                    FROM pg_proc p
                    JOIN pg_namespace n ON n.oid = p.pronamespace
                    JOIN pg_language l ON l.oid = p.prolang
                    WHERE p.proname = $1 AND n.nspname = $2
                `;
                const result = await adapter.executeQuery(sql, [name, schemaName]);
                if (result.rows && result.rows.length > 0) {
                    details = { ...details, ...result.rows[0] };
                }
            } else if (objectType === 'sequence') {
                const sql = `
                    SELECT 
                        seqstart as start_value,
                        seqmin as min_value,
                        seqmax as max_value,
                        seqincrement as increment,
                        seqcycle as cycle,
                        seqcache as cache
                    FROM pg_sequences
                    WHERE schemaname = $1 AND sequencename = $2
                `;
                const result = await adapter.executeQuery(sql, [schemaName, name]);
                if (result.rows && result.rows.length > 0) {
                    details = { ...details, ...result.rows[0] };
                }
            } else if (objectType === 'index') {
                const sql = `
                    SELECT 
                        i.relname as index_name,
                        t.relname as table_name,
                        am.amname as index_type,
                        pg_get_indexdef(i.oid) as definition,
                        ix.indisunique as is_unique,
                        ix.indisprimary as is_primary,
                        pg_size_pretty(pg_relation_size(i.oid)) as size
                    FROM pg_index ix
                    JOIN pg_class i ON i.oid = ix.indexrelid
                    JOIN pg_class t ON t.oid = ix.indrelid
                    JOIN pg_am am ON am.oid = i.relam
                    JOIN pg_namespace n ON n.oid = i.relnamespace
                    WHERE i.relname = $1 AND n.nspname = $2
                `;
                const result = await adapter.executeQuery(sql, [name, schemaName]);
                if (result.rows && result.rows.length > 0) {
                    details = { ...details, ...result.rows[0] };
                }
            }

            return details;
        }
    };
}

/**
 * Analyze database health
 */
function createAnalyzeDbHealthTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_analyze_db_health',
        description: 'Comprehensive database health analysis including cache hit ratio, bloat, replication, and connection stats.',
        group: 'core',
        inputSchema: AnalyzeDbHealthSchema,
        handler: async (params: unknown, _context: RequestContext) => {
            const { includeIndexes, includeVacuum, includeConnections } = AnalyzeDbHealthSchema.parse(params);

            // Use interface to avoid 'any'
            interface DbHealthReport {
                cacheHitRatio?: {
                    heap: number | null;
                    index: number | null;
                    status: string;
                } | undefined;
                databaseSize?: string | undefined;
                tableStats?: Record<string, unknown> | undefined;
                unusedIndexes?: number | undefined;
                tablesNeedingVacuum?: number | undefined;
                connections?: Record<string, unknown> | undefined;
                isReplica?: boolean | undefined;
                overallScore?: number | undefined;
                overallStatus?: string | undefined;
            }

            const health: DbHealthReport = {};

            // Cache hit ratio
            const cacheQuery = `
                SELECT 
                    sum(heap_blks_hit) / NULLIF(sum(heap_blks_hit) + sum(heap_blks_read), 0) as heap_hit_ratio,
                    sum(idx_blks_hit) / NULLIF(sum(idx_blks_hit) + sum(idx_blks_read), 0) as index_hit_ratio
                FROM pg_statio_user_tables
            `;
            const cacheResult = await adapter.executeQuery(cacheQuery);
            const cacheRow = cacheResult.rows?.[0] as { heap_hit_ratio: number | null; index_hit_ratio: number | null } | undefined;

            if (cacheRow) {
                health.cacheHitRatio = {
                    heap: cacheRow.heap_hit_ratio !== null ? Number((cacheRow.heap_hit_ratio * 100).toFixed(2)) : null,
                    index: cacheRow.index_hit_ratio !== null ? Number((cacheRow.index_hit_ratio * 100).toFixed(2)) : null,
                    status: (cacheRow.heap_hit_ratio ?? 0) > 0.95 ? 'good' : (cacheRow.heap_hit_ratio ?? 0) > 0.8 ? 'fair' : 'poor'
                };
            }

            // Database size
            const sizeQuery = `SELECT pg_size_pretty(pg_database_size(current_database())) as size`;
            const sizeResult = await adapter.executeQuery(sizeQuery);
            if (sizeResult.rows && sizeResult.rows.length > 0) {
                health.databaseSize = (sizeResult.rows[0] as { size: string }).size;
            }

            // Table count and total rows estimate
            const statsQuery = `
                SELECT 
                    COUNT(*) as table_count,
                    SUM(n_live_tup) as total_rows
                FROM pg_stat_user_tables
            `;
            const statsResult = await adapter.executeQuery(statsQuery);
            if (statsResult.rows && statsResult.rows.length > 0) {
                health.tableStats = statsResult.rows[0];
            }

            if (includeIndexes !== false) {
                // Unused indexes
                const unusedQuery = `
                    SELECT COUNT(*) as unused_count
                    FROM pg_stat_user_indexes
                    WHERE idx_scan = 0 AND idx_tup_read = 0
                `;
                const unusedResult = await adapter.executeQuery(unusedQuery);
                if (unusedResult.rows && unusedResult.rows.length > 0) {
                    health.unusedIndexes = (unusedResult.rows[0] as { unused_count: number }).unused_count;
                }
            }

            if (includeVacuum !== false) {
                // Tables needing vacuum
                const vacuumQuery = `
                    SELECT COUNT(*) as tables_needing_vacuum
                    FROM pg_stat_user_tables
                    WHERE n_dead_tup > n_live_tup * 0.1
                    AND n_dead_tup > 1000
                `;
                const vacuumResult = await adapter.executeQuery(vacuumQuery);
                if (vacuumResult.rows && vacuumResult.rows.length > 0) {
                    health.tablesNeedingVacuum = (vacuumResult.rows[0] as { tables_needing_vacuum: number }).tables_needing_vacuum;
                }
            }

            if (includeConnections !== false) {
                // Connection stats
                const connQuery = `
                    SELECT 
                        COUNT(*) as total,
                        COUNT(*) FILTER (WHERE state = 'active') as active,
                        COUNT(*) FILTER (WHERE state = 'idle') as idle,
                        COUNT(*) FILTER (WHERE state = 'idle in transaction') as idle_in_transaction,
                        current_setting('max_connections')::int as max_connections
                    FROM pg_stat_activity
                    WHERE backend_type = 'client backend'
                `;
                const connResult = await adapter.executeQuery(connQuery);
                if (connResult.rows && connResult.rows.length > 0) {
                    health.connections = connResult.rows[0];
                }
            }

            // Replication status
            const replQuery = `SELECT pg_is_in_recovery() as is_replica`;
            const replResult = await adapter.executeQuery(replQuery);
            if (replResult.rows && replResult.rows.length > 0) {
                health.isReplica = (replResult.rows[0] as { is_replica: boolean }).is_replica;
            }

            // Overall health score
            let score = 100;
            if (health.cacheHitRatio?.heap !== null && health.cacheHitRatio?.heap !== undefined &&
                (health.cacheHitRatio?.heap ?? 100) < 95) score -= 20;
            if ((health.unusedIndexes ?? 0) > 10) score -= 10;
            if ((health.tablesNeedingVacuum ?? 0) > 5) score -= 15;

            health.overallScore = Math.max(0, score);
            health.overallStatus = score >= 80 ? 'healthy' : score >= 60 ? 'needs_attention' : 'critical';

            return health;
        }
    };
}

/**
 * Analyze workload for index recommendations
 */
function createAnalyzeWorkloadIndexesTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_analyze_workload_indexes',
        description: 'Analyze database workload using pg_stat_statements to recommend missing indexes.',
        group: 'core',
        inputSchema: AnalyzeWorkloadIndexesSchema,
        handler: async (params: unknown, _context: RequestContext) => {
            const { topQueries, minCalls } = AnalyzeWorkloadIndexesSchema.parse(params);
            const limit = topQueries ?? 20;
            const minCallThreshold = minCalls ?? 10;

            // Check if pg_stat_statements is available
            const extCheck = await adapter.executeQuery(
                `SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements'`
            );

            if (!extCheck.rows || extCheck.rows.length === 0) {
                return {
                    error: 'pg_stat_statements extension not installed',
                    recommendation: 'Install with: CREATE EXTENSION pg_stat_statements;'
                };
            }

            // Get slow queries with sequential scans
            const sql = `
                SELECT 
                    query,
                    calls,
                    mean_exec_time::numeric(10,2) as avg_time_ms,
                    (total_exec_time / 1000)::numeric(10,2) as total_time_sec,
                    rows / NULLIF(calls, 0) as avg_rows
                FROM pg_stat_statements
                WHERE calls >= $1
                AND query NOT LIKE '%pg_stat%'
                AND query NOT LIKE '%pg_catalog%'
                ORDER BY mean_exec_time DESC
                LIMIT $2
            `;

            const result = await adapter.executeQuery(sql, [minCallThreshold, limit]);

            // Analyze each query for potential index improvements
            const recommendations: {
                query: string;
                avgTimeMs: number;
                calls: number;
                recommendation: string;
            }[] = [];

            for (const row of result.rows ?? []) {
                const queryRow = row as { query: string; avg_time_ms: number; calls: number };
                const queryLower = queryRow.query.toLowerCase();

                let rec = '';

                // Simple heuristic analysis
                if (queryLower.includes('where') && !queryLower.includes('create index')) {
                    if (queryLower.includes('like') && queryLower.includes('%')) {
                        rec = 'Consider GIN index with pg_trgm for LIKE queries';
                    } else if (queryLower.includes(' = ') || queryLower.includes(' in (')) {
                        rec = 'Consider B-tree index on filtered columns';
                    } else if (queryLower.includes(' between ') || queryLower.includes(' > ') || queryLower.includes(' < ')) {
                        rec = 'Consider B-tree index for range queries';
                    }
                }

                if (queryLower.includes('order by') && queryLower.includes('limit')) {
                    rec += rec ? '; Also consider index for ORDER BY columns' : 'Consider index for ORDER BY columns';
                }

                if (rec) {
                    recommendations.push({
                        query: queryRow.query.substring(0, 200),
                        avgTimeMs: queryRow.avg_time_ms,
                        calls: queryRow.calls,
                        recommendation: rec
                    });
                }
            }

            return {
                analyzedQueries: result.rows?.length ?? 0,
                recommendations,
                summary: recommendations.length > 0
                    ? `Found ${String(recommendations.length)} queries that may benefit from indexes`
                    : 'No obvious index recommendations found'
            };
        }
    };
}

/**
 * Analyze specific query for index recommendations
 */
function createAnalyzeQueryIndexesTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_analyze_query_indexes',
        description: 'Analyze a specific query for index recommendations using EXPLAIN ANALYZE.',
        group: 'core',
        inputSchema: AnalyzeQueryIndexesSchema,
        handler: async (params: unknown, _context: RequestContext) => {
            const { sql, params: queryParams } = AnalyzeQueryIndexesSchema.parse(params);

            // Get query plan
            const explainSql = `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${sql}`;
            const result = await adapter.executeQuery(explainSql, queryParams);

            if (!result.rows || result.rows.length === 0) {
                return { error: 'No query plan returned' };
            }

            const plan = (result.rows[0] as { 'QUERY PLAN': unknown[] })['QUERY PLAN'][0] as Record<string, unknown>;
            const rootPlan = plan['Plan'] as Record<string, unknown>;

            const recommendations: string[] = [];
            const issues: string[] = [];

            // Recursive function to analyze plan nodes
            function analyzePlanNode(node: Record<string, unknown>, depth = 0): void {
                const nodeType = node['Node Type'] as string;
                const actualRows = node['Actual Rows'] as number;
                const plannedRows = node['Plan Rows'] as number;

                // Check for sequential scans
                if (nodeType === 'Seq Scan') {
                    const tableName = node['Relation Name'] as string;
                    const filter = node['Filter'] as string;
                    if (actualRows > 1000 && filter) {
                        issues.push(`Sequential scan on ${tableName} with filter: ${filter}`);
                        recommendations.push(`Consider creating an index on ${tableName} for the filtered columns`);
                    }
                }

                // Check for row estimation issues
                if (plannedRows > 0 && actualRows > 0) {
                    const ratio = actualRows / plannedRows;
                    if (ratio > 10 || ratio < 0.1) {
                        issues.push(`Row estimation off by ${ratio.toFixed(1)}x at ${nodeType}`);
                        recommendations.push('Run ANALYZE on affected tables to update statistics');
                    }
                }

                // Check for sorts
                if (nodeType === 'Sort' && node['Sort Method'] === 'external sort') {
                    issues.push('External sort detected (spilling to disk)');
                    recommendations.push('Consider increasing work_mem or adding index for ORDER BY columns');
                }

                // Recurse into child plans
                const plans = node['Plans'] as Record<string, unknown>[] | undefined;
                if (plans) {
                    for (const childPlan of plans) {
                        analyzePlanNode(childPlan, depth + 1);
                    }
                }
            }

            analyzePlanNode(rootPlan);

            return {
                executionTime: plan['Execution Time'] as number,
                planningTime: plan['Planning Time'] as number,
                issues,
                recommendations,
                plan: rootPlan
            };
        }
    };
}

