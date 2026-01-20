/**
 * postgres-mcp - PostGIS Tool Schemas
 *
 * Input validation schemas for geospatial operations.
 * Supports parameter smoothing: tableName -> table, point property aliases
 *
 * Pattern: Export Base schemas for MCP visibility + Transformed schemas for handler validation.
 */

import { z } from "zod";

/**
 * Preprocess PostGIS parameters:
 * - Alias: tableName -> table
 * - Parse schema.table format
 * Exported for use in tool files with inline schemas.
 */
export function preprocessPostgisParams(input: unknown): unknown {
  if (typeof input !== "object" || input === null) {
    return input;
  }
  const result = { ...(input as Record<string, unknown>) };

  // Alias: tableName -> table
  if (result["tableName"] !== undefined && result["table"] === undefined) {
    result["table"] = result["tableName"];
  }

  // Parse schema.table format
  if (
    typeof result["table"] === "string" &&
    result["table"].includes(".") &&
    result["schema"] === undefined
  ) {
    const parts = result["table"].split(".");
    if (parts.length === 2) {
      result["schema"] = parts[0];
      result["table"] = parts[1];
    }
  }

  return result;
}

/**
 * Preprocess point object to support aliases:
 * - lon/longitude -> lng
 * - latitude -> lat
 * - x/y -> lng/lat
 *
 * Also validates coordinate bounds when validateBounds is true (default).
 * Throws ZodError-compatible error for consistency with schema validation.
 */
export function preprocessPoint(
  point: unknown,
  validateBounds = true,
): { lat: number; lng: number } | undefined {
  if (typeof point !== "object" || point === null) {
    return undefined;
  }
  const p = point as Record<string, unknown>;

  // Resolve lat aliases
  const lat = (p["lat"] ?? p["latitude"] ?? p["y"]) as number | undefined;
  // Resolve lng aliases
  const lng = (p["lng"] ?? p["lon"] ?? p["longitude"] ?? p["x"]) as
    | number
    | undefined;

  if (lat !== undefined && lng !== undefined) {
    // Validate coordinate bounds for consistency with pg_geocode
    if (validateBounds) {
      if (lat < -90 || lat > 90) {
        throw new Error(
          `Invalid latitude ${String(lat)}: must be between -90 and 90 degrees`,
        );
      }
      if (lng < -180 || lng > 180) {
        throw new Error(
          `Invalid longitude ${String(lng)}: must be between -180 and 180 degrees`,
        );
      }
    }
    return { lat, lng };
  }
  return undefined;
}

/**
 * Convert distance to meters based on unit
 */
export function convertToMeters(distance: number, unit?: string): number {
  if (distance < 0) {
    return distance; // Let validation catch negatives
  }
  if (unit === undefined || unit === "meters" || unit === "m") {
    return distance;
  }
  const u = unit.toLowerCase();
  if (u === "kilometers" || u === "km") {
    return distance * 1000;
  }
  if (u === "miles" || u === "mi") {
    return distance * 1609.344;
  }
  // Default to meters for unknown units
  return distance;
}

// =============================================================================
// Point schema (reused across multiple tools)
// =============================================================================
const PointSchemaBase = z.object({
  lat: z.number().optional(),
  latitude: z.number().optional(),
  y: z.number().optional(),
  lng: z.number().optional(),
  lon: z.number().optional(),
  longitude: z.number().optional(),
  x: z.number().optional(),
});

// =============================================================================
// pg_geometry_column
// =============================================================================
export const GeometryColumnSchemaBase = z.object({
  table: z.string().optional().describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
  column: z.string().optional().describe("Column name for the geometry"),
  geom: z.string().optional().describe("Alias for column"),
  geometryColumn: z.string().optional().describe("Alias for column"),
  srid: z
    .number()
    .optional()
    .describe("Spatial Reference ID (default: 4326 for WGS84)"),
  type: z
    .enum([
      "POINT",
      "LINESTRING",
      "POLYGON",
      "MULTIPOINT",
      "MULTILINESTRING",
      "MULTIPOLYGON",
      "GEOMETRY",
    ])
    .optional(),
  schema: z.string().optional(),
  ifNotExists: z
    .boolean()
    .optional()
    .describe(
      "Skip if column already exists (returns { alreadyExists: true })",
    ),
});

export const GeometryColumnSchema = GeometryColumnSchemaBase.transform(
  (data) => ({
    table: data.table ?? data.tableName ?? "",
    column: data.column ?? data.geom ?? data.geometryColumn ?? "",
    srid: data.srid,
    type: data.type,
    schema: data.schema,
    ifNotExists: data.ifNotExists,
  }),
)
  .refine((data) => data.table !== "", {
    message: "table (or tableName alias) is required",
  })
  .refine((data) => data.column !== "", {
    message: "column (or geom/geometryColumn alias) is required",
  });

// =============================================================================
// pg_distance (GeometryDistance)
// =============================================================================
export const GeometryDistanceSchemaBase = z.object({
  table: z.string().optional().describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
  column: z.string().optional().describe("Geometry column"),
  geom: z.string().optional().describe("Alias for column"),
  geometry: z.string().optional().describe("Alias for column"),
  geometryColumn: z.string().optional().describe("Alias for column"),
  point: PointSchemaBase.describe(
    "Reference point (supports lat/lng, latitude/longitude, or x/y)",
  ),
  limit: z.number().optional().describe("Max results"),
  maxDistance: z
    .number()
    .optional()
    .describe("Max distance (in meters by default)"),
  radius: z.number().optional().describe("Alias for maxDistance"),
  distance: z.number().optional().describe("Alias for maxDistance"),
  unit: z
    .enum(["meters", "m", "kilometers", "km", "miles", "mi"])
    .optional()
    .describe("Distance unit (default: meters)"),
  schema: z.string().optional().describe("Schema name (default: public)"),
});

export const GeometryDistanceSchema = z
  .preprocess(preprocessPostgisParams, GeometryDistanceSchemaBase)
  .transform((data) => {
    const point = preprocessPoint(data.point);
    const rawDistance = data.maxDistance ?? data.radius ?? data.distance;
    return {
      table: data.table ?? data.tableName ?? "",
      column:
        data.column ?? data.geom ?? data.geometry ?? data.geometryColumn ?? "",
      point: point ?? { lat: 0, lng: 0 },
      limit: data.limit,
      maxDistance:
        rawDistance !== undefined
          ? convertToMeters(rawDistance, data.unit)
          : undefined,
      unit: data.unit,
      schema: data.schema,
    };
  })
  .refine((data) => data.table !== "", {
    message: "table (or tableName alias) is required",
  })
  .refine((data) => data.column !== "", {
    message: "column (or geom/geometry/geometryColumn alias) is required",
  })
  .refine((data) => data.maxDistance === undefined || data.maxDistance >= 0, {
    message: "distance must be a non-negative number",
  });

// =============================================================================
// pg_point_in_polygon
// =============================================================================
export const PointInPolygonSchemaBase = z.object({
  table: z.string().optional().describe("Table with polygons"),
  tableName: z.string().optional().describe("Alias for table"),
  column: z.string().optional().describe("Geometry column"),
  geom: z.string().optional().describe("Alias for column"),
  geometry: z.string().optional().describe("Alias for column"),
  geometryColumn: z.string().optional().describe("Alias for column"),
  point: PointSchemaBase.describe(
    "Point to check (supports lat/lng, latitude/longitude, or x/y)",
  ),
  schema: z.string().optional().describe("Schema name (default: public)"),
});

export const PointInPolygonSchema = z
  .preprocess(preprocessPostgisParams, PointInPolygonSchemaBase)
  .transform((data) => {
    const point = preprocessPoint(data.point);
    return {
      table: data.table ?? data.tableName ?? "",
      column:
        data.column ?? data.geom ?? data.geometry ?? data.geometryColumn ?? "",
      point: point ?? { lat: 0, lng: 0 },
      schema: data.schema,
    };
  })
  .refine((data) => data.table !== "", {
    message: "table (or tableName alias) is required",
  })
  .refine((data) => data.column !== "", {
    message: "column (or geom/geometry/geometryColumn alias) is required",
  });

// =============================================================================
// pg_spatial_index
// =============================================================================
export const SpatialIndexSchemaBase = z.object({
  table: z.string().optional().describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
  column: z.string().optional().describe("Geometry column"),
  geom: z.string().optional().describe("Alias for column"),
  geometry: z.string().optional().describe("Alias for column"),
  geometryColumn: z.string().optional().describe("Alias for column"),
  name: z.string().optional().describe("Index name"),
  indexName: z.string().optional().describe("Alias for name"),
  ifNotExists: z
    .boolean()
    .optional()
    .describe("Skip if index already exists (returns { alreadyExists: true })"),
  schema: z.string().optional().describe("Schema name (default: public)"),
});

export const SpatialIndexSchema = z
  .preprocess(preprocessPostgisParams, SpatialIndexSchemaBase)
  .transform((data) => ({
    table: data.table ?? data.tableName ?? "",
    column:
      data.column ?? data.geom ?? data.geometry ?? data.geometryColumn ?? "",
    name: data.name ?? data.indexName,
    ifNotExists: data.ifNotExists,
    schema: data.schema,
  }))
  .refine((data) => data.table !== "", {
    message: "table (or tableName alias) is required",
  })
  .refine((data) => data.column !== "", {
    message: "column (or geom/geometry/geometryColumn alias) is required",
  });

// =============================================================================
// pg_buffer
// =============================================================================
export const BufferSchemaBase = z.object({
  table: z.string().optional().describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
  schema: z.string().optional().describe("Schema name (default: public)"),
  column: z.string().optional().describe("Geometry column"),
  geom: z.string().optional().describe("Alias for column"),
  geometryColumn: z.string().optional().describe("Alias for column"),
  distance: z
    .number()
    .optional()
    .describe("Buffer distance (in meters by default)"),
  meters: z.number().optional().describe("Alias for distance"),
  radius: z.number().optional().describe("Alias for distance"),
  unit: z
    .enum(["meters", "m", "kilometers", "km", "miles", "mi"])
    .optional()
    .describe("Distance unit (default: meters)"),
  where: z.string().optional(),
});

export const BufferSchema = z
  .preprocess(preprocessPostgisParams, BufferSchemaBase)
  .transform((data) => {
    const rawDistance = data.distance ?? data.meters ?? data.radius ?? 0;
    return {
      table: data.table ?? data.tableName ?? "",
      schema: data.schema,
      column: data.column ?? data.geom ?? data.geometryColumn ?? "",
      distance: convertToMeters(rawDistance, data.unit),
      unit: data.unit,
      where: data.where,
    };
  })
  .refine((data) => data.table !== "", {
    message: "table (or tableName alias) is required",
  })
  .refine((data) => data.column !== "", {
    message: "column (or geom/geometryColumn alias) is required",
  })
  .refine((data) => data.distance > 0, {
    message:
      "distance (or radius/meters alias) is required and must be positive",
  });

// =============================================================================
// pg_intersection
// =============================================================================
export const IntersectionSchemaBase = z.object({
  table: z.string().optional().describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
  schema: z.string().optional().describe("Schema name (default: public)"),
  column: z.string().optional().describe("Geometry column"),
  geom: z.string().optional().describe("Alias for column"),
  geometryColumn: z.string().optional().describe("Alias for column"),
  geometry: z
    .string()
    .optional()
    .describe(
      'GeoJSON or WKT geometry to check intersection (e.g., "POINT(0 0)" or GeoJSON)',
    ),
  srid: z
    .number()
    .optional()
    .describe(
      "SRID for input geometry (auto-detected from column if not provided)",
    ),
  select: z.array(z.string()).optional().describe("Columns to select"),
});

export const IntersectionSchema = z
  .preprocess(preprocessPostgisParams, IntersectionSchemaBase)
  .transform((data) => ({
    table: data.table ?? data.tableName ?? "",
    schema: data.schema,
    column: data.column ?? data.geom ?? data.geometryColumn ?? "",
    geometry: data.geometry ?? "",
    srid: data.srid,
    select: data.select,
  }))
  .refine((data) => data.table !== "", {
    message: "table (or tableName alias) is required",
  })
  .refine((data) => data.column !== "", {
    message: "column (or geom/geometryColumn alias) is required",
  })
  .refine((data) => data.geometry !== "", {
    message: "geometry is required (WKT like 'POINT(0 0)' or GeoJSON string)",
  });

// =============================================================================
// pg_bounding_box
// =============================================================================
export const BoundingBoxSchemaBase = z.object({
  table: z.string().optional().describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
  schema: z.string().optional().describe("Schema name (default: public)"),
  column: z.string().optional().describe("Geometry column"),
  geom: z.string().optional().describe("Alias for column"),
  geometryColumn: z.string().optional().describe("Alias for column"),
  minLng: z.number().describe("Minimum longitude"),
  minLat: z.number().describe("Minimum latitude"),
  maxLng: z.number().describe("Maximum longitude"),
  maxLat: z.number().describe("Maximum latitude"),
  select: z.array(z.string()).optional().describe("Columns to select"),
});

export const BoundingBoxSchema = z
  .preprocess(preprocessPostgisParams, BoundingBoxSchemaBase)
  .transform((data) => ({
    table: data.table ?? data.tableName ?? "",
    schema: data.schema,
    column: data.column ?? data.geom ?? data.geometryColumn ?? "",
    minLng: data.minLng,
    minLat: data.minLat,
    maxLng: data.maxLng,
    maxLat: data.maxLat,
    select: data.select,
  }))
  .refine((data) => data.table !== "", {
    message: "table (or tableName alias) is required",
  })
  .refine((data) => data.column !== "", {
    message: "column (or geom/geometryColumn alias) is required",
  });

// =============================================================================
// pg_geocode
// =============================================================================
export const GeocodeSchemaBase = z.object({
  lat: z.number().optional().describe("Latitude (-90 to 90)"),
  latitude: z.number().optional().describe("Alias for lat"),
  lng: z.number().optional().describe("Longitude (-180 to 180)"),
  lon: z.number().optional().describe("Alias for lng"),
  longitude: z.number().optional().describe("Alias for lng"),
  srid: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Spatial Reference ID for output geometry (default: 4326)"),
});

/**
 * Preprocess geocode point to support aliases
 */
function preprocessGeocodeParams(input: unknown): unknown {
  if (typeof input !== "object" || input === null) {
    return input;
  }
  const p = input as Record<string, unknown>;
  const result = { ...p };

  if (result["latitude"] !== undefined && result["lat"] === undefined) {
    result["lat"] = result["latitude"];
  }
  if (
    (result["lon"] !== undefined || result["longitude"] !== undefined) &&
    result["lng"] === undefined
  ) {
    result["lng"] = result["lon"] ?? result["longitude"];
  }

  return result;
}

export const GeocodeSchema = z
  .preprocess(preprocessGeocodeParams, GeocodeSchemaBase)
  .transform((data) => ({
    lat: data.lat ?? data.latitude,
    lng: data.lng ?? data.lon ?? data.longitude,
    srid: data.srid,
  }))
  .refine((data) => data.lat !== undefined, {
    message: "lat (or latitude alias) is required",
  })
  .refine((data) => data.lng !== undefined, {
    message: "lng (or lon/longitude alias) is required",
  })
  .refine(
    (data) => data.lat === undefined || (data.lat >= -90 && data.lat <= 90),
    {
      message: "lat must be between -90 and 90 degrees",
    },
  )
  .refine(
    (data) => data.lng === undefined || (data.lng >= -180 && data.lng <= 180),
    {
      message: "lng must be between -180 and 180 degrees",
    },
  );

// =============================================================================
// pg_geo_transform
// =============================================================================
export const GeoTransformSchemaBase = z.object({
  table: z.string().optional().describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
  schema: z.string().optional().describe("Schema name (default: public)"),
  column: z.string().optional().describe("Geometry column"),
  geom: z.string().optional().describe("Alias for column"),
  geometryColumn: z.string().optional().describe("Alias for column"),
  fromSrid: z.number().optional().describe("Source SRID"),
  sourceSrid: z.number().optional().describe("Alias for fromSrid"),
  toSrid: z.number().optional().describe("Target SRID"),
  targetSrid: z.number().optional().describe("Alias for toSrid"),
  where: z.string().optional().describe("Filter condition"),
  limit: z.number().optional().describe("Maximum rows to return"),
});

export const GeoTransformSchema = z
  .preprocess(preprocessPostgisParams, GeoTransformSchemaBase)
  .transform((data) => ({
    table: data.table ?? data.tableName ?? "",
    schema: data.schema,
    column: data.column ?? data.geom ?? data.geometryColumn ?? "",
    fromSrid: data.fromSrid ?? data.sourceSrid ?? 0,
    toSrid: data.toSrid ?? data.targetSrid ?? 0,
    where: data.where,
    limit: data.limit,
  }))
  .refine((data) => data.table !== "", {
    message: "table (or tableName alias) is required",
  })
  .refine((data) => data.column !== "", {
    message: "column (or geom/geometryColumn alias) is required",
  })
  .refine((data) => data.fromSrid > 0, {
    message: "fromSrid (or sourceSrid alias) is required",
  })
  .refine((data) => data.toSrid > 0, {
    message: "toSrid (or targetSrid alias) is required",
  });

// =============================================================================
// pg_geo_cluster
// =============================================================================
export const GeoClusterSchemaBase = z.object({
  table: z.string().optional().describe("Table name"),
  tableName: z.string().optional().describe("Alias for table"),
  schema: z.string().optional().describe("Schema name (default: public)"),
  column: z.string().optional().describe("Geometry column name"),
  geom: z.string().optional().describe("Alias for column"),
  geometryColumn: z.string().optional().describe("Alias for column"),
  method: z
    .enum(["dbscan", "kmeans"])
    .optional()
    .describe("Clustering method (default: dbscan)"),
  algorithm: z
    .enum(["dbscan", "kmeans"])
    .optional()
    .describe("Alias for method"),
  eps: z.number().optional().describe("DBSCAN: Distance threshold"),
  minPoints: z
    .number()
    .optional()
    .describe("DBSCAN: Minimum points per cluster"),
  numClusters: z.number().optional().describe("K-Means: Number of clusters"),
  k: z.number().optional().describe("Alias for numClusters"),
  clusters: z.number().optional().describe("Alias for numClusters"),
  params: z
    .object({
      eps: z.number().optional(),
      minPoints: z.number().optional(),
      numClusters: z.number().optional(),
      k: z.number().optional(),
    })
    .optional()
    .describe("Algorithm parameters object (top-level params take precedence)"),
  where: z.string().optional().describe("WHERE clause filter"),
  limit: z.number().optional(),
});

export const GeoClusterSchema = z
  .preprocess(preprocessPostgisParams, GeoClusterSchemaBase)
  .transform((data) => {
    const paramsObj = data.params ?? {};
    return {
      table: data.table ?? data.tableName ?? "",
      schema: data.schema,
      column: data.column ?? data.geom ?? data.geometryColumn ?? "",
      method: data.method ?? data.algorithm,
      eps: data.eps ?? paramsObj.eps,
      minPoints: data.minPoints ?? paramsObj.minPoints,
      numClusters:
        data.numClusters ??
        data.k ??
        data.clusters ??
        paramsObj.numClusters ??
        paramsObj.k,
      where: data.where,
      limit: data.limit,
    };
  })
  .refine((data) => data.table !== "", {
    message: "table (or tableName alias) is required",
  })
  .refine((data) => data.column !== "", {
    message: "column (or geom/geometryColumn alias) is required",
  });

// =============================================================================
// Standalone Geometry Tools
// =============================================================================

// pg_geometry_buffer
export const GeometryBufferSchemaBase = z.object({
  geometry: z.string().optional().describe("WKT or GeoJSON geometry string"),
  wkt: z.string().optional().describe("Alias for geometry (WKT format)"),
  geojson: z
    .string()
    .optional()
    .describe("Alias for geometry (GeoJSON format)"),
  distance: z
    .number()
    .optional()
    .describe("Buffer distance (in meters by default)"),
  radius: z.number().optional().describe("Alias for distance"),
  meters: z.number().optional().describe("Alias for distance"),
  unit: z
    .enum(["meters", "m", "kilometers", "km", "miles", "mi"])
    .optional()
    .describe("Distance unit (default: meters)"),
  srid: z
    .number()
    .optional()
    .describe("Spatial Reference ID (default: 4326 for WGS84)"),
});

export const GeometryBufferSchema = GeometryBufferSchemaBase.transform(
  (data) => {
    const rawDistance = data.distance ?? data.radius ?? data.meters ?? 0;
    return {
      geometry: data.geometry ?? data.wkt ?? data.geojson ?? "",
      distance: convertToMeters(rawDistance, data.unit),
      unit: data.unit,
      srid: data.srid,
    };
  },
)
  .refine((data) => data.geometry !== "", {
    message: "geometry (or wkt/geojson alias) is required",
  })
  .refine((data) => data.distance > 0, {
    message:
      "distance (or radius/meters alias) is required and must be positive",
  });

// pg_geometry_intersection
export const GeometryIntersectionSchemaBase = z.object({
  geometry1: z.string().describe("First WKT or GeoJSON geometry"),
  geometry2: z.string().describe("Second WKT or GeoJSON geometry"),
});

export const GeometryIntersectionSchema = GeometryIntersectionSchemaBase;

// pg_geometry_transform
export const GeometryTransformSchemaBase = z.object({
  geometry: z.string().optional().describe("WKT or GeoJSON geometry string"),
  wkt: z.string().optional().describe("Alias for geometry"),
  geojson: z.string().optional().describe("Alias for geometry"),
  fromSrid: z
    .number()
    .optional()
    .describe("Source SRID (e.g., 4326 for WGS84)"),
  sourceSrid: z.number().optional().describe("Alias for fromSrid"),
  toSrid: z
    .number()
    .optional()
    .describe("Target SRID (e.g., 3857 for Web Mercator)"),
  targetSrid: z.number().optional().describe("Alias for toSrid"),
});

export const GeometryTransformSchema = GeometryTransformSchemaBase.transform(
  (data) => ({
    geometry: data.geometry ?? data.wkt ?? data.geojson ?? "",
    fromSrid: data.fromSrid ?? data.sourceSrid ?? 0,
    toSrid: data.toSrid ?? data.targetSrid ?? 0,
  }),
)
  .refine((data) => data.geometry !== "", {
    message: "geometry (or wkt/geojson alias) is required",
  })
  .refine((data) => data.fromSrid > 0, {
    message: "fromSrid (or sourceSrid alias) is required",
  })
  .refine((data) => data.toSrid > 0, {
    message: "toSrid (or targetSrid alias) is required",
  });
