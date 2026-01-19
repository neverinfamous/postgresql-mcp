import { QueryExecutor, QueryResult, QueryOptions } from "../../../../shared/executor/interface.js";

export class MockExecutor implements QueryExecutor {
    public executedQueries: { sql: string; params?: unknown[]; options?: QueryOptions }[] = [];
    private nextResults: QueryResult[] = [];

    public setNextResult(result: QueryResult) {
        this.nextResults.push(result);
    }

    async execute(sql: string, params?: unknown[], options?: QueryOptions): Promise<QueryResult> {
        this.executedQueries.push({ sql, params, options });
        const result = this.nextResults.shift();
        if (!result) {
            return { rows: [], rowCount: 0 };
        }
        return result;
    }

    async disconnect(): Promise<void> {
        // No-op
    }

    async createSession(): Promise<QueryExecutor> {
        return this; // In mock, we just return ourselves for simplicity unless we need isolated sessions
    }
}
