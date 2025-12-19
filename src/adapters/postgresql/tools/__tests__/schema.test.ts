/**
 * postgres-mcp - Schema Tools Unit Tests
 * 
 * Tests for PostgreSQL schema management tools with focus on
 * schemas, sequences, views, functions, triggers, and constraints.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getSchemaTools } from '../schema.js';
import type { PostgresAdapter } from '../../PostgresAdapter.js';
import {
    createMockPostgresAdapter,
    createMockRequestContext
} from '../../../../__tests__/mocks/index.js';

describe('getSchemaTools', () => {
    let adapter: PostgresAdapter;
    let tools: ReturnType<typeof getSchemaTools>;

    beforeEach(() => {
        vi.clearAllMocks();
        adapter = createMockPostgresAdapter() as unknown as PostgresAdapter;
        tools = getSchemaTools(adapter);
    });

    it('should return 10 schema tools', () => {
        expect(tools).toHaveLength(10);
    });

    it('should have all expected tool names', () => {
        const toolNames = tools.map(t => t.name);
        expect(toolNames).toContain('pg_list_schemas');
        expect(toolNames).toContain('pg_create_schema');
        expect(toolNames).toContain('pg_drop_schema');
        expect(toolNames).toContain('pg_list_sequences');
        expect(toolNames).toContain('pg_create_sequence');
        expect(toolNames).toContain('pg_list_views');
        expect(toolNames).toContain('pg_create_view');
        expect(toolNames).toContain('pg_list_functions');
        expect(toolNames).toContain('pg_list_triggers');
        expect(toolNames).toContain('pg_list_constraints');
    });

    it('should have group set to schema for all tools', () => {
        for (const tool of tools) {
            expect(tool.group).toBe('schema');
        }
    });
});

describe('pg_list_schemas', () => {
    let mockAdapter: ReturnType<typeof createMockPostgresAdapter>;
    let tools: ReturnType<typeof getSchemaTools>;
    let mockContext: ReturnType<typeof createMockRequestContext>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockAdapter = createMockPostgresAdapter();
        tools = getSchemaTools(mockAdapter as unknown as PostgresAdapter);
        mockContext = createMockRequestContext();
    });

    it('should list all schemas', async () => {
        mockAdapter.listSchemas.mockResolvedValueOnce(['public', 'app', 'auth']);

        const tool = tools.find(t => t.name === 'pg_list_schemas')!;
        const result = await tool.handler({}, mockContext) as {
            schemas: string[];
            count: number;
        };

        expect(mockAdapter.listSchemas).toHaveBeenCalled();
        expect(result.schemas).toEqual(['public', 'app', 'auth']);
        expect(result.count).toBe(3);
    });
});

describe('pg_create_schema', () => {
    let mockAdapter: ReturnType<typeof createMockPostgresAdapter>;
    let tools: ReturnType<typeof getSchemaTools>;
    let mockContext: ReturnType<typeof createMockRequestContext>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockAdapter = createMockPostgresAdapter();
        tools = getSchemaTools(mockAdapter as unknown as PostgresAdapter);
        mockContext = createMockRequestContext();
    });

    it('should create a schema', async () => {
        mockAdapter.executeQuery.mockResolvedValueOnce({ rows: [] });

        const tool = tools.find(t => t.name === 'pg_create_schema')!;
        const result = await tool.handler({ name: 'app' }, mockContext) as {
            success: boolean;
            schema: string;
        };

        expect(mockAdapter.executeQuery).toHaveBeenCalledWith('CREATE SCHEMA "app"');
        expect(result.success).toBe(true);
        expect(result.schema).toBe('app');
    });

    it('should create schema with IF NOT EXISTS', async () => {
        mockAdapter.executeQuery.mockResolvedValueOnce({ rows: [] });

        const tool = tools.find(t => t.name === 'pg_create_schema')!;
        await tool.handler({ name: 'app', ifNotExists: true }, mockContext);

        expect(mockAdapter.executeQuery).toHaveBeenCalledWith('CREATE SCHEMA IF NOT EXISTS "app"');
    });

    it('should create schema with authorization', async () => {
        mockAdapter.executeQuery.mockResolvedValueOnce({ rows: [] });

        const tool = tools.find(t => t.name === 'pg_create_schema')!;
        await tool.handler({ name: 'app', authorization: 'admin_user' }, mockContext);

        expect(mockAdapter.executeQuery).toHaveBeenCalledWith('CREATE SCHEMA "app" AUTHORIZATION "admin_user"');
    });
});

describe('pg_drop_schema', () => {
    let mockAdapter: ReturnType<typeof createMockPostgresAdapter>;
    let tools: ReturnType<typeof getSchemaTools>;
    let mockContext: ReturnType<typeof createMockRequestContext>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockAdapter = createMockPostgresAdapter();
        tools = getSchemaTools(mockAdapter as unknown as PostgresAdapter);
        mockContext = createMockRequestContext();
    });

    it('should drop a schema', async () => {
        mockAdapter.executeQuery.mockResolvedValueOnce({ rows: [] });

        const tool = tools.find(t => t.name === 'pg_drop_schema')!;
        const result = await tool.handler({ name: 'old_app' }, mockContext) as {
            success: boolean;
            dropped: string;
        };

        expect(mockAdapter.executeQuery).toHaveBeenCalledWith('DROP SCHEMA "old_app"');
        expect(result.success).toBe(true);
        expect(result.dropped).toBe('old_app');
    });

    it('should drop schema with IF EXISTS', async () => {
        mockAdapter.executeQuery.mockResolvedValueOnce({ rows: [] });

        const tool = tools.find(t => t.name === 'pg_drop_schema')!;
        await tool.handler({ name: 'old_app', ifExists: true }, mockContext);

        expect(mockAdapter.executeQuery).toHaveBeenCalledWith('DROP SCHEMA IF EXISTS "old_app"');
    });

    it('should drop schema with CASCADE', async () => {
        mockAdapter.executeQuery.mockResolvedValueOnce({ rows: [] });

        const tool = tools.find(t => t.name === 'pg_drop_schema')!;
        await tool.handler({ name: 'old_app', cascade: true }, mockContext);

        expect(mockAdapter.executeQuery).toHaveBeenCalledWith('DROP SCHEMA "old_app" CASCADE');
    });
});

describe('pg_list_sequences', () => {
    let mockAdapter: ReturnType<typeof createMockPostgresAdapter>;
    let tools: ReturnType<typeof getSchemaTools>;
    let mockContext: ReturnType<typeof createMockRequestContext>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockAdapter = createMockPostgresAdapter();
        tools = getSchemaTools(mockAdapter as unknown as PostgresAdapter);
        mockContext = createMockRequestContext();
    });

    it('should list all sequences', async () => {
        mockAdapter.executeQuery.mockResolvedValueOnce({
            rows: [
                { schema: 'public', name: 'users_id_seq', owned_by: 'public.users.id' }
            ]
        });

        const tool = tools.find(t => t.name === 'pg_list_sequences')!;
        const result = await tool.handler({}, mockContext) as {
            sequences: unknown[];
        };

        expect(mockAdapter.executeQuery).toHaveBeenCalledWith(expect.stringContaining("c.relkind = 'S'"));
        expect(result.sequences).toHaveLength(1);
    });

    it('should filter by schema', async () => {
        mockAdapter.executeQuery.mockResolvedValueOnce({ rows: [] });

        const tool = tools.find(t => t.name === 'pg_list_sequences')!;
        await tool.handler({ schema: 'app' }, mockContext);

        expect(mockAdapter.executeQuery).toHaveBeenCalledWith(expect.stringContaining("n.nspname = 'app'"));
    });
});

describe('pg_create_sequence', () => {
    let mockAdapter: ReturnType<typeof createMockPostgresAdapter>;
    let tools: ReturnType<typeof getSchemaTools>;
    let mockContext: ReturnType<typeof createMockRequestContext>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockAdapter = createMockPostgresAdapter();
        tools = getSchemaTools(mockAdapter as unknown as PostgresAdapter);
        mockContext = createMockRequestContext();
    });

    it('should create a basic sequence', async () => {
        mockAdapter.executeQuery.mockResolvedValueOnce({ rows: [] });

        const tool = tools.find(t => t.name === 'pg_create_sequence')!;
        const result = await tool.handler({ name: 'order_num_seq' }, mockContext) as {
            success: boolean;
            sequence: string;
        };

        expect(mockAdapter.executeQuery).toHaveBeenCalledWith('CREATE SEQUENCE "order_num_seq"');
        expect(result.success).toBe(true);
        expect(result.sequence).toBe('public.order_num_seq');
    });

    it('should create sequence with options', async () => {
        mockAdapter.executeQuery.mockResolvedValueOnce({ rows: [] });

        const tool = tools.find(t => t.name === 'pg_create_sequence')!;
        await tool.handler({
            name: 'custom_seq',
            schema: 'app',
            start: 100,
            increment: 10,
            minValue: 1,
            maxValue: 10000,
            cycle: true
        }, mockContext);

        const call = mockAdapter.executeQuery.mock.calls[0][0] as string;
        expect(call).toContain('"app"."custom_seq"');
        expect(call).toContain('START WITH 100');
        expect(call).toContain('INCREMENT BY 10');
        expect(call).toContain('MINVALUE 1');
        expect(call).toContain('MAXVALUE 10000');
        expect(call).toContain('CYCLE');
    });
});

describe('pg_list_views', () => {
    let mockAdapter: ReturnType<typeof createMockPostgresAdapter>;
    let tools: ReturnType<typeof getSchemaTools>;
    let mockContext: ReturnType<typeof createMockRequestContext>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockAdapter = createMockPostgresAdapter();
        tools = getSchemaTools(mockAdapter as unknown as PostgresAdapter);
        mockContext = createMockRequestContext();
    });

    it('should list views and materialized views', async () => {
        mockAdapter.executeQuery.mockResolvedValueOnce({
            rows: [
                { schema: 'public', name: 'active_users', type: 'view', definition: 'SELECT * FROM users WHERE active' },
                { schema: 'public', name: 'user_stats', type: 'materialized_view', definition: 'SELECT count(*) FROM users' }
            ]
        });

        const tool = tools.find(t => t.name === 'pg_list_views')!;
        const result = await tool.handler({}, mockContext) as {
            views: unknown[];
        };

        expect(mockAdapter.executeQuery).toHaveBeenCalledWith(expect.stringContaining("IN ('v', 'm')"));
        expect(result.views).toHaveLength(2);
    });

    it('should filter by schema', async () => {
        mockAdapter.executeQuery.mockResolvedValueOnce({ rows: [] });

        const tool = tools.find(t => t.name === 'pg_list_views')!;
        await tool.handler({ schema: 'reports' }, mockContext);

        expect(mockAdapter.executeQuery).toHaveBeenCalledWith(expect.stringContaining("n.nspname = 'reports'"));
    });

    it('should exclude materialized views when requested', async () => {
        mockAdapter.executeQuery.mockResolvedValueOnce({ rows: [] });

        const tool = tools.find(t => t.name === 'pg_list_views')!;
        await tool.handler({ includeMaterialized: false }, mockContext);

        expect(mockAdapter.executeQuery).toHaveBeenCalledWith(expect.stringContaining("= 'v'"));
    });
});

describe('pg_create_view', () => {
    let mockAdapter: ReturnType<typeof createMockPostgresAdapter>;
    let tools: ReturnType<typeof getSchemaTools>;
    let mockContext: ReturnType<typeof createMockRequestContext>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockAdapter = createMockPostgresAdapter();
        tools = getSchemaTools(mockAdapter as unknown as PostgresAdapter);
        mockContext = createMockRequestContext();
    });

    it('should create a view', async () => {
        mockAdapter.executeQuery.mockResolvedValueOnce({ rows: [] });

        const tool = tools.find(t => t.name === 'pg_create_view')!;
        const result = await tool.handler({
            name: 'active_users',
            query: 'SELECT * FROM users WHERE active = true'
        }, mockContext) as {
            success: boolean;
            view: string;
            materialized: boolean;
        };

        expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
            'CREATE VIEW "active_users" AS SELECT * FROM users WHERE active = true'
        );
        expect(result.success).toBe(true);
        expect(result.materialized).toBe(false);
    });

    it('should create a materialized view', async () => {
        mockAdapter.executeQuery.mockResolvedValueOnce({ rows: [] });

        const tool = tools.find(t => t.name === 'pg_create_view')!;
        const result = await tool.handler({
            name: 'user_counts',
            query: 'SELECT count(*) FROM users',
            materialized: true
        }, mockContext) as {
            materialized: boolean;
        };

        expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
            'CREATE MATERIALIZED VIEW "user_counts" AS SELECT count(*) FROM users'
        );
        expect(result.materialized).toBe(true);
    });

    it('should create or replace a view', async () => {
        mockAdapter.executeQuery.mockResolvedValueOnce({ rows: [] });

        const tool = tools.find(t => t.name === 'pg_create_view')!;
        await tool.handler({
            name: 'my_view',
            query: 'SELECT 1',
            orReplace: true
        }, mockContext);

        expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
            'CREATE OR REPLACE VIEW "my_view" AS SELECT 1'
        );
    });
});

describe('pg_list_functions', () => {
    let mockAdapter: ReturnType<typeof createMockPostgresAdapter>;
    let tools: ReturnType<typeof getSchemaTools>;
    let mockContext: ReturnType<typeof createMockRequestContext>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockAdapter = createMockPostgresAdapter();
        tools = getSchemaTools(mockAdapter as unknown as PostgresAdapter);
        mockContext = createMockRequestContext();
    });

    it('should list user-defined functions', async () => {
        mockAdapter.executeQuery.mockResolvedValueOnce({
            rows: [
                { schema: 'public', name: 'calculate_total', arguments: 'integer, integer', returns: 'integer', language: 'plpgsql' }
            ]
        });

        const tool = tools.find(t => t.name === 'pg_list_functions')!;
        const result = await tool.handler({}, mockContext) as {
            functions: unknown[];
        };

        expect(mockAdapter.executeQuery).toHaveBeenCalledWith(expect.stringContaining('pg_proc'));
        expect(result.functions).toHaveLength(1);
    });

    it('should filter functions by schema', async () => {
        mockAdapter.executeQuery.mockResolvedValueOnce({ rows: [] });

        const tool = tools.find(t => t.name === 'pg_list_functions')!;
        await tool.handler({ schema: 'utils' }, mockContext);

        expect(mockAdapter.executeQuery).toHaveBeenCalledWith(expect.stringContaining("n.nspname = 'utils'"));
    });
});

describe('pg_list_triggers', () => {
    let mockAdapter: ReturnType<typeof createMockPostgresAdapter>;
    let tools: ReturnType<typeof getSchemaTools>;
    let mockContext: ReturnType<typeof createMockRequestContext>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockAdapter = createMockPostgresAdapter();
        tools = getSchemaTools(mockAdapter as unknown as PostgresAdapter);
        mockContext = createMockRequestContext();
    });

    it('should list all triggers', async () => {
        mockAdapter.executeQuery.mockResolvedValueOnce({
            rows: [
                { schema: 'public', table_name: 'users', name: 'update_timestamp', timing: 'BEFORE', event: 'UPDATE', function_name: 'set_timestamp', enabled: true }
            ]
        });

        const tool = tools.find(t => t.name === 'pg_list_triggers')!;
        const result = await tool.handler({}, mockContext) as {
            triggers: unknown[];
        };

        expect(mockAdapter.executeQuery).toHaveBeenCalledWith(expect.stringContaining('pg_trigger'));
        expect(result.triggers).toHaveLength(1);
    });

    it('should filter triggers by table', async () => {
        mockAdapter.executeQuery.mockResolvedValueOnce({ rows: [] });

        const tool = tools.find(t => t.name === 'pg_list_triggers')!;
        await tool.handler({ table: 'orders' }, mockContext);

        expect(mockAdapter.executeQuery).toHaveBeenCalledWith(expect.stringContaining("c.relname = 'orders'"));
    });
});

describe('pg_list_constraints', () => {
    let mockAdapter: ReturnType<typeof createMockPostgresAdapter>;
    let tools: ReturnType<typeof getSchemaTools>;
    let mockContext: ReturnType<typeof createMockRequestContext>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockAdapter = createMockPostgresAdapter();
        tools = getSchemaTools(mockAdapter as unknown as PostgresAdapter);
        mockContext = createMockRequestContext();
    });

    it('should list all constraints', async () => {
        mockAdapter.executeQuery.mockResolvedValueOnce({
            rows: [
                { schema: 'public', table_name: 'users', name: 'users_pkey', type: 'primary_key', definition: 'PRIMARY KEY (id)' },
                { schema: 'public', table_name: 'users', name: 'users_email_key', type: 'unique', definition: 'UNIQUE (email)' }
            ]
        });

        const tool = tools.find(t => t.name === 'pg_list_constraints')!;
        const result = await tool.handler({}, mockContext) as {
            constraints: unknown[];
        };

        expect(mockAdapter.executeQuery).toHaveBeenCalledWith(expect.stringContaining('pg_constraint'));
        expect(result.constraints).toHaveLength(2);
    });

    it('should filter constraints by table', async () => {
        mockAdapter.executeQuery.mockResolvedValueOnce({ rows: [] });

        const tool = tools.find(t => t.name === 'pg_list_constraints')!;
        await tool.handler({ table: 'orders' }, mockContext);

        expect(mockAdapter.executeQuery).toHaveBeenCalledWith(expect.stringContaining("c.relname = 'orders'"));
    });

    it('should filter constraints by type', async () => {
        mockAdapter.executeQuery.mockResolvedValueOnce({ rows: [] });

        const tool = tools.find(t => t.name === 'pg_list_constraints')!;
        await tool.handler({ type: 'foreign_key' }, mockContext);

        expect(mockAdapter.executeQuery).toHaveBeenCalledWith(expect.stringContaining("con.contype = 'f'"));
    });
});
