/**
 * PostgreSQL ltree Extension Tools
 * 
 * Hierarchical tree-structured label storage and querying.
 * 8 tools total.
 * 
 * ltree enables efficient storage and querying of hierarchical data:
 * - Label paths like "Top.Science.Astronomy.Stars"
 * - Ancestry operators (@>, <@) for parent/child queries
 * - Pattern matching with lquery and ltxtquery
 * - GiST index support for fast tree traversal
 * 
 * Use cases: taxonomies, org charts, file trees, ontologies, knowledge graphs
 */

import type { PostgresAdapter } from '../PostgresAdapter.js';
import type { ToolDefinition, RequestContext } from '../../../types/index.js';
import { z } from 'zod';
import {
    LtreeQuerySchema,
    LtreeSubpathSchema,
    LtreeLcaSchema,
    LtreeMatchSchema,
    LtreeListColumnsSchema,
    LtreeConvertColumnSchema,
    LtreeIndexSchema
} from '../types.js';

/**
 * Get all ltree tools
 */
export function getLtreeTools(adapter: PostgresAdapter): ToolDefinition[] {
    return [
        createLtreeExtensionTool(adapter),
        createLtreeQueryTool(adapter),
        createLtreeSubpathTool(adapter),
        createLtreeLcaTool(adapter),
        createLtreeMatchTool(adapter),
        createLtreeListColumnsTool(adapter),
        createLtreeConvertColumnTool(adapter),
        createLtreeCreateIndexTool(adapter)
    ];
}

/**
 * Enable the ltree extension
 */
function createLtreeExtensionTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_ltree_create_extension',
        description: `Enable the ltree extension for hierarchical tree-structured labels.
ltree is ideal for taxonomies, org charts, file paths, and knowledge graphs.`,
        group: 'ltree',
        inputSchema: z.object({}),
        handler: async (_params: unknown, _context: RequestContext) => {
            await adapter.executeQuery('CREATE EXTENSION IF NOT EXISTS ltree');
            return {
                success: true,
                message: 'ltree extension enabled',
                usage: 'Create columns with type LTREE for hierarchical paths like "Top.Science.Astronomy"'
            };
        }
    };
}

/**
 * Query ltree hierarchies (ancestors/descendants)
 */
function createLtreeQueryTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_ltree_query',
        description: `Query hierarchical relationships in ltree columns.
Modes:
- descendants: Find all nodes below a path (path <@ column)
- ancestors: Find all nodes above a path (path @> column)  
- exact: Find exact path match`,
        group: 'ltree',
        inputSchema: LtreeQuerySchema,
        handler: async (params: unknown, _context: RequestContext) => {
            const { table, column, path, mode, schema, limit } = LtreeQuerySchema.parse(params);
            const schemaName = schema ?? 'public';
            const queryMode = mode ?? 'descendants';
            const qualifiedTable = `"${schemaName}"."${table}"`;

            // Check if ltree extension is installed
            const extCheck = await adapter.executeQuery(`
                SELECT EXISTS(
                    SELECT 1 FROM pg_extension WHERE extname = 'ltree'
                ) as installed
            `);

            const hasExt = extCheck.rows?.[0]?.['installed'] as boolean ?? false;
            if (!hasExt) {
                return {
                    success: false,
                    error: 'ltree extension is not installed',
                    hint: 'Run pg_ltree_create_extension first'
                };
            }

            let operator: string;
            switch (queryMode) {
                case 'ancestors':
                    operator = '@>';
                    break;
                case 'exact':
                    operator = '=';
                    break;
                case 'descendants':
                default:
                    operator = '<@';
            }

            const limitClause = limit !== undefined ? `LIMIT ${String(limit)}` : '';

            const sql = `
                SELECT *, nlevel("${column}") as depth
                FROM ${qualifiedTable}
                WHERE "${column}" ${operator} $1::ltree
                ORDER BY "${column}"
                ${limitClause}
            `;

            const result = await adapter.executeQuery(sql, [path]);

            return {
                path,
                mode: queryMode,
                results: result.rows ?? [],
                count: result.rows?.length ?? 0
            };
        }
    };
}

/**
 * Extract subpath from ltree
 */
function createLtreeSubpathTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_ltree_subpath',
        description: `Extract a portion of an ltree path.
Examples:
- subpath("Top.Science.Astronomy.Stars", 1, 2) → "Science.Astronomy"
- subpath("Top.Science.Astronomy.Stars", -2) → "Astronomy.Stars"`,
        group: 'ltree',
        inputSchema: LtreeSubpathSchema,
        handler: async (params: unknown, _context: RequestContext) => {
            const { path, offset, length } = LtreeSubpathSchema.parse(params);

            // Check if ltree extension is installed
            const extCheck = await adapter.executeQuery(`
                SELECT EXISTS(
                    SELECT 1 FROM pg_extension WHERE extname = 'ltree'
                ) as installed
            `);

            const hasExt = extCheck.rows?.[0]?.['installed'] as boolean ?? false;
            if (!hasExt) {
                return {
                    success: false,
                    error: 'ltree extension is not installed',
                    hint: 'Run pg_ltree_create_extension first'
                };
            }

            let sql: string;
            let queryParams: unknown[];

            if (length !== undefined) {
                sql = `SELECT subpath($1::ltree, $2, $3) as subpath, nlevel($1::ltree) as original_depth`;
                queryParams = [path, offset, length];
            } else {
                sql = `SELECT subpath($1::ltree, $2) as subpath, nlevel($1::ltree) as original_depth`;
                queryParams = [path, offset];
            }

            const result = await adapter.executeQuery(sql, queryParams);
            const row = result.rows?.[0];

            return {
                originalPath: path,
                offset,
                length: length ?? 'to end',
                subpath: row?.['subpath'] as string,
                originalDepth: row?.['original_depth'] as number
            };
        }
    };
}

/**
 * Find longest common ancestor
 */
function createLtreeLcaTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_ltree_lca',
        description: `Find the longest common ancestor of multiple ltree paths.
Example: lca("Top.Science.Astronomy", "Top.Science.Physics") → "Top.Science"`,
        group: 'ltree',
        inputSchema: LtreeLcaSchema,
        handler: async (params: unknown, _context: RequestContext) => {
            const { paths } = LtreeLcaSchema.parse(params);

            // Check if ltree extension is installed
            const extCheck = await adapter.executeQuery(`
                SELECT EXISTS(
                    SELECT 1 FROM pg_extension WHERE extname = 'ltree'
                ) as installed
            `);

            const hasExt = extCheck.rows?.[0]?.['installed'] as boolean ?? false;
            if (!hasExt) {
                return {
                    success: false,
                    error: 'ltree extension is not installed',
                    hint: 'Run pg_ltree_create_extension first'
                };
            }

            // Build array literal for lca function
            const arrayLiteral = paths.map(p => `'${p.replace(/'/g, "''")}'::ltree`).join(', ');
            const sql = `SELECT lca(ARRAY[${arrayLiteral}]) as lca`;

            const result = await adapter.executeQuery(sql);
            const lca = result.rows?.[0]?.['lca'] as string | null;

            return {
                paths,
                longestCommonAncestor: lca ?? '',
                hasCommonAncestor: lca !== null && lca !== ''
            };
        }
    };
}

/**
 * Pattern matching with lquery
 */
function createLtreeMatchTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_ltree_match',
        description: `Match ltree paths using lquery pattern syntax.
Pattern syntax:
- * matches any single label
- *.label.* matches label anywhere in path
- label{n} matches exactly n occurrences
- label{n,m} matches n to m occurrences
- !label matches anything except label`,
        group: 'ltree',
        inputSchema: LtreeMatchSchema,
        handler: async (params: unknown, _context: RequestContext) => {
            const { table, column, pattern, schema, limit } = LtreeMatchSchema.parse(params);
            const schemaName = schema ?? 'public';
            const qualifiedTable = `"${schemaName}"."${table}"`;

            // Check if ltree extension is installed
            const extCheck = await adapter.executeQuery(`
                SELECT EXISTS(
                    SELECT 1 FROM pg_extension WHERE extname = 'ltree'
                ) as installed
            `);

            const hasExt = extCheck.rows?.[0]?.['installed'] as boolean ?? false;
            if (!hasExt) {
                return {
                    success: false,
                    error: 'ltree extension is not installed',
                    hint: 'Run pg_ltree_create_extension first'
                };
            }

            const limitClause = limit !== undefined ? `LIMIT ${String(limit)}` : '';

            const sql = `
                SELECT *, nlevel("${column}") as depth
                FROM ${qualifiedTable}
                WHERE "${column}" ~ $1::lquery
                ORDER BY "${column}"
                ${limitClause}
            `;

            const result = await adapter.executeQuery(sql, [pattern]);

            return {
                pattern,
                results: result.rows ?? [],
                count: result.rows?.length ?? 0
            };
        }
    };
}

/**
 * List all ltree columns in the database
 */
function createLtreeListColumnsTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_ltree_list_columns',
        description: `List all columns using the ltree type in the database.
Useful for auditing hierarchical data columns.`,
        group: 'ltree',
        inputSchema: LtreeListColumnsSchema,
        handler: async (params: unknown, _context: RequestContext) => {
            const { schema } = LtreeListColumnsSchema.parse(params);

            const conditions: string[] = [
                "udt_name = 'ltree'",
                "table_schema NOT IN ('pg_catalog', 'information_schema')"
            ];
            const queryParams: unknown[] = [];

            if (schema !== undefined) {
                conditions.push(`table_schema = $1`);
                queryParams.push(schema);
            }

            const sql = `
                SELECT 
                    table_schema,
                    table_name,
                    column_name,
                    is_nullable,
                    column_default
                FROM information_schema.columns
                WHERE ${conditions.join(' AND ')}
                ORDER BY table_schema, table_name, ordinal_position
            `;

            const result = await adapter.executeQuery(sql, queryParams);

            return {
                columns: result.rows ?? [],
                count: result.rows?.length ?? 0
            };
        }
    };
}

/**
 * Convert a text column to ltree
 */
function createLtreeConvertColumnTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_ltree_convert_column',
        description: `Convert an existing TEXT column to LTREE type.
Useful for retrofitting hierarchical data. Text values must be valid ltree paths (labels separated by dots).`,
        group: 'ltree',
        inputSchema: LtreeConvertColumnSchema,
        handler: async (params: unknown, _context: RequestContext) => {
            const { table, column, schema } = LtreeConvertColumnSchema.parse(params);
            const schemaName = schema ?? 'public';
            const qualifiedTable = `"${schemaName}"."${table}"`;

            // Check if ltree extension is installed
            const extCheck = await adapter.executeQuery(`
                SELECT EXISTS(
                    SELECT 1 FROM pg_extension WHERE extname = 'ltree'
                ) as installed
            `);

            const hasExt = extCheck.rows?.[0]?.['installed'] as boolean ?? false;
            if (!hasExt) {
                return {
                    success: false,
                    error: 'ltree extension is not installed',
                    hint: 'Run pg_ltree_create_extension first'
                };
            }

            // Get current column type
            const colCheck = await adapter.executeQuery(`
                SELECT data_type, udt_name
                FROM information_schema.columns 
                WHERE table_schema = $1 
                  AND table_name = $2 
                  AND column_name = $3
            `, [schemaName, table, column]);

            if (!colCheck.rows || colCheck.rows.length === 0) {
                return {
                    success: false,
                    error: `Column ${column} not found in ${qualifiedTable}`
                };
            }

            const udtName = colCheck.rows[0]?.['udt_name'] as string;
            if (udtName === 'ltree') {
                return {
                    success: true,
                    message: `Column ${column} is already ltree`,
                    wasAlreadyLtree: true
                };
            }

            // Convert the column
            await adapter.executeQuery(`
                ALTER TABLE ${qualifiedTable}
                ALTER COLUMN "${column}" TYPE ltree USING "${column}"::ltree
            `);

            return {
                success: true,
                message: `Column ${column} converted to ltree`,
                table: qualifiedTable,
                previousType: colCheck.rows[0]?.['data_type'] as string
            };
        }
    };
}

/**
 * Create GiST index on ltree column
 */
function createLtreeCreateIndexTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_ltree_create_index',
        description: `Create a GiST index on an ltree column for efficient tree queries.
GiST indexes accelerate ancestor/descendant queries (@>, <@) and pattern matching (~).`,
        group: 'ltree',
        inputSchema: LtreeIndexSchema,
        handler: async (params: unknown, _context: RequestContext) => {
            const { table, column, indexName, schema } = LtreeIndexSchema.parse(params);
            const schemaName = schema ?? 'public';
            const qualifiedTable = `"${schemaName}"."${table}"`;
            const idxName = indexName ?? `idx_${table}_${column}_ltree`;

            // Check if ltree extension is installed
            const extCheck = await adapter.executeQuery(`
                SELECT EXISTS(
                    SELECT 1 FROM pg_extension WHERE extname = 'ltree'
                ) as installed
            `);

            const hasExt = extCheck.rows?.[0]?.['installed'] as boolean ?? false;
            if (!hasExt) {
                return {
                    success: false,
                    error: 'ltree extension is not installed',
                    hint: 'Run pg_ltree_create_extension first'
                };
            }

            // Check if index already exists
            const idxCheck = await adapter.executeQuery(`
                SELECT EXISTS(
                    SELECT 1 FROM pg_indexes 
                    WHERE schemaname = $1 
                      AND indexname = $2
                ) as exists
            `, [schemaName, idxName]);

            if (idxCheck.rows?.[0]?.['exists'] as boolean) {
                return {
                    success: true,
                    message: `Index ${idxName} already exists`,
                    indexName: idxName,
                    alreadyExists: true
                };
            }

            // Create the GiST index
            await adapter.executeQuery(`
                CREATE INDEX "${idxName}" ON ${qualifiedTable} USING GIST ("${column}")
            `);

            return {
                success: true,
                message: `GiST index created on ${qualifiedTable}("${column}")`,
                indexName: idxName,
                table: qualifiedTable,
                column,
                indexType: 'gist'
            };
        }
    };
}
