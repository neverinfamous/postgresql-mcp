import { describe, it, expect, beforeAll } from "vitest";
import { pgSchemaHandler } from "../../src/tools/pg-schema.js";
import { PostgresExecutor } from "../../../../shared/executor/postgres.js";

describe("pg_schema (live)", () => {
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

    it("should handle list tables", async () => {
        const result = await pgSchemaHandler({
            action: "list",
            target: "table",
            schema: "public"
        }, context);

        expect(result.rows).toBeDefined();
        expect(result.rows.length).toBeGreaterThan(0);
        expect(result.rows.find((r: any) => r.name === "test_products")).toBeDefined();
    });

    it("should handle list tables with pagination", async () => {
        const result = await pgSchemaHandler({
            action: "list",
            target: "table",
            schema: "public",
            options: { limit: 1, offset: 0 }
        } as any, context);

        expect(result.rows.length).toBe(1);
    });

    it("should handle describe table", async () => {
        const result = await pgSchemaHandler({
            action: "describe",
            target: "table",
            name: "test_products"
        }, context);

        expect(result.name).toBe("test_products");
        expect(result.columns.find((c: any) => c.name === "id")).toBeDefined();
        // Since we created an index in test-database.sql if any
        // Just verify it returns structure
        expect(result.columns.length).toBeGreaterThan(0);
    });

    it("should handle create table", async () => {
        await executor.execute("DROP TABLE IF EXISTS public.live_test_table");

        await pgSchemaHandler({
            action: "create",
            target: "table",
            name: "live_test_table",
            schema: "public",
            definition: "id serial primary key, name text"
        }, context);

        const verify = await executor.execute("SELECT 1 FROM information_schema.tables WHERE table_name = 'live_test_table'");
        expect(verify.rowCount).toBe(1);
    });

    it("should handle alter table", async () => {
        // Ensure table exists
        await executor.execute("DROP TABLE IF EXISTS public.live_test_alter");
        await executor.execute("CREATE TABLE public.live_test_alter (id int)");

        await pgSchemaHandler({
            action: "alter",
            target: "table",
            name: "live_test_alter",
            definition: "ADD COLUMN age integer"
        }, context);

        const verify = await executor.execute("SELECT column_name FROM information_schema.columns WHERE table_name = 'live_test_alter' AND column_name = 'age'");
        expect(verify.rowCount).toBe(1);
    });

    it("should handle drop table", async () => {
        await executor.execute("CREATE TABLE IF NOT EXISTS public.live_test_drop (id int)");

        await pgSchemaHandler({
            action: "drop",
            target: "table",
            name: "live_test_drop"
        }, context);

        const verify = await executor.execute("SELECT 1 FROM information_schema.tables WHERE table_name = 'live_test_drop'");
        expect(verify.rowCount).toBe(0);
    });
});
