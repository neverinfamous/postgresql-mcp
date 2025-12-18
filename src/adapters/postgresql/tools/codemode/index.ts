/**
 * postgres-mcp - Code Mode Tool: pg_execute_code
 * 
 * MCP tool that executes LLM-generated code in a sandboxed environment
 * with access to all 194 PostgreSQL tools via the pg.* API.
 */

import { z } from 'zod';
import type { PostgresAdapter } from '../../PostgresAdapter.js';
import type { ToolDefinition } from '../../../../types/index.js';
import {
    createSandboxPool,
    type ISandboxPool,
    type SandboxMode
} from '../../../../codemode/sandbox-factory.js';
import { CodeModeSecurityManager } from '../../../../codemode/security.js';
import { createPgApi } from '../../../../codemode/api.js';
import type { ExecuteCodeOptions } from '../../../../codemode/types.js';
import { getToolIcons } from '../../../../utils/icons.js';

// Schema for pg_execute_code input
export const ExecuteCodeSchema = z.object({
    code: z.string().describe('TypeScript/JavaScript code to execute. Use pg.{group}.{method}() for database operations.'),
    timeout: z.number().optional().describe('Execution timeout in milliseconds (max 30000, default 30000)'),
    readonly: z.boolean().optional().describe('If true, restricts to read-only operations')
});

// Singleton instances (initialized on first use)
let sandboxPool: ISandboxPool | null = null;
let securityManager: CodeModeSecurityManager | null = null;

/**
 * Get isolation mode from environment variable
 */
function getIsolationMode(): SandboxMode {
    const envMode = process.env['CODEMODE_ISOLATION'];
    if (envMode === 'worker') return 'worker';
    return 'vm'; // Default
}

/**
 * Initialize Code Mode infrastructure
 */
function ensureInitialized(): { pool: ISandboxPool; security: CodeModeSecurityManager } {
    sandboxPool ??= createSandboxPool(getIsolationMode());
    sandboxPool.initialize();
    securityManager ??= new CodeModeSecurityManager();
    return { pool: sandboxPool, security: securityManager };
}

/**
 * Create the pg_execute_code tool
 */
export function createExecuteCodeTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_execute_code',
        description: `Execute TypeScript/JavaScript code in a sandboxed environment with access to all PostgreSQL tools via the pg.* API.

Available API groups:
- pg.core: Basic CRUD, tables, indexes (13 methods)
- pg.transactions: BEGIN, COMMIT, ROLLBACK, savepoints (7 methods)
- pg.jsonb: JSONB operations and queries (19 methods)
- pg.text: Full-text search, fuzzy matching (11 methods)
- pg.performance: EXPLAIN, stats, optimization (16 methods)
- pg.admin: VACUUM, ANALYZE, REINDEX (10 methods)
- pg.monitoring: Sizes, connections, status (11 methods)
- pg.backup: pg_dump, COPY, restore (9 methods)
- pg.schema: Schemas, views, functions (10 methods)
- pg.vector: pgvector operations (14 methods)
- pg.postgis: PostGIS operations (12 methods)
- pg.partitioning: Partition management (6 methods)
- pg.stats: Statistical analysis (8 methods)
- pg.cron: pg_cron scheduling (8 methods)
- pg.partman: pg_partman lifecycle (10 methods)
- pg.kcache: pg_stat_kcache stats (7 methods)
- pg.citext: Case-insensitive text (6 methods)
- pg.ltree: Hierarchical data (8 methods)
- pg.pgcrypto: Cryptographic functions (9 methods)

Example:
\`\`\`javascript
const tables = await pg.core.listTables();
const results = [];
for (const t of tables) {
    const stats = await pg.performance.tableStats({ table: t.name });
    results.push({ table: t.name, rows: stats.row_count });
}
return results;
\`\`\``,
        group: 'codemode',
        tags: ['code', 'execute', 'sandbox', 'script', 'batch'],
        inputSchema: ExecuteCodeSchema,
        requiredScopes: ['admin'],
        annotations: {
            title: 'Execute Code',
            readOnlyHint: false,
            destructiveHint: true,  // Can perform any operation
            idempotentHint: false,
            openWorldHint: false
        },
        icons: getToolIcons('codemode', { destructiveHint: true }),
        handler: async (params: unknown) => {
            const { code, readonly } = params as ExecuteCodeOptions;

            // Initialize infrastructure
            const { pool, security } = ensureInitialized();

            // Validate code
            const validation = security.validateCode(code);
            if (!validation.valid) {
                return {
                    success: false,
                    error: `Code validation failed: ${validation.errors.join('; ')}`,
                    metrics: { wallTimeMs: 0, cpuTimeMs: 0, memoryUsedMb: 0 }
                };
            }

            // Check rate limit
            const clientId = 'default'; // Could be extracted from context in future
            if (!security.checkRateLimit(clientId)) {
                return {
                    success: false,
                    error: 'Rate limit exceeded. Please wait before executing more code.',
                    metrics: { wallTimeMs: 0, cpuTimeMs: 0, memoryUsedMb: 0 }
                };
            }

            // Create pg API bindings
            const pgApi = createPgApi(adapter);
            const bindings = pgApi.createSandboxBindings();

            // Execute in sandbox
            const result = await pool.execute(code, bindings);

            // Sanitize result
            if (result.success && result.result !== undefined) {
                result.result = security.sanitizeResult(result.result);
            }

            // Audit log
            const record = security.createExecutionRecord(code, result, readonly ?? false, clientId);
            security.auditLog(record);

            return result;
        }
    };
}

/**
 * Get all Code Mode tools
 */
export function getCodeModeTools(adapter: PostgresAdapter): ToolDefinition[] {
    return [
        createExecuteCodeTool(adapter)
    ];
}

/**
 * Cleanup Code Mode resources (call on server shutdown)
 */
export function cleanupCodeMode(): void {
    if (sandboxPool) {
        sandboxPool.dispose();
        sandboxPool = null;
    }
}
