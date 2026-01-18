/**
 * PostgreSQL Text & Full-Text Search Tools
 *
 * Text processing, FTS, trigrams, and fuzzy matching.
 * 14 tools total.
 */

import type { PostgresAdapter } from "../PostgresAdapter.js";
import type { ToolDefinition, RequestContext } from "../../../types/index.js";
import { z } from "zod";
import { readOnly, write } from "../../../utils/annotations.js";
import { getToolIcons } from "../../../utils/icons.js";
import {
  sanitizeIdentifier,
  sanitizeTableName,
  sanitizeIdentifiers,
} from "../../../utils/identifiers.js";
import {
  TextSearchSchema,
  TrigramSimilaritySchema,
  RegexpMatchSchema,
} from "../schemas/index.js";

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
    createTextHeadlineTool(adapter),
    createFtsIndexTool(adapter),
    createTextNormalizeTool(adapter),
    createTextSentimentTool(adapter),
    createTextToVectorTool(adapter),
    createTextToQueryTool(adapter),
    createTextSearchConfigTool(adapter),
  ];
}

function createTextSearchTool(adapter: PostgresAdapter): ToolDefinition {
  return {
    name: "pg_text_search",
    description: "Full-text search using tsvector and tsquery.",
    group: "text",
    inputSchema: TextSearchSchema,
    annotations: readOnly("Full-Text Search"),
    icons: getToolIcons("text", readOnly("Full-Text Search")),
    handler: async (params: unknown, _context: RequestContext) => {
      const { table, columns, query, config, select, limit } =
        TextSearchSchema.parse(params);
      const cfg = config ?? "english";

      const tableName = sanitizeTableName(table);
      const sanitizedCols = sanitizeIdentifiers(columns);
      const selectCols =
        select !== undefined && select.length > 0
          ? sanitizeIdentifiers(select).join(", ")
          : "*";
      const tsvector = sanitizedCols
        .map((c) => `coalesce(${c}, '')`)
        .join(" || ' ' || ");
      const limitClause =
        limit !== undefined && limit > 0 ? ` LIMIT ${String(limit)}` : "";

      const sql = `SELECT ${selectCols}, ts_rank_cd(to_tsvector('${cfg}', ${tsvector}), plainto_tsquery('${cfg}', $1)) as rank
                        FROM ${tableName}
                        WHERE to_tsvector('${cfg}', ${tsvector}) @@ plainto_tsquery('${cfg}', $1)
                        ORDER BY rank DESC${limitClause}`;

      const result = await adapter.executeQuery(sql, [query]);
      return { rows: result.rows, count: result.rows?.length ?? 0 };
    },
  };
}

function createTextRankTool(adapter: PostgresAdapter): ToolDefinition {
  return {
    name: "pg_text_rank",
    description:
      "Get relevance ranking for full-text search results. Returns matching rows only with rank score.",
    group: "text",
    inputSchema: z.object({
      table: z.string(),
      column: z.string().optional().describe("Single column to search"),
      columns: z
        .array(z.string())
        .optional()
        .describe("Multiple columns to search (alternative to column)"),
      query: z.string(),
      config: z.string().optional(),
      normalization: z.number().optional(),
      select: z.array(z.string()).optional().describe("Columns to return"),
      limit: z.number().optional().describe("Max results"),
    }),
    annotations: readOnly("Text Rank"),
    icons: getToolIcons("text", readOnly("Text Rank")),
    handler: async (params: unknown, _context: RequestContext) => {
      const parsed = params as {
        table: string;
        column?: string;
        columns?: string[];
        query: string;
        config?: string;
        normalization?: number;
        select?: string[];
        limit?: number;
      };
      const cfg = parsed.config ?? "english";
      const norm = parsed.normalization ?? 0;

      // Handle both column (string) and columns (array) parameters
      let cols: string[];
      if (parsed.columns !== undefined && parsed.columns.length > 0) {
        cols = parsed.columns;
      } else if (parsed.column !== undefined) {
        cols = [parsed.column];
      } else {
        throw new Error("Either column or columns parameter is required");
      }

      const tableName = sanitizeTableName(parsed.table);
      const sanitizedCols = sanitizeIdentifiers(cols);
      const selectCols =
        parsed.select !== undefined && parsed.select.length > 0
          ? sanitizeIdentifiers(parsed.select).join(", ")
          : "*";
      const tsvector = sanitizedCols
        .map((c) => `coalesce(${c}, '')`)
        .join(" || ' ' || ");
      const limitClause =
        parsed.limit !== undefined && parsed.limit > 0
          ? ` LIMIT ${String(parsed.limit)}`
          : "";

      const sql = `SELECT ${selectCols}, ts_rank_cd(to_tsvector('${cfg}', ${tsvector}), plainto_tsquery('${cfg}', $1), ${String(norm)}) as rank
                        FROM ${tableName}
                        WHERE to_tsvector('${cfg}', ${tsvector}) @@ plainto_tsquery('${cfg}', $1)
                        ORDER BY rank DESC${limitClause}`;

      const result = await adapter.executeQuery(sql, [parsed.query]);
      return { rows: result.rows, count: result.rows?.length ?? 0 };
    },
  };
}

function createTrigramSimilarityTool(adapter: PostgresAdapter): ToolDefinition {
  return {
    name: "pg_trigram_similarity",
    description:
      "Find similar strings using pg_trgm trigram matching. Returns similarity score (0-1). Default threshold 0.3; use lower (e.g., 0.1) for partial matches.",
    group: "text",
    inputSchema: TrigramSimilaritySchema,
    annotations: readOnly("Trigram Similarity"),
    icons: getToolIcons("text", readOnly("Trigram Similarity")),
    handler: async (params: unknown, _context: RequestContext) => {
      const { table, column, value, threshold, select, limit } =
        TrigramSimilaritySchema.parse(params);
      const thresh = threshold ?? 0.3;
      const limitVal = limit !== undefined && limit > 0 ? limit : 20;

      const tableName = sanitizeTableName(table);
      const columnName = sanitizeIdentifier(column);
      const selectCols =
        select !== undefined && select.length > 0
          ? sanitizeIdentifiers(select).join(", ")
          : "*";

      const sql = `SELECT ${selectCols}, similarity(${columnName}, $1) as similarity
                        FROM ${tableName}
                        WHERE similarity(${columnName}, $1) > ${String(thresh)}
                        ORDER BY similarity DESC LIMIT ${String(limitVal)}`;

      const result = await adapter.executeQuery(sql, [value]);
      return { rows: result.rows, count: result.rows?.length ?? 0 };
    },
  };
}

function createFuzzyMatchTool(adapter: PostgresAdapter): ToolDefinition {
  return {
    name: "pg_fuzzy_match",
    description:
      "Fuzzy string matching using fuzzystrmatch extension. Levenshtein (default): returns distance; use maxDistance=5+ for longer strings. Soundex/metaphone: returns phonetic code for exact matches only.",
    group: "text",
    inputSchema: z.object({
      table: z.string(),
      column: z.string(),
      value: z.string(),
      method: z.enum(["soundex", "levenshtein", "metaphone"]).optional(),
      maxDistance: z
        .number()
        .optional()
        .describe(
          "Max Levenshtein distance (default: 3, use 5+ for longer strings)",
        ),
      select: z.array(z.string()).optional().describe("Columns to return"),
      limit: z.number().optional(),
    }),
    annotations: readOnly("Fuzzy Match"),
    icons: getToolIcons("text", readOnly("Fuzzy Match")),
    handler: async (params: unknown, _context: RequestContext) => {
      const parsed = params as {
        table: string;
        column: string;
        value: string;
        method?: string;
        maxDistance?: number;
        select?: string[];
        limit?: number;
      };
      const method = parsed.method ?? "levenshtein";
      const maxDist = parsed.maxDistance ?? 3;
      const limitVal =
        parsed.limit !== undefined && parsed.limit > 0 ? parsed.limit : 20;

      const tableName = sanitizeTableName(parsed.table);
      const columnName = sanitizeIdentifier(parsed.column);
      const selectCols =
        parsed.select !== undefined && parsed.select.length > 0
          ? sanitizeIdentifiers(parsed.select).join(", ")
          : "*";

      let sql: string;
      if (method === "soundex") {
        sql = `SELECT ${selectCols}, soundex(${columnName}) as code FROM ${tableName} WHERE soundex(${columnName}) = soundex($1) LIMIT ${String(limitVal)}`;
      } else if (method === "metaphone") {
        sql = `SELECT ${selectCols}, metaphone(${columnName}, 10) as code FROM ${tableName} WHERE metaphone(${columnName}, 10) = metaphone($1, 10) LIMIT ${String(limitVal)}`;
      } else {
        sql = `SELECT ${selectCols}, levenshtein(${columnName}, $1) as distance FROM ${tableName} WHERE levenshtein(${columnName}, $1) <= ${String(maxDist)} ORDER BY distance LIMIT ${String(limitVal)}`;
      }

      const result = await adapter.executeQuery(sql, [parsed.value]);
      return { rows: result.rows, count: result.rows?.length ?? 0 };
    },
  };
}

function createRegexpMatchTool(adapter: PostgresAdapter): ToolDefinition {
  return {
    name: "pg_regexp_match",
    description: "Match text using POSIX regular expressions.",
    group: "text",
    inputSchema: RegexpMatchSchema,
    annotations: readOnly("Regexp Match"),
    icons: getToolIcons("text", readOnly("Regexp Match")),
    handler: async (params: unknown, _context: RequestContext) => {
      const { table, column, pattern, flags, select, limit } =
        RegexpMatchSchema.parse(params);

      const tableName = sanitizeTableName(table);
      const columnName = sanitizeIdentifier(column);
      const selectCols =
        select !== undefined && select.length > 0
          ? sanitizeIdentifiers(select).join(", ")
          : "*";
      const op = flags?.includes("i") ? "~*" : "~";
      const limitClause = limit !== undefined ? ` LIMIT ${String(limit)}` : "";

      const sql = `SELECT ${selectCols} FROM ${tableName} WHERE ${columnName} ${op} $1${limitClause}`;
      const result = await adapter.executeQuery(sql, [pattern]);
      return { rows: result.rows, count: result.rows?.length ?? 0 };
    },
  };
}

function createLikeSearchTool(adapter: PostgresAdapter): ToolDefinition {
  return {
    name: "pg_like_search",
    description:
      "Search text using LIKE patterns. Case-insensitive (ILIKE) by default.",
    group: "text",
    inputSchema: z.object({
      table: z.string(),
      column: z.string(),
      pattern: z.string(),
      caseSensitive: z
        .boolean()
        .optional()
        .describe("Use case-sensitive LIKE (default: false, uses ILIKE)"),
      select: z.array(z.string()).optional(),
      limit: z.number().optional(),
    }),
    annotations: readOnly("LIKE Search"),
    icons: getToolIcons("text", readOnly("LIKE Search")),
    handler: async (params: unknown, _context: RequestContext) => {
      const parsed = params as {
        table: string;
        column: string;
        pattern: string;
        caseSensitive?: boolean;
        select?: string[];
        limit?: number;
      };

      const tableName = sanitizeTableName(parsed.table);
      const columnName = sanitizeIdentifier(parsed.column);
      const selectCols =
        parsed.select !== undefined && parsed.select.length > 0
          ? sanitizeIdentifiers(parsed.select).join(", ")
          : "*";
      const op = parsed.caseSensitive === true ? "LIKE" : "ILIKE";
      const limitClause =
        parsed.limit !== undefined && parsed.limit > 0
          ? ` LIMIT ${String(parsed.limit)}`
          : "";

      const sql = `SELECT ${selectCols} FROM ${tableName} WHERE ${columnName} ${op} $1${limitClause}`;
      const result = await adapter.executeQuery(sql, [parsed.pattern]);
      return { rows: result.rows, count: result.rows?.length ?? 0 };
    },
  };
}

function createTextHeadlineTool(adapter: PostgresAdapter): ToolDefinition {
  return {
    name: "pg_text_headline",
    description:
      "Generate highlighted snippets from full-text search matches. Use select param for stable row identification (e.g., primary key).",
    group: "text",
    inputSchema: z.object({
      table: z.string(),
      column: z.string(),
      query: z.string(),
      config: z.string().optional(),
      options: z
        .string()
        .optional()
        .describe(
          'Headline options (e.g., "MaxWords=20, MinWords=5"). Note: MinWords must be < MaxWords.',
        ),
      select: z
        .array(z.string())
        .optional()
        .describe('Columns to return for row identification (e.g., ["id"])'),
      limit: z.number().optional().describe("Max results"),
    }),
    annotations: readOnly("Text Headline"),
    icons: getToolIcons("text", readOnly("Text Headline")),
    handler: async (params: unknown, _context: RequestContext) => {
      const parsed = params as {
        table: string;
        column: string;
        query: string;
        config?: string;
        options?: string;
        select?: string[];
        limit?: number;
      };
      const cfg = parsed.config ?? "english";
      // Default options include both MinWords and MaxWords to avoid PostgreSQL error
      const opts =
        parsed.options ??
        "StartSel=<b>, StopSel=</b>, MaxWords=35, MinWords=15";

      const tableName = sanitizeTableName(parsed.table);
      const columnName = sanitizeIdentifier(parsed.column);
      // Use provided select columns, or default to * (user should specify PK for stable identification)
      const selectCols =
        parsed.select !== undefined && parsed.select.length > 0
          ? sanitizeIdentifiers(parsed.select).join(", ") + ", "
          : "";
      const limitClause =
        parsed.limit !== undefined && parsed.limit > 0
          ? ` LIMIT ${String(parsed.limit)}`
          : "";

      const sql = `SELECT ${selectCols}ts_headline('${cfg}', ${columnName}, plainto_tsquery('${cfg}', $1), '${opts}') as headline
                        FROM ${tableName}
                        WHERE to_tsvector('${cfg}', ${columnName}) @@ plainto_tsquery('${cfg}', $1)${limitClause}`;

      const result = await adapter.executeQuery(sql, [parsed.query]);
      return { rows: result.rows, count: result.rows?.length ?? 0 };
    },
  };
}

function createFtsIndexTool(adapter: PostgresAdapter): ToolDefinition {
  return {
    name: "pg_create_fts_index",
    description: "Create a GIN index for full-text search on a column.",
    group: "text",
    inputSchema: z.object({
      table: z.string(),
      column: z.string(),
      name: z.string().optional(),
      config: z.string().optional(),
      ifNotExists: z
        .boolean()
        .optional()
        .describe("Skip if index already exists (default: false)"),
    }),
    annotations: write("Create FTS Index"),
    icons: getToolIcons("text", write("Create FTS Index")),
    handler: async (params: unknown, _context: RequestContext) => {
      const parsed = params as {
        table: string;
        column: string;
        name?: string;
        config?: string;
        ifNotExists?: boolean;
      };
      const cfg = parsed.config ?? "english";
      const defaultIndexName = `idx_${parsed.table}_${parsed.column}_fts`;
      const indexName = sanitizeIdentifier(parsed.name ?? defaultIndexName);
      const ifNotExists = parsed.ifNotExists === true ? "IF NOT EXISTS " : "";

      const tableName = sanitizeTableName(parsed.table);
      const columnName = sanitizeIdentifier(parsed.column);

      const sql = `CREATE INDEX ${ifNotExists}${indexName} ON ${tableName} USING gin(to_tsvector('${cfg}', ${columnName}))`;
      await adapter.executeQuery(sql);

      return {
        success: true,
        index: parsed.name ?? defaultIndexName,
        config: cfg,
        skipped: parsed.ifNotExists === true,
      };
    },
  };
}

function createTextNormalizeTool(adapter: PostgresAdapter): ToolDefinition {
  const NormalizeSchema = z.object({
    text: z.string().describe("Text to remove accent marks from"),
  });

  return {
    name: "pg_text_normalize",
    description:
      "Remove accent marks (diacritics) from text using PostgreSQL unaccent extension. Note: Does NOT lowercase or trim—use LOWER()/TRIM() in a query for those operations.",
    group: "text",
    inputSchema: NormalizeSchema,
    annotations: readOnly("Text Normalize"),
    icons: getToolIcons("text", readOnly("Text Normalize")),
    handler: async (params: unknown, _context: RequestContext) => {
      const parsed = NormalizeSchema.parse(params ?? {});

      // Ensure unaccent extension is available
      await adapter.executeQuery("CREATE EXTENSION IF NOT EXISTS unaccent");

      const result = await adapter.executeQuery(
        `SELECT unaccent($1) as normalized`,
        [parsed.text],
      );
      return { normalized: result.rows?.[0]?.["normalized"] };
    },
  };
}

/**
 * Basic sentiment analysis using word matching
 */
function createTextSentimentTool(_adapter: PostgresAdapter): ToolDefinition {
  const SentimentSchema = z.object({
    text: z.string().describe("Text to analyze"),
    returnWords: z
      .boolean()
      .optional()
      .describe("Return matched sentiment words"),
  });

  return {
    name: "pg_text_sentiment",
    description:
      "Perform basic sentiment analysis on text using keyword matching.",
    group: "text",
    inputSchema: SentimentSchema,
    annotations: readOnly("Text Sentiment"),
    icons: getToolIcons("text", readOnly("Text Sentiment")),
    // eslint-disable-next-line @typescript-eslint/require-await
    handler: async (params: unknown, _context: RequestContext) => {
      const parsed = SentimentSchema.parse(params ?? {});
      const text = parsed.text.toLowerCase();

      const positiveWords = [
        "good",
        "great",
        "excellent",
        "amazing",
        "wonderful",
        "fantastic",
        "love",
        "happy",
        "positive",
        "best",
        "beautiful",
        "awesome",
        "perfect",
        "nice",
        "helpful",
        "thank",
        "thanks",
        "pleased",
        "satisfied",
        "recommend",
        "enjoy",
        "impressive",
        "brilliant",
      ];

      const negativeWords = [
        "bad",
        "terrible",
        "awful",
        "horrible",
        "worst",
        "hate",
        "angry",
        "disappointed",
        "poor",
        "wrong",
        "problem",
        "issue",
        "fail",
        "failed",
        "broken",
        "useless",
        "waste",
        "frustrating",
        "annoyed",
        "unhappy",
        "negative",
        "complaint",
        "slow",
      ];

      const words = text.split(/\s+/);
      const matchedPositive = words
        .map((w) => w.replace(/[^a-z]/g, ""))
        .filter((w) => positiveWords.includes(w));
      const matchedNegative = words
        .map((w) => w.replace(/[^a-z]/g, ""))
        .filter((w) => negativeWords.includes(w));

      const positiveScore = matchedPositive.length;
      const negativeScore = matchedNegative.length;
      const totalScore = positiveScore - negativeScore;

      let sentiment: string;
      if (totalScore > 2) sentiment = "very_positive";
      else if (totalScore > 0) sentiment = "positive";
      else if (totalScore < -2) sentiment = "very_negative";
      else if (totalScore < 0) sentiment = "negative";
      else sentiment = "neutral";

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
        confidence:
          positiveScore + negativeScore > 3
            ? "high"
            : positiveScore + negativeScore > 1
              ? "medium"
              : "low",
      };

      if (parsed.returnWords) {
        result.matchedPositive = matchedPositive;
        result.matchedNegative = matchedNegative;
      }

      return result;
    },
  };
}

/**
 * Convert text to tsvector for full-text search
 */
function createTextToVectorTool(adapter: PostgresAdapter): ToolDefinition {
  const ToVectorSchema = z.object({
    text: z.string().describe("Text to convert to tsvector"),
    config: z
      .string()
      .optional()
      .describe("Text search configuration (default: english)"),
  });

  return {
    name: "pg_text_to_vector",
    description:
      "Convert text to tsvector representation for full-text search operations.",
    group: "text",
    inputSchema: ToVectorSchema,
    annotations: readOnly("Text to Vector"),
    icons: getToolIcons("text", readOnly("Text to Vector")),
    handler: async (params: unknown, _context: RequestContext) => {
      const parsed = ToVectorSchema.parse(params ?? {});
      const cfg = parsed.config ?? "english";

      const result = await adapter.executeQuery(
        `SELECT to_tsvector($1, $2) as vector`,
        [cfg, parsed.text],
      );
      return { vector: result.rows?.[0]?.["vector"] };
    },
  };
}

/**
 * Convert text to tsquery for full-text search
 */
function createTextToQueryTool(adapter: PostgresAdapter): ToolDefinition {
  const ToQuerySchema = z.object({
    text: z.string().describe("Text to convert to tsquery"),
    config: z
      .string()
      .optional()
      .describe("Text search configuration (default: english)"),
    mode: z
      .enum(["plain", "phrase", "websearch"])
      .optional()
      .describe(
        "Query parsing mode: plain (default), phrase (proximity), websearch (Google-like)",
      ),
  });

  return {
    name: "pg_text_to_query",
    description:
      "Convert text to tsquery for full-text search. Modes: plain (default), phrase (proximity matching), websearch (Google-like syntax with AND/OR/-).",
    group: "text",
    inputSchema: ToQuerySchema,
    annotations: readOnly("Text to Query"),
    icons: getToolIcons("text", readOnly("Text to Query")),
    handler: async (params: unknown, _context: RequestContext) => {
      const parsed = ToQuerySchema.parse(params ?? {});
      const cfg = parsed.config ?? "english";
      const mode = parsed.mode ?? "plain";

      let fn: string;
      switch (mode) {
        case "phrase":
          fn = "phraseto_tsquery";
          break;
        case "websearch":
          fn = "websearch_to_tsquery";
          break;
        default:
          fn = "plainto_tsquery";
      }

      const result = await adapter.executeQuery(
        `SELECT ${fn}($1, $2) as query`,
        [cfg, parsed.text],
      );
      return { query: result.rows?.[0]?.["query"], mode };
    },
  };
}

/**
 * List available full-text search configurations
 */
function createTextSearchConfigTool(adapter: PostgresAdapter): ToolDefinition {
  return {
    name: "pg_text_search_config",
    description:
      "List available full-text search configurations (e.g., english, german, simple).",
    group: "text",
    inputSchema: z.object({}).default({}),
    annotations: readOnly("Search Configurations"),
    icons: getToolIcons("text", readOnly("Search Configurations")),
    handler: async (_params: unknown, _context: RequestContext) => {
      const result = await adapter.executeQuery(`
                SELECT 
                    c.cfgname as name,
                    n.nspname as schema,
                    obj_description(c.oid, 'pg_ts_config') as description
                FROM pg_ts_config c
                JOIN pg_namespace n ON n.oid = c.cfgnamespace
                ORDER BY c.cfgname
            `);
      return {
        configs: result.rows ?? [],
        count: result.rows?.length ?? 0,
      };
    },
  };
}
