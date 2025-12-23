/**
 * postgres-mcp - Core Tools Unit Tests
 * 
 * Tests for core database operations with focus on tool definitions,
 * schema validation, and handler execution behavior.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getCoreTools } from '../index.js';
import type { PostgresAdapter } from '../../../PostgresAdapter.js';
import {
    createMockPostgresAdapter,
    createMockQueryResult,
    createMockRequestContext
} from '../../../../../__tests__/mocks/index.js';

describe('getCoreTools', () => {
    let adapter: PostgresAdapter;
    let tools: ReturnType<typeof getCoreTools>;

    beforeEach(() => {
        vi.clearAllMocks();
        adapter = createMockPostgresAdapter() as unknown as PostgresAdapter;
        tools = getCoreTools(adapter);
    });

    it('should return 19 core tools', () => {
        expect(tools).toHaveLength(19);
    });

    it('should have all expected tool names', () => {
        const toolNames = tools.map(t => t.name);
        expect(toolNames).toContain('pg_read_query');
        expect(toolNames).toContain('pg_write_query');
        expect(toolNames).toContain('pg_list_tables');
        expect(toolNames).toContain('pg_describe_table');
        expect(toolNames).toContain('pg_create_table');
        expect(toolNames).toContain('pg_drop_table');
        expect(toolNames).toContain('pg_get_indexes');
        expect(toolNames).toContain('pg_create_index');
        expect(toolNames).toContain('pg_list_objects');
        expect(toolNames).toContain('pg_object_details');
    });

    it('should have handler function for all tools', () => {
        for (const tool of tools) {
            expect(typeof tool.handler).toBe('function');
        }
    });

    it('should have inputSchema for all tools', () => {
        for (const tool of tools) {
            expect(tool.inputSchema).toBeDefined();
        }
    });

    it('should have group set to core for all tools', () => {
        for (const tool of tools) {
            expect(tool.group).toBe('core');
        }
    });
});

describe('Tool Annotations', () => {
    let tools: ReturnType<typeof getCoreTools>;

    beforeEach(() => {
        tools = getCoreTools(createMockPostgresAdapter() as unknown as PostgresAdapter);
    });

    it('pg_read_query should be read-only', () => {
        const tool = tools.find(t => t.name === 'pg_read_query')!;
        expect(tool.annotations?.readOnlyHint).toBe(true);
    });

    it('pg_write_query should be destructive', () => {
        const tool = tools.find(t => t.name === 'pg_write_query')!;
        expect(tool.annotations?.readOnlyHint).toBe(false);
    });

    it('pg_drop_table should be destructive', () => {
        const tool = tools.find(t => t.name === 'pg_drop_table')!;
        expect(tool.annotations?.readOnlyHint).toBe(false);
    });

    it('pg_list_tables should be read-only', () => {
        const tool = tools.find(t => t.name === 'pg_list_tables')!;
        expect(tool.annotations?.readOnlyHint).toBe(true);
    });
});

describe('Handler Execution', () => {
    let mockAdapter: ReturnType<typeof createMockPostgresAdapter>;
    let tools: ReturnType<typeof getCoreTools>;
    let mockContext: ReturnType<typeof createMockRequestContext>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockAdapter = createMockPostgresAdapter();
        tools = getCoreTools(mockAdapter as unknown as PostgresAdapter);
        mockContext = createMockRequestContext();
    });

    describe('pg_read_query', () => {
        it('should execute read query and return result', async () => {
            const expectedResult = createMockQueryResult([{ id: 1, name: 'test' }]);
            mockAdapter.executeReadQuery.mockResolvedValue(expectedResult);

            const tool = tools.find(t => t.name === 'pg_read_query')!;
            const result = await tool.handler({ sql: 'SELECT * FROM users' }, mockContext) as {
                rows: unknown[];
                rowCount: number;
            };

            expect(mockAdapter.executeReadQuery).toHaveBeenCalledWith('SELECT * FROM users', undefined);
            expect(result.rows).toEqual([{ id: 1, name: 'test' }]);
            expect(result.rowCount).toBe(1);
        });

        it('should pass query parameters', async () => {
            mockAdapter.executeReadQuery.mockResolvedValue(createMockQueryResult([]));

            const tool = tools.find(t => t.name === 'pg_read_query')!;
            await tool.handler({ sql: 'SELECT * FROM users WHERE id = $1', params: [42] }, mockContext);

            expect(mockAdapter.executeReadQuery).toHaveBeenCalledWith(
                'SELECT * FROM users WHERE id = $1',
                [42]
            );
        });

        it('should return 0 rowCount when rows is undefined (line 29 branch)', async () => {
            mockAdapter.executeReadQuery.mockResolvedValue({
                rows: undefined as unknown as Record<string, unknown>[],
                executionTimeMs: 5
            });

            const tool = tools.find(t => t.name === 'pg_read_query')!;
            const result = await tool.handler({ sql: 'SELECT 1' }, mockContext) as {
                rows: unknown;
                rowCount: number;
            };

            expect(result.rowCount).toBe(0);
        });
    });

    describe('pg_write_query', () => {
        it('should execute write query and return affected rows', async () => {
            mockAdapter.executeWriteQuery.mockResolvedValue({
                rows: [],
                rowsAffected: 5,
                command: 'UPDATE',
                executionTimeMs: 10
            });

            const tool = tools.find(t => t.name === 'pg_write_query')!;
            const result = await tool.handler({
                sql: 'UPDATE users SET active = true'
            }, mockContext) as { rowsAffected: number; command: string };

            expect(mockAdapter.executeWriteQuery).toHaveBeenCalled();
            expect(result.rowsAffected).toBe(5);
            expect(result.command).toBe('UPDATE');
        });
    });

    describe('pg_list_tables', () => {
        it('should call listTables adapter method', async () => {
            const tool = tools.find(t => t.name === 'pg_list_tables')!;
            await tool.handler({}, mockContext);

            expect(mockAdapter.listTables).toHaveBeenCalled();
        });
    });

    describe('pg_read_query - query alias', () => {
        it('should accept query as alias for sql parameter', async () => {
            const expectedResult = createMockQueryResult([{ id: 1 }]);
            mockAdapter.executeReadQuery.mockResolvedValue(expectedResult);

            const tool = tools.find(t => t.name === 'pg_read_query')!;
            const result = await tool.handler({ query: 'SELECT 1' }, mockContext) as {
                rows: unknown[];
            };

            expect(mockAdapter.executeReadQuery).toHaveBeenCalledWith('SELECT 1', undefined);
            expect(result.rows).toEqual([{ id: 1 }]);
        });
    });

    describe('pg_write_query - query alias', () => {
        it('should accept query as alias for sql parameter', async () => {
            mockAdapter.executeWriteQuery.mockResolvedValue({
                rows: [],
                rowsAffected: 1,
                command: 'INSERT',
                executionTimeMs: 5
            });

            const tool = tools.find(t => t.name === 'pg_write_query')!;
            const result = await tool.handler({
                query: 'INSERT INTO users (name) VALUES ($1)',
                params: ['test']
            }, mockContext) as { rowsAffected: number };

            expect(mockAdapter.executeWriteQuery).toHaveBeenCalled();
            expect(result.rowsAffected).toBe(1);
        });
    });

    describe('pg_create_index - column alias', () => {
        it('should accept column (singular) as alias for columns (array)', async () => {
            mockAdapter.executeQuery.mockResolvedValue({ rows: [], rowsAffected: 0 });

            const tool = tools.find(t => t.name === 'pg_create_index')!;
            const result = await tool.handler({
                table: 'users',
                column: 'email',  // Singular - should be auto-wrapped to array
                name: 'idx_users_email'
            }, mockContext) as { success: boolean };

            expect(result.success).toBe(true);
            const sql = mockAdapter.executeQuery.mock.calls[0]?.[0] as string;
            expect(sql).toContain('"email"');
        });
    });

    describe('pg_describe_table', () => {
        it('should call describeTable with table name', async () => {
            const tool = tools.find(t => t.name === 'pg_describe_table')!;
            await tool.handler({ table: 'users' }, mockContext);

            expect(mockAdapter.describeTable).toHaveBeenCalledWith('users', undefined);
        });

        it('should accept schema parameter', async () => {
            const tool = tools.find(t => t.name === 'pg_describe_table')!;
            await tool.handler({ table: 'orders', schema: 'sales' }, mockContext);

            expect(mockAdapter.describeTable).toHaveBeenCalledWith('orders', 'sales');
        });
    });

    describe('pg_get_indexes', () => {
        it('should call getTableIndexes with table name', async () => {
            const tool = tools.find(t => t.name === 'pg_get_indexes')!;
            await tool.handler({ table: 'users' }, mockContext);

            expect(mockAdapter.getTableIndexes).toHaveBeenCalledWith('users', undefined);
        });
    });

    describe('pg_create_table', () => {
        it('should execute CREATE TABLE with columns', async () => {
            mockAdapter.executeQuery.mockResolvedValue({ rows: [], rowsAffected: 0 });

            const tool = tools.find(t => t.name === 'pg_create_table')!;
            const result = await tool.handler({
                name: 'new_table',
                columns: [
                    { name: 'id', type: 'SERIAL', primaryKey: true },
                    { name: 'name', type: 'VARCHAR(255)' }
                ]
            }, mockContext) as { success: boolean; table: string };

            expect(mockAdapter.executeQuery).toHaveBeenCalled();
            expect(result).toHaveProperty('success', true);
            expect(result.table).toContain('new_table');
        });
    });

    describe('pg_drop_table', () => {
        it('should execute DROP TABLE', async () => {
            mockAdapter.executeQuery.mockResolvedValue({ rows: [], rowsAffected: 0 });

            const tool = tools.find(t => t.name === 'pg_drop_table')!;
            const result = await tool.handler({
                table: 'old_table'
            }, mockContext) as { success: boolean };

            expect(mockAdapter.executeQuery).toHaveBeenCalled();
            expect(result.success).toBe(true);
        });

        it('should support IF EXISTS option', async () => {
            mockAdapter.executeQuery.mockResolvedValue({ rows: [], rowsAffected: 0 });

            const tool = tools.find(t => t.name === 'pg_drop_table')!;
            await tool.handler({
                table: 'maybe_exists',
                ifExists: true
            }, mockContext);

            const sql = mockAdapter.executeQuery.mock.calls[0]?.[0] as string;
            expect(sql).toContain('IF EXISTS');
        });
    });

    describe('pg_create_index', () => {
        it('should execute CREATE INDEX', async () => {
            mockAdapter.executeQuery.mockResolvedValue({ rows: [], rowsAffected: 0 });

            const tool = tools.find(t => t.name === 'pg_create_index')!;
            const result = await tool.handler({
                table: 'users',
                columns: ['email'],
                name: 'idx_users_email'
            }, mockContext) as { success: boolean };

            expect(mockAdapter.executeQuery).toHaveBeenCalled();
            expect(result.success).toBe(true);
        });

        it('should support unique indexes', async () => {
            mockAdapter.executeQuery.mockResolvedValue({ rows: [], rowsAffected: 0 });

            const tool = tools.find(t => t.name === 'pg_create_index')!;
            await tool.handler({
                table: 'users',
                columns: ['email'],
                name: 'idx_users_email_unique',
                unique: true
            }, mockContext);

            const sql = mockAdapter.executeQuery.mock.calls[0]?.[0] as string;
            expect(sql).toContain('UNIQUE');
        });

        it('should include schema prefix when schema provided', async () => {
            mockAdapter.executeQuery.mockResolvedValue({ rows: [], rowsAffected: 0 });

            const tool = tools.find(t => t.name === 'pg_create_index')!;
            await tool.handler({
                table: 'orders',
                columns: ['created_at'],
                name: 'idx_orders_created',
                schema: 'sales'
            }, mockContext);

            const sql = mockAdapter.executeQuery.mock.calls[0]?.[0] as string;
            expect(sql).toContain('"sales".');
        });

        it('should include index type when type provided', async () => {
            mockAdapter.executeQuery.mockResolvedValue({ rows: [], rowsAffected: 0 });

            const tool = tools.find(t => t.name === 'pg_create_index')!;
            await tool.handler({
                table: 'documents',
                columns: ['content'],
                name: 'idx_documents_content',
                type: 'gin'
            }, mockContext);

            const sql = mockAdapter.executeQuery.mock.calls[0]?.[0] as string;
            expect(sql).toContain('USING gin');
        });

        it('should include where clause for partial index', async () => {
            mockAdapter.executeQuery.mockResolvedValue({ rows: [], rowsAffected: 0 });

            const tool = tools.find(t => t.name === 'pg_create_index')!;
            await tool.handler({
                table: 'orders',
                columns: ['status'],
                name: 'idx_orders_pending',
                where: "status = 'pending'"
            }, mockContext);

            const sql = mockAdapter.executeQuery.mock.calls[0]?.[0] as string;
            expect(sql).toContain('WHERE');
            expect(sql).toContain("status = 'pending'");
        });

        it('should include CONCURRENTLY when concurrently is true', async () => {
            mockAdapter.executeQuery.mockResolvedValue({ rows: [], rowsAffected: 0 });

            const tool = tools.find(t => t.name === 'pg_create_index')!;
            await tool.handler({
                table: 'large_table',
                columns: ['id'],
                name: 'idx_large_id',
                concurrently: true
            }, mockContext);

            const sql = mockAdapter.executeQuery.mock.calls[0]?.[0] as string;
            expect(sql).toContain('CONCURRENTLY');
        });

        it('should create index with all optional params combined', async () => {
            mockAdapter.executeQuery.mockResolvedValue({ rows: [], rowsAffected: 0 });

            const tool = tools.find(t => t.name === 'pg_create_index')!;
            const result = await tool.handler({
                table: 'orders',
                columns: ['customer_id', 'created_at'],
                name: 'idx_orders_partial',
                schema: 'sales',
                unique: true,
                type: 'btree',
                where: "status = 'active'",
                concurrently: true
            }, mockContext) as { success: boolean; sql: string };

            expect(result.success).toBe(true);
            const sql = mockAdapter.executeQuery.mock.calls[0]?.[0] as string;
            expect(sql).toContain('UNIQUE');
            expect(sql).toContain('"sales".');
            expect(sql).toContain('CONCURRENTLY');
            expect(sql).toContain('USING btree');
            expect(sql).toContain('WHERE');
        });
    });
});

describe('Error Handling', () => {
    let mockAdapter: ReturnType<typeof createMockPostgresAdapter>;
    let tools: ReturnType<typeof getCoreTools>;
    let mockContext: ReturnType<typeof createMockRequestContext>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockAdapter = createMockPostgresAdapter();
        tools = getCoreTools(mockAdapter as unknown as PostgresAdapter);
        mockContext = createMockRequestContext();
    });

    it('should propagate database errors', async () => {
        const dbError = new Error('Connection refused');
        mockAdapter.executeReadQuery.mockRejectedValue(dbError);

        const tool = tools.find(t => t.name === 'pg_read_query')!;

        await expect(tool.handler({ sql: 'SELECT 1' }, mockContext)).rejects.toThrow('Connection refused');
    });

    it('should validate input schema', async () => {
        const tool = tools.find(t => t.name === 'pg_read_query')!;

        // Missing required 'sql' parameter
        await expect(tool.handler({}, mockContext)).rejects.toThrow();
    });
});

describe('Health Analysis Tools', () => {
    let mockAdapter: ReturnType<typeof createMockPostgresAdapter>;
    let tools: ReturnType<typeof getCoreTools>;
    let mockContext: ReturnType<typeof createMockRequestContext>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockAdapter = createMockPostgresAdapter();
        tools = getCoreTools(mockAdapter as unknown as PostgresAdapter);
        mockContext = createMockRequestContext();
    });

    describe('pg_analyze_db_health', () => {
        it('should analyze database health with all components', async () => {
            mockAdapter.executeQuery
                .mockResolvedValueOnce({ rows: [{ heap_hit_ratio: 0.98, index_hit_ratio: 0.95 }] })
                .mockResolvedValueOnce({ rows: [{ size: '1 GB' }] })
                .mockResolvedValueOnce({ rows: [{ table_count: 10, total_rows: 50000 }] })
                .mockResolvedValueOnce({ rows: [{ unused_count: 3 }] })
                .mockResolvedValueOnce({ rows: [{ tables_needing_vacuum: 2 }] })
                .mockResolvedValueOnce({ rows: [{ total: 5, active: 2, idle: 3, max_connections: 100 }] })
                .mockResolvedValueOnce({ rows: [{ is_replica: false }] });

            const tool = tools.find(t => t.name === 'pg_analyze_db_health')!;
            const result = await tool.handler({}, mockContext) as Record<string, unknown>;

            expect(mockAdapter.executeQuery).toHaveBeenCalled();
            expect(result).toHaveProperty('databaseSize');
            expect(result).toHaveProperty('overallScore');
        });

        it('should be read-only', () => {
            const tool = tools.find(t => t.name === 'pg_analyze_db_health')!;
            expect(tool.annotations?.readOnlyHint).toBe(true);
        });
    });

    describe('pg_analyze_workload_indexes', () => {
        it('should return error when pg_stat_statements not installed', async () => {
            mockAdapter.executeQuery.mockResolvedValueOnce({ rows: [] });

            const tool = tools.find(t => t.name === 'pg_analyze_workload_indexes')!;
            const result = await tool.handler({}, mockContext) as Record<string, unknown>;

            expect(result).toHaveProperty('error');
        });

        it('should analyze queries when extension is available', async () => {
            mockAdapter.executeQuery
                .mockResolvedValueOnce({ rows: [{ extname: 'pg_stat_statements' }] })
                .mockResolvedValueOnce({ rows: [{ query: 'SELECT * FROM users WHERE email = $1', calls: 100, avg_time_ms: 15.5 }] });

            const tool = tools.find(t => t.name === 'pg_analyze_workload_indexes')!;
            const result = await tool.handler({}, mockContext) as Record<string, unknown>;

            expect(result).toHaveProperty('analyzedQueries');
            expect(result).toHaveProperty('recommendations');
        });
    });

    describe('pg_analyze_query_indexes', () => {
        it('should analyze query plan', async () => {
            mockAdapter.executeQuery.mockResolvedValueOnce({
                rows: [{ 'QUERY PLAN': [{ Plan: { 'Node Type': 'Seq Scan' }, 'Execution Time': 0.5, 'Planning Time': 0.1 }] }]
            });

            const tool = tools.find(t => t.name === 'pg_analyze_query_indexes')!;
            const result = await tool.handler({ sql: 'SELECT * FROM users' }, mockContext) as Record<string, unknown>;

            expect(result).toHaveProperty('executionTime');
            expect(result).toHaveProperty('plan');
        });

        it('should return error when no plan returned', async () => {
            mockAdapter.executeQuery.mockResolvedValueOnce({ rows: [] });

            const tool = tools.find(t => t.name === 'pg_analyze_query_indexes')!;
            const result = await tool.handler({ sql: 'SELECT 1' }, mockContext) as Record<string, unknown>;

            expect(result).toHaveProperty('error');
        });

        it('should detect sequential scan with filter and add recommendation', async () => {
            mockAdapter.executeQuery.mockResolvedValueOnce({
                rows: [{
                    'QUERY PLAN': [{
                        Plan: {
                            'Node Type': 'Seq Scan',
                            'Relation Name': 'users',
                            'Filter': '(email = $1)',
                            'Actual Rows': 5000,
                            'Plan Rows': 100
                        },
                        'Execution Time': 150.5,
                        'Planning Time': 0.2
                    }]
                }]
            });

            const tool = tools.find(t => t.name === 'pg_analyze_query_indexes')!;
            const result = await tool.handler({ sql: 'SELECT * FROM users WHERE email = $1' }, mockContext) as {
                issues: string[];
                recommendations: string[];
            };

            expect(result.issues).toContainEqual(expect.stringContaining('Sequential scan'));
            expect(result.recommendations).toContainEqual(expect.stringContaining('index'));
        });

        it('should detect row estimation issues', async () => {
            mockAdapter.executeQuery.mockResolvedValueOnce({
                rows: [{
                    'QUERY PLAN': [{
                        Plan: {
                            'Node Type': 'Index Scan',
                            'Actual Rows': 10000,
                            'Plan Rows': 100  // 100x off
                        },
                        'Execution Time': 50.0,
                        'Planning Time': 0.1
                    }]
                }]
            });

            const tool = tools.find(t => t.name === 'pg_analyze_query_indexes')!;
            const result = await tool.handler({ sql: 'SELECT * FROM orders' }, mockContext) as {
                issues: string[];
                recommendations: string[];
            };

            expect(result.issues).toContainEqual(expect.stringContaining('estimation'));
            expect(result.recommendations).toContainEqual(expect.stringContaining('ANALYZE'));
        });

        it('should detect external sort', async () => {
            mockAdapter.executeQuery.mockResolvedValueOnce({
                rows: [{
                    'QUERY PLAN': [{
                        Plan: {
                            'Node Type': 'Sort',
                            'Sort Method': 'external sort',
                            'Actual Rows': 100,
                            'Plan Rows': 100
                        },
                        'Execution Time': 500.0,
                        'Planning Time': 0.1
                    }]
                }]
            });

            const tool = tools.find(t => t.name === 'pg_analyze_query_indexes')!;
            const result = await tool.handler({ sql: 'SELECT * FROM large_table ORDER BY col' }, mockContext) as {
                issues: string[];
                recommendations: string[];
            };

            expect(result.issues).toContainEqual(expect.stringContaining('External sort'));
            expect(result.recommendations).toContainEqual(expect.stringContaining('work_mem'));
        });
    });

    describe('pg_analyze_db_health with options', () => {
        it('should skip indexes check when includeIndexes is false', async () => {
            mockAdapter.executeQuery
                .mockResolvedValueOnce({ rows: [{ heap_hit_ratio: 0.98, index_hit_ratio: 0.95 }] })
                .mockResolvedValueOnce({ rows: [{ size: '1 GB' }] })
                .mockResolvedValueOnce({ rows: [{ table_count: 10, total_rows: 50000 }] })
                // No unused indexes query
                .mockResolvedValueOnce({ rows: [{ tables_needing_vacuum: 2 }] })
                .mockResolvedValueOnce({ rows: [{ total: 5, active: 2, idle: 3, max_connections: 100 }] })
                .mockResolvedValueOnce({ rows: [{ is_replica: false }] });

            const tool = tools.find(t => t.name === 'pg_analyze_db_health')!;
            const result = await tool.handler({ includeIndexes: false }, mockContext) as Record<string, unknown>;

            expect(result).not.toHaveProperty('unusedIndexes');
        });

        it('should skip vacuum check when includeVacuum is false', async () => {
            mockAdapter.executeQuery
                .mockResolvedValueOnce({ rows: [{ heap_hit_ratio: 0.98, index_hit_ratio: 0.95 }] })
                .mockResolvedValueOnce({ rows: [{ size: '1 GB' }] })
                .mockResolvedValueOnce({ rows: [{ table_count: 10, total_rows: 50000 }] })
                .mockResolvedValueOnce({ rows: [{ unused_count: 3 }] })
                // No vacuum query
                .mockResolvedValueOnce({ rows: [{ total: 5, active: 2, idle: 3, max_connections: 100 }] })
                .mockResolvedValueOnce({ rows: [{ is_replica: false }] });

            const tool = tools.find(t => t.name === 'pg_analyze_db_health')!;
            const result = await tool.handler({ includeVacuum: false }, mockContext) as Record<string, unknown>;

            expect(result).not.toHaveProperty('tablesNeedingVacuum');
        });

        it('should skip connections check when includeConnections is false', async () => {
            mockAdapter.executeQuery
                .mockResolvedValueOnce({ rows: [{ heap_hit_ratio: 0.98, index_hit_ratio: 0.95 }] })
                .mockResolvedValueOnce({ rows: [{ size: '1 GB' }] })
                .mockResolvedValueOnce({ rows: [{ table_count: 10, total_rows: 50000 }] })
                .mockResolvedValueOnce({ rows: [{ unused_count: 3 }] })
                .mockResolvedValueOnce({ rows: [{ tables_needing_vacuum: 2 }] })
                // No connections query
                .mockResolvedValueOnce({ rows: [{ is_replica: false }] });

            const tool = tools.find(t => t.name === 'pg_analyze_db_health')!;
            const result = await tool.handler({ includeConnections: false }, mockContext) as Record<string, unknown>;

            expect(result).not.toHaveProperty('connections');
        });

        it('should report poor cache hit ratio', async () => {
            mockAdapter.executeQuery
                .mockResolvedValueOnce({ rows: [{ heap_hit_ratio: 0.6, index_hit_ratio: 0.5 }] })
                .mockResolvedValueOnce({ rows: [{ size: '1 GB' }] })
                .mockResolvedValueOnce({ rows: [{ table_count: 10, total_rows: 50000 }] })
                .mockResolvedValueOnce({ rows: [{ unused_count: 3 }] })
                .mockResolvedValueOnce({ rows: [{ tables_needing_vacuum: 2 }] })
                .mockResolvedValueOnce({ rows: [{ total: 5 }] })
                .mockResolvedValueOnce({ rows: [{ is_replica: false }] });

            const tool = tools.find(t => t.name === 'pg_analyze_db_health')!;
            const result = await tool.handler({}, mockContext) as {
                cacheHitRatio: { status: string };
                overallScore: number;
            };

            expect(result.cacheHitRatio.status).toBe('poor');
            expect(result.overallScore).toBeLessThan(100);
        });
    });

    describe('pg_analyze_workload_indexes recommendations', () => {
        it('should recommend GIN index for LIKE queries with wildcards', async () => {
            mockAdapter.executeQuery
                .mockResolvedValueOnce({ rows: [{ extname: 'pg_stat_statements' }] })
                .mockResolvedValueOnce({
                    rows: [{
                        query: "SELECT * FROM products WHERE name LIKE '%widget%'",
                        calls: 500,
                        avg_time_ms: 25.0
                    }]
                });

            const tool = tools.find(t => t.name === 'pg_analyze_workload_indexes')!;
            const result = await tool.handler({}, mockContext) as {
                recommendations: Array<{ recommendation: string }>;
            };

            expect(result.recommendations).toContainEqual(
                expect.objectContaining({
                    recommendation: expect.stringContaining('GIN')
                })
            );
        });

        it('should recommend B-tree index for range queries', async () => {
            mockAdapter.executeQuery
                .mockResolvedValueOnce({ rows: [{ extname: 'pg_stat_statements' }] })
                .mockResolvedValueOnce({
                    rows: [{
                        query: 'SELECT * FROM orders WHERE created_at BETWEEN $1 AND $2',
                        calls: 300,
                        avg_time_ms: 15.0
                    }]
                });

            const tool = tools.find(t => t.name === 'pg_analyze_workload_indexes')!;
            const result = await tool.handler({}, mockContext) as {
                recommendations: Array<{ recommendation: string }>;
            };

            expect(result.recommendations).toContainEqual(
                expect.objectContaining({
                    recommendation: expect.stringContaining('B-tree')
                })
            );
        });

        it('should recommend index for ORDER BY with LIMIT', async () => {
            mockAdapter.executeQuery
                .mockResolvedValueOnce({ rows: [{ extname: 'pg_stat_statements' }] })
                .mockResolvedValueOnce({
                    rows: [{
                        query: 'SELECT * FROM products ORDER BY price DESC LIMIT 10',
                        calls: 1000,
                        avg_time_ms: 30.0
                    }]
                });

            const tool = tools.find(t => t.name === 'pg_analyze_workload_indexes')!;
            const result = await tool.handler({}, mockContext) as {
                recommendations: Array<{ recommendation: string }>;
            };

            expect(result.recommendations).toContainEqual(
                expect.objectContaining({
                    recommendation: expect.stringContaining('ORDER BY')
                })
            );
        });
    });
});

describe('Object Tools', () => {
    let mockAdapter: ReturnType<typeof createMockPostgresAdapter>;
    let tools: ReturnType<typeof getCoreTools>;
    let mockContext: ReturnType<typeof createMockRequestContext>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockAdapter = createMockPostgresAdapter();
        tools = getCoreTools(mockAdapter as unknown as PostgresAdapter);
        mockContext = createMockRequestContext();
    });

    describe('pg_list_objects', () => {
        it('should list database objects', async () => {
            mockAdapter.executeQuery.mockResolvedValueOnce({
                rows: [{ object_name: 'users', object_type: 'table', schema_name: 'public' }]
            });

            const tool = tools.find(t => t.name === 'pg_list_objects')!;
            const result = await tool.handler({ type: 'table' }, mockContext) as Record<string, unknown>;

            expect(mockAdapter.executeQuery).toHaveBeenCalled();
            expect(result).toHaveProperty('objects');
        });

        it('should be read-only', () => {
            const tool = tools.find(t => t.name === 'pg_list_objects')!;
            expect(tool.annotations?.readOnlyHint).toBe(true);
        });

        it('should list indexes when type includes index', async () => {
            mockAdapter.executeQuery
                .mockResolvedValueOnce({ rows: [] }) // First query for tables/views/etc
                .mockResolvedValueOnce({  // Index query
                    rows: [
                        { type: 'index', schema: 'public', name: 'idx_users_email', owner: 'postgres' }
                    ]
                });

            const tool = tools.find(t => t.name === 'pg_list_objects')!;
            const result = await tool.handler({ types: ['index'] }, mockContext) as {
                objects: Array<{ type: string; name: string }>;
                count: number;
                byType: Record<string, number>;
            };

            expect(mockAdapter.executeQuery).toHaveBeenCalled();
            expect(result.objects).toBeDefined();
        });

        it('should list triggers when type includes trigger', async () => {
            mockAdapter.executeQuery
                .mockResolvedValueOnce({ rows: [] }) // First query
                .mockResolvedValueOnce({  // Trigger query
                    rows: [
                        { type: 'trigger', schema: 'public', name: 'audit_trigger', owner: 'postgres' }
                    ]
                });

            const tool = tools.find(t => t.name === 'pg_list_objects')!;
            const result = await tool.handler({ types: ['trigger'] }, mockContext) as {
                objects: Array<{ type: string; name: string }>;
            };

            expect(mockAdapter.executeQuery).toHaveBeenCalled();
            expect(result.objects).toBeDefined();
        });

        it('should list functions and procedures', async () => {
            mockAdapter.executeQuery
                .mockResolvedValueOnce({ rows: [] }) // Tables query
                .mockResolvedValueOnce({  // Functions query
                    rows: [
                        { type: 'function', schema: 'public', name: 'my_func', owner: 'postgres' }
                    ]
                });

            const tool = tools.find(t => t.name === 'pg_list_objects')!;
            const result = await tool.handler({ types: ['function'] }, mockContext) as {
                objects: Array<{ type: string; name: string }>;
            };

            expect(mockAdapter.executeQuery).toHaveBeenCalled();
            expect(result.objects).toBeDefined();
        });

        it('should accept schema filter', async () => {
            mockAdapter.executeQuery.mockResolvedValueOnce({ rows: [] });

            const tool = tools.find(t => t.name === 'pg_list_objects')!;
            await tool.handler({ schema: 'custom_schema' }, mockContext);

            // Should have schema filter in query
            expect(mockAdapter.executeQuery).toHaveBeenCalled();
        });
    });

    describe('pg_object_details', () => {
        it('should get details for an object', async () => {
            mockAdapter.executeQuery.mockResolvedValueOnce({
                rows: [{ object_name: 'users', object_type: 'table', schema_name: 'public' }]
            });

            const tool = tools.find(t => t.name === 'pg_object_details')!;
            const result = await tool.handler({ name: 'users' }, mockContext) as Record<string, unknown>;

            expect(mockAdapter.executeQuery).toHaveBeenCalled();
            expect(result).toBeDefined();
        });

        it('should be read-only', () => {
            const tool = tools.find(t => t.name === 'pg_object_details')!;
            expect(tool.annotations?.readOnlyHint).toBe(true);
        });

        it('should return function details when type is function', async () => {
            // First query detects type as function
            mockAdapter.executeQuery
                .mockResolvedValueOnce({ rows: [{ object_type: 'function' }] })
                .mockResolvedValueOnce({
                    rows: [{
                        name: 'my_func',
                        arguments: 'integer',
                        return_type: 'void',
                        source: 'BEGIN END;',
                        language: 'plpgsql',
                        volatility: 'v',
                        owner: 'postgres'
                    }]
                });

            const tool = tools.find(t => t.name === 'pg_object_details')!;
            const result = await tool.handler({ name: 'my_func', type: 'function' }, mockContext) as Record<string, unknown>;

            expect(result.type).toBe('function');
        });

        it('should return sequence details when type is sequence', async () => {
            mockAdapter.executeQuery.mockResolvedValueOnce({
                rows: [{
                    start_value: 1,
                    min_value: 1,
                    max_value: 9223372036854775807n,
                    increment: 1,
                    cycle: false,
                    cache: 1
                }]
            });

            const tool = tools.find(t => t.name === 'pg_object_details')!;
            const result = await tool.handler({ name: 'my_seq', type: 'sequence' }, mockContext) as Record<string, unknown>;

            expect(result.type).toBe('sequence');
        });

        it('should return index details when type is index', async () => {
            mockAdapter.executeQuery.mockResolvedValueOnce({
                rows: [{
                    index_name: 'idx_users_email',
                    table_name: 'users',
                    index_type: 'btree',
                    definition: 'CREATE INDEX ...',
                    is_unique: true,
                    is_primary: false,
                    size: '8192 bytes'
                }]
            });

            const tool = tools.find(t => t.name === 'pg_object_details')!;
            const result = await tool.handler({ name: 'idx_users_email', type: 'index' }, mockContext) as Record<string, unknown>;

            expect(result.type).toBe('index');
        });

        it('should return error when object not found', async () => {
            // Detection query returns null for object_type
            mockAdapter.executeQuery.mockResolvedValueOnce({
                rows: [{ object_type: null }]
            });

            const tool = tools.find(t => t.name === 'pg_object_details')!;
            const result = await tool.handler({ name: 'nonexistent' }, mockContext) as Record<string, unknown>;

            expect(result).toHaveProperty('error');
        });
    });
});

describe('Create Table with Advanced Column Options', () => {
    let mockAdapter: ReturnType<typeof createMockPostgresAdapter>;
    let tools: ReturnType<typeof getCoreTools>;
    let mockContext: ReturnType<typeof createMockRequestContext>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockAdapter = createMockPostgresAdapter();
        tools = getCoreTools(mockAdapter as unknown as PostgresAdapter);
        mockContext = createMockRequestContext();
    });

    it('should create table with foreign key references', async () => {
        mockAdapter.executeQuery.mockResolvedValue({ rows: [], rowsAffected: 0 });

        const tool = tools.find(t => t.name === 'pg_create_table')!;
        await tool.handler({
            name: 'orders',
            columns: [
                { name: 'id', type: 'SERIAL', primaryKey: true },
                {
                    name: 'user_id',
                    type: 'INTEGER',
                    references: {
                        table: 'users',
                        column: 'id',
                        onDelete: 'CASCADE',
                        onUpdate: 'SET NULL'
                    }
                }
            ]
        }, mockContext);

        const sql = mockAdapter.executeQuery.mock.calls[0]?.[0] as string;
        expect(sql).toContain('REFERENCES');
        expect(sql).toContain('"users"');
        expect(sql).toContain('ON DELETE CASCADE');
        expect(sql).toContain('ON UPDATE SET NULL');
    });

    it('should create table with unique constraint', async () => {
        mockAdapter.executeQuery.mockResolvedValue({ rows: [], rowsAffected: 0 });

        const tool = tools.find(t => t.name === 'pg_create_table')!;
        await tool.handler({
            name: 'profiles',
            columns: [
                { name: 'id', type: 'SERIAL', primaryKey: true },
                { name: 'email', type: 'VARCHAR(255)', unique: true }
            ]
        }, mockContext);

        const sql = mockAdapter.executeQuery.mock.calls[0]?.[0] as string;
        expect(sql).toContain('UNIQUE');
    });

    it('should create table with NOT NULL constraint', async () => {
        mockAdapter.executeQuery.mockResolvedValue({ rows: [], rowsAffected: 0 });

        const tool = tools.find(t => t.name === 'pg_create_table')!;
        await tool.handler({
            name: 'products',
            columns: [
                { name: 'id', type: 'SERIAL', primaryKey: true },
                { name: 'name', type: 'VARCHAR(255)', nullable: false }
            ]
        }, mockContext);

        const sql = mockAdapter.executeQuery.mock.calls[0]?.[0] as string;
        expect(sql).toContain('NOT NULL');
    });

    it('should create table with default value', async () => {
        mockAdapter.executeQuery.mockResolvedValue({ rows: [], rowsAffected: 0 });

        const tool = tools.find(t => t.name === 'pg_create_table')!;
        await tool.handler({
            name: 'settings',
            columns: [
                { name: 'id', type: 'SERIAL', primaryKey: true },
                { name: 'active', type: 'BOOLEAN', default: 'true' }
            ]
        }, mockContext);

        const sql = mockAdapter.executeQuery.mock.calls[0]?.[0] as string;
        expect(sql).toContain('DEFAULT true');
    });

    it('should create table with schema prefix', async () => {
        mockAdapter.executeQuery.mockResolvedValue({ rows: [], rowsAffected: 0 });

        const tool = tools.find(t => t.name === 'pg_create_table')!;
        const result = await tool.handler({
            name: 'audit_logs',
            schema: 'audit',
            columns: [
                { name: 'id', type: 'SERIAL', primaryKey: true }
            ]
        }, mockContext) as { success: boolean; table: string };

        const sql = mockAdapter.executeQuery.mock.calls[0]?.[0] as string;
        expect(sql).toContain('"audit".');
        expect(result.table).toContain('audit.');
    });

    it('should create table with IF NOT EXISTS', async () => {
        mockAdapter.executeQuery.mockResolvedValue({ rows: [], rowsAffected: 0 });

        const tool = tools.find(t => t.name === 'pg_create_table')!;
        await tool.handler({
            name: 'idempotent_table',
            ifNotExists: true,
            columns: [
                { name: 'id', type: 'SERIAL', primaryKey: true }
            ]
        }, mockContext);

        const sql = mockAdapter.executeQuery.mock.calls[0]?.[0] as string;
        expect(sql).toContain('IF NOT EXISTS');
    });

    it('should create table with foreign key reference only (no onDelete/onUpdate)', async () => {
        mockAdapter.executeQuery.mockResolvedValue({ rows: [], rowsAffected: 0 });

        const tool = tools.find(t => t.name === 'pg_create_table')!;
        await tool.handler({
            name: 'comments',
            columns: [
                { name: 'id', type: 'SERIAL', primaryKey: true },
                {
                    name: 'post_id',
                    type: 'INTEGER',
                    references: {
                        table: 'posts',
                        column: 'id'
                    }
                }
            ]
        }, mockContext);

        const sql = mockAdapter.executeQuery.mock.calls[0]?.[0] as string;
        expect(sql).toContain('REFERENCES "posts"("id")');
        // Should NOT contain ON DELETE or ON UPDATE since they weren't specified
    });
});

describe('Drop Table with Options', () => {
    let mockAdapter: ReturnType<typeof createMockPostgresAdapter>;
    let tools: ReturnType<typeof getCoreTools>;
    let mockContext: ReturnType<typeof createMockRequestContext>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockAdapter = createMockPostgresAdapter();
        tools = getCoreTools(mockAdapter as unknown as PostgresAdapter);
        mockContext = createMockRequestContext();
    });

    it('should support CASCADE option', async () => {
        mockAdapter.executeQuery.mockResolvedValue({ rows: [], rowsAffected: 0 });

        const tool = tools.find(t => t.name === 'pg_drop_table')!;
        await tool.handler({
            table: 'parent_table',
            cascade: true
        }, mockContext);

        const sql = mockAdapter.executeQuery.mock.calls[0]?.[0] as string;
        expect(sql).toContain('CASCADE');
    });

    it('should support schema prefix', async () => {
        mockAdapter.executeQuery.mockResolvedValue({ rows: [], rowsAffected: 0 });

        const tool = tools.find(t => t.name === 'pg_drop_table')!;
        const result = await tool.handler({
            table: 'logs',
            schema: 'archive'
        }, mockContext) as { success: boolean; dropped: string };

        const sql = mockAdapter.executeQuery.mock.calls[0]?.[0] as string;
        expect(sql).toContain('"archive".');
        expect(result.dropped).toContain('archive.');
    });
});
