import { describe, it, expect, beforeAll } from "vitest";
import { PostgresExecutor } from "../../../../shared/executor/postgres.js";
import { pgQueryHandler } from "../../src/tools/pg-query.js";

describe("pg_query tool (live)", () => {
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

    it("should execute read action correctly", async () => {
        const params = {
            action: "read" as const,
            sql: "SELECT 1 as val",
        };

        const result = await pgQueryHandler(params, context);

        expect(result.rows[0].val).toBe(1);
    });

    it("should execute write action correctly", async () => {
        // Cleanup and setup
        await executor.execute("DROP TABLE IF EXISTS test_query_write");
        await executor.execute("CREATE TABLE test_query_write (name text)");

        const params = {
            action: "write" as const,
            sql: "INSERT INTO test_query_write (name) VALUES ($1)",
            params: ["Alice"],
        };

        const result = await pgQueryHandler(params, context);

        expect(result.rowCount).toBe(1);

        const verify = await executor.execute("SELECT name FROM test_query_write");
        expect(verify.rows[0].name).toBe("Alice");
    });

    it("should execute explain action correctly", async () => {
        const params = {
            action: "explain" as const,
            sql: "SELECT 1",
            options: { explain_analyze: true }
        };

        const result = await pgQueryHandler(params as any, context);

        expect(JSON.stringify(result)).toContain("QUERY PLAN");
    });
});
