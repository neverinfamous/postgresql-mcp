/**
 * PostgreSQL PostGIS Extension Tools - Basic Operations
 * 
 * Core spatial tools: extension, geometry_column, point_in_polygon, distance, buffer, intersection, bounding_box, spatial_index.
 */

import type { PostgresAdapter } from '../../PostgresAdapter.js';
import type { ToolDefinition, RequestContext } from '../../../../types/index.js';
import { z } from 'zod';
import { readOnly, write } from '../../../../utils/annotations.js';
import { getToolIcons } from '../../../../utils/icons.js';
import { sanitizeIdentifier, sanitizeTableName } from '../../../../utils/identifiers.js';
import { GeometryDistanceSchema, PointInPolygonSchema, SpatialIndexSchema } from '../../schemas/index.js';

export function createPostgisExtensionTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_postgis_create_extension',
        description: 'Enable the PostGIS extension for geospatial operations.',
        group: 'postgis',
        inputSchema: z.object({}),
        annotations: write('Create PostGIS Extension'),
        icons: getToolIcons('postgis', write('Create PostGIS Extension')),
        handler: async (_params: unknown, _context: RequestContext) => {
            await adapter.executeQuery('CREATE EXTENSION IF NOT EXISTS postgis');
            return { success: true, message: 'PostGIS extension enabled' };
        }
    };
}

export function createGeometryColumnTool(adapter: PostgresAdapter): ToolDefinition {
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
        annotations: write('Add Geometry Column'),
        icons: getToolIcons('postgis', write('Add Geometry Column')),
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

export function createPointInPolygonTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_point_in_polygon',
        description: 'Check if a point is within any polygon in a table.',
        group: 'postgis',
        inputSchema: PointInPolygonSchema,
        annotations: readOnly('Point in Polygon'),
        icons: getToolIcons('postgis', readOnly('Point in Polygon')),
        handler: async (params: unknown, _context: RequestContext) => {
            const { table, column, point } = PointInPolygonSchema.parse(params);
            const tableName = sanitizeTableName(table);
            const columnName = sanitizeIdentifier(column);

            const sql = `SELECT *, ST_AsText(${columnName}) as geometry_text
                        FROM ${tableName}
                        WHERE ST_Contains(${columnName}, ST_SetSRID(ST_MakePoint($1, $2), 4326))`;

            const result = await adapter.executeQuery(sql, [point.lng, point.lat]);
            return { containingPolygons: result.rows, count: result.rows?.length ?? 0 };
        }
    };
}

export function createDistanceTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_distance',
        description: 'Find nearby geometries within a distance from a point.',
        group: 'postgis',
        inputSchema: GeometryDistanceSchema,
        annotations: readOnly('Distance Search'),
        icons: getToolIcons('postgis', readOnly('Distance Search')),
        handler: async (params: unknown, _context: RequestContext) => {
            const { table, column, point, limit, maxDistance } = GeometryDistanceSchema.parse(params);

            const tableName = sanitizeTableName(table);
            const columnName = sanitizeIdentifier(column);
            const limitVal = limit ?? 10;
            const distanceFilter = maxDistance !== undefined && maxDistance > 0 ? `AND ST_Distance(${columnName}::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) <= ${String(maxDistance)}` : '';

            const sql = `SELECT *, 
                        ST_Distance(${columnName}::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) as distance_meters
                        FROM ${tableName}
                        WHERE TRUE ${distanceFilter}
                        ORDER BY ${columnName} <-> ST_SetSRID(ST_MakePoint($1, $2), 4326)
                        LIMIT ${String(limitVal)}`;

            const result = await adapter.executeQuery(sql, [point.lng, point.lat]);
            return { results: result.rows, count: result.rows?.length ?? 0 };
        }
    };
}

export function createBufferTool(adapter: PostgresAdapter): ToolDefinition {
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
        annotations: readOnly('Buffer Zone'),
        icons: getToolIcons('postgis', readOnly('Buffer Zone')),
        handler: async (params: unknown, _context: RequestContext) => {
            const parsed = (params as { table: string; column: string; distance: number; where?: string });
            const whereClause = parsed.where ? ` WHERE ${parsed.where}` : '';

            const tableName = sanitizeTableName(parsed.table);
            const columnName = sanitizeIdentifier(parsed.column);

            const sql = `SELECT *, ST_AsGeoJSON(ST_Buffer(${columnName}::geography, $1)::geometry) as buffer_geojson
                        FROM ${tableName}${whereClause}`;

            const result = await adapter.executeQuery(sql, [parsed.distance]);
            return { results: result.rows };
        }
    };
}

export function createIntersectionTool(adapter: PostgresAdapter): ToolDefinition {
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
        annotations: readOnly('Intersection Search'),
        icons: getToolIcons('postgis', readOnly('Intersection Search')),
        handler: async (params: unknown, _context: RequestContext) => {
            const parsed = (params as { table: string; column: string; geometry: string; select?: string[] });
            const tableName = sanitizeTableName(parsed.table);
            const columnName = sanitizeIdentifier(parsed.column);
            const selectCols = parsed.select !== undefined && parsed.select.length > 0 ? parsed.select.map(c => sanitizeIdentifier(c)).join(', ') : '*';

            const isGeoJson = parsed.geometry.trim().startsWith('{');
            const geomExpr = isGeoJson
                ? `ST_GeomFromGeoJSON($1)`
                : `ST_GeomFromText($1)`;

            const sql = `SELECT ${selectCols}
                        FROM ${tableName}
                        WHERE ST_Intersects(${columnName}, ${geomExpr})`;

            const result = await adapter.executeQuery(sql, [parsed.geometry]);
            return { intersecting: result.rows, count: result.rows?.length ?? 0 };
        }
    };
}

export function createBoundingBoxTool(adapter: PostgresAdapter): ToolDefinition {
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
        annotations: readOnly('Bounding Box Search'),
        icons: getToolIcons('postgis', readOnly('Bounding Box Search')),
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

            const tableName = sanitizeTableName(parsed.table);
            const columnName = sanitizeIdentifier(parsed.column);
            const selectCols = parsed.select !== undefined && parsed.select.length > 0 ? parsed.select.map(c => sanitizeIdentifier(c)).join(', ') : '*';

            const sql = `SELECT ${selectCols}
                        FROM ${tableName}
                        WHERE ${columnName} && ST_MakeEnvelope($1, $2, $3, $4, 4326)`;

            const result = await adapter.executeQuery(sql, [
                parsed.minLng, parsed.minLat, parsed.maxLng, parsed.maxLat
            ]);
            return { results: result.rows, count: result.rows?.length ?? 0 };
        }
    };
}

export function createSpatialIndexTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_spatial_index',
        description: 'Create a GiST spatial index for geometry column.',
        group: 'postgis',
        inputSchema: SpatialIndexSchema,
        annotations: write('Create Spatial Index'),
        icons: getToolIcons('postgis', write('Create Spatial Index')),
        handler: async (params: unknown, _context: RequestContext) => {
            const { table, column, name } = SpatialIndexSchema.parse(params);
            const indexNameRaw = name ?? `idx_${table}_${column}_gist`;

            const tableName = sanitizeTableName(table);
            const columnName = sanitizeIdentifier(column);
            const indexName = sanitizeIdentifier(indexNameRaw);

            const sql = `CREATE INDEX ${indexName} ON ${tableName} USING GIST (${columnName})`;
            await adapter.executeQuery(sql);
            return { success: true, index: indexNameRaw, table, column };
        }
    };
}
