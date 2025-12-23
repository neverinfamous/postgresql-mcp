/**
 * PostgreSQL Partitioning Tools
 * 
 * Table partitioning management.
 * 6 tools total.
 */

import type { PostgresAdapter } from '../PostgresAdapter.js';
import type { ToolDefinition, RequestContext } from '../../../types/index.js';
import { z } from 'zod';
import { readOnly, write, destructive } from '../../../utils/annotations.js';
import { getToolIcons } from '../../../utils/icons.js';
import { sanitizeIdentifier, sanitizeTableName } from '../../../utils/identifiers.js';
import {
    CreatePartitionedTableSchema,
    CreatePartitionSchema,
    AttachPartitionSchema,
    DetachPartitionSchema
} from '../schemas/index.js';

/**
 * Format bytes to human-readable string with consistent formatting
 */
function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${String(bytes)} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

/**
 * Check table existence and partition status
 * Returns: 'partitioned' | 'not_partitioned' | 'not_found'
 */
async function checkTablePartitionStatus(
    adapter: PostgresAdapter,
    table: string,
    schema: string
): Promise<'partitioned' | 'not_partitioned' | 'not_found'> {
    // 'r' = regular table, 'p' = partitioned table
    const checkSql = `SELECT c.relkind FROM pg_class c 
        JOIN pg_namespace n ON c.relnamespace = n.oid
        WHERE c.relname = $1 AND n.nspname = $2 
        AND c.relkind IN ('r', 'p')`;
    const result = await adapter.executeQuery(checkSql, [table, schema]);

    const rows = result.rows ?? [];
    if (rows.length === 0) {
        return 'not_found';
    }

    return rows[0]?.['relkind'] === 'p' ? 'partitioned' : 'not_partitioned';
}

/**
 * Get all partitioning tools
 */
export function getPartitioningTools(adapter: PostgresAdapter): ToolDefinition[] {
    return [
        createListPartitionsTool(adapter),
        createPartitionedTableTool(adapter),
        createPartitionTool(adapter),
        createAttachPartitionTool(adapter),
        createDetachPartitionTool(adapter),
        createPartitionInfoTool(adapter)
    ];
}

function createListPartitionsTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_list_partitions',
        description: 'List all partitions of a partitioned table. Returns warning if table is not partitioned.',
        group: 'partitioning',
        inputSchema: z.object({
            table: z.string(),
            schema: z.string().optional()
        }),
        annotations: readOnly('List Partitions'),
        icons: getToolIcons('partitioning', readOnly('List Partitions')),
        handler: async (params: unknown, _context: RequestContext) => {
            const parsed = (params as { table: string; schema?: string });
            const schemaName = parsed.schema ?? 'public';

            // Check table existence and partition status
            const tableStatus = await checkTablePartitionStatus(adapter, parsed.table, schemaName);
            if (tableStatus === 'not_found') {
                return {
                    partitions: [],
                    count: 0,
                    warning: `Table '${schemaName}.${parsed.table}' does not exist.`
                };
            }
            if (tableStatus === 'not_partitioned') {
                return {
                    partitions: [],
                    count: 0,
                    warning: `Table '${schemaName}.${parsed.table}' exists but is not partitioned. Use pg_create_partitioned_table to create a partitioned table.`
                };
            }

            const sql = `SELECT 
                        c.relname as partition_name,
                        pg_get_expr(c.relpartbound, c.oid) as partition_bounds,
                        pg_table_size(c.oid) as size_bytes,
                        (SELECT relname FROM pg_class WHERE oid = i.inhparent) as parent_table
                        FROM pg_class c
                        JOIN pg_inherits i ON c.oid = i.inhrelid
                        JOIN pg_namespace n ON c.relnamespace = n.oid
                        WHERE i.inhparent = ($1 || '.' || $2)::regclass
                        ORDER BY c.relname`;

            const result = await adapter.executeQuery(sql, [schemaName, parsed.table]);

            // Format sizes consistently
            const partitions = (result.rows ?? []).map(row => ({
                ...row,
                size: formatBytes(Number(row['size_bytes'] ?? 0))
            }));

            return { partitions, count: partitions.length };
        }
    };
}

function createPartitionedTableTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_create_partitioned_table',
        description: 'Create a partitioned table. Columns: notNull, primaryKey, unique, default. Note: primaryKey/unique must include the partition key column.',
        group: 'partitioning',
        inputSchema: CreatePartitionedTableSchema,
        annotations: write('Create Partitioned Table'),
        icons: getToolIcons('partitioning', write('Create Partitioned Table')),
        handler: async (params: unknown, _context: RequestContext) => {
            const { name, schema, columns, partitionBy, partitionKey } = CreatePartitionedTableSchema.parse(params);

            const tableName = sanitizeTableName(name, schema);

            // Build column definitions with full constraint support
            const columnDefs = columns.map(col => {
                let def = `${sanitizeIdentifier(col.name)} ${col.type}`;

                // Handle nullable/notNull (notNull takes precedence as explicit intent)
                if (col.notNull === true || col.nullable === false) {
                    def += ' NOT NULL';
                }

                // Handle default value
                if (col.default !== undefined) {
                    if (col.default === null) {
                        def += ' DEFAULT NULL';
                    } else if (typeof col.default === 'string') {
                        let defaultVal = col.default;
                        // Strip outer quotes if user provided them (common mistake)
                        if ((defaultVal.startsWith("'") && defaultVal.endsWith("'")) ||
                            (defaultVal.startsWith('"') && defaultVal.endsWith('"'))) {
                            defaultVal = defaultVal.slice(1, -1);
                        }
                        // Escape single quotes in the value
                        const escapedVal = defaultVal.replace(/'/g, "''");
                        def += ` DEFAULT '${escapedVal}'`;
                    } else {
                        def += ` DEFAULT ${String(col.default)}`;
                    }
                }

                // Handle unique constraint
                if (col.unique === true) {
                    def += ' UNIQUE';
                }

                // Handle primary key
                if (col.primaryKey === true) {
                    def += ' PRIMARY KEY';
                }

                return def;
            }).join(',\n  ');

            const sql = `CREATE TABLE ${tableName} (
  ${columnDefs}
) PARTITION BY ${partitionBy.toUpperCase()} (${partitionKey})`;

            await adapter.executeQuery(sql);
            return { success: true, table: `${schema ?? 'public'}.${name}`, partitionBy, partitionKey };
        }
    };
}

function createPartitionTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_create_partition',
        description: 'Create a partition. Use subpartitionBy/subpartitionKey to make it sub-partitionable for multi-level partitioning.',
        group: 'partitioning',
        inputSchema: CreatePartitionSchema,
        annotations: write('Create Partition'),
        icons: getToolIcons('partitioning', write('Create Partition')),
        handler: async (params: unknown, _context: RequestContext) => {
            const { parent, name, schema, forValues, subpartitionBy, subpartitionKey } = CreatePartitionSchema.parse(params);

            // Validate sub-partitioning parameters
            if (subpartitionBy !== undefined && subpartitionKey === undefined) {
                throw new Error('subpartitionKey is required when subpartitionBy is specified');
            }

            const partitionName = sanitizeTableName(name, schema);
            const parentName = sanitizeTableName(parent, schema);

            // Build the SQL
            let sql = `CREATE TABLE ${partitionName} PARTITION OF ${parentName}`;

            // Add partition bounds
            let boundsDescription: string;
            if (forValues === '__DEFAULT__') {
                sql += ' DEFAULT';
                boundsDescription = 'DEFAULT';
            } else {
                sql += ` FOR VALUES ${forValues}`;
                boundsDescription = forValues;
            }

            // Add sub-partitioning clause if requested
            if (subpartitionBy !== undefined && subpartitionKey !== undefined) {
                sql += ` PARTITION BY ${subpartitionBy.toUpperCase()} (${subpartitionKey})`;
            }

            await adapter.executeQuery(sql);

            const result: Record<string, unknown> = {
                success: true,
                partition: `${schema ?? 'public'}.${name}`,
                parent,
                bounds: boundsDescription
            };

            // Include sub-partitioning info in response if applicable
            if (subpartitionBy !== undefined) {
                result['subpartitionBy'] = subpartitionBy;
                result['subpartitionKey'] = subpartitionKey;
            }

            return result;
        }
    };
}

function createAttachPartitionTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_attach_partition',
        description: 'Attach an existing table as a partition.',
        group: 'partitioning',
        inputSchema: AttachPartitionSchema,
        annotations: write('Attach Partition'),
        icons: getToolIcons('partitioning', write('Attach Partition')),
        handler: async (params: unknown, _context: RequestContext) => {
            const { parent, partition, forValues } = AttachPartitionSchema.parse(params);

            const parentName = sanitizeTableName(parent);
            const partitionName = sanitizeTableName(partition);

            const sql = `ALTER TABLE ${parentName} ATTACH PARTITION ${partitionName} FOR VALUES ${forValues}`;
            await adapter.executeQuery(sql);

            return { success: true, parent, partition, bounds: forValues };
        }
    };
}

function createDetachPartitionTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_detach_partition',
        description: 'Detach a partition. Use concurrently: true for non-blocking. Use finalize: true only after an interrupted CONCURRENTLY detach.',
        group: 'partitioning',
        inputSchema: DetachPartitionSchema,
        annotations: destructive('Detach Partition'),
        icons: getToolIcons('partitioning', destructive('Detach Partition')),
        handler: async (params: unknown, _context: RequestContext) => {
            const { parent, partition, concurrently, finalize } = DetachPartitionSchema.parse(params);

            const parentName = sanitizeTableName(parent);
            const partitionName = sanitizeTableName(partition);

            // Build the appropriate clause
            let clause = '';
            if (finalize === true) {
                // FINALIZE is used to complete an interrupted CONCURRENTLY detach
                clause = ' FINALIZE';
            } else if (concurrently === true) {
                clause = ' CONCURRENTLY';
            }

            const sql = `ALTER TABLE ${parentName} DETACH PARTITION ${partitionName}${clause}`;
            await adapter.executeQuery(sql);

            return { success: true, parent, detached: partition };
        }
    };
}

function createPartitionInfoTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_partition_info',
        description: 'Get detailed information about a partitioned table. Returns warning if table is not partitioned.',
        group: 'partitioning',
        inputSchema: z.object({
            table: z.string(),
            schema: z.string().optional()
        }),
        annotations: readOnly('Partition Info'),
        icons: getToolIcons('partitioning', readOnly('Partition Info')),
        handler: async (params: unknown, _context: RequestContext) => {
            const parsed = (params as { table: string; schema?: string });
            const schemaName = parsed.schema ?? 'public';

            // Check table existence and partition status
            const tableStatus = await checkTablePartitionStatus(adapter, parsed.table, schemaName);
            if (tableStatus === 'not_found') {
                return {
                    tableInfo: null,
                    partitions: [],
                    totalSizeBytes: 0,
                    warning: `Table '${schemaName}.${parsed.table}' does not exist.`
                };
            }
            if (tableStatus === 'not_partitioned') {
                return {
                    tableInfo: null,
                    partitions: [],
                    totalSizeBytes: 0,
                    warning: `Table '${schemaName}.${parsed.table}' exists but is not partitioned. Use pg_create_partitioned_table to create a partitioned table.`
                };
            }

            const partInfoSql = `SELECT 
                        c.relname as table_name,
                        CASE pt.partstrat 
                            WHEN 'r' THEN 'RANGE'
                            WHEN 'l' THEN 'LIST'
                            WHEN 'h' THEN 'HASH'
                        END as partition_strategy,
                        pg_get_partkeydef(c.oid) as partition_key,
                        (SELECT count(*) FROM pg_inherits WHERE inhparent = c.oid) as partition_count
                        FROM pg_class c
                        JOIN pg_partitioned_table pt ON c.oid = pt.partrelid
                        JOIN pg_namespace n ON c.relnamespace = n.oid
                        WHERE c.relname = $1 AND n.nspname = $2`;

            const partInfo = await adapter.executeQuery(partInfoSql, [parsed.table, schemaName]);

            const partitionsSql = `SELECT 
                        c.relname as partition_name,
                        pg_get_expr(c.relpartbound, c.oid) as bounds,
                        pg_table_size(c.oid) as size_bytes,
                        GREATEST(0, (SELECT reltuples::bigint FROM pg_class WHERE oid = c.oid)) as approx_rows
                        FROM pg_class c
                        JOIN pg_inherits i ON c.oid = i.inhrelid
                        WHERE i.inhparent = ($1 || '.' || $2)::regclass
                        ORDER BY c.relname`;

            const partitionsResult = await adapter.executeQuery(partitionsSql, [schemaName, parsed.table]);

            // Calculate total size before mapping
            const totalSizeBytes = (partitionsResult.rows ?? []).reduce(
                (sum, row) => sum + Number(row['size_bytes'] ?? 0), 0
            );

            // Format sizes consistently and ensure approx_rows is a number
            const partitions = (partitionsResult.rows ?? []).map(row => {
                const sizeBytes = Number(row['size_bytes'] ?? 0);
                return {
                    ...row,
                    size: formatBytes(sizeBytes),
                    approx_rows: Number(row['approx_rows'] ?? 0)
                };
            });

            return {
                tableInfo: partInfo.rows?.[0],
                partitions,
                totalSizeBytes
            };
        }
    };
}
