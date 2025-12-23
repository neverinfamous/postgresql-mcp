/**
 * Server instructions for Code Mode usage.
 * 
 * These instructions are automatically sent to MCP clients during initialization,
 * eliminating the need for users to manually provide agent instructions.
 */
export const SERVER_INSTRUCTIONS = `# postgres-mcp Code Mode

**Aliases auto-resolve**: \`query\`/\`sql\`, \`table\`/\`tableName\`/\`name\`, \`pid\`/\`processId\`, \`schema.table\` format auto-parses, etc. Use natural names.

## API Naming
\`pg_group_action\` → \`pg.group.action()\`. Group prefixes are removed: \`pg_jsonb_extract\` → \`pg.jsonb.extract()\`

Both naming patterns work: \`pg.jsonb.extract()\` and \`pg.jsonb.jsonbExtract()\` are equivalent.

**Positional args supported**: Single and multi-arg shortcuts work:
- \`pg.core.readQuery("SELECT...")\` → \`{sql: "..."}\`
- \`pg.core.exists("users", "id=1")\` → \`{table, where}\`
- \`pg.core.createIndex("users", ["email"])\` → \`{table, columns}\` (name auto-generated as idx_users_email)
- \`pg.core.createIndex("users", ["email"], {name: "custom_idx", unique: true})\` → options merged
- \`pg.core.batchInsert("users", [{name: "Alice"}, {name: "Bob"}])\` → rows are objects, columns inferred
- \`pg.jsonb.extract("docs", "data", "path")\` → \`{table, column, path}\`
- \`pg.jsonb.extract("docs", "data", "path", "id=1")\` → \`{table, column, path, where}\`
- \`pg.transactions.savepoint(txId, "sp1")\` → \`{transactionId, name}\`

Transaction shortcuts: \`pg.transactions.begin()\`, \`commit()\`, \`rollback()\`, \`savepoint()\`, \`execute()\`

## Convenience Tools
\`pg_upsert\`, \`pg_batch_insert\`, \`pg_count\`, \`pg_exists\`, \`pg_truncate\` for common operations.

## Drop Tools
\`pg_drop_index\` (core), \`pg_drop_view\`, \`pg_drop_sequence\` (schema) - all support \`ifExists\` and \`cascade\`.

## Health/Analyze Tools
\`pg.core.analyzeDbHealth()\`, \`pg.core.analyzeWorkloadIndexes()\`, \`pg.core.analyzeQueryIndexes()\` - note: in core group.

## Discovery
Use \`pg.help()\` to list all groups and methods. Use \`pg.core.help()\`, \`pg.jsonb.help()\`, etc. for group-specific methods.

## Schema.Table Format
\`table: 'public.users'\` auto-parses to \`schema: 'public', table: 'users'\` in all table-related tools.

## JSONB Paths
All JSONB tools accept both STRING (\`'a.b.c'\`) and ARRAY (\`['a','b','c']\`) path formats.

## Gotchas

**List returns**: All list operations return \`{items:[...], count:N}\` not array. Access via \`result.tables\`, \`result.views\`, etc.

**pg_write_query RETURNING**: Returns \`rows\` array when using RETURNING clause. Response uses \`rowsAffected\` (not \`affectedRows\`).

**PostGIS tools**: \`geometryBuffer/geometryTransform\` = standalone WKT input; \`buffer/transform\` = table column input

**pg_vector_embed**: Demo only (hash-based). Use OpenAI/Cohere for production.

## Vector Tools
\`pg_vector_insert({updateExisting: true, conflictColumn: 'id', conflictValue: 42})\`: Update mode uses direct UPDATE (avoids NOT NULL constraint issues). Insert mode (default) requires all NOT NULL columns via additionalColumns.
\`pg_vector_search\`: Use \`select: ["id", "name"]\` to include identifying columns. Without select, only returns distance. \`filter\` is alias for \`where\`.
\`pg_vector_batch_insert\`: \`vectors\` expects \`[{vector: [...], data?: {...}}]\` objects, not raw arrays.
\`pg_vector_cluster\`: \`clusters\` is alias for \`k\`.
\`pg_vector_aggregate({groupBy: 'category'})\`: Returns grouped averages. Returns \`{groups: [{group_key, average_vector, count}]}\`.
\`pg_vector_performance\`: Auto-generates testVector from first row if omitted. Returns \`tableSize\`, \`estimatedRows\`, \`benchmark\`.

**Code Mode Only**:
- \`pg.vector.batchInsert({table, column, vectors})\`: Bulk vector insertion
- \`pg.vector.validate({table, column})\`: Validates vector column configuration

**ifNotExists**: Available on \`createIndex\`, \`createSequence\`, \`addColumn\`, \`geometryColumn\`, \`spatialIndex\` - returns \`{alreadyExists:true}\`

**pg_upsert conflictColumns**: Requires UNIQUE constraint or PRIMARY KEY on conflict columns. Error "no unique or exclusion constraint matching" means add constraint first.

**pg_drop_index**: Takes \`dropIndex(indexName)\` not \`dropIndex(tableName)\`. Use \`pg_get_indexes\` to find index names.

**Code Mode Transactions**: Two options: (1) Use \`pg.transactions.execute({statements: [{sql:...}]})\` for atomic ops, or (2) Pass \`transactionId\` to queries: \`pg.core.writeQuery({sql: "...", transactionId: tx.transactionId})\`

**pg_jsonb_agg groupBy**: Returns \`{groups: [{group_key, items}], count}\` when groupBy is used

**pg_jsonb_agg**: Returns empty array \`[]\` (not null) when no rows match

**pg_list_functions**: Default limit=500 may hide user functions when many extensions are installed. Use \`schema: 'public'\` to filter to your schema, \`limit: 2000\` for more results, or \`exclude: ['postgis', 'ltree']\` to filter out extension functions by name

**pg_get_indexes**: Omit \`table\` to list all indexes in database

## Schema Tools
\`pg_list_schemas\`: Returns all user schemas. Extension schemas (cron, topology) included without special marking. Filter client-side if needed.
\`pg_list_sequences({schema: 'myschema'})\`: Optional \`schema\` parameter. \`owned_by\` returns \`table.column\` format or null.
\`pg_list_views\`: Returns \`{views, count, hasMatViews}\`. View definitions have leading whitespace trimmed.
\`pg_create_view({orReplace: true})\`: **OR REPLACE cannot change column names/count** - PostgreSQL limitation. Drop and recreate instead.
\`pg_list_functions({exclude: [...], limit: N, schema: 'name'})\`: \`exclude\` filters both schema names and extension-owned functions. Default limit=500.
\`pg_list_triggers\`: Returns \`events\` array with all events (INSERT, UPDATE, DELETE, TRUNCATE).
\`pg_drop_schema({ifExists: true})\`: Returns \`{existed: true/false}\` to indicate if schema was dropped.
\`pg_list_constraints\`: Type output uses human-readable names (primary_key, foreign_key, unique, check).

## JSONB Path Format
- Dot notation \`a.b.c\` treats dots as path separators
- For literal dots in keys, use array format: \`["key.with.dots"]\`
- \`pg_jsonb_extract\` returns null if path doesn't exist (check with \`pg_jsonb_typeof\` first)
- \`pg_jsonb_normalize flatten\` doesn't descend into arrays (use mode: 'array' for array columns)
- \`pg_jsonb_normalize keys\` returns text values (use \`pairs\` mode to preserve JSON types)
- \`pg_jsonb_diff\` is shallow comparison only; for deep diff, flatten both docs and compare

## JSONB Behavior Notes
- \`pg_jsonb_insert\`: Index -1 inserts BEFORE last element; use \`insertAfter: true\` to append
- \`pg_jsonb_set\`: createMissing=true creates full nested paths; initializes NULL columns to {}
- Object-only tools: \`pg_jsonb_diff/merge/keys/index_suggest/security_scan\` require objects, not arrays

## Stats Tools
\`timeSeries(table, timeColumn, valueColumn)\` - timeColumn must be timestamp, valueColumn numeric. \`interval\` accepts: keywords (hour, day, week), PostgreSQL format ("1 hour", "2 days"), or plurals (hours, days) - all normalized. With aggregation:"count", value equals count.
Most tools support \`groupBy\` param - returns grouped results: \`descriptive\`, \`timeSeries\`, \`percentiles\`, \`correlation\`, \`regression\`, \`hypothesis\`, \`distribution\`.
\`distribution\`: Returns \`skewness\` and \`kurtosis\` (excess). buckets must be > 0. groupBy computes per-group histograms.
\`hypothesis\`: testType accepts all formats: t, z, ttest, ztest, t_test, z_test, t-test, z-test (all normalized). LIMITATION: Returns testStatistic only, NOT p-values.
\`sampling\`: Defaults to random method with 100 rows. Use \`sampleSize\` for exact count (takes precedence over percentage). WARNING: \`system\` method uses page-level sampling and may return 0 rows on small tables - use \`bernoulli\` or \`random\` instead.
\`percentiles\`: Accept 0-1 or 0-100 format (auto-normalized). Empty array uses defaults [0.25, 0.5, 0.75].
Result arrays: \`buckets\` (timeSeries), \`histogram\` (distribution), \`rows\` (sampling).

## Performance Tools (20 tools)
Core methods: \`explain()\`, \`explainAnalyze()\`, \`explainBuffers()\`, \`indexStats()\`, \`tableStats()\`, \`statStatements()\`, \`statActivity()\`, \`locks()\`, \`bloatCheck()\`, \`cacheHitRatio()\`, \`seqScanTables()\`, \`indexRecommendations()\`, \`queryPlanCompare()\`, \`baseline()\`, \`connectionPoolOptimize()\`, \`partitionStrategySuggest()\`, \`unusedIndexes()\`, \`duplicateIndexes()\`, \`vacuumStats()\`, \`queryPlanStats()\`.
Aliases: \`cacheStats\`→\`cacheHitRatio\`, \`queryStats\`→\`statStatements\`, \`activity\`/\`runningQueries\`→\`statActivity\`, \`indexUsage\`→\`indexStats\`, \`vacuum\`→\`vacuumStats\`, \`bloatEstimate\`/\`bloat\`→\`bloatCheck\`.
Wrappers: \`blockingQueries()\`→\`locks({showBlocked:true})\`, \`longRunningQueries(seconds?)\` filters statActivity by duration (threshold in seconds).
\`analyzeTable(table)\` runs ANALYZE on table (bridges to admin functionality). \`indexStats()\`/\`bloatCheck()\`: table param is optional.
\`seqScanTables\`: Default minScans=10. \`indexRecommendations\`: Pass \`sql\` for HypoPG analysis.
MCP tool names use underscores (pg_blocking_queries), Code Mode uses camelCase (blockingQueries).

## Monitoring Tools (12 tools)
Core methods: \`databaseSize()\`, \`tableSizes()\`, \`connectionStats()\`, \`replicationStatus()\`, \`serverVersion()\`, \`showSettings()\`, \`uptime()\`, \`recoveryStatus()\`, \`capacityPlanning()\`, \`resourceUsageAnalyze()\`, \`alertThresholdSet()\`.
Aliases: \`connections\`→\`connectionStats\`, \`settings\`/\`config\`→\`showSettings\`, \`alerts\`/\`thresholds\`→\`alertThresholdSet\`.
\`showSettings({setting: 'work_mem'})\` - accepts \`pattern\`, \`setting\`, or \`name\` parameter. Exact names auto-match; use \`%\` for LIKE patterns.
\`capacityPlanning({days: 90})\` - \`days\` is alias for \`projectionDays\`. Growth estimates based on stats since last reset.
\`alertThresholdSet()\` - returns recommended thresholds (does not configure alerts).

## Backup Tools (9 tools)
\`pg_copy_export\`: Use \`query\`/\`sql\` OR \`table\` parameter. With \`table\`, auto-generates SELECT * query.
- \`csv\` (default): Returns \`{data, rowCount}\` with comma-delimited, quoted values
- \`text\`: Returns \`{data, rowCount}\` with tab-delimited text, \\\\N for NULLs
- \`binary\`: Returns \`{rows, rowCount, note}\` (raw objects; true binary requires direct connection)

\`pg_dump_table\`: Returns \`{ddl, note}\` with basic CREATE TABLE (columns + NOT NULL only). **PRIMARY KEYS, INDEXES, and CONSTRAINTS are NOT included**—use \`pg_get_indexes\` and \`pg_get_constraints\` for complete structure.

\`pg_create_backup_plan\`: Generates backup strategy with cron schedule. \`frequency\` options:
- \`hourly\`: cron \`0 * * * *\` (every hour)
- \`daily\` (default): cron \`0 2 * * *\` (2 AM daily)
- \`weekly\`: cron \`0 2 * * 0\` (Sundays 2 AM)

\`pg_backup_physical\`: Generates pg_basebackup command. \`format\` options:
- \`tar\` (default): Creates single compressed archive file (-Ft)
- \`plain\`: Creates directory structure with individual data files (-Fp)

\`pg_restore_command\`: Generates pg_restore command. Include \`database\` parameter for complete command; otherwise a warning is returned.

Code Mode: \`pg.backup.dumpTable()\`, \`copyExport()\`, \`physical()\`, \`createBackupPlan()\`, \`restoreCommand()\`, etc.

## Text Tools
MCP Tool Names: \`pg_text_search\`, \`pg_text_rank\`, \`pg_text_headline\`, \`pg_text_normalize\`, \`pg_text_sentiment\`, \`pg_trigram_similarity\`, \`pg_fuzzy_match\`, \`pg_regexp_match\`, \`pg_like_search\`, \`pg_similarity_search\`, \`pg_create_fts_index\`, \`pg_text_to_vector\`, \`pg_text_to_query\`, \`pg_text_search_config\`
Defaults: \`threshold\`=0.3 (use 0.1-0.2 for partial matches), \`maxDistance\`=3 (use 5+ for longer strings).
\`pg_trigram_similarity\` vs \`pg_similarity_search\`: Both use pg_trgm. \`trigramSimilarity\` filters by threshold; \`similaritySearch\` uses set_limit() with % operator.
\`pg_fuzzy_match\`: Levenshtein returns distance (lower=better). Soundex/metaphone return phonetic codes (exact match only, no ranking).
\`pg_text_rank\`: Returns only matching rows with rank score. For non-matching row comparison, use pg_read_query with ts_rank_cd.
\`pg_text_normalize\`: Removes accent marks only (unaccent). Does NOT lowercase or trim—use LOWER()/TRIM() for those.
Code Mode aliases: \`similar\`/\`trigram\`→\`trigramSimilarity\`, \`similarity\`→\`similaritySearch\`, \`regex\`/\`regexp\`/\`patternMatch\`→\`regexpMatch\`, \`highlight\`→\`headline\`, \`createIndex\`→\`createFtsIndex\`, \`configs\`/\`searchConfigs\`→\`searchConfig\`.
Phonetic wrappers: \`pg.text.soundex()\`/\`pg.text.metaphone()\` call fuzzyMatch with method pre-set.

## Partitioning Tools
\`pg_create_partitioned_table\`: \`partitionBy\` accepts "RANGE"/"range", "LIST"/"list", "HASH"/"hash" (case-insensitive). Columns: \`notNull\`, \`primaryKey\`, \`unique\`, \`default\`. **Note**: \`primaryKey\`/\`unique\` must include partition key column.
\`pg_create_partition\`: Params: \`parent\` (or \`table\`/\`parentTable\`), \`name\` (or \`partitionName\`), bounds:
- RANGE: \`{from, to}\` or \`{rangeFrom, rangeTo}\`
- LIST: \`{values}\` or \`{listValues}\`
- HASH: \`{modulus, remainder}\` or \`{hashModulus, hashRemainder}\`
- DEFAULT: \`{isDefault: true}\`
**Sub-partitioning**: \`subpartitionBy\` (case-insensitive) + \`subpartitionKey\`.
Code Mode: \`pg.partitioning.create()\` maps to \`createPartition\`, not \`createPartitionedTable\`. Use \`pg.partitioning.createPartitionedTable()\` explicitly.
\`pg_attach_partition\`: Uses same bounds aliases as \`pg_create_partition\`.
\`pg_detach_partition\`: \`finalize: true\` only after interrupted \`CONCURRENTLY\` detach.
\`pg_list_partitions\`/\`pg_partition_info\`: Code Mode: \`pg.partitioning.info()\` = \`pg.partitioning.partitionInfo()\`.

## pg_partman Tools
\`pg_partman_create_parent\`: Aliases: \`control\`/\`column\`/\`partitionColumn\` → \`controlColumn\`, \`partitionInterval\` → \`interval\`. Interval must use PostgreSQL syntax ('1 day', '1 month') NOT deprecated keywords ('daily', 'monthly'). Partition type (time vs integer) is auto-detected from column type. Warning: \`startPartition\` far in past creates many partitions.
\`pg_partman_show_partitions\`/\`check_default\`/\`partition_data\`: \`parentTable\` required. Use \`pg_partman_show_config\` to list all partition sets first.
\`pg_partman_undo_partition\`: \`target\` alias for \`targetTable\`. Target table MUST exist before calling (create with same structure as parent).
\`pg_partman_run_maintenance\`: Without \`parentTable\`, maintains all sets and skips orphaned configs (dropped tables with stale config) with warnings.
\`pg_partman_set_retention\`: \`keepTable\` alias for \`retentionKeepTable\`. Pass null/empty \`retention\` to disable retention policy. Throws error if config not found.
\`pg_partman_analyze_partition_health\`: Returns \`overallHealth: 'unknown'\` with message when specified table not found in pg_partman config.

## pg_stat_kcache Tools
\`pg_kcache_query_stats\`: \`orderBy\` options: 'total_time' (default), 'cpu_time', 'reads', 'writes'. Note: 'calls' is not a valid orderBy option—use \`minCalls\` parameter to filter by call count instead.
\`pg_kcache_top_io\`: \`ioType\` (or \`type\`) parameter: 'reads', 'writes', 'both' (default). Controls ranking order.
\`pg_kcache_resource_analysis\`: \`limit\` parameter controls max queries returned (default: 50). Classifies queries as CPU-bound, I/O-bound, or Balanced.

## citext Tools
\`pg_citext_schema_advisor\`: Requires \`table\` parameter to analyze. Use \`tableName\` as alias.
\`pg_citext_convert_column\`: When views depend on the column, you must drop and recreate them manually—PostgreSQL cannot ALTER COLUMN TYPE with dependent views. The tool will detect and list dependent views upfront.

## ltree Tools
\`pg_ltree_query\`: Query ancestors/descendants with exact paths, or use lquery patterns (auto-detected by wildcards). \`mode\` (or \`type\`): 'ancestors' (find all parent paths), 'descendants' (default, find all child paths), 'exact'.
\`pg_ltree_match\`: Explicit lquery pattern matching—use when pattern intent is clear. Functionally equivalent to \`pg_ltree_query\` with patterns, but \`pg_ltree_match\` is clearer when you specifically want pattern matching.
\`pg_ltree_subpath\`: Extract portion of path. \`len\` is alias for \`length\`, \`start\`/\`from\` are aliases for \`offset\`.

## Core Tool Returns
- \`pg_write_query\`: Returns \`rowsAffected\` (not \`affectedRows\`). Use RETURNING clause for row data.
- \`pg_count\`: Returns \`{count: N}\` object
- \`pg_exists\`: Returns \`{exists: bool}\` object
- \`pg_upsert/pg_batch_insert\`: Use RETURNING in separate query for inserted data
- \`pg_create_index\`: Use \`{columns: [...]}\` object format

## PostgreSQL Type Notes
- \`COUNT(*)\` returns BIGINT as string (PostgreSQL behavior). Cast: \`COUNT(*)::int\`
- Numeric types may return as strings. Use \`::int\` or \`::numeric\` for number output.

## Code Mode Sandbox
No \`setTimeout\`, \`setInterval\`, \`fetch\`, or network access. Use \`pg.core.readQuery()\` for data access.

## Optimizer Behavior
\`pg_analyze_query_indexes\` may show Seq Scan on small tables (<1000 rows) - this is correct optimizer behavior.

## Additional Notes
- \`pg_list_objects\`: Use \`{types: ['table']}\` to filter. Default includes functions (including extensions).
- \`pg_write_query\`: SELECT allowed but returns rows (use pg_read_query for SELECTs).
- \`pg_drop_table\`: Use \`pg_write_query\` with \`DROP TABLE IF EXISTS\` for safety.`;
