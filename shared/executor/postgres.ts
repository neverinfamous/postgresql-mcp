import pg from "pg";
import { QueryExecutor, QueryResult, QueryOptions } from "./interface.js";

export class PostgresSessionExecutor implements QueryExecutor {
    constructor(private client: pg.PoolClient) { }

    async execute(sql: string, params?: unknown[], options?: QueryOptions): Promise<QueryResult> {
        if (options?.timeout_ms) {
            await this.client.query(`SET statement_timeout = ${options.timeout_ms}`);
        }

        try {
            const result = await this.client.query(sql, params);
            return {
                rows: result.rows,
                rowCount: result.rowCount ?? undefined,
                fields: result.fields.map(f => ({ name: f.name, dataTypeID: f.dataTypeID }))
            };
        } finally {
            if (options?.timeout_ms) {
                await this.client.query("SET statement_timeout = 0").catch(() => { });
            }
        }
    }

    async disconnect(): Promise<void> {
        this.client.release();
    }

    async createSession(): Promise<QueryExecutor> {
        return this; // Already in a session
    }
}

export class PostgresExecutor implements QueryExecutor {
    private pool: pg.Pool;

    constructor(config: pg.PoolConfig) {
        this.pool = new pg.Pool(config);
    }

    async execute(sql: string, params?: unknown[], options?: QueryOptions): Promise<QueryResult> {
        const client = await this.pool.connect();
        const session = new PostgresSessionExecutor(client);
        try {
            return await session.execute(sql, params, options);
        } finally {
            await session.disconnect();
        }
    }

    async disconnect(): Promise<void> {
        await this.pool.end();
    }

    async createSession(): Promise<QueryExecutor> {
        const client = await this.pool.connect();
        return new PostgresSessionExecutor(client);
    }
}
