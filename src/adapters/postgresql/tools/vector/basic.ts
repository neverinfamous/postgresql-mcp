/**
 * PostgreSQL pgvector - Basic Operations
 */

import type { PostgresAdapter } from '../../PostgresAdapter.js';
import type { ToolDefinition, RequestContext } from '../../../../types/index.js';
import { z } from 'zod';
import { readOnly, write } from '../../../../utils/annotations.js';
import { getToolIcons } from '../../../../utils/icons.js';
import { sanitizeIdentifier, sanitizeTableName } from '../../../../utils/identifiers.js';
import { VectorSearchSchema, VectorCreateIndexSchema } from '../../schemas/index.js';

export function createVectorExtensionTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_vector_create_extension',
        description: 'Enable the pgvector extension for vector similarity search.',
        group: 'vector',
        inputSchema: z.object({}),
        annotations: write('Create Vector Extension'),
        icons: getToolIcons('vector', write('Create Vector Extension')),
        handler: async (_params: unknown, _context: RequestContext) => {
            await adapter.executeQuery('CREATE EXTENSION IF NOT EXISTS vector');
            return { success: true, message: 'pgvector extension enabled' };
        }
    };
}

export function createVectorAddColumnTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_vector_add_column',
        description: 'Add a vector column to a table.',
        group: 'vector',
        inputSchema: z.object({
            table: z.string(),
            column: z.string(),
            dimensions: z.number().describe('Vector dimensions (e.g., 1536 for OpenAI)'),
            schema: z.string().optional()
        }),
        annotations: write('Add Vector Column'),
        icons: getToolIcons('vector', write('Add Vector Column')),
        handler: async (params: unknown, _context: RequestContext) => {
            const parsed = (params as { table: string; column: string; dimensions: number; schema?: string });
            const tableName = sanitizeTableName(parsed.table, parsed.schema);
            const columnName = sanitizeIdentifier(parsed.column);

            const sql = `ALTER TABLE ${tableName} ADD COLUMN ${columnName} vector(${String(parsed.dimensions)})`;
            await adapter.executeQuery(sql);
            return { success: true, table: parsed.table, column: parsed.column, dimensions: parsed.dimensions };
        }
    };
}

export function createVectorInsertTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_vector_insert',
        description: 'Insert a vector into a table.',
        group: 'vector',
        inputSchema: z.object({
            table: z.string(),
            column: z.string(),
            vector: z.array(z.number()),
            additionalColumns: z.record(z.string(), z.unknown()).optional(),
            schema: z.string().optional()
        }),
        annotations: write('Insert Vector'),
        icons: getToolIcons('vector', write('Insert Vector')),
        handler: async (params: unknown, _context: RequestContext) => {
            const parsed = (params as {
                table: string;
                column: string;
                vector: number[];
                additionalColumns?: Record<string, unknown>;
                schema?: string;
            });

            const tableName = sanitizeTableName(parsed.table, parsed.schema);
            const columnName = sanitizeIdentifier(parsed.column);
            const vectorStr = `[${parsed.vector.join(',')}]`;

            const columns = [columnName];
            const values = [vectorStr];
            const params_: unknown[] = [];
            let paramIndex = 1;

            if (parsed.additionalColumns) {
                for (const [col, val] of Object.entries(parsed.additionalColumns)) {
                    columns.push(sanitizeIdentifier(col));
                    values.push(`$${String(paramIndex++)}`);
                    params_.push(val);
                }
            }

            const sql = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES ('${vectorStr}'${params_.length > 0 ? ', ' + values.slice(1).join(', ') : ''})`;
            const result = await adapter.executeQuery(sql, params_);
            return { success: true, rowsAffected: result.rowsAffected };
        }
    };
}

export function createVectorSearchTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_vector_search',
        description: 'Search for similar vectors using L2, cosine, or inner product distance.',
        group: 'vector',
        inputSchema: VectorSearchSchema,
        annotations: readOnly('Vector Search'),
        icons: getToolIcons('vector', readOnly('Vector Search')),
        handler: async (params: unknown, _context: RequestContext) => {
            const { table, column, vector, metric, limit, select, where } = VectorSearchSchema.parse(params);

            const tableName = sanitizeTableName(table);
            const columnName = sanitizeIdentifier(column);
            const vectorStr = `[${vector.join(',')}]`;
            const limitVal = limit !== undefined && limit > 0 ? limit : 10;
            const selectCols = select !== undefined && select.length > 0 ? select.map(c => sanitizeIdentifier(c)).join(', ') + ', ' : '';
            const whereClause = where ? ` AND ${where}` : '';

            let distanceExpr: string;
            switch (metric) {
                case 'cosine':
                    distanceExpr = `${columnName} <=> '${vectorStr}'`;
                    break;
                case 'inner_product':
                    distanceExpr = `${columnName} <#> '${vectorStr}'`;
                    break;
                default: // l2
                    distanceExpr = `${columnName} <-> '${vectorStr}'`;
            }

            const sql = `SELECT ${selectCols}${distanceExpr} as distance
                        FROM ${tableName}
                        WHERE TRUE${whereClause}
                        ORDER BY ${distanceExpr}
                        LIMIT ${String(limitVal)}`;

            const result = await adapter.executeQuery(sql);
            return { results: result.rows, count: result.rows?.length ?? 0, metric: metric ?? 'l2' };
        }
    };
}

export function createVectorCreateIndexTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_vector_create_index',
        description: 'Create an IVFFlat or HNSW index for vector similarity search.',
        group: 'vector',
        inputSchema: VectorCreateIndexSchema,
        annotations: write('Create Vector Index'),
        icons: getToolIcons('vector', write('Create Vector Index')),
        handler: async (params: unknown, _context: RequestContext) => {
            const { table, column, type, lists, m, efConstruction } = VectorCreateIndexSchema.parse(params);

            const tableName = sanitizeTableName(table);
            const columnName = sanitizeIdentifier(column);
            const indexNameRaw = `idx_${table}_${column}_${type}`;
            const indexName = sanitizeIdentifier(indexNameRaw);
            let withClause = '';

            if (type === 'ivfflat') {
                const numLists = lists ?? 100;
                withClause = `WITH (lists = ${String(numLists)})`;
            } else { // hnsw
                const mVal = m ?? 16;
                const efVal = efConstruction ?? 64;
                withClause = `WITH (m = ${String(mVal)}, ef_construction = ${String(efVal)})`;
            }

            const sql = `CREATE INDEX ${indexName} ON ${tableName} USING ${type} (${columnName} vector_l2_ops) ${withClause}`;
            await adapter.executeQuery(sql);
            return { success: true, index: indexNameRaw, type, table, column };
        }
    };
}

export function createVectorDistanceTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_vector_distance',
        description: 'Calculate distance between two vectors.',
        group: 'vector',
        inputSchema: z.object({
            vector1: z.array(z.number()),
            vector2: z.array(z.number()),
            metric: z.enum(['l2', 'cosine', 'inner_product']).optional()
        }),
        annotations: readOnly('Vector Distance'),
        icons: getToolIcons('vector', readOnly('Vector Distance')),
        handler: async (params: unknown, _context: RequestContext) => {
            const parsed = (params as { vector1: number[]; vector2: number[]; metric?: string });
            const v1 = `[${parsed.vector1.join(',')}]`;
            const v2 = `[${parsed.vector2.join(',')}]`;

            let op: string;
            switch (parsed.metric) {
                case 'cosine': op = '<=>'; break;
                case 'inner_product': op = '<#>'; break;
                default: op = '<->'; // l2
            }

            const sql = `SELECT '${v1}'::vector ${op} '${v2}'::vector as distance`;
            const result = await adapter.executeQuery(sql);
            return { distance: result.rows?.[0]?.['distance'], metric: parsed.metric ?? 'l2' };
        }
    };
}

export function createVectorNormalizeTool(): ToolDefinition {
    return {
        name: 'pg_vector_normalize',
        description: 'Normalize a vector to unit length.',
        group: 'vector',
        inputSchema: z.object({
            vector: z.array(z.number())
        }),
        annotations: readOnly('Normalize Vector'),
        icons: getToolIcons('vector', readOnly('Normalize Vector')),
        // eslint-disable-next-line @typescript-eslint/require-await
        handler: async (params: unknown, _context: RequestContext) => {
            const parsed = (params as { vector: number[] });

            const magnitude = Math.sqrt(parsed.vector.reduce((sum, x) => sum + x * x, 0));
            const normalized = parsed.vector.map(x => x / magnitude);

            return { normalized, magnitude };
        }
    };
}

export function createVectorAggregateTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_vector_aggregate',
        description: 'Calculate average vector for a group of rows.',
        group: 'vector',
        inputSchema: z.object({
            table: z.string(),
            column: z.string(),
            where: z.string().optional()
        }),
        annotations: readOnly('Vector Aggregate'),
        icons: getToolIcons('vector', readOnly('Vector Aggregate')),
        handler: async (params: unknown, _context: RequestContext) => {
            const parsed = (params as { table: string; column: string; where?: string });
            const whereClause = parsed.where ? ` WHERE ${parsed.where}` : '';

            const tableName = sanitizeTableName(parsed.table);
            const columnName = sanitizeIdentifier(parsed.column);

            const sql = `SELECT avg(${columnName}) as average_vector, count(*) as count
                        FROM ${tableName}${whereClause}`;

            const result = await adapter.executeQuery(sql);
            return result.rows?.[0];
        }
    };
}
