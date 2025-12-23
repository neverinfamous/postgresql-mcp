/**
 * postgres-mcp - JSONB Tools Unit Tests
 * 
 * Tests for JSONB basic and advanced operations (19 tools total).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PostgresAdapter } from '../../PostgresAdapter.js';
import { createMockPostgresAdapter, createMockRequestContext } from '../../../../__tests__/mocks/index.js';
import { getJsonbTools } from '../jsonb/index.js';

describe('JSONB Tools', () => {
    let mockAdapter: ReturnType<typeof createMockPostgresAdapter>;
    let mockContext: ReturnType<typeof createMockRequestContext>;
    let tools: ReturnType<typeof getJsonbTools>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockAdapter = createMockPostgresAdapter();
        mockContext = createMockRequestContext();
        tools = getJsonbTools(mockAdapter as unknown as PostgresAdapter);
    });

    const findTool = (name: string) => tools.find(t => t.name === name);

    describe('pg_jsonb_extract', () => {
        it('should extract value using path expression', async () => {
            mockAdapter.executeQuery.mockResolvedValueOnce({
                rows: [{ value: 'John' }]
            });

            const tool = findTool('pg_jsonb_extract');
            const result = await tool!.handler({
                table: 'users',
                column: 'data',
                path: '$.name'
            }, mockContext) as { results: unknown[] };

            expect(result.results).toEqual(['John']);
            expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
                expect.stringContaining('#>'),
                expect.anything()
            );
        });

        it('should handle array paths', async () => {
            mockAdapter.executeQuery.mockResolvedValueOnce({
                rows: [{ value: 'item1' }]
            });

            const tool = findTool('pg_jsonb_extract');
            await tool!.handler({
                table: 'orders',
                column: 'items',
                path: '{0,name}'
            }, mockContext);

            expect(mockAdapter.executeQuery).toHaveBeenCalled();
        });
    });

    describe('pg_jsonb_set', () => {
        it('should set value at specified path', async () => {
            mockAdapter.executeQuery.mockResolvedValueOnce({ rowsAffected: 1 });

            const tool = findTool('pg_jsonb_set');
            const result = await tool!.handler({
                table: 'users',
                column: 'data',
                path: ['name'],
                value: { first: 'Jane' },  // Use object to test JSON stringification
                where: 'id = 1'
            }, mockContext) as { rowsAffected: number };

            expect(result.rowsAffected).toBe(1);
            expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
                expect.stringContaining('jsonb_set'),
                expect.arrayContaining([['name'], '{"first":"Jane"}', true])
            );
        });
    });

    describe('pg_jsonb_insert', () => {
        it('should insert value into JSONB', async () => {
            // First call: NULL column check
            mockAdapter.executeQuery.mockResolvedValueOnce({ rows: [{ null_count: 0 }] });
            // Second call: array type check  
            mockAdapter.executeQuery.mockResolvedValueOnce({ rows: [{ type: 'array' }] });
            // Third call: actual insert
            mockAdapter.executeQuery.mockResolvedValueOnce({ rowsAffected: 1 });

            const tool = findTool('pg_jsonb_insert');
            const result = await tool!.handler({
                table: 'users',
                column: 'data',
                path: ['tags', '0'],
                value: 'new-tag',
                where: 'id = 1'
            }, mockContext) as { rowsAffected: number };

            expect(result.rowsAffected).toBe(1);
            expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
                expect.stringContaining('jsonb_insert'),
                expect.anything()
            );
        });
    });

    describe('pg_jsonb_delete', () => {
        it('should delete key from JSONB', async () => {
            mockAdapter.executeQuery.mockResolvedValueOnce({ rowsAffected: 1 });

            const tool = findTool('pg_jsonb_delete');
            const result = await tool!.handler({
                table: 'users',
                column: 'data',
                path: 'old_key',
                where: 'id = 1'
            }, mockContext) as { rowsAffected: number };

            expect(result.rowsAffected).toBe(1);
            expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
                expect.stringContaining('- $1'),
                ['old_key']
            );
        });

        it('should delete nested path from JSONB', async () => {
            mockAdapter.executeQuery.mockResolvedValueOnce({ rowsAffected: 1 });

            const tool = findTool('pg_jsonb_delete');
            await tool!.handler({
                table: 'users',
                column: 'data',
                path: ['nested', 'key'],
                where: 'id = 1'
            }, mockContext);

            expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
                expect.stringContaining('#- $1'),
                [['nested', 'key']]
            );
        });
    });

    describe('pg_jsonb_contains', () => {
        it('should find rows with containment', async () => {
            mockAdapter.executeQuery.mockResolvedValueOnce({
                rows: [{ id: 1, data: { role: 'admin' } }]
            });

            const tool = findTool('pg_jsonb_contains');
            const result = await tool!.handler({
                table: 'users',
                column: 'data',
                value: { role: 'admin' }
            }, mockContext) as { rows: unknown[]; count: number };

            expect(result.count).toBe(1);
            expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
                expect.stringContaining('@>'),
                [JSON.stringify({ role: 'admin' })]
            );
        });

        it('should use specific select columns', async () => {
            mockAdapter.executeQuery.mockResolvedValueOnce({ rows: [{ id: 1 }] });

            const tool = findTool('pg_jsonb_contains');
            await tool!.handler({
                table: 'users',
                column: 'data',
                value: { active: true },
                select: ['id', 'name']
            }, mockContext);

            expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
                expect.stringContaining('"id", "name"'),
                expect.anything()
            );
        });
    });

    describe('pg_jsonb_path_query', () => {
        it('should query using SQL/JSON path', async () => {
            mockAdapter.executeQuery.mockResolvedValueOnce({
                rows: [{ result: 'value1' }, { result: 'value2' }]
            });

            const tool = findTool('pg_jsonb_path_query');
            const result = await tool!.handler({
                table: 'documents',
                column: 'content',
                path: '$.items[*].name'
            }, mockContext) as { results: unknown[] };

            expect(result.results).toHaveLength(2);
            expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
                expect.stringContaining('jsonb_path_query'),
                expect.anything()
            );
        });

        it('should pass variables to path query', async () => {
            mockAdapter.executeQuery.mockResolvedValueOnce({ rows: [] });

            const tool = findTool('pg_jsonb_path_query');
            await tool!.handler({
                table: 'documents',
                column: 'content',
                path: '$.items[*] ? (@.price > $min)',
                vars: { min: 10 }
            }, mockContext);

            expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
                expect.anything(),
                expect.arrayContaining([expect.stringContaining('min')])
            );
        });
    });

    describe('pg_jsonb_agg', () => {
        it('should aggregate rows into JSONB array', async () => {
            mockAdapter.executeQuery.mockResolvedValueOnce({
                rows: [{ result: [{ id: 1 }, { id: 2 }] }]
            });

            const tool = findTool('pg_jsonb_agg');
            const result = await tool!.handler({
                table: 'users'
            }, mockContext) as { result: unknown[] };

            expect(result.result).toHaveLength(2);
            expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
                expect.stringContaining('jsonb_agg')
            );
        });

        it('should select specific columns', async () => {
            mockAdapter.executeQuery.mockResolvedValueOnce({ rows: [{ result: [{}] }] });

            const tool = findTool('pg_jsonb_agg');
            await tool!.handler({
                table: 'users',
                select: ['id', 'name']
            }, mockContext);

            expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
                expect.stringContaining('jsonb_build_object')
            );
        });
    });

    describe('pg_jsonb_object', () => {
        it('should build JSONB object from key-value pairs', async () => {
            mockAdapter.executeQuery.mockResolvedValueOnce({
                rows: [{ result: { name: 'John', age: 30 } }]
            });

            const tool = findTool('pg_jsonb_object');
            // Pass key-value pairs directly (no 'pairs' wrapper)
            const result = await tool!.handler({
                name: 'John', age: 30
            }, mockContext) as { object: Record<string, unknown> };

            expect(result).toEqual({ object: { name: 'John', age: 30 } });
            expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
                expect.stringContaining('jsonb_build_object'),
                expect.anything()
            );
        });
    });

    describe('pg_jsonb_array', () => {
        it('should build JSONB array from values', async () => {
            mockAdapter.executeQuery.mockResolvedValueOnce({
                rows: [{ result: [1, 2, 3] }]
            });

            const tool = findTool('pg_jsonb_array');
            const result = await tool!.handler({
                values: [1, 2, 3]
            }, mockContext) as { array: number[] };

            expect(result.array).toEqual([1, 2, 3]);
            expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
                expect.stringContaining('jsonb_build_array'),
                expect.anything()
            );
        });
    });

    describe('pg_jsonb_keys', () => {
        it('should get all keys from JSONB', async () => {
            mockAdapter.executeQuery.mockResolvedValueOnce({
                rows: [{ key: 'name' }, { key: 'email' }, { key: 'age' }]
            });

            const tool = findTool('pg_jsonb_keys');
            const result = await tool!.handler({
                table: 'users',
                column: 'data'
            }, mockContext) as { keys: string[] };

            expect(result.keys).toEqual(['name', 'email', 'age']);
            expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
                expect.stringContaining('jsonb_object_keys')
            );
        });
    });

    describe('pg_jsonb_strip_nulls', () => {
        it('should remove null values from JSONB', async () => {
            mockAdapter.executeQuery.mockResolvedValueOnce({ rowsAffected: 5 });

            const tool = findTool('pg_jsonb_strip_nulls');
            const result = await tool!.handler({
                table: 'users',
                column: 'data',
                where: 'id > 0'
            }, mockContext) as { rowsAffected: number };

            expect(result.rowsAffected).toBe(5);
            expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
                expect.stringContaining('jsonb_strip_nulls')
            );
        });
    });

    describe('pg_jsonb_typeof', () => {
        it('should get type of JSONB values', async () => {
            mockAdapter.executeQuery.mockResolvedValueOnce({
                rows: [{ type: 'object' }, { type: 'array' }]
            });

            const tool = findTool('pg_jsonb_typeof');
            const result = await tool!.handler({
                table: 'data',
                column: 'content'
            }, mockContext) as { types: string[] };

            expect(result.types).toEqual(['object', 'array']);
            expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
                expect.stringContaining('jsonb_typeof'),
                []
            );
        });

        it('should check type at specific path', async () => {
            mockAdapter.executeQuery.mockResolvedValueOnce({
                rows: [{ type: 'string' }]
            });

            const tool = findTool('pg_jsonb_typeof');
            await tool!.handler({
                table: 'data',
                column: 'content',
                path: ['nested', 'field']
            }, mockContext);

            expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
                expect.stringContaining('#>'),
                [['nested', 'field']]
            );
        });
    });

    // Advanced JSONB Tools

    describe('pg_jsonb_validate_path', () => {
        it('should validate valid JSONPath', async () => {
            mockAdapter.executeQuery.mockResolvedValueOnce({
                rows: [{ path: '$.items[*].name' }]
            });

            const tool = findTool('pg_jsonb_validate_path');
            const result = await tool!.handler({
                path: '$.items[*].name'
            }, mockContext) as { valid: boolean };

            expect(result.valid).toBe(true);
        });

        it('should test path against value', async () => {
            mockAdapter.executeQuery.mockResolvedValueOnce({
                rows: [{ result: 'apple' }, { result: 'banana' }]
            });

            const tool = findTool('pg_jsonb_validate_path');
            const result = await tool!.handler({
                path: '$.items[*]',
                testValue: { items: ['apple', 'banana'] }
            }, mockContext) as { valid: boolean; results: string[] };

            expect(result.valid).toBe(true);
            expect(result.results).toHaveLength(2);
        });

        it('should return invalid for bad path', async () => {
            mockAdapter.executeQuery.mockRejectedValueOnce(new Error('Invalid path'));

            const tool = findTool('pg_jsonb_validate_path');
            const result = await tool!.handler({
                path: '$.invalid[[['
            }, mockContext) as { valid: boolean; error: string };

            expect(result.valid).toBe(false);
            expect(result.error).toBeDefined();
        });
    });

    describe('pg_jsonb_merge', () => {
        it('should merge two JSONB documents with deep merge', async () => {
            // Deep merge now happens entirely in TypeScript, no PostgreSQL call needed
            const tool = findTool('pg_jsonb_merge');
            const result = await tool!.handler({
                base: { a: 1, b: 2 },
                overlay: { c: 3 }
            }, mockContext) as { merged: Record<string, number>; deep: boolean };

            expect(result.merged).toEqual({ a: 1, b: 2, c: 3 });
            expect(result.deep).toBe(true);
            // Deep merge no longer calls PostgreSQL
        });

        it('should shallow merge with deep=false', async () => {
            mockAdapter.executeQuery.mockResolvedValueOnce({
                rows: [{ result: { a: 1, b: 2, c: 3 } }]
            });

            const tool = findTool('pg_jsonb_merge');
            const result = await tool!.handler({
                base: { a: 1, b: 2 },
                overlay: { c: 3 },
                deep: false
            }, mockContext) as { merged: Record<string, number>; deep: boolean };

            expect(result.merged).toEqual({ a: 1, b: 2, c: 3 });
            expect(result.deep).toBe(false);
            expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
                expect.stringContaining('||'),
                expect.anything()
            );
        });
    });

    describe('pg_jsonb_normalize', () => {
        it('should normalize JSONB to key-value pairs', async () => {
            // First call: idColumn detection
            mockAdapter.executeQuery.mockResolvedValueOnce({ rows: [] }); // No 'id' column
            // Second call: actual query
            mockAdapter.executeQuery.mockResolvedValueOnce({
                rows: [
                    { key: 'name', value: 'John' },
                    { key: 'age', value: '30' }
                ]
            });

            const tool = findTool('pg_jsonb_normalize');
            const result = await tool!.handler({
                table: 'users',
                column: 'data',
                mode: 'keys'
            }, mockContext) as { rows: unknown[]; count: number };

            expect(result.count).toBe(2);
            expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
                expect.stringContaining('jsonb_each_text')
            );
        });

        it('should expand arrays to rows', async () => {
            mockAdapter.executeQuery.mockResolvedValueOnce({
                rows: [{ element: 'a' }, { element: 'b' }]
            });

            const tool = findTool('pg_jsonb_normalize');
            await tool!.handler({
                table: 'data',
                column: 'items',
                mode: 'array'
            }, mockContext);

            expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
                expect.stringContaining('jsonb_array_elements')
            );
        });
    });

    describe('pg_jsonb_diff', () => {
        it('should compare two JSONB documents', async () => {
            mockAdapter.executeQuery.mockResolvedValueOnce({
                rows: [
                    { key: 'name', status: 'modified', value1: 'John', value2: 'Jane' },
                    { key: 'email', status: 'added', value1: null, value2: 'jane@example.com' }
                ]
            });

            const tool = findTool('pg_jsonb_diff');
            const result = await tool!.handler({
                doc1: { name: 'John' },
                doc2: { name: 'Jane', email: 'jane@example.com' }
            }, mockContext) as { differences: unknown[]; hasDifferences: boolean };

            expect(result.hasDifferences).toBe(true);
            expect(result.differences).toHaveLength(2);
        });
    });

    describe('pg_jsonb_index_suggest', () => {
        it('should suggest indexes based on key distribution', async () => {
            mockAdapter.executeQuery
                .mockResolvedValueOnce({
                    rows: [
                        { key: 'status', frequency: 800, value_type: 'string' },
                        { key: 'created_at', frequency: 1000, value_type: 'string' }
                    ]
                })
                .mockResolvedValueOnce({ rows: [] });

            const tool = findTool('pg_jsonb_index_suggest');
            const result = await tool!.handler({
                table: 'events',
                column: 'data'
            }, mockContext) as { recommendations: string[] };

            expect(result.recommendations.length).toBeGreaterThan(0);
            expect(result.recommendations[0]).toContain('GIN');
        });
    });

    describe('pg_jsonb_security_scan', () => {
        it('should detect sensitive keys', async () => {
            mockAdapter.executeQuery
                .mockResolvedValueOnce({ rows: [{ count: 50 }] })  // Count query
                .mockResolvedValueOnce({
                    rows: [{ key: 'password', count: 5 }]
                })
                .mockResolvedValueOnce({ rows: [] })
                .mockResolvedValueOnce({ rows: [] });  // XSS scan

            const tool = findTool('pg_jsonb_security_scan');
            const result = await tool!.handler({
                table: 'users',
                column: 'data'
            }, mockContext) as { issues: Array<{ type: string }>; riskLevel: string; scannedRows: number };

            expect(result.issues).toHaveLength(1);
            expect(result.issues[0].type).toBe('sensitive_key');
            expect(result.riskLevel).toBe('medium');
            expect(result.scannedRows).toBe(50);
        });

        it('should detect SQL injection patterns', async () => {
            mockAdapter.executeQuery
                .mockResolvedValueOnce({ rows: [{ count: 100 }] })  // Count query
                .mockResolvedValueOnce({ rows: [] })
                .mockResolvedValueOnce({
                    rows: [{ key: 'comment', count: 2 }]
                })
                .mockResolvedValueOnce({ rows: [] });  // XSS scan

            const tool = findTool('pg_jsonb_security_scan');
            const result = await tool!.handler({
                table: 'posts',
                column: 'data'
            }, mockContext) as { issues: Array<{ type: string }> };

            expect(result.issues.some(i => i.type === 'sql_injection_pattern')).toBe(true);
        });

        it('should report low risk when no issues', async () => {
            mockAdapter.executeQuery
                .mockResolvedValueOnce({ rows: [{ count: 100 }] })  // Count query
                .mockResolvedValueOnce({ rows: [] })
                .mockResolvedValueOnce({ rows: [] })
                .mockResolvedValueOnce({ rows: [] });  // XSS scan

            const tool = findTool('pg_jsonb_security_scan');
            const result = await tool!.handler({
                table: 'clean_data',
                column: 'data'
            }, mockContext) as { riskLevel: string };

            expect(result.riskLevel).toBe('low');
        });
    });

    describe('pg_jsonb_stats', () => {
        it('should return JSONB statistics', async () => {
            mockAdapter.executeQuery
                .mockResolvedValueOnce({
                    rows: [{
                        total_rows: 1000,
                        non_null_count: 950,
                        avg_size_bytes: 256,
                        max_size_bytes: 2048
                    }]
                })
                .mockResolvedValueOnce({
                    rows: [
                        { key: 'status', frequency: 950 },
                        { key: 'type', frequency: 900 }
                    ]
                })
                .mockResolvedValueOnce({
                    rows: [{ type: 'object', count: 950 }]
                });

            const tool = findTool('pg_jsonb_stats');
            const result = await tool!.handler({
                table: 'events',
                column: 'data'
            }, mockContext) as {
                basics: { total_rows: number };
                topKeys: unknown[];
                typeDistribution: unknown[];
            };

            expect(result.basics.total_rows).toBe(1000);
            expect(result.topKeys).toHaveLength(2);
            expect(result.typeDistribution).toHaveLength(1);
        });
    });

    it('should export all 19 JSONB tools', () => {
        expect(tools).toHaveLength(19);
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
});
