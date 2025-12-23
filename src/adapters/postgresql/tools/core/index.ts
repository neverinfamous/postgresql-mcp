/**
 * PostgreSQL Core Database Tools
 * 
 * Fundamental database operations: read, write, table management, indexes, and convenience utilities.
 * 19 tools total.
 */

import type { PostgresAdapter } from '../../PostgresAdapter.js';
import type { ToolDefinition } from '../../../../types/index.js';

// Import from sub-modules
import { createReadQueryTool, createWriteQueryTool } from './query.js';
import { createListTablesTool, createDescribeTableTool, createCreateTableTool, createDropTableTool } from './tables.js';
import { createGetIndexesTool, createCreateIndexTool, createDropIndexTool } from './indexes.js';
import { createListObjectsTool, createObjectDetailsTool } from './objects.js';
import { createAnalyzeDbHealthTool, createAnalyzeWorkloadIndexesTool, createAnalyzeQueryIndexesTool } from './health.js';
import { getConvenienceTools } from './convenience.js';

// Re-export schemas from core tools (moved to schemas dir)
export { ListObjectsSchema, ObjectDetailsSchema, AnalyzeDbHealthSchema, AnalyzeWorkloadIndexesSchema, AnalyzeQueryIndexesSchema } from './schemas.js';
export { UpsertSchema, BatchInsertSchema, CountSchema, ExistsSchema, TruncateSchema } from './convenience.js';

/**
 * Get all core database tools
 */
export function getCoreTools(adapter: PostgresAdapter): ToolDefinition[] {
    return [
        createReadQueryTool(adapter),
        createWriteQueryTool(adapter),
        createListTablesTool(adapter),
        createDescribeTableTool(adapter),
        createCreateTableTool(adapter),
        createDropTableTool(adapter),
        createGetIndexesTool(adapter),
        createCreateIndexTool(adapter),
        createDropIndexTool(adapter),
        createListObjectsTool(adapter),
        createObjectDetailsTool(adapter),
        createAnalyzeDbHealthTool(adapter),
        createAnalyzeWorkloadIndexesTool(adapter),
        createAnalyzeQueryIndexesTool(adapter),
        ...getConvenienceTools(adapter)
    ];
}


