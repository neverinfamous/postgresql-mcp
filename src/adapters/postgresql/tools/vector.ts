/**
 * PostgreSQL pgvector Extension Tools
 * 
 * Vector similarity search operations.
 * 14 tools total.
 */

import type { PostgresAdapter } from '../PostgresAdapter.js';
import type { ToolDefinition, RequestContext } from '../../../types/index.js';
import { z } from 'zod';
import { VectorSearchSchema, VectorCreateIndexSchema } from '../types.js';

/**
 * Get all pgvector tools
 */
export function getVectorTools(adapter: PostgresAdapter): ToolDefinition[] {
    return [
        createVectorExtensionTool(adapter),
        createVectorAddColumnTool(adapter),
        createVectorInsertTool(adapter),
        createVectorSearchTool(adapter),
        createVectorCreateIndexTool(adapter),
        createVectorDistanceTool(adapter),
        createVectorNormalizeTool(),
        createVectorAggregateTool(adapter),
        // New advanced tools from old server
        createVectorClusterTool(adapter),
        createVectorIndexOptimizeTool(adapter),
        createHybridSearchTool(adapter),
        createVectorPerformanceTool(adapter),
        createVectorDimensionReduceTool(adapter),
        createVectorEmbedTool()
    ];
}

function createVectorExtensionTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_vector_create_extension',
        description: 'Enable the pgvector extension for vector similarity search.',
        group: 'vector',
        inputSchema: z.object({}),
        handler: async (_params: unknown, _context: RequestContext) => {
            await adapter.executeQuery('CREATE EXTENSION IF NOT EXISTS vector');
            return { success: true, message: 'pgvector extension enabled' };
        }
    };
}

function createVectorAddColumnTool(adapter: PostgresAdapter): ToolDefinition {
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
        handler: async (params: unknown, _context: RequestContext) => {
            const parsed = (params as { table: string; column: string; dimensions: number; schema?: string });
            const tableName = parsed.schema ? `"${parsed.schema}"."${parsed.table}"` : `"${parsed.table}"`;

            const sql = `ALTER TABLE ${tableName} ADD COLUMN "${parsed.column}" vector(${String(parsed.dimensions)})`;
            await adapter.executeQuery(sql);
            return { success: true, table: parsed.table, column: parsed.column, dimensions: parsed.dimensions };
        }
    };
}

function createVectorInsertTool(adapter: PostgresAdapter): ToolDefinition {
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
        handler: async (params: unknown, _context: RequestContext) => {
            const parsed = (params as {
                table: string;
                column: string;
                vector: number[];
                additionalColumns?: Record<string, unknown>;
                schema?: string;
            });

            const tableName = parsed.schema ? `"${parsed.schema}"."${parsed.table}"` : `"${parsed.table}"`;
            const vectorStr = `[${parsed.vector.join(',')}]`;

            const columns = [`"${parsed.column}"`];
            const values = [vectorStr];
            const params_: unknown[] = [];
            let paramIndex = 1;

            if (parsed.additionalColumns) {
                for (const [col, val] of Object.entries(parsed.additionalColumns)) {
                    columns.push(`"${col}"`);
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

function createVectorSearchTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_vector_search',
        description: 'Search for similar vectors using L2, cosine, or inner product distance.',
        group: 'vector',
        inputSchema: VectorSearchSchema,
        handler: async (params: unknown, _context: RequestContext) => {
            const { table, column, vector, metric, limit, select, where } = VectorSearchSchema.parse(params);

            const vectorStr = `[${vector.join(',')}]`;
            const limitVal = limit !== undefined && limit > 0 ? limit : 10;
            const selectCols = select !== undefined && select.length > 0 ? select.map(c => `"${c}"`).join(', ') + ', ' : '';
            const whereClause = where ? ` AND ${where}` : '';

            let distanceExpr: string;
            switch (metric) {
                case 'cosine':
                    distanceExpr = `"${column}" <=> '${vectorStr}'`;
                    break;
                case 'inner_product':
                    distanceExpr = `"${column}" <#> '${vectorStr}'`;
                    break;
                default: // l2
                    distanceExpr = `"${column}" <-> '${vectorStr}'`;
            }

            const sql = `SELECT ${selectCols}${distanceExpr} as distance
                        FROM "${table}"
                        WHERE TRUE${whereClause}
                        ORDER BY ${distanceExpr}
                        LIMIT ${String(limitVal)}`;

            const result = await adapter.executeQuery(sql);
            return { results: result.rows, count: result.rows?.length ?? 0, metric: metric ?? 'l2' };
        }
    };
}

function createVectorCreateIndexTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_vector_create_index',
        description: 'Create an IVFFlat or HNSW index for vector similarity search.',
        group: 'vector',
        inputSchema: VectorCreateIndexSchema,
        handler: async (params: unknown, _context: RequestContext) => {
            const { table, column, type, lists, m, efConstruction } = VectorCreateIndexSchema.parse(params);

            const indexName = `idx_${table}_${column}_${type}`;
            let withClause = '';

            if (type === 'ivfflat') {
                const numLists = lists ?? 100;
                withClause = `WITH (lists = ${String(numLists)})`;
            } else { // hnsw
                const mVal = m ?? 16;
                const efVal = efConstruction ?? 64;
                withClause = `WITH (m = ${String(mVal)}, ef_construction = ${String(efVal)})`;
            }

            const sql = `CREATE INDEX "${indexName}" ON "${table}" USING ${type} ("${column}" vector_l2_ops) ${withClause}`;
            await adapter.executeQuery(sql);
            return { success: true, index: indexName, type, table, column };
        }
    };
}

function createVectorDistanceTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_vector_distance',
        description: 'Calculate distance between two vectors.',
        group: 'vector',
        inputSchema: z.object({
            vector1: z.array(z.number()),
            vector2: z.array(z.number()),
            metric: z.enum(['l2', 'cosine', 'inner_product']).optional()
        }),
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

function createVectorNormalizeTool(): ToolDefinition {
    return {
        name: 'pg_vector_normalize',
        description: 'Normalize a vector to unit length.',
        group: 'vector',
        inputSchema: z.object({
            vector: z.array(z.number())
        }),
        // eslint-disable-next-line @typescript-eslint/require-await
        handler: async (params: unknown, _context: RequestContext) => {
            const parsed = (params as { vector: number[] });

            // Calculate magnitude and divide
            const magnitude = Math.sqrt(parsed.vector.reduce((sum, x) => sum + x * x, 0));
            const normalized = parsed.vector.map(x => x / magnitude);

            return { normalized, magnitude };
        }
    };
}

function createVectorAggregateTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_vector_aggregate',
        description: 'Calculate average vector for a group of rows.',
        group: 'vector',
        inputSchema: z.object({
            table: z.string(),
            column: z.string(),
            where: z.string().optional()
        }),
        handler: async (params: unknown, _context: RequestContext) => {
            const parsed = (params as { table: string; column: string; where?: string });
            const whereClause = parsed.where ? ` WHERE ${parsed.where}` : '';

            const sql = `SELECT avg("${parsed.column}") as average_vector, count(*) as count
                        FROM "${parsed.table}"${whereClause}`;

            const result = await adapter.executeQuery(sql);
            return result.rows?.[0];
        }
    };
}

// =============================================================================
// Advanced Vector Tools (ported from old server)
// =============================================================================

/**
 * K-means clustering on vectors
 */
function createVectorClusterTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_vector_cluster',
        description: 'Perform K-means clustering on vectors in a table. Returns cluster centroids and assignments.',
        group: 'vector',
        inputSchema: z.object({
            table: z.string().describe('Table name'),
            column: z.string().describe('Vector column'),
            k: z.number().describe('Number of clusters'),
            iterations: z.number().optional().describe('Max iterations (default: 10)'),
            sampleSize: z.number().optional().describe('Sample size for large tables')
        }),
        handler: async (params: unknown, _context: RequestContext) => {
            const parsed = (params as {
                table: string;
                column: string;
                k: number;
                iterations?: number;
                sampleSize?: number;
            });
            const maxIter = parsed.iterations ?? 10;
            const sample = parsed.sampleSize ?? 10000;

            // Get sample vectors
            const sampleSql = `
                SELECT "${parsed.column}" as vec 
                FROM "${parsed.table}" 
                WHERE "${parsed.column}" IS NOT NULL
                ORDER BY RANDOM() 
                LIMIT ${String(sample)}
            `;
            const sampleResult = await adapter.executeQuery(sampleSql);
            const vectors = (sampleResult.rows ?? []) as { vec: string }[];

            if (vectors.length < parsed.k) {
                return { error: `Not enough vectors (${String(vectors.length)}) for ${String(parsed.k)} clusters` };
            }

            // Initialize centroids randomly from sample
            const initialCentroids = vectors.slice(0, parsed.k).map(v => v.vec);

            // Run k-means using PostgreSQL
            const clusterSql = `
                WITH sample_vectors AS (
                    SELECT ROW_NUMBER() OVER () as id, "${parsed.column}" as vec
                    FROM "${parsed.table}"
                    WHERE "${parsed.column}" IS NOT NULL
                    LIMIT ${String(sample)}
                ),
                centroids AS (
                    SELECT unnest($1::vector[]) as centroid
                )
                SELECT 
                    c.centroid,
                    COUNT(*) as cluster_size,
                    AVG(s.vec) as new_centroid
                FROM sample_vectors s
                CROSS JOIN LATERAL (
                    SELECT centroid, ROW_NUMBER() OVER (ORDER BY s.vec <-> centroid) as rn
                    FROM centroids
                ) c
                WHERE c.rn = 1
                GROUP BY c.centroid
            `;

            let centroids = initialCentroids;
            for (let i = 0; i < maxIter; i++) {
                try {
                    const result = await adapter.executeQuery(clusterSql, [centroids]);
                    centroids = (result.rows ?? []).map((r: Record<string, unknown>) => r['new_centroid'] as string);
                } catch {
                    break; // Stop if query fails
                }
            }

            return {
                k: parsed.k,
                iterations: maxIter,
                sampleSize: vectors.length,
                centroids: centroids.map(c => ({ vector: c })),
                note: 'For production clustering, consider using specialized libraries'
            };
        }
    };
}

/**
 * Optimize vector index parameters
 */
function createVectorIndexOptimizeTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_vector_index_optimize',
        description: 'Analyze vector column and recommend optimal index parameters for IVFFlat/HNSW.',
        group: 'vector',
        inputSchema: z.object({
            table: z.string().describe('Table name'),
            column: z.string().describe('Vector column')
        }),
        handler: async (params: unknown, _context: RequestContext) => {
            const parsed = (params as { table: string; column: string });

            // Get table stats
            const statsSql = `
                SELECT 
                    reltuples::bigint as estimated_rows,
                    pg_size_pretty(pg_total_relation_size('"${parsed.table}"'::regclass)) as table_size
                FROM pg_class WHERE relname = $1
            `;
            const statsResult = await adapter.executeQuery(statsSql, [parsed.table]);
            const stats = (statsResult.rows?.[0] ?? {}) as { estimated_rows: number; table_size: string };

            // Get vector dimensions
            const dimSql = `
                SELECT vector_dims("${parsed.column}") as dimensions
                FROM "${parsed.table}"
                WHERE "${parsed.column}" IS NOT NULL
                LIMIT 1
            `;
            const dimResult = await adapter.executeQuery(dimSql);
            const dimensions = (dimResult.rows?.[0] as { dimensions: number } | undefined)?.dimensions;

            // Get existing indexes
            const indexSql = `
                SELECT indexname, indexdef
                FROM pg_indexes
                WHERE tablename = $1
                AND indexdef LIKE '%vector%'
            `;
            const indexResult = await adapter.executeQuery(indexSql, [parsed.table]);

            // Calculate recommendations
            const rows = stats.estimated_rows ?? 0;
            const recommendations = [];

            if (rows < 10000) {
                recommendations.push({
                    type: 'none',
                    reason: 'Table is small enough for brute force search'
                });
            } else if (rows < 100000) {
                recommendations.push({
                    type: 'ivfflat',
                    lists: Math.min(100, Math.round(Math.sqrt(rows))),
                    reason: 'IVFFlat recommended for medium tables'
                });
            } else {
                recommendations.push({
                    type: 'hnsw',
                    m: dimensions !== undefined && dimensions > 768 ? 32 : 16,
                    efConstruction: 64,
                    reason: 'HNSW recommended for large tables with high recall'
                });
                recommendations.push({
                    type: 'ivfflat',
                    lists: Math.round(Math.sqrt(rows)),
                    reason: 'IVFFlat is faster to build but lower recall'
                });
            }

            return {
                table: parsed.table,
                column: parsed.column,
                dimensions,
                estimatedRows: rows,
                tableSize: stats.table_size,
                existingIndexes: indexResult.rows,
                recommendations
            };
        }
    };
}

/**
 * Hybrid vector + full-text search
 */
function createHybridSearchTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_hybrid_search',
        description: 'Combined vector similarity and full-text search with weighted scoring.',
        group: 'vector',
        inputSchema: z.object({
            table: z.string().describe('Table name'),
            vectorColumn: z.string().describe('Vector column'),
            textColumn: z.string().describe('Text column for FTS'),
            vector: z.array(z.number()).describe('Query vector'),
            textQuery: z.string().describe('Text search query'),
            vectorWeight: z.number().optional().describe('Weight for vector score (0-1, default: 0.5)'),
            limit: z.number().optional().describe('Max results')
        }),
        handler: async (params: unknown, _context: RequestContext) => {
            const parsed = (params as {
                table: string;
                vectorColumn: string;
                textColumn: string;
                vector: number[];
                textQuery: string;
                vectorWeight?: number;
                limit?: number;
            });

            const vectorWeight = parsed.vectorWeight ?? 0.5;
            const textWeight = 1 - vectorWeight;
            const limitVal = parsed.limit ?? 10;
            const vectorStr = `[${parsed.vector.join(',')}]`;

            const sql = `
                WITH vector_scores AS (
                    SELECT 
                        ctid,
                        1 - ("${parsed.vectorColumn}" <=> '${vectorStr}'::vector) as vector_score
                    FROM "${parsed.table}"
                    WHERE "${parsed.vectorColumn}" IS NOT NULL
                    ORDER BY "${parsed.vectorColumn}" <=> '${vectorStr}'::vector
                    LIMIT ${String(limitVal * 3)}
                ),
                text_scores AS (
                    SELECT 
                        ctid,
                        ts_rank(to_tsvector('english', "${parsed.textColumn}"), plainto_tsquery($1)) as text_score
                    FROM "${parsed.table}"
                    WHERE to_tsvector('english', "${parsed.textColumn}") @@ plainto_tsquery($1)
                )
                SELECT 
                    t.*,
                    COALESCE(v.vector_score, 0) * ${String(vectorWeight)} + 
                    COALESCE(ts.text_score, 0) * ${String(textWeight)} as combined_score,
                    v.vector_score,
                    ts.text_score
                FROM "${parsed.table}" t
                LEFT JOIN vector_scores v ON t.ctid = v.ctid
                LEFT JOIN text_scores ts ON t.ctid = ts.ctid
                WHERE v.ctid IS NOT NULL OR ts.ctid IS NOT NULL
                ORDER BY combined_score DESC
                LIMIT ${String(limitVal)}
            `;

            const result = await adapter.executeQuery(sql, [parsed.textQuery]);
            return {
                results: result.rows,
                count: result.rows?.length ?? 0,
                vectorWeight,
                textWeight
            };
        }
    };
}

/**
 * Vector query performance analysis
 */
function createVectorPerformanceTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_vector_performance',
        description: 'Analyze vector search performance and index effectiveness.',
        group: 'vector',
        inputSchema: z.object({
            table: z.string().describe('Table name'),
            column: z.string().describe('Vector column'),
            testVector: z.array(z.number()).optional().describe('Test vector for benchmarking')
        }),
        handler: async (params: unknown, _context: RequestContext) => {
            const parsed = (params as { table: string; column: string; testVector?: number[] });

            // Get index info
            const indexSql = `
                SELECT 
                    i.indexname,
                    i.indexdef,
                    pg_size_pretty(pg_relation_size(i.indexname::regclass)) as index_size,
                    s.idx_scan,
                    s.idx_tup_read
                FROM pg_indexes i
                LEFT JOIN pg_stat_user_indexes s ON s.indexrelname = i.indexname
                WHERE i.tablename = $1
                AND i.indexdef LIKE '%vector%'
            `;
            const indexResult = await adapter.executeQuery(indexSql, [parsed.table]);

            // Get table stats
            const statsSql = `
                SELECT 
                    reltuples::bigint as estimated_rows,
                    pg_size_pretty(pg_relation_size('"${parsed.table}"'::regclass)) as table_size
                FROM pg_class WHERE relname = $1
            `;
            const statsResult = await adapter.executeQuery(statsSql, [parsed.table]);

            // Benchmark if test vector provided
            let benchmark = null;
            if (parsed.testVector) {
                const vectorStr = `[${parsed.testVector.join(',')}]`;
                const benchSql = `
                    EXPLAIN ANALYZE
                    SELECT * FROM "${parsed.table}"
                    ORDER BY "${parsed.column}" <-> '${vectorStr}'::vector
                    LIMIT 10
                `;
                const benchResult = await adapter.executeQuery(benchSql);
                benchmark = benchResult.rows;
            }

            return {
                table: parsed.table,
                column: parsed.column,
                stats: statsResult.rows?.[0],
                indexes: indexResult.rows,
                benchmark,
                recommendations: (indexResult.rows?.length ?? 0) === 0
                    ? ['No vector index found - consider creating one for better performance']
                    : []
            };
        }
    };
}

/**
 * Dimensionality reduction using PostgreSQL
 */
function createVectorDimensionReduceTool(_adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_vector_dimension_reduce',
        description: 'Reduce vector dimensions using random projection (PostgreSQL-native approximation).',
        group: 'vector',
        inputSchema: z.object({
            vector: z.array(z.number()).describe('Vector to reduce'),
            targetDimensions: z.number().describe('Target number of dimensions'),
            seed: z.number().optional().describe('Random seed for reproducibility')
        }),
        // eslint-disable-next-line @typescript-eslint/require-await
        handler: async (params: unknown, _context: RequestContext) => {
            const parsed = (params as { vector: number[]; targetDimensions: number; seed?: number });
            const originalDim = parsed.vector.length;
            const targetDim = parsed.targetDimensions;

            if (targetDim >= originalDim) {
                return {
                    error: 'Target dimensions must be less than original',
                    originalDimensions: originalDim,
                    targetDimensions: targetDim
                };
            }

            // Simple random projection using seeded random
            const seed = parsed.seed ?? 42;
            const seededRandom = (s: number): number => {
                const x = Math.sin(s) * 10000;
                return x - Math.floor(x);
            };

            // Generate random projection matrix
            const reduced: number[] = [];
            const scaleFactor = Math.sqrt(originalDim / targetDim);

            for (let i = 0; i < targetDim; i++) {
                let sum = 0;
                for (let j = 0; j < originalDim; j++) {
                    const randVal = seededRandom(seed + i * originalDim + j) > 0.5 ? 1 : -1;
                    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                    sum += parsed.vector[j]! * randVal;
                }
                reduced.push(sum / scaleFactor);
            }

            return {
                originalDimensions: originalDim,
                targetDimensions: targetDim,
                reduced,
                method: 'random_projection',
                note: 'For PCA or UMAP, use external libraries'
            };
        }
    };
}

/**
 * Generate embeddings (placeholder for external API integration)
 */
function createVectorEmbedTool(): ToolDefinition {
    return {
        name: 'pg_vector_embed',
        description: 'Generate text embeddings. Returns a simple hash-based embedding for demos (use external APIs for production).',
        group: 'vector',
        inputSchema: z.object({
            text: z.string().describe('Text to embed'),
            dimensions: z.number().optional().describe('Vector dimensions (default: 384)')
        }),
        // eslint-disable-next-line @typescript-eslint/require-await
        handler: async (params: unknown, _context: RequestContext) => {
            const parsed = (params as { text: string; dimensions?: number });
            const dims = parsed.dimensions ?? 384;

            // Generate deterministic pseudo-embedding from text
            // This is NOT a real embedding - just for testing/demos
            const vector: number[] = [];

            for (let i = 0; i < dims; i++) {
                let hash = 0;
                for (let j = 0; j < parsed.text.length; j++) {
                    hash = ((hash << 5) - hash + parsed.text.charCodeAt(j) + i) | 0;
                }
                // Normalize to [-1, 1] range
                vector.push(Math.sin(hash) * 0.5);
            }

            // Normalize vector
            const magnitude = Math.sqrt(vector.reduce((sum, x) => sum + x * x, 0));
            const normalized = vector.map(x => x / magnitude);

            return {
                embedding: normalized,
                dimensions: dims,
                textLength: parsed.text.length,
                warning: 'This is a demo embedding using hash functions. For production, use OpenAI, Cohere, or other embedding APIs.'
            };
        }
    };
}

