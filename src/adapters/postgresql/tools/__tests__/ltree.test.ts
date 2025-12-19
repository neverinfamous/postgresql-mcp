/**
 * postgres-mcp - Ltree Extension Tools Unit Tests
 * 
 * Tests for hierarchical tree-structured label tools.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PostgresAdapter } from '../../PostgresAdapter.js';
import { createMockPostgresAdapter, createMockRequestContext } from '../../../../__tests__/mocks/index.js';
import { getLtreeTools } from '../ltree.js';

describe('Ltree Tools', () => {
    let mockAdapter: ReturnType<typeof createMockPostgresAdapter>;
    let mockContext: ReturnType<typeof createMockRequestContext>;
    let tools: ReturnType<typeof getLtreeTools>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockAdapter = createMockPostgresAdapter();
        mockContext = createMockRequestContext();
        tools = getLtreeTools(mockAdapter as unknown as PostgresAdapter);
    });

    const findTool = (name: string) => tools.find(t => t.name === name);

    describe('pg_ltree_create_extension', () => {
        it('should create ltree extension', async () => {
            mockAdapter.executeQuery.mockResolvedValueOnce({ rows: [] });

            const tool = findTool('pg_ltree_create_extension');
            const result = await tool!.handler({}, mockContext) as { success: boolean; message: string };

            expect(result.success).toBe(true);
            expect(result.message).toContain('ltree');
            expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
                expect.stringContaining('CREATE EXTENSION IF NOT EXISTS ltree')
            );
        });
    });

    describe('pg_ltree_query', () => {
        it('should query descendants by default', async () => {
            mockAdapter.executeQuery.mockResolvedValueOnce({
                rows: [
                    { id: 1, path: 'root.child1', depth: 2 },
                    { id: 2, path: 'root.child1.grandchild', depth: 3 }
                ]
            });

            const tool = findTool('pg_ltree_query');
            const result = await tool!.handler({
                table: 'categories',
                column: 'path',
                path: 'root.child1'
            }, mockContext) as { mode: string; results: unknown[]; count: number };

            expect(result.mode).toBe('descendants');
            expect(result.count).toBe(2);
            expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
                expect.stringContaining('<@'),
                ['root.child1']
            );
        });

        it('should query ancestors when mode specified', async () => {
            mockAdapter.executeQuery.mockResolvedValueOnce({
                rows: [{ id: 1, path: 'root', depth: 1 }]
            });

            const tool = findTool('pg_ltree_query');
            await tool!.handler({
                table: 'categories',
                column: 'path',
                path: 'root.child1.grandchild',
                mode: 'ancestors'
            }, mockContext);

            expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
                expect.stringContaining('@>'),
                expect.anything()
            );
        });

        it('should query exact matches', async () => {
            mockAdapter.executeQuery.mockResolvedValueOnce({
                rows: [{ id: 1, path: 'root.child1', depth: 2 }]
            });

            const tool = findTool('pg_ltree_query');
            await tool!.handler({
                table: 'categories',
                column: 'path',
                path: 'root.child1',
                mode: 'exact'
            }, mockContext);

            expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
                expect.stringMatching(/= \$1::ltree/),
                expect.anything()
            );
        });

        it('should apply limit when specified', async () => {
            mockAdapter.executeQuery.mockResolvedValueOnce({ rows: [] });

            const tool = findTool('pg_ltree_query');
            await tool!.handler({
                table: 'categories',
                column: 'path',
                path: 'root',
                limit: 10
            }, mockContext);

            expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
                expect.stringContaining('LIMIT 10'),
                expect.anything()
            );
        });
    });

    describe('pg_ltree_subpath', () => {
        it('should extract subpath with offset only', async () => {
            mockAdapter.executeQuery.mockResolvedValueOnce({
                rows: [{ subpath: 'child1.grandchild', original_depth: 3 }]
            });

            const tool = findTool('pg_ltree_subpath');
            const result = await tool!.handler({
                path: 'root.child1.grandchild',
                offset: 1
            }, mockContext) as { subpath: string; originalDepth: number };

            expect(result.subpath).toBe('child1.grandchild');
            expect(result.originalDepth).toBe(3);
        });

        it('should extract subpath with offset and length', async () => {
            mockAdapter.executeQuery.mockResolvedValueOnce({
                rows: [{ subpath: 'child1', original_depth: 3 }]
            });

            const tool = findTool('pg_ltree_subpath');
            await tool!.handler({
                path: 'root.child1.grandchild',
                offset: 1,
                length: 1
            }, mockContext);

            expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
                expect.stringContaining('subpath($1::ltree, $2, $3)'),
                ['root.child1.grandchild', 1, 1]
            );
        });
    });

    describe('pg_ltree_lca', () => {
        it('should find lowest common ancestor', async () => {
            mockAdapter.executeQuery.mockResolvedValueOnce({
                rows: [{ lca: 'root.child1' }]
            });

            const tool = findTool('pg_ltree_lca');
            const result = await tool!.handler({
                paths: ['root.child1.a', 'root.child1.b', 'root.child1.c']
            }, mockContext) as { longestCommonAncestor: string; hasCommonAncestor: boolean };

            expect(result.longestCommonAncestor).toBe('root.child1');
            expect(result.hasCommonAncestor).toBe(true);
        });

        it('should handle no common ancestor', async () => {
            mockAdapter.executeQuery.mockResolvedValueOnce({
                rows: [{ lca: '' }]
            });

            const tool = findTool('pg_ltree_lca');
            const result = await tool!.handler({
                paths: ['a.b.c', 'x.y.z']
            }, mockContext) as { hasCommonAncestor: boolean };

            expect(result.hasCommonAncestor).toBe(false);
        });
    });

    describe('pg_ltree_match', () => {
        it('should match paths using lquery pattern', async () => {
            mockAdapter.executeQuery.mockResolvedValueOnce({
                rows: [
                    { id: 1, path: 'root.products.electronics', depth: 3 },
                    { id: 2, path: 'root.products.clothing', depth: 3 }
                ]
            });

            const tool = findTool('pg_ltree_match');
            const result = await tool!.handler({
                table: 'categories',
                column: 'path',
                pattern: 'root.products.*'
            }, mockContext) as { pattern: string; count: number };

            expect(result.count).toBe(2);
            expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
                expect.stringContaining('~ $1::lquery'),
                ['root.products.*']
            );
        });
    });

    describe('pg_ltree_list_columns', () => {
        it('should list all ltree columns', async () => {
            mockAdapter.executeQuery.mockResolvedValueOnce({
                rows: [
                    { table_schema: 'public', table_name: 'categories', column_name: 'path' }
                ]
            });

            const tool = findTool('pg_ltree_list_columns');
            const result = await tool!.handler({}, mockContext) as { columns: unknown[]; count: number };

            expect(result.count).toBe(1);
            expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
                expect.stringContaining("udt_name = 'ltree'"),
                []
            );
        });

        it('should filter by schema', async () => {
            mockAdapter.executeQuery.mockResolvedValueOnce({ rows: [] });

            const tool = findTool('pg_ltree_list_columns');
            await tool!.handler({ schema: 'custom' }, mockContext);

            expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
                expect.stringContaining('table_schema = $1'),
                ['custom']
            );
        });
    });

    describe('pg_ltree_convert_column', () => {
        it('should convert text column to ltree', async () => {
            mockAdapter.executeQuery
                .mockResolvedValueOnce({ rows: [{ data_type: 'text', udt_name: 'text' }] })
                .mockResolvedValueOnce({ rows: [] });

            const tool = findTool('pg_ltree_convert_column');
            const result = await tool!.handler({
                table: 'categories',
                column: 'path'
            }, mockContext) as { success: boolean; previousType: string };

            expect(result.success).toBe(true);
            expect(result.previousType).toBe('text');
            expect(mockAdapter.executeQuery).toHaveBeenLastCalledWith(
                expect.stringContaining('ALTER TABLE')
            );
        });

        it('should report column not found', async () => {
            mockAdapter.executeQuery.mockResolvedValueOnce({ rows: [] });

            const tool = findTool('pg_ltree_convert_column');
            const result = await tool!.handler({
                table: 'categories',
                column: 'nonexistent'
            }, mockContext) as { success: boolean; error?: string };

            expect(result.success).toBe(false);
            expect(result.error).toContain('not found');
        });

        it('should report already ltree column', async () => {
            mockAdapter.executeQuery.mockResolvedValueOnce({
                rows: [{ data_type: 'USER-DEFINED', udt_name: 'ltree' }]
            });

            const tool = findTool('pg_ltree_convert_column');
            const result = await tool!.handler({
                table: 'categories',
                column: 'path'
            }, mockContext) as { success: boolean; wasAlreadyLtree: boolean };

            expect(result.success).toBe(true);
            expect(result.wasAlreadyLtree).toBe(true);
        });
    });

    describe('pg_ltree_create_index', () => {
        it('should create GiST index on ltree column', async () => {
            mockAdapter.executeQuery
                .mockResolvedValueOnce({ rows: [{ exists: false }] })
                .mockResolvedValueOnce({ rows: [] });

            const tool = findTool('pg_ltree_create_index');
            const result = await tool!.handler({
                table: 'categories',
                column: 'path'
            }, mockContext) as { success: boolean; indexType: string };

            expect(result.success).toBe(true);
            expect(result.indexType).toBe('gist');
            expect(mockAdapter.executeQuery).toHaveBeenLastCalledWith(
                expect.stringContaining('USING GIST')
            );
        });

        it('should report existing index', async () => {
            mockAdapter.executeQuery.mockResolvedValueOnce({
                rows: [{ exists: true }]
            });

            const tool = findTool('pg_ltree_create_index');
            const result = await tool!.handler({
                table: 'categories',
                column: 'path'
            }, mockContext) as { success: boolean; alreadyExists: boolean };

            expect(result.success).toBe(true);
            expect(result.alreadyExists).toBe(true);
        });

        it('should use custom index name when provided', async () => {
            mockAdapter.executeQuery
                .mockResolvedValueOnce({ rows: [{ exists: false }] })
                .mockResolvedValueOnce({ rows: [] });

            const tool = findTool('pg_ltree_create_index');
            await tool!.handler({
                table: 'categories',
                column: 'path',
                indexName: 'custom_path_idx'
            }, mockContext);

            expect(mockAdapter.executeQuery).toHaveBeenLastCalledWith(
                expect.stringContaining('"custom_path_idx"')
            );
        });
    });

    it('should export all 8 ltree tools', () => {
        expect(tools).toHaveLength(8);
        const toolNames = tools.map(t => t.name);
        expect(toolNames).toContain('pg_ltree_create_extension');
        expect(toolNames).toContain('pg_ltree_query');
        expect(toolNames).toContain('pg_ltree_subpath');
        expect(toolNames).toContain('pg_ltree_lca');
        expect(toolNames).toContain('pg_ltree_match');
        expect(toolNames).toContain('pg_ltree_list_columns');
        expect(toolNames).toContain('pg_ltree_convert_column');
        expect(toolNames).toContain('pg_ltree_create_index');
    });
});
