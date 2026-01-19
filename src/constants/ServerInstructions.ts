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
- \`pg_jsonb_set\`: \`createMissing=true\` creates full nested paths; initializes NULL columns to \`{}\`
- \`pg_jsonb_normalize\`: \`flatten\` doesn't descend into arrays; \`keys\` returns text (use \`pairs\` for JSON types)
- ⛔ Object-only tools: \`diff/merge/keys/index_suggest/security_scan\` require objects, not arrays

## Stats Tools

- \`timeSeries\`: \`timeColumn\` must be timestamp, \`valueColumn\` numeric. \`interval\` accepts: keywords, PostgreSQL format, or plurals
- \`distribution\`: Returns \`skewness\`, \`kurtosis\` (excess). \`buckets\` must be > 0
- \`sampling\`: Defaults to random/100 rows. \`sampleSize\` takes precedence over \`percentage\`
- \`percentiles\`: Accepts 0-1 or 0-100 (auto-normalized). Empty array → defaults [0.25, 0.5, 0.75]
- ⛔ LIMITATION: \`hypothesis\` returns testStatistic only, NOT p-values
- ⚠️ WARNING: \`sampling\` with \`system\` method unreliable for small tables—use \`bernoulli\` or \`random\`

## Performance Tools

Core: \`explain()\`, \`explainAnalyze()\`, \`indexStats()\`, \`tableStats()\`, \`statStatements()\`, \`locks()\`, \`bloatCheck()\`, \`cacheHitRatio()\`, \`indexRecommendations()\`

Aliases: \`cacheStats\`→\`cacheHitRatio\`, \`queryStats\`→\`statStatements\`, \`activity\`→\`statActivity\`, \`vacuum\`→\`vacuumStats\`

Wrappers: \`blockingQueries()\`→\`locks({showBlocked:true})\`, \`longRunningQueries(seconds?)\` filters by duration

## Monitoring Tools

Core: \`databaseSize()\`, \`tableSizes()\`, \`connectionStats()\`, \`showSettings()\`, \`capacityPlanning()\`

- \`showSettings({setting: 'work_mem'})\`: Accepts \`pattern\`, \`setting\`, or \`name\`. Exact names auto-match; \`%\` for LIKE patterns
- \`capacityPlanning({days: 90})\`: \`days\` = \`projectionDays\`. Growth based on stats since last reset

## Backup Tools

- \`pg_copy_export\`: Use \`query\`/\`sql\` OR \`table\`. Format: \`csv\` (default), \`text\`, \`binary\`
- \`pg_dump_table\`: Returns basic CREATE TABLE only. **PRIMARY KEYS, INDEXES, CONSTRAINTS NOT included**—use \`pg_get_indexes\`/\`pg_get_constraints\`
- \`pg_restore_command\`: Include \`database\` parameter for complete command

## Text Tools

Defaults: \`threshold\`=0.3 (use 0.1-0.2 for partial), \`maxDistance\`=3 (use 5+ for longer strings)

- \`pg_trigram_similarity\` vs \`pg_similarity_search\`: Both use pg_trgm. First filters by threshold; second uses set_limit() with %
- \`pg_fuzzy_match\`: Levenshtein returns distance (lower=better). Soundex/metaphone return phonetic codes (exact match only)
- \`pg_text_normalize\`: Removes accents only (unaccent). Does NOT lowercase/trim

## Schema Tools

- \`pg_list_views\`: Returns \`{views, count, hasMatViews}\`
- \`pg_create_view({orReplace: true})\`: ⛔ OR REPLACE cannot change column names/count—PostgreSQL limitation
- \`pg_list_functions\`: Default limit=500. Use \`schema: 'public'\`, \`limit: 2000\`, or \`exclude: ['postgis']\` to filter
- \`pg_drop_schema({ifExists: true})\`: Returns \`{existed: true/false}\`

## Partitioning Tools

- \`pg_create_partitioned_table\`: \`partitionBy\` case-insensitive. \`primaryKey\`/\`unique\` must include partition key
- \`pg_create_partition\`: Use \`parent\`/\`table\`/\`parentTable\`, bounds via \`{from, to}\`/\`{values}\`/\`{modulus, remainder}\`/\`{isDefault: true}\`
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
