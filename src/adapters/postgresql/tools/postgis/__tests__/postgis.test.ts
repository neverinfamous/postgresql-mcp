/**
 * postgres-mcp - PostGIS Tools Unit Tests
 *
 * Tests for PostGIS spatial operations covering tool definitions,
 * schema validation, and handler execution.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { getPostgisTools } from "../index.js";
import type { PostgresAdapter } from "../../../PostgresAdapter.js";
import {
  createMockPostgresAdapter,
  createMockRequestContext,
} from "../../../../../__tests__/mocks/index.js";

describe("getPostgisTools", () => {
  let adapter: PostgresAdapter;
  let tools: ReturnType<typeof getPostgisTools>;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = createMockPostgresAdapter() as unknown as PostgresAdapter;
    tools = getPostgisTools(adapter);
  });

  it("should return 15 PostGIS tools", () => {
    expect(tools).toHaveLength(15);
  });

  it("should have all expected tool names", () => {
    const toolNames = tools.map((t) => t.name);
    // Basic tools
    expect(toolNames).toContain("pg_postgis_create_extension");
    expect(toolNames).toContain("pg_geometry_column");
    expect(toolNames).toContain("pg_point_in_polygon");
    expect(toolNames).toContain("pg_distance");
    expect(toolNames).toContain("pg_buffer");
    expect(toolNames).toContain("pg_intersection");
    expect(toolNames).toContain("pg_bounding_box");
    expect(toolNames).toContain("pg_spatial_index");
    // Advanced tools
    expect(toolNames).toContain("pg_geocode");
    expect(toolNames).toContain("pg_geo_transform");
    expect(toolNames).toContain("pg_geo_index_optimize");
    expect(toolNames).toContain("pg_geo_cluster");
    // Standalone geometry tools
    expect(toolNames).toContain("pg_geometry_buffer");
    expect(toolNames).toContain("pg_geometry_intersection");
    expect(toolNames).toContain("pg_geometry_transform");
  });

  it("should have handler function for all tools", () => {
    for (const tool of tools) {
      expect(typeof tool.handler).toBe("function");
    }
  });

  it("should have inputSchema for all tools", () => {
    for (const tool of tools) {
      expect(tool.inputSchema).toBeDefined();
    }
  });

  it("should have group set to postgis for all tools", () => {
    for (const tool of tools) {
      expect(tool.group).toBe("postgis");
    }
  });
});

describe("Tool Annotations", () => {
  let tools: ReturnType<typeof getPostgisTools>;

  beforeEach(() => {
    tools = getPostgisTools(
      createMockPostgresAdapter() as unknown as PostgresAdapter,
    );
  });

  it("pg_point_in_polygon should be read-only", () => {
    const tool = tools.find((t) => t.name === "pg_point_in_polygon")!;
    expect(tool.annotations?.readOnlyHint).toBe(true);
  });

  it("pg_distance should be read-only", () => {
    const tool = tools.find((t) => t.name === "pg_distance")!;
    expect(tool.annotations?.readOnlyHint).toBe(true);
  });

  it("pg_geometry_column should be destructive", () => {
    const tool = tools.find((t) => t.name === "pg_geometry_column")!;
    expect(tool.annotations?.readOnlyHint).toBe(false);
  });

  it("pg_spatial_index should be destructive", () => {
    const tool = tools.find((t) => t.name === "pg_spatial_index")!;
    expect(tool.annotations?.readOnlyHint).toBe(false);
  });

  it("pg_geometry_buffer should be read-only", () => {
    const tool = tools.find((t) => t.name === "pg_geometry_buffer")!;
    expect(tool.annotations?.readOnlyHint).toBe(true);
  });

  it("pg_geometry_intersection should be read-only", () => {
    const tool = tools.find((t) => t.name === "pg_geometry_intersection")!;
    expect(tool.annotations?.readOnlyHint).toBe(true);
  });

  it("pg_geometry_transform should be read-only", () => {
    const tool = tools.find((t) => t.name === "pg_geometry_transform")!;
    expect(tool.annotations?.readOnlyHint).toBe(true);
  });
});

describe("Handler Execution", () => {
  let mockAdapter: ReturnType<typeof createMockPostgresAdapter>;
  let tools: ReturnType<typeof getPostgisTools>;
  let mockContext: ReturnType<typeof createMockRequestContext>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdapter = createMockPostgresAdapter();
    tools = getPostgisTools(mockAdapter as unknown as PostgresAdapter);
    mockContext = createMockRequestContext();
  });

  describe("pg_postgis_create_extension", () => {
    it("should check/create PostGIS extension", async () => {
      mockAdapter.executeQuery.mockResolvedValue({ rows: [] });

      const tool = tools.find((t) => t.name === "pg_postgis_create_extension")!;
      const result = (await tool.handler({}, mockContext)) as Record<
        string,
        unknown
      >;

      expect(mockAdapter.executeQuery).toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });

  describe("pg_geo_cluster", () => {
    it("should cluster geometries", async () => {
      mockAdapter.executeQuery.mockResolvedValue({
        rows: [{ cluster_id: 1, geom: "POINT(0 0)" }],
      });

      const tool = tools.find((t) => t.name === "pg_geo_cluster")!;
      const result = (await tool.handler(
        {
          table: "locations",
          column: "geom",
          numClusters: 5,
        },
        mockContext,
      )) as Record<string, unknown>;

      expect(mockAdapter.executeQuery).toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });

  describe("pg_geometry_buffer", () => {
    it("should create buffer from WKT geometry", async () => {
      mockAdapter.executeQuery.mockResolvedValue({
        rows: [
          { buffer_geojson: '{"type":"Polygon"}', buffer_wkt: "POLYGON(...)" },
        ],
      });

      const tool = tools.find((t) => t.name === "pg_geometry_buffer")!;
      const result = (await tool.handler(
        {
          geometry: "POINT(-74.006 40.7128)",
          distance: 1000,
        },
        mockContext,
      )) as Record<string, unknown>;

      expect(mockAdapter.executeQuery).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it("should detect GeoJSON input format", async () => {
      mockAdapter.executeQuery.mockResolvedValue({
        rows: [
          { buffer_geojson: "{}", buffer_wkt: "", inputFormat: "GeoJSON" },
        ],
      });

      const tool = tools.find((t) => t.name === "pg_geometry_buffer")!;
      const result = (await tool.handler(
        {
          geometry: '{"type":"Point","coordinates":[-74.006,40.7128]}',
          distance: 500,
          srid: 4326,
        },
        mockContext,
      )) as Record<string, unknown>;

      expect(result["inputFormat"]).toBe("GeoJSON");
    });
  });

  describe("pg_geometry_intersection", () => {
    it("should compute intersection of two geometries", async () => {
      mockAdapter.executeQuery.mockResolvedValue({
        rows: [{ intersects: true, intersection_geojson: "{}" }],
      });

      const tool = tools.find((t) => t.name === "pg_geometry_intersection")!;
      const result = (await tool.handler(
        {
          geometry1: "POLYGON((0 0, 1 0, 1 1, 0 1, 0 0))",
          geometry2: "POLYGON((0.5 0.5, 2 0.5, 2 2, 0.5 2, 0.5 0.5))",
        },
        mockContext,
      )) as Record<string, unknown>;

      expect(mockAdapter.executeQuery).toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });

  describe("pg_geometry_transform", () => {
    it("should transform geometry between SRIDs", async () => {
      mockAdapter.executeQuery.mockResolvedValue({
        rows: [{ transformed_geojson: "{}", from_srid: 4326, to_srid: 3857 }],
      });

      const tool = tools.find((t) => t.name === "pg_geometry_transform")!;
      const result = (await tool.handler(
        {
          geometry: "POINT(-74.006 40.7128)",
          fromSrid: 4326,
          toSrid: 3857,
        },
        mockContext,
      )) as Record<string, unknown>;

      expect(mockAdapter.executeQuery).toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });
});

describe("Error Handling", () => {
  let mockAdapter: ReturnType<typeof createMockPostgresAdapter>;
  let tools: ReturnType<typeof getPostgisTools>;
  let mockContext: ReturnType<typeof createMockRequestContext>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdapter = createMockPostgresAdapter();
    tools = getPostgisTools(mockAdapter as unknown as PostgresAdapter);
    mockContext = createMockRequestContext();
  });

  it("should propagate database errors from extension check", async () => {
    const dbError = new Error('extension "postgis" is not available');
    mockAdapter.executeQuery.mockRejectedValue(dbError);

    const tool = tools.find((t) => t.name === "pg_postgis_create_extension")!;

    await expect(tool.handler({}, mockContext)).rejects.toThrow(
      'extension "postgis" is not available',
    );
  });
});
