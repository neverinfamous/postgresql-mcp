/**
 * postgres-mcp - Code Mode API
 *
 * Exposes all 194 PostgreSQL tools organized by their 19 groups
 * for use within the sandboxed execution environment.
 */

import type { PostgresAdapter } from "../adapters/postgresql/PostgresAdapter.js";
import type { ToolDefinition } from "../types/index.js";
/**
 * Method aliases for code mode API.
 * Maps alternate method names to their canonical method names.
 * Format: { groupName: { aliasName: canonicalName } }
 *
 * These aliases handle common naming misguesses where agents
 * might try the redundant prefix pattern (e.g., jsonbExtract vs extract).
 */
const METHOD_ALIASES: Record<string, Record<string, string>> = {
  // JSONB: pg_jsonb_extract → extract, but agent might try jsonbExtract
  jsonb: {
    jsonbExtract: "extract",
    jsonbSet: "set",
    jsonbInsert: "insert",
    jsonbDelete: "delete",
    jsonbContains: "contains",
    jsonbPathQuery: "pathQuery",
    jsonbAgg: "agg",
    jsonbObject: "object",
    jsonbArray: "array",
    jsonbKeys: "keys",
    jsonbStripNulls: "stripNulls",
    jsonbTypeof: "typeof",
    jsonbValidatePath: "validatePath",
    jsonbMerge: "merge",
    jsonbNormalize: "normalize",
    jsonbDiff: "diff",
    jsonbIndexSuggest: "indexSuggest",
    jsonbSecurityScan: "securityScan",
    jsonbStats: "stats",
  },
  // Text: pg_text_search → textSearch, but also search
  text: {
    textSearch: "search",
    textRank: "rank",
    textHeadline: "headline",
    textNormalize: "normalize",
    textSentiment: "sentiment",
    textToVector: "toVector",
    textToQuery: "toQuery",
    textSearchConfig: "searchConfig",
    // Intuitive aliases for common methods
    similar: "trigramSimilarity", // pg.text.similar() → trigramSimilarity()
    trigram: "trigramSimilarity", // pg.text.trigram() → trigramSimilarity()
    similarity: "trigramSimilarity", // pg.text.similarity() → trigramSimilarity()
    fuzzy: "fuzzyMatch", // pg.text.fuzzy() → fuzzyMatch()
    like: "likeSearch", // pg.text.like() → likeSearch()
    regex: "regexpMatch", // pg.text.regex() → regexpMatch()
    regexp: "regexpMatch", // pg.text.regexp() → regexpMatch()
    unaccent: "normalize", // pg.text.unaccent() → normalize()
    highlight: "headline", // pg.text.highlight() → headline()
    patternMatch: "regexpMatch", // pg.text.patternMatch() → regexpMatch()
    configs: "searchConfig", // pg.text.configs() → searchConfig()
    searchConfigs: "searchConfig", // pg.text.searchConfigs() → searchConfig()
    createIndex: "createFtsIndex", // pg.text.createIndex() → createFtsIndex()
  },
  // Vector: pg_vector_search → search, but agent might try vectorSearch
  vector: {
    vectorSearch: "search",
    vectorAggregate: "aggregate",
    vectorCreateIndex: "createIndex",
    vectorCluster: "cluster",
    vectorIndexOptimize: "indexOptimize",
    vectorPerformance: "performance",
    vectorDimensionReduce: "dimensionReduce",
    vectorEmbed: "embed",
    vectorNormalize: "normalize",
    vectorQuantize: "quantize",
    vectorList: "list",
  },
  // PostGIS
  postgis: {
    // pg.postgis.indexOptimize() -> geoIndexOptimize (from pg_geo_index_optimize)
    indexOptimize: "geoIndexOptimize",
    // pg.postgis.addColumn() -> geometryColumn (from pg_geometry_column)
    addColumn: "geometryColumn",
  },
  // Performance: naming aliases for common queries
  performance: {
    // User education aliases - common names that map to actual method names
    cacheStats: "cacheHitRatio", // pg_cache_stats → cacheHitRatio()
    queryStats: "statStatements", // pg_query_stats → statStatements()
    // Activity-related aliases
    activity: "statActivity", // activity() → statActivity()
    runningQueries: "statActivity", // runningQueries() → statActivity()
    // Index analysis aliases
    indexUsage: "indexStats", // indexUsage() → indexStats()
    // Vacuum alias
    vacuum: "vacuumStats", // vacuum() → vacuumStats()
    // Bloat alias
    bloatEstimate: "bloatCheck", // bloatEstimate() → bloatCheck()
    bloat: "bloatCheck", // bloat() → bloatCheck()
  },
  // Monitoring: intuitive aliases for common monitoring methods
  monitoring: {
    connections: "connectionStats", // connections() → connectionStats()
    settings: "showSettings", // settings() → showSettings()
    config: "showSettings", // config() → showSettings()
    alerts: "alertThresholdSet", // alerts() → alertThresholdSet()
    thresholds: "alertThresholdSet", // thresholds() → alertThresholdSet()
  },
  // Transactions: shorter aliases
  transactions: {
    // pg.transactions.begin() -> transactionBegin (from pg_transaction_begin)
    begin: "transactionBegin",
    commit: "transactionCommit",
    rollback: "transactionRollback",
    savepoint: "transactionSavepoint",
    release: "transactionRelease",
    rollbackTo: "transactionRollbackTo",
    execute: "transactionExecute",
  },
  // Stats: pg_stats_descriptive → descriptive, but agent might try statsDescriptive
  stats: {
    statsDescriptive: "descriptive",
    statsPercentiles: "percentiles",
    statsCorrelation: "correlation",
    statsRegression: "regression",
    statsTimeSeries: "timeSeries",
    statsDistribution: "distribution",
    statsHypothesis: "hypothesis",
    statsSampling: "sampling",
    // Intuitive aliases
    summary: "descriptive", // summary() → descriptive()
    percentile: "percentiles", // percentile() → percentiles()
    histogram: "distribution", // histogram() → distribution()
    movingAverage: "timeSeries", // movingAverage() → timeSeries()
    time_series: "timeSeries", // time_series() → timeSeries()
  },
  // Cron: pg_cron_schedule → cronSchedule, but agent might try cronSchedule
  cron: {
    cronCreateExtension: "createExtension",
    cronSchedule: "schedule",
    cronScheduleInDatabase: "scheduleInDatabase",
    cronUnschedule: "unschedule",
    cronAlterJob: "alterJob",
    cronListJobs: "listJobs",
    cronJobRunDetails: "jobRunDetails",
    cronCleanupHistory: "cleanupHistory",
  },
  // Partman
  partman: {
    partmanCreateExtension: "createExtension",
    partmanCreateParent: "createParent",
    partmanRunMaintenance: "runMaintenance",
    partmanShowConfig: "showConfig",
    partmanShowPartitions: "showPartitions", // Missing alias - added
    partmanCheckDefault: "checkDefault",
    partmanPartitionData: "partitionData",
    partmanSetRetention: "setRetention",
    partmanUndoPartition: "undoPartition",
    partmanAnalyzePartitionHealth: "analyzePartitionHealth",
    // Intuitive short alias
    analyzeHealth: "analyzePartitionHealth", // pg.partman.analyzeHealth() → analyzePartitionHealth()
  },
  // Kcache
  kcache: {
    kcacheCreateExtension: "createExtension",
    kcacheQueryStats: "queryStats",
    kcacheReset: "reset",
    kcacheTopQueries: "topQueries",
    kcacheResourceAnalysis: "resourceAnalysis",
    kcacheIoPatterns: "ioPatterns",
    kcacheCpuProfiles: "cpuProfiles",
  },
  // Citext
  citext: {
    citextCreateExtension: "createExtension",
    citextConvertColumn: "convertColumn",
    citextListColumns: "listColumns",
    citextAnalyzeCandidates: "analyzeCandidates",
    citextCompare: "compare",
    citextSchemaAdvisor: "schemaAdvisor",
  },
  // Ltree
  ltree: {
    ltreeCreateExtension: "createExtension",
    ltreeQuery: "query",
    ltreeSubpath: "subpath",
    ltreeLca: "lca",
    ltreeMatch: "match",
    ltreeListColumns: "listColumns",
    ltreeConvertColumn: "convertColumn",
    ltreeCreateIndex: "createIndex",
  },
  // Pgcrypto
  pgcrypto: {
    pgcryptoCreateExtension: "createExtension",
    pgcryptoHash: "hash",
    pgcryptoHmac: "hmac",
    pgcryptoEncrypt: "encrypt",
    pgcryptoDecrypt: "decrypt",
    pgcryptoGenRandomUuid: "genRandomUuid",
    pgcryptoGenRandomBytes: "genRandomBytes",
    pgcryptoGenSalt: "genSalt",
    pgcryptoCrypt: "crypt",
  },
  // Partitioning: shorter aliases
  partitioning: {
    create: "createPartition", // create() → createPartition()
    add: "createPartition", // add() → createPartition()
    list: "listPartitions", // list() → listPartitions()
    info: "partitionInfo", // info() → partitionInfo()
    attach: "attachPartition", // attach() → attachPartition()
    detach: "detachPartition", // detach() → detachPartition()
    remove: "detachPartition", // remove() → detachPartition()
  },
};

/**
 * Usage examples for each group's help() output.
 * Provides quick-reference examples for common operations.
 */
const GROUP_EXAMPLES: Record<string, string[]> = {
  core: [
    'pg.core.readQuery("SELECT * FROM users LIMIT 10")',
    'pg.core.exists("users", "email=$1", { params: ["test@example.com"] })',
    'pg.core.createTable("orders", [{ name: "id", type: "SERIAL PRIMARY KEY" }])',
    'pg.core.batchInsert("products", [{ name: "A" }, { name: "B" }])',
  ],
  transactions: [
    "const { transactionId } = await pg.transactions.begin()",
    'await pg.transactions.savepoint({ transactionId, name: "sp1" })',
    'await pg.transactions.rollbackTo({ transactionId, name: "sp1" })',
    "await pg.transactions.commit({ transactionId })",
    'await pg.transactions.execute({ statements: [{ sql: "INSERT..." }, { sql: "UPDATE..." }] })',
  ],
  jsonb: [
    'pg.jsonb.extract({ table: "docs", column: "data", path: "user.name" })',
    'pg.jsonb.extract({ table: "docs", column: "data", path: "name", select: ["id"], limit: 10 })',
    'pg.jsonb.set({ table: "docs", column: "data", path: "status", value: "active", where: "id=1" })',
    'pg.jsonb.contains({ table: "docs", column: "data", value: { type: "admin" } })',
    "pg.jsonb.merge({ base: { a: 1 }, overlay: { b: 2 }, deep: true })",
    "pg.jsonb.diff({ doc1: { a: 1 }, doc2: { a: 2, b: 3 } })",
    'pg.jsonb.agg({ table: "docs", select: ["id"], orderBy: "id DESC", limit: 5 })',
  ],
  text: [
    'pg.text.search({ table: "articles", column: "content", query: "database" })',
    'pg.text.fuzzyMatch({ table: "users", column: "name", value: "john", maxDistance: 2 })',
    'pg.text.trigramSimilarity({ table: "products", column: "name", value: "widget" })',
  ],
  performance: [
    "pg.performance.explain({ sql: 'SELECT * FROM orders' })",
    "pg.performance.cacheHitRatio()",
    "pg.performance.indexStats({ table: 'orders' })",
    "pg.performance.bloatCheck()",
  ],
  admin: [
    "pg.admin.vacuum({ table: 'orders' })",
    "pg.admin.vacuum({ table: 'orders', full: true, analyze: true })",
    "pg.admin.analyze({ table: 'orders', columns: ['created_at', 'status'] })",
    "pg.admin.reindex({ target: 'table', name: 'orders', concurrently: true })",
    "pg.admin.cluster({ table: 'orders', index: 'idx_orders_date' })",
    "pg.admin.setConfig({ name: 'work_mem', value: '256MB' })",
    "pg.admin.cancelBackend({ pid: 12345 })",
  ],
  monitoring: [
    "pg.monitoring.databaseSize()",
    "pg.monitoring.tableSizes({ limit: 10 })",
    "pg.monitoring.connectionStats()",
    "pg.monitoring.showSettings({ pattern: 'work_mem' })",
    "pg.monitoring.capacityPlanning({ days: 30 })",
    "pg.monitoring.uptime()",
    "pg.monitoring.serverVersion()",
    "pg.monitoring.resourceUsageAnalyze()",
    "pg.monitoring.alertThresholdSet({ metric: 'connection_usage' })",
  ],
  backup: [
    "pg.backup.dumpTable({ table: 'users' })",
    "pg.backup.copyExport({ table: 'orders', format: 'csv' })",
    "pg.backup.restoreCommand({ filename: 'backup.sql', database: 'mydb' })",
  ],
  schema: [
    "pg.schema.createView({ name: 'active_users', sql: 'SELECT * FROM users WHERE active' })",
    "pg.schema.listViews()",
    "pg.schema.createSequence({ name: 'order_seq' })",
  ],
  vector: [
    "pg.vector.search({ table: 'embeddings', column: 'vector', queryVector: [...], limit: 10 })",
    "pg.vector.createIndex({ table: 'embeddings', column: 'vector', method: 'ivfflat' })",
    "pg.vector.aggregate({ table: 'embeddings', column: 'vector', groupBy: 'category' })",
  ],
  postgis: [
    "pg.postgis.distance({ table: 'locations', column: 'geom', point: { lat: 40.7, lng: -74 } })",
    "pg.postgis.buffer({ table: 'areas', column: 'geom', distance: 1000 })",
    "pg.postgis.pointInPolygon({ table: 'zones', column: 'geom', point: { lat: 40.7, lng: -74 } })",
  ],
  partitioning: [
    "pg.partitioning.createPartitionedTable({ name: 'events', columns: [...], partitionBy: 'RANGE', partitionKey: 'created_at' })",
    "pg.partitioning.createPartition({ parent: 'events', name: 'events_2024_q1', forValues: { from: '2024-01-01', to: '2024-04-01' } })",
    "pg.partitioning.listPartitions({ table: 'events' })",
  ],
  stats: [
    "pg.stats.descriptive({ table: 'orders', column: 'amount' })",
    "pg.stats.percentiles({ table: 'orders', column: 'amount', percentiles: [0.5, 0.95, 0.99] })",
    "pg.stats.timeSeries({ table: 'metrics', timeColumn: 'ts', valueColumn: 'value', interval: '1 hour' })",
  ],
  cron: [
    "pg.cron.schedule({ name: 'cleanup', schedule: '0 3 * * *', command: 'DELETE FROM logs WHERE created_at < NOW() - INTERVAL 30 day' })",
    "pg.cron.listJobs()",
    "pg.cron.unschedule({ jobId: 1 })",
  ],
  partman: [
    "pg.partman.createParent({ table: 'events', column: 'created_at', interval: '1 month' })",
    "pg.partman.runMaintenance()",
    "pg.partman.showPartitions({ parentTable: 'events' })",
  ],
  kcache: [
    "pg.kcache.queryStats({ orderBy: 'total_time', limit: 10 })",
    "pg.kcache.topQueries({ limit: 5 })",
    "pg.kcache.ioPatterns()",
  ],
  citext: [
    "pg.citext.convertColumn({ table: 'users', column: 'email' })",
    "pg.citext.listColumns()",
    "pg.citext.analyzeCandidates({ table: 'users' })",
  ],
  ltree: [
    "pg.ltree.query({ table: 'categories', column: 'path', pattern: 'root.electronics.*' })",
    "pg.ltree.subpath({ table: 'categories', column: 'path', offset: 1, length: 2 })",
    "pg.ltree.lca({ table: 'categories', column: 'path', paths: ['root.a.b', 'root.a.c'] })",
  ],
  pgcrypto: [
    "pg.pgcrypto.hash({ data: 'password123', algorithm: 'sha256' })",
    "pg.pgcrypto.encrypt({ data: 'secret', key: 'mykey', algorithm: 'aes' })",
    "pg.pgcrypto.genRandomUuid()",
  ],
};
/**
 * Mapping of method names to their parameter names for positional argument support.
 * Single string = first positional arg maps to this key
 * Array = multiple positional args map to these keys in order
 *
 * Enables:
 * - `pg.core.readQuery("SELECT...")` → `{ sql: "SELECT..." }`
 * - `pg.core.exists("users", "id = 1")` → `{ table: "users", where: "id = 1" }`
 * - `pg.transactions.savepoint(txId, "sp1")` → `{ transactionId: txId, name: "sp1" }`
 */
const POSITIONAL_PARAM_MAP: Record<string, string | string[]> = {
  // ============ CORE GROUP ============
  // Single param
  readQuery: "sql",
  writeQuery: "sql",
  describeTable: "table",
  dropTable: "table",
  listTables: "schema",
  count: "table",
  truncate: "table",
  dropIndex: "name",
  listObjects: "schema",
  // Multi param
  exists: ["table", "where"],
  objectDetails: ["name", "type"],
  createTable: ["name", "columns"],
  createIndex: ["table", "columns"], // Only required params; options object gets merged
  upsert: ["table", "data", "conflictColumns"],
  batchInsert: ["table", "rows"],

  // ============ SCHEMA GROUP ============
  createSchema: "name",
  dropSchema: "name",
  createSequence: "name",
  dropSequence: "name",
  dropView: "name",
  listSequences: "schema",
  listViews: "schema",
  listFunctions: "schema",
  listTriggers: "table",
  listConstraints: "table",
  createView: ["name", "sql"], // name first, then query (sql alias)

  // ============ JSONB GROUP ============
  // All table-based JSONB tools need [table, column, ...] pattern
  extract: ["table", "column", "path", "where"],
  set: ["table", "column", "path", "value", "where"],
  insert: ["table", "column", "path", "value", "where"],
  delete: ["table", "column", "path", "where"],
  contains: ["table", "column", "value", "where"],
  pathQuery: ["table", "column", "path", "vars", "where"],
  keys: ["table", "column", "where"],
  stripNulls: ["table", "column", "where"],
  typeof: ["table", "column", "path", "where"],
  stats: ["table", "column", "sampleSize"],
  indexSuggest: ["table", "column", "sampleSize"],
  securityScan: ["table", "column", "sampleSize"],
  normalize: ["table", "column", "mode", "where"],
  agg: ["table", "column"],
  // Non-table JSONB tools
  merge: ["base", "overlay"],
  diff: ["doc1", "doc2"],
  validatePath: "path",

  // ============ TRANSACTION GROUP ============
  transactionCommit: "transactionId",
  transactionRollback: "transactionId",
  transactionSavepoint: ["transactionId", "name"],
  transactionRelease: ["transactionId", "name"],
  transactionRollbackTo: ["transactionId", "name"],
  // Note: transactionExecute uses ARRAY_WRAP_MAP, not positional mapping
  // Short aliases
  commit: "transactionId",
  rollback: "transactionId",
  savepoint: ["transactionId", "name"],
  release: ["transactionId", "name"],
  rollbackTo: ["transactionId", "name"],
  // Note: execute uses ARRAY_WRAP_MAP, not positional mapping

  // ============ PARTITIONING GROUP ============
  listPartitions: "table",
  createPartitionedTable: ["name", "columns", "partitionBy", "partitionKey"],
  createPartition: ["parent", "name", "forValues"],
  attachPartition: ["parent", "partition", "forValues"],
  detachPartition: ["parent", "partition"],
  partitionInfo: "table",

  // ============ STATS GROUP ============
  descriptive: ["table", "column"],
  percentiles: ["table", "column", "percentiles"],
  distribution: ["table", "column"],
  histogram: ["table", "column", "buckets"],
  correlation: ["table", "column1", "column2"],
  outliers: ["table", "column"],
  hypothesis: ["table", "column", "test", "hypothesizedMean"],
  sampling: ["table", "sampleSize"],
  regression: ["table", "xColumn", "yColumn"],
  timeSeries: ["table", "timeColumn", "valueColumn"], // timeColumn first is more intuitive
  // Stats prefixed aliases need mappings too
  statsTimeSeries: ["table", "timeColumn", "valueColumn"],
  statsDescriptive: ["table", "column"],
  statsPercentiles: ["table", "column", "percentiles"],
  statsDistribution: ["table", "column"],
  statsCorrelation: ["table", "column1", "column2"],
  statsHypothesis: ["table", "column", "test", "hypothesizedMean"],
  statsSampling: ["table", "sampleSize"],
  statsRegression: ["table", "xColumn", "yColumn"],

  // ============ TEXT GROUP ============
  // New tools
  toVector: "text",
  toQuery: "text",
  textToVector: "text",
  textToQuery: "text",
  // Wrapper functions (soundex/metaphone call fuzzyMatch)
  soundex: ["table", "column", "value"],
  metaphone: ["table", "column", "value"],
};

/**
 * Methods where a single array arg should be wrapped in a specific key
 */
const ARRAY_WRAP_MAP: Record<string, string> = {
  transactionExecute: "statements",
  execute: "statements",
  // JSONB builders - support both 'values' and 'elements'
  array: "values",
  jsonbArray: "values",
};

/**
 * Methods where a single object arg should be wrapped in a specific key
 * (instead of passed through directly)
 */
const OBJECT_WRAP_MAP: Record<string, string> = {
  object: "pairs", // pg.jsonb.object({key: val}) → {pairs: {key: val}}
  jsonbObject: "pairs", // alias
};

/**
 * Normalize parameters to support positional arguments.
 * Handles both single positional args and multiple positional args.
 */
function normalizeParams(methodName: string, args: unknown[]): unknown {
  // No args - pass through
  if (args.length === 0) return undefined;

  // Single arg handling
  if (args.length === 1) {
    const arg = args[0];

    // Object arg - check if we need to wrap it
    if (typeof arg === "object" && arg !== null && !Array.isArray(arg)) {
      const wrapKey = OBJECT_WRAP_MAP[methodName];
      if (wrapKey !== undefined) {
        return { [wrapKey]: arg };
      }
      // Pass through normally
      return arg;
    }

    // Array arg - check if we should wrap it
    if (Array.isArray(arg)) {
      const wrapKey = ARRAY_WRAP_MAP[methodName];
      if (wrapKey !== undefined) {
        return { [wrapKey]: arg };
      }
      // Return as-is (e.g., for rows parameter)
      return arg;
    }

    // String arg - use positional mapping
    if (typeof arg === "string") {
      const paramMapping = POSITIONAL_PARAM_MAP[methodName];
      if (typeof paramMapping === "string") {
        return { [paramMapping]: arg };
      }
      if (Array.isArray(paramMapping) && paramMapping[0] !== undefined) {
        return { [paramMapping[0]]: arg };
      }
      // Fallback: try common parameter names
      return { sql: arg, query: arg, table: arg, name: arg };
    }

    return arg;
  }

  // Multi-arg: check for array+options pattern first (e.g., execute([stmts], {isolationLevel}))
  if (args.length >= 1 && Array.isArray(args[0])) {
    const wrapKey = ARRAY_WRAP_MAP[methodName];
    if (wrapKey !== undefined) {
      const result: Record<string, unknown> = { [wrapKey]: args[0] };
      // Merge trailing options object
      if (args.length > 1) {
        const lastArg = args[args.length - 1];
        if (
          typeof lastArg === "object" &&
          lastArg !== null &&
          !Array.isArray(lastArg)
        ) {
          Object.assign(result, lastArg);
        }
      }
      return result;
    }
  }

  // Look up positional parameter mapping
  const paramMapping = POSITIONAL_PARAM_MAP[methodName];

  if (paramMapping === undefined) {
    return args[0];
  }

  // Single param mapping - merge trailing options if present
  if (typeof paramMapping === "string") {
    const result: Record<string, unknown> = { [paramMapping]: args[0] };
    // Merge trailing options object (e.g., truncate("table", { cascade: true }))
    if (args.length > 1) {
      const lastArg = args[args.length - 1];
      if (
        typeof lastArg === "object" &&
        lastArg !== null &&
        !Array.isArray(lastArg)
      ) {
        Object.assign(result, lastArg);
      }
    }
    return result;
  }

  // Multi-param mapping (array)
  const result: Record<string, unknown> = {};

  // Check if last arg is an options object that should be merged
  const lastArg = args[args.length - 1];
  const lastArgIsOptionsObject =
    typeof lastArg === "object" &&
    lastArg !== null &&
    !Array.isArray(lastArg) &&
    Object.keys(lastArg as Record<string, unknown>).some((k) =>
      paramMapping.includes(k),
    );

  // Map positional args to their keys, skipping options object if detected
  const argsToMap = lastArgIsOptionsObject ? args.length - 1 : args.length;
  for (let i = 0; i < paramMapping.length && i < argsToMap; i++) {
    const key = paramMapping[i];
    const arg = args[i];
    if (key !== undefined) {
      result[key] = arg;
    }
  }

  // Merge trailing options object (either beyond mapping length or detected options object)
  if (args.length > paramMapping.length || lastArgIsOptionsObject) {
    if (
      typeof lastArg === "object" &&
      lastArg !== null &&
      !Array.isArray(lastArg)
    ) {
      Object.assign(result, lastArg);
    }
  }

  return result;
}

/**
 * Dynamic API generator for tool groups
 * Creates methods for each tool in the group
 */
function createGroupApi(
  adapter: PostgresAdapter,
  groupName: string,
  tools: ToolDefinition[],
): Record<string, (...args: unknown[]) => Promise<unknown>> {
  const api: Record<string, (...args: unknown[]) => Promise<unknown>> = {};

  for (const tool of tools) {
    // Convert tool name to method name
    // e.g., pg_read_query -> readQuery, pg_jsonb_extract -> extract
    const methodName = toolNameToMethodName(tool.name, groupName);

    api[methodName] = async (...args: unknown[]) => {
      // Normalize positional arguments to object parameters
      const normalizedParams = normalizeParams(methodName, args);
      const context = adapter.createContext();
      return tool.handler(normalizedParams, context);
    };
  }

  // Add method aliases for this group
  const aliases = METHOD_ALIASES[groupName];
  if (aliases !== undefined) {
    for (const [aliasName, canonicalName] of Object.entries(aliases)) {
      if (api[canonicalName] !== undefined) {
        api[aliasName] = api[canonicalName];
      }
    }
  }

  // Add special wrapper functions for text group (soundex/metaphone call fuzzyMatch with method param)
  if (groupName === "text" && api["fuzzyMatch"] !== undefined) {
    const fuzzyMatchFn = api["fuzzyMatch"];

    // pg.text.soundex({table, column, value}) → fuzzyMatch({table, column, value, method: 'soundex'})
    api["soundex"] = async (...args: unknown[]) => {
      const normalizedParams = normalizeParams("soundex", args) as
        | Record<string, unknown>
        | undefined;
      return fuzzyMatchFn({ ...normalizedParams, method: "soundex" });
    };

    // pg.text.metaphone({table, column, value}) → fuzzyMatch({table, column, value, method: 'metaphone'})
    api["metaphone"] = async (...args: unknown[]) => {
      const normalizedParams = normalizeParams("metaphone", args) as
        | Record<string, unknown>
        | undefined;
      return fuzzyMatchFn({ ...normalizedParams, method: "metaphone" });
    };
  }

  // Add special wrapper functions for performance group
  if (groupName === "performance") {
    const locksFn = api["locks"];
    const statActivityFn = api["statActivity"];

    // pg.performance.blockingQueries() → locks({ showBlocked: true })
    if (locksFn !== undefined) {
      api["blockingQueries"] = async () => {
        return locksFn({ showBlocked: true });
      };
    }

    // pg.performance.longRunningQueries(seconds?) → statActivity filtered by duration
    if (statActivityFn !== undefined) {
      api["longRunningQueries"] = async (...args: unknown[]) => {
        // Support both: longRunningQueries(10) and longRunningQueries({seconds: 10})
        let minSeconds: number | undefined;
        const arg0 = args[0];
        if (typeof arg0 === "number") {
          minSeconds = arg0;
        } else if (typeof arg0 === "object" && arg0 !== null) {
          const obj = arg0 as Record<string, unknown>;
          const secVal =
            obj["seconds"] ??
            obj["threshold"] ??
            obj["minSeconds"] ??
            obj["minDuration"];
          if (typeof secVal === "number") {
            minSeconds = secVal;
          }
        }

        const result = (await statActivityFn({ includeIdle: false })) as {
          connections: Record<string, unknown>[];
          count: number;
        };
        const threshold = minSeconds ?? 5; // Default 5 seconds
        const longRunning = result.connections.filter((conn) => {
          const duration = conn["duration"];
          if (typeof duration === "string") {
            // Parse interval like "00:00:10.123"
            const parts = duration.split(":");
            if (parts.length >= 3) {
              const hours = parseInt(parts[0] ?? "0", 10);
              const mins = parseInt(parts[1] ?? "0", 10);
              const secs = parseFloat(parts[2] ?? "0");
              const totalSeconds = hours * 3600 + mins * 60 + secs;
              return totalSeconds >= threshold;
            }
          }
          return false;
        });
        return {
          longRunningQueries: longRunning,
          count: longRunning.length,
          threshold: `${String(threshold)} seconds`,
        };
      };
    }

    // pg.performance.analyzeTable() → Actually runs ANALYZE (cross-group bridge to admin)
    api["analyzeTable"] = async (...args: unknown[]): Promise<unknown> => {
      const arg0 = args[0];
      let tableName = "";
      let schemaName = "public";

      if (typeof arg0 === "string") {
        // Handle schema.table format
        if (arg0.includes(".")) {
          const parts = arg0.split(".");
          schemaName = parts[0] ?? "public";
          tableName = parts[1] ?? "";
        } else {
          tableName = arg0;
        }
      } else if (typeof arg0 === "object" && arg0 !== null) {
        const obj = arg0 as Record<string, unknown>;
        const tableVal = obj["table"] ?? obj["name"];
        if (typeof tableVal === "string") {
          // Handle schema.table format in object form too
          if (tableVal.includes(".")) {
            const parts = tableVal.split(".");
            schemaName = parts[0] ?? "public";
            tableName = parts[1] ?? "";
          } else {
            tableName = tableVal;
          }
        }
        // Only use explicit schema if table didn't contain schema prefix
        const schemaVal = obj["schema"];
        if (
          typeof schemaVal === "string" &&
          !tableVal?.toString().includes(".")
        ) {
          schemaName = schemaVal;
        }
      }

      if (tableName === "") {
        return {
          error: "Table name required",
          usage:
            'pg.performance.analyzeTable("table_name") or pg.performance.analyzeTable({ table: "name", schema: "public" })',
        };
      }

      // Execute ANALYZE directly
      const qualifiedName = `"${schemaName}"."${tableName}"`;
      await adapter.executeQuery(`ANALYZE ${qualifiedName}`);

      return {
        success: true,
        message: `ANALYZE completed on ${qualifiedName}`,
        hint: "Table statistics updated for query planner optimization.",
      };
    };
  }

  return api;
}

/**
 * Convert tool name to camelCase method name
 * Examples:
 *   pg_read_query (core) -> readQuery
 *   pg_jsonb_extract (jsonb) -> extract
 *   pg_vector_search (vector) -> search
 */
function toolNameToMethodName(toolName: string, groupName: string): string {
  // Remove pg_ prefix
  let name = toolName.replace(/^pg_/, "");

  // Remove group prefix if present
  const groupPrefix = groupName.replace(/-/g, "_") + "_";
  if (name.startsWith(groupPrefix)) {
    name = name.substring(groupPrefix.length);
  }

  // Convert snake_case to camelCase
  return name.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

/**
 * Main API class exposing all tool groups
 */
export class PgApi {
  readonly core: Record<string, (...args: unknown[]) => Promise<unknown>>;
  readonly transactions: Record<
    string,
    (...args: unknown[]) => Promise<unknown>
  >;
  readonly jsonb: Record<string, (...args: unknown[]) => Promise<unknown>>;
  readonly text: Record<string, (...args: unknown[]) => Promise<unknown>>;
  readonly performance: Record<
    string,
    (...args: unknown[]) => Promise<unknown>
  >;
  readonly admin: Record<string, (...args: unknown[]) => Promise<unknown>>;
  readonly monitoring: Record<string, (...args: unknown[]) => Promise<unknown>>;
  readonly backup: Record<string, (...args: unknown[]) => Promise<unknown>>;
  readonly schema: Record<string, (...args: unknown[]) => Promise<unknown>>;
  readonly vector: Record<string, (...args: unknown[]) => Promise<unknown>>;
  readonly postgis: Record<string, (...args: unknown[]) => Promise<unknown>>;
  readonly partitioning: Record<
    string,
    (...args: unknown[]) => Promise<unknown>
  >;
  readonly stats: Record<string, (...args: unknown[]) => Promise<unknown>>;
  readonly cron: Record<string, (...args: unknown[]) => Promise<unknown>>;
  readonly partman: Record<string, (...args: unknown[]) => Promise<unknown>>;
  readonly kcache: Record<string, (...args: unknown[]) => Promise<unknown>>;
  readonly citext: Record<string, (...args: unknown[]) => Promise<unknown>>;
  readonly ltree: Record<string, (...args: unknown[]) => Promise<unknown>>;
  readonly pgcrypto: Record<string, (...args: unknown[]) => Promise<unknown>>;

  private readonly toolsByGroup: Map<string, ToolDefinition[]>;

  constructor(adapter: PostgresAdapter) {
    // Get all tool definitions and group them
    const allTools = adapter.getToolDefinitions();
    this.toolsByGroup = this.groupTools(allTools);

    // Create group-specific APIs
    this.core = createGroupApi(
      adapter,
      "core",
      this.toolsByGroup.get("core") ?? [],
    );
    this.transactions = createGroupApi(
      adapter,
      "transactions",
      this.toolsByGroup.get("transactions") ?? [],
    );
    this.jsonb = createGroupApi(
      adapter,
      "jsonb",
      this.toolsByGroup.get("jsonb") ?? [],
    );
    this.text = createGroupApi(
      adapter,
      "text",
      this.toolsByGroup.get("text") ?? [],
    );
    this.performance = createGroupApi(
      adapter,
      "performance",
      this.toolsByGroup.get("performance") ?? [],
    );
    this.admin = createGroupApi(
      adapter,
      "admin",
      this.toolsByGroup.get("admin") ?? [],
    );
    this.monitoring = createGroupApi(
      adapter,
      "monitoring",
      this.toolsByGroup.get("monitoring") ?? [],
    );
    this.backup = createGroupApi(
      adapter,
      "backup",
      this.toolsByGroup.get("backup") ?? [],
    );
    this.schema = createGroupApi(
      adapter,
      "schema",
      this.toolsByGroup.get("schema") ?? [],
    );
    this.vector = createGroupApi(
      adapter,
      "vector",
      this.toolsByGroup.get("vector") ?? [],
    );
    this.postgis = createGroupApi(
      adapter,
      "postgis",
      this.toolsByGroup.get("postgis") ?? [],
    );
    this.partitioning = createGroupApi(
      adapter,
      "partitioning",
      this.toolsByGroup.get("partitioning") ?? [],
    );
    this.stats = createGroupApi(
      adapter,
      "stats",
      this.toolsByGroup.get("stats") ?? [],
    );
    this.cron = createGroupApi(
      adapter,
      "cron",
      this.toolsByGroup.get("cron") ?? [],
    );
    this.partman = createGroupApi(
      adapter,
      "partman",
      this.toolsByGroup.get("partman") ?? [],
    );
    this.kcache = createGroupApi(
      adapter,
      "kcache",
      this.toolsByGroup.get("kcache") ?? [],
    );
    this.citext = createGroupApi(
      adapter,
      "citext",
      this.toolsByGroup.get("citext") ?? [],
    );
    this.ltree = createGroupApi(
      adapter,
      "ltree",
      this.toolsByGroup.get("ltree") ?? [],
    );
    this.pgcrypto = createGroupApi(
      adapter,
      "pgcrypto",
      this.toolsByGroup.get("pgcrypto") ?? [],
    );
  }

  /**
   * Group tools by their tool group
   */
  private groupTools(tools: ToolDefinition[]): Map<string, ToolDefinition[]> {
    const grouped = new Map<string, ToolDefinition[]>();

    for (const tool of tools) {
      const group = tool.group;
      const existing = grouped.get(group);
      if (existing) {
        existing.push(tool);
      } else {
        grouped.set(group, [tool]);
      }
    }

    return grouped;
  }

  /**
   * Get list of available groups and their method counts
   */
  getAvailableGroups(): Record<string, number> {
    const groups: Record<string, number> = {};
    for (const [group, tools] of this.toolsByGroup) {
      groups[group] = tools.length;
    }
    return groups;
  }

  /**
   * Get list of methods available in a group
   */
  getGroupMethods(groupName: string): string[] {
    const groupApi = this[groupName as keyof PgApi];
    if (typeof groupApi === "object" && groupApi !== null) {
      return Object.keys(groupApi as Record<string, unknown>);
    }
    return [];
  }

  /**
   * Get help information listing all groups and their methods.
   * Call pg.help() in code mode to discover available APIs.
   *
   * @returns Object with group names as keys and arrays of method names as values
   */
  help(): Record<string, string[]> {
    const result: Record<string, string[]> = {};
    for (const [group, tools] of this.toolsByGroup) {
      // Skip codemode group itself
      if (group === "codemode") continue;
      result[group] = tools.map((t) => toolNameToMethodName(t.name, group));
    }
    return result;
  }

  /**
   * Create a serializable API binding for the sandbox
   * This creates references that can be called from isolated-vm
   */
  createSandboxBindings(): Record<string, unknown> {
    const bindings: Record<string, unknown> = {};

    const groupNames = [
      "core",
      "transactions",
      "jsonb",
      "text",
      "performance",
      "admin",
      "monitoring",
      "backup",
      "schema",
      "vector",
      "postgis",
      "partitioning",
      "stats",
      "cron",
      "partman",
      "kcache",
      "citext",
      "ltree",
      "pgcrypto",
    ] as const;

    for (const groupName of groupNames) {
      const groupApi = this[groupName];
      // Capture all method names including aliases
      const allMethodNames = Object.keys(groupApi);

      // Separate canonical methods from aliases for structured help output
      const aliases = METHOD_ALIASES[groupName] ?? {};
      const aliasNames = new Set(Object.keys(aliases));
      const canonicalMethodNames = allMethodNames.filter(
        (name) => !aliasNames.has(name),
      );
      const aliasMethodNames = allMethodNames.filter((name) =>
        aliasNames.has(name),
      );

      // Add all methods plus a 'help' property that lists them
      bindings[groupName] = {
        ...groupApi,
        // Help returns all methods - canonical first, then aliases, plus examples
        help: () => ({
          methods: canonicalMethodNames,
          aliases: aliasMethodNames.length > 0 ? aliasMethodNames : undefined,
          examples: GROUP_EXAMPLES[groupName],
        }),
      };
    }

    // Add top-level help as directly callable pg.help()
    bindings["help"] = () => this.help();

    return bindings;
  }
}

/**
 * Create a PgApi instance for an adapter
 */
export function createPgApi(adapter: PostgresAdapter): PgApi {
  return new PgApi(adapter);
}
