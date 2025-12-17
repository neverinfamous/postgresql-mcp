/**
 * PostgreSQL Text & Full-Text Search Tools
 * 
 * Text processing, FTS, trigrams, and fuzzy matching.
 * 11 tools total.
 */

import type { PostgresAdapter } from '../PostgresAdapter.js';
import type { ToolDefinition, RequestContext } from '../../../types/index.js';
import { z } from 'zod';
import { readOnly, write } from '../../../utils/annotations.js';
import {
    TextSearchSchema,
    TrigramSimilaritySchema,
    RegexpMatchSchema
} from '../types.js';

/**
 * Get all text processing tools
 */
export function getTextTools(adapter: PostgresAdapter): ToolDefinition[] {
    return [
        createTextSearchTool(adapter),
        createTextRankTool(adapter),
        createTrigramSimilarityTool(adapter),
        createFuzzyMatchTool(adapter),
        createRegexpMatchTool(adapter),
        createLikeSearchTool(adapter),
        createSimilaritySearchTool(adapter),
        createTextHeadlineTool(adapter),
        createFtsIndexTool(adapter),
        createTextNormalizeTool(adapter),
        createTextSentimentTool(adapter)
    ];
}

function createTextSearchTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_text_search',
        description: 'Full-text search using tsvector and tsquery.',
        group: 'text',
        inputSchema: TextSearchSchema,
        annotations: readOnly('Full-Text Search'),
        handler: async (params: unknown, _context: RequestContext) => {
            const { table, columns, query, config, select, limit } = TextSearchSchema.parse(params);
            const cfg = config ?? 'english';
            const selectCols = select !== undefined && select.length > 0 ? select.map(c => `"${c}"`).join(', ') : '*';
            const tsvector = columns.map(c => `coalesce("${c}", '')`).join(" || ' ' || ");
            const limitClause = limit !== undefined && limit > 0 ? ` LIMIT ${String(limit)}` : '';

            const sql = `SELECT ${selectCols}, ts_rank(to_tsvector('${cfg}', ${tsvector}), plainto_tsquery('${cfg}', $1)) as rank
                        FROM "${table}"
                        WHERE to_tsvector('${cfg}', ${tsvector}) @@ plainto_tsquery('${cfg}', $1)
                        ORDER BY rank DESC${limitClause}`;

            const result = await adapter.executeQuery(sql, [query]);
            return { rows: result.rows, count: result.rows?.length ?? 0 };
        }
    };
}

function createTextRankTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_text_rank',
        description: 'Get relevance ranking for full-text search results.',
        group: 'text',
        inputSchema: z.object({
            table: z.string(),
            column: z.string(),
            query: z.string(),
            config: z.string().optional(),
            normalization: z.number().optional()
        }),
        annotations: readOnly('Text Rank'),
        handler: async (params: unknown, _context: RequestContext) => {
            const parsed = (params as { table: string; column: string; query: string; config?: string; normalization?: number });
            const cfg = parsed.config ?? 'english';
            const norm = parsed.normalization ?? 0;

            const sql = `SELECT *, ts_rank_cd(to_tsvector('${cfg}', "${parsed.column}"), plainto_tsquery('${cfg}', $1), ${String(norm)}) as rank
                        FROM "${parsed.table}"
                        WHERE to_tsvector('${cfg}', "${parsed.column}") @@ plainto_tsquery('${cfg}', $1)
                        ORDER BY rank DESC`;

            const result = await adapter.executeQuery(sql, [parsed.query]);
            return { rows: result.rows };
        }
    };
}

function createTrigramSimilarityTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_trigram_similarity',
        description: 'Find similar strings using pg_trgm trigram matching.',
        group: 'text',
        inputSchema: TrigramSimilaritySchema,
        annotations: readOnly('Trigram Similarity'),
        handler: async (params: unknown, _context: RequestContext) => {
            const { table, column, value, threshold, limit } = TrigramSimilaritySchema.parse(params);
            const thresh = threshold ?? 0.3;
            const limitVal = limit !== undefined && limit > 0 ? limit : 20;

            const sql = `SELECT *, similarity("${column}", $1) as similarity
                        FROM "${table}"
                        WHERE similarity("${column}", $1) > ${String(thresh)}
                        ORDER BY similarity DESC LIMIT ${String(limitVal)}`;

            const result = await adapter.executeQuery(sql, [value]);
            return { rows: result.rows, count: result.rows?.length ?? 0 };
        }
    };
}

function createFuzzyMatchTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_fuzzy_match',
        description: 'Fuzzy string matching using fuzzystrmatch extension (soundex, levenshtein).',
        group: 'text',
        inputSchema: z.object({
            table: z.string(),
            column: z.string(),
            value: z.string(),
            method: z.enum(['soundex', 'levenshtein', 'metaphone']).optional(),
            maxDistance: z.number().optional(),
            limit: z.number().optional()
        }),
        annotations: readOnly('Fuzzy Match'),
        handler: async (params: unknown, _context: RequestContext) => {
            const parsed = (params as { table: string; column: string; value: string; method?: string; maxDistance?: number; limit?: number });
            const method = parsed.method ?? 'levenshtein';
            const maxDist = parsed.maxDistance ?? 3;
            const limitVal = parsed.limit !== undefined && parsed.limit > 0 ? parsed.limit : 20;

            let sql: string;
            if (method === 'soundex') {
                sql = `SELECT *, soundex("${parsed.column}") as code FROM "${parsed.table}" WHERE soundex("${parsed.column}") = soundex($1) LIMIT ${String(limitVal)}`;
            } else if (method === 'metaphone') {
                sql = `SELECT *, metaphone("${parsed.column}", 10) as code FROM "${parsed.table}" WHERE metaphone("${parsed.column}", 10) = metaphone($1, 10) LIMIT ${String(limitVal)}`;
            } else {
                sql = `SELECT *, levenshtein("${parsed.column}", $1) as distance FROM "${parsed.table}" WHERE levenshtein("${parsed.column}", $1) <= ${String(maxDist)} ORDER BY distance LIMIT ${String(limitVal)}`;
            }

            const result = await adapter.executeQuery(sql, [parsed.value]);
            return { rows: result.rows };
        }
    };
}

function createRegexpMatchTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_regexp_match',
        description: 'Match text using POSIX regular expressions.',
        group: 'text',
        inputSchema: RegexpMatchSchema,
        annotations: readOnly('Regexp Match'),
        handler: async (params: unknown, _context: RequestContext) => {
            const { table, column, pattern, flags, select } = RegexpMatchSchema.parse(params);
            const selectCols = select !== undefined && select.length > 0 ? select.map(c => `"${c}"`).join(', ') : '*';
            const op = flags?.includes('i') ? '~*' : '~';

            const sql = `SELECT ${selectCols} FROM "${table}" WHERE "${column}" ${op} $1`;
            const result = await adapter.executeQuery(sql, [pattern]);
            return { rows: result.rows, count: result.rows?.length ?? 0 };
        }
    };
}

function createLikeSearchTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_like_search',
        description: 'Search text using LIKE or ILIKE patterns.',
        group: 'text',
        inputSchema: z.object({
            table: z.string(),
            column: z.string(),
            pattern: z.string(),
            caseInsensitive: z.boolean().optional(),
            select: z.array(z.string()).optional(),
            limit: z.number().optional()
        }),
        annotations: readOnly('LIKE Search'),
        handler: async (params: unknown, _context: RequestContext) => {
            const parsed = (params as { table: string; column: string; pattern: string; caseInsensitive?: boolean; select?: string[]; limit?: number });
            const selectCols = parsed.select !== undefined && parsed.select.length > 0 ? parsed.select.map(c => `"${c}"`).join(', ') : '*';
            const op = parsed.caseInsensitive === true ? 'ILIKE' : 'LIKE';
            const limitClause = parsed.limit !== undefined && parsed.limit > 0 ? ` LIMIT ${String(parsed.limit)}` : '';

            const sql = `SELECT ${selectCols} FROM "${parsed.table}" WHERE "${parsed.column}" ${op} $1${limitClause}`;
            const result = await adapter.executeQuery(sql, [parsed.pattern]);
            return { rows: result.rows, count: result.rows?.length ?? 0 };
        }
    };
}

function createSimilaritySearchTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_similarity_search',
        description: 'Search for similar strings with configurable threshold.',
        group: 'text',
        inputSchema: z.object({
            table: z.string(),
            column: z.string(),
            value: z.string(),
            threshold: z.number().optional(),
            select: z.array(z.string()).optional()
        }),
        annotations: readOnly('Similarity Search'),
        handler: async (params: unknown, _context: RequestContext) => {
            const parsed = (params as { table: string; column: string; value: string; threshold?: number; select?: string[] });
            const thresh = parsed.threshold ?? 0.3;
            const selectCols = parsed.select !== undefined && parsed.select.length > 0 ? parsed.select.map(c => `"${c}"`).join(', ') + ', ' : '';

            await adapter.executeQuery(`SELECT set_limit(${String(thresh)})`);

            const sql = `SELECT ${selectCols}"${parsed.column}", similarity("${parsed.column}", $1) as sim
                        FROM "${parsed.table}"
                        WHERE "${parsed.column}" % $1
                        ORDER BY sim DESC`;

            const result = await adapter.executeQuery(sql, [parsed.value]);
            return { rows: result.rows };
        }
    };
}

function createTextHeadlineTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_text_headline',
        description: 'Generate highlighted snippets from full-text search matches.',
        group: 'text',
        inputSchema: z.object({
            table: z.string(),
            column: z.string(),
            query: z.string(),
            config: z.string().optional(),
            options: z.string().optional()
        }),
        annotations: readOnly('Text Headline'),
        handler: async (params: unknown, _context: RequestContext) => {
            const parsed = (params as { table: string; column: string; query: string; config?: string; options?: string });
            const cfg = parsed.config ?? 'english';
            const opts = parsed.options ?? 'StartSel=<b>, StopSel=</b>, MaxWords=35, MinWords=15';

            const sql = `SELECT ts_headline('${cfg}', "${parsed.column}", plainto_tsquery('${cfg}', $1), '${opts}') as headline
                        FROM "${parsed.table}"
                        WHERE to_tsvector('${cfg}', "${parsed.column}") @@ plainto_tsquery('${cfg}', $1)`;

            const result = await adapter.executeQuery(sql, [parsed.query]);
            return { headlines: result.rows?.map(r => r['headline']) };
        }
    };
}

function createFtsIndexTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_create_fts_index',
        description: 'Create a GIN index for full-text search on a column.',
        group: 'text',
        inputSchema: z.object({
            table: z.string(),
            column: z.string(),
            name: z.string().optional(),
            config: z.string().optional()
        }),
        annotations: write('Create FTS Index'),
        handler: async (params: unknown, _context: RequestContext) => {
            const parsed = (params as { table: string; column: string; name?: string; config?: string });
            const cfg = parsed.config ?? 'english';
            const indexName = parsed.name ?? `idx_${parsed.table}_${parsed.column}_fts`;

            const sql = `CREATE INDEX "${indexName}" ON "${parsed.table}" USING gin(to_tsvector('${cfg}', "${parsed.column}"))`;
            await adapter.executeQuery(sql);

            return { success: true, index: indexName, config: cfg };
        }
    };
}

function createTextNormalizeTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_text_normalize',
        description: 'Normalize text by removing accents (requires unaccent extension).',
        group: 'text',
        inputSchema: z.object({
            text: z.string()
        }),
        annotations: readOnly('Text Normalize'),
        handler: async (params: unknown, _context: RequestContext) => {
            const parsed = (params as { text: string });
            const result = await adapter.executeQuery(`SELECT unaccent($1) as normalized`, [parsed.text]);
            return { normalized: result.rows?.[0]?.['normalized'] };
        }
    };
}

/**
 * Basic sentiment analysis using word matching
 */
function createTextSentimentTool(_adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_text_sentiment',
        description: 'Perform basic sentiment analysis on text using keyword matching.',
        group: 'text',
        inputSchema: z.object({
            text: z.string().describe('Text to analyze'),
            returnWords: z.boolean().optional().describe('Return matched sentiment words')
        }),
        annotations: readOnly('Text Sentiment'),
        // eslint-disable-next-line @typescript-eslint/require-await
        handler: async (params: unknown, _context: RequestContext) => {
            const parsed = (params as { text: string; returnWords?: boolean });
            const text = parsed.text.toLowerCase();

            const positiveWords = [
                'good', 'great', 'excellent', 'amazing', 'wonderful', 'fantastic',
                'love', 'happy', 'positive', 'best', 'beautiful', 'awesome',
                'perfect', 'nice', 'helpful', 'thank', 'thanks', 'pleased',
                'satisfied', 'recommend', 'enjoy', 'impressive', 'brilliant'
            ];

            const negativeWords = [
                'bad', 'terrible', 'awful', 'horrible', 'worst', 'hate',
                'angry', 'disappointed', 'poor', 'wrong', 'problem', 'issue',
                'fail', 'failed', 'broken', 'useless', 'waste', 'frustrating',
                'annoyed', 'unhappy', 'negative', 'complaint', 'slow'
            ];

            const words = text.split(/\s+/);
            const matchedPositive = words.filter(w => positiveWords.includes(w.replace(/[^a-z]/g, '')));
            const matchedNegative = words.filter(w => negativeWords.includes(w.replace(/[^a-z]/g, '')));

            const positiveScore = matchedPositive.length;
            const negativeScore = matchedNegative.length;
            const totalScore = positiveScore - negativeScore;

            let sentiment: string;
            if (totalScore > 2) sentiment = 'very_positive';
            else if (totalScore > 0) sentiment = 'positive';
            else if (totalScore < -2) sentiment = 'very_negative';
            else if (totalScore < 0) sentiment = 'negative';
            else sentiment = 'neutral';

            const result: {
                sentiment: string;
                score: number;
                positiveCount: number;
                negativeCount: number;
                confidence: string;
                matchedPositive?: string[];
                matchedNegative?: string[];
            } = {
                sentiment,
                score: totalScore,
                positiveCount: positiveScore,
                negativeCount: negativeScore,
                confidence: (positiveScore + negativeScore) > 3 ? 'high' : (positiveScore + negativeScore) > 1 ? 'medium' : 'low'
            };

            if (parsed.returnWords) {
                result.matchedPositive = matchedPositive;
                result.matchedNegative = matchedNegative;
            }

            return result;
        }
    };
}
