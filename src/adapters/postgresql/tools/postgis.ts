/**
 * PostgreSQL PostGIS Extension Tools
 * 
 * Geospatial operations and spatial queries.
 * 9 tools total.
 */

import type { PostgresAdapter } from '../PostgresAdapter.js';
import type { ToolDefinition, RequestContext } from '../../../types/index.js';
import { z } from 'zod';
import { GeometryDistanceSchema, PointInPolygonSchema, SpatialIndexSchema } from '../types.js';

/**
 * Get all PostGIS tools
 */
export function getPostgisTools(adapter: PostgresAdapter): ToolDefinition[] {
    return [
        createPostgisExtensionTool(adapter),
        createGeometryColumnTool(adapter),
        createPointInPolygonTool(adapter),
        createDistanceTool(adapter),
        createBufferTool(adapter),
        createIntersectionTool(adapter),
        createBoundingBoxTool(adapter),
        createSpatialIndexTool(adapter),
        createGeocodeTool(adapter),
        createGeoTransformTool(adapter),
        createGeoIndexOptimizeTool(adapter),
        createGeoClusterTool(adapter)
    ];
}

function createPostgisExtensionTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_postgis_create_extension',
        description: 'Enable the PostGIS extension for geospatial operations.',
        group: 'postgis',
        inputSchema: z.object({}),
        handler: async (_params: unknown, _context: RequestContext) => {
            await adapter.executeQuery('CREATE EXTENSION IF NOT EXISTS postgis');
            return { success: true, message: 'PostGIS extension enabled' };
        }
    };
}

function createGeometryColumnTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_geometry_column',
        description: 'Add a geometry column to a table.',
        group: 'postgis',
        inputSchema: z.object({
            table: z.string(),
            column: z.string(),
            srid: z.number().optional().describe('Spatial Reference ID (default: 4326 for WGS84)'),
            type: z.enum(['POINT', 'LINESTRING', 'POLYGON', 'MULTIPOINT', 'MULTILINESTRING', 'MULTIPOLYGON', 'GEOMETRY']).optional(),
            schema: z.string().optional()
        }),
        handler: async (params: unknown, _context: RequestContext) => {
            const parsed = (params as {
                table: string;
                column: string;
                srid?: number;
                type?: string;
                schema?: string;
            });

            const schemaName = parsed.schema ?? 'public';
            const srid = parsed.srid ?? 4326;
            const geomType = parsed.type ?? 'GEOMETRY';

            const sql = `SELECT AddGeometryColumn('${schemaName}', '${parsed.table}', '${parsed.column}', ${String(srid)}, '${geomType}', 2)`;
            await adapter.executeQuery(sql);

            return { success: true, table: parsed.table, column: parsed.column, srid, type: geomType };
        }
    };
}

function createPointInPolygonTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_point_in_polygon',
        description: 'Check if a point is within any polygon in a table.',
        group: 'postgis',
        inputSchema: PointInPolygonSchema,
        handler: async (params: unknown, _context: RequestContext) => {
            const { table, column, point } = PointInPolygonSchema.parse(params);

            const sql = `SELECT *, ST_AsText("${column}") as geometry_text
                        FROM "${table}"
                        WHERE ST_Contains("${column}", ST_SetSRID(ST_MakePoint($1, $2), 4326))`;

            const result = await adapter.executeQuery(sql, [point.lng, point.lat]);
            return { containingPolygons: result.rows, count: result.rows?.length ?? 0 };
        }
    };
}

function createDistanceTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_distance',
        description: 'Find nearby geometries within a distance from a point.',
        group: 'postgis',
        inputSchema: GeometryDistanceSchema,
        handler: async (params: unknown, _context: RequestContext) => {
            const { table, column, point, limit, maxDistance } = GeometryDistanceSchema.parse(params);

            const limitVal = limit ?? 10;
            const distanceFilter = maxDistance !== undefined && maxDistance > 0 ? `AND ST_Distance(${column}::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) <= ${String(maxDistance)}` : '';

            const sql = `SELECT *, 
                        ST_Distance("${column}"::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) as distance_meters
                        FROM "${table}"
                        WHERE TRUE ${distanceFilter}
                        ORDER BY "${column}" <-> ST_SetSRID(ST_MakePoint($1, $2), 4326)
                        LIMIT ${String(limitVal)}`;

            const result = await adapter.executeQuery(sql, [point.lng, point.lat]);
            return { results: result.rows, count: result.rows?.length ?? 0 };
        }
    };
}

function createBufferTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_buffer',
        description: 'Create a buffer zone around geometries.',
        group: 'postgis',
        inputSchema: z.object({
            table: z.string(),
            column: z.string(),
            distance: z.number().describe('Buffer distance in meters'),
            where: z.string().optional()
        }),
        handler: async (params: unknown, _context: RequestContext) => {
            const parsed = (params as { table: string; column: string; distance: number; where?: string });
            const whereClause = parsed.where ? ` WHERE ${parsed.where}` : '';

            const sql = `SELECT *, ST_AsGeoJSON(ST_Buffer("${parsed.column}"::geography, $1)::geometry) as buffer_geojson
                        FROM "${parsed.table}"${whereClause}`;

            const result = await adapter.executeQuery(sql, [parsed.distance]);
            return { results: result.rows };
        }
    };
}

function createIntersectionTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_intersection',
        description: 'Find geometries that intersect with a given geometry.',
        group: 'postgis',
        inputSchema: z.object({
            table: z.string(),
            column: z.string(),
            geometry: z.string().describe('GeoJSON or WKT geometry to check intersection'),
            select: z.array(z.string()).optional()
        }),
        handler: async (params: unknown, _context: RequestContext) => {
            const parsed = (params as { table: string; column: string; geometry: string; select?: string[] });
            const selectCols = parsed.select !== undefined && parsed.select.length > 0 ? parsed.select.map(c => `"${c}"`).join(', ') : '*';

            // Detect if geometry is GeoJSON or WKT
            const isGeoJson = parsed.geometry.trim().startsWith('{');
            const geomExpr = isGeoJson
                ? `ST_GeomFromGeoJSON($1)`
                : `ST_GeomFromText($1)`;

            const sql = `SELECT ${selectCols}
                        FROM "${parsed.table}"
                        WHERE ST_Intersects("${parsed.column}", ${geomExpr})`;

            const result = await adapter.executeQuery(sql, [parsed.geometry]);
            return { intersecting: result.rows, count: result.rows?.length ?? 0 };
        }
    };
}

function createBoundingBoxTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_bounding_box',
        description: 'Find geometries within a bounding box.',
        group: 'postgis',
        inputSchema: z.object({
            table: z.string(),
            column: z.string(),
            minLng: z.number(),
            minLat: z.number(),
            maxLng: z.number(),
            maxLat: z.number(),
            select: z.array(z.string()).optional()
        }),
        handler: async (params: unknown, _context: RequestContext) => {
            const parsed = (params as {
                table: string;
                column: string;
                minLng: number;
                minLat: number;
                maxLng: number;
                maxLat: number;
                select?: string[];
            });

            const selectCols = parsed.select !== undefined && parsed.select.length > 0 ? parsed.select.map(c => `"${c}"`).join(', ') : '*';

            const sql = `SELECT ${selectCols}
                        FROM "${parsed.table}"
                        WHERE "${parsed.column}" && ST_MakeEnvelope($1, $2, $3, $4, 4326)`;

            const result = await adapter.executeQuery(sql, [
                parsed.minLng, parsed.minLat, parsed.maxLng, parsed.maxLat
            ]);
            return { results: result.rows, count: result.rows?.length ?? 0 };
        }
    };
}

function createSpatialIndexTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_spatial_index',
        description: 'Create a GiST spatial index for geometry column.',
        group: 'postgis',
        inputSchema: SpatialIndexSchema,
        handler: async (params: unknown, _context: RequestContext) => {
            const { table, column, name } = SpatialIndexSchema.parse(params);
            const indexName = name ?? `idx_${table}_${column}_gist`;

            const sql = `CREATE INDEX "${indexName}" ON "${table}" USING GIST ("${column}")`;
            await adapter.executeQuery(sql);
            return { success: true, index: indexName, table, column };
        }
    };
}

function createGeocodeTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_geocode',
        description: 'Create a point geometry from latitude/longitude coordinates.',
        group: 'postgis',
        inputSchema: z.object({
            lat: z.number(),
            lng: z.number(),
            srid: z.number().optional()
        }),
        handler: async (params: unknown, _context: RequestContext) => {
            const parsed = (params as { lat: number; lng: number; srid?: number });
            const srid = parsed.srid ?? 4326;

            const sql = `SELECT 
                        ST_AsGeoJSON(ST_SetSRID(ST_MakePoint($1, $2), $3)) as geojson,
                        ST_AsText(ST_SetSRID(ST_MakePoint($1, $2), $3)) as wkt`;

            const result = await adapter.executeQuery(sql, [parsed.lng, parsed.lat, srid]);
            return result.rows?.[0];
        }
    };
}

/**
 * Transform geometry between coordinate systems
 */
function createGeoTransformTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_geo_transform',
        description: 'Transform geometry from one spatial reference system (SRID) to another.',
        group: 'postgis',
        inputSchema: z.object({
            table: z.string().describe('Table name'),
            column: z.string().describe('Geometry column'),
            fromSrid: z.number().describe('Source SRID'),
            toSrid: z.number().describe('Target SRID'),
            where: z.string().optional().describe('Filter condition'),
            limit: z.number().optional().describe('Maximum rows to return')
        }),
        handler: async (params: unknown, _context: RequestContext) => {
            const parsed = (params as {
                table: string;
                column: string;
                fromSrid: number;
                toSrid: number;
                where?: string;
                limit?: number;
            });

            const whereClause = parsed.where ? `WHERE ${parsed.where}` : '';
            const limitClause = parsed.limit !== undefined && parsed.limit > 0 ? `LIMIT ${String(parsed.limit)}` : '';

            const sql = `
                SELECT 
                    *,
                    ST_AsGeoJSON(ST_Transform(ST_SetSRID("${parsed.column}", ${String(parsed.fromSrid)}), ${String(parsed.toSrid)})) as transformed_geojson,
                    ST_AsText(ST_Transform(ST_SetSRID("${parsed.column}", ${String(parsed.fromSrid)}), ${String(parsed.toSrid)})) as transformed_wkt,
                    ${String(parsed.toSrid)} as output_srid
                FROM "${parsed.table}"
                ${whereClause}
                ${limitClause}
            `;

            const result = await adapter.executeQuery(sql);
            return {
                results: result.rows,
                count: result.rows?.length ?? 0,
                fromSrid: parsed.fromSrid,
                toSrid: parsed.toSrid
            };
        }
    };
}

/**
 * Analyze and optimize spatial indexes
 */
function createGeoIndexOptimizeTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_geo_index_optimize',
        description: 'Analyze spatial indexes and provide optimization recommendations.',
        group: 'postgis',
        inputSchema: z.object({
            table: z.string().optional().describe('Specific table to analyze (or all spatial tables)'),
            schema: z.string().optional().describe('Schema name')
        }),
        handler: async (params: unknown, _context: RequestContext) => {
            const parsed = (params as { table?: string; schema?: string });
            const schemaName = parsed.schema ?? 'public';

            // Get spatial indexes info
            const indexQuery = `
                SELECT 
                    c.relname as table_name,
                    i.relname as index_name,
                    a.attname as column_name,
                    pg_size_pretty(pg_relation_size(i.oid)) as index_size,
                    pg_relation_size(i.oid) as index_size_bytes,
                    idx_scan as index_scans,
                    idx_tup_read as tuples_read,
                    idx_tup_fetch as tuples_fetched
                FROM pg_index x
                JOIN pg_class c ON c.oid = x.indrelid
                JOIN pg_class i ON i.oid = x.indexrelid
                JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = ANY(x.indkey)
                JOIN pg_namespace n ON n.oid = c.relnamespace
                LEFT JOIN pg_stat_user_indexes s ON s.indexrelid = i.oid
                WHERE n.nspname = $1
                AND (pg_get_indexdef(i.oid) LIKE '%gist%' OR pg_get_indexdef(i.oid) LIKE '%spgist%')
                ${parsed.table ? `AND c.relname = '${parsed.table}'` : ''}
                ORDER BY index_size_bytes DESC
            `;

            const [indexes, tableStats] = await Promise.all([
                adapter.executeQuery(indexQuery, [schemaName]),
                adapter.executeQuery(`
                    SELECT 
                        c.relname as table_name,
                        n_live_tup as row_count,
                        pg_size_pretty(pg_table_size(c.oid)) as table_size
                    FROM pg_stat_user_tables t
                    JOIN pg_class c ON c.relname = t.relname
                    JOIN pg_namespace n ON n.oid = c.relnamespace
                    WHERE n.nspname = $1
                    ${parsed.table ? `AND c.relname = '${parsed.table}'` : ''}
                `, [schemaName])
            ]);

            const recommendations: string[] = [];

            // Analyze index usage
            for (const idx of (indexes.rows ?? [])) {
                const scans = Number(idx['index_scans'] ?? 0);
                const sizeBytes = Number(idx['index_size_bytes'] ?? 0);

                if (scans === 0 && sizeBytes > 1024 * 1024) {
                    recommendations.push(`Index "${String(idx['index_name'])}" on ${String(idx['table_name'])} is unused but takes ${String(idx['index_size'])}. Consider dropping it.`);
                }
                if (scans > 0 && sizeBytes > 100 * 1024 * 1024) {
                    recommendations.push(`Large spatial index "${String(idx['index_name'])}" (${String(idx['index_size'])}). Consider partitioning the table for better performance.`);
                }
            }

            // Check for missing indexes
            for (const table of (tableStats.rows ?? [])) {
                const rowCount = Number(table['row_count'] ?? 0);
                const hasIndex = (indexes.rows ?? []).some(idx => idx['table_name'] === table['table_name']);

                if (rowCount > 10000 && !hasIndex) {
                    recommendations.push(`Table "${String(table['table_name'])}" has ${String(rowCount)} rows but no spatial index. Consider adding a GiST index.`);
                }
            }

            return {
                spatialIndexes: indexes.rows,
                tableStats: tableStats.rows,
                recommendations: recommendations.length > 0 ? recommendations : ['All spatial indexes appear optimized'],
                tips: [
                    'Use GiST indexes for general spatial queries',
                    'Consider SP-GiST for point-only data',
                    'CLUSTER table by spatial index for range queries',
                    'Use BRIN indexes for very large, sorted spatial data'
                ]
            };
        }
    };
}

/**
 * Spatial clustering using ST_ClusterDBSCAN or ST_ClusterKMeans
 */
function createGeoClusterTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_geo_cluster',
        description: 'Perform spatial clustering on geometry data using DBSCAN or K-Means.',
        group: 'postgis',
        inputSchema: z.object({
            table: z.string().describe('Table name'),
            column: z.string().describe('Geometry column name'),
            method: z.enum(['dbscan', 'kmeans']).optional().describe('Clustering method (default: dbscan)'),
            eps: z.number().optional().describe('DBSCAN: Distance threshold'),
            minPoints: z.number().optional().describe('DBSCAN: Minimum points per cluster'),
            numClusters: z.number().optional().describe('K-Means: Number of clusters'),
            schema: z.string().optional(),
            where: z.string().optional().describe('WHERE clause filter'),
            limit: z.number().optional()
        }),
        handler: async (params: unknown, _context: RequestContext) => {
            const parsed = (params as {
                table: string;
                column: string;
                method?: string;
                eps?: number;
                minPoints?: number;
                numClusters?: number;
                schema?: string;
                where?: string;
                limit?: number;
            });

            const method = parsed.method ?? 'dbscan';
            const schemaName = parsed.schema ?? 'public';
            const whereClause = parsed.where ? `WHERE ${parsed.where}` : '';
            const limitClause = parsed.limit !== undefined && parsed.limit > 0 ? `LIMIT ${String(parsed.limit)}` : '';

            let clusterFunction: string;
            if (method === 'kmeans') {
                const numClusters = parsed.numClusters ?? 5;
                clusterFunction = `ST_ClusterKMeans("${parsed.column}", ${String(numClusters)}) OVER ()`;
            } else {
                const eps = parsed.eps ?? 100; // Default 100 units
                const minPoints = parsed.minPoints ?? 3;
                clusterFunction = `ST_ClusterDBSCAN("${parsed.column}", ${String(eps)}, ${String(minPoints)}) OVER ()`;
            }

            const sql = `
                WITH clustered AS (
                    SELECT 
                        *,
                        ${clusterFunction} as cluster_id
                    FROM "${schemaName}"."${parsed.table}"
                    ${whereClause}
                )
                SELECT 
                    cluster_id,
                    COUNT(*) as point_count,
                    ST_AsGeoJSON(ST_Centroid(ST_Collect("${parsed.column}"))) as centroid,
                    ST_AsGeoJSON(ST_ConvexHull(ST_Collect("${parsed.column}"))) as hull
                FROM clustered
                WHERE cluster_id IS NOT NULL
                GROUP BY cluster_id
                ORDER BY point_count DESC
                ${limitClause}
            `;

            const [clusters, summary] = await Promise.all([
                adapter.executeQuery(sql),
                adapter.executeQuery(`
                    WITH clustered AS (
                        SELECT ${clusterFunction} as cluster_id
                        FROM "${schemaName}"."${parsed.table}"
                        ${whereClause}
                    )
                    SELECT 
                        COUNT(DISTINCT cluster_id) as num_clusters,
                        COUNT(*) FILTER (WHERE cluster_id IS NULL) as noise_points,
                        COUNT(*) as total_points
                    FROM clustered
                `)
            ]);

            return {
                method,
                parameters: method === 'kmeans'
                    ? { numClusters: parsed.numClusters ?? 5 }
                    : { eps: parsed.eps ?? 100, minPoints: parsed.minPoints ?? 3 },
                summary: summary.rows?.[0],
                clusters: clusters.rows,
                notes: method === 'dbscan'
                    ? 'Noise points (cluster_id = NULL) are points not belonging to any cluster'
                    : 'K-Means will always assign all points to a cluster'
            };
        }
    };
}

