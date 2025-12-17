/**
 * PostgreSQL Transaction Tools
 * 
 * Transaction management with savepoints and isolation levels.
 * 7 tools total.
 */

import type { PostgresAdapter } from '../PostgresAdapter.js';
import type { ToolDefinition, RequestContext } from '../../../types/index.js';
import { write } from '../../../utils/annotations.js';
import {
    BeginTransactionSchema,
    TransactionIdSchema,
    SavepointSchema,
    TransactionExecuteSchema
} from '../types.js';

/**
 * Get all transaction tools
 */
export function getTransactionTools(adapter: PostgresAdapter): ToolDefinition[] {
    return [
        createBeginTransactionTool(adapter),
        createCommitTransactionTool(adapter),
        createRollbackTransactionTool(adapter),
        createSavepointTool(adapter),
        createReleaseSavepointTool(adapter),
        createRollbackToSavepointTool(adapter),
        createTransactionExecuteTool(adapter)
    ];
}

function createBeginTransactionTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_transaction_begin',
        description: 'Begin a new transaction. Returns a transaction ID for subsequent operations.',
        group: 'transactions',
        inputSchema: BeginTransactionSchema,
        annotations: write('Begin Transaction'),
        handler: async (params: unknown, _context: RequestContext) => {
            const { isolationLevel } = BeginTransactionSchema.parse(params);
            const transactionId = await adapter.beginTransaction(isolationLevel);
            return {
                transactionId,
                isolationLevel: isolationLevel ?? 'READ COMMITTED',
                message: 'Transaction started. Use this ID for subsequent operations.'
            };
        }
    };
}

function createCommitTransactionTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_transaction_commit',
        description: 'Commit a transaction, making all changes permanent.',
        group: 'transactions',
        inputSchema: TransactionIdSchema,
        annotations: write('Commit Transaction'),
        handler: async (params: unknown, _context: RequestContext) => {
            const { transactionId } = TransactionIdSchema.parse(params);
            await adapter.commitTransaction(transactionId);
            return {
                success: true,
                transactionId,
                message: 'Transaction committed successfully.'
            };
        }
    };
}

function createRollbackTransactionTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_transaction_rollback',
        description: 'Rollback a transaction, undoing all changes.',
        group: 'transactions',
        inputSchema: TransactionIdSchema,
        annotations: write('Rollback Transaction'),
        handler: async (params: unknown, _context: RequestContext) => {
            const { transactionId } = TransactionIdSchema.parse(params);
            await adapter.rollbackTransaction(transactionId);
            return {
                success: true,
                transactionId,
                message: 'Transaction rolled back successfully.'
            };
        }
    };
}

function createSavepointTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_transaction_savepoint',
        description: 'Create a savepoint within a transaction for partial rollback.',
        group: 'transactions',
        inputSchema: SavepointSchema,
        annotations: write('Create Savepoint'),
        handler: async (params: unknown, _context: RequestContext) => {
            const { transactionId, name } = SavepointSchema.parse(params);
            await adapter.createSavepoint(transactionId, name);
            return {
                success: true,
                transactionId,
                savepoint: name,
                message: `Savepoint '${name}' created.`
            };
        }
    };
}

function createReleaseSavepointTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_transaction_release',
        description: 'Release a savepoint, keeping all changes since it was created.',
        group: 'transactions',
        inputSchema: SavepointSchema,
        annotations: write('Release Savepoint'),
        handler: async (params: unknown, _context: RequestContext) => {
            const { transactionId, name } = SavepointSchema.parse(params);
            await adapter.releaseSavepoint(transactionId, name);
            return {
                success: true,
                transactionId,
                savepoint: name,
                message: `Savepoint '${name}' released.`
            };
        }
    };
}

function createRollbackToSavepointTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_transaction_rollback_to',
        description: 'Rollback to a savepoint, undoing changes made after it.',
        group: 'transactions',
        inputSchema: SavepointSchema,
        annotations: write('Rollback to Savepoint'),
        handler: async (params: unknown, _context: RequestContext) => {
            const { transactionId, name } = SavepointSchema.parse(params);
            await adapter.rollbackToSavepoint(transactionId, name);
            return {
                success: true,
                transactionId,
                savepoint: name,
                message: `Rolled back to savepoint '${name}'.`
            };
        }
    };
}

function createTransactionExecuteTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_transaction_execute',
        description: 'Execute multiple statements atomically in a single transaction.',
        group: 'transactions',
        inputSchema: TransactionExecuteSchema,
        annotations: write('Transaction Execute'),
        handler: async (params: unknown, _context: RequestContext) => {
            const { statements, isolationLevel } = TransactionExecuteSchema.parse(params);

            const transactionId = await adapter.beginTransaction(isolationLevel);
            const results: unknown[] = [];

            try {
                const client = adapter.getTransactionConnection(transactionId);
                if (!client) {
                    throw new Error('Transaction connection lost');
                }

                for (const stmt of statements) {
                    const result = await adapter.executeOnConnection(client, stmt.sql, stmt.params);
                    results.push({
                        sql: stmt.sql,
                        rowsAffected: result.rowsAffected,
                        rows: result.rows?.length
                    });
                }

                await adapter.commitTransaction(transactionId);

                return {
                    success: true,
                    statementsExecuted: statements.length,
                    results
                };
            } catch (error) {
                await adapter.rollbackTransaction(transactionId);
                throw error;
            }
        }
    };
}
