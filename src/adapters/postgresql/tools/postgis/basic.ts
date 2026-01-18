/**
 * PostgreSQL PostGIS Extension Tools - Basic Operations
 *
 * Core spatial tools: extension, geometry_column, point_in_polygon, distance, buffer, intersection, bounding_box, spatial_index.
 */

import type { PostgresAdapter } from "../../PostgresAdapter.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../types/index.js";
import { z } from "zod";
import { readOnly, write } from "../../../../utils/annotations.js";
import { getToolIcons } from "../../../../utils/icons.js";
import {
  sanitizeIdentifier,
  sanitizeTableName,
} from "../../../../utils/identifiers.js";
import {
  GeometryColumnSchemaBase,
  GeometryColumnSchema,
  GeometryDistanceSchemaBase,
  GeometryDistanceSchema,
  PointInPolygonSchemaBase,
  PointInPolygonSchema,
  SpatialIndexSchemaBase,
  SpatialIndexSchema,
  BufferSchemaBase,
  BufferSchema,
  IntersectionSchemaBase,
  IntersectionSchema,
  BoundingBoxSchemaBase,
  BoundingBoxSchema,
} from "../../schemas/index.js";

export function createPostgisExtensionTool(
  adapter: PostgresAdapter,
): ToolDefinition {
  return {
    name: "pg_postgis_create_extension",
    description: "Enable the PostGIS extension for geospatial operations.",
    group: "postgis",
    inputSchema: z.object({}),
    annotations: write("Create PostGIS Extension"),
    icons: getToolIcons("postgis", write("Create PostGIS Extension")),
    handler: async (_params: unknown, _context: RequestContext) => {
      await adapter.executeQuery("CREATE EXTENSION IF NOT EXISTS postgis");
      return { success: true, message: "PostGIS extension enabled" };
    },
  };
}

export function createGeometryColumnTool(
  adapter: PostgresAdapter,
): ToolDefinition {
  return {
    name: "pg_geometry_column",
    description:
      "Add a geometry column to a table. Returns alreadyExists: true if column exists.",
    group: "postgis",
    inputSchema: GeometryColumnSchemaBase, // Base schema for MCP visibility
    annotations: write("Add Geometry Column"),
    icons: getToolIcons("postgis", write("Add Geometry Column")),
    handler: async (params: unknown, _context: RequestContext) => {
      const parsed = GeometryColumnSchema.parse(params ?? {});

      const schemaName = parsed.schema ?? "public";
      const srid = parsed.srid ?? 4326;
      const geomType = parsed.type ?? "GEOMETRY";

      // Always check if column already exists (for accurate response message)
      const checkSql = `SELECT column_name FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2 AND column_name = $3`;
      const checkResult = await adapter.executeQuery(checkSql, [
        schemaName,
        parsed.table,
        parsed.column,
      ]);
      const columnExists =
        checkResult.rows !== undefined && checkResult.rows.length > 0;

      if (columnExists) {
        if (parsed.ifNotExists === true) {
          return {
            success: true,
            alreadyExists: true,
            table: parsed.table,
            column: parsed.column,
          };
        }
        // Without ifNotExists: true, this should be an error
        return {
          success: false,
          error: `Column "${parsed.column}" already exists in table "${parsed.table}".`,
          table: parsed.table,
          column: parsed.column,
          suggestion:
            "Use ifNotExists: true to skip this error if the column already exists.",
        };
      }

      // Check if table exists before trying to add column
      const tableCheckSql = `SELECT 1 FROM information_schema.tables WHERE table_schema = $1 AND table_name = $2`;
      const tableCheckResult = await adapter.executeQuery(tableCheckSql, [
        schemaName,
        parsed.table,
      ]);
      if ((tableCheckResult.rows?.length ?? 0) === 0) {
        return {
          success: false,
          error: `Table "${parsed.table}" does not exist in schema "${schemaName}".`,
          table: parsed.table,
          schema: schemaName,
          suggestion: "Create the table first, then add the geometry column.",
        };
      }

      const sql = `SELECT AddGeometryColumn('${schemaName}', '${parsed.table}', '${parsed.column}', ${String(srid)}, '${geomType}', 2)`;
      await adapter.executeQuery(sql);

      return {
        success: true,
        table: parsed.table,
        column: parsed.column,
        srid,
        type: geomType,
      };
    },
  };
}

export function createPointInPolygonTool(
  adapter: PostgresAdapter,
): ToolDefinition {
  return {
    name: "pg_point_in_polygon",
    description:
      "Check if a point is within any polygon in a table. The geometry column should contain POLYGON or MULTIPOLYGON geometries.",
    group: "postgis",
    inputSchema: PointInPolygonSchemaBase, // Base schema for MCP visibility
    annotations: readOnly("Point in Polygon"),
    icons: getToolIcons("postgis", readOnly("Point in Polygon")),
    handler: async (params: unknown, _context: RequestContext) => {
      const { table, column, point, schema } = PointInPolygonSchema.parse(
        params ?? {},
      );
      const schemaName = schema ?? "public";
      const tableName = sanitizeTableName(
        table,
        schemaName !== "public" ? schemaName : undefined,
      );
      const columnName = sanitizeIdentifier(column);

      // Check geometry type and warn if not polygon
      const typeCheckSql = `SELECT DISTINCT GeometryType(${columnName}) as geom_type FROM ${tableName} WHERE ${columnName} IS NOT NULL LIMIT 1`;
      const typeResult = await adapter.executeQuery(typeCheckSql);
      const geomType = typeResult.rows?.[0]?.["geom_type"] as
        | string
        | undefined;
      const isPolygonType =
        geomType?.toUpperCase()?.includes("POLYGON") ?? false;

      const sql = `SELECT *, ST_AsText(${columnName}) as geometry_text
                        FROM ${tableName}
                        WHERE ST_Contains(${columnName}, ST_SetSRID(ST_MakePoint($1, $2), 4326))`;

      const result = await adapter.executeQuery(sql, [point.lng, point.lat]);

      const response: Record<string, unknown> = {
        containingPolygons: result.rows,
        count: result.rows?.length ?? 0,
      };

      // Add warning if geometry type is not polygon
      if (!isPolygonType && geomType !== undefined) {
        response["warning"] =
          `Column "${column}" contains ${geomType} geometries, not polygons. ST_Contains requires polygons to produce meaningful results.`;
      }

      return response;
    },
  };
}

export function createDistanceTool(adapter: PostgresAdapter): ToolDefinition {
  return {
    name: "pg_distance",
    description:
      "Find nearby geometries within a distance from a point. Output distance_meters is always in meters; unit parameter only affects the filter threshold.",
    group: "postgis",
    inputSchema: GeometryDistanceSchemaBase, // Base schema for MCP visibility
    annotations: readOnly("Distance Search"),
    icons: getToolIcons("postgis", readOnly("Distance Search")),
    handler: async (params: unknown, _context: RequestContext) => {
      const { table, column, point, limit, maxDistance, schema } =
        GeometryDistanceSchema.parse(params);
      const schemaName = schema ?? "public";
      const tableName = sanitizeTableName(
        table,
        schemaName !== "public" ? schemaName : undefined,
      );
      const columnName = sanitizeIdentifier(column);
      const limitVal = limit ?? 10;
      const distanceFilter =
        maxDistance !== undefined && maxDistance > 0
          ? `WHERE distance_meters <= ${String(maxDistance)}`
          : "";

      // Use CTE for consistent distance calculation and filtering
      const sql = `WITH distances AS (
                SELECT *, 
                    ST_AsText(${columnName}) as geometry_text,
                    ST_Distance(${columnName}::geography, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography) as distance_meters
                FROM ${tableName}
            )
            SELECT * FROM distances
            ${distanceFilter}
            ORDER BY distance_meters
            LIMIT ${String(limitVal)}`;

      const result = await adapter.executeQuery(sql, [point.lng, point.lat]);
      return { results: result.rows, count: result.rows?.length ?? 0 };
    },
  };
}

export function createBufferTool(adapter: PostgresAdapter): ToolDefinition {
  return {
    name: "pg_buffer",
    description: "Create a buffer zone around geometries.",
    group: "postgis",
    inputSchema: BufferSchemaBase, // Base schema for MCP visibility
    annotations: readOnly("Buffer Zone"),
    icons: getToolIcons("postgis", readOnly("Buffer Zone")),
    handler: async (params: unknown, _context: RequestContext) => {
      const parsed = BufferSchema.parse(params ?? {});
      const whereClause =
        parsed.where !== undefined ? ` WHERE ${parsed.where}` : "";

      const schemaName = parsed.schema ?? "public";
      const qualifiedTable = sanitizeTableName(
        parsed.table,
        schemaName !== "public" ? schemaName : undefined,
      );
      const columnName = sanitizeIdentifier(parsed.column);

      const sql = `SELECT *, ST_AsText(${columnName}) as geometry_text, ST_AsGeoJSON(ST_Buffer(${columnName}::geography, $1)::geometry) as buffer_geojson
                        FROM ${qualifiedTable}${whereClause}`;

      const result = await adapter.executeQuery(sql, [parsed.distance]);
      return { results: result.rows };
    },
  };
}

export function createIntersectionTool(
  adapter: PostgresAdapter,
): ToolDefinition {
  return {
    name: "pg_intersection",
    description:
      "Find geometries that intersect with a given geometry. Auto-detects SRID from target column if not specified.",
    group: "postgis",
    inputSchema: IntersectionSchemaBase, // Base schema for MCP visibility
    annotations: readOnly("Intersection Search"),
    icons: getToolIcons("postgis", readOnly("Intersection Search")),
    handler: async (params: unknown, _context: RequestContext) => {
      const parsed = IntersectionSchema.parse(params ?? {});
      const schemaName = parsed.schema ?? "public";
      const qualifiedTable = sanitizeTableName(
        parsed.table,
        schemaName !== "public" ? schemaName : undefined,
      );
      const columnName = sanitizeIdentifier(parsed.column);
      const selectCols =
        parsed.select !== undefined && parsed.select.length > 0
          ? parsed.select.map((c) => sanitizeIdentifier(c)).join(", ")
          : "*";

      const isGeoJson = parsed.geometry.trim().startsWith("{");

      // Auto-detect SRID from column if not provided and using WKT
      let srid = parsed.srid;
      if (!isGeoJson && srid === undefined) {
        // Query the column's SRID from geometry_columns or geography_columns
        const sridQuery = `
                    SELECT srid FROM geometry_columns 
                    WHERE f_table_schema = $1 AND f_table_name = $2 AND f_geometry_column = $3
                    UNION
                    SELECT srid FROM geography_columns 
                    WHERE f_table_schema = $1 AND f_table_name = $2 AND f_geography_column = $3
                    LIMIT 1
                `;
        const sridResult = await adapter.executeQuery(sridQuery, [
          schemaName,
          parsed.table,
          parsed.column,
        ]);
        const sridValue = sridResult.rows?.[0]?.["srid"];
        if (sridValue !== undefined && sridValue !== null) {
          srid = Number(sridValue);
        }
      }

      // Build geometry expression with SRID if available
      let geomExpr: string;
      if (isGeoJson) {
        geomExpr = `ST_GeomFromGeoJSON($1)`;
      } else if (srid !== undefined) {
        geomExpr = `ST_SetSRID(ST_GeomFromText($1), ${String(srid)})`;
      } else {
        geomExpr = `ST_GeomFromText($1)`;
      }

      const sql = `SELECT ${selectCols}
                        FROM ${qualifiedTable}
                        WHERE ST_Intersects(${columnName}, ${geomExpr})`;

      const result = await adapter.executeQuery(sql, [parsed.geometry]);
      return {
        intersecting: result.rows,
        count: result.rows?.length ?? 0,
        sridUsed: srid ?? "none (explicit SRID in geometry or GeoJSON)",
      };
    },
  };
}

export function createBoundingBoxTool(
  adapter: PostgresAdapter,
): ToolDefinition {
  return {
    name: "pg_bounding_box",
    description:
      "Find geometries within a bounding box. Swapped min/max values are auto-corrected.",
    group: "postgis",
    inputSchema: BoundingBoxSchemaBase, // Base schema for MCP visibility
    annotations: readOnly("Bounding Box Search"),
    icons: getToolIcons("postgis", readOnly("Bounding Box Search")),
    handler: async (params: unknown, _context: RequestContext) => {
      const parsed = BoundingBoxSchema.parse(params ?? {});

      const schemaName = parsed.schema ?? "public";
      const qualifiedTable = sanitizeTableName(
        parsed.table,
        schemaName !== "public" ? schemaName : undefined,
      );
      const columnName = sanitizeIdentifier(parsed.column);
      const selectCols =
        parsed.select !== undefined && parsed.select.length > 0
          ? parsed.select.map((c) => sanitizeIdentifier(c)).join(", ")
          : "*";

      // Auto-correct swapped bounds
      const corrections: string[] = [];
      let actualMinLng = parsed.minLng;
      let actualMaxLng = parsed.maxLng;
      let actualMinLat = parsed.minLat;
      let actualMaxLat = parsed.maxLat;

      if (parsed.minLng > parsed.maxLng) {
        actualMinLng = parsed.maxLng;
        actualMaxLng = parsed.minLng;
        corrections.push("minLng/maxLng were swapped");
      }
      if (parsed.minLat > parsed.maxLat) {
        actualMinLat = parsed.maxLat;
        actualMaxLat = parsed.minLat;
        corrections.push("minLat/maxLat were swapped");
      }

      const sql = `SELECT ${selectCols}, ST_AsText(${columnName}) as geometry_text
                        FROM ${qualifiedTable}
                        WHERE ${columnName} && ST_MakeEnvelope($1, $2, $3, $4, 4326)`;

      const result = await adapter.executeQuery(sql, [
        actualMinLng,
        actualMinLat,
        actualMaxLng,
        actualMaxLat,
      ]);

      const response: Record<string, unknown> = {
        results: result.rows,
        count: result.rows?.length ?? 0,
      };

      if (corrections.length > 0) {
        response["note"] = `Auto-corrected: ${corrections.join(", ")}`;
      }

      return response;
    },
  };
}

export function createSpatialIndexTool(
  adapter: PostgresAdapter,
): ToolDefinition {
  return {
    name: "pg_spatial_index",
    description:
      "Create a GiST spatial index for geometry column. Uses IF NOT EXISTS to avoid errors on duplicate names.",
    group: "postgis",
    inputSchema: SpatialIndexSchemaBase, // Base schema for MCP visibility
    annotations: write("Create Spatial Index"),
    icons: getToolIcons("postgis", write("Create Spatial Index")),
    handler: async (params: unknown, _context: RequestContext) => {
      const { table, column, name, ifNotExists, schema } =
        SpatialIndexSchema.parse(params);
      const schemaName = schema ?? "public";
      const indexNameRaw = name ?? `idx_${table}_${column}_gist`;

      // Check if index already exists (for accurate response message)
      const checkSql = `SELECT EXISTS(SELECT 1 FROM pg_indexes WHERE schemaname = $1 AND indexname = $2) as exists`;
      const checkResult = await adapter.executeQuery(checkSql, [
        schemaName,
        indexNameRaw,
      ]);
      const indexExists = checkResult.rows?.[0]?.["exists"] as boolean;

      if (indexExists) {
        if (ifNotExists === true) {
          return {
            success: true,
            alreadyExists: true,
            index: indexNameRaw,
            table,
            column,
          };
        }
        // Use IF NOT EXISTS to return friendly message instead of PostgreSQL error
        return {
          success: true,
          alreadyExists: true,
          index: indexNameRaw,
          table,
          column,
          note: "Index already exists. Use ifNotExists: true to suppress this note.",
        };
      }

      const qualifiedTable = sanitizeTableName(
        table,
        schemaName !== "public" ? schemaName : undefined,
      );
      const columnName = sanitizeIdentifier(column);
      const indexName = sanitizeIdentifier(indexNameRaw);

      // Check if table exists before trying to create index
      const tableCheckSql = `SELECT 1 FROM information_schema.tables WHERE table_schema = $1 AND table_name = $2`;
      const tableCheckResult = await adapter.executeQuery(tableCheckSql, [
        schemaName,
        table,
      ]);
      if ((tableCheckResult.rows?.length ?? 0) === 0) {
        return {
          success: false,
          error: `Table "${table}" does not exist in schema "${schemaName}".`,
          table,
          schema: schemaName,
          suggestion: "Create the table first, then add the spatial index.",
        };
      }

      // Always use IF NOT EXISTS to prevent unclear PostgreSQL errors
      const sql = `CREATE INDEX IF NOT EXISTS ${indexName} ON ${qualifiedTable} USING GIST (${columnName})`;
      await adapter.executeQuery(sql);
      return { success: true, index: indexNameRaw, table, column };
    },
  };
}
