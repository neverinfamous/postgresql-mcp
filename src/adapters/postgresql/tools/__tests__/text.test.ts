/**
 * postgres-mcp - Text Tools Unit Tests
 * 
 * Tests for PostgreSQL text processing tools with focus on
 * full-text search, trigrams, fuzzy matching, and sentiment analysis.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getTextTools } from '../text.js';
import type { PostgresAdapter } from '../../PostgresAdapter.js';
import {
    createMockPostgresAdapter,
    createMockRequestContext
} from '../../../../__tests__/mocks/index.js';

describe('getTextTools', () => {
    let adapter: PostgresAdapter;
    let tools: ReturnType<typeof getTextTools>;

    beforeEach(() => {
        vi.clearAllMocks();
        adapter = createMockPostgresAdapter() as unknown as PostgresAdapter;
        tools = getTextTools(adapter);
    });

    it('should return 11 text tools', () => {
        expect(tools).toHaveLength(11);
    });

    it('should have all expected tool names', () => {
        const toolNames = tools.map(t => t.name);
        expect(toolNames).toContain('pg_text_search');
        expect(toolNames).toContain('pg_text_rank');
        expect(toolNames).toContain('pg_trigram_similarity');
        expect(toolNames).toContain('pg_fuzzy_match');
        expect(toolNames).toContain('pg_regexp_match');
        expect(toolNames).toContain('pg_like_search');
        expect(toolNames).toContain('pg_similarity_search');
        expect(toolNames).toContain('pg_text_headline');
        expect(toolNames).toContain('pg_create_fts_index');
        expect(toolNames).toContain('pg_text_normalize');
        expect(toolNames).toContain('pg_text_sentiment');
    });

    it('should have group set to text for all tools', () => {
        for (const tool of tools) {
            expect(tool.group).toBe('text');
        }
    });
});

describe('pg_text_search', () => {
    let mockAdapter: ReturnType<typeof createMockPostgresAdapter>;
    let tools: ReturnType<typeof getTextTools>;
    let mockContext: ReturnType<typeof createMockRequestContext>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockAdapter = createMockPostgresAdapter();
        tools = getTextTools(mockAdapter as unknown as PostgresAdapter);
        mockContext = createMockRequestContext();
    });

    it('should perform full-text search', async () => {
        mockAdapter.executeQuery.mockResolvedValueOnce({
            rows: [{ title: 'PostgreSQL Guide', rank: 0.9 }]
        });

        const tool = tools.find(t => t.name === 'pg_text_search')!;
        const result = await tool.handler({
            table: 'articles',
            columns: ['title', 'body'],
            query: 'postgres'
        }, mockContext) as {
            rows: unknown[];
            count: number;
        };

        expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
            expect.stringContaining('to_tsvector'),
            ['postgres']
        );
        expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
            expect.stringContaining('plainto_tsquery'),
            expect.any(Array)
        );
        expect(result.count).toBe(1);
    });

    it('should use custom config', async () => {
        mockAdapter.executeQuery.mockResolvedValueOnce({ rows: [] });

        const tool = tools.find(t => t.name === 'pg_text_search')!;
        await tool.handler({
            table: 'articles',
            columns: ['title'],
            query: 'test',
            config: 'german'
        }, mockContext);

        expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
            expect.stringContaining("to_tsvector('german'"),
            expect.any(Array)
        );
    });

    it('should use custom select columns when provided (line 53 branch)', async () => {
        mockAdapter.executeQuery.mockResolvedValueOnce({
            rows: [{ id: 1, title: 'Test', rank: 0.9 }]
        });

        const tool = tools.find(t => t.name === 'pg_text_search')!;
        await tool.handler({
            table: 'articles',
            columns: ['title', 'body'],
            query: 'postgres',
            select: ['id', 'title']
        }, mockContext);

        expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
            expect.stringContaining('SELECT "id", "title"'),
            expect.any(Array)
        );
    });

    it('should use * when select is empty array (line 53 branch)', async () => {
        mockAdapter.executeQuery.mockResolvedValueOnce({ rows: [] });

        const tool = tools.find(t => t.name === 'pg_text_search')!;
        await tool.handler({
            table: 'articles',
            columns: ['title'],
            query: 'test',
            select: []
        }, mockContext);

        expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
            expect.stringContaining('SELECT *'),
            expect.any(Array)
        );
    });

    it('should add LIMIT clause when limit > 0 (line 55 branch)', async () => {
        mockAdapter.executeQuery.mockResolvedValueOnce({ rows: [] });

        const tool = tools.find(t => t.name === 'pg_text_search')!;
        await tool.handler({
            table: 'articles',
            columns: ['title'],
            query: 'test',
            limit: 10
        }, mockContext);

        expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
            expect.stringContaining('LIMIT 10'),
            expect.any(Array)
        );
    });

    it('should not add LIMIT clause when limit is 0 (line 55 branch)', async () => {
        mockAdapter.executeQuery.mockResolvedValueOnce({ rows: [] });

        const tool = tools.find(t => t.name === 'pg_text_search')!;
        await tool.handler({
            table: 'articles',
            columns: ['title'],
            query: 'test',
            limit: 0
        }, mockContext);

        const sql = mockAdapter.executeQuery.mock.calls[0]?.[0] as string;
        expect(sql).not.toContain('LIMIT');
    });
});

describe('pg_text_rank', () => {
    let mockAdapter: ReturnType<typeof createMockPostgresAdapter>;
    let tools: ReturnType<typeof getTextTools>;
    let mockContext: ReturnType<typeof createMockRequestContext>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockAdapter = createMockPostgresAdapter();
        tools = getTextTools(mockAdapter as unknown as PostgresAdapter);
        mockContext = createMockRequestContext();
    });

    it('should rank text results', async () => {
        mockAdapter.executeQuery.mockResolvedValueOnce({
            rows: [{ id: 1, rank: 0.85 }]
        });

        const tool = tools.find(t => t.name === 'pg_text_rank')!;
        const result = await tool.handler({
            table: 'documents',
            column: 'content',
            query: 'database'
        }, mockContext) as {
            rows: unknown[];
        };

        expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
            expect.stringContaining('ts_rank_cd'),
            ['database']
        );
        expect(result.rows).toHaveLength(1);
    });
});

describe('pg_trigram_similarity', () => {
    let mockAdapter: ReturnType<typeof createMockPostgresAdapter>;
    let tools: ReturnType<typeof getTextTools>;
    let mockContext: ReturnType<typeof createMockRequestContext>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockAdapter = createMockPostgresAdapter();
        tools = getTextTools(mockAdapter as unknown as PostgresAdapter);
        mockContext = createMockRequestContext();
    });

    it('should find similar strings', async () => {
        mockAdapter.executeQuery.mockResolvedValueOnce({
            rows: [{ name: 'PostgreSQL', similarity: 0.8 }]
        });

        const tool = tools.find(t => t.name === 'pg_trigram_similarity')!;
        const result = await tool.handler({
            table: 'products',
            column: 'name',
            value: 'PostgreS'
        }, mockContext) as {
            rows: unknown[];
            count: number;
        };

        expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
            expect.stringContaining('similarity('),
            ['PostgreS']
        );
        expect(result.count).toBe(1);
    });

    it('should respect threshold', async () => {
        mockAdapter.executeQuery.mockResolvedValueOnce({ rows: [] });

        const tool = tools.find(t => t.name === 'pg_trigram_similarity')!;
        await tool.handler({
            table: 'products',
            column: 'name',
            value: 'test',
            threshold: 0.5
        }, mockContext);

        expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
            expect.stringContaining('> 0.5'),
            expect.any(Array)
        );
    });
});

describe('pg_fuzzy_match', () => {
    let mockAdapter: ReturnType<typeof createMockPostgresAdapter>;
    let tools: ReturnType<typeof getTextTools>;
    let mockContext: ReturnType<typeof createMockRequestContext>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockAdapter = createMockPostgresAdapter();
        tools = getTextTools(mockAdapter as unknown as PostgresAdapter);
        mockContext = createMockRequestContext();
    });

    it('should use levenshtein by default', async () => {
        mockAdapter.executeQuery.mockResolvedValueOnce({
            rows: [{ name: 'Smith', distance: 1 }]
        });

        const tool = tools.find(t => t.name === 'pg_fuzzy_match')!;
        await tool.handler({
            table: 'users',
            column: 'name',
            value: 'Smyth'
        }, mockContext);

        expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
            expect.stringContaining('levenshtein'),
            ['Smyth']
        );
    });

    it('should use soundex when specified', async () => {
        mockAdapter.executeQuery.mockResolvedValueOnce({ rows: [] });

        const tool = tools.find(t => t.name === 'pg_fuzzy_match')!;
        await tool.handler({
            table: 'users',
            column: 'name',
            value: 'Smith',
            method: 'soundex'
        }, mockContext);

        expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
            expect.stringContaining('soundex'),
            ['Smith']
        );
    });

    it('should use metaphone when specified', async () => {
        mockAdapter.executeQuery.mockResolvedValueOnce({ rows: [] });

        const tool = tools.find(t => t.name === 'pg_fuzzy_match')!;
        await tool.handler({
            table: 'users',
            column: 'name',
            value: 'Smith',
            method: 'metaphone'
        }, mockContext);

        expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
            expect.stringContaining('metaphone'),
            ['Smith']
        );
    });
});

describe('pg_regexp_match', () => {
    let mockAdapter: ReturnType<typeof createMockPostgresAdapter>;
    let tools: ReturnType<typeof getTextTools>;
    let mockContext: ReturnType<typeof createMockRequestContext>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockAdapter = createMockPostgresAdapter();
        tools = getTextTools(mockAdapter as unknown as PostgresAdapter);
        mockContext = createMockRequestContext();
    });

    it('should match using regex', async () => {
        mockAdapter.executeQuery.mockResolvedValueOnce({
            rows: [{ email: 'test@example.com' }]
        });

        const tool = tools.find(t => t.name === 'pg_regexp_match')!;
        const result = await tool.handler({
            table: 'users',
            column: 'email',
            pattern: '^[a-z]+@'
        }, mockContext) as {
            rows: unknown[];
            count: number;
        };

        expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
            expect.stringContaining(' ~ $1'),
            ['^[a-z]+@']
        );
        expect(result.count).toBe(1);
    });

    it('should use case-insensitive match with i flag', async () => {
        mockAdapter.executeQuery.mockResolvedValueOnce({ rows: [] });

        const tool = tools.find(t => t.name === 'pg_regexp_match')!;
        await tool.handler({
            table: 'users',
            column: 'email',
            pattern: 'TEST',
            flags: 'i'
        }, mockContext);

        expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
            expect.stringContaining(' ~* $1'),
            expect.any(Array)
        );
    });

    it('should use custom select columns when provided (line 180 branch)', async () => {
        mockAdapter.executeQuery.mockResolvedValueOnce({ rows: [] });

        const tool = tools.find(t => t.name === 'pg_regexp_match')!;
        await tool.handler({
            table: 'users',
            column: 'email',
            pattern: '^test',
            select: ['id', 'name']
        }, mockContext);

        expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
            expect.stringContaining('SELECT "id", "name"'),
            expect.any(Array)
        );
    });
});

describe('pg_like_search', () => {
    let mockAdapter: ReturnType<typeof createMockPostgresAdapter>;
    let tools: ReturnType<typeof getTextTools>;
    let mockContext: ReturnType<typeof createMockRequestContext>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockAdapter = createMockPostgresAdapter();
        tools = getTextTools(mockAdapter as unknown as PostgresAdapter);
        mockContext = createMockRequestContext();
    });

    it('should search with LIKE', async () => {
        mockAdapter.executeQuery.mockResolvedValueOnce({
            rows: [{ title: 'PostgreSQL Tutorial' }]
        });

        const tool = tools.find(t => t.name === 'pg_like_search')!;
        const result = await tool.handler({
            table: 'articles',
            column: 'title',
            pattern: '%PostgreSQL%'
        }, mockContext) as {
            rows: unknown[];
            count: number;
        };

        expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
            expect.stringContaining('LIKE $1'),
            ['%PostgreSQL%']
        );
        expect(result.count).toBe(1);
    });

    it('should use ILIKE when case-insensitive', async () => {
        mockAdapter.executeQuery.mockResolvedValueOnce({ rows: [] });

        const tool = tools.find(t => t.name === 'pg_like_search')!;
        await tool.handler({
            table: 'articles',
            column: 'title',
            pattern: '%test%',
            caseInsensitive: true
        }, mockContext);

        expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
            expect.stringContaining('ILIKE $1'),
            expect.any(Array)
        );
    });

    it('should use custom select columns when provided (line 210 branch)', async () => {
        mockAdapter.executeQuery.mockResolvedValueOnce({ rows: [] });

        const tool = tools.find(t => t.name === 'pg_like_search')!;
        await tool.handler({
            table: 'articles',
            column: 'title',
            pattern: '%test%',
            select: ['id', 'title']
        }, mockContext);

        expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
            expect.stringContaining('SELECT "id", "title"'),
            expect.any(Array)
        );
    });

    it('should add LIMIT clause when limit > 0 (line 212 branch)', async () => {
        mockAdapter.executeQuery.mockResolvedValueOnce({ rows: [] });

        const tool = tools.find(t => t.name === 'pg_like_search')!;
        await tool.handler({
            table: 'articles',
            column: 'title',
            pattern: '%test%',
            limit: 25
        }, mockContext);

        expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
            expect.stringContaining('LIMIT 25'),
            expect.any(Array)
        );
    });

    it('should use select columns with limit together (combined branch)', async () => {
        mockAdapter.executeQuery.mockResolvedValueOnce({ rows: [] });

        const tool = tools.find(t => t.name === 'pg_like_search')!;
        await tool.handler({
            table: 'articles',
            column: 'title',
            pattern: '%test%',
            select: ['id'],
            limit: 10
        }, mockContext);

        const sql = mockAdapter.executeQuery.mock.calls[0]?.[0] as string;
        expect(sql).toContain('SELECT "id"');
        expect(sql).toContain('LIMIT 10');
    });
});

describe('pg_similarity_search', () => {
    let mockAdapter: ReturnType<typeof createMockPostgresAdapter>;
    let tools: ReturnType<typeof getTextTools>;
    let mockContext: ReturnType<typeof createMockRequestContext>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockAdapter = createMockPostgresAdapter();
        tools = getTextTools(mockAdapter as unknown as PostgresAdapter);
        mockContext = createMockRequestContext();
    });

    it('should search for similar strings', async () => {
        mockAdapter.executeQuery
            .mockResolvedValueOnce({ rows: [] }) // set_limit call
            .mockResolvedValueOnce({
                rows: [{ name: 'PostgreSQL', sim: 0.75 }]
            });

        const tool = tools.find(t => t.name === 'pg_similarity_search')!;
        const result = await tool.handler({
            table: 'products',
            column: 'name',
            value: 'Postgres'
        }, mockContext) as {
            rows: unknown[];
        };

        expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
            expect.stringContaining('set_limit'),
        );
        expect(result.rows).toHaveLength(1);
    });

    it('should use custom select columns when provided (line 241 branch)', async () => {
        mockAdapter.executeQuery
            .mockResolvedValueOnce({ rows: [] }) // set_limit call
            .mockResolvedValueOnce({ rows: [] });

        const tool = tools.find(t => t.name === 'pg_similarity_search')!;
        await tool.handler({
            table: 'products',
            column: 'name',
            value: 'Postgres',
            select: ['id', 'category']
        }, mockContext);

        // Second call should have the select columns
        const sql = mockAdapter.executeQuery.mock.calls[1]?.[0] as string;
        expect(sql).toContain('"id", "category",');
    });
});

describe('pg_text_headline', () => {
    let mockAdapter: ReturnType<typeof createMockPostgresAdapter>;
    let tools: ReturnType<typeof getTextTools>;
    let mockContext: ReturnType<typeof createMockRequestContext>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockAdapter = createMockPostgresAdapter();
        tools = getTextTools(mockAdapter as unknown as PostgresAdapter);
        mockContext = createMockRequestContext();
    });

    it('should generate headlines with highlights', async () => {
        mockAdapter.executeQuery.mockResolvedValueOnce({
            rows: [{ headline: 'Learn <b>PostgreSQL</b> basics' }]
        });

        const tool = tools.find(t => t.name === 'pg_text_headline')!;
        const result = await tool.handler({
            table: 'articles',
            column: 'content',
            query: 'PostgreSQL'
        }, mockContext) as {
            headlines: string[];
        };

        expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
            expect.stringContaining('ts_headline'),
            ['PostgreSQL']
        );
        expect(result.headlines[0]).toContain('<b>PostgreSQL</b>');
    });
});

describe('pg_create_fts_index', () => {
    let mockAdapter: ReturnType<typeof createMockPostgresAdapter>;
    let tools: ReturnType<typeof getTextTools>;
    let mockContext: ReturnType<typeof createMockRequestContext>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockAdapter = createMockPostgresAdapter();
        tools = getTextTools(mockAdapter as unknown as PostgresAdapter);
        mockContext = createMockRequestContext();
    });

    it('should create GIN index for FTS', async () => {
        mockAdapter.executeQuery.mockResolvedValueOnce({ rows: [] });

        const tool = tools.find(t => t.name === 'pg_create_fts_index')!;
        const result = await tool.handler({
            table: 'articles',
            column: 'body'
        }, mockContext) as {
            success: boolean;
            index: string;
            config: string;
        };

        expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
            expect.stringContaining('CREATE INDEX')
        );
        expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
            expect.stringContaining('USING gin')
        );
        expect(result.success).toBe(true);
        expect(result.index).toContain('fts');
    });
});

describe('pg_text_normalize', () => {
    let mockAdapter: ReturnType<typeof createMockPostgresAdapter>;
    let tools: ReturnType<typeof getTextTools>;
    let mockContext: ReturnType<typeof createMockRequestContext>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockAdapter = createMockPostgresAdapter();
        tools = getTextTools(mockAdapter as unknown as PostgresAdapter);
        mockContext = createMockRequestContext();
    });

    it('should normalize text using unaccent', async () => {
        mockAdapter.executeQuery.mockResolvedValueOnce({
            rows: [{ normalized: 'cafe' }]
        });

        const tool = tools.find(t => t.name === 'pg_text_normalize')!;
        const result = await tool.handler({
            text: 'café'
        }, mockContext) as {
            normalized: string;
        };

        expect(mockAdapter.executeQuery).toHaveBeenCalledWith(
            'SELECT unaccent($1) as normalized',
            ['café']
        );
        expect(result.normalized).toBe('cafe');
    });
});

describe('pg_text_sentiment', () => {
    let mockAdapter: ReturnType<typeof createMockPostgresAdapter>;
    let tools: ReturnType<typeof getTextTools>;
    let mockContext: ReturnType<typeof createMockRequestContext>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockAdapter = createMockPostgresAdapter();
        tools = getTextTools(mockAdapter as unknown as PostgresAdapter);
        mockContext = createMockRequestContext();
    });

    it('should analyze positive sentiment', async () => {
        const tool = tools.find(t => t.name === 'pg_text_sentiment')!;
        const result = await tool.handler({
            text: 'This product is amazing and wonderful!'
        }, mockContext) as {
            sentiment: string;
            score: number;
            positiveCount: number;
            negativeCount: number;
        };

        expect(result.sentiment).toBe('positive');
        expect(result.score).toBeGreaterThan(0);
        expect(result.positiveCount).toBeGreaterThan(0);
    });

    it('should analyze negative sentiment', async () => {
        const tool = tools.find(t => t.name === 'pg_text_sentiment')!;
        const result = await tool.handler({
            text: 'This is terrible and horrible!'
        }, mockContext) as {
            sentiment: string;
            score: number;
            negativeCount: number;
        };

        expect(result.sentiment).toContain('negative');
        expect(result.score).toBeLessThan(0);
        expect(result.negativeCount).toBeGreaterThan(0);
    });

    it('should return matched words when requested', async () => {
        const tool = tools.find(t => t.name === 'pg_text_sentiment')!;
        const result = await tool.handler({
            text: 'I love this great product!',
            returnWords: true
        }, mockContext) as {
            matchedPositive: string[];
            matchedNegative: string[];
        };

        expect(result.matchedPositive).toContain('love');
        expect(result.matchedPositive).toContain('great');
        expect(result.matchedNegative).toHaveLength(0);
    });

    it('should detect neutral sentiment', async () => {
        const tool = tools.find(t => t.name === 'pg_text_sentiment')!;
        const result = await tool.handler({
            text: 'The product arrived yesterday.'
        }, mockContext) as {
            sentiment: string;
            score: number;
        };

        expect(result.sentiment).toBe('neutral');
        expect(result.score).toBe(0);
    });
});

// =============================================================================
// Branch Coverage Tests - Sentiment Score Branches
// =============================================================================

describe('pg_text_sentiment score branches', () => {
    let mockAdapter: ReturnType<typeof createMockPostgresAdapter>;
    let tools: ReturnType<typeof getTextTools>;
    let mockContext: ReturnType<typeof createMockRequestContext>;

    beforeEach(() => {
        vi.clearAllMocks();
        mockAdapter = createMockPostgresAdapter();
        tools = getTextTools(mockAdapter as unknown as PostgresAdapter);
        mockContext = createMockRequestContext();
    });

    it('should detect very positive sentiment (score > 2)', async () => {
        // Use many positive words to get score > 2
        const tool = tools.find(t => t.name === 'pg_text_sentiment')!;
        const result = await tool.handler({
            text: 'Amazing excellent fantastic wonderful great beautiful perfect awesome love brilliant'
        }, mockContext) as {
            sentiment: string;
            score: number;
            positiveCount: number;
        };

        expect(result.sentiment).toBe('very_positive');
        expect(result.score).toBeGreaterThan(2);
        expect(result.positiveCount).toBeGreaterThan(3);
    });

    it('should detect very negative sentiment (score < -2)', async () => {
        // Use many negative words to get score < -2
        const tool = tools.find(t => t.name === 'pg_text_sentiment')!;
        const result = await tool.handler({
            text: 'Terrible horrible awful bad disgusting ugly failure hate worst poor'
        }, mockContext) as {
            sentiment: string;
            score: number;
            negativeCount: number;
        };

        expect(result.sentiment).toBe('very_negative');
        expect(result.score).toBeLessThan(-2);
        expect(result.negativeCount).toBeGreaterThan(3);
    });

    it('should detect high confidence with many matched words', async () => {
        const tool = tools.find(t => t.name === 'pg_text_sentiment')!;
        const result = await tool.handler({
            text: 'Amazing excellent fantastic wonderful beautiful perfect great'
        }, mockContext) as {
            confidence: string;
            positiveCount: number;
        };

        // With 7+ matched positive words, should be high confidence
        expect(result.positiveCount).toBeGreaterThan(3);
        expect(result.confidence).toBe('high');
    });

    it('should detect low confidence with single matched word', async () => {
        const tool = tools.find(t => t.name === 'pg_text_sentiment')!;
        const result = await tool.handler({
            text: 'This thing is good.'
        }, mockContext) as {
            confidence: string;
            positiveCount: number;
        };

        expect(result.positiveCount).toBe(1);
        expect(result.confidence).toBe('low');
    });

    it('should detect medium confidence with 2-3 matched words', async () => {
        const tool = tools.find(t => t.name === 'pg_text_sentiment')!;
        const result = await tool.handler({
            text: 'This product is good and great.'
        }, mockContext) as {
            confidence: string;
            positiveCount: number;
        };

        expect(result.positiveCount).toBe(2);
        expect(result.confidence).toBe('medium');
    });
});

