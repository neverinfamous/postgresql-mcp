export interface QueryResult {
    rows: any[];
    rowCount?: number;
    fields?: { name: string; dataTypeID: number }[];
}

export interface QueryOptions {
    timeout_ms?: number;
}

export interface QueryExecutor {
    execute(sql: string, params?: unknown[], options?: QueryOptions): Promise<QueryResult>;
    disconnect(): Promise<void>;
    // Returns an executor that uses a single dedicated connection
    createSession(): Promise<QueryExecutor>;
}
