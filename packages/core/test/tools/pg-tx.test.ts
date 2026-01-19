import { describe, it, expect, beforeEach } from "vitest";
import { pgTxHandler } from "../../src/tools/pg-tx.js";
import { MockExecutor } from "../executor/mock.js";

describe("pg_tx", () => {
    let mockExecutor: MockExecutor;
    let context: any;

    beforeEach(() => {
        mockExecutor = new MockExecutor();
        context = { executor: mockExecutor };
    });

    it("should handle begin", async () => {
        mockExecutor.setNextResult({ rows: [], rowCount: 1 });

        await pgTxHandler({
            action: "begin",
            options: { isolation_level: "serializable" }
        }, context);

        expect(mockExecutor.executedQueries[0].sql).toBe("BEGIN ISOLATION LEVEL SERIALIZABLE");
    });

    it("should handle commit", async () => {
        mockExecutor.setNextResult({ rows: [], rowCount: 1 });

        await pgTxHandler({
            action: "commit"
        }, context);

        expect(mockExecutor.executedQueries[0].sql).toBe("COMMIT");
    });

    it("should handle rollback", async () => {
        mockExecutor.setNextResult({ rows: [], rowCount: 1 });

        await pgTxHandler({
            action: "rollback"
        }, context);

        expect(mockExecutor.executedQueries[0].sql).toBe("ROLLBACK");
    });

    it("should handle savepoint", async () => {
        mockExecutor.setNextResult({ rows: [], rowCount: 1 });

        await pgTxHandler({
            action: "savepoint",
            name: "sp1"
        }, context);

        expect(mockExecutor.executedQueries[0].sql).toBe('SAVEPOINT "sp1"');
    });
});
