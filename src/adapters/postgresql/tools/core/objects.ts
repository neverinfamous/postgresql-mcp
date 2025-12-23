/**
 * PostgreSQL Core Tools - Object Operations
 * 
 * List and describe database objects (tables, views, functions, etc.).
 */

import type { PostgresAdapter } from '../../PostgresAdapter.js';
import type { ToolDefinition, RequestContext } from '../../../../types/index.js';
import { readOnly } from '../../../../utils/annotations.js';
import { getToolIcons } from '../../../../utils/icons.js';
import { ListObjectsSchema, ObjectDetailsSchema } from './schemas.js';

/**
 * List database objects
 */
export function createListObjectsTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_list_objects',
        description: 'List all database objects (tables, views, functions, sequences, indexes, triggers) with metadata.',
        group: 'core',
        annotations: readOnly('List Objects'),
        icons: getToolIcons('core', readOnly('List Objects')),
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
export function createObjectDetailsTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_object_details',
        description: 'Get detailed metadata for a specific database object (table, view, function, sequence, index).',
        group: 'core',
        inputSchema: ObjectDetailsSchema,
        annotations: readOnly('Object Details'),
        icons: getToolIcons('core', readOnly('Object Details')),
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
                // Use pg_sequence catalog table for cross-version compatibility
                // pg_sequences view has different column names across PG versions
                const sql = `
                    SELECT 
                        s.seqstart as start_value,
                        s.seqmin as min_value,
                        s.seqmax as max_value,
                        s.seqincrement as increment,
                        s.seqcycle as cycle,
                        s.seqcache as cache,
                        pg_get_userbyid(c.relowner) as owner
                    FROM pg_sequence s
                    JOIN pg_class c ON c.oid = s.seqrelid
                    JOIN pg_namespace n ON n.oid = c.relnamespace
                    WHERE n.nspname = $1 AND c.relname = $2
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
