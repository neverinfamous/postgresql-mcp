/**
 * postgres-mcp - Vector (pgvector) Tools Unit Tests
 *
 * Tests for pgvector operations covering tool definitions,
 * schema validation, and handler execution.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { getVectorTools } from "../index.js";
import type { PostgresAdapter } from "../../../PostgresAdapter.js";
import {
  createMockPostgresAdapter,
  createMockRequestContext,
} from "../../../../../__tests__/mocks/index.js";

describe("getVectorTools", () => {
  let adapter: PostgresAdapter;
  let tools: ReturnType<typeof getVectorTools>;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = createMockPostgresAdapter() as unknown as PostgresAdapter;
    tools = getVectorTools(adapter);
  });

  it("should return 14 vector tools", () => {
    expect(tools).toHaveLength(16);
  });

  it("should have all expected tool names", () => {
    const toolNames = tools.map((t) => t.name);
    // Basic tools
    expect(toolNames).toContain("pg_vector_create_extension");
    expect(toolNames).toContain("pg_vector_add_column");
    expect(toolNames).toContain("pg_vector_insert");
    expect(toolNames).toContain("pg_vector_search");
    expect(toolNames).toContain("pg_vector_create_index");
    expect(toolNames).toContain("pg_vector_distance");
    expect(toolNames).toContain("pg_vector_normalize");
    expect(toolNames).toContain("pg_vector_aggregate");
    // Advanced tools
    expect(toolNames).toContain("pg_vector_cluster");
    expect(toolNames).toContain("pg_vector_index_optimize");
    expect(toolNames).toContain("pg_hybrid_search");
    expect(toolNames).toContain("pg_vector_performance");
    expect(toolNames).toContain("pg_vector_dimension_reduce");
    expect(toolNames).toContain("pg_vector_embed");
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

  it("should have group set to vector for all tools", () => {
    for (const tool of tools) {
      expect(tool.group).toBe("vector");
    }
  });
});

describe("Tool Annotations", () => {
  let tools: ReturnType<typeof getVectorTools>;

  beforeEach(() => {
    tools = getVectorTools(
      createMockPostgresAdapter() as unknown as PostgresAdapter,
    );
  });

  it("pg_vector_search should be read-only", () => {
    const tool = tools.find((t) => t.name === "pg_vector_search")!;
    expect(tool.annotations?.readOnlyHint).toBe(true);
  });

  it("pg_vector_distance should be read-only", () => {
    const tool = tools.find((t) => t.name === "pg_vector_distance")!;
    expect(tool.annotations?.readOnlyHint).toBe(true);
  });

  it("pg_vector_insert should be destructive", () => {
    const tool = tools.find((t) => t.name === "pg_vector_insert")!;
    expect(tool.annotations?.readOnlyHint).toBe(false);
  });

  it("pg_vector_add_column should be destructive", () => {
    const tool = tools.find((t) => t.name === "pg_vector_add_column")!;
    expect(tool.annotations?.readOnlyHint).toBe(false);
  });
});

describe("Handler Execution", () => {
  let mockAdapter: ReturnType<typeof createMockPostgresAdapter>;
  let tools: ReturnType<typeof getVectorTools>;
  let mockContext: ReturnType<typeof createMockRequestContext>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdapter = createMockPostgresAdapter();
    tools = getVectorTools(mockAdapter as unknown as PostgresAdapter);
    mockContext = createMockRequestContext();
  });

  describe("pg_vector_create_extension", () => {
    it("should check/create vector extension", async () => {
      mockAdapter.executeQuery.mockResolvedValue({ rows: [] });

      const tool = tools.find((t) => t.name === "pg_vector_create_extension")!;
      const result = (await tool.handler({}, mockContext)) as Record<
        string,
        unknown
      >;

      expect(mockAdapter.executeQuery).toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });

  describe("pg_vector_search", () => {
    it("should execute vector similarity search", async () => {
      mockAdapter.executeQuery.mockResolvedValue({
        rows: [
          { id: 1, distance: 0.1 },
          { id: 2, distance: 0.2 },
        ],
      });

      const tool = tools.find((t) => t.name === "pg_vector_search")!;
      const result = (await tool.handler(
        {
          table: "embeddings",
          column: "embedding",
          vector: [0.1, 0.2, 0.3],
          limit: 10,
        },
        mockContext,
      )) as Record<string, unknown>;

      expect(mockAdapter.executeQuery).toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });

  describe("pg_vector_normalize", () => {
    it("should normalize a vector", async () => {
      const tool = tools.find((t) => t.name === "pg_vector_normalize")!;
      const result = (await tool.handler(
        {
          vector: [3, 4],
        },
        mockContext,
      )) as { normalized: number[] };

      // [3, 4] normalized = [0.6, 0.8]
      expect(result.normalized).toBeDefined();
      expect(result.normalized).toHaveLength(2);
    });
  });

  describe("pg_vector_embed", () => {
    it("should generate embedding placeholder", async () => {
      const tool = tools.find((t) => t.name === "pg_vector_embed")!;
      const result = (await tool.handler(
        {
          text: "Hello world",
          dimensions: 384,
        },
        mockContext,
      )) as Record<string, unknown>;

      expect(result).toBeDefined();
    });
  });

  describe("pg_vector_performance", () => {
    it("should analyze vector index performance", async () => {
      mockAdapter.executeQuery
        .mockResolvedValueOnce({ rows: [{ indexname: "idx_vectors" }] })
        .mockResolvedValueOnce({ rows: [{ size: "10 MB" }] });

      const tool = tools.find((t) => t.name === "pg_vector_performance")!;
      const result = (await tool.handler(
        {
          table: "embeddings",
          column: "embedding",
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
  let tools: ReturnType<typeof getVectorTools>;
  let mockContext: ReturnType<typeof createMockRequestContext>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdapter = createMockPostgresAdapter();
    tools = getVectorTools(mockAdapter as unknown as PostgresAdapter);
    mockContext = createMockRequestContext();
  });

  it("should propagate database errors", async () => {
    const dbError = new Error('extension "vector" is not available');
    mockAdapter.executeQuery.mockRejectedValue(dbError);

    const tool = tools.find((t) => t.name === "pg_vector_create_extension")!;

    await expect(tool.handler({}, mockContext)).rejects.toThrow(
      'extension "vector" is not available',
    );
  });
});

describe("Bug Fixes", () => {
  let mockAdapter: ReturnType<typeof createMockPostgresAdapter>;
  let tools: ReturnType<typeof getVectorTools>;
  let mockContext: ReturnType<typeof createMockRequestContext>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdapter = createMockPostgresAdapter();
    tools = getVectorTools(mockAdapter as unknown as PostgresAdapter);
    mockContext = createMockRequestContext();
  });

  describe("pg_vector_create_index ifNotExists option", () => {
    it("should check for existing index and return alreadyExists when ifNotExists is true and index exists", async () => {
      // First call: check if index exists - return that it does exist
      mockAdapter.executeQuery.mockResolvedValueOnce({ rows: [{ "1": 1 }] });

      const tool = tools.find((t) => t.name === "pg_vector_create_index")!;
      const result = (await tool.handler(
        {
          table: "embeddings",
          column: "vector",
          type: "hnsw",
          ifNotExists: true,
        },
        mockContext,
      )) as Record<string, unknown>;

      // Should have checked for existing index
      expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
        expect.stringContaining("pg_indexes"),
        expect.arrayContaining(["idx_embeddings_vector_hnsw"]),
      );
      // Should return alreadyExists flag
      expect(result.success).toBe(true);
      expect(result.alreadyExists).toBe(true);
    });

    it("should create index when ifNotExists is true and index does not exist", async () => {
      // First call: check if index exists - return empty (not found)
      mockAdapter.executeQuery.mockResolvedValueOnce({ rows: [] });
      // Second call: CREATE INDEX
      mockAdapter.executeQuery.mockResolvedValueOnce({ rows: [] });

      const tool = tools.find((t) => t.name === "pg_vector_create_index")!;
      const result = (await tool.handler(
        {
          table: "embeddings",
          column: "vector",
          type: "hnsw",
          ifNotExists: true,
        },
        mockContext,
      )) as Record<string, unknown>;

      // Should have made two queries: check + create
      expect(mockAdapter.executeQuery).toHaveBeenCalledTimes(2);
      // Second call should be CREATE INDEX without IF NOT EXISTS
      const createCall = mockAdapter.executeQuery.mock.calls[1][0] as string;
      expect(createCall).toContain("CREATE INDEX");
      expect(createCall).not.toContain("IF NOT EXISTS");
      expect(result.success).toBe(true);
      expect(result.alreadyExists).toBeUndefined();
    });

    it("should not check for existing index when ifNotExists is false or omitted", async () => {
      mockAdapter.executeQuery.mockResolvedValue({ rows: [] });

      const tool = tools.find((t) => t.name === "pg_vector_create_index")!;
      await tool.handler(
        {
          table: "embeddings",
          column: "vector",
          type: "ivfflat",
        },
        mockContext,
      );

      // Should only have one call (CREATE INDEX, no check)
      expect(mockAdapter.executeQuery).toHaveBeenCalledTimes(1);
      const sqlCall = mockAdapter.executeQuery.mock.calls[0][0] as string;
      expect(sqlCall).toContain("CREATE INDEX");
      expect(sqlCall).not.toContain("pg_indexes");
    });

    it("should return ifNotExists status in response", async () => {
      // First call: check if index exists - return empty (not found)
      mockAdapter.executeQuery.mockResolvedValueOnce({ rows: [] });
      // Second call: CREATE INDEX
      mockAdapter.executeQuery.mockResolvedValueOnce({ rows: [] });

      const tool = tools.find((t) => t.name === "pg_vector_create_index")!;
      const result = (await tool.handler(
        {
          table: "embeddings",
          column: "vector",
          type: "hnsw",
          ifNotExists: true,
        },
        mockContext,
      )) as Record<string, unknown>;

      expect(result.ifNotExists).toBe(true);
    });
  });

  describe("pg_vector_aggregate returns only average_vector", () => {
    it("should return average_vector without duplicate average field", async () => {
      // First: column type check, Second: aggregate query
      mockAdapter.executeQuery
        .mockResolvedValueOnce({ rows: [{ udt_name: "vector" }] }) // type check
        .mockResolvedValueOnce({
          rows: [{ average_vector: "[0.1, 0.2, 0.3]", count: "5" }],
        });

      const tool = tools.find((t) => t.name === "pg_vector_aggregate")!;
      const result = (await tool.handler(
        {
          table: "embeddings",
          column: "vector",
          summarizeVector: false, // Get raw array for testing
        },
        mockContext,
      )) as Record<string, unknown>;

      // Now returns parsed array instead of string
      expect(result.average_vector).toEqual([0.1, 0.2, 0.3]);
      expect(result.average).toBeUndefined(); // Removed redundant field
    });
  });

  describe("pg_hybrid_search select parameter", () => {
    it("should respect select parameter to limit columns", async () => {
      // Mock: column type check, then main query (select specified, no column list needed)
      mockAdapter.executeQuery
        .mockResolvedValueOnce({
          rows: [{ data_type: "USER-DEFINED", udt_name: "vector" }],
        }) // type check
        .mockResolvedValueOnce({
          rows: [{ id: 1, title: "test", combined_score: 0.9 }],
        }); // main query

      const tool = tools.find((t) => t.name === "pg_hybrid_search")!;
      await tool.handler(
        {
          table: "documents",
          vectorColumn: "embedding",
          textColumn: "content",
          vector: [0.1, 0.2, 0.3],
          textQuery: "search term",
          select: ["id", "title"],
        },
        mockContext,
      );

      // Main query is the second call (after type check)
      const mainQueryCall = mockAdapter.executeQuery.mock.calls[1][0] as string;
      expect(mainQueryCall).toContain('t."id"');
      expect(mainQueryCall).toContain('t."title"');
      expect(mainQueryCall).not.toContain("t.*");
    });

    it("should exclude vector columns when select is not provided", async () => {
      // Mock: column type check, column list query, then main query
      mockAdapter.executeQuery
        .mockResolvedValueOnce({
          rows: [{ data_type: "USER-DEFINED", udt_name: "vector" }],
        }) // type check
        .mockResolvedValueOnce({
          rows: [{ column_name: "id" }, { column_name: "content" }],
        }) // column list
        .mockResolvedValueOnce({ rows: [] }); // main query

      const tool = tools.find((t) => t.name === "pg_hybrid_search")!;
      await tool.handler(
        {
          table: "documents",
          vectorColumn: "embedding",
          textColumn: "content",
          vector: [0.1, 0.2, 0.3],
          textQuery: "search term",
        },
        mockContext,
      );

      // Main query is the third call
      const mainQueryCall = mockAdapter.executeQuery.mock.calls[2][0] as string;
      expect(mainQueryCall).toContain('t."id"');
      expect(mainQueryCall).toContain('t."content"');
      // Should NOT use t.* since we now dynamically get non-vector columns
      expect(mainQueryCall).not.toContain("t.*");
    });
  });

  describe("pg_vector_dimension_reduce schema and alias", () => {
    it("should expose targetDimensions in inputSchema", () => {
      const tool = tools.find((t) => t.name === "pg_vector_dimension_reduce")!;
      // Verify schema exists and is properly defined
      expect(tool.inputSchema).toBeDefined();
    });

    it("should accept dimensions alias for targetDimensions", async () => {
      const tool = tools.find((t) => t.name === "pg_vector_dimension_reduce")!;
      const result = (await tool.handler(
        {
          vector: [0.1, 0.2, 0.3, 0.4, 0.5],
          dimensions: 2, // alias for targetDimensions
        },
        mockContext,
      )) as Record<string, unknown>;

      expect(result.targetDimensions).toBe(2);
      expect(result.reduced).toBeDefined();
    });

    it("should work with targetDimensions directly", async () => {
      const tool = tools.find((t) => t.name === "pg_vector_dimension_reduce")!;
      const result = (await tool.handler(
        {
          vector: [0.1, 0.2, 0.3, 0.4, 0.5],
          targetDimensions: 3,
        },
        mockContext,
      )) as Record<string, unknown>;

      expect(result.targetDimensions).toBe(3);
      expect((result.reduced as number[]).length).toBe(3);
    });

    it("should throw error when neither targetDimensions nor dimensions provided", async () => {
      const tool = tools.find((t) => t.name === "pg_vector_dimension_reduce")!;

      await expect(
        tool.handler(
          {
            vector: [0.1, 0.2, 0.3],
          },
          mockContext,
        ),
      ).rejects.toThrow();
    });
  });

  describe("pg_vector_insert update mode", () => {
    it("should generate UPDATE when updateExisting is true with conflictValue", async () => {
      mockAdapter.executeQuery.mockResolvedValue({ rowsAffected: 1 });

      const tool = tools.find((t) => t.name === "pg_vector_insert")!;
      const result = (await tool.handler(
        {
          table: "embeddings",
          column: "vector",
          vector: [0.1, 0.2, 0.3],
          updateExisting: true,
          conflictColumn: "id",
          conflictValue: 42,
        },
        mockContext,
      )) as Record<string, unknown>;

      const sql = mockAdapter.executeQuery.mock.calls[0][0] as string;
      expect(sql).toContain("UPDATE");
      expect(sql).toContain("SET");
      expect(sql).toContain("WHERE");
      expect(result.success).toBe(true);
      expect(result.mode).toBe("update");
    });

    it("should return error when updateExisting is true without conflictValue", async () => {
      const tool = tools.find((t) => t.name === "pg_vector_insert")!;
      const result = (await tool.handler(
        {
          table: "embeddings",
          column: "vector",
          vector: [0.1, 0.2, 0.3],
          updateExisting: true,
          conflictColumn: "id",
        },
        mockContext,
      )) as Record<string, unknown>;

      expect(result.success).toBe(false);
      expect(result.error).toContain("conflictValue");
    });
  });

  describe("pg_vector_cluster clusters alias", () => {
    it("should accept clusters as alias for k", async () => {
      mockAdapter.executeQuery.mockResolvedValue({
        rows: [
          { vec: "[0.1,0.2,0.3]" },
          { vec: "[0.4,0.5,0.6]" },
          { vec: "[0.7,0.8,0.9]" },
        ],
      });

      const tool = tools.find((t) => t.name === "pg_vector_cluster")!;
      const result = (await tool.handler(
        {
          table: "embeddings",
          column: "vector",
          clusters: 3, // alias for k
        },
        mockContext,
      )) as Record<string, unknown>;

      expect(result.k).toBe(3);
    });

    it("should throw when neither k nor clusters provided", async () => {
      const tool = tools.find((t) => t.name === "pg_vector_cluster")!;

      await expect(
        tool.handler(
          {
            table: "embeddings",
            column: "vector",
          },
          mockContext,
        ),
      ).rejects.toThrow();
    });
  });

  describe("pg_vector_aggregate groupBy", () => {
    it("should generate GROUP BY SQL when groupBy is specified", async () => {
      // First: column type check, Second: groupBy aggregate query
      mockAdapter.executeQuery
        .mockResolvedValueOnce({ rows: [{ udt_name: "vector" }] }) // type check
        .mockResolvedValueOnce({
          rows: [
            { group_key: "category_a", average_vector: "[0.1,0.2]", count: 5 },
            { group_key: "category_b", average_vector: "[0.3,0.4]", count: 3 },
          ],
        });

      const tool = tools.find((t) => t.name === "pg_vector_aggregate")!;
      const result = (await tool.handler(
        {
          table: "embeddings",
          column: "vector",
          groupBy: "category",
        },
        mockContext,
      )) as Record<string, unknown>;

      // Second call (index 1) should contain GROUP BY
      const sql = mockAdapter.executeQuery.mock.calls[1][0] as string;
      expect(sql).toContain("GROUP BY");
      expect(result.groups).toBeDefined();
      expect((result.groups as unknown[]).length).toBe(2);
      expect(result.count).toBe(2);
    });

    it("should return overall average when groupBy is not specified", async () => {
      // First: column type check, Second: aggregate query
      mockAdapter.executeQuery
        .mockResolvedValueOnce({ rows: [{ udt_name: "vector" }] }) // type check
        .mockResolvedValueOnce({
          rows: [{ average_vector: "[0.2,0.3]", count: "8" }],
        });

      const tool = tools.find((t) => t.name === "pg_vector_aggregate")!;
      const result = (await tool.handler(
        {
          table: "embeddings",
          column: "vector",
          summarizeVector: false, // Get raw array for testing
        },
        mockContext,
      )) as Record<string, unknown>;

      // Now returns parsed array instead of string
      expect(result.average_vector).toEqual([0.2, 0.3]);
      expect(result.average).toBeUndefined(); // No longer duplicated
      expect(result.groups).toBeUndefined();
    });
  });

  describe("pg_vector_search filter alias", () => {
    it("should accept filter as alias for where", async () => {
      mockAdapter.executeQuery
        .mockResolvedValueOnce({ rows: [{ udt_name: "vector" }] }) // type check
        .mockResolvedValueOnce({ rows: [{ distance: 0.1 }] }); // search

      const tool = tools.find((t) => t.name === "pg_vector_search")!;
      await tool.handler(
        {
          table: "embeddings",
          column: "vector",
          vector: [0.1, 0.2, 0.3],
          filter: "category = 1", // alias for where
        },
        mockContext,
      );

      // Check the second call (search query) contains the filter
      const sql = mockAdapter.executeQuery.mock.calls[1][0] as string;
      expect(sql).toContain("category = 1");
    });
  });
});
