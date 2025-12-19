/**
 * postgres-mcp - JSONB Tools Unit Tests
 * 
 * Tests for JSONB database operations covering tool definitions,
 * schema validation, and handler execution.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getJsonbTools } from '../index.js';
import type { PostgresAdapter } from '../../../PostgresAdapter.js';
import {
    createMockPostgresAdapter,
    createMockRequestContext
} from '../../../../../__tests__/mocks/index.js';

describe('getJsonbTools', () => {
    let adapter: PostgresAdapter;
    let tools: ReturnType<typeof getJsonbTools>;

    beforeEach(() => {
        vi.clearAllMocks();
        adapter = createMockPostgresAdapter() as unknown as PostgresAdapter;
        tools = getJsonbTools(adapter);
    });

    it('should return 19 JSONB tools', () => {
        expect(tools).toHaveLength(19);
    });

    it('should have all expected tool names', () => {
        const toolNames = tools.map(t => t.name);
        // Basic tools
        expect(toolNames).toContain('pg_jsonb_extract');
        expect(toolNames).toContain('pg_jsonb_set');
        expect(toolNames).toContain('pg_jsonb_insert');
        expect(toolNames).toContain('pg_jsonb_delete');
        expect(toolNames).toContain('pg_jsonb_contains');
        expect(toolNames).toContain('pg_jsonb_path_query');
        expect(toolNames).toContain('pg_jsonb_agg');
        expect(toolNames).toContain('pg_jsonb_object');
        expect(toolNames).toContain('pg_jsonb_array');
        expect(toolNames).toContain('pg_jsonb_keys');
        expect(toolNames).toContain('pg_jsonb_strip_nulls');
        expect(toolNames).toContain('pg_jsonb_typeof');
        // Advanced tools
        expect(toolNames).toContain('pg_jsonb_validate_path');
        expect(toolNames).toContain('pg_jsonb_merge');
        expect(toolNames).toContain('pg_jsonb_normalize');
        expect(toolNames).toContain('pg_jsonb_diff');
        expect(toolNames).toContain('pg_jsonb_index_suggest');
        expect(toolNames).toContain('pg_jsonb_security_scan');
        expect(toolNames).toContain('pg_jsonb_stats');
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

    it('should have group set to jsonb for all tools', () => {
        for (const tool of tools) {
            expect(tool.group).toBe('jsonb');
        }
    });
});

describe('Tool Annotations', () => {
    let tools: ReturnType<typeof getJsonbTools>;

    beforeEach(() => {
        tools = getJsonbTools(createMockPostgresAdapter() as unknown as PostgresAdapter);
    });

    it('pg_jsonb_extract should be read-only', () => {
        const tool = tools.find(t => t.name === 'pg_jsonb_extract')!;
        expect(tool.annotations?.readOnlyHint).toBe(true);
    });

    it('pg_jsonb_contains should be read-only', () => {
        const tool = tools.find(t => t.name === 'pg_jsonb_contains')!;
        expect(tool.annotations?.readOnlyHint).toBe(true);
    });

    it('pg_jsonb_set should be destructive', () => {
        const tool = tools.find(t => t.name === 'pg_jsonb_set')!;
        expect(tool.annotations?.readOnlyHint).toBe(false);
    });

    it('pg_jsonb_delete should be destructive', () => {
        const tool = tools.find(t => t.name === 'pg_jsonb_delete')!;
        expect(tool.annotations?.readOnlyHint).toBe(false);
    });
});

describe('Handler Execution', () => {
    let mockAdapter: ReturnType<typeof createMockPostgresAdapter>;
    let tools: ReturnType<typeof getJsonbTools>;
    let mockContext: ReturnType<typeof createMockRequestContext>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockAdapter = createMockPostgresAdapter();
        tools = getJsonbTools(mockAdapter as unknown as PostgresAdapter);
        mockContext = createMockRequestContext();
    });

    describe('pg_jsonb_extract', () => {
        it('should execute JSONB extraction query', async () => {
            mockAdapter.executeQuery.mockResolvedValue({
                rows: [{ id: 1, extracted_value: 'test@example.com' }]
            });

            const tool = tools.find(t => t.name === 'pg_jsonb_extract')!;
            const result = await tool.handler({
                table: 'users',
                column: 'metadata',
                path: '$.email'
            }, mockContext) as Record<string, unknown>;

            expect(mockAdapter.executeQuery).toHaveBeenCalled();
            expect(result).toHaveProperty('values');
        });
    });

    describe('pg_jsonb_contains', () => {
        it('should execute containment check', async () => {
            mockAdapter.executeQuery.mockResolvedValue({
                rows: [{ id: 1, metadata: { key: 'value' } }]
            });

            const tool = tools.find(t => t.name === 'pg_jsonb_contains')!;
            const result = await tool.handler({
                table: 'users',
                column: 'metadata',
                contains: { role: 'admin' }
            }, mockContext) as Record<string, unknown>;

            expect(mockAdapter.executeQuery).toHaveBeenCalled();
            expect(result).toBeDefined();
        });
    });

    describe('pg_jsonb_keys', () => {
        it('should extract JSONB keys', async () => {
            mockAdapter.executeQuery.mockResolvedValue({
                rows: [{ key: 'name' }, { key: 'email' }, { key: 'age' }]
            });

            const tool = tools.find(t => t.name === 'pg_jsonb_keys')!;
            const result = await tool.handler({
                table: 'users',
                column: 'metadata'
            }, mockContext) as Record<string, unknown>;

            expect(mockAdapter.executeQuery).toHaveBeenCalled();
            expect(result).toBeDefined();
        });
    });

    describe('pg_jsonb_typeof', () => {
        it('should return JSONB type information', async () => {
            mockAdapter.executeQuery.mockResolvedValue({
                rows: [{ jsonb_typeof: 'object' }]
            });

            const tool = tools.find(t => t.name === 'pg_jsonb_typeof')!;
            const result = await tool.handler({
                table: 'users',
                column: 'metadata'
            }, mockContext) as Record<string, unknown>;

            expect(mockAdapter.executeQuery).toHaveBeenCalled();
            expect(result).toBeDefined();
        });
    });

    describe('pg_jsonb_stats', () => {
        it('should return JSONB column statistics', async () => {
            mockAdapter.executeQuery.mockResolvedValue({
                rows: [{
                    avg_depth: 2.5,
                    avg_keys: 5,
                    total_rows: 1000
                }]
            });

            const tool = tools.find(t => t.name === 'pg_jsonb_stats')!;
            const result = await tool.handler({
                table: 'users',
                column: 'metadata'
            }, mockContext) as Record<string, unknown>;

            expect(mockAdapter.executeQuery).toHaveBeenCalled();
            expect(result).toBeDefined();
        });
    });

    describe('pg_jsonb_index_suggest', () => {
        it('should suggest indexes for JSONB column', async () => {
            mockAdapter.executeQuery.mockResolvedValueOnce({
                rows: [] // No existing indexes
            });
            mockAdapter.executeQuery.mockResolvedValueOnce({
                rows: [{ path: '$.email', count: 500 }]
            });

            const tool = tools.find(t => t.name === 'pg_jsonb_index_suggest')!;
            const result = await tool.handler({
                table: 'users',
                column: 'metadata'
            }, mockContext) as Record<string, unknown>;

            expect(mockAdapter.executeQuery).toHaveBeenCalled();
            expect(result).toBeDefined();
        });
    });

    describe('pg_jsonb_security_scan', () => {
        it('should scan JSONB for security issues', async () => {
            mockAdapter.executeQuery.mockResolvedValue({
                rows: []
            });

            const tool = tools.find(t => t.name === 'pg_jsonb_security_scan')!;
            const result = await tool.handler({
                table: 'users',
                column: 'metadata'
            }, mockContext) as Record<string, unknown>;

            expect(mockAdapter.executeQuery).toHaveBeenCalled();
            expect(result).toBeDefined();
        });

        it('should return medium risk level when 1-2 issues found', async () => {
            mockAdapter.executeQuery
                .mockResolvedValueOnce({ rows: [{ key: 'password', count: 5 }] }) // sensitive key found
                .mockResolvedValueOnce({ rows: [] }); // no injection patterns

            const tool = tools.find(t => t.name === 'pg_jsonb_security_scan')!;
            const result = await tool.handler({
                table: 'users',
                column: 'metadata'
            }, mockContext) as { riskLevel: string; issues: unknown[] };

            expect(result.riskLevel).toBe('medium');
            expect(result.issues.length).toBeGreaterThan(0);
        });

        it('should return high risk level when 3+ issues found', async () => {
            mockAdapter.executeQuery
                .mockResolvedValueOnce({
                    rows: [
                        { key: 'password', count: 5 },
                        { key: 'api_key', count: 3 },
                        { key: 'secret', count: 2 }
                    ]
                })
                .mockResolvedValueOnce({ rows: [{ key: 'query_input', count: 1 }] }); // injection pattern

            const tool = tools.find(t => t.name === 'pg_jsonb_security_scan')!;
            const result = await tool.handler({
                table: 'users',
                column: 'metadata'
            }, mockContext) as { riskLevel: string; issues: unknown[] };

            expect(result.riskLevel).toBe('high');
            expect(result.issues.length).toBeGreaterThanOrEqual(3);
        });
    });

    describe('pg_jsonb_normalize', () => {
        it('should use array mode with jsonb_array_elements', async () => {
            mockAdapter.executeQuery.mockResolvedValueOnce({
                rows: [{ element: { id: 1 } }, { element: { id: 2 } }]
            });

            const tool = tools.find(t => t.name === 'pg_jsonb_normalize')!;
            const result = await tool.handler({
                table: 'users',
                column: 'tags',
                mode: 'array'
            }, mockContext) as { rows: unknown[]; count: number };

            const sql = mockAdapter.executeQuery.mock.calls[0]?.[0] as string;
            expect(sql).toContain('jsonb_array_elements');
            expect(result.count).toBe(2);
        });

        it('should use flatten mode with jsonb_each', async () => {
            mockAdapter.executeQuery.mockResolvedValueOnce({
                rows: [{ key: 'name', value: '"John"' }, { key: 'age', value: '30' }]
            });

            const tool = tools.find(t => t.name === 'pg_jsonb_normalize')!;
            const result = await tool.handler({
                table: 'users',
                column: 'metadata',
                mode: 'flatten'
            }, mockContext) as { rows: unknown[]; count: number };

            const sql = mockAdapter.executeQuery.mock.calls[0]?.[0] as string;
            expect(sql).toContain('jsonb_each');
            expect(sql).not.toContain('jsonb_each_text');
            expect(result.count).toBe(2);
        });

        it('should use keys mode (default) with jsonb_each_text', async () => {
            mockAdapter.executeQuery.mockResolvedValueOnce({
                rows: [{ key: 'name', value: 'John' }]
            });

            const tool = tools.find(t => t.name === 'pg_jsonb_normalize')!;
            const result = await tool.handler({
                table: 'users',
                column: 'metadata'
                // mode defaults to 'keys'
            }, mockContext) as { rows: unknown[]; count: number };

            const sql = mockAdapter.executeQuery.mock.calls[0]?.[0] as string;
            expect(sql).toContain('jsonb_each_text');
            expect(result.count).toBe(1);
        });
    });

    describe('pg_jsonb_index_suggest frequent keys', () => {
        it('should recommend expression index for frequent keys', async () => {
            mockAdapter.executeQuery
                .mockResolvedValueOnce({
                    rows: [{ key: 'email', frequency: 800, value_type: 'string' }] // >50% of 1000 sample
                })
                .mockResolvedValueOnce({ rows: [] }); // no existing indexes

            const tool = tools.find(t => t.name === 'pg_jsonb_index_suggest')!;
            const result = await tool.handler({
                table: 'users',
                column: 'metadata',
                sampleSize: 1000
            }, mockContext) as { recommendations: string[] };

            expect(result.recommendations).toContainEqual(expect.stringContaining('email'));
            expect(result.recommendations).toContainEqual(expect.stringContaining('->>'));
        });
    });
});

describe('Error Handling', () => {
    let mockAdapter: ReturnType<typeof createMockPostgresAdapter>;
    let tools: ReturnType<typeof getJsonbTools>;
    let mockContext: ReturnType<typeof createMockRequestContext>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockAdapter = createMockPostgresAdapter();
        tools = getJsonbTools(mockAdapter as unknown as PostgresAdapter);
        mockContext = createMockRequestContext();
    });

    it('should propagate database errors', async () => {
        const dbError = new Error('JSONB column not found');
        mockAdapter.executeQuery.mockRejectedValue(dbError);

        const tool = tools.find(t => t.name === 'pg_jsonb_extract')!;

        await expect(tool.handler({
            table: 'users',
            column: 'nonexistent',
            path: '$.key'
        }, mockContext)).rejects.toThrow('JSONB column not found');
    });

    it('should validate required parameters', async () => {
        const tool = tools.find(t => t.name === 'pg_jsonb_extract')!;

        // Missing required parameters
        await expect(tool.handler({}, mockContext)).rejects.toThrow();
    });
});
