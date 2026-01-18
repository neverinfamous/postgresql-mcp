/**
 * postgres-mcp - PostgreSQL MCP Server
 *
 * Full-featured PostgreSQL database tools for AI assistants.
 *
 * @module postgres-mcp
 */

// Export types
export * from "./types/index.js";

// Export adapters
export { DatabaseAdapter } from "./adapters/DatabaseAdapter.js";
export { PostgresAdapter } from "./adapters/postgresql/index.js";

// Export server
export { PostgresMcpServer } from "./server/McpServer.js";

// Export utilities
export { ConnectionPool } from "./pool/ConnectionPool.js";
export {
  parseToolFilter,
  filterTools,
  getToolFilterFromEnv,
  TOOL_GROUPS,
  getAllToolNames,
  getToolGroup,
} from "./filtering/ToolFilter.js";
export { logger } from "./utils/logger.js";
