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

1. **Transactions**: Use \`pg.transactions.execute({statements})\` for atomic ops, OR pass \`transactionId\` to individual queries
2. **pg_write_query**: ⛔ Throws for SELECT—use \`pg_read_query\` for SELECT statements
3. **pg_upsert/pg_create_table**: \`schema.table\` format auto-parses (e.g., \`'myschema.users'\` → schema: 'myschema', table: 'users')
4. **pg_create_table columns**: \`notNull\`, \`defaultValue\` (numbers/booleans auto-coerced to string), \`check\`, \`references\` (object or string \`"table(column)"\` syntax)
5. **pg_create_index expression**: Columns can be expressions like \`LOWER(name)\` or \`name::text\`—auto-detected
6. **pg_list_objects type**: Use \`type\` (singular string) or \`types\` (array). Auto-converts: \`{type: 'table'}\` ≡ \`{types: ['table']}\`
7. **pg_object_details**: Accepts: \`name\`, \`objectName\`, \`object\`, or \`table\`. Use \`type\`/\`objectType\` for type hint
8. **pg_exists optional WHERE**: \`where\`/\`condition\`/\`filter\` is optional. Without it, checks if table has any rows
9. **pg_describe_table**: Returns columns, foreignKeys, primaryKey—use \`pg_get_indexes\` separately for index details
10. **pg_vector_insert updateExisting**: Uses direct UPDATE (avoids NOT NULL constraint issues vs INSERT mode)
11. **pg_get_indexes without table**: Returns ALL database indexes (potentially large). Use \`table\` param for specific table
12. **Small tables**: Optimizer correctly uses Seq Scan for <1000 rows—this is expected behavior

## 🔄 Response Structures

| Tool | Returns | Notes |
|------|---------|-------|
| \`pg_read_query\` | \`{rows, rowCount, fields?}\` | \`fields\` contains column metadata (name, dataTypeID) |
| \`pg_write_query\` | \`{rowsAffected, affectedRows, rows?}\` | \`rows\` only with RETURNING clause. ⛔ Throws for SELECT |
| \`pg_upsert\` | \`{operation, rowsAffected, rowCount, rows?}\` | \`operation: 'insert'|'update'\`. \`rows\` only with RETURNING clause |
| \`pg_batch_insert\` | \`{rowsAffected, affectedRows, insertedCount, rows?}\` | Empty objects use DEFAULT VALUES. ⚠️ BIGINT > 2^53 loses precision |
| \`pg_count\` | \`{count: N}\` | Use \`params\` for placeholders: \`where: 'id=$1', params: [5]\`. DISTINCT: use \`pg_read_query\` |
| \`pg_exists\` | \`{exists: bool, mode, hint?}\` | \`params\` for placeholders. \`mode: 'filtered'|'any_rows'\` |
| \`pg_get_indexes\` | \`{indexes, count, totalCount?}\` | Default \`limit: 100\` without \`table\`. Use \`schema\`/\`limit\` to filter |
| \`pg_list_objects\` | \`{objects, count, totalCount, byType}\` | Use \`limit\` to cap results, \`type\`/\`types\` to filter |
| \`pg_object_details\` | \`{name, schema, type, returnType?, ...}\` | Functions: \`returnType\` alias. Views: \`definition\` |
| \`pg_analyze_db_health\` | \`{cacheHitRatio: {ratio, heap, index, status}}\` | \`ratio\` = primary numeric %. \`bloat\` available |
| \`pg_describe_table\` | \`{columns, indexes, constraints, foreignKeys}\` | Columns include \`notNull\` (alias for \`!nullable\`), \`foreignKey\`. \`constraints\` includes PK, UNIQUE, CHECK, NOT NULL |
| \`pg_analyze_query_indexes\` | \`{plan, explainPlan, executionPlan, issues}\` | \`explainPlan\`/\`executionPlan\` = aliases for \`plan\` |
| \`pg_list_tables\` | \`{tables, count}\` | Use \`schema\` to filter, \`limit\` to cap results |
| List operations | \`{items, count}\` | Access via \`result.tables\`, \`result.views\`, etc. |
| \`pg_jsonb_agg groupBy\` | \`{groups: [{group_key, items}], count}\` | Empty array \`[]\` when no match |
| \`pg_vector_aggregate\` | \`{groups: [{group_key, average_vector, count}]}\` | When using \`groupBy\` |

## API Mapping

\`pg_group_action\` → \`pg.group.action()\` (group prefixes dropped: \`pg_jsonb_extract\` → \`pg.jsonb.extract()\`)

**Positional args work**: \`readQuery("SELECT...")\`, \`exists("users", "id=1")\`, \`createIndex("users", ["email"])\`

**Discovery**: \`pg.help()\` lists all groups. \`pg.core.help()\`, \`pg.jsonb.help()\` for group-specific methods.

## Format Auto-Resolution

- **Schema.Table**: \`'public.users'\` auto-parses to \`{schema: 'public', table: 'users'}\`
- **JSONB Paths**: Both \`'a.b.c'\` (string) and \`['a','b','c']\` (array) work. Use array for literal dots: \`["key.with.dots"]\`
- **Aliases**: Common parameter variations resolve automatically (e.g., \`query\`/\`sql\`, \`table\`/\`tableName\`)

---

## Vector Tools

- \`pg_vector_search\`: Use \`select: ["id", "name"]\` to include identifying columns. Without select, only returns distance. \`filter\` = \`where\`
- \`pg_vector_batch_insert\`: \`vectors\` expects \`[{vector: [...], data?: {...}}]\` objects, not raw arrays
- \`pg_vector_cluster\`: \`clusters\` = \`k\`
- \`pg_vector_performance\`: Auto-generates testVector from first row if omitted
- ⛔ \`pg_vector_embed\`: Demo only (hash-based). Use OpenAI/Cohere for production.

## JSONB Tools

- \`pg_jsonb_extract\`: Returns null if path doesn't exist
- \`pg_jsonb_insert\`: Index -1 inserts BEFORE last element; use \`insertAfter: true\` to append
- \`pg_jsonb_set\`: \`createMissing=true\` creates full nested paths; initializes NULL columns to \`{}\`. Empty path (\`''\` or \`[]\`) replaces entire column value
- \`pg_jsonb_agg\`: Supports AS aliases in select: \`["id", "metadata->>'name' AS name"]\`. ⚠️ \`->>\` returns text—use \`->\` to preserve JSON types
- \`pg_jsonb_object\`: Accepts key-value pairs directly: \`{name: "John", age: 30}\`. Returns \`{object: {...}}\`
- \`pg_jsonb_normalize\`: \`flatten\` doesn't descend into arrays; \`keys\` returns text (use \`pairs\` for JSON types)
- ⛔ **Object-only tools**: \`diff\`, \`merge\`, \`keys\`, \`indexSuggest\`, \`securityScan\`—require JSONB objects, throw descriptive errors for arrays
- ⛔ **Array-only tools**: \`insert\`—requires JSONB arrays, throws errors for objects
- 📝 \`normalize\` modes: \`pairs\`/\`keys\`/\`flatten\` for objects; \`array\` for arrays

## Stats Tools

- All stats tools support \`schema.table\` format (auto-parsed, embedded schema takes priority over explicit \`schema\` param)
- \`timeSeries\`: \`timeColumn\` must be timestamp, \`valueColumn\` numeric. \`interval\` accepts: keywords, PostgreSQL format, or plurals
- \`distribution\`: Returns \`skewness\`, \`kurtosis\` (excess). \`buckets\` must be > 0
- \`sampling\`: Defaults to \`random\` method with 100 rows. \`sampleSize\` always takes precedence over \`percentage\`. ⚠️ \`percentage\` param only works with \`bernoulli\`/\`system\` methods—ignored for default \`random\` method
- \`percentiles\`: Accepts 0-1 or 0-100 (auto-normalized). ⚠️ Use consistent scale—mixing (e.g., \`[0.1, 50]\`) produces unexpected keys. Empty array → defaults [0.25, 0.5, 0.75]
- \`hypothesis\`: Returns \`pValue\` (two-tailed), \`testStatistic\`, and \`interpretation\`. Use \`populationStdDev\` for z-test, otherwise defaults to t-test
- ⚠️ WARNING: \`sampling\` with \`system\` method unreliable for small tables—use \`bernoulli\` or \`random\`

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

Wrappers: \`blockingQueries()\`→\`locks({showBlocked:true})\`, \`longRunningQueries({ seconds | minDuration }?)\` filters by duration, \`analyzeTable({ table })\` runs ANALYZE (accepts \`schema.table\` format)

## Monitoring Tools

Core: \`databaseSize()\`, \`tableSizes()\`, \`connectionStats()\`, \`showSettings()\`, \`capacityPlanning()\`, \`uptime()\`, \`serverVersion()\`, \`recoveryStatus()\`, \`replicationStatus()\`, \`resourceUsageAnalyze()\`, \`alertThresholdSet()\`

- \`databaseSize()\`: Returns \`{bytes: number, size: string}\`. Optional \`database\` param for specific db
- \`tableSizes({ limit?, schema? })\`: Returns \`{tables: [{schema, table_name, table_size, indexes_size, total_size, total_bytes}]}\`. All \`total_bytes\` are numbers
- \`connectionStats()\`: Returns \`{byDatabaseAndState, totalConnections: number, maxConnections: number}\`
- \`showSettings({setting: 'work_mem'})\`: Accepts \`pattern\`, \`setting\`, or \`name\`. Exact names auto-match; \`%\` for LIKE patterns
- \`capacityPlanning({days: 90})\`: \`days\` = \`projectionDays\`. Returns \`{current, growth, projection, recommendations}\` with numeric fields. ⛔ Negative days rejected
- \`uptime()\`: Returns \`{start_time: string, uptime: {days, hours, minutes, seconds, milliseconds}}\`
- \`serverVersion()\`: Returns \`{full_version: string, version: string, version_num: number}\`
- \`recoveryStatus()\`: Returns \`{in_recovery: boolean, last_replay_timestamp: string|null}\`
- \`replicationStatus()\`: Returns \`{role: 'primary'|'replica', replicas: [...]}\` for primary, or \`{role: 'replica', replay_lag, ...}\` for replica
- \`resourceUsageAnalyze()\`: Returns \`{backgroundWriter, checkpoints, connectionDistribution, bufferUsage, activity, analysis}\` with all counts as numbers
- \`alertThresholdSet({metric?: 'connection_usage'})\`: Returns recommended thresholds. ⛔ Invalid metric throws validation error. Valid metrics: connection_usage, cache_hit_ratio, replication_lag, dead_tuples, long_running_queries, lock_wait_time

Aliases: \`connections\`→\`connectionStats\`, \`settings\`/\`config\`→\`showSettings\`, \`alerts\`/\`thresholds\`→\`alertThresholdSet\`

## Admin Tools

Core: \`vacuum()\`, \`vacuumAnalyze()\`, \`analyze()\`, \`reindex()\`, \`cluster()\`, \`setConfig()\`, \`reloadConf()\`, \`resetStats()\`, \`cancelBackend()\`, \`terminateBackend()\`

- \`vacuum({ table?, full?, analyze?, verbose? })\`: Without \`table\`, vacuums ALL tables. \`verbose\` output goes to PostgreSQL server logs
- \`reindex({ target, name?, concurrently? })\`: Targets: 'table', 'index', 'schema', 'database'. \`database\` target defaults to current db when \`name\` omitted
- \`cluster()\`: Without args, re-clusters all previously-clustered tables. With args, requires BOTH \`table\` AND \`index\`
- \`setConfig({ name, value, isLocal? })\`: \`isLocal: true\` applies only to current transaction
- \`cancelBackend({ pid })\`: Graceful query cancellation—returns \`{success: false}\` for invalid PID (no error thrown)
- \`terminateBackend({ pid })\`: Forceful connection termination—use with caution

Aliases: \`tableName\`→\`table\`, \`indexName\`→\`index\`, \`param\`/\`setting\`→\`name\`, \`processId\`→\`pid\`

## Backup Tools

Core: \`dumpTable()\`, \`dumpSchema()\`, \`copyExport()\`, \`copyImport()\`, \`createBackupPlan()\`, \`restoreCommand()\`, \`physical()\`, \`restoreValidate()\`, \`scheduleOptimize()\`

Response Structures:
- \`dumpTable\`: \`{ddl, type, note, insertStatements?}\` — \`insertStatements\` only with \`includeData: true\` (separate field from \`ddl\`)
- \`copyExport\`: \`{data, rowCount}\` — \`data\` contains CSV/text content
- \`copyImport\`: \`{command, stdinCommand, notes}\` — Both file and stdin COPY commands
- \`createBackupPlan\`: \`{strategy: {fullBackup, walArchiving}, estimates}\`
- \`restoreCommand\`: \`{command, warnings?, notes}\` — Warnings when \`database\` omitted
- \`physical\`: \`{command, notes, requirements}\`
- \`scheduleOptimize\`: \`{analysis, recommendation, commands}\`

- \`pg_copy_export\`: Use \`query\`/\`sql\` OR \`table\`. Supports \`schema.table\` format (auto-parsed, takes priority over \`schema\` param). Format: \`csv\` (default), \`text\`. ⛔ \`binary\` not supported via MCP—use \`pg_dump_schema\` for binary exports. Use \`limit: N\` to cap rows. Optional \`header\` (default: true), \`delimiter\`
- \`pg_dump_table\`: Returns \`ddl\` (basic CREATE TABLE only) + \`insertStatements\` when \`includeData: true\`. **PRIMARY KEYS, INDEXES, CONSTRAINTS NOT included**—use \`pg_get_indexes\`/\`pg_get_constraints\`. Supports sequences, views, and \`schema.table\` format
- \`pg_dump_schema\`: Generates pg_dump command. Optional \`schema\`, \`table\`, \`filename\`
- \`pg_copy_import\`: Generates COPY FROM command. Supports \`schema.table\` format (auto-parsed, takes priority over \`schema\` param). \`columns\` array, \`filePath\`, \`format\`, \`header\`, \`delimiter\`
- \`pg_restore_command\`: Include \`database\` parameter for complete command. Optional \`schemaOnly\`, \`dataOnly\`
- \`pg_create_backup_plan\`: Generates backup strategy with cron schedule. \`frequency\`: 'hourly'|'daily'|'weekly', \`retention\` count
- \`pg_backup_physical\`: Generates pg_basebackup command. \`format\`: 'plain'|'tar', \`checkpoint\`: 'fast'|'spread', \`compress\`: 0-9
- \`pg_restore_validate\`: Generates validation commands. \`backupType\`: 'pg_dump' (default)|'pg_basebackup'
- \`pg_backup_schedule_optimize\`: Analyzes database activity patterns and recommends optimal backup schedule

## Text Tools

Defaults: \`threshold\`=0.3 (use 0.1-0.2 for partial), \`maxDistance\`=3 (use 5+ for longer strings)

- \`pg_trigram_similarity\` vs \`pg_similarity_search\`: Both use pg_trgm. First filters by threshold; second uses set_limit() with %
- \`pg_fuzzy_match\`: Levenshtein returns distance (lower=better). Soundex/metaphone return phonetic codes (exact match only)
- \`pg_text_normalize\`: Removes accents only (unaccent). Does NOT lowercase/trim

## Schema Tools

Core: \`listSchemas()\`, \`createSchema()\`, \`dropSchema()\`, \`listViews()\`, \`createView()\`, \`dropView()\`, \`listSequences()\`, \`createSequence()\`, \`dropSequence()\`, \`listFunctions()\`, \`listTriggers()\`, \`listConstraints()\`

Response Structures:
- \`listSchemas()\`: \`{schemas: string[], count}\`
- \`listViews({ includeMaterialized? })\`: \`{views: [{schema, name, type, definition}], count, hasMatViews}\`
- \`listSequences({ schema? })\`: \`{sequences: [{schema, name, owned_by}], count}\`. Note: \`owned_by\` omits \`public.\` prefix for sequences in public schema (e.g., \`users.id\` not \`public.users.id\`)
- \`listFunctions({ schema?, limit?, exclude? })\`: \`{functions: [{schema, name, arguments, returns, language, volatility}], count, limit, note?}\`
- \`listTriggers({ schema?, table? })\`: \`{triggers: [{schema, table_name, name, timing, events, function_name, enabled}], count}\`
- \`listConstraints({ schema?, table?, type? })\`: \`{constraints: [{schema, table_name, name, type, definition}], count}\`. Type codes: \`p\`=primary_key, \`f\`=foreign_key, \`u\`=unique, \`c\`=check
- \`dropSchema/dropView/dropSequence\`: All return \`{existed: true/false}\` to indicate if object existed before drop

- \`pg_create_view\`: Supports \`schema.name\` format (auto-parsed). Use \`orReplace: true\` for CREATE OR REPLACE. \`checkOption\`: 'cascaded', 'local', 'none'. ⛔ OR REPLACE can add new columns but cannot rename/remove existing ones—PostgreSQL limitation
- \`pg_create_sequence\`: Supports \`schema.name\` format. Parameters: \`start\`, \`increment\`, \`minValue\`, \`maxValue\`, \`cache\`, \`cycle\`, \`ownedBy\`, \`ifNotExists\`
- \`pg_list_functions\`: Default limit=500. Use \`schema: 'public'\`, \`limit: 2000\`, or \`exclude: ['postgis']\` to filter. ⚠️ \`exclude\` filters by **schema name**, not function name prefix

**Discovery**: \`pg.schema.help()\` returns \`{methods: string[], examples: string[]}\` object with available methods and usage examples


## Partitioning Tools

- \`pg_create_partitioned_table\`: \`partitionBy\` case-insensitive. Supports \`schema.table\` format for \`name\` (auto-parsed). \`primaryKey\` accepts array (e.g., \`['id', 'event_date']\`). ⛔ \`primaryKey\`/\`unique\` must include partition key—throws validation error otherwise
- \`pg_create_partition\`: Use \`parent\`/\`table\`/\`parentTable\`. \`forValues\` is a raw SQL string: \`"FROM ('2024-01-01') TO ('2024-07-01')"\`, \`"IN ('US', 'CA')"\`, \`"WITH (MODULUS 4, REMAINDER 0)"\`. For DEFAULT partition, use \`isDefault: true\`. Supports \`schema.table\` format for \`parent\` (auto-parsed)
- \`pg_attach_partition\`/\`pg_detach_partition\`: Support \`schema.table\` format for \`parent\` and \`partition\` (auto-parsed). For DEFAULT partition, use \`isDefault: true\` or \`forValues: "DEFAULT"\`
- \`pg_list_partitions\`/\`pg_partition_info\`: Support \`schema.table\` format (auto-parsed). Accepts \`table\`, \`parent\`, \`parentTable\`, or \`name\` aliases
- 📍 Code Mode: \`pg.partitioning.create()\` = \`createPartition\`, NOT \`createPartitionedTable\`

## pg_partman Tools

- \`pg_partman_create_parent\`: Interval uses PostgreSQL syntax ('1 day', '1 month') NOT keywords ('daily')
- \`pg_partman_show_partitions\`/\`check_default\`/\`partition_data\`: \`parentTable\` required
- \`pg_partman_undo_partition\`: Target table MUST exist before calling

## pg_stat_kcache Tools

- \`pg_kcache_query_stats\`: \`orderBy\`: 'total_time', 'cpu_time', 'reads', 'writes'. ⛔ 'calls' NOT valid—use \`minCalls\` param
- \`pg_kcache_top_io\`: \`ioType\`/\`type\`: 'reads', 'writes', 'both' (default)

## citext Tools

- \`pg_citext_convert_column\`: When views depend on column, drop/recreate manually—tool will list dependent views

## ltree Tools

- \`pg_ltree_query\`: \`mode\`/\`type\`: 'ancestors', 'descendants' (default), 'exact'. Wildcards auto-detected for lquery
- \`pg_ltree_subpath\`: \`len\` = \`length\`, \`start\`/\`from\` = \`offset\`

## PostGIS Tools

- \`geometryBuffer\`/\`geometryTransform\`: Standalone WKT input
- \`buffer\`/\`transform\`: Table column input

## Code Mode Sandbox

No \`setTimeout\`, \`setInterval\`, \`fetch\`, or network access. Use \`pg.core.readQuery()\` for data access.`;
