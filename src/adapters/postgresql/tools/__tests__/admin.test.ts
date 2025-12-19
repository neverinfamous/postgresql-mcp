/**
 * postgres-mcp - Admin Tools Unit Tests
 * 
 * Tests for PostgreSQL admin tools with focus on
 * VACUUM, ANALYZE, REINDEX, and configuration operations.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getAdminTools } from '../admin.js';
import type { PostgresAdapter } from '../../PostgresAdapter.js';
import {
    createMockPostgresAdapter,
    createMockRequestContext
} from '../../../../__tests__/mocks/index.js';

describe('getAdminTools', () => {
    let adapter: PostgresAdapter;
    let tools: ReturnType<typeof getAdminTools>;

    beforeEach(() => {
        vi.clearAllMocks();
        adapter = createMockPostgresAdapter() as unknown as PostgresAdapter;
        tools = getAdminTools(adapter);
    });

    it('should return 10 admin tools', () => {
        expect(tools).toHaveLength(10);
    });

    it('should have all expected tool names', () => {
        const toolNames = tools.map(t => t.name);
        expect(toolNames).toContain('pg_vacuum');
        expect(toolNames).toContain('pg_vacuum_analyze');
        expect(toolNames).toContain('pg_analyze');
        expect(toolNames).toContain('pg_reindex');
        expect(toolNames).toContain('pg_terminate_backend');
        expect(toolNames).toContain('pg_cancel_backend');
        expect(toolNames).toContain('pg_reload_conf');
        expect(toolNames).toContain('pg_set_config');
        expect(toolNames).toContain('pg_reset_stats');
        expect(toolNames).toContain('pg_cluster');
    });

    it('should have group set to admin for all tools', () => {
        for (const tool of tools) {
            expect(tool.group).toBe('admin');
        }
    });

    it('should have handler function for all tools', () => {
        for (const tool of tools) {
            expect(typeof tool.handler).toBe('function');
        }
    });
});

describe('pg_vacuum', () => {
    let mockAdapter: ReturnType<typeof createMockPostgresAdapter>;
    let tools: ReturnType<typeof getAdminTools>;
    let mockContext: ReturnType<typeof createMockRequestContext>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockAdapter = createMockPostgresAdapter();
        tools = getAdminTools(mockAdapter as unknown as PostgresAdapter);
        mockContext = createMockRequestContext();
    });

    it('should vacuum all tables when no params', async () => {
        mockAdapter.executeQuery.mockResolvedValueOnce({ rows: [] });

        const tool = tools.find(t => t.name === 'pg_vacuum')!;
        const result = await tool.handler({}, mockContext) as {
            success: boolean;
            message: string;
        };

        expect(mockAdapter.executeQuery).toHaveBeenCalledWith('VACUUM ');
        expect(result.success).toBe(true);
        expect(result.message).toContain('completed');
    });

    it('should vacuum specific table', async () => {
        mockAdapter.executeQuery.mockResolvedValueOnce({ rows: [] });

        const tool = tools.find(t => t.name === 'pg_vacuum')!;
        const result = await tool.handler({ table: 'users' }, mockContext) as {
            success: boolean;
        };

        expect(mockAdapter.executeQuery).toHaveBeenCalledWith('VACUUM "users"');
        expect(result.success).toBe(true);
    });

    it('should vacuum with schema qualified table', async () => {
        mockAdapter.executeQuery.mockResolvedValueOnce({ rows: [] });

        const tool = tools.find(t => t.name === 'pg_vacuum')!;
        await tool.handler({ table: 'users', schema: 'public' }, mockContext);

        expect(mockAdapter.executeQuery).toHaveBeenCalledWith('VACUUM "public"."users"');
    });

    it('should run VACUUM FULL when full=true', async () => {
        mockAdapter.executeQuery.mockResolvedValueOnce({ rows: [] });

        const tool = tools.find(t => t.name === 'pg_vacuum')!;
        const result = await tool.handler({ full: true }, mockContext) as {
            success: boolean;
            message: string;
        };

        expect(mockAdapter.executeQuery).toHaveBeenCalledWith('VACUUM FULL ');
        expect(result.message).toContain('FULL');
    });

    it('should run VACUUM VERBOSE when verbose=true', async () => {
        mockAdapter.executeQuery.mockResolvedValueOnce({ rows: [] });

        const tool = tools.find(t => t.name === 'pg_vacuum')!;
        await tool.handler({ verbose: true }, mockContext);

        expect(mockAdapter.executeQuery).toHaveBeenCalledWith('VACUUM VERBOSE ');
    });
});

describe('pg_vacuum_analyze', () => {
    let mockAdapter: ReturnType<typeof createMockPostgresAdapter>;
    let tools: ReturnType<typeof getAdminTools>;
    let mockContext: ReturnType<typeof createMockRequestContext>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockAdapter = createMockPostgresAdapter();
        tools = getAdminTools(mockAdapter as unknown as PostgresAdapter);
        mockContext = createMockRequestContext();
    });

    it('should run VACUUM ANALYZE on all tables', async () => {
        mockAdapter.executeQuery.mockResolvedValueOnce({ rows: [] });

        const tool = tools.find(t => t.name === 'pg_vacuum_analyze')!;
        const result = await tool.handler({}, mockContext) as {
            success: boolean;
            message: string;
        };

        expect(mockAdapter.executeQuery).toHaveBeenCalledWith('VACUUM ANALYZE ');
        expect(result.success).toBe(true);
        expect(result.message).toBe('VACUUM ANALYZE completed');
    });

    it('should run VACUUM ANALYZE on specific table', async () => {
        mockAdapter.executeQuery.mockResolvedValueOnce({ rows: [] });

        const tool = tools.find(t => t.name === 'pg_vacuum_analyze')!;
        await tool.handler({ table: 'orders' }, mockContext);

        expect(mockAdapter.executeQuery).toHaveBeenCalledWith('VACUUM ANALYZE "orders"');
    });

    it('should run VACUUM VERBOSE ANALYZE', async () => {
        mockAdapter.executeQuery.mockResolvedValueOnce({ rows: [] });

        const tool = tools.find(t => t.name === 'pg_vacuum_analyze')!;
        await tool.handler({ verbose: true, table: 'users' }, mockContext);

        expect(mockAdapter.executeQuery).toHaveBeenCalledWith('VACUUM VERBOSE ANALYZE "users"');
    });
});

describe('pg_analyze', () => {
    let mockAdapter: ReturnType<typeof createMockPostgresAdapter>;
    let tools: ReturnType<typeof getAdminTools>;
    let mockContext: ReturnType<typeof createMockRequestContext>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockAdapter = createMockPostgresAdapter();
        tools = getAdminTools(mockAdapter as unknown as PostgresAdapter);
        mockContext = createMockRequestContext();
    });

    it('should analyze all tables', async () => {
        mockAdapter.executeQuery.mockResolvedValueOnce({ rows: [] });

        const tool = tools.find(t => t.name === 'pg_analyze')!;
        const result = await tool.handler({}, mockContext) as {
            success: boolean;
            message: string;
        };

        expect(mockAdapter.executeQuery).toHaveBeenCalledWith('ANALYZE ');
        expect(result.success).toBe(true);
        expect(result.message).toBe('ANALYZE completed');
    });

    it('should analyze specific table', async () => {
        mockAdapter.executeQuery.mockResolvedValueOnce({ rows: [] });

        const tool = tools.find(t => t.name === 'pg_analyze')!;
        await tool.handler({ table: 'products' }, mockContext);

        expect(mockAdapter.executeQuery).toHaveBeenCalledWith('ANALYZE "products"');
    });

    it('should analyze specific columns', async () => {
        mockAdapter.executeQuery.mockResolvedValueOnce({ rows: [] });

        const tool = tools.find(t => t.name === 'pg_analyze')!;
        await tool.handler({ table: 'users', columns: ['email', 'created_at'] }, mockContext);

        expect(mockAdapter.executeQuery).toHaveBeenCalledWith('ANALYZE "users"("email", "created_at")');
    });
});

describe('pg_reindex', () => {
    let mockAdapter: ReturnType<typeof createMockPostgresAdapter>;
    let tools: ReturnType<typeof getAdminTools>;
    let mockContext: ReturnType<typeof createMockRequestContext>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockAdapter = createMockPostgresAdapter();
        tools = getAdminTools(mockAdapter as unknown as PostgresAdapter);
        mockContext = createMockRequestContext();
    });

    it('should reindex a table', async () => {
        mockAdapter.executeQuery.mockResolvedValueOnce({ rows: [] });

        const tool = tools.find(t => t.name === 'pg_reindex')!;
        const result = await tool.handler({ target: 'table', name: 'users' }, mockContext) as {
            success: boolean;
            message: string;
        };

        expect(mockAdapter.executeQuery).toHaveBeenCalledWith('REINDEX TABLE "users"');
        expect(result.success).toBe(true);
        expect(result.message).toBe('Reindexed table: users');
    });

    it('should reindex an index', async () => {
        mockAdapter.executeQuery.mockResolvedValueOnce({ rows: [] });

        const tool = tools.find(t => t.name === 'pg_reindex')!;
        await tool.handler({ target: 'index', name: 'idx_users_email' }, mockContext);

        expect(mockAdapter.executeQuery).toHaveBeenCalledWith('REINDEX INDEX "idx_users_email"');
    });

    it('should reindex concurrently', async () => {
        mockAdapter.executeQuery.mockResolvedValueOnce({ rows: [] });

        const tool = tools.find(t => t.name === 'pg_reindex')!;
        await tool.handler({ target: 'table', name: 'users', concurrently: true }, mockContext);

        expect(mockAdapter.executeQuery).toHaveBeenCalledWith('REINDEX TABLE CONCURRENTLY "users"');
    });
});

describe('pg_terminate_backend', () => {
    let mockAdapter: ReturnType<typeof createMockPostgresAdapter>;
    let tools: ReturnType<typeof getAdminTools>;
    let mockContext: ReturnType<typeof createMockRequestContext>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockAdapter = createMockPostgresAdapter();
        tools = getAdminTools(mockAdapter as unknown as PostgresAdapter);
        mockContext = createMockRequestContext();
    });

    it('should terminate a backend', async () => {
        mockAdapter.executeQuery.mockResolvedValueOnce({
            rows: [{ pg_terminate_backend: true }]
        });

        const tool = tools.find(t => t.name === 'pg_terminate_backend')!;
        const result = await tool.handler({ pid: 12345 }, mockContext) as {
            success: boolean;
            pid: number;
            message: string;
        };

        expect(mockAdapter.executeQuery).toHaveBeenCalledWith('SELECT pg_terminate_backend($1)', [12345]);
        expect(result.success).toBe(true);
        expect(result.pid).toBe(12345);
        expect(result.message).toBe('Backend terminated');
    });

    it('should report failure when backend cannot be terminated', async () => {
        mockAdapter.executeQuery.mockResolvedValueOnce({
            rows: [{ pg_terminate_backend: false }]
        });

        const tool = tools.find(t => t.name === 'pg_terminate_backend')!;
        const result = await tool.handler({ pid: 99999 }, mockContext) as {
            success: boolean;
            message: string;
        };

        expect(result.success).toBe(false);
        expect(result.message).toBe('Failed to terminate');
    });
});

describe('pg_cancel_backend', () => {
    let mockAdapter: ReturnType<typeof createMockPostgresAdapter>;
    let tools: ReturnType<typeof getAdminTools>;
    let mockContext: ReturnType<typeof createMockRequestContext>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockAdapter = createMockPostgresAdapter();
        tools = getAdminTools(mockAdapter as unknown as PostgresAdapter);
        mockContext = createMockRequestContext();
    });

    it('should cancel a backend query', async () => {
        mockAdapter.executeQuery.mockResolvedValueOnce({
            rows: [{ pg_cancel_backend: true }]
        });

        const tool = tools.find(t => t.name === 'pg_cancel_backend')!;
        const result = await tool.handler({ pid: 12345 }, mockContext) as {
            success: boolean;
            pid: number;
            message: string;
        };

        expect(mockAdapter.executeQuery).toHaveBeenCalledWith('SELECT pg_cancel_backend($1)', [12345]);
        expect(result.success).toBe(true);
        expect(result.message).toBe('Query cancelled');
    });

    it('should report failure when query cannot be cancelled', async () => {
        mockAdapter.executeQuery.mockResolvedValueOnce({
            rows: [{ pg_cancel_backend: false }]
        });

        const tool = tools.find(t => t.name === 'pg_cancel_backend')!;
        const result = await tool.handler({ pid: 99999 }, mockContext) as {
            success: boolean;
            message: string;
        };

        expect(result.success).toBe(false);
        expect(result.message).toBe('Failed to cancel');
    });
});

describe('pg_reload_conf', () => {
    let mockAdapter: ReturnType<typeof createMockPostgresAdapter>;
    let tools: ReturnType<typeof getAdminTools>;
    let mockContext: ReturnType<typeof createMockRequestContext>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockAdapter = createMockPostgresAdapter();
        tools = getAdminTools(mockAdapter as unknown as PostgresAdapter);
        mockContext = createMockRequestContext();
    });

    it('should reload configuration', async () => {
        mockAdapter.executeQuery.mockResolvedValueOnce({
            rows: [{ pg_reload_conf: true }]
        });

        const tool = tools.find(t => t.name === 'pg_reload_conf')!;
        const result = await tool.handler({}, mockContext) as {
            success: boolean;
            message: string;
        };

        expect(mockAdapter.executeQuery).toHaveBeenCalledWith('SELECT pg_reload_conf()');
        expect(result.success).toBe(true);
        expect(result.message).toBe('Configuration reloaded');
    });
});

describe('pg_set_config', () => {
    let mockAdapter: ReturnType<typeof createMockPostgresAdapter>;
    let tools: ReturnType<typeof getAdminTools>;
    let mockContext: ReturnType<typeof createMockRequestContext>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockAdapter = createMockPostgresAdapter();
        tools = getAdminTools(mockAdapter as unknown as PostgresAdapter);
        mockContext = createMockRequestContext();
    });

    it('should set a configuration parameter', async () => {
        mockAdapter.executeQuery.mockResolvedValueOnce({
            rows: [{ set_config: '100MB' }]
        });

        const tool = tools.find(t => t.name === 'pg_set_config')!;
        const result = await tool.handler({
            name: 'work_mem',
            value: '100MB'
        }, mockContext) as {
            success: boolean;
            parameter: string;
            value: string;
        };

        expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
            'SELECT set_config($1, $2, $3)',
            ['work_mem', '100MB', false]
        );
        expect(result.success).toBe(true);
        expect(result.parameter).toBe('work_mem');
        expect(result.value).toBe('100MB');
    });

    it('should set config locally when isLocal=true', async () => {
        mockAdapter.executeQuery.mockResolvedValueOnce({
            rows: [{ set_config: 'on' }]
        });

        const tool = tools.find(t => t.name === 'pg_set_config')!;
        await tool.handler({
            name: 'enable_seqscan',
            value: 'on',
            isLocal: true
        }, mockContext);

        expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
            'SELECT set_config($1, $2, $3)',
            ['enable_seqscan', 'on', true]
        );
    });
});

describe('pg_reset_stats', () => {
    let mockAdapter: ReturnType<typeof createMockPostgresAdapter>;
    let tools: ReturnType<typeof getAdminTools>;
    let mockContext: ReturnType<typeof createMockRequestContext>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockAdapter = createMockPostgresAdapter();
        tools = getAdminTools(mockAdapter as unknown as PostgresAdapter);
        mockContext = createMockRequestContext();
    });

    it('should reset statistics', async () => {
        mockAdapter.executeQuery.mockResolvedValueOnce({ rows: [] });

        const tool = tools.find(t => t.name === 'pg_reset_stats')!;
        const result = await tool.handler({}, mockContext) as {
            success: boolean;
            message: string;
        };

        expect(mockAdapter.executeQuery).toHaveBeenCalledWith('SELECT pg_stat_reset()');
        expect(result.success).toBe(true);
        expect(result.message).toBe('Statistics reset');
    });

    it('should reset all statistics when type=all', async () => {
        mockAdapter.executeQuery.mockResolvedValueOnce({ rows: [] });

        const tool = tools.find(t => t.name === 'pg_reset_stats')!;
        await tool.handler({ type: 'all' }, mockContext);

        expect(mockAdapter.executeQuery).toHaveBeenCalledWith('SELECT pg_stat_reset()');
    });
});

describe('pg_cluster', () => {
    let mockAdapter: ReturnType<typeof createMockPostgresAdapter>;
    let tools: ReturnType<typeof getAdminTools>;
    let mockContext: ReturnType<typeof createMockRequestContext>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockAdapter = createMockPostgresAdapter();
        tools = getAdminTools(mockAdapter as unknown as PostgresAdapter);
        mockContext = createMockRequestContext();
    });

    it('should cluster a table on an index', async () => {
        mockAdapter.executeQuery.mockResolvedValueOnce({ rows: [] });

        const tool = tools.find(t => t.name === 'pg_cluster')!;
        const result = await tool.handler({
            table: 'users',
            index: 'idx_users_created'
        }, mockContext) as {
            success: boolean;
            table: string;
            index: string;
        };

        expect(mockAdapter.executeQuery).toHaveBeenCalledWith('CLUSTER "users" USING "idx_users_created"');
        expect(result.success).toBe(true);
        expect(result.table).toBe('users');
        expect(result.index).toBe('idx_users_created');
    });

    it('should cluster with schema qualified table', async () => {
        mockAdapter.executeQuery.mockResolvedValueOnce({ rows: [] });

        const tool = tools.find(t => t.name === 'pg_cluster')!;
        await tool.handler({
            table: 'users',
            schema: 'app',
            index: 'idx_users_email'
        }, mockContext);

        expect(mockAdapter.executeQuery).toHaveBeenCalledWith('CLUSTER "app"."users" USING "idx_users_email"');
    });
});
