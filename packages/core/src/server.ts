import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { PostgresExecutor } from "@pg-mcp/shared/executor/postgres.js";
import { pgQueryHandler, PgQuerySchema } from "./tools/pg-query.js";
import { pgSchemaHandler, PgSchemaToolSchema } from "./tools/pg-schema.js";
import { pgAdminHandler, PgAdminToolSchema } from "./tools/pg-admin.js";
import { pgMonitorHandler, PgMonitorToolSchema } from "./tools/pg-monitor.js";
import { pgTxHandler, PgTxToolSchema } from "./tools/pg-tx.js";

const server = new McpServer({
    name: "pg-mcp-core",
    version: "1.0.0",
});

const executor = new PostgresExecutor({
    host: process.env.PGHOST || "localhost",
    port: parseInt(process.env.PGPORT || "5432"),
    user: process.env.PGUSER || "postgres",
    password: process.env.PGPASSWORD || "postgres",
    database: process.env.PGDATABASE || "postgres",
});

const context = { executor };

server.registerTool("pg_query", {
    description: "Execute SQL queries (read, write, explain)",
    inputSchema: PgQuerySchema
}, async (params) => {
    const result = await pgQueryHandler(params, context);
    return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
    };
});

server.registerTool("pg_schema", {
    description: "Manage database structure (list, describe, create, alter, drop)",
    inputSchema: PgSchemaToolSchema
}, async (params) => {
    const result = await pgSchemaHandler(params, context);
    return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
    };
});

server.registerTool("pg_admin", {
    description: "Database maintenance (vacuum, analyze, reindex, stats, settings)",
    inputSchema: PgAdminToolSchema
}, async (params) => {
    const result = await pgAdminHandler(params, context);
    return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
    };
});

server.registerTool("pg_monitor", {
    description: "Database observability (connections, locks, size, activity, health)",
    inputSchema: PgMonitorToolSchema
}, async (params) => {
    const result = await pgMonitorHandler(params, context);
    return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
    };
});

server.registerTool("pg_tx", {
    description: "Transaction control (begin, commit, rollback, savepoint, release)",
    inputSchema: PgTxToolSchema
}, async (params) => {
    const result = await pgTxHandler(params, context);
    return {
        content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
    };
});

import { setupHttpTransport } from "./transports/http.js";

async function main() {
    const transportType = process.argv.includes("--transport")
        ? process.argv[process.argv.indexOf("--transport") + 1]
        : "stdio";

    if (transportType === "sse" || transportType === "http") {
        const port = parseInt(process.env.PORT || "3000");
        await setupHttpTransport(server, port);
    } else {
        const transport = new StdioServerTransport();
        await server.connect(transport);
        console.error("PostgreSQL MCP Server running on stdio");
    }
}

main().catch(console.error);
