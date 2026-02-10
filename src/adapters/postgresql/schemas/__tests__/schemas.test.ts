/**
 * Unit tests for PostgreSQL Validation Schemas
 *
 * Tests for Zod schemas that validate tool input parameters.
 * Focus on edge cases and validation paths for coverage improvement.
 */

import { describe, it, expect } from "vitest";

// Vector schemas
import {
  FiniteNumberArray,
  VectorSearchSchema,
  VectorCreateIndexSchema,
} from "../vector.js";

// PostGIS schemas
import {
  preprocessPostgisParams,
  preprocessPoint,
  convertToMeters,
  GeometryColumnSchema,
  GeometryDistanceSchema,
  BufferSchema,
  GeocodeSchema,
  GeoTransformSchema,
} from "../postgis.js";

// Schema management schemas
import {
  CreateSequenceSchema,
  CreateViewSchema,
  DropSequenceSchema,
  DropViewSchema,
  ListFunctionsSchema,
} from "../schema-mgmt.js";

// =============================================================================
// Vector Schema Tests
// =============================================================================
describe("FiniteNumberArray", () => {
  it("should accept valid finite number arrays", () => {
    const result = FiniteNumberArray.safeParse([1, 2, 3, 4.5, -0.5]);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toEqual([1, 2, 3, 4.5, -0.5]);
    }
  });

  it("should accept empty arrays", () => {
    const result = FiniteNumberArray.safeParse([]);
    expect(result.success).toBe(true);
  });

  // Note: Zod v4's z.number() already rejects Infinity/NaN at parse level
  // The superRefine provides a clearer error for v3 compatibility, but in v4 these fail earlier
  it("should reject arrays containing Infinity", () => {
    const result = FiniteNumberArray.safeParse([1, Infinity, 3]);
    expect(result.success).toBe(false);
  });

  it("should reject arrays containing -Infinity", () => {
    const result = FiniteNumberArray.safeParse([1, -Infinity, 3]);
    expect(result.success).toBe(false);
  });

  it("should reject arrays containing NaN", () => {
    const result = FiniteNumberArray.safeParse([1, NaN, 3]);
    expect(result.success).toBe(false);
  });

  it("should reject arrays with multiple invalid values", () => {
    const result = FiniteNumberArray.safeParse([1, Infinity, 3, NaN, 5]);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.length).toBeGreaterThan(0);
    }
  });

  it("should accept large finite numbers", () => {
    const result = FiniteNumberArray.safeParse([
      Number.MAX_VALUE,
      Number.MIN_VALUE,
    ]);
    expect(result.success).toBe(true);
  });
});

describe("VectorSearchSchema", () => {
  it("should resolve table and column from aliases", () => {
    const result = VectorSearchSchema.parse({
      tableName: "embeddings",
      col: "vector",
      vector: [1, 2, 3],
    });
    expect(result.table).toBe("embeddings");
    expect(result.column).toBe("vector");
  });

  it("should parse schema.table format", () => {
    const result = VectorSearchSchema.parse({
      table: "myschema.embeddings",
      column: "vector",
      vector: [1, 2, 3],
    });
    expect(result.table).toBe("embeddings");
    expect(result.schema).toBe("myschema");
  });

  it("should prefer embedded schema over explicit schema param", () => {
    const result = VectorSearchSchema.parse({
      table: "embedded.embeddings",
      column: "vector",
      vector: [1, 2, 3],
      schema: "explicit",
    });
    // Embedded schema takes priority
    expect(result.schema).toBe("embedded");
    expect(result.table).toBe("embeddings");
  });

  it("should handle table without schema", () => {
    const result = VectorSearchSchema.parse({
      table: "embeddings",
      column: "vector",
      vector: [0.1, 0.2],
    });
    expect(result.table).toBe("embeddings");
    expect(result.schema).toBeUndefined();
  });

  it("should resolve where from filter alias", () => {
    const result = VectorSearchSchema.parse({
      table: "embeddings",
      column: "vector",
      vector: [1, 2],
      filter: "active = true",
    });
    expect(result.where).toBe("active = true");
  });

  it("should accept all optional parameters", () => {
    const result = VectorSearchSchema.parse({
      table: "embeddings",
      column: "vector",
      vector: [1, 2, 3],
      metric: "cosine",
      limit: 10,
      select: ["id", "name"],
      where: "category = 'test'",
      excludeNull: true,
    });
    expect(result.metric).toBe("cosine");
    expect(result.limit).toBe(10);
    expect(result.select).toEqual(["id", "name"]);
    expect(result.excludeNull).toBe(true);
  });
});

describe("VectorCreateIndexSchema", () => {
  it("should resolve type from method alias", () => {
    const result = VectorCreateIndexSchema.parse({
      table: "embeddings",
      column: "vector",
      method: "hnsw",
    });
    expect(result.type).toBe("hnsw");
  });

  it("should throw when type is missing", () => {
    expect(() =>
      VectorCreateIndexSchema.parse({
        table: "embeddings",
        column: "vector",
      }),
    ).toThrow("type (or method alias) is required");
  });

  it("should accept all HNSW parameters", () => {
    const result = VectorCreateIndexSchema.parse({
      table: "embeddings",
      column: "vector",
      type: "hnsw",
      m: 16,
      efConstruction: 64,
      ifNotExists: true,
    });
    expect(result.m).toBe(16);
    expect(result.efConstruction).toBe(64);
    expect(result.ifNotExists).toBe(true);
  });

  it("should accept IVFFlat parameters", () => {
    const result = VectorCreateIndexSchema.parse({
      table: "embeddings",
      column: "vector",
      type: "ivfflat",
      lists: 100,
      metric: "cosine",
    });
    expect(result.type).toBe("ivfflat");
    expect(result.lists).toBe(100);
    expect(result.metric).toBe("cosine");
  });

  it("should default metric to l2", () => {
    const result = VectorCreateIndexSchema.parse({
      table: "embeddings",
      column: "vector",
      type: "ivfflat",
    });
    expect(result.metric).toBe("l2");
  });
});

// =============================================================================
// PostGIS Schema Tests
// =============================================================================
describe("preprocessPostgisParams", () => {
  it("should pass through non-objects", () => {
    expect(preprocessPostgisParams(null)).toBe(null);
    expect(preprocessPostgisParams("string")).toBe("string");
    expect(preprocessPostgisParams(42)).toBe(42);
  });

  it("should resolve tableName to table", () => {
    const result = preprocessPostgisParams({ tableName: "locations" });
    expect(result).toEqual({ tableName: "locations", table: "locations" });
  });

  it("should not overwrite existing table", () => {
    const result = preprocessPostgisParams({
      table: "primary",
      tableName: "alias",
    });
    expect((result as Record<string, unknown>).table).toBe("primary");
  });

  it("should parse schema.table format", () => {
    const result = preprocessPostgisParams({ table: "myschema.locations" });
    expect(result).toEqual({
      table: "locations",
      schema: "myschema",
    });
  });

  it("should not parse schema.table if schema already provided", () => {
    const result = preprocessPostgisParams({
      table: "other.locations",
      schema: "explicit",
    });
    expect((result as Record<string, unknown>).table).toBe("other.locations");
    expect((result as Record<string, unknown>).schema).toBe("explicit");
  });
});

describe("preprocessPoint", () => {
  it("should resolve lat/lng", () => {
    expect(preprocessPoint({ lat: 40.7, lng: -74.0 })).toEqual({
      lat: 40.7,
      lng: -74.0,
    });
  });

  it("should resolve latitude/longitude aliases", () => {
    expect(preprocessPoint({ latitude: 40.7, longitude: -74.0 })).toEqual({
      lat: 40.7,
      lng: -74.0,
    });
  });

  it("should resolve x/y aliases", () => {
    expect(preprocessPoint({ x: -74.0, y: 40.7 })).toEqual({
      lat: 40.7,
      lng: -74.0,
    });
  });

  it("should resolve lon alias", () => {
    expect(preprocessPoint({ lat: 40.7, lon: -74.0 })).toEqual({
      lat: 40.7,
      lng: -74.0,
    });
  });

  it("should return undefined for non-objects", () => {
    expect(preprocessPoint(null)).toBeUndefined();
    expect(preprocessPoint("string")).toBeUndefined();
  });

  it("should return undefined if lat or lng missing", () => {
    expect(preprocessPoint({ lat: 40.7 })).toBeUndefined();
    expect(preprocessPoint({ lng: -74.0 })).toBeUndefined();
  });

  it("should throw for invalid latitude", () => {
    expect(() => preprocessPoint({ lat: 91, lng: 0 })).toThrow(
      "Invalid latitude 91",
    );
    expect(() => preprocessPoint({ lat: -91, lng: 0 })).toThrow(
      "Invalid latitude -91",
    );
  });

  it("should throw for invalid longitude", () => {
    expect(() => preprocessPoint({ lat: 0, lng: 181 })).toThrow(
      "Invalid longitude 181",
    );
    expect(() => preprocessPoint({ lat: 0, lng: -181 })).toThrow(
      "Invalid longitude -181",
    );
  });

  it("should skip validation when validateBounds is false", () => {
    expect(preprocessPoint({ lat: 100, lng: 200 }, false)).toEqual({
      lat: 100,
      lng: 200,
    });
  });
});

describe("convertToMeters", () => {
  it("should return meters unchanged", () => {
    expect(convertToMeters(1000)).toBe(1000);
    expect(convertToMeters(1000, "meters")).toBe(1000);
    expect(convertToMeters(1000, "m")).toBe(1000);
  });

  it("should convert kilometers to meters", () => {
    expect(convertToMeters(1, "kilometers")).toBe(1000);
    expect(convertToMeters(1, "km")).toBe(1000);
  });

  it("should convert miles to meters", () => {
    expect(convertToMeters(1, "miles")).toBeCloseTo(1609.344);
    expect(convertToMeters(1, "mi")).toBeCloseTo(1609.344);
  });

  it("should default to meters for unknown units", () => {
    expect(convertToMeters(500, "unknown")).toBe(500);
  });

  it("should pass through negative values", () => {
    expect(convertToMeters(-1, "km")).toBe(-1);
  });
});

describe("GeometryColumnSchema", () => {
  it("should resolve column aliases", () => {
    const result = GeometryColumnSchema.parse({
      table: "locations",
      geom: "geometry",
    });
    expect(result.column).toBe("geometry");
  });

  it("should resolve geometryColumn alias", () => {
    const result = GeometryColumnSchema.parse({
      table: "locations",
      geometryColumn: "geom_col",
    });
    expect(result.column).toBe("geom_col");
  });

  it("should fail when table is missing", () => {
    expect(() => GeometryColumnSchema.parse({ column: "geom" })).toThrow(
      "table (or tableName alias) is required",
    );
  });

  it("should fail when column is missing", () => {
    expect(() => GeometryColumnSchema.parse({ table: "locations" })).toThrow(
      "column (or geom/geometryColumn alias) is required",
    );
  });
});

describe("GeometryDistanceSchema", () => {
  it("should convert distance units", () => {
    const result = GeometryDistanceSchema.parse({
      table: "locations",
      column: "geom",
      point: { lat: 40, lng: -74 },
      maxDistance: 1,
      unit: "kilometers",
    });
    expect(result.maxDistance).toBe(1000);
  });

  it("should resolve radius alias for maxDistance", () => {
    const result = GeometryDistanceSchema.parse({
      table: "locations",
      column: "geom",
      point: { lat: 40, lng: -74 },
      radius: 500,
    });
    expect(result.maxDistance).toBe(500);
  });

  it("should reject negative distance", () => {
    expect(() =>
      GeometryDistanceSchema.parse({
        table: "locations",
        column: "geom",
        point: { lat: 40, lng: -74 },
        maxDistance: -100,
      }),
    ).toThrow("distance must be a non-negative number");
  });
});

describe("BufferSchema", () => {
  it("should require positive distance", () => {
    expect(() =>
      BufferSchema.parse({
        table: "areas",
        column: "geom",
        distance: 0,
      }),
    ).toThrow(
      "distance (or radius/meters alias) is required and must be positive",
    );
  });

  it("should resolve meters alias", () => {
    const result = BufferSchema.parse({
      table: "areas",
      column: "geom",
      meters: 500,
    });
    expect(result.distance).toBe(500);
  });

  it("should reject negative simplify", () => {
    expect(() =>
      BufferSchema.parse({
        table: "areas",
        column: "geom",
        distance: 100,
        simplify: -5,
      }),
    ).toThrow("simplify must be a non-negative number");
  });
});

describe("GeocodeSchema", () => {
  it("should resolve latitude/longitude aliases", () => {
    const result = GeocodeSchema.parse({
      latitude: 40.7,
      longitude: -74.0,
    });
    expect(result.lat).toBe(40.7);
    expect(result.lng).toBe(-74.0);
  });

  it("should resolve lon alias", () => {
    const result = GeocodeSchema.parse({
      lat: 40.7,
      lon: -74.0,
    });
    expect(result.lng).toBe(-74.0);
  });

  it("should require lat", () => {
    expect(() => GeocodeSchema.parse({ lng: -74 })).toThrow(
      "lat (or latitude alias) is required",
    );
  });

  it("should require lng", () => {
    expect(() => GeocodeSchema.parse({ lat: 40.7 })).toThrow(
      "lng (or lon/longitude alias) is required",
    );
  });

  it("should validate lat bounds", () => {
    expect(() => GeocodeSchema.parse({ lat: 95, lng: 0 })).toThrow(
      "lat must be between -90 and 90",
    );
  });

  it("should validate lng bounds", () => {
    expect(() => GeocodeSchema.parse({ lat: 0, lng: 200 })).toThrow(
      "lng must be between -180 and 180",
    );
  });
});

describe("GeoTransformSchema", () => {
  it("should resolve SRID aliases", () => {
    const result = GeoTransformSchema.parse({
      table: "locations",
      column: "geom",
      sourceSrid: 4326,
      targetSrid: 3857,
    });
    expect(result.fromSrid).toBe(4326);
    expect(result.toSrid).toBe(3857);
  });

  it("should default fromSrid to 0 for auto-detection when not provided", () => {
    const result = GeoTransformSchema.parse({
      table: "locations",
      column: "geom",
      toSrid: 3857,
    });
    expect(result.fromSrid).toBe(0);
  });

  it("should require toSrid", () => {
    expect(() =>
      GeoTransformSchema.parse({
        table: "locations",
        column: "geom",
        fromSrid: 4326,
      }),
    ).toThrow("toSrid (or targetSrid alias) is required");
  });
});

// =============================================================================
// Schema Management Tests
// =============================================================================
describe("CreateSequenceSchema", () => {
  it("should resolve sequenceName alias", () => {
    const result = CreateSequenceSchema.parse({
      sequenceName: "my_seq",
    });
    expect(result.name).toBe("my_seq");
  });

  it("should parse schema.name format", () => {
    const result = CreateSequenceSchema.parse({
      name: "myschema.my_seq",
    });
    expect(result.name).toBe("my_seq");
    expect(result.schema).toBe("myschema");
  });

  it("should require name", () => {
    expect(() => CreateSequenceSchema.parse({})).toThrow(
      "name (or sequenceName alias) is required",
    );
  });

  it("should accept all sequence options", () => {
    const result = CreateSequenceSchema.parse({
      name: "my_seq",
      start: 100,
      increment: 10,
      minValue: 1,
      maxValue: 10000,
      cache: 5,
      cycle: true,
      ownedBy: "users.id",
      ifNotExists: true,
    });
    expect(result.start).toBe(100);
    expect(result.increment).toBe(10);
    expect(result.cycle).toBe(true);
    expect(result.ifNotExists).toBe(true);
  });
});

describe("CreateViewSchema", () => {
  it("should resolve viewName alias", () => {
    const result = CreateViewSchema.parse({
      viewName: "active_users",
      query: "SELECT * FROM users WHERE active",
    });
    expect(result.name).toBe("active_users");
  });

  it("should resolve sql alias for query", () => {
    const result = CreateViewSchema.parse({
      name: "my_view",
      sql: "SELECT 1",
    });
    expect(result.query).toBe("SELECT 1");
  });

  it("should resolve definition alias for query", () => {
    const result = CreateViewSchema.parse({
      name: "my_view",
      definition: "SELECT 2",
    });
    expect(result.query).toBe("SELECT 2");
  });

  it("should parse schema.name format", () => {
    const result = CreateViewSchema.parse({
      name: "analytics.daily_stats",
      query: "SELECT * FROM raw_data",
    });
    expect(result.name).toBe("daily_stats");
    expect(result.schema).toBe("analytics");
  });

  it("should require name", () => {
    expect(() => CreateViewSchema.parse({ query: "SELECT 1" })).toThrow(
      "name (or viewName alias) is required",
    );
  });

  it("should require query", () => {
    expect(() => CreateViewSchema.parse({ name: "my_view" })).toThrow(
      "query (or sql/definition alias) is required",
    );
  });
});

describe("DropSequenceSchema", () => {
  it("should parse schema.name format", () => {
    const result = DropSequenceSchema.parse({
      name: "myschema.my_seq",
    });
    expect((result as { name: string }).name).toBe("my_seq");
    expect((result as { schema: string }).schema).toBe("myschema");
  });

  it("should accept drop options", () => {
    const result = DropSequenceSchema.parse({
      name: "my_seq",
      ifExists: true,
      cascade: true,
    });
    expect((result as { ifExists: boolean }).ifExists).toBe(true);
    expect((result as { cascade: boolean }).cascade).toBe(true);
  });
});

describe("DropViewSchema", () => {
  it("should parse schema.name format", () => {
    const result = DropViewSchema.parse({
      name: "analytics.old_view",
    });
    expect((result as { name: string }).name).toBe("old_view");
    expect((result as { schema: string }).schema).toBe("analytics");
  });

  it("should accept materialized option", () => {
    const result = DropViewSchema.parse({
      name: "mat_view",
      materialized: true,
    });
    expect((result as { materialized: boolean }).materialized).toBe(true);
  });
});

describe("ListFunctionsSchema", () => {
  it("should accept empty input", () => {
    const result = ListFunctionsSchema.parse({});
    expect(result).toEqual({});
  });

  it("should handle null input", () => {
    const result = ListFunctionsSchema.parse(null);
    expect(result).toEqual({});
  });

  it("should accept all filter options", () => {
    const result = ListFunctionsSchema.parse({
      schema: "public",
      exclude: ["postgis", "ltree"],
      language: "plpgsql",
      limit: 100,
    });
    expect(result.schema).toBe("public");
    expect(result.exclude).toEqual(["postgis", "ltree"]);
    expect(result.language).toBe("plpgsql");
    expect(result.limit).toBe(100);
  });
});

// =============================================================================
// Stats Schema Tests
// =============================================================================

import {
  StatsPercentilesSchema,
  StatsCorrelationSchema,
  StatsRegressionSchema,
  StatsHypothesisSchema,
  StatsTimeSeriesSchema,
} from "../stats.js";

describe("StatsPercentilesSchema", () => {
  it("should normalize percentiles from 0-100 to 0-1 format", () => {
    const result = StatsPercentilesSchema.parse({
      table: "orders",
      column: "amount",
      percentiles: [25, 50, 75],
    });
    expect(result.percentiles).toEqual([0.25, 0.5, 0.75]);
  });

  it("should use default percentiles for empty array", () => {
    const result = StatsPercentilesSchema.parse({
      table: "orders",
      column: "amount",
      percentiles: [],
    });
    expect(result.percentiles).toEqual([0.25, 0.5, 0.75]);
  });

  it("should resolve tableName alias to table", () => {
    const result = StatsPercentilesSchema.parse({
      tableName: "orders",
      column: "amount",
    });
    expect(result.table).toBe("orders");
  });

  it("should resolve col alias to column", () => {
    const result = StatsPercentilesSchema.parse({
      table: "orders",
      col: "price",
    });
    expect(result.column).toBe("price");
  });

  it("should parse schema.table format", () => {
    const result = StatsPercentilesSchema.parse({
      table: "analytics.orders",
      column: "amount",
    });
    expect(result.table).toBe("orders");
    expect(result.schema).toBe("analytics");
  });
});

describe("StatsCorrelationSchema", () => {
  it("should resolve x and y aliases to column1 and column2", () => {
    const result = StatsCorrelationSchema.parse({
      table: "sales",
      x: "price",
      y: "quantity",
    });
    expect(result.column1).toBe("price");
    expect(result.column2).toBe("quantity");
  });

  it("should resolve col1 and col2 aliases", () => {
    const result = StatsCorrelationSchema.parse({
      table: "sales",
      col1: "revenue",
      col2: "cost",
    });
    expect(result.column1).toBe("revenue");
    expect(result.column2).toBe("cost");
  });
});

describe("StatsRegressionSchema", () => {
  it("should resolve x and y aliases to xColumn and yColumn", () => {
    const result = StatsRegressionSchema.parse({
      table: "metrics",
      x: "time",
      y: "value",
    });
    expect(result.xColumn).toBe("time");
    expect(result.yColumn).toBe("value");
  });

  it("should resolve column1 and column2 aliases for consistency with correlation", () => {
    const result = StatsRegressionSchema.parse({
      table: "metrics",
      column1: "advertising",
      column2: "revenue",
    });
    expect(result.xColumn).toBe("advertising");
    expect(result.yColumn).toBe("revenue");
  });
});

describe("StatsHypothesisSchema", () => {
  it("should normalize t-test variants to t_test", () => {
    const result1 = StatsHypothesisSchema.parse({
      table: "scores",
      column: "value",
      testType: "ttest",
    });
    expect(result1.testType).toBe("t_test");

    const result2 = StatsHypothesisSchema.parse({
      table: "scores",
      column: "value",
      testType: "t-test",
    });
    expect(result2.testType).toBe("t_test");
  });

  it("should normalize z-test variants to z_test", () => {
    const result = StatsHypothesisSchema.parse({
      table: "scores",
      column: "value",
      testType: "ztest",
      populationStdDev: 10,
    });
    expect(result.testType).toBe("z_test");
  });

  it("should default to z_test when populationStdDev is provided", () => {
    const result = StatsHypothesisSchema.parse({
      table: "scores",
      column: "value",
      populationStdDev: 15,
    });
    expect(result.testType).toBe("z_test");
  });

  it("should default to t_test when no testType provided", () => {
    const result = StatsHypothesisSchema.parse({
      table: "scores",
      column: "value",
    });
    expect(result.testType).toBe("t_test");
  });
});

describe("StatsTimeSeriesSchema", () => {
  it("should normalize interval shorthands (daily → day)", () => {
    const result = StatsTimeSeriesSchema.parse({
      table: "metrics",
      valueColumn: "value",
      timeColumn: "ts",
      interval: "daily",
    });
    expect(result.interval).toBe("day");
  });

  it("should resolve value and time aliases", () => {
    const result = StatsTimeSeriesSchema.parse({
      table: "metrics",
      value: "amount",
      time: "created_at",
    });
    expect(result.valueColumn).toBe("amount");
    expect(result.timeColumn).toBe("created_at");
  });

  it("should resolve bucket alias to interval", () => {
    const result = StatsTimeSeriesSchema.parse({
      table: "metrics",
      valueColumn: "value",
      timeColumn: "ts",
      bucket: "hour",
    });
    expect(result.interval).toBe("hour");
  });

  it("should default interval to day when not provided", () => {
    const result = StatsTimeSeriesSchema.parse({
      table: "metrics",
      valueColumn: "value",
      timeColumn: "ts",
    });
    expect(result.interval).toBe("day");
  });
});

// =============================================================================
// JSONB Schema Path Helpers Tests
// =============================================================================

import {
  stringPathToArray,
  normalizePathForInsert,
  parseJsonbValue,
  normalizePathToArray,
  normalizePathToString,
} from "../jsonb.js";

describe("stringPathToArray", () => {
  it("should convert simple dot notation", () => {
    expect(stringPathToArray("a.b.c")).toEqual(["a", "b", "c"]);
  });

  it("should convert array notation [0] to .0", () => {
    expect(stringPathToArray("a[0].b")).toEqual(["a", "0", "b"]);
    expect(stringPathToArray("items[2].name")).toEqual(["items", "2", "name"]);
  });

  it("should handle JSONPath format ($.a.b)", () => {
    expect(stringPathToArray("$.a.b")).toEqual(["a", "b"]);
    expect(stringPathToArray("$a.b")).toEqual(["a", "b"]);
  });

  it("should handle leading dots", () => {
    expect(stringPathToArray(".a.b")).toEqual(["a", "b"]);
  });
});

describe("normalizePathForInsert", () => {
  it("should wrap bare number in array", () => {
    expect(normalizePathForInsert(0)).toEqual([0]);
    expect(normalizePathForInsert(-1)).toEqual([-1]);
  });

  it("should convert string path and parse numeric segments", () => {
    expect(normalizePathForInsert("tags.0")).toEqual(["tags", 0]);
    expect(normalizePathForInsert("items.-1")).toEqual(["items", -1]);
  });

  it("should preserve mixed types in array", () => {
    expect(normalizePathForInsert(["tags", 0])).toEqual(["tags", 0]);
    expect(normalizePathForInsert(["a", "1", "b"])).toEqual(["a", 1, "b"]);
  });
});

describe("parseJsonbValue", () => {
  it("should parse valid JSON strings", () => {
    expect(parseJsonbValue('{"key": "value"}')).toEqual({ key: "value" });
    expect(parseJsonbValue("[1, 2, 3]")).toEqual([1, 2, 3]);
  });

  it("should return non-JSON strings as-is", () => {
    expect(parseJsonbValue("hello world")).toBe("hello world");
    expect(parseJsonbValue("not{json")).toBe("not{json");
  });

  it("should return non-string values as-is", () => {
    expect(parseJsonbValue({ key: "value" })).toEqual({ key: "value" });
    expect(parseJsonbValue(123)).toBe(123);
    expect(parseJsonbValue(null)).toBe(null);
  });
});

describe("normalizePathToArray", () => {
  it("should convert string path to array", () => {
    expect(normalizePathToArray("a.b.c")).toEqual(["a", "b", "c"]);
  });

  it("should convert mixed array to string array", () => {
    expect(normalizePathToArray(["a", 1, "b"])).toEqual(["a", "1", "b"]);
  });
});

describe("normalizePathToString", () => {
  it("should join array to dot-separated string", () => {
    expect(normalizePathToString(["a", "b", "c"])).toBe("a.b.c");
    expect(normalizePathToString(["items", 0, "name"])).toBe("items.0.name");
  });

  it("should return string as-is", () => {
    expect(normalizePathToString("a.b.c")).toBe("a.b.c");
  });
});

// =============================================================================
// Partitioning Schema Tests
// =============================================================================

import {
  CreatePartitionSchema,
  CreatePartitionedTableSchema,
} from "../partitioning.js";

describe("CreatePartitionSchema", () => {
  it("should resolve parentTable alias to parent", () => {
    const result = CreatePartitionSchema.parse({
      parentTable: "orders",
      name: "orders_2024",
      forValues: "FROM ('2024-01-01') TO ('2025-01-01')",
    });
    expect(result.parent).toBe("orders");
  });

  it("should resolve table alias to parent", () => {
    const result = CreatePartitionSchema.parse({
      table: "events",
      name: "events_jan",
      forValues: "FOR VALUES IN ('jan')",
    });
    expect(result.parent).toBe("events");
  });

  it("should build forValues from from/to (RANGE)", () => {
    const result = CreatePartitionSchema.parse({
      parent: "orders",
      name: "orders_q1",
      from: "2024-01-01",
      to: "2024-04-01",
    });
    expect(result.forValues).toBe("FROM ('2024-01-01') TO ('2024-04-01')");
  });

  it("should build forValues from values array (LIST)", () => {
    const result = CreatePartitionSchema.parse({
      parent: "orders",
      name: "orders_us",
      values: ["US", "CA", "MX"],
    });
    expect(result.forValues).toBe("IN ('US', 'CA', 'MX')");
  });

  it("should build forValues from modulus/remainder (HASH)", () => {
    const result = CreatePartitionSchema.parse({
      parent: "orders",
      name: "orders_p0",
      modulus: 4,
      remainder: 0,
    });
    expect(result.forValues).toBe("WITH (MODULUS 4, REMAINDER 0)");
  });
});

describe("CreatePartitionedTableSchema", () => {
  it("should resolve table alias to name", () => {
    const result = CreatePartitionedTableSchema.parse({
      table: "events",
      columns: [{ name: "id", type: "integer" }],
      partitionBy: "RANGE",
      partitionKey: "(created_at)",
    });
    expect(result.name).toBe("events");
  });

  it("should normalize partitionBy to lowercase", () => {
    const result = CreatePartitionedTableSchema.parse({
      name: "events",
      columns: [{ name: "id", type: "integer" }],
      partitionBy: "RANGE",
      partitionKey: "(created_at)",
    });
    expect(result.partitionBy).toBe("range");
  });

  it("should parse schema.table format", () => {
    const result = CreatePartitionedTableSchema.parse({
      name: "analytics.events",
      columns: [{ name: "id", type: "integer" }],
      partitionBy: "list",
      partitionKey: "(region)",
    });
    expect(result.name).toBe("events");
    expect(result.schema).toBe("analytics");
  });
});
