import { describe, it, expect, beforeEach } from "vitest";
import { pgSchemaHandler } from "../../src/tools/pg-schema.js";
import { MockExecutor } from "../executor/mock.js";

describe("pg_schema", () => {
    let mockExecutor: MockExecutor;
    let context: any;

    beforeEach(() => {
        mockExecutor = new MockExecutor();
        context = { executor: mockExecutor };
    });

    it("should handle list tables", async () => {
        const mockResult = { rows: [{ name: "users" }], rowCount: 1 };
        mockExecutor.setNextResult(mockResult);

        const result = await pgSchemaHandler({
            action: "list",
            target: "table",
            schema: "public"
        }, context);

        expect(result).toEqual(mockResult);
        expect(mockExecutor.executedQueries[0].sql).toContain("FROM pg_tables");
        expect(mockExecutor.executedQueries[0].params).toContain("public");
    });

    it("should handle list tables with pagination", async () => {
        mockExecutor.setNextResult({ rows: [], rowCount: 0 });

        await pgSchemaHandler({
            action: "list",
            target: "table",
            schema: "public",
            options: { limit: 10, offset: 20 }
        } as any, context);

        expect(mockExecutor.executedQueries[0].sql).toContain("LIMIT 10 OFFSET 20");
    });

    it("should handle list views", async () => {
        mockExecutor.setNextResult({ rows: [], rowCount: 0 });

        await pgSchemaHandler({
            action: "list",
            target: "view",
            schema: "public"
        }, context);

        expect(mockExecutor.executedQueries[0].sql).toContain("FROM pg_class c");
        expect(mockExecutor.executedQueries[0].sql).toContain("c.relkind");
    });

    it("should handle describe table", async () => {
        mockExecutor.setNextResult({ rows: [{ name: "id", type: "integer" }], rowCount: 1 });
        mockExecutor.setNextResult({ rows: [{ name: "idx_id" }], rowCount: 1 });

        const result = await pgSchemaHandler({
            action: "describe",
            target: "table",
            name: "users"
        }, context);

        expect(result.name).toBe("users");
        expect(result.columns[0].name).toBe("id");
        expect(result.indexes[0].name).toBe("idx_id");
    });

    it("should handle create table", async () => {
        mockExecutor.setNextResult({ rows: [], rowCount: 1 });

        await pgSchemaHandler({
            action: "create",
            target: "table",
            name: "new_table",
            schema: "public",
            definition: "id serial primary key, name text"
        }, context);

        expect(mockExecutor.executedQueries[0].sql).toContain("CREATE TABLE public.new_table");
        expect(mockExecutor.executedQueries[0].sql).toContain("(id serial primary key, name text)");
    });

    it("should handle alter table", async () => {
        mockExecutor.setNextResult({ rows: [], rowCount: 1 });

        await pgSchemaHandler({
            action: "alter",
            target: "table",
            name: "users",
            definition: "ADD COLUMN age integer"
        }, context);

        expect(mockExecutor.executedQueries[0].sql).toContain("ALTER TABLE users ADD COLUMN age integer");
    });

    it("should handle drop table with cascade", async () => {
        mockExecutor.setNextResult({ rows: [], rowCount: 1 });

        await pgSchemaHandler({
            action: "drop",
            target: "table",
            name: "users",
            options: { cascade: true }
        }, context);

        expect(mockExecutor.executedQueries[0].sql).toContain("DROP TABLE users CASCADE");
    });
});
