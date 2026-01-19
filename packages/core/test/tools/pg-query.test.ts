import { describe, it, expect, beforeEach } from "vitest";
import { MockExecutor } from "../executor/mock.js";
import { pgQueryHandler } from "../../src/tools/pg-query.js";

describe("pg_query tool", () => {
    let mockExecutor: MockExecutor;
    let context: any;

    beforeEach(() => {
        mockExecutor = new MockExecutor();
        context = { executor: mockExecutor };
    });

    it("should execute read action correctly", async () => {
        const mockResult = { rows: [{ id: 1, name: "test" }], rowCount: 1 };
        mockExecutor.setNextResult(mockResult);

        const params = {
            action: "read" as const,
            sql: "SELECT * FROM users",
        };

        const result = await pgQueryHandler(params, context);

        expect(result).toEqual(mockResult);
        expect(mockExecutor.executedQueries[0].sql).toBe("SELECT * FROM users");
    });

    it("should execute write action correctly", async () => {
        const mockResult = { rows: [], rowCount: 1 };
        mockExecutor.setNextResult(mockResult);

        const params = {
            action: "write" as const,
            sql: "INSERT INTO users (name) VALUES ($1)",
            params: ["Alice"],
        };

        const result = await pgQueryHandler(params, context);

        expect(result).toEqual(mockResult);
        expect(mockExecutor.executedQueries[0].sql).toBe("INSERT INTO users (name) VALUES ($1)");
        expect(mockExecutor.executedQueries[0].params).toEqual(["Alice"]);
    });

    it("should execute explain action correctly", async () => {
        const mockResult = { rows: [{ "QUERY PLAN": "Seq Scan" }], rowCount: 1 };
        mockExecutor.setNextResult(mockResult);

        const params = {
            action: "explain" as const,
            sql: "SELECT * FROM users",
            options: { explain_analyze: true }
        };

        const result = await pgQueryHandler(params as any, context);

        expect(result).toEqual(mockResult);
        // We expect the handler to prepend EXPLAIN
        expect(mockExecutor.executedQueries[0].sql).toMatch(/^EXPLAIN.*ANALYZE/i);
    });
});
