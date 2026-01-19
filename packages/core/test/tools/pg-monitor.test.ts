import { describe, it, expect, beforeAll } from "vitest";
import { pgMonitorHandler } from "../../src/tools/pg-monitor.js";
import { PostgresExecutor } from "../../../../shared/executor/postgres.js";

describe("pg_monitor (live)", () => {
    let executor: PostgresExecutor;
    let context: any;

    beforeAll(async () => {
        executor = new PostgresExecutor({
            host: "localhost",
            port: 5433,
            user: "mcp",
            password: "mcp",
            database: "mcp_test",
        });
        context = { executor };
    });

    it("should handle health check", async () => {
        const result = await pgMonitorHandler({
            action: "health"
        }, context);

        expect(result.status).toBe("healthy");
    });

    it("should handle connections", async () => {
        const result = await pgMonitorHandler({
            action: "connections"
        } as any, context);

        expect(result.rows).toBeDefined();
        expect(result.rows.length).toBeGreaterThan(0);
    });

    it("should handle locks", async () => {
        const result = await pgMonitorHandler({
            action: "locks"
        } as any, context);

        expect(result.rows).toBeDefined();
    });

    it("should handle size", async () => {
        const result = await pgMonitorHandler({
            action: "size",
            options: { database: "mcp_test" }
        } as any, context);

        expect(result.rows).toBeDefined();
        expect(result.rows.length).toBeGreaterThan(0);
        expect(result.rows[0].name).toBe("mcp_test");
    });
});
