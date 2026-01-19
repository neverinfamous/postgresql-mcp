import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import express from "express";

export async function setupHttpTransport(server: McpServer, port: number) {
    const app = express();

    // June 2025 Spec Update: Streamable HTTP / SSE transition
    // Note: SDK might still call it SSE transport in some versions, 
    // but the underlying protocol is evolving towards Streamable HTTP.

    let transport: SSEServerTransport | null = null;

    app.get("/sse", async (req, res) => {
        transport = new SSEServerTransport("/message", res);
        await server.connect(transport);
    });

    app.post("/message", async (req, res) => {
        if (transport) {
            await transport.handlePostMessage(req, res);
        }
    });

    app.listen(port, () => {
        console.error(`PostgreSQL MCP HTTP Server running on port ${port}`);
        console.error(`SSE endpoint: http://localhost:${port}/sse`);
        console.error(`Message endpoint: http://localhost:${port}/message`);
    });
}
