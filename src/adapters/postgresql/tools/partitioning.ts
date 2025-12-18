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
        description: 'List all partitions of a partitioned table.',
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

            const sql = `SELECT 
                        c.relname as partition_name,
                        pg_get_expr(c.relpartbound, c.oid) as partition_bounds,
                        pg_size_pretty(pg_table_size(c.oid)) as size,
                        (SELECT relname FROM pg_class WHERE oid = i.inhparent) as parent_table
                        FROM pg_class c
                        JOIN pg_inherits i ON c.oid = i.inhrelid
                        JOIN pg_namespace n ON c.relnamespace = n.oid
                        WHERE i.inhparent = ($1 || '.' || $2)::regclass
                        ORDER BY c.relname`;

            const result = await adapter.executeQuery(sql, [schemaName, parsed.table]);
            return { partitions: result.rows, count: result.rows?.length ?? 0 };
        }
    };
}

function createPartitionedTableTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_create_partitioned_table',
        description: 'Create a partitioned table with RANGE, LIST, or HASH partitioning.',
        group: 'partitioning',
        inputSchema: CreatePartitionedTableSchema,
        annotations: write('Create Partitioned Table'),
        icons: getToolIcons('partitioning', write('Create Partitioned Table')),
        handler: async (params: unknown, _context: RequestContext) => {
            const { name, schema, columns, partitionBy, partitionKey } = CreatePartitionedTableSchema.parse(params);

            const tableName = sanitizeTableName(name, schema);

            const columnDefs = columns.map(col => {
                let def = `${sanitizeIdentifier(col.name)} ${col.type}`;
                if (col.nullable === false) def += ' NOT NULL';
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
        description: 'Create a new partition for a partitioned table.',
        group: 'partitioning',
        inputSchema: CreatePartitionSchema,
        annotations: write('Create Partition'),
        icons: getToolIcons('partitioning', write('Create Partition')),
        handler: async (params: unknown, _context: RequestContext) => {
            const { parent, name, schema, forValues } = CreatePartitionSchema.parse(params);

            const partitionName = sanitizeTableName(name, schema);
            const parentName = sanitizeTableName(parent, schema);

            const sql = `CREATE TABLE ${partitionName} PARTITION OF ${parentName} FOR VALUES ${forValues}`;
            await adapter.executeQuery(sql);

            return { success: true, partition: `${schema ?? 'public'}.${name}`, parent, bounds: forValues };
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
        description: 'Detach a partition from a partitioned table.',
        group: 'partitioning',
        inputSchema: DetachPartitionSchema,
        annotations: destructive('Detach Partition'),
        icons: getToolIcons('partitioning', destructive('Detach Partition')),
        handler: async (params: unknown, _context: RequestContext) => {
            const { parent, partition, concurrently } = DetachPartitionSchema.parse(params);

            const parentName = sanitizeTableName(parent);
            const partitionName = sanitizeTableName(partition);
            const concurrentlyClause = concurrently ? ' CONCURRENTLY' : '';

            const sql = `ALTER TABLE ${parentName} DETACH PARTITION ${partitionName}${concurrentlyClause}`;
            await adapter.executeQuery(sql);

            return { success: true, parent, detached: partition };
        }
    };
}

function createPartitionInfoTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_partition_info',
        description: 'Get detailed information about a partitioned table.',
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
                        pg_size_pretty(pg_table_size(c.oid)) as size,
                        pg_table_size(c.oid) as size_bytes,
                        (SELECT reltuples::bigint FROM pg_class WHERE oid = c.oid) as approx_rows
                        FROM pg_class c
                        JOIN pg_inherits i ON c.oid = i.inhrelid
                        WHERE i.inhparent = ($1 || '.' || $2)::regclass
                        ORDER BY c.relname`;

            const partitions = await adapter.executeQuery(partitionsSql, [schemaName, parsed.table]);

            return {
                tableInfo: partInfo.rows?.[0],
                partitions: partitions.rows,
                totalSizeBytes: partitions.rows?.reduce((sum, p) => sum + Number(p['size_bytes'] ?? 0), 0)
            };
        }
    };
}
