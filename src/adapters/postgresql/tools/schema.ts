/**
 * PostgreSQL Schema Management Tools
 * 
 * Schema DDL operations: schemas, sequences, views, functions, triggers.
 * 10 tools total.
 */

import type { PostgresAdapter } from '../PostgresAdapter.js';
import type { ToolDefinition, RequestContext } from '../../../types/index.js';
import { z } from 'zod';
import { readOnly, write, destructive } from '../../../utils/annotations.js';
import { getToolIcons } from '../../../utils/icons.js';
import { sanitizeIdentifier } from '../../../utils/identifiers.js';
import { CreateSchemaSchema, DropSchemaSchema, CreateSequenceSchema, CreateViewSchema } from '../schemas/index.js';

/**
 * Get all schema management tools
 */
export function getSchemaTools(adapter: PostgresAdapter): ToolDefinition[] {
    return [
        createListSchemasTool(adapter),
        createCreateSchemaTool(adapter),
        createDropSchemaTool(adapter),
        createListSequencesTool(adapter),
        createCreateSequenceTool(adapter),
        createListViewsTool(adapter),
        createCreateViewTool(adapter),
        createListFunctionsTool(adapter),
        createListTriggersTool(adapter),
        createListConstraintsTool(adapter)
    ];
}

function createListSchemasTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_list_schemas',
        description: 'List all schemas in the database.',
        group: 'schema',
        inputSchema: z.object({}),
        annotations: readOnly('List Schemas'),
        icons: getToolIcons('schema', readOnly('List Schemas')),
        handler: async (_params: unknown, _context: RequestContext) => {
            const schemas = await adapter.listSchemas();
            return { schemas, count: schemas.length };
        }
    };
}

function createCreateSchemaTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_create_schema',
        description: 'Create a new schema.',
        group: 'schema',
        inputSchema: CreateSchemaSchema,
        annotations: write('Create Schema'),
        icons: getToolIcons('schema', write('Create Schema')),
        handler: async (params: unknown, _context: RequestContext) => {
            const { name, authorization, ifNotExists } = CreateSchemaSchema.parse(params);
            const ifNotExistsClause = ifNotExists ? 'IF NOT EXISTS ' : '';
            const schemaName = sanitizeIdentifier(name);
            const authClause = authorization ? ` AUTHORIZATION ${sanitizeIdentifier(authorization)}` : '';

            const sql = `CREATE SCHEMA ${ifNotExistsClause}${schemaName}${authClause}`;
            await adapter.executeQuery(sql);
            return { success: true, schema: name };
        }
    };
}

function createDropSchemaTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_drop_schema',
        description: 'Drop a schema (optionally with all objects).',
        group: 'schema',
        inputSchema: DropSchemaSchema,
        annotations: destructive('Drop Schema'),
        icons: getToolIcons('schema', destructive('Drop Schema')),
        handler: async (params: unknown, _context: RequestContext) => {
            const { name, cascade, ifExists } = DropSchemaSchema.parse(params);
            const ifExistsClause = ifExists ? 'IF EXISTS ' : '';
            const cascadeClause = cascade ? ' CASCADE' : '';
            const schemaName = sanitizeIdentifier(name);

            const sql = `DROP SCHEMA ${ifExistsClause}${schemaName}${cascadeClause}`;
            await adapter.executeQuery(sql);
            return { success: true, dropped: name };
        }
    };
}

function createListSequencesTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_list_sequences',
        description: 'List all sequences in the database.',
        group: 'schema',
        inputSchema: z.object({
            schema: z.string().optional()
        }),
        annotations: readOnly('List Sequences'),
        icons: getToolIcons('schema', readOnly('List Sequences')),
        handler: async (params: unknown, _context: RequestContext) => {
            const parsed = (params as { schema?: string });
            const schemaClause = parsed.schema ? `AND n.nspname = '${parsed.schema}'` : '';

            const sql = `SELECT n.nspname as schema, c.relname as name,
                        pg_get_serial_sequence(n.nspname || '.' || t.relname, a.attname) as owned_by
                        FROM pg_class c
                        JOIN pg_namespace n ON n.oid = c.relnamespace
                        LEFT JOIN pg_depend d ON d.objid = c.oid AND d.classid = 'pg_class'::regclass
                        LEFT JOIN pg_class t ON t.oid = d.refobjid
                        LEFT JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = d.refobjsubid
                        WHERE c.relkind = 'S'
                        AND n.nspname NOT IN ('pg_catalog', 'information_schema')
                        ${schemaClause}
                        ORDER BY n.nspname, c.relname`;

            const result = await adapter.executeQuery(sql);
            return { sequences: result.rows };
        }
    };
}

function createCreateSequenceTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_create_sequence',
        description: 'Create a new sequence.',
        group: 'schema',
        inputSchema: CreateSequenceSchema,
        annotations: write('Create Sequence'),
        icons: getToolIcons('schema', write('Create Sequence')),
        handler: async (params: unknown, _context: RequestContext) => {
            const { name, schema, start, increment, minValue, maxValue, cycle } = CreateSequenceSchema.parse(params);

            const schemaPrefix = schema ? `${sanitizeIdentifier(schema)}.` : '';
            const parts = [`CREATE SEQUENCE ${schemaPrefix}${sanitizeIdentifier(name)}`];

            if (start !== undefined) parts.push(`START WITH ${String(start)}`);
            if (increment !== undefined) parts.push(`INCREMENT BY ${String(increment)}`);
            if (minValue !== undefined) parts.push(`MINVALUE ${String(minValue)}`);
            if (maxValue !== undefined) parts.push(`MAXVALUE ${String(maxValue)}`);
            if (cycle) parts.push('CYCLE');

            const sql = parts.join(' ');
            await adapter.executeQuery(sql);
            return { success: true, sequence: `${schema ?? 'public'}.${name}` };
        }
    };
}

function createListViewsTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_list_views',
        description: 'List all views and materialized views.',
        group: 'schema',
        inputSchema: z.object({
            schema: z.string().optional(),
            includeMaterialized: z.boolean().optional()
        }),
        annotations: readOnly('List Views'),
        icons: getToolIcons('schema', readOnly('List Views')),
        handler: async (params: unknown, _context: RequestContext) => {
            const parsed = (params as { schema?: string; includeMaterialized?: boolean });
            const schemaClause = parsed.schema ? `AND n.nspname = '${parsed.schema}'` : '';
            const kindClause = parsed.includeMaterialized !== false ? "IN ('v', 'm')" : "= 'v'";

            const sql = `SELECT n.nspname as schema, c.relname as name,
                        CASE c.relkind WHEN 'v' THEN 'view' WHEN 'm' THEN 'materialized_view' END as type,
                        pg_get_viewdef(c.oid, true) as definition
                        FROM pg_class c
                        JOIN pg_namespace n ON n.oid = c.relnamespace
                        WHERE c.relkind ${kindClause}
                        AND n.nspname NOT IN ('pg_catalog', 'information_schema')
                        ${schemaClause}
                        ORDER BY n.nspname, c.relname`;

            const result = await adapter.executeQuery(sql);
            return { views: result.rows };
        }
    };
}

function createCreateViewTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_create_view',
        description: 'Create a view or materialized view.',
        group: 'schema',
        inputSchema: CreateViewSchema,
        annotations: write('Create View'),
        icons: getToolIcons('schema', write('Create View')),
        handler: async (params: unknown, _context: RequestContext) => {
            const { name, schema, query, materialized, orReplace } = CreateViewSchema.parse(params);

            const schemaPrefix = schema ? `${sanitizeIdentifier(schema)}.` : '';
            const replaceClause = orReplace && !materialized ? 'OR REPLACE ' : '';
            const matClause = materialized ? 'MATERIALIZED ' : '';
            const viewName = sanitizeIdentifier(name);

            const sql = `CREATE ${replaceClause}${matClause}VIEW ${schemaPrefix}${viewName} AS ${query}`;
            await adapter.executeQuery(sql);
            return { success: true, view: `${schema ?? 'public'}.${name}`, materialized: !!materialized };
        }
    };
}

function createListFunctionsTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_list_functions',
        description: 'List user-defined functions.',
        group: 'schema',
        inputSchema: z.object({
            schema: z.string().optional()
        }),
        annotations: readOnly('List Functions'),
        icons: getToolIcons('schema', readOnly('List Functions')),
        handler: async (params: unknown, _context: RequestContext) => {
            const parsed = (params as { schema?: string });
            const schemaClause = parsed.schema ? `AND n.nspname = '${parsed.schema}'` : '';

            const sql = `SELECT n.nspname as schema, p.proname as name,
                        pg_get_function_arguments(p.oid) as arguments,
                        pg_get_function_result(p.oid) as returns,
                        l.lanname as language,
                        p.provolatile as volatility
                        FROM pg_proc p
                        JOIN pg_namespace n ON n.oid = p.pronamespace
                        JOIN pg_language l ON l.oid = p.prolang
                        WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
                        ${schemaClause}
                        ORDER BY n.nspname, p.proname`;

            const result = await adapter.executeQuery(sql);
            return { functions: result.rows };
        }
    };
}

function createListTriggersTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_list_triggers',
        description: 'List all triggers.',
        group: 'schema',
        inputSchema: z.object({
            schema: z.string().optional(),
            table: z.string().optional()
        }),
        annotations: readOnly('List Triggers'),
        icons: getToolIcons('schema', readOnly('List Triggers')),
        handler: async (params: unknown, _context: RequestContext) => {
            const parsed = (params as { schema?: string; table?: string });
            let whereClause = "n.nspname NOT IN ('pg_catalog', 'information_schema')";
            if (parsed.schema) whereClause += ` AND n.nspname = '${parsed.schema}'`;
            if (parsed.table) whereClause += ` AND c.relname = '${parsed.table}'`;

            const sql = `SELECT n.nspname as schema, c.relname as table_name, t.tgname as name,
                        CASE t.tgtype::int & 2 WHEN 2 THEN 'BEFORE' ELSE 'AFTER' END as timing,
                        CASE 
                            WHEN t.tgtype::int & 4 = 4 THEN 'INSERT'
                            WHEN t.tgtype::int & 8 = 8 THEN 'DELETE'
                            WHEN t.tgtype::int & 16 = 16 THEN 'UPDATE'
                        END as event,
                        p.proname as function_name,
                        t.tgenabled != 'D' as enabled
                        FROM pg_trigger t
                        JOIN pg_class c ON c.oid = t.tgrelid
                        JOIN pg_namespace n ON n.oid = c.relnamespace
                        JOIN pg_proc p ON p.oid = t.tgfoid
                        WHERE NOT t.tgisinternal
                        AND ${whereClause}
                        ORDER BY n.nspname, c.relname, t.tgname`;

            const result = await adapter.executeQuery(sql);
            return { triggers: result.rows };
        }
    };
}

function createListConstraintsTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_list_constraints',
        description: 'List table constraints (primary keys, foreign keys, unique, check).',
        group: 'schema',
        inputSchema: z.object({
            table: z.string().optional(),
            schema: z.string().optional(),
            type: z.enum(['primary_key', 'foreign_key', 'unique', 'check']).optional()
        }),
        annotations: readOnly('List Constraints'),
        icons: getToolIcons('schema', readOnly('List Constraints')),
        handler: async (params: unknown, _context: RequestContext) => {
            const parsed = (params as { table?: string; schema?: string; type?: string });

            let whereClause = "n.nspname NOT IN ('pg_catalog', 'information_schema')";
            if (parsed.schema) whereClause += ` AND n.nspname = '${parsed.schema}'`;
            if (parsed.table) whereClause += ` AND c.relname = '${parsed.table}'`;
            if (parsed.type) {
                const typeMap: Record<string, string> = {
                    'primary_key': 'p',
                    'foreign_key': 'f',
                    'unique': 'u',
                    'check': 'c'
                };
                whereClause += ` AND con.contype = '${typeMap[parsed.type] ?? ''}'`;
            }

            const sql = `SELECT n.nspname as schema, c.relname as table_name, con.conname as name,
                        CASE con.contype 
                            WHEN 'p' THEN 'primary_key'
                            WHEN 'f' THEN 'foreign_key'
                            WHEN 'u' THEN 'unique'
                            WHEN 'c' THEN 'check'
                        END as type,
                        pg_get_constraintdef(con.oid) as definition
                        FROM pg_constraint con
                        JOIN pg_class c ON c.oid = con.conrelid
                        JOIN pg_namespace n ON n.oid = c.relnamespace
                        WHERE ${whereClause}
                        ORDER BY n.nspname, c.relname, con.conname`;

            const result = await adapter.executeQuery(sql);
            return { constraints: result.rows };
        }
    };
}
