import { describe, it, expect, beforeEach } from "vitest";
import { pgAdminHandler } from "../../src/tools/pg-admin.js";
import { MockExecutor } from "../executor/mock.js";

describe("pg_admin", () => {
    let mockExecutor: MockExecutor;
    let context: any;

    beforeEach(() => {
        mockExecutor = new MockExecutor();
        context = { executor: mockExecutor };
    });

    it("should handle vacuum", async () => {
        mockExecutor.setNextResult({ rows: [], rowCount: 1 });

        await pgAdminHandler({
            action: "vacuum",
            target: "users",
            options: { analyze: true }
        }, context);

        expect(mockExecutor.executedQueries[0].sql).toContain('VACUUM (ANALYZE) "users"');
    });

    it("should handle analyze", async () => {
        mockExecutor.setNextResult({ rows: [], rowCount: 1 });

        await pgAdminHandler({
            action: "analyze",
            target: "users",
            options: { verbose: true }
        } as any, context);

        expect(mockExecutor.executedQueries[0].sql).toContain('ANALYZE VERBOSE "users"');
    });

    it("should handle reindex", async () => {
        mockExecutor.setNextResult({ rows: [], rowCount: 1 });

        await pgAdminHandler({
            action: "reindex",
            target: "users"
        } as any, context);

        expect(mockExecutor.executedQueries[0].sql).toContain('REINDEX TABLE "users"');
    });

    it("should handle stats", async () => {
        mockExecutor.setNextResult({ rows: [{ table_name: "users", size: "10MB" }], rowCount: 1 });

        const result = await pgAdminHandler({
            action: "stats",
            target: "users"
        } as any, context);

        expect(result.rows[0].table_name).toBe("users");
        expect(mockExecutor.executedQueries[0].sql).toContain("pg_stat_user_tables");
    });
});
