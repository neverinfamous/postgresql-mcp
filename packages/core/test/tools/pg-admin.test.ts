import { describe, it, expect, beforeAll } from "vitest";
import { pgAdminHandler } from "../../src/tools/pg-admin.js";
import { PostgresExecutor } from "../../../../shared/executor/postgres.js";

describe("pg_admin (live)", () => {
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

    it("should handle vacuum", async () => {
        const result = await pgAdminHandler({
            action: "vacuum",
            target: "test_products",
            options: { analyze: true }
        }, context);

        expect(result.status).toBe("success");
    });

    it("should handle analyze", async () => {
        const result = await pgAdminHandler({
            action: "analyze",
            target: "test_products",
            options: { verbose: true }
        } as any, context);

        expect(result.status).toBe("success");
    });

    it("should handle reindex", async () => {
        const result = await pgAdminHandler({
            action: "reindex",
            target: "test_products"
        } as any, context);

        expect(result.status).toBe("success");
    });

    it("should handle stats", async () => {
        const result = await pgAdminHandler({
            action: "stats",
            target: "test_products"
        } as any, context);

        expect(result.rows).toBeDefined();
        expect(result.rows.length).toBeGreaterThan(0);
        expect(result.rows[0].table_name).toBe("test_products");
    });
});
