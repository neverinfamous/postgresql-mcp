/**
 * postgres-mcp - Backup Tools Unit Tests
 * 
 * Tests for PostgreSQL backup tools including dump operations,
 * COPY commands, and backup planning.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getBackupTools } from '../index.js';
import type { PostgresAdapter } from '../../../PostgresAdapter.js';
import {
    createMockPostgresAdapter,
    createMockRequestContext
} from '../../../../../__tests__/mocks/index.js';

describe('getBackupTools', () => {
    let adapter: PostgresAdapter;
    let tools: ReturnType<typeof getBackupTools>;

    beforeEach(() => {
        vi.clearAllMocks();
        adapter = createMockPostgresAdapter() as unknown as PostgresAdapter;
        tools = getBackupTools(adapter);
    });

    it('should return 9 backup tools', () => {
        expect(tools).toHaveLength(9);
    });

    it('should have all expected tool names', () => {
        const toolNames = tools.map(t => t.name);
        expect(toolNames).toContain('pg_dump_table');
        expect(toolNames).toContain('pg_dump_schema');
        expect(toolNames).toContain('pg_copy_export');
        expect(toolNames).toContain('pg_copy_import');
        expect(toolNames).toContain('pg_create_backup_plan');
        expect(toolNames).toContain('pg_restore_command');
        expect(toolNames).toContain('pg_backup_physical');
        expect(toolNames).toContain('pg_restore_validate');
        expect(toolNames).toContain('pg_backup_schedule_optimize');
    });

    it('should have group set to backup for all tools', () => {
        for (const tool of tools) {
            expect(tool.group).toBe('backup');
        }
    });
});

describe('pg_dump_table', () => {
    let mockAdapter: ReturnType<typeof createMockPostgresAdapter>;
    let tools: ReturnType<typeof getBackupTools>;
    let mockContext: ReturnType<typeof createMockRequestContext>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockAdapter = createMockPostgresAdapter();
        tools = getBackupTools(mockAdapter as unknown as PostgresAdapter);
        mockContext = createMockRequestContext();
    });

    it('should generate CREATE TABLE statement', async () => {
        mockAdapter.describeTable.mockResolvedValueOnce({
            name: 'users',
            schema: 'public',
            type: 'table',
            columns: [
                { name: 'id', type: 'integer', nullable: false, primaryKey: true },
                { name: 'name', type: 'varchar(255)', nullable: true }
            ]
        });

        const tool = tools.find(t => t.name === 'pg_dump_table')!;
        const result = await tool.handler({
            table: 'users'
        }, mockContext) as {
            createTable: string;
        };

        expect(result.createTable).toContain('CREATE TABLE');
        expect(result.createTable).toContain('"id" integer');
        expect(result.createTable).toContain('NOT NULL');
    });

    it('should include data when requested', async () => {
        mockAdapter.describeTable.mockResolvedValueOnce({
            name: 'users',
            schema: 'public',
            type: 'table',
            columns: [{ name: 'id', type: 'integer', nullable: false }]
        });
        mockAdapter.executeQuery.mockResolvedValueOnce({
            rows: [{ id: 1 }, { id: 2 }]
        });

        const tool = tools.find(t => t.name === 'pg_dump_table')!;
        const result = await tool.handler({
            table: 'users',
            includeData: true
        }, mockContext) as {
            createTable: string;
            insertStatements: string;
        };

        expect(result.insertStatements).toContain('INSERT INTO');
        expect(result.insertStatements).toContain('VALUES');
    });

    it('should handle object-type default values', async () => {
        mockAdapter.describeTable.mockResolvedValueOnce({
            name: 'settings',
            schema: 'public',
            type: 'table',
            columns: [
                { name: 'id', type: 'integer', nullable: false },
                { name: 'config', type: 'jsonb', nullable: true, defaultValue: { key: 'value' } }
            ]
        });

        const tool = tools.find(t => t.name === 'pg_dump_table')!;
        const result = await tool.handler({
            table: 'settings'
        }, mockContext) as {
            createTable: string;
        };

        expect(result.createTable).toContain('DEFAULT');
        expect(result.createTable).toContain('"config" jsonb');
    });

    it('should handle non-string/number/boolean default values', async () => {
        mockAdapter.describeTable.mockResolvedValueOnce({
            name: 'test_table',
            schema: 'public',
            type: 'table',
            columns: [
                { name: 'id', type: 'integer', nullable: false },
                { name: 'data', type: 'text', nullable: true, defaultValue: Symbol('test') }
            ]
        });

        const tool = tools.find(t => t.name === 'pg_dump_table')!;
        const result = await tool.handler({
            table: 'test_table'
        }, mockContext) as {
            createTable: string;
        };

        // Should stringify unknown types
        expect(result.createTable).toContain('DEFAULT');
    });

    it('should handle string default values', async () => {
        mockAdapter.describeTable.mockResolvedValueOnce({
            name: 'users',
            schema: 'public',
            type: 'table',
            columns: [
                { name: 'status', type: 'varchar(50)', nullable: false, defaultValue: 'active' }
            ]
        });

        const tool = tools.find(t => t.name === 'pg_dump_table')!;
        const result = await tool.handler({
            table: 'users'
        }, mockContext) as {
            createTable: string;
        };

        expect(result.createTable).toContain('DEFAULT active');
    });

    it('should handle number default values', async () => {
        mockAdapter.describeTable.mockResolvedValueOnce({
            name: 'counters',
            schema: 'public',
            type: 'table',
            columns: [
                { name: 'count', type: 'integer', nullable: false, defaultValue: 0 }
            ]
        });

        const tool = tools.find(t => t.name === 'pg_dump_table')!;
        const result = await tool.handler({
            table: 'counters'
        }, mockContext) as {
            createTable: string;
        };

        expect(result.createTable).toContain('DEFAULT 0');
    });

    it('should handle boolean default values', async () => {
        mockAdapter.describeTable.mockResolvedValueOnce({
            name: 'flags',
            schema: 'public',
            type: 'table',
            columns: [
                { name: 'active', type: 'boolean', nullable: false, defaultValue: true }
            ]
        });

        const tool = tools.find(t => t.name === 'pg_dump_table')!;
        const result = await tool.handler({
            table: 'flags'
        }, mockContext) as {
            createTable: string;
        };

        expect(result.createTable).toContain('DEFAULT true');
    });

    it('should handle empty data set with includeData: true', async () => {
        mockAdapter.describeTable.mockResolvedValueOnce({
            name: 'empty_table',
            schema: 'public',
            type: 'table',
            columns: [{ name: 'id', type: 'integer', nullable: false }]
        });
        mockAdapter.executeQuery.mockResolvedValueOnce({
            rows: []
        });

        const tool = tools.find(t => t.name === 'pg_dump_table')!;
        const result = await tool.handler({
            table: 'empty_table',
            includeData: true
        }, mockContext) as {
            createTable: string;
            insertStatements?: string;
        };

        expect(result.createTable).toContain('CREATE TABLE');
        expect(result.insertStatements).toBeUndefined();
    });

    it('should handle undefined first row gracefully', async () => {
        mockAdapter.describeTable.mockResolvedValueOnce({
            name: 'sparse_table',
            schema: 'public',
            type: 'table',
            columns: [{ name: 'id', type: 'integer', nullable: false }]
        });
        // Mock query result with undefined in rows array
        mockAdapter.executeQuery.mockResolvedValueOnce({
            rows: [undefined]
        } as unknown as ReturnType<typeof mockAdapter.executeQuery>);

        const tool = tools.find(t => t.name === 'pg_dump_table')!;
        const result = await tool.handler({
            table: 'sparse_table',
            includeData: true
        }, mockContext);

        expect(result).toBeDefined();
    });
});

describe('pg_dump_schema', () => {
    let mockAdapter: ReturnType<typeof createMockPostgresAdapter>;
    let tools: ReturnType<typeof getBackupTools>;
    let mockContext: ReturnType<typeof createMockRequestContext>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockAdapter = createMockPostgresAdapter();
        tools = getBackupTools(mockAdapter as unknown as PostgresAdapter);
        mockContext = createMockRequestContext();
    });

    it('should generate pg_dump command', async () => {
        const tool = tools.find(t => t.name === 'pg_dump_schema')!;
        const result = await tool.handler({}, mockContext) as {
            command: string;
            notes: string[];
        };

        expect(result.command).toContain('pg_dump');
        expect(result.command).toContain('--format=custom');
        expect(result.notes).toBeInstanceOf(Array);
    });

    it('should include schema filter when specified', async () => {
        const tool = tools.find(t => t.name === 'pg_dump_schema')!;
        const result = await tool.handler({
            schema: 'public'
        }, mockContext) as {
            command: string;
        };

        expect(result.command).toContain('--schema="public"');
    });

    it('should include table filter when specified', async () => {
        const tool = tools.find(t => t.name === 'pg_dump_schema')!;
        const result = await tool.handler({
            table: 'users'
        }, mockContext) as {
            command: string;
        };

        expect(result.command).toContain('--table="users"');
    });
});

describe('pg_copy_export', () => {
    let mockAdapter: ReturnType<typeof createMockPostgresAdapter>;
    let tools: ReturnType<typeof getBackupTools>;
    let mockContext: ReturnType<typeof createMockRequestContext>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockAdapter = createMockPostgresAdapter();
        tools = getBackupTools(mockAdapter as unknown as PostgresAdapter);
        mockContext = createMockRequestContext();
    });

    it('should export query results as CSV', async () => {
        mockAdapter.executeQuery.mockResolvedValueOnce({
            rows: [
                { id: 1, name: 'Alice' },
                { id: 2, name: 'Bob' }
            ]
        });

        const tool = tools.find(t => t.name === 'pg_copy_export')!;
        const result = await tool.handler({
            query: 'SELECT * FROM users'
        }, mockContext) as {
            data: string;
            rowCount: number;
        };

        expect(result.data).toContain('id,name');
        expect(result.data).toContain('Alice');
        expect(result.rowCount).toBe(2);
    });

    it('should use custom delimiter', async () => {
        mockAdapter.executeQuery.mockResolvedValueOnce({
            rows: [{ id: 1, name: 'Test' }]
        });

        const tool = tools.find(t => t.name === 'pg_copy_export')!;
        const result = await tool.handler({
            query: 'SELECT * FROM users',
            delimiter: '|'
        }, mockContext) as {
            data: string;
        };

        expect(result.data).toContain('id|name');
    });

    it('should exclude header when specified', async () => {
        mockAdapter.executeQuery.mockResolvedValueOnce({
            rows: [{ id: 1 }]
        });

        const tool = tools.find(t => t.name === 'pg_copy_export')!;
        const result = await tool.handler({
            query: 'SELECT id FROM users',
            header: false
        }, mockContext) as {
            data: string;
        };

        expect(result.data).not.toContain('id,');
        expect(result.data).toBe('1');
    });

    it('should escape values containing delimiter', async () => {
        mockAdapter.executeQuery.mockResolvedValueOnce({
            rows: [{ id: 1, description: 'value,with,commas' }]
        });

        const tool = tools.find(t => t.name === 'pg_copy_export')!;
        const result = await tool.handler({
            query: 'SELECT * FROM test'
        }, mockContext) as { data: string };

        // Values with delimiter should be quoted
        expect(result.data).toContain('"value,with,commas"');
    });

    it('should escape values containing quotes', async () => {
        mockAdapter.executeQuery.mockResolvedValueOnce({
            rows: [{ id: 1, description: 'value "with" quotes' }]
        });

        const tool = tools.find(t => t.name === 'pg_copy_export')!;
        const result = await tool.handler({
            query: 'SELECT * FROM test'
        }, mockContext) as { data: string };

        // Quotes should be doubled and value quoted
        expect(result.data).toContain('""with""');
    });

    it('should escape values containing newlines', async () => {
        mockAdapter.executeQuery.mockResolvedValueOnce({
            rows: [{ id: 1, description: 'line1\nline2' }]
        });

        const tool = tools.find(t => t.name === 'pg_copy_export')!;
        const result = await tool.handler({
            query: 'SELECT * FROM test'
        }, mockContext) as { data: string };

        // Values with newlines should be quoted
        expect(result.data).toContain('"line1\nline2"');
    });

    it('should handle null values as empty string', async () => {
        mockAdapter.executeQuery.mockResolvedValueOnce({
            rows: [{ id: 1, name: null }]
        });

        const tool = tools.find(t => t.name === 'pg_copy_export')!;
        const result = await tool.handler({
            query: 'SELECT * FROM test'
        }, mockContext) as { data: string };

        expect(result.data).toContain('1,');
    });

    it('should handle object values as JSON', async () => {
        mockAdapter.executeQuery.mockResolvedValueOnce({
            rows: [{ id: 1, data: { key: 'value' } }]
        });

        const tool = tools.find(t => t.name === 'pg_copy_export')!;
        const result = await tool.handler({
            query: 'SELECT * FROM test'
        }, mockContext) as { data: string };

        expect(result.data).toContain('{"key":"value"}');
    });

    it('should return raw rows for non-CSV format', async () => {
        mockAdapter.executeQuery.mockResolvedValueOnce({
            rows: [{ id: 1, name: 'Test' }, { id: 2, name: 'User' }]
        });

        const tool = tools.find(t => t.name === 'pg_copy_export')!;
        const result = await tool.handler({
            query: 'SELECT * FROM test',
            format: 'text'
        }, mockContext) as { rows: unknown[]; rowCount: number };

        expect(result.rows).toHaveLength(2);
        expect(result.rowCount).toBe(2);
    });

    it('should handle empty result set', async () => {
        mockAdapter.executeQuery.mockResolvedValueOnce({
            rows: []
        });

        const tool = tools.find(t => t.name === 'pg_copy_export')!;
        const result = await tool.handler({
            query: 'SELECT * FROM empty_table'
        }, mockContext) as { data: string; rowCount: number };

        expect(result.data).toBe('');
        expect(result.rowCount).toBe(0);
    });

    it('should handle undefined rows gracefully', async () => {
        mockAdapter.executeQuery.mockResolvedValueOnce({
            rows: undefined
        } as unknown as ReturnType<typeof mockAdapter.executeQuery>);

        const tool = tools.find(t => t.name === 'pg_copy_export')!;
        const result = await tool.handler({
            query: 'SELECT * FROM test'
        }, mockContext) as { data: string; rowCount: number };

        expect(result.data).toBe('');
        expect(result.rowCount).toBe(0);
    });
});

describe('pg_copy_import', () => {
    let mockAdapter: ReturnType<typeof createMockPostgresAdapter>;
    let tools: ReturnType<typeof getBackupTools>;
    let mockContext: ReturnType<typeof createMockRequestContext>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockAdapter = createMockPostgresAdapter();
        tools = getBackupTools(mockAdapter as unknown as PostgresAdapter);
        mockContext = createMockRequestContext();
    });

    it('should generate COPY FROM command', async () => {
        const tool = tools.find(t => t.name === 'pg_copy_import')!;
        const result = await tool.handler({
            table: 'users'
        }, mockContext) as {
            command: string;
            stdinCommand: string;
        };

        expect(result.command).toContain('COPY');
        expect(result.command).toContain('FROM');
        expect(result.stdinCommand).toContain('STDIN');
    });

    it('should include schema qualifier', async () => {
        const tool = tools.find(t => t.name === 'pg_copy_import')!;
        const result = await tool.handler({
            table: 'users',
            schema: 'app'
        }, mockContext) as {
            command: string;
        };

        expect(result.command).toContain('"app"."users"');
    });

    it('should include column list', async () => {
        const tool = tools.find(t => t.name === 'pg_copy_import')!;
        const result = await tool.handler({
            table: 'users',
            columns: ['id', 'name', 'email']
        }, mockContext) as {
            command: string;
        };

        expect(result.command).toContain('"id"');
        expect(result.command).toContain('"name"');
        expect(result.command).toContain('"email"');
    });
});

describe('pg_create_backup_plan', () => {
    let mockAdapter: ReturnType<typeof createMockPostgresAdapter>;
    let tools: ReturnType<typeof getBackupTools>;
    let mockContext: ReturnType<typeof createMockRequestContext>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockAdapter = createMockPostgresAdapter();
        tools = getBackupTools(mockAdapter as unknown as PostgresAdapter);
        mockContext = createMockRequestContext();
    });

    it('should generate backup plan', async () => {
        mockAdapter.executeQuery.mockResolvedValueOnce({
            rows: [{ bytes: 1073741824 }]
        });

        const tool = tools.find(t => t.name === 'pg_create_backup_plan')!;
        const result = await tool.handler({}, mockContext) as {
            strategy: unknown;
            estimates: { databaseSize: string };
        };

        expect(result.strategy).toBeDefined();
        expect(result.estimates.databaseSize).toBeDefined();
    });
});

describe('pg_restore_command', () => {
    let mockAdapter: ReturnType<typeof createMockPostgresAdapter>;
    let tools: ReturnType<typeof getBackupTools>;
    let mockContext: ReturnType<typeof createMockRequestContext>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockAdapter = createMockPostgresAdapter();
        tools = getBackupTools(mockAdapter as unknown as PostgresAdapter);
        mockContext = createMockRequestContext();
    });

    it('should generate pg_restore command', async () => {
        const tool = tools.find(t => t.name === 'pg_restore_command')!;
        const result = await tool.handler({
            backupFile: 'backup.dump',
            database: 'mydb'
        }, mockContext) as {
            command: string;
        };

        expect(result.command).toContain('pg_restore');
        expect(result.command).toContain('backup.dump');
    });
});

describe('pg_backup_physical', () => {
    let mockAdapter: ReturnType<typeof createMockPostgresAdapter>;
    let tools: ReturnType<typeof getBackupTools>;
    let mockContext: ReturnType<typeof createMockRequestContext>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockAdapter = createMockPostgresAdapter();
        tools = getBackupTools(mockAdapter as unknown as PostgresAdapter);
        mockContext = createMockRequestContext();
    });

    it('should generate pg_basebackup command', async () => {
        const tool = tools.find(t => t.name === 'pg_backup_physical')!;
        const result = await tool.handler({
            targetDir: '/backups'
        }, mockContext) as {
            command: string;
        };

        expect(result.command).toContain('pg_basebackup');
        expect(result.command).toContain('/backups');
    });
});

describe('pg_restore_validate', () => {
    let mockAdapter: ReturnType<typeof createMockPostgresAdapter>;
    let tools: ReturnType<typeof getBackupTools>;
    let mockContext: ReturnType<typeof createMockRequestContext>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockAdapter = createMockPostgresAdapter();
        tools = getBackupTools(mockAdapter as unknown as PostgresAdapter);
        mockContext = createMockRequestContext();
    });

    it('should validate backup file', async () => {
        const tool = tools.find(t => t.name === 'pg_restore_validate')!;
        const result = await tool.handler({
            backupFile: 'backup.dump'
        }, mockContext) as {
            validationSteps: unknown[];
        };

        expect(result.validationSteps).toBeInstanceOf(Array);
    });
});

describe('pg_backup_schedule_optimize', () => {
    let mockAdapter: ReturnType<typeof createMockPostgresAdapter>;
    let tools: ReturnType<typeof getBackupTools>;
    let mockContext: ReturnType<typeof createMockRequestContext>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockAdapter = createMockPostgresAdapter();
        tools = getBackupTools(mockAdapter as unknown as PostgresAdapter);
        mockContext = createMockRequestContext();
    });

    it('should optimize backup schedule', async () => {
        // Mock the 3 parallel queries
        mockAdapter.executeQuery
            .mockResolvedValueOnce({ rows: [{ size_bytes: 10737418240, size: '10 GB' }] })
            .mockResolvedValueOnce({ rows: [{ total_changes: 10000, total_rows: 100000 }] })
            .mockResolvedValueOnce({ rows: [{ hour: 2, connection_count: 5 }] });

        const tool = tools.find(t => t.name === 'pg_backup_schedule_optimize')!;
        const result = await tool.handler({}, mockContext) as {
            analysis: unknown;
            recommendation: { strategy: string };
        };

        expect(result.analysis).toBeDefined();
        expect(result.recommendation).toBeDefined();
    });

    it('should recommend large database strategy for databases > 100GB', async () => {
        // 150 GB database
        mockAdapter.executeQuery
            .mockResolvedValueOnce({ rows: [{ size_bytes: 161061273600, size: '150 GB' }] })
            .mockResolvedValueOnce({ rows: [{ total_changes: 1000, total_rows: 100000 }] })
            .mockResolvedValueOnce({ rows: [] });

        const tool = tools.find(t => t.name === 'pg_backup_schedule_optimize')!;
        const result = await tool.handler({}, mockContext) as {
            recommendation: { strategy: string; fullBackupFrequency: string; incrementalFrequency: string };
        };

        expect(result.recommendation.strategy).toContain('Large database');
        expect(result.recommendation.fullBackupFrequency).toBe('Weekly');
        expect(result.recommendation.incrementalFrequency).toContain('WAL');
    });

    it('should recommend high change rate strategy for > 50% change rate', async () => {
        // 10 GB database with high change rate (60%)
        mockAdapter.executeQuery
            .mockResolvedValueOnce({ rows: [{ size_bytes: 10737418240, size: '10 GB' }] })
            .mockResolvedValueOnce({ rows: [{ total_changes: 60000, total_rows: 100000 }] })
            .mockResolvedValueOnce({ rows: [] });

        const tool = tools.find(t => t.name === 'pg_backup_schedule_optimize')!;
        const result = await tool.handler({}, mockContext) as {
            recommendation: { strategy: string; fullBackupFrequency: string; incrementalFrequency: string };
        };

        expect(result.recommendation.strategy).toContain('High change rate');
        expect(result.recommendation.fullBackupFrequency).toBe('Daily');
        expect(result.recommendation.incrementalFrequency).toBe('Every 6 hours');
    });

    it('should recommend moderate activity strategy for 10-50% change rate', async () => {
        // 10 GB database with moderate change rate (25%)
        mockAdapter.executeQuery
            .mockResolvedValueOnce({ rows: [{ size_bytes: 10737418240, size: '10 GB' }] })
            .mockResolvedValueOnce({ rows: [{ total_changes: 25000, total_rows: 100000 }] })
            .mockResolvedValueOnce({ rows: [] });

        const tool = tools.find(t => t.name === 'pg_backup_schedule_optimize')!;
        const result = await tool.handler({}, mockContext) as {
            recommendation: { strategy: string; fullBackupFrequency: string; incrementalFrequency: string };
        };

        expect(result.recommendation.strategy).toContain('Moderate activity');
        expect(result.recommendation.fullBackupFrequency).toBe('Daily');
        expect(result.recommendation.incrementalFrequency).toBe('Every 12 hours');
    });

    it('should recommend low activity strategy for < 10% change rate', async () => {
        // 10 GB database with low change rate (5%)
        mockAdapter.executeQuery
            .mockResolvedValueOnce({ rows: [{ size_bytes: 10737418240, size: '10 GB' }] })
            .mockResolvedValueOnce({ rows: [{ total_changes: 5000, total_rows: 100000 }] })
            .mockResolvedValueOnce({ rows: [] });

        const tool = tools.find(t => t.name === 'pg_backup_schedule_optimize')!;
        const result = await tool.handler({}, mockContext) as {
            recommendation: { strategy: string; fullBackupFrequency: string; incrementalFrequency: string };
        };

        expect(result.recommendation.strategy).toContain('Low activity');
        expect(result.recommendation.incrementalFrequency).toBe('Not required');
    });
});

describe('pg_backup_physical extended', () => {
    let mockAdapter: ReturnType<typeof createMockPostgresAdapter>;
    let tools: ReturnType<typeof getBackupTools>;
    let mockContext: ReturnType<typeof createMockRequestContext>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockAdapter = createMockPostgresAdapter();
        tools = getBackupTools(mockAdapter as unknown as PostgresAdapter);
        mockContext = createMockRequestContext();
    });

    it('should use plain format when specified', async () => {
        const tool = tools.find(t => t.name === 'pg_backup_physical')!;
        const result = await tool.handler({
            targetDir: '/backups',
            format: 'plain'
        }, mockContext) as { command: string };

        expect(result.command).toContain('-Fp');
        expect(result.command).not.toContain('-Ft');
    });

    it('should include fast checkpoint option', async () => {
        const tool = tools.find(t => t.name === 'pg_backup_physical')!;
        const result = await tool.handler({
            targetDir: '/backups',
            checkpoint: 'fast'
        }, mockContext) as { command: string };

        expect(result.command).toContain('-c fast');
    });

    it('should include compression with level', async () => {
        const tool = tools.find(t => t.name === 'pg_backup_physical')!;
        const result = await tool.handler({
            targetDir: '/backups',
            compress: 6
        }, mockContext) as { command: string };

        expect(result.command).toContain('-z');
        expect(result.command).toContain('-Z 6');
    });

    it('should not include compression when level is 0', async () => {
        const tool = tools.find(t => t.name === 'pg_backup_physical')!;
        const result = await tool.handler({
            targetDir: '/backups',
            compress: 0
        }, mockContext) as { command: string };

        expect(result.command).not.toContain('-z');
        expect(result.command).not.toContain('-Z');
    });
});

describe('pg_restore_validate extended', () => {
    let mockAdapter: ReturnType<typeof createMockPostgresAdapter>;
    let tools: ReturnType<typeof getBackupTools>;
    let mockContext: ReturnType<typeof createMockRequestContext>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockAdapter = createMockPostgresAdapter();
        tools = getBackupTools(mockAdapter as unknown as PostgresAdapter);
        mockContext = createMockRequestContext();
    });

    it('should return pg_basebackup validation steps for physical backup', async () => {
        const tool = tools.find(t => t.name === 'pg_restore_validate')!;
        const result = await tool.handler({
            backupFile: '/backups/base',
            backupType: 'pg_basebackup'
        }, mockContext) as {
            validationSteps: Array<{ step: number; name: string }>;
            recommendations: string[];
        };

        expect(result.validationSteps).toHaveLength(3);
        expect(result.validationSteps[0]?.name).toContain('Verify base backup');
        expect(result.validationSteps[1]?.name).toContain('backup_label');
        expect(result.recommendations).toContainEqual(expect.stringContaining('pg_verifybackup'));
    });

    it('should return pg_dump validation steps by default', async () => {
        const tool = tools.find(t => t.name === 'pg_restore_validate')!;
        const result = await tool.handler({
            backupFile: 'backup.dump'
        }, mockContext) as {
            validationSteps: Array<{ step: number; name: string }>;
        };

        expect(result.validationSteps).toHaveLength(3);
        expect(result.validationSteps[0]?.name).toContain('integrity');
    });
});

describe('pg_restore_command extended', () => {
    let mockAdapter: ReturnType<typeof createMockPostgresAdapter>;
    let tools: ReturnType<typeof getBackupTools>;
    let mockContext: ReturnType<typeof createMockRequestContext>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockAdapter = createMockPostgresAdapter();
        tools = getBackupTools(mockAdapter as unknown as PostgresAdapter);
        mockContext = createMockRequestContext();
    });

    it('should include database option', async () => {
        const tool = tools.find(t => t.name === 'pg_restore_command')!;
        const result = await tool.handler({
            backupFile: 'backup.dump',
            database: 'mydb'
        }, mockContext) as { command: string };

        expect(result.command).toContain('--dbname="mydb"');
    });

    it('should include schema option', async () => {
        const tool = tools.find(t => t.name === 'pg_restore_command')!;
        const result = await tool.handler({
            backupFile: 'backup.dump',
            schema: 'public'
        }, mockContext) as { command: string };

        expect(result.command).toContain('--schema="public"');
    });

    it('should include table option', async () => {
        const tool = tools.find(t => t.name === 'pg_restore_command')!;
        const result = await tool.handler({
            backupFile: 'backup.dump',
            table: 'users'
        }, mockContext) as { command: string };

        expect(result.command).toContain('--table="users"');
    });

    it('should include data-only flag', async () => {
        const tool = tools.find(t => t.name === 'pg_restore_command')!;
        const result = await tool.handler({
            backupFile: 'backup.dump',
            dataOnly: true
        }, mockContext) as { command: string };

        expect(result.command).toContain('--data-only');
    });

    it('should include schema-only flag', async () => {
        const tool = tools.find(t => t.name === 'pg_restore_command')!;
        const result = await tool.handler({
            backupFile: 'backup.dump',
            schemaOnly: true
        }, mockContext) as { command: string };

        expect(result.command).toContain('--schema-only');
    });
});

describe('pg_create_backup_plan extended', () => {
    let mockAdapter: ReturnType<typeof createMockPostgresAdapter>;
    let tools: ReturnType<typeof getBackupTools>;
    let mockContext: ReturnType<typeof createMockRequestContext>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockAdapter = createMockPostgresAdapter();
        tools = getBackupTools(mockAdapter as unknown as PostgresAdapter);
        mockContext = createMockRequestContext();
    });

    it('should use custom frequency', async () => {
        mockAdapter.executeQuery.mockResolvedValueOnce({
            rows: [{ bytes: 1073741824 }]
        });

        const tool = tools.find(t => t.name === 'pg_create_backup_plan')!;
        const result = await tool.handler({
            frequency: 'hourly'
        }, mockContext) as {
            strategy: { fullBackup: { frequency: string } };
        };

        expect(result.strategy.fullBackup.frequency).toBe('hourly');
    });

    it('should use custom retention', async () => {
        mockAdapter.executeQuery.mockResolvedValueOnce({
            rows: [{ bytes: 1073741824 }]
        });

        const tool = tools.find(t => t.name === 'pg_create_backup_plan')!;
        const result = await tool.handler({
            retention: 14
        }, mockContext) as {
            strategy: { fullBackup: { retention: string } };
        };

        expect(result.strategy.fullBackup.retention).toContain('14');
    });
});

