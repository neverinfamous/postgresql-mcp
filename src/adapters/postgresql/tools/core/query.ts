/**
 * PostgreSQL Core Tools - Query Operations
 * 
 * Read and write query tools.
 */

import type { PostgresAdapter } from '../../PostgresAdapter.js';
import type { ToolDefinition, RequestContext } from '../../../../types/index.js';
import { readOnly, write } from '../../../../utils/annotations.js';
import { getToolIcons } from '../../../../utils/icons.js';
import { ReadQuerySchema, WriteQuerySchema } from '../../schemas/index.js';

/**
 * Execute a read-only SQL query
 */
export function createReadQueryTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_read_query',
        description: 'Execute a read-only SQL query (SELECT, WITH). Returns rows as JSON. Pass transactionId to execute within a transaction.',
        group: 'core',
        inputSchema: ReadQuerySchema,
        annotations: readOnly('Read Query'),
        icons: getToolIcons('core', readOnly('Read Query')),
        handler: async (params: unknown, _context: RequestContext) => {
            const { sql, params: queryParams, transactionId } = ReadQuerySchema.parse(params);

            let result;
            if (transactionId !== undefined) {
                const client = adapter.getTransactionConnection(transactionId);
                if (!client) {
                    throw new Error(`Invalid or expired transactionId: ${transactionId}. Use pg_transaction_begin to start a new transaction.`);
                }
                result = await adapter.executeOnConnection(client, sql, queryParams);
            } else {
                result = await adapter.executeReadQuery(sql, queryParams);
            }

            return {
                rows: result.rows,
                rowCount: result.rows?.length ?? 0,
                executionTimeMs: result.executionTimeMs
            };
        }
    };
}

/**
 * Execute a write SQL query
 */
export function createWriteQueryTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_write_query',
        description: 'Execute a write SQL query (INSERT, UPDATE, DELETE). Returns affected row count. Pass transactionId to execute within a transaction.',
        group: 'core',
        inputSchema: WriteQuerySchema,
        annotations: write('Write Query'),
        icons: getToolIcons('core', write('Write Query')),
        handler: async (params: unknown, _context: RequestContext) => {
            const { sql, params: queryParams, transactionId } = WriteQuerySchema.parse(params);

            let result;
            if (transactionId !== undefined) {
                const client = adapter.getTransactionConnection(transactionId);
                if (!client) {
                    throw new Error(`Invalid or expired transactionId: ${transactionId}. Use pg_transaction_begin to start a new transaction.`);
                }
                result = await adapter.executeOnConnection(client, sql, queryParams);
            } else {
                result = await adapter.executeWriteQuery(sql, queryParams);
            }

            // Detect SELECT usage and add guidance
            const isSelect = sql.trim().toUpperCase().startsWith('SELECT');

            return {
                rowsAffected: result.rowsAffected,
                rowCount: result.rowsAffected,  // Alias for consistency
                command: result.command,
                executionTimeMs: result.executionTimeMs,
                // Include returned rows when using RETURNING clause
                ...(result.rows && result.rows.length > 0 && { rows: result.rows }),
                // Add hint if SELECT was used
                ...(isSelect && { hint: 'Use pg_read_query for SELECT statements' })
            };
        }
    };
}
