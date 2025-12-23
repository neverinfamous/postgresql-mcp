/**
 * PostgreSQL Core Tools - Table Operations
 * 
 * Table listing, description, creation, and deletion tools.
 */

import type { PostgresAdapter } from '../../PostgresAdapter.js';
import type { ToolDefinition, RequestContext } from '../../../../types/index.js';
import { readOnly, write, destructive } from '../../../../utils/annotations.js';
import { getToolIcons } from '../../../../utils/icons.js';
import { ListTablesSchema, DescribeTableSchema, CreateTableSchema, DropTableSchema } from '../../schemas/index.js';

/**
 * List all tables in the database
 */
export function createListTablesTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_list_tables',
        description: 'List all tables, views, and materialized views with metadata.',
        group: 'core',
        inputSchema: ListTablesSchema,
        annotations: readOnly('List Tables'),
        icons: getToolIcons('core', readOnly('List Tables')),
        handler: async (params: unknown, _context: RequestContext) => {
            const { schema } = ListTablesSchema.parse(params);
            let tables = await adapter.listTables();

            if (schema) {
                tables = tables.filter(t => t.schema === schema);
            }

            return {
                tables,
                data: tables,  // Alias for consistency with array-expecting code
                count: tables.length
            };
        }
    };
}

/**
 * Describe a table's structure
 */
export function createDescribeTableTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_describe_table',
        description: 'Get detailed table structure including columns, types, and constraints.',
        group: 'core',
        inputSchema: DescribeTableSchema,
        annotations: readOnly('Describe Table'),
        icons: getToolIcons('core', readOnly('Describe Table')),
        handler: async (params: unknown, _context: RequestContext) => {
            const { table, schema } = DescribeTableSchema.parse(params);
            return adapter.describeTable(table, schema);
        }
    };
}

/**
 * Create a new table
 */
export function createCreateTableTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_create_table',
        description: 'Create a new table with specified columns and constraints.',
        group: 'core',
        inputSchema: CreateTableSchema,
        annotations: write('Create Table'),
        icons: getToolIcons('core', write('Create Table')),
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
export function createDropTableTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_drop_table',
        description: 'Drop a table from the database.',
        group: 'core',
        inputSchema: DropTableSchema,
        annotations: destructive('Drop Table'),
        icons: getToolIcons('core', destructive('Drop Table')),
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
