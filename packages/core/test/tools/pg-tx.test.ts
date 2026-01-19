import { describe, it, expect, beforeAll } from "vitest";
import { pgTxHandler } from "../../src/tools/pg-tx.js";
import { PostgresExecutor } from "../../../../shared/executor/postgres.js";

describe("pg_tx (live)", () => {
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

    it("should handle begin", async () => {
        const result = await pgTxHandler({
            action: "begin",
            options: { isolation_level: "serializable" }
        }, context);

        expect(result.status).toBe("success");
    });

    it("should handle commit", async () => {
        await pgTxHandler({ action: "begin" }, context);
        const result = await pgTxHandler({
            action: "commit"
        }, context);

        expect(result.status).toBe("success");
    });

    it("should handle rollback", async () => {
        await pgTxHandler({ action: "begin" }, context);
        const result = await pgTxHandler({
            action: "rollback"
        }, context);

        expect(result.status).toBe("success");
    });

    it("should handle savepoint", async () => {
        await pgTxHandler({ action: "begin" }, context);
        const result = await pgTxHandler({
            action: "savepoint",
            name: "sp1"
        }, context);

        expect(result.status).toBe("success");
        await pgTxHandler({ action: "rollback" }, context);
    });
});
