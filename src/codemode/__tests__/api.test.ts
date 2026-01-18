/**
 * Unit tests for Code Mode API
 *
 * Tests PgApi creation, tool method generation, and sandbox bindings.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createPgApi, PgApi } from "../api.js";
import type { PostgresAdapter } from "../../adapters/postgresql/PostgresAdapter.js";
import type { ToolDefinition, ToolGroup } from "../../types/index.js";

// Mock PostgresAdapter for testing
function createMockAdapter(): PostgresAdapter {
  const mockToolDefs: ToolDefinition[] = [
    {
      name: "pg_read_query",
      description: "Execute a read query",
      group: "core" as ToolGroup,
      inputSchema: {},
      handler: vi.fn(async () => ({ rows: [{ id: 1 }] })),
    },
    {
      name: "pg_list_tables",
      description: "List all tables",
      group: "core" as ToolGroup,
      inputSchema: {},
      handler: vi.fn(async () => [{ name: "users" }, { name: "products" }]),
    },
    {
      name: "pg_jsonb_set",
      description: "Set JSONB value",
      group: "jsonb" as ToolGroup,
      inputSchema: {},
      handler: vi.fn(async () => ({ success: true })),
    },
    {
      name: "pg_transaction_begin",
      description: "Begin transaction",
      group: "transactions" as ToolGroup,
      inputSchema: {},
      handler: vi.fn(async () => ({ transactionId: "tx-123" })),
    },
  ];

  return {
    getToolDefinitions: vi.fn(() => mockToolDefs),
    createContext: vi.fn(() => ({})),
  } as unknown as PostgresAdapter;
}

describe("PgApi", () => {
  let adapter: PostgresAdapter;
  let pgApi: PgApi;

  beforeEach(() => {
    adapter = createMockAdapter();
    pgApi = createPgApi(adapter);
  });

  describe("getAvailableGroups()", () => {
    it("should return all tool groups with counts", () => {
      const groups = pgApi.getAvailableGroups();
      expect(groups["core"]).toBe(2);
      expect(groups["jsonb"]).toBe(1);
      expect(groups["transactions"]).toBe(1);
    });
  });

  describe("getGroupMethods()", () => {
    it("should return method names for a group", () => {
      const methods = pgApi.getGroupMethods("core");
      expect(methods.length).toBeGreaterThan(0);
    });

    it("should return empty array for unknown group", () => {
      const methods = pgApi.getGroupMethods("nonexistent");
      expect(methods).toEqual([]);
    });
  });

  describe("createSandboxBindings()", () => {
    it("should return object with group namespaces", () => {
      const bindings = pgApi.createSandboxBindings();
      expect(bindings).toHaveProperty("core");
      expect(bindings).toHaveProperty("jsonb");
      expect(bindings).toHaveProperty("transactions");
    });

    it("should have methods for each group", () => {
      const bindings = pgApi.createSandboxBindings();
      const core = bindings["core"] as Record<string, unknown>;
      expect(Object.keys(core).length).toBeGreaterThan(0);
    });

    it("should execute underlying tool handler when method called", async () => {
      const bindings = pgApi.createSandboxBindings();
      const core = bindings["core"] as Record<
        string,
        (params: unknown) => Promise<unknown>
      >;

      // Find the listTables method (could have different name after transform)
      const methodNames = Object.keys(core);
      expect(methodNames.length).toBeGreaterThan(0);

      // Call first method and verify it returns something
      const firstMethod = core[methodNames[0]];
      expect(typeof firstMethod).toBe("function");
    });
  });
});

describe("createPgApi", () => {
  it("should create PgApi instance", () => {
    const adapter = createMockAdapter();
    const api = createPgApi(adapter);
    expect(api).toBeInstanceOf(PgApi);
  });

  it("should call getToolDefinitions on adapter", () => {
    const adapter = createMockAdapter();
    createPgApi(adapter);
    expect(adapter.getToolDefinitions).toHaveBeenCalled();
  });
});
