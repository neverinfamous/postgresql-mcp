/**
 * Server instructions for Code Mode usage.
 *
 * These instructions are automatically sent to MCP clients during initialization,
 * eliminating the need for users to manually provide agent instructions.
 *
 * Optimized for LLM consumption using the "Just Work" documentation pattern:
 * - Priority-based hierarchy (critical gotchas first)
 * - Removed redundant alias documentation (already in tool schemas)
 * - Semantic tagging for high-signal guidance
 */
export const SERVER_INSTRUCTIONS = `# postgres-mcp Code Mode

## ⚠️ Critical Gotchas

1. **Transactions**: \`pg.transactions.execute({statements: [{sql: "..."}]})\` auto-commits on success, auto-rollbacks on error. To join existing transaction: \`{transactionId: txId, statements: [...]}\` (no auto-commit, caller controls)
2. **pg_write_query**: ⛔ Throws for SELECT—use \`pg_read_query\` for SELECT statements
3. **pg_upsert/pg_create_table**: \`schema.table\` format auto-parses (e.g., \`'myschema.users'\` → schema: 'myschema', table: 'users')
4. **pg_create_table columns**: \`notNull\`, \`defaultValue\` (string literals auto-quoted; numbers/booleans auto-coerced; \`now()\` → \`CURRENT_TIMESTAMP\`), \`check\`, \`references\` (object or string \`"table(column)"\` syntax)
5. **pg_create_table constraints**: \`constraints\` array only accepts \`{type: 'unique'|'check'}\`. Primary keys: use \`column.primaryKey\` or top-level \`primaryKey: ['col1', 'col2']\`
6. **pg_create_index expression**: Columns can be expressions like \`LOWER(name)\` or \`UPPER(email)\`—auto-detected. ⚠️ Cast syntax (\`::\`) requires raw SQL via \`pg_write_query\`
7. **pg_list_objects type**: Use \`type\` (singular string) or \`types\` (array). Auto-converts: \`{type: 'table'}\` ≡ \`{types: ['table']}\`
8. **pg_object_details**: Accepts: \`name\`, \`objectName\`, \`object\`, or \`table\`. Use \`type\`/\`objectType\` for type hint (supports: table, view, materialized_view, partitioned_table, function, sequence, index)
9. **pg_exists optional WHERE**: \`where\`/\`condition\`/\`filter\` is optional. Without it, checks if table has any rows
10. **pg_describe_table**: Returns columns, foreignKeys, primaryKey—use \`pg_get_indexes\` separately for index details
11. **pg_vector_insert updateExisting**: Uses direct UPDATE (avoids NOT NULL constraint issues vs INSERT mode)
12. **pg_get_indexes without table**: Returns ALL database indexes (potentially large). Use \`table\` param for specific table
13. **pg_upsert/pg_batch_insert RETURNING**: \`returning\` param must be array of column names: \`["id", "name"]\`. ⛔ \`"*"\` wildcard not supported
14. **Small tables**: Optimizer correctly uses Seq Scan for <1000 rows—this is expected behavior

## 🔄 Response Structures

| Tool | Returns | Notes |
|------|---------|-------|
| \`pg_read_query\` | \`{rows, rowCount, fields?}\` | \`fields\` contains column metadata (name, dataTypeID) |
| \`pg_write_query\` | \`{rowsAffected, affectedRows, rows?}\` | \`rows\` only with RETURNING clause. ⛔ Throws for SELECT |
| \`pg_upsert\` | \`{operation, rowsAffected, rowCount, rows?}\` | \`operation: 'insert'|'update'\`. \`rows\` only with RETURNING clause |
| \`pg_batch_insert\` | \`{rowsAffected, affectedRows, insertedCount, rows?}\` | Empty objects use DEFAULT VALUES. ⚠️ BIGINT > 2^53 loses precision |
| \`pg_count\` | \`{count: N}\` | Use \`params\` for placeholders: \`where: 'id=$1', params: [5]\`. DISTINCT: use \`pg_read_query\` |
| \`pg_exists\` | \`{exists: bool, mode, hint?}\` | \`params\` for placeholders. \`mode: 'filtered'|'any_rows'\` |
| \`pg_get_indexes\` | \`{indexes, count, totalCount?}\` | Default \`limit: 100\` without \`table\`. Use \`schema\`/\`limit\` to filter. Index objects have \`name\`, \`type\`, \`columns\` |
| \`pg_list_objects\` | \`{objects, count, totalCount, byType}\` | Use \`limit\` to cap results, \`type\`/\`types\` to filter |
| \`pg_object_details\` | \`{name, schema, type, returnType?, ...}\` | Functions: \`returnType\` alias. Views/Mat. views: \`definition\` |
| \`pg_analyze_db_health\` | \`{cacheHitRatio: {ratio, heap, index, status}}\` | \`ratio\` = primary numeric %. \`bloat\` available |
| \`pg_describe_table\` | \`{columns, indexes, constraints, foreignKeys}\` | Columns include \`notNull\` (alias for \`!nullable\`), \`foreignKey\`. \`constraints\` includes PK, UNIQUE, CHECK, NOT NULL |
| \`pg_analyze_query_indexes\` | \`{plan, issues, recommendations}\` | \`verbosity\`: 'summary' (default) or 'full'. Summary mode returns condensed plan |
| \`pg_list_tables\` | \`{tables, count}\` | Use \`schema\` to filter, \`limit\` to cap results |
| List operations | \`{items, count}\` | Access via \`result.tables\`, \`result.views\`, etc. |
| \`pg_jsonb_agg groupBy\` | \`{groups: [{group_key, items}], count}\` | Empty array \`[]\` when no match |
| \`pg_vector_aggregate\` | \`{average_vector, count}\` or \`{groups: [{group_key, average_vector, count}]}\` | Without/with \`groupBy\` |

## API Mapping

\`pg_group_action\` → \`pg.group.action()\` (group prefixes dropped: \`pg_jsonb_extract\` → \`pg.jsonb.extract()\`)

**Top-Level Core Aliases**: All starter tools available directly: \`pg.readQuery()\`, \`pg.writeQuery()\`, \`pg.listTables()\`, \`pg.describeTable()\`, \`pg.createTable()\`, \`pg.dropTable()\`, \`pg.count()\`, \`pg.exists()\`, \`pg.upsert()\`, \`pg.batchInsert()\`, \`pg.truncate()\`, \`pg.createIndex()\`, \`pg.dropIndex()\`, \`pg.getIndexes()\`, \`pg.listObjects()\`, \`pg.objectDetails()\`, \`pg.analyzeDbHealth()\`, \`pg.analyzeQueryIndexes()\`, \`pg.analyzeWorkloadIndexes()\`

**Positional args work**: \`readQuery("SELECT...")\`, \`exists("users", "id=1")\`, \`createIndex("users", ["email"])\`

**Discovery**: \`pg.help()\` lists all groups. \`pg.core.help()\`, \`pg.jsonb.help()\` for group-specific methods.

## Format Auto-Resolution

- **Schema.Table**: \`'public.users'\` auto-parses to \`{schema: 'public', table: 'users'}\`
- **JSONB Paths**: Both \`'a.b.c'\` (string) and \`['a','b','c']\` (array) work. Use array for literal dots: \`["key.with.dots"]\`
- **Aliases**: Common parameter variations resolve automatically (e.g., \`query\`/\`sql\`, \`table\`/\`tableName\`)

---

## Vector Tools

- \`pg_vector_search\`: Supports \`schema.table\` format (auto-parsed). Returns \`{results: [...], count, metric}\`. Use \`select: ["id", "name"]\` to include identifying columns. Without select, only returns distance. \`filter\` = \`where\`. ⚠️ Vectors read from DB are strings—parse before passing: \`vec.replace(/^\\[|\\]$/g, '').split(',').map(Number)\`
- \`pg_vector_insert\`: Supports \`schema.table\` format (auto-parsed). Use \`updateExisting\` + \`conflictColumn\` + \`conflictValue\` for UPDATE mode. \`additionalColumns\` is applied in both INSERT and UPDATE modes
- \`pg_vector_batch_insert\`: \`vectors\` expects \`[{vector: [...], data?: {...}}]\` objects, not raw arrays
- \`pg_vector_normalize\`: Returns \`{normalized: [...], magnitude: N}\`. Note: \`magnitude\` is the **original** vector length (not 1)
- \`pg_vector_aggregate\`: Supports \`schema.table\` format (auto-parsed). ⛔ Validates column is vector type. Returns \`{average_vector: {preview, dimensions, truncated}, count}\` or \`{groups: [{group_key, average_vector, count}]}\` with groupBy. ⚠️ \`groupBy\` only supports simple column names (not expressions)
- \`pg_vector_dimension_reduce\`: Direct mode returns \`{reduced: [...], originalDimensions, targetDimensions}\`. Table mode returns \`{rows: [{id, original_dimensions, reduced}], processedCount, summarized}\`. Default \`summarize: true\` in table mode returns compact \`{preview, dimensions, truncated}\` format. Use \`summarize: false\` for full vectors
- \`pg_vector_distance\`: Calculate distance between two vectors. \`metric\`: 'l2' (default), 'cosine', 'inner_product'. Returns \`{distance, metric}\`
- \`pg_vector_cluster\`: \`clusters\` = \`k\`. Returns centroids with \`{preview, dimensions, truncated}\` format for large vectors (>10 dims)—use \`pg_vector_distance\` to assign rows
- \`pg_vector_create_index\`: Use \`type\` (or alias \`method\`) with values 'ivfflat' or 'hnsw'. IVFFlat: \`lists\` param. HNSW: \`m\`, \`efConstruction\` params
- \`pg_vector_performance\`: Auto-generates testVector from first row if omitted. Returns \`testVectorSource: 'auto-generated'|'user-provided'\`
- \`pg_vector_validate\`: Returns \`{valid: bool, vectorDimensions}\`. Empty vector \`[]\` returns \`{valid: true, vectorDimensions: 0}\`
- ⛔ \`pg_vector_embed\`: Demo only (hash-based). Use OpenAI/Cohere for production.
- \`pg_hybrid_search\`: Supports \`schema.table\` format (auto-parsed). Combines vector similarity and full-text search with weighted scoring. Code mode alias: \`pg.hybridSearch()\` → \`pg.vector.hybridSearch()\`
- 📝 **Error Handling**: Vector tools return \`{success: false, error: "...", suggestion: "..."}\` for validation/semantic errors (dimension mismatch, non-vector column, table not found). Check \`success\` field before processing results.

## JSONB Tools

- \`pg_jsonb_extract\`: Returns null if path doesn't exist
- \`pg_jsonb_insert\`: Index -1 inserts BEFORE last element; use \`insertAfter: true\` to append
- \`pg_jsonb_set\`: \`createMissing=true\` creates full nested paths; initializes NULL columns to \`{}\`. Empty path (\`''\` or \`[]\`) replaces entire column value
- \`pg_jsonb_agg\`: Supports AS aliases in select: \`["id", "metadata->>'name' AS name"]\`. ⚠️ \`->>\` returns text—use \`->\` to preserve JSON types
- \`pg_jsonb_object\`: Use \`data\`, \`object\`, or \`pairs\` parameter: \`{data: {name: "John", age: 30}}\`. Returns \`{object: {...}}\`
- \`pg_jsonb_normalize\`: \`flatten\` doesn't descend into arrays; \`keys\` returns text (use \`pairs\` for JSON types)
- ⛔ **Object-only tools**: \`diff\`, \`merge\`, \`keys\`, \`indexSuggest\`, \`securityScan\`—require JSONB objects, throw descriptive errors for arrays
- ⛔ **Array-only tools**: \`insert\`—requires JSONB arrays, throws errors for objects
- 📝 \`normalize\` modes: \`pairs\`/\`keys\`/\`flatten\` for objects; \`array\` for arrays

**Top-Level Aliases**: \`pg.jsonbExtract()\`, \`pg.jsonbSet()\`, \`pg.jsonbInsert()\`, \`pg.jsonbDelete()\`, \`pg.jsonbContains()\`, \`pg.jsonbPathQuery()\`, \`pg.jsonbAgg()\`, \`pg.jsonbObject()\`, \`pg.jsonbArray()\`, \`pg.jsonbKeys()\`, \`pg.jsonbStripNulls()\`, \`pg.jsonbTypeof()\`, \`pg.jsonbValidatePath()\`, \`pg.jsonbMerge()\`, \`pg.jsonbNormalize()\`, \`pg.jsonbDiff()\`, \`pg.jsonbIndexSuggest()\`, \`pg.jsonbSecurityScan()\`, \`pg.jsonbStats()\`


## Stats Tools

- All stats tools support \`schema.table\` format (auto-parsed, embedded schema takes priority over explicit \`schema\` param)
- \`timeSeries\`: Both \`timeColumn\` (must be timestamp/date) and \`valueColumn\` (must be numeric) are validated upfront with clear error messages. Aliases: \`time\`→\`timeColumn\`, \`value\`→\`valueColumn\`. \`interval\` accepts: \`second\`, \`minute\`, \`hour\`, \`day\`, \`week\`, \`month\`, \`year\` (keywords, PostgreSQL format, or plurals). Default \`limit: 100\` time buckets. Use \`limit: 0\` for no limit. Returns \`truncated\` and \`totalCount\` indicators when default limit is applied
- \`correlation\`: Use \`column1\`/\`column2\` or aliases \`x\`/\`y\` for column names
- \`distribution\`: Returns \`skewness\`, \`kurtosis\` (excess). \`buckets\` must be > 0
- \`sampling\`: Defaults to \`random\` method with 20 rows (optimized for LLM context). \`sampleSize\` always takes precedence over \`percentage\`. ⚠️ \`percentage\` param only works with \`bernoulli\`/\`system\` methods—ignored for default \`random\` method. Default limit of 100 rows applied to \`bernoulli\`/\`system\` with \`percentage\` to prevent large payloads. Returns \`truncated\` and \`totalSampled\` when TABLESAMPLE returns more rows than limit
- \`percentiles\`: Accepts 0-1 or 0-100 (auto-normalized). ⚠️ Use consistent scale—mixing (e.g., \`[0.1, 50]\`) produces unexpected keys and returns a \`warning\` field explaining the issue. Empty array → defaults [0.25, 0.5, 0.75]
- \`hypothesis\`: Returns nested \`results\` object containing \`pValue\` (two-tailed), \`testStatistic\`, \`interpretation\`, \`sampleMean\`, \`sampleStdDev\`. Access via \`hyp.results.pValue\`. Use \`populationStdDev\` for z-test, otherwise defaults to t-test
- \`regression\`: Use \`xColumn\`/\`yColumn\`, aliases \`x\`/\`y\`, or \`column1\`/\`column2\` (for consistency with correlation). Returns nested \`regression\` object containing \`slope\`, \`intercept\`, \`rSquared\`, \`equation\`, \`avgX\`, \`avgY\`, \`sampleSize\`. Access via \`reg.regression.slope\`
- ⚠️ WARNING: \`sampling\` with \`system\` method unreliable for small tables—use \`bernoulli\` or \`random\`

**Top-Level Aliases**: \`pg.descriptive()\`, \`pg.percentiles()\`, \`pg.correlation()\`, \`pg.regression()\`, \`pg.timeSeries()\`, \`pg.distribution()\`, \`pg.hypothesis()\`, \`pg.sampling()\`

## Performance Tools

Core: \`explain()\`, \`explainAnalyze()\`, \`indexStats()\`, \`tableStats()\`, \`statStatements()\`, \`locks()\`, \`bloatCheck()\`, \`cacheHitRatio()\`, \`indexRecommendations()\`
- \`explain({ sql, format?, params? })\`: Supports \`format: 'text'|'json'|'yaml'|'xml'\`. Default: text. Use \`params: [value]\` for \`$1, $2\` placeholders
- \`explainAnalyze({ sql, format?, params? })\`: Same format/params options as explain
- \`explainBuffers({ sql, params? })\`: Always returns JSON format (includes buffer statistics)
- \`indexRecommendations({ sql?, params? })\`: Pass \`params: [value]\` for parameterized queries (e.g., \`sql: 'SELECT * FROM orders WHERE id = $1', params: [5]\`)
- \`queryPlanCompare({ query1, query2, params1?, params2? })\`: Compare two query plans. Use \`params1\`/\`params2\` for parameterized queries
- \`partitionStrategySuggest({ table })\`: Accepts \`schema.table\` format (auto-parsed) or separate \`table\` + \`schema\` params
- ⚠️ **Data Type Awareness**: Query literals must match column types exactly—\`WHERE sensor_id = 1\` (integer), not \`'sensor_1'\` (string)

Aliases: \`cacheStats\`→\`cacheHitRatio\`, \`queryStats\`→\`statStatements\`, \`activity\`→\`statActivity\`, \`vacuum\`→\`vacuumStats\`

📦 **AI-Optimized Payloads**: Tools return limited results by default to reduce context size:
- \`tableStats({ limit? })\`: Default 50 rows. Returns \`truncated: true\` + \`totalCount\` when limited. Use \`limit: 0\` for all
- \`vacuumStats({ limit? })\`: Default 50 rows. Same truncation indicators. Use \`limit: 0\` for all
- \`unusedIndexes({ limit?, summary? })\`: Default 20 rows. Use \`summary: true\` for aggregated stats by schema
- \`queryPlanStats({ limit?, truncateQuery? })\`: Default 20 rows, queries truncated to 100 chars. Use \`truncateQuery: 0\` for full text

Wrappers: \`blockingQueries()\`→\`locks({showBlocked:true})\`, \`longRunningQueries({ seconds | minDuration }?)\` filters by duration, \`analyzeTable({ table })\` runs ANALYZE (accepts \`schema.table\` format)

**Top-Level Aliases**: \`pg.explain()\`, \`pg.explainAnalyze()\`, \`pg.cacheHitRatio()\`, \`pg.indexStats()\`, \`pg.tableStats()\`, \`pg.indexRecommendations()\`, \`pg.bloatCheck()\`, \`pg.vacuumStats()\`, \`pg.unusedIndexes()\`, \`pg.duplicateIndexes()\`, \`pg.seqScanTables()\`

## Monitoring Tools

Core: \`databaseSize()\`, \`tableSizes()\`, \`connectionStats()\`, \`showSettings()\`, \`capacityPlanning()\`, \`uptime()\`, \`serverVersion()\`, \`recoveryStatus()\`, \`replicationStatus()\`, \`resourceUsageAnalyze()\`, \`alertThresholdSet()\`

- \`databaseSize()\`: Returns \`{bytes: number, size: string}\`. Optional \`database\` param for specific db
- \`tableSizes({ limit?, schema? })\`: Default limit 50. Returns \`{tables: [...], count, truncated?, totalCount?}\`. \`truncated: true\` + \`totalCount\` when limited. Use \`limit: 0\` for all
- \`connectionStats()\`: Returns \`{byDatabaseAndState, totalConnections: number, maxConnections: number}\`
- \`showSettings({ setting?, limit? })\`: Default limit 50 when no pattern. Returns \`{settings: [...], count, truncated?, totalCount?}\`. Accepts \`pattern\`, \`setting\`, or \`name\`. Exact names auto-match; \`%\` for LIKE patterns
- \`capacityPlanning({days: 90})\`: \`days\` = \`projectionDays\`. Returns \`{current, growth, projection, recommendations}\` with numeric fields. ⛔ Negative days rejected
- \`uptime()\`: Returns \`{start_time: string, uptime: {days, hours, minutes, seconds, milliseconds}}\`
- \`serverVersion()\`: Returns \`{full_version: string, version: string, version_num: number}\`
- \`recoveryStatus()\`: Returns \`{in_recovery: boolean, last_replay_timestamp: string|null}\`
- \`replicationStatus()\`: Returns \`{role: 'primary'|'replica', replicas: [...]}\` for primary, or \`{role: 'replica', replay_lag, ...}\` for replica
- \`resourceUsageAnalyze()\`: Returns \`{backgroundWriter, checkpoints, connectionDistribution, bufferUsage, activity, analysis}\` with all counts as numbers
- \`alertThresholdSet({metric?: 'connection_usage'})\`: Returns recommended thresholds. ⛔ Invalid metric throws validation error. Valid metrics: connection_usage, cache_hit_ratio, replication_lag, dead_tuples, long_running_queries, lock_wait_time

📦 **AI-Optimized Payloads**: Tools return limited results by default to reduce context size:
- \`tableSizes({ limit? })\`: Default 50 rows. Returns \`truncated: true\` + \`totalCount\` when limited. Use \`limit: 0\` for all
- \`showSettings({ limit? })\`: Default 50 rows when no pattern specified. Use \`limit: 0\` for all or specify a pattern

Aliases: \`connections\`→\`connectionStats\`, \`settings\`/\`config\`→\`showSettings\`, \`alerts\`/\`thresholds\`→\`alertThresholdSet\`

**Top-Level Aliases**: \`pg.databaseSize()\`, \`pg.tableSizes()\`, \`pg.connectionStats()\`, \`pg.serverVersion()\`, \`pg.uptime()\`, \`pg.showSettings()\`, \`pg.recoveryStatus()\`, \`pg.replicationStatus()\`, \`pg.capacityPlanning()\`, \`pg.resourceUsageAnalyze()\`, \`pg.alertThresholdSet()\`

## Admin Tools

Core: \`vacuum()\`, \`vacuumAnalyze()\`, \`analyze()\`, \`reindex()\`, \`cluster()\`, \`setConfig()\`, \`reloadConf()\`, \`resetStats()\`, \`cancelBackend()\`, \`terminateBackend()\`

- All admin tools support \`schema.table\` format (auto-parsed, embedded schema takes priority over explicit \`schema\` param)
- \`vacuum({ table?, full?, analyze?, verbose? })\`: Without \`table\`, vacuums ALL tables. \`verbose\` output goes to PostgreSQL server logs
- \`reindex({ target, name?, concurrently? })\`: Targets: 'table', 'index', 'schema', 'database'. \`database\` target defaults to current db when \`name\` omitted
- \`cluster()\`: Without args, re-clusters all previously-clustered tables. With args, requires BOTH \`table\` AND \`index\`
- \`setConfig({ name, value, isLocal? })\`: \`isLocal: true\` applies only to current transaction
- \`cancelBackend({ pid })\`: Graceful query cancellation—returns \`{success: false}\` for invalid PID (no error thrown)
- \`terminateBackend({ pid })\`: Forceful connection termination—use with caution

Aliases: \`tableName\`→\`table\`, \`indexName\`→\`index\`, \`param\`/\`setting\`→\`name\`, \`processId\`→\`pid\`

**Top-Level Aliases**: \`pg.vacuum()\`, \`pg.vacuumAnalyze()\`, \`pg.analyze()\`, \`pg.reindex()\`, \`pg.cluster()\`, \`pg.setConfig()\`, \`pg.reloadConf()\`, \`pg.resetStats()\`, \`pg.cancelBackend()\`, \`pg.terminateBackend()\`

## Backup Tools

Core: \`dumpTable()\`, \`dumpSchema()\`, \`copyExport()\`, \`copyImport()\`, \`createBackupPlan()\`, \`restoreCommand()\`, \`physical()\`, \`restoreValidate()\`, \`scheduleOptimize()\`

Response Structures:
- \`dumpTable\`: \`{ddl, type, note, insertStatements?}\` — \`insertStatements\` only with \`includeData: true\` (separate field from \`ddl\`)
- \`copyExport\`: \`{data, rowCount, truncated?, limit?}\` — \`data\` contains CSV/text content. \`truncated: true\` + \`limit\` when rows returned equals applied limit (indicating more rows likely exist)
- \`copyImport\`: \`{command, stdinCommand, notes}\` — Both file and stdin COPY commands
- \`createBackupPlan\`: \`{strategy: {fullBackup, walArchiving}, estimates}\`
- \`restoreCommand\`: \`{command, warnings?, notes}\` — Warnings when \`database\` omitted
- \`restoreValidate\`: \`{validationSteps: [{step, name, command?, commands?, note?}], recommendations}\` — Note: \`note\` field only for pg_dump default type
- \`physical\`: \`{command, notes, requirements}\`
- \`scheduleOptimize\`: \`{analysis, recommendation, commands}\`

📦 **AI-Optimized Payloads**: \`copyExport\` limits results to 500 rows by default to prevent large payloads. Use \`limit: 0\` for all rows, or specify a custom limit.

- \`pg_copy_export\`: Use \`query\`/\`sql\` OR \`table\`. Supports \`schema.table\` format (auto-parsed, takes priority over \`schema\` param). Format: \`csv\` (default), \`text\`. ⛔ \`binary\` not supported via MCP—use \`pg_dump_schema\` for binary exports. Default \`limit: 500\` (use \`0\` for all rows). Optional \`header\` (default: true), \`delimiter\`
- \`pg_dump_table\`: Returns \`ddl\` + \`insertStatements\` when \`includeData: true\`. Supports sequences (\`type: 'sequence'\`), views (\`type: 'view'\`), and partitioned tables (\`type: 'partitioned_table'\` with \`PARTITION BY\` clause). **PRIMARY KEYS, INDEXES, CONSTRAINTS NOT included**—use \`pg_get_indexes\`/\`pg_get_constraints\`. Supports \`schema.table\` format
- \`pg_dump_schema\`: Generates pg_dump command. Optional \`schema\`, \`table\`, \`filename\`
- \`pg_copy_import\`: Generates COPY FROM command. Supports \`schema.table\` format (auto-parsed, takes priority over \`schema\` param). \`columns\` array, \`filePath\`, \`format\`, \`header\`, \`delimiter\`
- \`pg_restore_command\`: Include \`database\` parameter for complete command. Optional \`schemaOnly\`, \`dataOnly\`
- \`pg_create_backup_plan\`: Generates backup strategy with cron schedule. \`frequency\`: 'hourly'|'daily'|'weekly', \`retention\` count
- \`pg_backup_physical\`: Generates pg_basebackup command. \`format\`: 'plain'|'tar', \`checkpoint\`: 'fast'|'spread', \`compress\`: 0-9
- \`pg_restore_validate\`: Generates validation commands. \`backupType\`: 'pg_dump' (default)|'pg_basebackup'
- \`pg_backup_schedule_optimize\`: Analyzes database activity patterns and recommends optimal backup schedule

**Top-Level Aliases**: \`pg.dumpTable()\`, \`pg.dumpSchema()\`, \`pg.copyExport()\`, \`pg.copyImport()\`, \`pg.createBackupPlan()\`, \`pg.restoreCommand()\`, \`pg.restoreValidate()\`, \`pg.physical()\`, \`pg.backupPhysical()\`, \`pg.scheduleOptimize()\`, \`pg.backupScheduleOptimize()\`

## Text Tools

Defaults: \`threshold\`=0.3 (use 0.1-0.2 for partial), \`maxDistance\`=3 (use 5+ for longer strings)

- All text tools support \`schema.table\` format (auto-parsed, embedded schema takes priority over explicit \`schema\` param)
- \`pg_text_search\`: Supports both \`column\` (singular string) and \`columns\` (array). Either is valid—\`column\` auto-converts to array
- \`pg_trigram_similarity\` vs \`pg_similarity_search\`: Both use pg_trgm. First filters by threshold; second uses set_limit() with %
- \`pg_fuzzy_match\`: Levenshtein returns distance (lower=better). Soundex/metaphone return phonetic codes (exact match only). ⛔ Invalid \`method\` values throw error with valid options
- \`pg_text_normalize\`: Removes accents only (unaccent). Does NOT lowercase/trim
- 📍 **Table vs Standalone**: \`normalize\`, \`sentiment\`, \`toVector\`, \`toQuery\`, \`searchConfig\` are standalone (text input only). \`soundex\`, \`metaphone\` are table operations (require \`table\`, \`column\`, \`value\`)—they query database rows, not single strings

**Top-Level Aliases**: \`pg.textSearch()\`, \`pg.textRank()\`, \`pg.textHeadline()\`, \`pg.textNormalize()\`, \`pg.textSentiment()\`, \`pg.textToVector()\`, \`pg.textToQuery()\`, \`pg.textSearchConfig()\`, \`pg.textTrigramSimilarity()\`, \`pg.textFuzzyMatch()\`, \`pg.textLikeSearch()\`, \`pg.textRegexpMatch()\`, \`pg.textCreateFtsIndex()\`


## Schema Tools

Core: \`listSchemas()\`, \`createSchema()\`, \`dropSchema()\`, \`listViews()\`, \`createView()\`, \`dropView()\`, \`listSequences()\`, \`createSequence()\`, \`dropSequence()\`, \`listFunctions()\`, \`listTriggers()\`, \`listConstraints()\`

Response Structures:
- \`listSchemas()\`: \`{schemas: string[], count}\`
- \`listViews({ includeMaterialized?, truncateDefinition?, limit? })\`: \`{views: [{schema, name, type, definition, definitionTruncated?}], count, hasMatViews, truncatedDefinitions?, truncated, note?}\`. Default \`limit: 50\` (use \`0\` for all). Default \`truncateDefinition: 500\` chars (use \`0\` for full definitions). \`truncated\` always included (\`true\`/\`false\`)
- \`listSequences({ schema? })\`: \`{sequences: [{schema, name, owned_by}], count}\`. Note: \`owned_by\` omits \`public.\` prefix for sequences in public schema (e.g., \`users.id\` not \`public.users.id\`)
- \`listFunctions({ schema?, limit?, exclude? })\`: \`{functions: [{schema, name, arguments, returns, language, volatility}], count, limit, note?}\`
- \`listTriggers({ schema?, table? })\`: \`{triggers: [{schema, table_name, name, timing, events, function_name, enabled}], count}\`
- \`listConstraints({ schema?, table?, type? })\`: \`{constraints: [{schema, table_name, name, type, definition}], count}\`. Type codes: \`p\`=primary_key, \`f\`=foreign_key, \`u\`=unique, \`c\`=check
- \`dropSchema/dropView/dropSequence\`: All return \`{existed: true/false}\` to indicate if object existed before drop
- \`createSchema/createSequence\` (with \`ifNotExists\`) and \`createView\` (with \`orReplace\`): Return \`{alreadyExisted: true/false}\` to indicate if object existed before creation

- \`pg_create_view\`: Supports \`schema.name\` format (auto-parsed). Use \`orReplace: true\` for CREATE OR REPLACE. \`checkOption\`: 'cascaded', 'local', 'none'. ⛔ OR REPLACE can add new columns but cannot rename/remove existing ones—PostgreSQL limitation
- \`pg_create_sequence\`: Supports \`schema.name\` format. Parameters: \`start\`, \`increment\`, \`minValue\`, \`maxValue\`, \`cache\`, \`cycle\`, \`ownedBy\`, \`ifNotExists\`
- \`pg_list_functions\`: Default limit=500. Use \`schema: 'public'\`, \`limit: 2000\`, or \`exclude: ['postgis']\` to filter. ⚠️ \`exclude\` filters by **schema name** AND extension-owned functions. Note: Aggressive \`exclude\` may return 0 results if all functions belong to excluded extensions

**Discovery**: \`pg.schema.help()\` returns \`{methods: string[], examples: string[]}\` object with available methods and usage examples


## Partitioning Tools

- \`pg_create_partitioned_table\`: \`partitionBy\` case-insensitive. Supports \`schema.table\` format for \`name\` (auto-parsed). \`primaryKey\` accepts array (e.g., \`['id', 'event_date']\`). ⛔ \`primaryKey\`/\`unique\` must include partition key—throws validation error otherwise
- \`pg_create_partition\`: Use \`parent\`/\`table\`/\`parentTable\`. \`forValues\` is a raw SQL string: \`"FROM ('2024-01-01') TO ('2024-07-01')"\`, \`"IN ('US', 'CA')"\`, \`"WITH (MODULUS 4, REMAINDER 0)"\`. For DEFAULT partition, use \`isDefault: true\`. Supports \`schema.table\` format for \`parent\` (auto-parsed)
- \`pg_attach_partition\`/\`pg_detach_partition\`: Support \`schema.table\` format for \`parent\` and \`partition\` (auto-parsed). For DEFAULT partition, use \`isDefault: true\` or \`forValues: "DEFAULT"\`
- \`pg_list_partitions\`: Default \`limit: 50\` (use \`0\` for all). Returns \`{partitions, count, truncated, totalCount?}\`. Uses \`bounds\` field (consistent with \`pg_partition_info\`)
- \`pg_partition_info\`: Returns \`{tableInfo, partitions, totalSizeBytes}\`. Uses \`bounds\` field
- Both list/info tools support \`schema.table\` format (auto-parsed) and accept \`table\`, \`parent\`, \`parentTable\`, or \`name\` aliases
- 📍 Code Mode: \`pg.partitioning.create()\` = \`createPartition\`, NOT \`createPartitionedTable\`

## pg_partman Tools

- \`pg_partman_create_parent\`: Interval uses PostgreSQL syntax ('1 day', '1 month') NOT keywords ('daily'). \`startPartition\` accepts 'now' shorthand for current date. Required params: \`parentTable\`, \`controlColumn\`/\`control\`, \`interval\`
- \`pg_partman_run_maintenance\`: Without \`parentTable\`, maintains ALL partition sets. Returns \`partial: true\` when some tables are skipped with \`skipped\` array containing reasons
- \`pg_partman_show_config\`: Supports \`schema.table\` or plain table name (auto-prefixes \`public.\`). Returns \`configs\` array with \`orphaned\` flag for each
- \`pg_partman_show_partitions\`/\`check_default\`/\`partition_data\`: \`parentTable\` required. Supports \`schema.table\` format (auto-parsed)
- \`pg_partman_set_retention\`: \`retentionKeepTable: true\` = detach only, \`false\` = DROP. Pass \`retention: null\` to disable retention
- \`pg_partman_undo_partition\`: \`targetTable\` MUST exist before calling. Requires both \`parentTable\` and \`targetTable\`/\`target\`
- \`pg_partman_analyze_partition_health\`: Returns \`{partitionSets: [{issues, warnings, recommendations, partitionCount}], summary: {overallHealth}}\`. \`overallHealth\`: 'healthy'|'warnings'|'issues_found'
- 📝 **Schema Resolution**: All partman tools auto-prefix \`public.\` when no schema specified in \`parentTable\`

## pg_stat_kcache Tools

- \`pg_kcache_query_stats\`: \`orderBy\`: 'total_time', 'cpu_time', 'reads', 'writes'. ⛔ 'calls' NOT valid—use \`minCalls\` param
- \`pg_kcache_top_io\`: \`ioType\`/\`type\`: 'reads', 'writes', 'both' (default)

## citext Tools

Core: \`createExtension()\`, \`convertColumn()\`, \`listColumns()\`, \`analyzeCandidates()\`, \`compare()\`, \`schemaAdvisor()\`

- \`pg_citext_create_extension\`: Enable citext extension (idempotent). Returns \`{success, message, usage}\`
- \`pg_citext_convert_column\`: Supports \`schema.table\` format (auto-parsed). When views depend on column, returns \`{success: false, dependentViews, hint}\`—drop/recreate views manually. \`col\` alias for \`column\`. Returns \`{previousType}\` showing original type
- \`pg_citext_list_columns\`: Returns \`{columns: [{table_schema, table_name, column_name, is_nullable, column_default}], count}\`. Optional \`schema\` filter
- \`pg_citext_analyze_candidates\`: Scans tables for TEXT/VARCHAR columns matching common patterns (email, username, name, etc.). Optional \`schema\`, \`table\`, \`limit\` filters to narrow results. Returns \`{candidates, count, summary, highConfidenceCandidates, mediumConfidenceCandidates, recommendation}\`
- \`pg_citext_compare\`: Test case-insensitive comparison. Returns \`{value1, value2, citextEqual, textEqual, lowerEqual, extensionInstalled}\`
- \`pg_citext_schema_advisor\`: Supports \`schema.table\` format (auto-parsed). Analyzes specific table. Returns \`{table, recommendations: [{column, currentType, previousType?, recommendation, confidence, reason}], summary, nextSteps}\`. \`tableName\` alias for \`table\`. Already-citext columns include \`previousType: "text or varchar (converted)"\`

**Discovery**: \`pg.citext.help()\` returns \`{methods, aliases, examples}\` object

## ltree Tools

Core: \`createExtension()\`, \`query()\`, \`match()\`, \`subpath()\`, \`lca()\`, \`listColumns()\`, \`convertColumn()\`, \`createIndex()\`

- \`pg_ltree_create_extension\`: Enable ltree extension (idempotent). Returns \`{success, message}\`
- \`pg_ltree_query\`: Query hierarchical relationships. Supports \`schema.table\` format (auto-parsed). \`mode\`/\`type\`: 'ancestors', 'descendants' (default), 'exact'. Returns \`{results, count, path, mode, isPattern}\`. ⚠️ Validates column is ltree type—returns clear error for non-ltree columns
- \`pg_ltree_match\`: Match paths using lquery pattern syntax (\`*\`, \`*{1,2}\`, \`*.label.*\`). Supports \`schema.table\` format. \`pattern\`/\`lquery\`/\`query\` aliases. Returns \`{results, count, pattern}\`
- \`pg_ltree_subpath\`: Extract portion of ltree path. \`offset\`/\`start\`/\`from\` and \`length\`/\`len\` aliases. Negative \`offset\` counts from end. ⚠️ Returns \`{success: false, error, pathDepth}\` for invalid offset (validated before PostgreSQL call)
- \`pg_ltree_lca\`: Find longest common ancestor of multiple paths. Requires \`paths\` array (min 2). Returns \`{longestCommonAncestor, hasCommonAncestor: bool, paths}\`
- \`pg_ltree_list_columns\`: List all ltree columns in database. Optional \`schema\` filter. Returns \`{columns: [{table_schema, table_name, column_name, is_nullable, column_default}], count}\`
- \`pg_ltree_convert_column\`: Convert TEXT column to ltree. Supports \`schema.table\` format. \`col\` alias for \`column\`. Returns \`{previousType}\`. ⚠️ When views depend on column, returns \`{success: false, dependentViews, hint}\`—drop/recreate views manually
- \`pg_ltree_create_index\`: Create GiST index on ltree column. Supports \`schema.table\` format. Auto-generates index name if \`indexName\` omitted. Returns \`{indexName, indexType: 'gist', alreadyExists?}\`

**Discovery**: \`pg.ltree.help()\` returns \`{methods, aliases, examples}\` object. Top-level aliases available: \`pg.ltreeQuery()\`, \`pg.ltreeMatch()\`, etc.

## PostGIS Tools

**Geometry Creation:**
- \`pg_geocode\`: Create point geometry from lat/lng. Returns \`{geojson, wkt}\`. ⚠️ Validates bounds: lat ±90°, lng ±180°
- \`pg_geometry_column\`: Add geometry column to table. \`ifNotExists\` returns \`{alreadyExists: true}\`
- \`pg_spatial_index\`: Create GiST spatial index. Auto-generates name if not provided. \`ifNotExists\` supported

**Spatial Queries:**
- \`pg_distance\`: Find geometries within distance from point. Returns \`{results, count}\` with \`distance_meters\`. ⚠️ Validates point bounds
- \`pg_bounding_box\`: Find geometries within lat/lng bounding box. Use \`select\` array for specific columns
- \`pg_intersection\`: Find geometries intersecting a WKT/GeoJSON geometry. Auto-detects SRID from column
- \`pg_point_in_polygon\`: Check if point is within table polygons. Returns \`{containingPolygons, count}\`. ⚠️ Validates point bounds

**Geometry Operations (Table-based):**
- \`pg_buffer\`: Create buffer zone around table geometries. Default limit: 50 rows. Use \`simplify\` (tolerance in meters) to reduce polygon point count for large payloads. Returns \`truncated\`, \`totalCount\` when default limit applies. Use \`limit: 0\` for all rows
- \`pg_geo_transform\`: Transform table geometries between SRIDs. \`fromSrid\`/\`sourceSrid\` and \`toSrid\`/\`targetSrid\` aliases
- \`pg_geo_cluster\`: Spatial clustering (DBSCAN/K-Means). K-Means: If \`numClusters\` exceeds row count, automatically clamps to available rows with \`warning\` field. DBSCAN: Returns contextual \`hints\` array explaining parameter effects (e.g., "All points formed single cluster—decrease eps") and \`parameterGuide\` explaining eps/minPoints trade-offs

**Geometry Operations (Standalone WKT/GeoJSON):**
- \`pg_geometry_buffer\`: Create buffer around WKT/GeoJSON. Returns \`{buffer_geojson, buffer_wkt, distance_meters}\`
- \`pg_geometry_transform\`: Transform WKT/GeoJSON between SRIDs. Returns transformed geometry in both formats
- \`pg_geometry_intersection\`: Compute intersection of two geometries. Returns \`{intersects, intersection_geojson, intersection_area_sqm}\`. Normalizes SRID (4326) automatically—safe to mix GeoJSON and WKT

**Administration:**
- \`pg_postgis_create_extension\`: Enable PostGIS extension (idempotent)
- \`pg_geo_index_optimize\`: Analyze spatial indexes. Without \`table\` param, analyzes all spatial indexes

**Code Mode Aliases:** \`pg.postgis.addColumn()\` → \`geometryColumn\`, \`pg.postgis.indexOptimize()\` → \`geoIndexOptimize\`. Note: \`pg.{group}.help()\` returns \`{methods, aliases, examples}\`

## Cron Tools (pg_cron)

Core: \`createExtension()\`, \`schedule()\`, \`scheduleInDatabase()\`, \`unschedule()\`, \`alterJob()\`, \`listJobs()\`, \`jobRunDetails()\`, \`cleanupHistory()\`

- \`pg_cron_schedule\`: Schedule a cron job. \`schedule\` supports standard cron (\`0 5 * * *\`) or interval (\`30 seconds\`). Use \`name\`/\`jobName\` for identification. \`command\`/\`sql\`/\`query\` aliases supported
- \`pg_cron_schedule_in_database\`: Schedule job in specific database. \`database\`/\`db\` aliases. Optional \`username\`, \`active\` params
- \`pg_cron_unschedule\`: Remove job by \`jobId\` or \`jobName\`. If both provided, \`jobName\` takes precedence (with warning)
- \`pg_cron_alter_job\`: Modify existing job. Can change \`schedule\`, \`command\`, \`database\`, \`username\`, \`active\`. ⛔ Non-existent jobId throws error
- \`pg_cron_list_jobs\`: List all jobs. Optional \`active\` boolean filter. Returns \`hint\` when jobs have no name
- \`pg_cron_job_run_details\`: View execution history. Optional \`jobId\`, \`status\` ('running'|'succeeded'|'failed'), \`limit\` filters. Returns \`summary\` with counts
- \`pg_cron_cleanup_history\`: Delete old run records. \`olderThanDays\`/\`days\` param (default: 7). Optional \`jobId\` to target specific job
- \`pg_cron_create_extension\`: Enable pg_cron extension (idempotent). Requires superuser

**Discovery**: \`pg.cron.help()\` returns \`{methods, aliases, examples}\` object

## pgcrypto Tools

Core: \`createExtension()\`, \`hash()\`, \`hmac()\`, \`encrypt()\`, \`decrypt()\`, \`genRandomUuid()\`, \`genRandomBytes()\`, \`genSalt()\`, \`crypt()\`

- \`pg_pgcrypto_create_extension\`: Enable pgcrypto extension (idempotent). Returns \`{success, message}\`
- \`pg_pgcrypto_hash\`: Hash data using digest algorithms. \`algorithm\`: 'md5', 'sha1', 'sha224', 'sha256', 'sha384', 'sha512'. \`encoding\`: 'hex' (default), 'base64'. Returns \`{hash, algorithm, encoding, inputLength}\`
- \`pg_pgcrypto_hmac\`: HMAC authentication. Same algorithms as hash. Returns \`{hmac, algorithm, encoding}\`. \`key\` param for secret
- \`pg_pgcrypto_encrypt\`: PGP symmetric encryption. \`data\` + \`password\`/\`key\` (aliases). Optional \`options\` for cipher config (e.g., 'cipher-algo=aes256'). Returns \`{encrypted, encoding: 'base64'}\`
- \`pg_pgcrypto_decrypt\`: Decrypt PGP-encrypted data. \`encryptedData\`/\`data\` + \`password\`/\`key\` (aliases). Returns \`{decrypted, verified}\`. ⛔ Throws on wrong key/corrupt data
- \`pg_pgcrypto_gen_random_uuid\`: Generate UUID v4. Optional \`count\` (1-100, default 1). Returns \`{uuid, uuids, count}\` (\`uuid\` convenience property for single requests)
- \`pg_pgcrypto_gen_random_bytes\`: Generate random bytes. \`length\` (1-1024). \`encoding\`: 'hex' (default), 'base64'. Returns \`{randomBytes, length, encoding}\`
- \`pg_pgcrypto_gen_salt\`: Generate salt for crypt(). \`type\`: 'bf' (bcrypt, recommended), 'md5', 'xdes', 'des'. Optional \`iterations\` for bf (4-31) or xdes. Returns \`{salt, type}\`
- \`pg_pgcrypto_crypt\`: Hash password with salt. Use stored hash as salt for verification. Returns \`{hash, algorithm}\`. Verification: \`crypt(password, storedHash).hash === storedHash\`

**Password Workflow**: 1) \`genSalt({type:'bf', iterations:10})\` → 2) \`crypt({password, salt})\` → store hash → 3) Verify: \`crypt({password, salt: storedHash})\` and compare hashes

**Top-Level Aliases**: \`pg.pgcryptoHash()\`, \`pg.pgcryptoEncrypt()\`, \`pg.pgcryptoDecrypt()\`, \`pg.pgcryptoGenRandomUuid()\`, etc.

**Discovery**: \`pg.pgcrypto.help()\` returns \`{methods, aliases, examples}\` object

## Code Mode Sandbox

No \`setTimeout\`, \`setInterval\`, \`fetch\`, or network access. Use \`pg.core.readQuery()\` for data access.`;
