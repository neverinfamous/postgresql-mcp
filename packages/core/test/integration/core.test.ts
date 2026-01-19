import { describe, it, expect, beforeAll } from "vitest";
import { PostgresExecutor } from "../../../../shared/executor/postgres.js";
import { pgQueryHandler } from "../../src/tools/pg-query.js";
import { pgSchemaHandler } from "../../src/tools/pg-schema.js";
import { pgAdminHandler } from "../../src/tools/pg-admin.js";
import { pgMonitorHandler } from "../../src/tools/pg-monitor.js";
import { pgTxHandler } from "../../src/tools/pg-tx.js";

describe("Core Integration Tests", { timeout: 10000 }, () => {
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

        // Wait a bit for PG to be fully ready even if healthcheck passed
        await new Promise(resolve => setTimeout(resolve, 1000));
    });

    it("should perform full cycle: DDL -> Write -> Read -> Stats -> Describe -> Admin", async () => {
        // 1. DDL: Create Table
        await pgSchemaHandler({
            action: "create",
            target: "table",
            name: "users_integrated",
            schema: "public",
            definition: "id serial primary key, name text, email text"
        }, context);

        // 2. Write: Insert Data
        await pgQueryHandler({
            action: "write",
            sql: "INSERT INTO users_integrated (name, email) VALUES ($1, $2)",
            params: ["John Doe", "john@example.com"]
        }, context);

        // 3. Read: Verify Data
        const readResult = await pgQueryHandler({
            action: "read",
            sql: "SELECT * FROM users_integrated WHERE name = $1",
            params: ["John Doe"]
        }, context);
        expect(readResult.rows[0].name).toBe("John Doe");

        // 4. Describe: Verify Structure
        const describeResult = await pgSchemaHandler({
            action: "describe",
            target: "table",
            name: "users_integrated"
        }, context);
        expect(describeResult.name).toBe("users_integrated");
        expect(describeResult.columns.length).toBeGreaterThan(0);

        // 5. Monitor: Check Connections
        const monitorResult = await pgMonitorHandler({
            action: "health"
        }, context);
        expect(monitorResult.status).toBe("healthy");

        // 6. Admin: Vacuum
        await pgAdminHandler({
            action: "vacuum",
            target: "users_integrated"
        }, context);

        // 7. DDL: Drop Table
        await pgSchemaHandler({
            action: "drop",
            target: "table",
            name: "users_integrated"
        }, context);
    });

    it("should handle transactions correctly", async () => {
        // Manual transaction flow would need a session-aware executor logic
        // For now we test at least the BEGIN/COMMIT syntax works against real DB
        await pgTxHandler({ action: "begin" }, context);
        await pgQueryHandler({ action: "read", sql: "SELECT 1" }, context);
        await pgTxHandler({ action: "commit" }, context);
    });
});
