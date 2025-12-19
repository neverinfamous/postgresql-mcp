/**
 * postgres-mcp - Transaction Tools Unit Tests
 * 
 * Tests for PostgreSQL transaction tools with focus on
 * BEGIN, COMMIT, ROLLBACK, and savepoint operations.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getTransactionTools } from '../transactions.js';
import type { PostgresAdapter } from '../../PostgresAdapter.js';
import {
    createMockPostgresAdapter,
    createMockPostgresAdapterWithTransaction,
    createMockRequestContext
} from '../../../../__tests__/mocks/index.js';

describe('getTransactionTools', () => {
    let adapter: PostgresAdapter;
    let tools: ReturnType<typeof getTransactionTools>;

    beforeEach(() => {
        vi.clearAllMocks();
        adapter = createMockPostgresAdapter() as unknown as PostgresAdapter;
        tools = getTransactionTools(adapter);
    });

    it('should return 7 transaction tools', () => {
        expect(tools).toHaveLength(7);
    });

    it('should have all expected tool names', () => {
        const toolNames = tools.map(t => t.name);
        expect(toolNames).toContain('pg_transaction_begin');
        expect(toolNames).toContain('pg_transaction_commit');
        expect(toolNames).toContain('pg_transaction_rollback');
        expect(toolNames).toContain('pg_transaction_savepoint');
        expect(toolNames).toContain('pg_transaction_release');
        expect(toolNames).toContain('pg_transaction_rollback_to');
        expect(toolNames).toContain('pg_transaction_execute');
    });

    it('should have group set to transactions for all tools', () => {
        for (const tool of tools) {
            expect(tool.group).toBe('transactions');
        }
    });

    it('should have handler function for all tools', () => {
        for (const tool of tools) {
            expect(typeof tool.handler).toBe('function');
        }
    });
});

describe('Tool Annotations', () => {
    let tools: ReturnType<typeof getTransactionTools>;

    beforeEach(() => {
        tools = getTransactionTools(createMockPostgresAdapter() as unknown as PostgresAdapter);
    });

    it('all transaction tools should be write operations', () => {
        for (const tool of tools) {
            expect(tool.annotations?.readOnlyHint).toBe(false);
        }
    });
});

describe('pg_transaction_begin', () => {
    let mockAdapter: ReturnType<typeof createMockPostgresAdapter>;
    let tools: ReturnType<typeof getTransactionTools>;
    let mockContext: ReturnType<typeof createMockRequestContext>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockAdapter = createMockPostgresAdapter();
        tools = getTransactionTools(mockAdapter as unknown as PostgresAdapter);
        mockContext = createMockRequestContext();
    });

    it('should begin a transaction and return transaction ID', async () => {
        (mockAdapter.beginTransaction as ReturnType<typeof vi.fn>).mockResolvedValueOnce('txn-12345');

        const tool = tools.find(t => t.name === 'pg_transaction_begin')!;
        const result = await tool.handler({}, mockContext) as {
            transactionId: string;
            isolationLevel: string;
        };

        expect(mockAdapter.beginTransaction).toHaveBeenCalled();
        expect(result.transactionId).toBe('txn-12345');
        expect(result.isolationLevel).toBe('READ COMMITTED');
    });

    it('should accept isolation level parameter', async () => {
        (mockAdapter.beginTransaction as ReturnType<typeof vi.fn>).mockResolvedValueOnce('txn-12345');

        const tool = tools.find(t => t.name === 'pg_transaction_begin')!;
        const result = await tool.handler({ isolationLevel: 'SERIALIZABLE' }, mockContext) as {
            isolationLevel: string;
        };

        expect(mockAdapter.beginTransaction).toHaveBeenCalledWith('SERIALIZABLE');
        expect(result.isolationLevel).toBe('SERIALIZABLE');
    });
});

describe('pg_transaction_commit', () => {
    let mockAdapter: ReturnType<typeof createMockPostgresAdapter>;
    let tools: ReturnType<typeof getTransactionTools>;
    let mockContext: ReturnType<typeof createMockRequestContext>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockAdapter = createMockPostgresAdapter();
        tools = getTransactionTools(mockAdapter as unknown as PostgresAdapter);
        mockContext = createMockRequestContext();
    });

    it('should commit a transaction', async () => {
        const tool = tools.find(t => t.name === 'pg_transaction_commit')!;
        const result = await tool.handler({ transactionId: 'txn-12345' }, mockContext) as {
            success: boolean;
            transactionId: string;
        };

        expect(mockAdapter.commitTransaction).toHaveBeenCalledWith('txn-12345');
        expect(result.success).toBe(true);
        expect(result.transactionId).toBe('txn-12345');
    });
});

describe('pg_transaction_rollback', () => {
    let mockAdapter: ReturnType<typeof createMockPostgresAdapter>;
    let tools: ReturnType<typeof getTransactionTools>;
    let mockContext: ReturnType<typeof createMockRequestContext>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockAdapter = createMockPostgresAdapter();
        tools = getTransactionTools(mockAdapter as unknown as PostgresAdapter);
        mockContext = createMockRequestContext();
    });

    it('should rollback a transaction', async () => {
        const tool = tools.find(t => t.name === 'pg_transaction_rollback')!;
        const result = await tool.handler({ transactionId: 'txn-12345' }, mockContext) as {
            success: boolean;
            transactionId: string;
        };

        expect(mockAdapter.rollbackTransaction).toHaveBeenCalledWith('txn-12345');
        expect(result.success).toBe(true);
        expect(result.transactionId).toBe('txn-12345');
    });
});

describe('pg_transaction_savepoint', () => {
    let mockAdapter: ReturnType<typeof createMockPostgresAdapter>;
    let tools: ReturnType<typeof getTransactionTools>;
    let mockContext: ReturnType<typeof createMockRequestContext>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockAdapter = createMockPostgresAdapter();
        tools = getTransactionTools(mockAdapter as unknown as PostgresAdapter);
        mockContext = createMockRequestContext();
    });

    it('should create a savepoint', async () => {
        const tool = tools.find(t => t.name === 'pg_transaction_savepoint')!;
        const result = await tool.handler({
            transactionId: 'txn-12345',
            name: 'my_savepoint'
        }, mockContext) as {
            success: boolean;
            savepoint: string;
        };

        expect(mockAdapter.createSavepoint).toHaveBeenCalledWith('txn-12345', 'my_savepoint');
        expect(result.success).toBe(true);
        expect(result.savepoint).toBe('my_savepoint');
    });
});

describe('pg_transaction_release', () => {
    let mockAdapter: ReturnType<typeof createMockPostgresAdapter>;
    let tools: ReturnType<typeof getTransactionTools>;
    let mockContext: ReturnType<typeof createMockRequestContext>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockAdapter = createMockPostgresAdapter();
        tools = getTransactionTools(mockAdapter as unknown as PostgresAdapter);
        mockContext = createMockRequestContext();
    });

    it('should release a savepoint', async () => {
        const tool = tools.find(t => t.name === 'pg_transaction_release')!;
        const result = await tool.handler({
            transactionId: 'txn-12345',
            name: 'my_savepoint'
        }, mockContext) as {
            success: boolean;
            savepoint: string;
        };

        expect(mockAdapter.releaseSavepoint).toHaveBeenCalledWith('txn-12345', 'my_savepoint');
        expect(result.success).toBe(true);
        expect(result.savepoint).toBe('my_savepoint');
    });
});

describe('pg_transaction_rollback_to', () => {
    let mockAdapter: ReturnType<typeof createMockPostgresAdapter>;
    let tools: ReturnType<typeof getTransactionTools>;
    let mockContext: ReturnType<typeof createMockRequestContext>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockAdapter = createMockPostgresAdapter();
        tools = getTransactionTools(mockAdapter as unknown as PostgresAdapter);
        mockContext = createMockRequestContext();
    });

    it('should rollback to a savepoint', async () => {
        const tool = tools.find(t => t.name === 'pg_transaction_rollback_to')!;
        const result = await tool.handler({
            transactionId: 'txn-12345',
            name: 'my_savepoint'
        }, mockContext) as {
            success: boolean;
            savepoint: string;
        };

        expect(mockAdapter.rollbackToSavepoint).toHaveBeenCalledWith('txn-12345', 'my_savepoint');
        expect(result.success).toBe(true);
        expect(result.savepoint).toBe('my_savepoint');
    });
});

describe('pg_transaction_execute', () => {
    let mockContext: ReturnType<typeof createMockRequestContext>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockContext = createMockRequestContext();
    });

    it('should execute multiple statements atomically', async () => {
        const mockAdapterWithTxn = createMockPostgresAdapterWithTransaction();
        mockAdapterWithTxn.mockConnection.query.mockResolvedValue({ rows: [], rowCount: 1 });

        // Mock executeOnConnection
        (mockAdapterWithTxn as unknown as { executeOnConnection: typeof vi.fn }).executeOnConnection = vi.fn()
            .mockResolvedValue({ rows: [], rowsAffected: 1 });

        const tools = getTransactionTools(mockAdapterWithTxn as unknown as PostgresAdapter);
        const tool = tools.find(t => t.name === 'pg_transaction_execute')!;

        const result = await tool.handler({
            statements: [
                { sql: 'INSERT INTO users (name) VALUES ($1)', params: ['Alice'] },
                { sql: 'INSERT INTO users (name) VALUES ($1)', params: ['Bob'] }
            ]
        }, mockContext) as {
            success: boolean;
            statementsExecuted: number;
        };

        expect(mockAdapterWithTxn.beginTransaction).toHaveBeenCalled();
        expect(result.success).toBe(true);
        expect(result.statementsExecuted).toBe(2);
        expect(mockAdapterWithTxn.commitTransaction).toHaveBeenCalled();
    });

    it('should rollback on error', async () => {
        const mockAdapterWithTxn = createMockPostgresAdapterWithTransaction();

        // Mock executeOnConnection to fail on second call
        (mockAdapterWithTxn as unknown as { executeOnConnection: typeof vi.fn }).executeOnConnection = vi.fn()
            .mockResolvedValueOnce({ rows: [], rowsAffected: 1 })
            .mockRejectedValueOnce(new Error('Constraint violation'));

        const tools = getTransactionTools(mockAdapterWithTxn as unknown as PostgresAdapter);
        const tool = tools.find(t => t.name === 'pg_transaction_execute')!;

        await expect(tool.handler({
            statements: [
                { sql: 'INSERT INTO users (name) VALUES ($1)', params: ['Alice'] },
                { sql: 'INSERT INTO users (name) VALUES ($1)', params: ['Bob'] }
            ]
        }, mockContext)).rejects.toThrow('Constraint violation');

        expect(mockAdapterWithTxn.rollbackTransaction).toHaveBeenCalled();
    });
});
