/**
 * postgres-mcp - Vector (pgvector) Tools Unit Tests
 * 
 * Tests for pgvector operations covering tool definitions,
 * schema validation, and handler execution.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getVectorTools } from '../index.js';
import type { PostgresAdapter } from '../../../PostgresAdapter.js';
import {
    createMockPostgresAdapter,
    createMockRequestContext
} from '../../../../../__tests__/mocks/index.js';

describe('getVectorTools', () => {
    let adapter: PostgresAdapter;
    let tools: ReturnType<typeof getVectorTools>;

    beforeEach(() => {
        vi.clearAllMocks();
        adapter = createMockPostgresAdapter() as unknown as PostgresAdapter;
        tools = getVectorTools(adapter);
    });

    it('should return 14 vector tools', () => {
        expect(tools).toHaveLength(14);
    });

    it('should have all expected tool names', () => {
        const toolNames = tools.map(t => t.name);
        // Basic tools
        expect(toolNames).toContain('pg_vector_create_extension');
        expect(toolNames).toContain('pg_vector_add_column');
        expect(toolNames).toContain('pg_vector_insert');
        expect(toolNames).toContain('pg_vector_search');
        expect(toolNames).toContain('pg_vector_create_index');
        expect(toolNames).toContain('pg_vector_distance');
        expect(toolNames).toContain('pg_vector_normalize');
        expect(toolNames).toContain('pg_vector_aggregate');
        // Advanced tools
        expect(toolNames).toContain('pg_vector_cluster');
        expect(toolNames).toContain('pg_vector_index_optimize');
        expect(toolNames).toContain('pg_hybrid_search');
        expect(toolNames).toContain('pg_vector_performance');
        expect(toolNames).toContain('pg_vector_dimension_reduce');
        expect(toolNames).toContain('pg_vector_embed');
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

    it('should have group set to vector for all tools', () => {
        for (const tool of tools) {
            expect(tool.group).toBe('vector');
        }
    });
});

describe('Tool Annotations', () => {
    let tools: ReturnType<typeof getVectorTools>;

    beforeEach(() => {
        tools = getVectorTools(createMockPostgresAdapter() as unknown as PostgresAdapter);
    });

    it('pg_vector_search should be read-only', () => {
        const tool = tools.find(t => t.name === 'pg_vector_search')!;
        expect(tool.annotations?.readOnlyHint).toBe(true);
    });

    it('pg_vector_distance should be read-only', () => {
        const tool = tools.find(t => t.name === 'pg_vector_distance')!;
        expect(tool.annotations?.readOnlyHint).toBe(true);
    });

    it('pg_vector_insert should be destructive', () => {
        const tool = tools.find(t => t.name === 'pg_vector_insert')!;
        expect(tool.annotations?.readOnlyHint).toBe(false);
    });

    it('pg_vector_add_column should be destructive', () => {
        const tool = tools.find(t => t.name === 'pg_vector_add_column')!;
        expect(tool.annotations?.readOnlyHint).toBe(false);
    });
});

describe('Handler Execution', () => {
    let mockAdapter: ReturnType<typeof createMockPostgresAdapter>;
    let tools: ReturnType<typeof getVectorTools>;
    let mockContext: ReturnType<typeof createMockRequestContext>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockAdapter = createMockPostgresAdapter();
        tools = getVectorTools(mockAdapter as unknown as PostgresAdapter);
        mockContext = createMockRequestContext();
    });

    describe('pg_vector_create_extension', () => {
        it('should check/create vector extension', async () => {
            mockAdapter.executeQuery.mockResolvedValue({ rows: [] });

            const tool = tools.find(t => t.name === 'pg_vector_create_extension')!;
            const result = await tool.handler({}, mockContext) as Record<string, unknown>;

            expect(mockAdapter.executeQuery).toHaveBeenCalled();
            expect(result).toBeDefined();
        });
    });

    describe('pg_vector_search', () => {
        it('should execute vector similarity search', async () => {
            mockAdapter.executeQuery.mockResolvedValue({
                rows: [
                    { id: 1, distance: 0.1 },
                    { id: 2, distance: 0.2 }
                ]
            });

            const tool = tools.find(t => t.name === 'pg_vector_search')!;
            const result = await tool.handler({
                table: 'embeddings',
                column: 'embedding',
                vector: [0.1, 0.2, 0.3],
                limit: 10
            }, mockContext) as Record<string, unknown>;

            expect(mockAdapter.executeQuery).toHaveBeenCalled();
            expect(result).toBeDefined();
        });
    });

    describe('pg_vector_normalize', () => {
        it('should normalize a vector', async () => {
            const tool = tools.find(t => t.name === 'pg_vector_normalize')!;
            const result = await tool.handler({
                vector: [3, 4]
            }, mockContext) as { normalized: number[] };

            // [3, 4] normalized = [0.6, 0.8]
            expect(result.normalized).toBeDefined();
            expect(result.normalized).toHaveLength(2);
        });
    });

    describe('pg_vector_embed', () => {
        it('should generate embedding placeholder', async () => {
            const tool = tools.find(t => t.name === 'pg_vector_embed')!;
            const result = await tool.handler({
                text: 'Hello world',
                dimensions: 384
            }, mockContext) as Record<string, unknown>;

            expect(result).toBeDefined();
        });
    });

    describe('pg_vector_performance', () => {
        it('should analyze vector index performance', async () => {
            mockAdapter.executeQuery
                .mockResolvedValueOnce({ rows: [{ indexname: 'idx_vectors' }] })
                .mockResolvedValueOnce({ rows: [{ size: '10 MB' }] });

            const tool = tools.find(t => t.name === 'pg_vector_performance')!;
            const result = await tool.handler({
                table: 'embeddings',
                column: 'embedding'
            }, mockContext) as Record<string, unknown>;

            expect(mockAdapter.executeQuery).toHaveBeenCalled();
            expect(result).toBeDefined();
        });
    });
});

describe('Error Handling', () => {
    let mockAdapter: ReturnType<typeof createMockPostgresAdapter>;
    let tools: ReturnType<typeof getVectorTools>;
    let mockContext: ReturnType<typeof createMockRequestContext>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockAdapter = createMockPostgresAdapter();
        tools = getVectorTools(mockAdapter as unknown as PostgresAdapter);
        mockContext = createMockRequestContext();
    });

    it('should propagate database errors', async () => {
        const dbError = new Error('extension "vector" is not available');
        mockAdapter.executeQuery.mockRejectedValue(dbError);

        const tool = tools.find(t => t.name === 'pg_vector_create_extension')!;

        await expect(tool.handler({}, mockContext)).rejects.toThrow('extension "vector" is not available');
    });
});
