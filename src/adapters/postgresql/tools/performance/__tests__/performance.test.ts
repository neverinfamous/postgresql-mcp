/**
 * postgres-mcp - Performance Tools Unit Tests
 *
 * Tests for PostgreSQL performance tools including EXPLAIN,
 * statistics, monitoring, and optimization.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { getPerformanceTools } from "../index.js";
import type { PostgresAdapter } from "../../../PostgresAdapter.js";
import {
  createMockPostgresAdapter,
  createMockRequestContext,
} from "../../../../../__tests__/mocks/index.js";

describe("getPerformanceTools", () => {
  let adapter: PostgresAdapter;
  let tools: ReturnType<typeof getPerformanceTools>;

  beforeEach(() => {
    vi.clearAllMocks();
    adapter = createMockPostgresAdapter() as unknown as PostgresAdapter;
    tools = getPerformanceTools(adapter);
  });

  it("should return 20 performance tools", () => {
    expect(tools).toHaveLength(20);
  });

  it("should have all expected tool names", () => {
    const toolNames = tools.map((t) => t.name);
    expect(toolNames).toContain("pg_explain");
    expect(toolNames).toContain("pg_explain_analyze");
    expect(toolNames).toContain("pg_explain_buffers");
    expect(toolNames).toContain("pg_index_stats");
    expect(toolNames).toContain("pg_table_stats");
    expect(toolNames).toContain("pg_stat_statements");
    expect(toolNames).toContain("pg_stat_activity");
    expect(toolNames).toContain("pg_locks");
    expect(toolNames).toContain("pg_bloat_check");
    expect(toolNames).toContain("pg_cache_hit_ratio");
    expect(toolNames).toContain("pg_seq_scan_tables");
    expect(toolNames).toContain("pg_index_recommendations");
    expect(toolNames).toContain("pg_query_plan_compare");
    expect(toolNames).toContain("pg_performance_baseline");
    expect(toolNames).toContain("pg_connection_pool_optimize");
    expect(toolNames).toContain("pg_partition_strategy_suggest");
    // New tools
    expect(toolNames).toContain("pg_unused_indexes");
    expect(toolNames).toContain("pg_duplicate_indexes");
    expect(toolNames).toContain("pg_vacuum_stats");
    expect(toolNames).toContain("pg_query_plan_stats");
  });

  it("should have group set to performance for all tools", () => {
    for (const tool of tools) {
      expect(tool.group).toBe("performance");
    }
  });
});

describe("pg_explain", () => {
  let mockAdapter: ReturnType<typeof createMockPostgresAdapter>;
  let tools: ReturnType<typeof getPerformanceTools>;
  let mockContext: ReturnType<typeof createMockRequestContext>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdapter = createMockPostgresAdapter();
    tools = getPerformanceTools(mockAdapter as unknown as PostgresAdapter);
    mockContext = createMockRequestContext();
  });

  it("should explain a query in text format", async () => {
    mockAdapter.executeQuery.mockResolvedValueOnce({
      rows: [
        {
          "QUERY PLAN":
            "Seq Scan on users  (cost=0.00..10.50 rows=50 width=100)",
        },
      ],
    });

    const tool = tools.find((t) => t.name === "pg_explain")!;
    const result = (await tool.handler(
      {
        sql: "SELECT * FROM users",
      },
      mockContext,
    )) as {
      plan: string;
    };

    expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
      expect.stringContaining("EXPLAIN"),
      [],
    );
    expect(result.plan).toContain("Seq Scan");
  });

  it("should explain a query in JSON format", async () => {
    mockAdapter.executeQuery.mockResolvedValueOnce({
      rows: [{ "QUERY PLAN": [{ Plan: { "Node Type": "Seq Scan" } }] }],
    });

    const tool = tools.find((t) => t.name === "pg_explain")!;
    const result = (await tool.handler(
      {
        sql: "SELECT * FROM users",
        format: "json",
      },
      mockContext,
    )) as {
      plan: unknown;
    };

    expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
      expect.stringContaining("FORMAT JSON"),
      [],
    );
    expect(result.plan).toBeDefined();
  });
});

describe("pg_explain_analyze", () => {
  let mockAdapter: ReturnType<typeof createMockPostgresAdapter>;
  let tools: ReturnType<typeof getPerformanceTools>;
  let mockContext: ReturnType<typeof createMockRequestContext>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdapter = createMockPostgresAdapter();
    tools = getPerformanceTools(mockAdapter as unknown as PostgresAdapter);
    mockContext = createMockRequestContext();
  });

  it("should run EXPLAIN ANALYZE", async () => {
    mockAdapter.executeQuery.mockResolvedValueOnce({
      rows: [
        {
          "QUERY PLAN":
            "Seq Scan on users (cost=0.00..10.50 rows=50) (actual time=0.015..0.020 rows=50 loops=1)",
        },
      ],
    });

    const tool = tools.find((t) => t.name === "pg_explain_analyze")!;
    const result = (await tool.handler(
      {
        sql: "SELECT * FROM users",
      },
      mockContext,
    )) as {
      plan: string;
    };

    expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
      expect.stringContaining("EXPLAIN (ANALYZE"),
      [],
    );
    expect(result.plan).toContain("actual time");
  });
});

describe("pg_explain_buffers", () => {
  let mockAdapter: ReturnType<typeof createMockPostgresAdapter>;
  let tools: ReturnType<typeof getPerformanceTools>;
  let mockContext: ReturnType<typeof createMockRequestContext>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdapter = createMockPostgresAdapter();
    tools = getPerformanceTools(mockAdapter as unknown as PostgresAdapter);
    mockContext = createMockRequestContext();
  });

  it("should show buffer usage", async () => {
    mockAdapter.executeQuery.mockResolvedValueOnce({
      rows: [{ "QUERY PLAN": [{ Plan: { "Shared Hit Blocks": 10 } }] }],
    });

    const tool = tools.find((t) => t.name === "pg_explain_buffers")!;
    await tool.handler(
      {
        sql: "SELECT * FROM users",
      },
      mockContext,
    );

    expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
      expect.stringContaining("BUFFERS"),
      [],
    );
  });
});

describe("pg_index_stats", () => {
  let mockAdapter: ReturnType<typeof createMockPostgresAdapter>;
  let tools: ReturnType<typeof getPerformanceTools>;
  let mockContext: ReturnType<typeof createMockRequestContext>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdapter = createMockPostgresAdapter();
    tools = getPerformanceTools(mockAdapter as unknown as PostgresAdapter);
    mockContext = createMockRequestContext();
  });

  it("should return index statistics", async () => {
    mockAdapter.executeQuery.mockResolvedValueOnce({
      rows: [
        { indexrelname: "users_pkey", idx_scan: 1000, idx_tup_read: 5000 },
      ],
    });

    const tool = tools.find((t) => t.name === "pg_index_stats")!;
    const result = (await tool.handler({}, mockContext)) as {
      indexes: unknown[];
    };

    expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
      expect.stringContaining("pg_stat_user_indexes"),
    );
    expect(result.indexes).toHaveLength(1);
  });

  it("should filter by schema when provided", async () => {
    mockAdapter.executeQuery.mockResolvedValueOnce({
      rows: [{ indexrelname: "sales_orders_pkey", idx_scan: 500 }],
    });

    const tool = tools.find((t) => t.name === "pg_index_stats")!;
    await tool.handler({ schema: "sales" }, mockContext);

    expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
      expect.stringContaining("schemaname = 'sales'"),
    );
  });

  it("should filter by table when provided", async () => {
    mockAdapter.executeQuery.mockResolvedValueOnce({
      rows: [{ indexrelname: "orders_pkey", idx_scan: 300 }],
    });

    const tool = tools.find((t) => t.name === "pg_index_stats")!;
    await tool.handler({ table: "orders" }, mockContext);

    expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
      expect.stringContaining("relname = 'orders'"),
    );
  });

  it("should filter by both schema and table when provided", async () => {
    mockAdapter.executeQuery.mockResolvedValueOnce({
      rows: [{ indexrelname: "sales_orders_pkey", idx_scan: 200 }],
    });

    const tool = tools.find((t) => t.name === "pg_index_stats")!;
    await tool.handler({ schema: "sales", table: "orders" }, mockContext);

    expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
      expect.stringContaining("schemaname = 'sales'"),
    );
    expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
      expect.stringContaining("relname = 'orders'"),
    );
  });
});

describe("pg_table_stats", () => {
  let mockAdapter: ReturnType<typeof createMockPostgresAdapter>;
  let tools: ReturnType<typeof getPerformanceTools>;
  let mockContext: ReturnType<typeof createMockRequestContext>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdapter = createMockPostgresAdapter();
    tools = getPerformanceTools(mockAdapter as unknown as PostgresAdapter);
    mockContext = createMockRequestContext();
  });

  it("should return table statistics", async () => {
    mockAdapter.executeQuery.mockResolvedValueOnce({
      rows: [{ relname: "users", seq_scan: 50, idx_scan: 1000 }],
    });

    const tool = tools.find((t) => t.name === "pg_table_stats")!;
    const result = (await tool.handler({}, mockContext)) as {
      tables: unknown[];
    };

    expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
      expect.stringContaining("pg_stat_user_tables"),
    );
    expect(result.tables).toHaveLength(1);
  });

  it("should filter by schema when provided", async () => {
    mockAdapter.executeQuery.mockResolvedValueOnce({
      rows: [{ relname: "orders", seq_scan: 100 }],
    });

    const tool = tools.find((t) => t.name === "pg_table_stats")!;
    await tool.handler({ schema: "sales" }, mockContext);

    expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
      expect.stringContaining("schemaname = 'sales'"),
    );
  });

  it("should filter by table when provided", async () => {
    mockAdapter.executeQuery.mockResolvedValueOnce({
      rows: [{ relname: "orders", seq_scan: 200 }],
    });

    const tool = tools.find((t) => t.name === "pg_table_stats")!;
    await tool.handler({ table: "orders" }, mockContext);

    expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
      expect.stringContaining("relname = 'orders'"),
    );
  });

  it("should filter by both schema and table when provided", async () => {
    mockAdapter.executeQuery.mockResolvedValueOnce({
      rows: [{ relname: "orders", seq_scan: 150 }],
    });

    const tool = tools.find((t) => t.name === "pg_table_stats")!;
    await tool.handler({ schema: "sales", table: "orders" }, mockContext);

    expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
      expect.stringContaining("schemaname = 'sales'"),
    );
    expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
      expect.stringContaining("relname = 'orders'"),
    );
  });
});

describe("pg_stat_statements", () => {
  let mockAdapter: ReturnType<typeof createMockPostgresAdapter>;
  let tools: ReturnType<typeof getPerformanceTools>;
  let mockContext: ReturnType<typeof createMockRequestContext>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdapter = createMockPostgresAdapter();
    tools = getPerformanceTools(mockAdapter as unknown as PostgresAdapter);
    mockContext = createMockRequestContext();
  });

  it("should return statement statistics", async () => {
    mockAdapter.executeQuery.mockResolvedValueOnce({
      rows: [{ query: "SELECT * FROM users", calls: 100, mean_exec_time: 5.2 }],
    });

    const tool = tools.find((t) => t.name === "pg_stat_statements")!;
    const result = (await tool.handler({}, mockContext)) as {
      statements: unknown[];
    };

    expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
      expect.stringContaining("pg_stat_statements"),
    );
    expect(result.statements).toHaveLength(1);
  });

  it("should order by calls when specified", async () => {
    mockAdapter.executeQuery.mockResolvedValueOnce({
      rows: [{ query: "SELECT 1", calls: 500, mean_exec_time: 1.0 }],
    });

    const tool = tools.find((t) => t.name === "pg_stat_statements")!;
    await tool.handler({ orderBy: "calls" }, mockContext);

    expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
      expect.stringMatching(/ORDER BY calls DESC/),
    );
  });

  it("should order by mean_time when specified", async () => {
    mockAdapter.executeQuery.mockResolvedValueOnce({
      rows: [{ query: "SELECT 1", calls: 50, mean_exec_time: 10.5 }],
    });

    const tool = tools.find((t) => t.name === "pg_stat_statements")!;
    await tool.handler({ orderBy: "mean_time" }, mockContext);

    expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
      expect.stringMatching(/ORDER BY mean_time DESC/),
    );
  });

  it("should order by rows when specified", async () => {
    mockAdapter.executeQuery.mockResolvedValueOnce({
      rows: [{ query: "SELECT 1", calls: 100, rows: 10000 }],
    });

    const tool = tools.find((t) => t.name === "pg_stat_statements")!;
    await tool.handler({ orderBy: "rows" }, mockContext);

    expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
      expect.stringMatching(/ORDER BY rows DESC/),
    );
  });
});

describe("pg_stat_activity", () => {
  let mockAdapter: ReturnType<typeof createMockPostgresAdapter>;
  let tools: ReturnType<typeof getPerformanceTools>;
  let mockContext: ReturnType<typeof createMockRequestContext>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdapter = createMockPostgresAdapter();
    tools = getPerformanceTools(mockAdapter as unknown as PostgresAdapter);
    mockContext = createMockRequestContext();
  });

  it("should return active connections", async () => {
    mockAdapter.executeQuery.mockResolvedValueOnce({
      rows: [{ pid: 123, state: "active", query: "SELECT 1" }],
    });

    const tool = tools.find((t) => t.name === "pg_stat_activity")!;
    const result = (await tool.handler({}, mockContext)) as {
      connections: unknown[];
      count: number;
    };

    expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
      expect.stringContaining("pg_stat_activity"),
    );
    expect(result.connections).toHaveLength(1);
    expect(result.count).toBe(1);
  });

  it("should exclude idle connections by default", async () => {
    mockAdapter.executeQuery.mockResolvedValueOnce({
      rows: [{ pid: 123, state: "active", query: "SELECT 1" }],
    });

    const tool = tools.find((t) => t.name === "pg_stat_activity")!;
    await tool.handler({}, mockContext);

    expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
      expect.stringContaining("state != 'idle'"),
    );
  });

  it("should include idle connections when requested", async () => {
    mockAdapter.executeQuery.mockResolvedValueOnce({
      rows: [
        { pid: 123, state: "active", query: "SELECT 1" },
        { pid: 124, state: "idle", query: "" },
      ],
    });

    const tool = tools.find((t) => t.name === "pg_stat_activity")!;
    const result = (await tool.handler({ includeIdle: true }, mockContext)) as {
      connections: unknown[];
      count: number;
    };

    const sql = mockAdapter.executeQuery.mock.calls[0]?.[0] as string;
    expect(sql).not.toContain("state != 'idle'");
    expect(result.count).toBe(2);
  });
});

describe("pg_locks", () => {
  let mockAdapter: ReturnType<typeof createMockPostgresAdapter>;
  let tools: ReturnType<typeof getPerformanceTools>;
  let mockContext: ReturnType<typeof createMockRequestContext>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdapter = createMockPostgresAdapter();
    tools = getPerformanceTools(mockAdapter as unknown as PostgresAdapter);
    mockContext = createMockRequestContext();
  });

  it("should return current locks", async () => {
    mockAdapter.executeQuery.mockResolvedValueOnce({
      rows: [{ locktype: "relation", mode: "AccessShareLock", granted: true }],
    });

    const tool = tools.find((t) => t.name === "pg_locks")!;
    const result = (await tool.handler({}, mockContext)) as {
      locks: unknown[];
    };

    expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
      expect.stringContaining("pg_locks"),
    );
    expect(result.locks).toHaveLength(1);
  });

  it("should show blocked queries when requested", async () => {
    mockAdapter.executeQuery.mockResolvedValueOnce({
      rows: [{ blocked_pid: 123, blocking_pid: 456 }],
    });

    const tool = tools.find((t) => t.name === "pg_locks")!;
    await tool.handler({ showBlocked: true }, mockContext);

    expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
      expect.stringContaining("NOT bl.granted"),
    );
  });
});

describe("pg_bloat_check", () => {
  let mockAdapter: ReturnType<typeof createMockPostgresAdapter>;
  let tools: ReturnType<typeof getPerformanceTools>;
  let mockContext: ReturnType<typeof createMockRequestContext>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdapter = createMockPostgresAdapter();
    tools = getPerformanceTools(mockAdapter as unknown as PostgresAdapter);
    mockContext = createMockRequestContext();
  });

  it("should check for bloat", async () => {
    mockAdapter.executeQuery.mockResolvedValueOnce({
      rows: [{ table_name: "users", dead_tuples: 1000, dead_pct: 5.5 }],
    });

    const tool = tools.find((t) => t.name === "pg_bloat_check")!;
    const result = (await tool.handler({}, mockContext)) as {
      tables: unknown[];
    };

    expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
      expect.stringContaining("n_dead_tup"),
    );
    expect(result.tables).toHaveLength(1);
  });
});

describe("pg_cache_hit_ratio", () => {
  let mockAdapter: ReturnType<typeof createMockPostgresAdapter>;
  let tools: ReturnType<typeof getPerformanceTools>;
  let mockContext: ReturnType<typeof createMockRequestContext>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdapter = createMockPostgresAdapter();
    tools = getPerformanceTools(mockAdapter as unknown as PostgresAdapter);
    mockContext = createMockRequestContext();
  });

  it("should return cache hit ratio", async () => {
    mockAdapter.executeQuery.mockResolvedValueOnce({
      rows: [{ heap_read: 100, heap_hit: 9900, cache_hit_ratio: 99.0 }],
    });

    const tool = tools.find((t) => t.name === "pg_cache_hit_ratio")!;
    const result = (await tool.handler({}, mockContext)) as {
      cache_hit_ratio: number;
    };

    expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
      expect.stringContaining("pg_statio_user_tables"),
    );
    expect(result.cache_hit_ratio).toBe(99.0);
  });
});

describe("pg_seq_scan_tables", () => {
  let mockAdapter: ReturnType<typeof createMockPostgresAdapter>;
  let tools: ReturnType<typeof getPerformanceTools>;
  let mockContext: ReturnType<typeof createMockRequestContext>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdapter = createMockPostgresAdapter();
    tools = getPerformanceTools(mockAdapter as unknown as PostgresAdapter);
    mockContext = createMockRequestContext();
  });

  it("should find tables with high seq scans", async () => {
    mockAdapter.executeQuery.mockResolvedValueOnce({
      rows: [{ relname: "orders", seq_scan: 10000, idx_scan: 100 }],
    });

    const tool = tools.find((t) => t.name === "pg_seq_scan_tables")!;
    const result = (await tool.handler({}, mockContext)) as {
      tables: unknown[];
    };

    expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
      expect.stringContaining("seq_scan"),
    );
    expect(result.tables).toHaveLength(1);
  });
});

describe("pg_index_recommendations", () => {
  let mockAdapter: ReturnType<typeof createMockPostgresAdapter>;
  let tools: ReturnType<typeof getPerformanceTools>;
  let mockContext: ReturnType<typeof createMockRequestContext>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdapter = createMockPostgresAdapter();
    tools = getPerformanceTools(mockAdapter as unknown as PostgresAdapter);
    mockContext = createMockRequestContext();
  });

  it("should recommend indexes", async () => {
    mockAdapter.executeQuery.mockResolvedValueOnce({
      rows: [{ relname: "orders", seq_scan: 5000 }],
    });

    const tool = tools.find((t) => t.name === "pg_index_recommendations")!;
    const result = (await tool.handler({}, mockContext)) as {
      recommendations: unknown[];
    };

    expect(mockAdapter.executeQuery).toHaveBeenCalled();
    expect(result.recommendations).toBeDefined();
  });
});

describe("pg_query_plan_compare", () => {
  let mockAdapter: ReturnType<typeof createMockPostgresAdapter>;
  let tools: ReturnType<typeof getPerformanceTools>;
  let mockContext: ReturnType<typeof createMockRequestContext>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdapter = createMockPostgresAdapter();
    tools = getPerformanceTools(mockAdapter as unknown as PostgresAdapter);
    mockContext = createMockRequestContext();
  });

  it("should compare query plans", async () => {
    mockAdapter.executeQuery
      .mockResolvedValueOnce({
        rows: [{ "QUERY PLAN": [{ Plan: { "Total Cost": 100 } }] }],
      })
      .mockResolvedValueOnce({
        rows: [{ "QUERY PLAN": [{ Plan: { "Total Cost": 50 } }] }],
      });

    const tool = tools.find((t) => t.name === "pg_query_plan_compare")!;
    const result = (await tool.handler(
      {
        query1: "SELECT * FROM users WHERE id = 1",
        query2: "SELECT * FROM users WHERE id = 2",
      },
      mockContext,
    )) as {
      query1: unknown;
      query2: unknown;
      analysis: { recommendation: string };
    };

    expect(mockAdapter.executeQuery).toHaveBeenCalledTimes(2);
    expect(result.query1).toBeDefined();
    expect(result.query2).toBeDefined();
    expect(result.analysis.recommendation).toBeDefined();
  });

  it("should recommend query2 when it has lower cost (costDifference > 0)", async () => {
    mockAdapter.executeQuery
      .mockResolvedValueOnce({
        rows: [{ "QUERY PLAN": [{ Plan: { "Total Cost": 200 } }] }],
      })
      .mockResolvedValueOnce({
        rows: [{ "QUERY PLAN": [{ Plan: { "Total Cost": 50 } }] }],
      });

    const tool = tools.find((t) => t.name === "pg_query_plan_compare")!;
    const result = (await tool.handler(
      {
        query1: "SELECT * FROM large_table",
        query2: "SELECT * FROM large_table WHERE indexed_col = 1",
      },
      mockContext,
    )) as {
      analysis: { costDifference: number; recommendation: string };
    };

    expect(result.analysis.costDifference).toBe(150); // 200 - 50 > 0
    expect(result.analysis.recommendation).toContain("Query 2 has lower");
  });

  it("should recommend query1 when it has lower cost (costDifference < 0)", async () => {
    mockAdapter.executeQuery
      .mockResolvedValueOnce({
        rows: [{ "QUERY PLAN": [{ Plan: { "Total Cost": 30 } }] }],
      })
      .mockResolvedValueOnce({
        rows: [{ "QUERY PLAN": [{ Plan: { "Total Cost": 100 } }] }],
      });

    const tool = tools.find((t) => t.name === "pg_query_plan_compare")!;
    const result = (await tool.handler(
      {
        query1: "SELECT id FROM users WHERE id = 1",
        query2: "SELECT * FROM users WHERE id = 1",
      },
      mockContext,
    )) as {
      analysis: { costDifference: number; recommendation: string };
    };

    expect(result.analysis.costDifference).toBe(-70); // 30 - 100 < 0
    expect(result.analysis.recommendation).toContain("Query 1 has lower");
  });

  it("should report similar cost when costDifference === 0", async () => {
    mockAdapter.executeQuery
      .mockResolvedValueOnce({
        rows: [{ "QUERY PLAN": [{ Plan: { "Total Cost": 100 } }] }],
      })
      .mockResolvedValueOnce({
        rows: [{ "QUERY PLAN": [{ Plan: { "Total Cost": 100 } }] }],
      });

    const tool = tools.find((t) => t.name === "pg_query_plan_compare")!;
    const result = (await tool.handler(
      {
        query1: "SELECT * FROM users WHERE id = 1",
        query2: "SELECT * FROM users WHERE id = 2",
      },
      mockContext,
    )) as {
      analysis: { costDifference: number; recommendation: string };
    };

    expect(result.analysis.costDifference).toBe(0);
    expect(result.analysis.recommendation).toContain("similar estimated cost");
  });

  it("should handle null costDifference when plans are missing", async () => {
    mockAdapter.executeQuery
      .mockResolvedValueOnce({ rows: [{ "QUERY PLAN": [] }] })
      .mockResolvedValueOnce({ rows: [{ "QUERY PLAN": [] }] });

    const tool = tools.find((t) => t.name === "pg_query_plan_compare")!;
    const result = (await tool.handler(
      {
        query1: "SELECT 1",
        query2: "SELECT 2",
      },
      mockContext,
    )) as {
      analysis: { costDifference: number | null; recommendation: string };
    };

    expect(result.analysis.costDifference).toBeNull();
  });

  it("should use analyze option when provided", async () => {
    mockAdapter.executeQuery
      .mockResolvedValueOnce({
        rows: [
          {
            "QUERY PLAN": [
              { Plan: { "Total Cost": 100 }, "Execution Time": 1.5 },
            ],
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            "QUERY PLAN": [
              { Plan: { "Total Cost": 50 }, "Execution Time": 0.8 },
            ],
          },
        ],
      });

    const tool = tools.find((t) => t.name === "pg_query_plan_compare")!;
    await tool.handler(
      {
        query1: "SELECT * FROM users",
        query2: "SELECT id FROM users",
        analyze: true,
      },
      mockContext,
    );

    expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
      expect.stringContaining("ANALYZE"),
    );
  });
});

describe("pg_performance_baseline", () => {
  let mockAdapter: ReturnType<typeof createMockPostgresAdapter>;
  let tools: ReturnType<typeof getPerformanceTools>;
  let mockContext: ReturnType<typeof createMockRequestContext>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdapter = createMockPostgresAdapter();
    tools = getPerformanceTools(mockAdapter as unknown as PostgresAdapter);
    mockContext = createMockRequestContext();
  });

  it("should create performance baseline", async () => {
    // Mock the 5 parallel queries
    mockAdapter.executeQuery
      .mockResolvedValueOnce({
        rows: [{ heap_hits: 1000, heap_reads: 10, cache_hit_ratio: 99 }],
      })
      .mockResolvedValueOnce({
        rows: [{ total_seq_scans: 100, total_idx_scans: 5000 }],
      })
      .mockResolvedValueOnce({ rows: [{ total_indexes: 20 }] })
      .mockResolvedValueOnce({ rows: [{ total_connections: 10 }] })
      .mockResolvedValueOnce({ rows: [{ size_bytes: 1000000 }] });

    const tool = tools.find((t) => t.name === "pg_performance_baseline")!;
    const result = (await tool.handler({}, mockContext)) as {
      name: string;
      metrics: unknown;
    };

    expect(mockAdapter.executeQuery).toHaveBeenCalled();
    expect(result.name).toBeDefined();
    expect(result.metrics).toBeDefined();
  });
});

describe("pg_connection_pool_optimize", () => {
  let mockAdapter: ReturnType<typeof createMockPostgresAdapter>;
  let tools: ReturnType<typeof getPerformanceTools>;
  let mockContext: ReturnType<typeof createMockRequestContext>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdapter = createMockPostgresAdapter();
    tools = getPerformanceTools(mockAdapter as unknown as PostgresAdapter);
    mockContext = createMockRequestContext();
  });

  it("should optimize connection pool", async () => {
    // Mock the 3 parallel queries
    mockAdapter.executeQuery
      .mockResolvedValueOnce({
        rows: [
          {
            total_connections: 20,
            active: 5,
            idle: 10,
            idle_in_transaction: 2,
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [{ max_connections: 100, reserved_connections: 3 }],
      })
      .mockResolvedValueOnce({
        rows: [{ wait_event_type: "Lock", wait_event: "tuple", count: 2 }],
      });

    const tool = tools.find((t) => t.name === "pg_connection_pool_optimize")!;
    const result = (await tool.handler({}, mockContext)) as {
      current: unknown;
      recommendations: string[];
    };

    expect(mockAdapter.executeQuery).toHaveBeenCalled();
    expect(result.current).toBeDefined();
    expect(result.recommendations).toBeDefined();
  });

  it("should warn when connection utilization exceeds 80%", async () => {
    // 85% utilization: 85 connections out of 100 max
    mockAdapter.executeQuery
      .mockResolvedValueOnce({
        rows: [
          {
            total_connections: 85,
            active: 70,
            idle: 10,
            idle_in_transaction: 2,
            waiting: 3,
            max_connection_age_seconds: 100,
            avg_connection_age_seconds: 50,
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [{ max_connections: 100, reserved_connections: 3 }],
      })
      .mockResolvedValueOnce({ rows: [] });

    const tool = tools.find((t) => t.name === "pg_connection_pool_optimize")!;
    const result = (await tool.handler({}, mockContext)) as {
      recommendations: string[];
    };

    expect(result.recommendations).toContainEqual(
      expect.stringContaining("utilization"),
    );
  });

  it("should warn when idle-in-transaction exceeds active", async () => {
    mockAdapter.executeQuery
      .mockResolvedValueOnce({
        rows: [
          {
            total_connections: 20,
            active: 3,
            idle: 5,
            idle_in_transaction: 10,
            waiting: 0,
            max_connection_age_seconds: 100,
            avg_connection_age_seconds: 50,
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [{ max_connections: 100, reserved_connections: 3 }],
      })
      .mockResolvedValueOnce({ rows: [] });

    const tool = tools.find((t) => t.name === "pg_connection_pool_optimize")!;
    const result = (await tool.handler({}, mockContext)) as {
      recommendations: string[];
    };

    expect(result.recommendations).toContainEqual(
      expect.stringContaining("idle-in-transaction"),
    );
  });

  it("should warn when idle/active ratio is too high", async () => {
    // idle (30) > active (5) * 3
    mockAdapter.executeQuery
      .mockResolvedValueOnce({
        rows: [
          {
            total_connections: 40,
            active: 5,
            idle: 30,
            idle_in_transaction: 2,
            waiting: 0,
            max_connection_age_seconds: 100,
            avg_connection_age_seconds: 50,
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [{ max_connections: 100, reserved_connections: 3 }],
      })
      .mockResolvedValueOnce({ rows: [] });

    const tool = tools.find((t) => t.name === "pg_connection_pool_optimize")!;
    const result = (await tool.handler({}, mockContext)) as {
      recommendations: string[];
    };

    expect(result.recommendations).toContainEqual(
      expect.stringContaining("idle to active"),
    );
  });

  it("should warn when connections are long-lived", async () => {
    // max_connection_age > 3600 seconds (1 hour)
    mockAdapter.executeQuery
      .mockResolvedValueOnce({
        rows: [
          {
            total_connections: 20,
            active: 5,
            idle: 10,
            idle_in_transaction: 2,
            waiting: 0,
            max_connection_age_seconds: 7200,
            avg_connection_age_seconds: 3600,
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [{ max_connections: 100, reserved_connections: 3 }],
      })
      .mockResolvedValueOnce({ rows: [] });

    const tool = tools.find((t) => t.name === "pg_connection_pool_optimize")!;
    const result = (await tool.handler({}, mockContext)) as {
      recommendations: string[];
    };

    expect(result.recommendations).toContainEqual(
      expect.stringContaining("Long-lived connections"),
    );
  });

  it("should return healthy message when no issues", async () => {
    mockAdapter.executeQuery
      .mockResolvedValueOnce({
        rows: [
          {
            total_connections: 10,
            active: 5,
            idle: 4,
            idle_in_transaction: 0,
            waiting: 0,
            max_connection_age_seconds: 100,
            avg_connection_age_seconds: 50,
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [{ max_connections: 100, reserved_connections: 3 }],
      })
      .mockResolvedValueOnce({ rows: [] });

    const tool = tools.find((t) => t.name === "pg_connection_pool_optimize")!;
    const result = (await tool.handler({}, mockContext)) as {
      recommendations: string[];
    };

    expect(result.recommendations).toContainEqual(
      expect.stringContaining("healthy"),
    );
  });
});

describe("pg_partition_strategy_suggest", () => {
  let mockAdapter: ReturnType<typeof createMockPostgresAdapter>;
  let tools: ReturnType<typeof getPerformanceTools>;
  let mockContext: ReturnType<typeof createMockRequestContext>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdapter = createMockPostgresAdapter();
    tools = getPerformanceTools(mockAdapter as unknown as PostgresAdapter);
    mockContext = createMockRequestContext();
  });

  it("should suggest partition strategy", async () => {
    // Mock the 3 parallel queries
    mockAdapter.executeQuery
      .mockResolvedValueOnce({
        rows: [{ relname: "orders", n_live_tup: 50000000 }],
      })
      .mockResolvedValueOnce({
        rows: [
          { column_name: "created_at", data_type: "timestamp", n_distinct: -1 },
        ],
      })
      .mockResolvedValueOnce({
        rows: [{ table_size: "5 GB", size_bytes: 5000000000 }],
      });

    const tool = tools.find((t) => t.name === "pg_partition_strategy_suggest")!;
    const result = (await tool.handler(
      {
        table: "orders",
      },
      mockContext,
    )) as {
      partitioningRecommended: boolean;
      suggestions: unknown[];
    };

    expect(mockAdapter.executeQuery).toHaveBeenCalled();
    expect(result.partitioningRecommended).toBeDefined();
    expect(result.suggestions).toBeDefined();
  });

  it("should recommend partitioning for tables over 1GB", async () => {
    // 2GB table with low row count
    mockAdapter.executeQuery
      .mockResolvedValueOnce({
        rows: [{ relname: "large_table", n_live_tup: 1000000 }],
      })
      .mockResolvedValueOnce({
        rows: [{ column_name: "id", data_type: "integer", n_distinct: -1 }],
      })
      .mockResolvedValueOnce({
        rows: [{ table_size: "2 GB", size_bytes: 2000000000 }],
      });

    const tool = tools.find((t) => t.name === "pg_partition_strategy_suggest")!;
    const result = (await tool.handler(
      {
        table: "large_table",
      },
      mockContext,
    )) as {
      partitioningRecommended: boolean;
      reason: string;
    };

    expect(result.partitioningRecommended).toBe(true);
    expect(result.reason).toContain("1GB");
  });

  it("should recommend partitioning for tables over 10 million rows", async () => {
    mockAdapter.executeQuery
      .mockResolvedValueOnce({
        rows: [
          {
            relname: "large_table",
            n_live_tup: 15000000,
            n_dead_tup: 100000,
            seq_scan: 50,
            idx_scan: 200,
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [
          { column_name: "created_at", data_type: "timestamp", n_distinct: -1 },
        ],
      })
      .mockResolvedValueOnce({
        rows: [{ table_size: "500 MB", size_bytes: 500000000 }],
      });

    const tool = tools.find((t) => t.name === "pg_partition_strategy_suggest")!;
    const result = (await tool.handler(
      {
        table: "large_table",
      },
      mockContext,
    )) as {
      partitioningRecommended: boolean;
      reason: string;
    };

    expect(result.partitioningRecommended).toBe(true);
    expect(result.reason).toContain("rows");
  });

  it("should suggest RANGE partitioning for timestamp columns", async () => {
    mockAdapter.executeQuery
      .mockResolvedValueOnce({
        rows: [{ relname: "events", n_live_tup: 1000000 }],
      })
      .mockResolvedValueOnce({
        rows: [
          { column_name: "created_at", data_type: "timestamp", n_distinct: -1 },
        ],
      })
      .mockResolvedValueOnce({
        rows: [{ table_size: "100 MB", size_bytes: 100000000 }],
      });

    const tool = tools.find((t) => t.name === "pg_partition_strategy_suggest")!;
    const result = (await tool.handler(
      {
        table: "events",
      },
      mockContext,
    )) as {
      suggestions: Array<{ strategy: string; column: string }>;
    };

    const rangeStrategy = result.suggestions.find(
      (s) => s.strategy === "RANGE" && s.column === "created_at",
    );
    expect(rangeStrategy).toBeDefined();
  });

  it("should suggest LIST partitioning for low cardinality columns", async () => {
    mockAdapter.executeQuery
      .mockResolvedValueOnce({
        rows: [{ relname: "orders", n_live_tup: 1000000 }],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            column_name: "status",
            data_type: "varchar",
            n_distinct: 5,
            null_frac: 0,
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [{ table_size: "100 MB", size_bytes: 100000000 }],
      });

    const tool = tools.find((t) => t.name === "pg_partition_strategy_suggest")!;
    const result = (await tool.handler(
      {
        table: "orders",
      },
      mockContext,
    )) as {
      suggestions: Array<{ strategy: string; column: string }>;
    };

    const listStrategy = result.suggestions.find(
      (s) => s.strategy === "LIST" && s.column === "status",
    );
    expect(listStrategy).toBeDefined();
  });

  it("should suggest HASH partitioning for high cardinality integer columns", async () => {
    mockAdapter.executeQuery
      .mockResolvedValueOnce({
        rows: [{ relname: "users", n_live_tup: 1000000 }],
      })
      .mockResolvedValueOnce({
        rows: [
          {
            column_name: "user_id",
            data_type: "bigint",
            n_distinct: -1,
            null_frac: 0,
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [{ table_size: "100 MB", size_bytes: 100000000 }],
      });

    const tool = tools.find((t) => t.name === "pg_partition_strategy_suggest")!;
    const result = (await tool.handler(
      {
        table: "users",
      },
      mockContext,
    )) as {
      suggestions: Array<{ strategy: string; column: string }>;
    };

    const hashStrategy = result.suggestions.find(
      (s) => s.strategy === "HASH" && s.column === "user_id",
    );
    expect(hashStrategy).toBeDefined();
  });

  it("should not recommend partitioning for small tables", async () => {
    mockAdapter.executeQuery
      .mockResolvedValueOnce({
        rows: [{ relname: "small_table", n_live_tup: 10000 }],
      })
      .mockResolvedValueOnce({
        rows: [{ column_name: "id", data_type: "integer", n_distinct: 100 }],
      })
      .mockResolvedValueOnce({
        rows: [{ table_size: "10 MB", size_bytes: 10000000 }],
      });

    const tool = tools.find((t) => t.name === "pg_partition_strategy_suggest")!;
    const result = (await tool.handler(
      {
        table: "small_table",
      },
      mockContext,
    )) as {
      partitioningRecommended: boolean;
    };

    expect(result.partitioningRecommended).toBe(false);
  });
});

// =============================================================================
// Phase 3: Performance Tools Edge Case Tests
// =============================================================================

describe("Performance Tools Edge Cases", () => {
  let mockAdapter: ReturnType<typeof createMockPostgresAdapter>;
  let tools: ReturnType<typeof getPerformanceTools>;
  let mockContext: ReturnType<typeof createMockRequestContext>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdapter = createMockPostgresAdapter();
    tools = getPerformanceTools(mockAdapter as unknown as PostgresAdapter);
    mockContext = createMockRequestContext();
  });

  it("pg_stat_statements should default to total_time ordering", async () => {
    mockAdapter.executeQuery.mockResolvedValueOnce({
      rows: [{ query: "SELECT 1", calls: 100, total_time: 1000 }],
    });

    const tool = tools.find((t) => t.name === "pg_stat_statements")!;
    await tool.handler({}, mockContext);

    expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
      expect.stringContaining("ORDER BY total_exec_time DESC"),
    );
  });

  it("pg_index_stats should handle empty results", async () => {
    mockAdapter.executeQuery.mockResolvedValueOnce({ rows: [] });

    const tool = tools.find((t) => t.name === "pg_index_stats")!;
    const result = (await tool.handler({}, mockContext)) as {
      indexes: unknown[];
    };

    expect(result.indexes).toHaveLength(0);
  });

  it("pg_bloat_check should handle tables with no bloat", async () => {
    mockAdapter.executeQuery.mockResolvedValueOnce({ rows: [] }); // no bloated tables

    const tool = tools.find((t) => t.name === "pg_bloat_check")!;
    const result = (await tool.handler({}, mockContext)) as {
      tables: unknown[];
    };

    expect(result.tables).toHaveLength(0);
  });

  it("pg_performance_baseline should use custom name when provided", async () => {
    mockAdapter.executeQuery
      .mockResolvedValueOnce({ rows: [{ heap_hits: 1000, heap_reads: 10 }] })
      .mockResolvedValueOnce({ rows: [{ total_seq_scans: 50 }] })
      .mockResolvedValueOnce({ rows: [{ total_indexes: 10 }] })
      .mockResolvedValueOnce({ rows: [{ total_connections: 5 }] })
      .mockResolvedValueOnce({ rows: [{ size_bytes: 1000000 }] });

    const tool = tools.find((t) => t.name === "pg_performance_baseline")!;
    const result = (await tool.handler(
      { name: "my-custom-baseline" },
      mockContext,
    )) as {
      name: string;
    };

    expect(result.name).toBe("my-custom-baseline");
  });

  it("pg_connection_pool_optimize should handle waiting connections", async () => {
    mockAdapter.executeQuery
      .mockResolvedValueOnce({
        rows: [
          {
            total_connections: 50,
            active: 10,
            idle: 15,
            idle_in_transaction: 2,
            waiting: 8,
            max_connection_age_seconds: 100,
            avg_connection_age_seconds: 50,
          },
        ],
      })
      .mockResolvedValueOnce({
        rows: [{ max_connections: 100, reserved_connections: 3 }],
      })
      .mockResolvedValueOnce({ rows: [{ wait_event_type: "Lock", count: 5 }] });

    const tool = tools.find((t) => t.name === "pg_connection_pool_optimize")!;
    const result = (await tool.handler({}, mockContext)) as {
      current: { waiting: number };
      recommendations: string[];
    };

    expect(result.current.waiting).toBe(8);
  });
});

// =============================================================================
// Phase 2: EXPLAIN Tools Coverage Tests
// =============================================================================

describe("EXPLAIN Tools (Coverage)", () => {
  let mockAdapter: ReturnType<typeof createMockPostgresAdapter>;
  let tools: ReturnType<typeof getPerformanceTools>;
  let mockContext: ReturnType<typeof createMockRequestContext>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdapter = createMockPostgresAdapter();
    tools = getPerformanceTools(mockAdapter as unknown as PostgresAdapter);
    mockContext = createMockRequestContext();
  });

  it("pg_explain_analyze should return JSON plan when format is json (line 48)", async () => {
    const jsonPlan = [
      { Plan: { "Node Type": "Seq Scan", "Actual Rows": 100 } },
    ];
    mockAdapter.executeQuery.mockResolvedValueOnce({
      rows: [{ "QUERY PLAN": jsonPlan }],
    });

    const tool = tools.find((t) => t.name === "pg_explain_analyze")!;
    const result = (await tool.handler(
      {
        sql: "SELECT * FROM users",
        format: "json",
      },
      mockContext,
    )) as {
      plan: unknown;
    };

    expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
      expect.stringContaining("FORMAT JSON"),
      [],
    );
    expect(result.plan).toEqual(jsonPlan);
  });

  it("pg_explain_buffers should return JSON plan when format is json (line 69-70)", async () => {
    const jsonPlan = [
      { Plan: { "Shared Hit Blocks": 50, "Shared Read Blocks": 10 } },
    ];
    mockAdapter.executeQuery.mockResolvedValueOnce({
      rows: [{ "QUERY PLAN": jsonPlan }],
    });

    const tool = tools.find((t) => t.name === "pg_explain_buffers")!;
    const result = (await tool.handler(
      {
        sql: "SELECT * FROM large_table",
        format: "json",
      },
      mockContext,
    )) as {
      plan: unknown;
    };

    expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
      expect.stringContaining("FORMAT JSON"),
      [],
    );
    expect(result.plan).toEqual(jsonPlan);
  });

  it("pg_explain_buffers should return text plan when format is text (line 72)", async () => {
    mockAdapter.executeQuery.mockResolvedValueOnce({
      rows: [
        { "QUERY PLAN": "Seq Scan on users (cost=0.00..10.50 rows=50)" },
        { "QUERY PLAN": "  Buffers: shared hit=10 read=2" },
      ],
    });

    const tool = tools.find((t) => t.name === "pg_explain_buffers")!;
    const result = (await tool.handler(
      {
        sql: "SELECT * FROM users",
        format: "text",
      },
      mockContext,
    )) as {
      plan: string;
    };

    expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
      expect.stringContaining("FORMAT TEXT"),
      [],
    );
    expect(result.plan).toContain("Seq Scan");
    expect(result.plan).toContain("Buffers");
  });
});

// =============================================================================
// Phase 3: No-Arg Calls and Parameter Aliases Tests
// =============================================================================

describe("No-Arg Calls (undefined params)", () => {
  let mockAdapter: ReturnType<typeof createMockPostgresAdapter>;
  let tools: ReturnType<typeof getPerformanceTools>;
  let mockContext: ReturnType<typeof createMockRequestContext>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdapter = createMockPostgresAdapter();
    tools = getPerformanceTools(mockAdapter as unknown as PostgresAdapter);
    mockContext = createMockRequestContext();
  });

  it("pg_stat_statements should work with undefined params", async () => {
    mockAdapter.executeQuery.mockResolvedValueOnce({
      rows: [{ query: "SELECT 1", calls: 100 }],
    });

    const tool = tools.find((t) => t.name === "pg_stat_statements")!;
    const result = (await tool.handler(undefined, mockContext)) as {
      statements: unknown[];
    };

    expect(result.statements).toHaveLength(1);
  });

  it("pg_stat_activity should work with undefined params", async () => {
    mockAdapter.executeQuery.mockResolvedValueOnce({
      rows: [{ pid: 123, state: "active" }],
    });

    const tool = tools.find((t) => t.name === "pg_stat_activity")!;
    const result = (await tool.handler(undefined, mockContext)) as {
      connections: unknown[];
    };

    expect(result.connections).toHaveLength(1);
  });

  it("pg_performance_baseline should work with undefined params and auto-generate name", async () => {
    mockAdapter.executeQuery
      .mockResolvedValueOnce({ rows: [{ cache_hit_ratio: 99 }] })
      .mockResolvedValueOnce({ rows: [{ total_seq_scans: 100 }] })
      .mockResolvedValueOnce({ rows: [{ total_indexes: 20 }] })
      .mockResolvedValueOnce({ rows: [{ total_connections: 10 }] })
      .mockResolvedValueOnce({ rows: [{ size_bytes: 1000000 }] });

    const tool = tools.find((t) => t.name === "pg_performance_baseline")!;
    const result = (await tool.handler(undefined, mockContext)) as {
      name: string;
    };

    expect(result.name).toMatch(/^baseline_\d{4}-\d{2}-\d{2}T/);
  });
});

describe("Parameter Aliases", () => {
  let mockAdapter: ReturnType<typeof createMockPostgresAdapter>;
  let tools: ReturnType<typeof getPerformanceTools>;
  let mockContext: ReturnType<typeof createMockRequestContext>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAdapter = createMockPostgresAdapter();
    tools = getPerformanceTools(mockAdapter as unknown as PostgresAdapter);
    mockContext = createMockRequestContext();
  });

  it("pg_partition_strategy_suggest should accept tableName alias", async () => {
    mockAdapter.executeQuery
      .mockResolvedValueOnce({
        rows: [{ relname: "orders", n_live_tup: 1000 }],
      })
      .mockResolvedValueOnce({
        rows: [{ column_name: "id", data_type: "integer" }],
      })
      .mockResolvedValueOnce({
        rows: [{ table_size: "1 MB", size_bytes: 1000000 }],
      });

    const tool = tools.find((t) => t.name === "pg_partition_strategy_suggest")!;
    const result = (await tool.handler(
      { tableName: "orders" },
      mockContext,
    )) as { table: string };

    expect(result.table).toBe("public.orders");
  });

  it("pg_partition_strategy_suggest should accept name alias", async () => {
    mockAdapter.executeQuery
      .mockResolvedValueOnce({ rows: [{ relname: "events", n_live_tup: 500 }] })
      .mockResolvedValueOnce({
        rows: [{ column_name: "created_at", data_type: "timestamp" }],
      })
      .mockResolvedValueOnce({
        rows: [{ table_size: "500 KB", size_bytes: 500000 }],
      });

    const tool = tools.find((t) => t.name === "pg_partition_strategy_suggest")!;
    const result = (await tool.handler({ name: "events" }, mockContext)) as {
      table: string;
    };

    expect(result.table).toBe("public.events");
  });

  it("pg_query_plan_compare should accept sql1/sql2 aliases", async () => {
    mockAdapter.executeQuery
      .mockResolvedValueOnce({
        rows: [{ "QUERY PLAN": [{ Plan: { "Total Cost": 100 } }] }],
      })
      .mockResolvedValueOnce({
        rows: [{ "QUERY PLAN": [{ Plan: { "Total Cost": 50 } }] }],
      });

    const tool = tools.find((t) => t.name === "pg_query_plan_compare")!;
    await tool.handler(
      {
        sql1: "SELECT * FROM users",
        sql2: "SELECT id FROM users",
      },
      mockContext,
    );

    expect(mockAdapter.executeQuery).toHaveBeenCalledTimes(2);
    expect(mockAdapter.executeQuery).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("SELECT * FROM users"),
    );
    expect(mockAdapter.executeQuery).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining("SELECT id FROM users"),
    );
  });
});
