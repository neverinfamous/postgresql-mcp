/**
 * postgres-mcp - Partitioning Tools Unit Tests
 * 
 * Tests for PostgreSQL partitioning tools with focus on
 * partition management, creation, and attachment operations.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getPartitioningTools } from '../partitioning.js';
import type { PostgresAdapter } from '../../PostgresAdapter.js';
import {
    createMockPostgresAdapter,
    createMockRequestContext
} from '../../../../__tests__/mocks/index.js';

describe('getPartitioningTools', () => {
    let adapter: PostgresAdapter;
    let tools: ReturnType<typeof getPartitioningTools>;

    beforeEach(() => {
        vi.clearAllMocks();
        adapter = createMockPostgresAdapter() as unknown as PostgresAdapter;
        tools = getPartitioningTools(adapter);
    });

    it('should return 6 partitioning tools', () => {
        expect(tools).toHaveLength(6);
    });

    it('should have all expected tool names', () => {
        const toolNames = tools.map(t => t.name);
        expect(toolNames).toContain('pg_list_partitions');
        expect(toolNames).toContain('pg_create_partitioned_table');
        expect(toolNames).toContain('pg_create_partition');
        expect(toolNames).toContain('pg_attach_partition');
        expect(toolNames).toContain('pg_detach_partition');
        expect(toolNames).toContain('pg_partition_info');
    });

    it('should have group set to partitioning for all tools', () => {
        for (const tool of tools) {
            expect(tool.group).toBe('partitioning');
        }
    });
});

describe('pg_list_partitions', () => {
    let mockAdapter: ReturnType<typeof createMockPostgresAdapter>;
    let tools: ReturnType<typeof getPartitioningTools>;
    let mockContext: ReturnType<typeof createMockRequestContext>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockAdapter = createMockPostgresAdapter();
        tools = getPartitioningTools(mockAdapter as unknown as PostgresAdapter);
        mockContext = createMockRequestContext();
    });

    it('should list partitions of a table', async () => {
        mockAdapter.executeQuery.mockResolvedValueOnce({
            rows: [
                { partition_name: 'events_2023', partition_bounds: "FOR VALUES FROM ('2023-01-01') TO ('2024-01-01')", size: '100 MB' }
            ]
        });

        const tool = tools.find(t => t.name === 'pg_list_partitions')!;
        const result = await tool.handler({
            table: 'events'
        }, mockContext) as {
            partitions: unknown[];
            count: number;
        };

        expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
            expect.stringContaining('pg_inherits'),
            ['public', 'events']
        );
        expect(result.count).toBe(1);
        expect(result.partitions).toHaveLength(1);
    });

    it('should use specified schema', async () => {
        mockAdapter.executeQuery.mockResolvedValueOnce({ rows: [] });

        const tool = tools.find(t => t.name === 'pg_list_partitions')!;
        await tool.handler({
            table: 'events',
            schema: 'analytics'
        }, mockContext);

        expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
            expect.any(String),
            ['analytics', 'events']
        );
    });
});

describe('pg_create_partitioned_table', () => {
    let mockAdapter: ReturnType<typeof createMockPostgresAdapter>;
    let tools: ReturnType<typeof getPartitioningTools>;
    let mockContext: ReturnType<typeof createMockRequestContext>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockAdapter = createMockPostgresAdapter();
        tools = getPartitioningTools(mockAdapter as unknown as PostgresAdapter);
        mockContext = createMockRequestContext();
    });

    it('should create a RANGE partitioned table', async () => {
        mockAdapter.executeQuery.mockResolvedValueOnce({ rows: [] });

        const tool = tools.find(t => t.name === 'pg_create_partitioned_table')!;
        const result = await tool.handler({
            name: 'events',
            columns: [
                { name: 'id', type: 'bigint' },
                { name: 'event_date', type: 'date', nullable: false },
                { name: 'data', type: 'jsonb' }
            ],
            partitionBy: 'range',
            partitionKey: 'event_date'
        }, mockContext) as {
            success: boolean;
            table: string;
            partitionBy: string;
            partitionKey: string;
        };

        const call = mockAdapter.executeQuery.mock.calls[0][0] as string;
        expect(call).toContain('CREATE TABLE');
        expect(call).toContain('PARTITION BY RANGE (event_date)');
        expect(result.success).toBe(true);
        expect(result.partitionBy).toBe('range');
    });

    it('should create a LIST partitioned table', async () => {
        mockAdapter.executeQuery.mockResolvedValueOnce({ rows: [] });

        const tool = tools.find(t => t.name === 'pg_create_partitioned_table')!;
        await tool.handler({
            name: 'orders',
            columns: [
                { name: 'id', type: 'serial' },
                { name: 'region', type: 'varchar(50)' }
            ],
            partitionBy: 'list',
            partitionKey: 'region'
        }, mockContext);

        const call = mockAdapter.executeQuery.mock.calls[0][0] as string;
        expect(call).toContain('PARTITION BY LIST (region)');
    });

    it('should handle NOT NULL columns', async () => {
        mockAdapter.executeQuery.mockResolvedValueOnce({ rows: [] });

        const tool = tools.find(t => t.name === 'pg_create_partitioned_table')!;
        await tool.handler({
            name: 'data',
            columns: [
                { name: 'id', type: 'bigint', nullable: false }
            ],
            partitionBy: 'hash',
            partitionKey: 'id'
        }, mockContext);

        const call = mockAdapter.executeQuery.mock.calls[0][0] as string;
        expect(call).toContain('NOT NULL');
    });
});

describe('pg_create_partition', () => {
    let mockAdapter: ReturnType<typeof createMockPostgresAdapter>;
    let tools: ReturnType<typeof getPartitioningTools>;
    let mockContext: ReturnType<typeof createMockRequestContext>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockAdapter = createMockPostgresAdapter();
        tools = getPartitioningTools(mockAdapter as unknown as PostgresAdapter);
        mockContext = createMockRequestContext();
    });

    it('should create a RANGE partition', async () => {
        mockAdapter.executeQuery.mockResolvedValueOnce({ rows: [] });

        const tool = tools.find(t => t.name === 'pg_create_partition')!;
        const result = await tool.handler({
            parent: 'events',
            name: 'events_2024',
            forValues: "FROM ('2024-01-01') TO ('2025-01-01')"
        }, mockContext) as {
            success: boolean;
            partition: string;
            bounds: string;
        };

        const call = mockAdapter.executeQuery.mock.calls[0][0] as string;
        expect(call).toContain('PARTITION OF');
        expect(call).toContain('FOR VALUES');
        expect(result.success).toBe(true);
        expect(result.partition).toContain('events_2024');
    });

    it('should create a LIST partition', async () => {
        mockAdapter.executeQuery.mockResolvedValueOnce({ rows: [] });

        const tool = tools.find(t => t.name === 'pg_create_partition')!;
        await tool.handler({
            parent: 'orders',
            name: 'orders_us',
            forValues: "IN ('US', 'CA')"
        }, mockContext);

        const call = mockAdapter.executeQuery.mock.calls[0][0] as string;
        expect(call).toContain("IN ('US', 'CA')");
    });
});

describe('pg_attach_partition', () => {
    let mockAdapter: ReturnType<typeof createMockPostgresAdapter>;
    let tools: ReturnType<typeof getPartitioningTools>;
    let mockContext: ReturnType<typeof createMockRequestContext>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockAdapter = createMockPostgresAdapter();
        tools = getPartitioningTools(mockAdapter as unknown as PostgresAdapter);
        mockContext = createMockRequestContext();
    });

    it('should attach a partition', async () => {
        mockAdapter.executeQuery.mockResolvedValueOnce({ rows: [] });

        const tool = tools.find(t => t.name === 'pg_attach_partition')!;
        const result = await tool.handler({
            parent: 'events',
            partition: 'legacy_events',
            forValues: "FROM ('2020-01-01') TO ('2021-01-01')"
        }, mockContext) as {
            success: boolean;
            parent: string;
            partition: string;
        };

        const call = mockAdapter.executeQuery.mock.calls[0][0] as string;
        expect(call).toContain('ALTER TABLE');
        expect(call).toContain('ATTACH PARTITION');
        expect(result.success).toBe(true);
        expect(result.parent).toBe('events');
        expect(result.partition).toBe('legacy_events');
    });
});

describe('pg_detach_partition', () => {
    let mockAdapter: ReturnType<typeof createMockPostgresAdapter>;
    let tools: ReturnType<typeof getPartitioningTools>;
    let mockContext: ReturnType<typeof createMockRequestContext>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockAdapter = createMockPostgresAdapter();
        tools = getPartitioningTools(mockAdapter as unknown as PostgresAdapter);
        mockContext = createMockRequestContext();
    });

    it('should detach a partition', async () => {
        mockAdapter.executeQuery.mockResolvedValueOnce({ rows: [] });

        const tool = tools.find(t => t.name === 'pg_detach_partition')!;
        const result = await tool.handler({
            parent: 'events',
            partition: 'events_2020'
        }, mockContext) as {
            success: boolean;
            parent: string;
            detached: string;
        };

        const call = mockAdapter.executeQuery.mock.calls[0][0] as string;
        expect(call).toContain('DETACH PARTITION');
        expect(result.success).toBe(true);
        expect(result.detached).toBe('events_2020');
    });

    it('should detach concurrently when specified', async () => {
        mockAdapter.executeQuery.mockResolvedValueOnce({ rows: [] });

        const tool = tools.find(t => t.name === 'pg_detach_partition')!;
        await tool.handler({
            parent: 'events',
            partition: 'events_2020',
            concurrently: true
        }, mockContext);

        const call = mockAdapter.executeQuery.mock.calls[0][0] as string;
        expect(call).toContain('CONCURRENTLY');
    });
});

describe('pg_partition_info', () => {
    let mockAdapter: ReturnType<typeof createMockPostgresAdapter>;
    let tools: ReturnType<typeof getPartitioningTools>;
    let mockContext: ReturnType<typeof createMockRequestContext>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockAdapter = createMockPostgresAdapter();
        tools = getPartitioningTools(mockAdapter as unknown as PostgresAdapter);
        mockContext = createMockRequestContext();
    });

    it('should get partition info', async () => {
        mockAdapter.executeQuery
            .mockResolvedValueOnce({
                rows: [{
                    table_name: 'events',
                    partition_strategy: 'RANGE',
                    partition_key: 'event_date',
                    partition_count: 4
                }]
            })
            .mockResolvedValueOnce({
                rows: [
                    { partition_name: 'events_2021', bounds: "FOR VALUES FROM ('2021-01-01') TO ('2022-01-01')", size: '50 MB', size_bytes: 52428800, approx_rows: 100000 },
                    { partition_name: 'events_2022', bounds: "FOR VALUES FROM ('2022-01-01') TO ('2023-01-01')", size: '75 MB', size_bytes: 78643200, approx_rows: 150000 }
                ]
            });

        const tool = tools.find(t => t.name === 'pg_partition_info')!;
        const result = await tool.handler({
            table: 'events'
        }, mockContext) as {
            tableInfo: unknown;
            partitions: unknown[];
            totalSizeBytes: number;
        };

        expect(result.tableInfo).toHaveProperty('partition_strategy', 'RANGE');
        expect(result.partitions).toHaveLength(2);
        expect(result.totalSizeBytes).toBe(52428800 + 78643200);
    });
});
