/**
 * PostgreSQL PostGIS Extension Tools - Standalone Geometry Operations
 * 
 * Tools for operating on geometry strings (WKT/GeoJSON) directly,
 * without requiring a table. These complement the table-based tools.
 */

import type { PostgresAdapter } from '../../PostgresAdapter.js';
import type { ToolDefinition, RequestContext } from '../../../../types/index.js';
import { readOnly } from '../../../../utils/annotations.js';
import { getToolIcons } from '../../../../utils/icons.js';
import {
    GeometryBufferSchemaBase,
    GeometryBufferSchema,
    GeometryIntersectionSchemaBase,
    GeometryIntersectionSchema,
    GeometryTransformSchemaBase,
    GeometryTransformSchema
} from '../../schemas/index.js';

/**
 * Detect if a geometry string is GeoJSON or WKT
 */
function parseGeometry(geometry: string): { sql: string; isGeoJson: boolean } {
    const trimmed = geometry.trim();
    const isGeoJson = trimmed.startsWith('{');
    return {
        sql: isGeoJson ? 'ST_GeomFromGeoJSON($1)' : 'ST_GeomFromText($1)',
        isGeoJson
    };
}

/**
 * Create buffer around a standalone geometry
 */
export function createGeometryBufferTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_geometry_buffer',
        description: 'Create a buffer zone around a WKT or GeoJSON geometry. Returns the buffered geometry as GeoJSON and WKT.',
        group: 'postgis',
        inputSchema: GeometryBufferSchemaBase,  // Base schema for MCP visibility
        annotations: readOnly('Geometry Buffer'),
        icons: getToolIcons('postgis', readOnly('Geometry Buffer')),
        handler: async (params: unknown, _context: RequestContext) => {
            const { geometry, distance, srid } = GeometryBufferSchema.parse(params ?? {});
            const sridVal = srid ?? 4326;
            const { sql: geomExpr, isGeoJson } = parseGeometry(geometry);

            // Use geography type for accurate meter-based buffer on Earth
            const sql = `
                SELECT 
                    ST_AsGeoJSON(ST_Buffer(ST_SetSRID(${geomExpr}, ${String(sridVal)})::geography, $2)::geometry) as buffer_geojson,
                    ST_AsText(ST_Buffer(ST_SetSRID(${geomExpr}, ${String(sridVal)})::geography, $2)::geometry) as buffer_wkt,
                    $2 as distance_meters,
                    ${String(sridVal)} as srid
            `;

            const result = await adapter.executeQuery(sql, [geometry, distance]);
            return {
                ...result.rows?.[0],
                inputFormat: isGeoJson ? 'GeoJSON' : 'WKT'
            };
        }
    };
}

/**
 * Compute intersection of two standalone geometries
 */
export function createGeometryIntersectionTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_geometry_intersection',
        description: 'Compute the intersection of two WKT or GeoJSON geometries. Returns the intersection geometry and whether they intersect.',
        group: 'postgis',
        inputSchema: GeometryIntersectionSchemaBase,  // Base schema for MCP visibility
        annotations: readOnly('Geometry Intersection'),
        icons: getToolIcons('postgis', readOnly('Geometry Intersection')),
        handler: async (params: unknown, _context: RequestContext) => {
            const { geometry1, geometry2 } = GeometryIntersectionSchema.parse(params ?? {});
            const geom1 = parseGeometry(geometry1);
            const geom2 = parseGeometry(geometry2);

            // Replace $1 with actual parameter positions
            const geom1Expr = geom1.sql.replace('$1', '$1');
            const geom2Expr = geom2.sql.replace('$1', '$2');

            const sql = `
                SELECT 
                    ST_Intersects(${geom1Expr}, ${geom2Expr}) as intersects,
                    ST_AsGeoJSON(ST_Intersection(${geom1Expr}, ${geom2Expr})) as intersection_geojson,
                    ST_AsText(ST_Intersection(${geom1Expr}, ${geom2Expr})) as intersection_wkt,
                    ST_Area(ST_Intersection(${geom1Expr}, ${geom2Expr})::geography) as intersection_area_sqm
            `;

            const result = await adapter.executeQuery(sql, [geometry1, geometry2]);
            return {
                ...result.rows?.[0],
                geometry1Format: geom1.isGeoJson ? 'GeoJSON' : 'WKT',
                geometry2Format: geom2.isGeoJson ? 'GeoJSON' : 'WKT'
            };
        }
    };
}

/**
 * Transform a standalone geometry between coordinate systems
 */
export function createGeometryTransformTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_geometry_transform',
        description: 'Transform a WKT or GeoJSON geometry from one SRID to another. Common SRIDs: 4326 (WGS84/GPS), 3857 (Web Mercator).',
        group: 'postgis',
        inputSchema: GeometryTransformSchemaBase,  // Base schema for MCP visibility
        annotations: readOnly('Geometry Transform'),
        icons: getToolIcons('postgis', readOnly('Geometry Transform')),
        handler: async (params: unknown, _context: RequestContext) => {
            const { geometry, fromSrid, toSrid } = GeometryTransformSchema.parse(params ?? {});
            const { sql: geomExpr, isGeoJson } = parseGeometry(geometry);

            const sql = `
                SELECT 
                    ST_AsGeoJSON(ST_Transform(ST_SetSRID(${geomExpr}, ${String(fromSrid)}), ${String(toSrid)})) as transformed_geojson,
                    ST_AsText(ST_Transform(ST_SetSRID(${geomExpr}, ${String(fromSrid)}), ${String(toSrid)})) as transformed_wkt,
                    ${String(fromSrid)} as from_srid,
                    ${String(toSrid)} as to_srid
            `;

            const result = await adapter.executeQuery(sql, [geometry]);
            return {
                ...result.rows?.[0],
                inputFormat: isGeoJson ? 'GeoJSON' : 'WKT'
            };
        }
    };
}
