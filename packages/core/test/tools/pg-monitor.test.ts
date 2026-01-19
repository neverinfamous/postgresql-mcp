import { describe, it, expect, beforeEach } from "vitest";
import { pgMonitorHandler } from "../../src/tools/pg-monitor.js";
import { MockExecutor } from "../executor/mock.js";

describe("pg_monitor", () => {
    let mockExecutor: MockExecutor;
    let context: any;

    beforeEach(() => {
        mockExecutor = new MockExecutor();
        context = { executor: mockExecutor };
    });

    it("should handle health check", async () => {
        mockExecutor.setNextResult({ rows: [{ now: new Date() }], rowCount: 1 });

        const result = await pgMonitorHandler({
            action: "health"
        }, context);

        expect(result.status).toBe("healthy");
    });

    it("should handle connections", async () => {
        mockExecutor.setNextResult({ rows: [{ count: 5 }], rowCount: 1 });

        const result = await pgMonitorHandler({
            action: "connections"
        } as any, context);

        expect(result.rows[0].count).toBe(5);
        expect(mockExecutor.executedQueries[0].sql).toContain("pg_stat_activity");
    });

    it("should handle locks", async () => {
        mockExecutor.setNextResult({ rows: [], rowCount: 0 });

        const result = await pgMonitorHandler({
            action: "locks"
        } as any, context);

        expect(result.rows).toEqual([]);
        expect(mockExecutor.executedQueries[0].sql).toContain("pg_locks");
    });

    it("should handle size", async () => {
        mockExecutor.setNextResult({ rows: [{ name: "postgres", size: "100MB" }], rowCount: 1 });

        const result = await pgMonitorHandler({
            action: "size",
            options: { database: "postgres" }
        } as any, context);

        expect(result.rows[0].size).toBe("100MB");
        expect(mockExecutor.executedQueries[0].sql).toContain("pg_database_size");
    });
});
