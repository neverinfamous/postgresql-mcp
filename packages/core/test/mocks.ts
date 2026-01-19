import { QueryExecutor, QueryResult, QueryOptions } from "@pg-mcp/shared/executor/interface.js";

export class MockExecutor implements QueryExecutor {
    async execute(sql: string, params?: unknown[], options?: QueryOptions): Promise<QueryResult> {
        return {
            rows: [{ sql, params, options }],
            rowCount: 1,
            fields: []
        };
    }
    async disconnect(): Promise<void> { }
    async createSession(): Promise<QueryExecutor> {
        return this;
    }
}
