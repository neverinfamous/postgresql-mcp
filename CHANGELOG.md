# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **pg.textXxx() top-level aliases** — Code mode now supports top-level text method aliases for convenience: `pg.textSearch()`, `pg.textRank()`, `pg.textHeadline()`, `pg.textNormalize()`, `pg.textSentiment()`, `pg.textToVector()`, `pg.textToQuery()`, `pg.textSearchConfig()`, `pg.textTrigramSimilarity()`, `pg.textFuzzyMatch()`, `pg.textLikeSearch()`, `pg.textRegexpMatch()`, `pg.textCreateFtsIndex()`. These map directly to `pg.text.xxx()` methods, matching the aliases documented in `pg.text.help()`
- **Text tools schema.table format support** — All 13 text tools now support `schema.table` format (auto-parsed, embedded schema takes priority over explicit `schema` parameter). Consistent with other tool groups like stats, vector, partitioning
- **pg.jsonbXxx() top-level aliases** — Code mode now supports top-level JSONB method aliases for convenience: `pg.jsonbExtract()`, `pg.jsonbSet()`, `pg.jsonbInsert()`, `pg.jsonbDelete()`, `pg.jsonbContains()`, `pg.jsonbPathQuery()`, `pg.jsonbAgg()`, `pg.jsonbObject()`, `pg.jsonbArray()`, `pg.jsonbKeys()`, `pg.jsonbStripNulls()`, `pg.jsonbTypeof()`, `pg.jsonbValidatePath()`, `pg.jsonbMerge()`, `pg.jsonbNormalize()`, `pg.jsonbDiff()`, `pg.jsonbIndexSuggest()`, `pg.jsonbSecurityScan()`, `pg.jsonbStats()`. These map directly to `pg.jsonb.xxx()` methods, matching the aliases documented in `pg.jsonb.help()`
- **pg.createIndex() and 7 more top-level core aliases** — Code mode now supports additional top-level aliases beyond the original 11 starter tools: `pg.createIndex()`, `pg.dropIndex()`, `pg.getIndexes()`, `pg.listObjects()`, `pg.objectDetails()`, `pg.analyzeDbHealth()`, `pg.analyzeQueryIndexes()`, `pg.analyzeWorkloadIndexes()`. All 19 starter tools now have top-level aliases for maximum ergonomics
- **pg.explain() and 10 more top-level performance aliases** — Code mode now supports top-level performance method aliases for convenience: `pg.explain()`, `pg.explainAnalyze()`, `pg.cacheHitRatio()`, `pg.indexStats()`, `pg.tableStats()`, `pg.indexRecommendations()`, `pg.bloatCheck()`, `pg.vacuumStats()`, `pg.unusedIndexes()`, `pg.duplicateIndexes()`, `pg.seqScanTables()`. These map directly to `pg.performance.xxx()` methods for improved ergonomics
- **pg.vacuum() and 9 more top-level admin aliases** — Code mode now supports top-level admin method aliases for convenience: `pg.vacuum()`, `pg.vacuumAnalyze()`, `pg.analyze()`, `pg.reindex()`, `pg.cluster()`, `pg.setConfig()`, `pg.reloadConf()`, `pg.resetStats()`, `pg.cancelBackend()`, `pg.terminateBackend()`. These map directly to `pg.admin.xxx()` methods for system maintenance tasks
- **pg.databaseSize() and 10 more top-level monitoring aliases** — Code mode now supports top-level monitoring method aliases for convenience: `pg.databaseSize()`, `pg.tableSizes()`, `pg.connectionStats()`, `pg.serverVersion()`, `pg.uptime()`, `pg.showSettings()`, `pg.recoveryStatus()`, `pg.replicationStatus()`, `pg.capacityPlanning()`, `pg.resourceUsageAnalyze()`, `pg.alertThresholdSet()`. These map directly to `pg.monitoring.xxx()` methods for server monitoring tasks
- **pg.dumpTable() and 10 more top-level backup aliases** — Code mode now supports top-level backup method aliases for convenience: `pg.dumpTable()`, `pg.dumpSchema()`, `pg.copyExport()`, `pg.copyImport()`, `pg.createBackupPlan()`, `pg.restoreCommand()`, `pg.restoreValidate()`, `pg.physical()`, `pg.backupPhysical()`, `pg.scheduleOptimize()`, `pg.backupScheduleOptimize()`. These map directly to `pg.backup.xxx()` methods for backup and recovery tasks
- **Admin tools schema.table format support** — `pg_vacuum`, `pg_vacuum_analyze`, and `pg_analyze` now support `schema.table` format (e.g., `'public.users'` → auto-parsed). Embedded schema takes priority over explicit `schema` parameter, consistent with other tool groups
- **Admin tools tableName alias** — `pg_vacuum`, `pg_vacuum_analyze`, and `pg_analyze` now accept `tableName` as an alias for `table` parameter, with consistent response field inclusion
- **pg_dump_table partitioned table support** — `pg_dump_table` now detects partitioned tables and includes the `PARTITION BY` clause in the DDL output. Returns `type: 'partitioned_table'` instead of `type: 'table'` for partitioned tables. Supports RANGE, LIST, and HASH partitioning strategies with correct partition key columns. Note provides guidance to use `pg_list_partitions` for partition children
- **createSchema/createSequence `alreadyExisted` response field** — `pg_create_schema` and `pg_create_sequence` now return `alreadyExisted: boolean` when `ifNotExists: true` is used, indicating whether the object already existed before the operation. Consistent with `drop` operations which return `existed` field
- **createView `alreadyExisted` response field** — `pg_create_view` now returns `alreadyExisted: boolean` when `orReplace: true` is used, indicating whether the view was replaced or created new. Provides parity with `drop` operations for response consistency
- **pg.descriptive() and 7 more top-level stats aliases** — Code mode now supports top-level stats method aliases for convenience: `pg.descriptive()`, `pg.percentiles()`, `pg.correlation()`, `pg.regression()`, `pg.timeSeries()`, `pg.distribution()`, `pg.hypothesis()`, `pg.sampling()`. These map directly to `pg.stats.xxx()` methods for improved ergonomics, matching the pattern of other tool groups
- **pg.postgisXxx() top-level aliases** — Code mode now supports top-level PostGIS method aliases for convenience: `pg.postgisCreateExtension()`, `pg.postgisGeocode()`, `pg.postgisGeometryColumn()`, `pg.postgisSpatialIndex()`, `pg.postgisDistance()`, `pg.postgisBoundingBox()`, `pg.postgisIntersection()`, `pg.postgisPointInPolygon()`, `pg.postgisBuffer()`, `pg.postgisGeoTransform()`, `pg.postgisGeoCluster()`, `pg.postgisGeometryBuffer()`, `pg.postgisGeometryTransform()`, `pg.postgisGeometryIntersection()`, `pg.postgisGeoIndexOptimize()`. These map directly to `pg.postgis.xxx()` methods, matching the pattern of other tool groups

### Fixed

- **pg_dump_table limit parameter support** — `pg_dump_table` (`dumpTable()`) now respects the `limit` parameter when `includeData: true` is specified. Previously, the `limit` parameter was completely ignored and all rows were returned (up to hardcoded 1000). Now applies a default limit of 500 rows to prevent large payloads. Use `limit: 0` for all rows, or specify a custom limit (e.g., `limit: 50`). This is consistent with `pg_copy_export` payload optimization behavior
- **pg_copy_export truncated flag consistency** — `pg_copy_export` (`copyExport()`) now returns `truncated: true` and `limit: N` whenever any limit (default or explicit) causes truncation, not just when the default limit is applied. This provides consistent feedback to LLMs about whether the result set was limited. Previously, explicit limits (e.g., `limit: 100`) did not include truncation metadata even when the data was actually cut off
- **pg_cluster response consistency** — `pg_cluster` with table+index now returns a `message` field (e.g., `"Clustered users using index idx_users_email"`) for consistency with the no-args version which returns `"Re-clustered all previously-clustered tables"`. Previously, table-specific cluster returned only `{success, table, index}` without a message
- **pg_fuzzy_match invalid method validation** — `pg_fuzzy_match` now throws a descriptive error when an invalid `method` is provided (e.g., `method: "invalid"`). Previously, invalid methods silently defaulted to `levenshtein`, which could be misleading. Error message includes valid options: `levenshtein`, `soundex`, `metaphone`
- **pg_jsonb_object MCP tool call fix** — `pg_jsonb_object` direct MCP tool calls now properly accept key-value pairs via `data`, `object`, or `pairs` parameter (e.g., `{data: {name: "John", age: 30}}`). Previously, passing individual key-value pairs as separate tool parameters returned an empty object `{}` because the MCP protocol doesn't support arbitrary record keys as tool parameters. Code mode continues to work with direct object syntax via the OBJECT_WRAP_MAP normalization
- **Text tools direct MCP tool call fix** — All 13 text tools (`pg_text_search`, `pg_text_rank`, `pg_text_headline`, `pg_text_normalize`, `pg_text_sentiment`, `pg_text_to_vector`, `pg_text_to_query`, `pg_text_search_config`, `pg_trigram_similarity`, `pg_fuzzy_match`, `pg_like_search`, `pg_regexp_match`, `pg_create_fts_index`) now work correctly when called directly via MCP protocol. Previously, `z.preprocess()` in the input schemas interfered with JSON Schema generation, causing "Invalid input: expected string, received undefined" errors. Uses the "Split Schema" pattern: base schema for MCP visibility, full schema with preprocess for handler parsing
- **Performance EXPLAIN tools direct MCP tool call fix** — `pg_explain`, `pg_explain_analyze`, and `pg_explain_buffers` now work correctly when called directly via MCP protocol. Previously, the `sql` parameter was marked as optional in the schema (to support `query` alias) which prevented MCP clients from prompting for the required parameter. Uses the "Split Schema" pattern: base schema with required `sql` for MCP visibility, full schema with preprocess for alias handling
- **pg_query_plan_compare direct MCP tool call fix** — `pg_query_plan_compare` now works correctly when called directly via MCP protocol. Previously, `query1` and `query2` parameters were hidden by `z.preprocess()`. Uses the "Split Schema" pattern for proper parameter visibility
- **pg_partition_strategy_suggest direct MCP tool call fix** — `pg_partition_strategy_suggest` now works correctly when called directly via MCP protocol. Previously, `table` parameter was hidden by `z.preprocess()`. Uses the "Split Schema" pattern for proper parameter visibility
- **Schema tools direct MCP tool call fix** — `pg_create_view`, `pg_drop_view`, `pg_create_sequence`, and `pg_drop_sequence` now work correctly when called directly via MCP protocol. Previously, these tools had no input parameters exposed in the MCP schema, making them unusable via Direct Tool Calls (only Code Mode worked). Uses the "Split Schema" pattern: base schema (`CreateViewSchemaBase`, etc.) for MCP input schema visibility, full preprocess schema for handler parsing
- **pg_list_functions direct MCP tool call fix** — `pg_list_functions` now correctly respects `schema`, `limit`, `exclude`, and `language` parameters when called directly via MCP protocol. Previously, these parameters were ignored and the tool always returned 500 functions from all schemas regardless of filters specified. Uses the "Split Schema" pattern: base schema (`ListFunctionsSchemaBase`) for MCP input schema visibility, full preprocess schema for handler parsing
- **Partitioning write tools direct MCP tool call fix** — `pg_create_partitioned_table`, `pg_create_partition`, `pg_attach_partition`, and `pg_detach_partition` now work correctly when called directly via MCP protocol. Previously, these tools had no input parameters exposed in the MCP schema, making them unusable via Direct Tool Calls (only Code Mode worked). Uses the "Split Schema" pattern: base schema (`CreatePartitionedTableSchemaBase`, `CreatePartitionSchemaBase`, `AttachPartitionSchemaBase`, `DetachPartitionSchemaBase`) for MCP input schema visibility, full preprocess schema for handler parsing with alias support
- **Stats tools direct MCP tool call fix** — All 8 stats tools (`pg_stats_descriptive`, `pg_stats_percentiles`, `pg_stats_correlation`, `pg_stats_regression`, `pg_stats_time_series`, `pg_stats_distribution`, `pg_stats_hypothesis`, `pg_stats_sampling`) now work correctly when called directly via MCP protocol. Previously, `z.preprocess()` in the input schemas interfered with JSON Schema generation, causing parameters to be hidden from MCP clients. Uses the "Split Schema" pattern: base schema for MCP visibility, full schema with preprocess for handler parsing with alias support
- **pg_stats_time_series limit:0 fix** — `pg_stats_time_series` now correctly returns all time buckets when `limit: 0` is specified. Previously, `limit: 0` was treated as "no explicit limit" and the default limit of 100 was applied
- **pg_stats_time_series truncation indicators** — `pg_stats_time_series` now returns `truncated: boolean` and `totalCount: number` in the response when the default limit (100) is applied. Helps LLMs understand when time series data has been limited and how much data is available
- **Vector tools direct MCP tool call fix** — `pg_vector_search`, `pg_vector_add_column`, and `pg_vector_create_index` now work correctly when called directly via MCP protocol. Previously, these tools had no input parameters exposed in the MCP schema (caused by using transformed schemas that hide parameters), making them unusable via Direct Tool Calls (only Code Mode worked). Uses the "Split Schema" pattern: base schema for MCP input schema visibility, transformed schema for handler parsing with alias support
- **pg_intersection GeoJSON object support** — `pg_intersection` now accepts GeoJSON objects in addition to WKT/GeoJSON strings in Code Mode (e.g., `pg.postgis.intersection({ table: 't', column: 'geom', geometry: { type: 'Polygon', coordinates: [...] } })`). Previously, passing a GeoJSON object failed with "expected string, received Object". The fix adds automatic JSON.stringify() conversion for object inputs while maintaining string passthrough for WKT/GeoJSON strings

### Performance

- **pg_table_stats default limit** — `pg_table_stats` now applies a default limit of 50 rows when no `limit` parameter is specified. Returns `truncated: true` + `totalCount` metadata when results are limited. Use `limit: 0` for all tables. Prevents large payloads in databases with many tables
- **pg_vacuum_stats default limit** — `pg_vacuum_stats` now applies a default limit of 50 rows when no `limit` parameter is specified. Same truncation indicators as `pg_table_stats`. Use `limit: 0` for all tables
- **pg_unused_indexes default limit** — `pg_unused_indexes` now applies a default limit of 20 rows when no `limit` parameter is specified. Returns `truncated: true` + `totalCount` when limited. Use `limit: 0` for all indexes
- **pg_unused_indexes summary mode** — `pg_unused_indexes({ summary: true })` returns aggregated statistics by schema (`{bySchema: [{schema, unusedCount, totalSize, totalSizeBytes}], totalCount, totalSizeBytes}`) instead of individual indexes, providing a compact overview for large databases
- **pg_query_plan_stats query truncation** — `pg_query_plan_stats` now truncates query text to 100 characters by default, significantly reducing payload size. Each row includes `queryTruncated: boolean` indicator. Use `truncateQuery: 0` for full query text
- **pg_trigram_similarity default limit** — `pg_trigram_similarity` now applies a default limit of 100 rows when no `limit` parameter is specified. Prevents large response payloads when searching across many rows. Use `limit: 500` or higher to see more results
- **pg_fuzzy_match default limit** — `pg_fuzzy_match` now applies a default limit of 100 rows when no `limit` parameter is specified. Consistent with `pg_trigram_similarity` and other list-returning tools
- **pg_get_indexes payload reduction** — Removed redundant `indexName` (duplicate of `name`) and `indexType` (duplicate of `type`) fields from `pg_get_indexes` response. Index objects now return only `{name, tableName, schemaName, columns, unique, type, sizeBytes?, numberOfScans?, ...}`, reducing payload size by ~15%
- **pg_describe_table indexes payload reduction** — Same redundant field removal applied to the `indexes` array in `pg_describe_table` response
- **pg_list_tables default limit** — `pg_list_tables` now applies a default limit of 100 rows when no `limit` parameter is specified. Returns `{truncated: true, totalCount, hint}` metadata when results are truncated. Prevents UI slowdowns in AntiGravity and other MCP clients when databases have many tables. Use `limit: 500` to see more, or `schema` filter to narrow scope
- **pg_list_objects default limit** — `pg_list_objects` now applies a default limit of 100 objects when no `limit` parameter is specified. Same truncation metadata as `pg_list_tables`. Prevents massive JSON response payloads (300KB+ in databases with accumulated test tables)
- **pg_table_sizes default limit** — `pg_table_sizes` now applies a default limit of 50 rows when no `limit` parameter is specified. Returns `truncated: true` + `totalCount` metadata when results are limited. Use `limit: 0` for all tables. Prevents large payloads in databases with many tables
- **pg_show_settings default limit** — `pg_show_settings` now applies a default limit of 50 rows when no filter pattern is specified. Returns `truncated: true` + `totalCount` when limited. Use `limit: 0` for all settings or specify a pattern/setting to override. Previously returned all 415+ settings, consuming excessive context
- **pg_analyze_query_indexes reduced payload** — Removed redundant `explainPlan` and `executionPlan` aliases from response (these were duplicates of `plan`). Response now returns only `{plan, issues, recommendations, executionTime, planningTime}`, reducing payload size by ~66% for complex query plans
- **pg_analyze_db_health reduced payload** — Removed redundant `connectionStats` alias from response (was duplicate of `connections`). Response now uses only `connections` field for connection statistics
- **pg_analyze_query_indexes verbosity parameter** — Added `verbosity` parameter to `pg_analyze_query_indexes` with options `'summary'` (default) or `'full'`. Summary mode returns a condensed plan with only essential metrics (`Node Type`, `Actual Rows`, `Actual Total Time`, relation/index names, filters), reducing payload size significantly for routine query analysis. Full mode returns the complete EXPLAIN ANALYZE output
- **pg_list_tables payload reduction** — Removed redundant `data` field from `pg_list_tables` response (was duplicate of `tables`). Response now returns only `{tables, count, totalCount, truncated?, hint?}`, reducing payload size
- **pg_copy_export default limit** — `pg_copy_export` now applies a default limit of 500 rows when no `limit` parameter is specified. Returns `{truncated: true, limit: 500}` metadata when default limit is applied. Use `limit: 0` for all rows. Prevents accidentally large data exports consuming excessive context
- **pg_list_views definition truncation** — `pg_list_views` now truncates view definitions to 500 characters by default (reduced from 1000), further reducing payload size for databases with complex system views (e.g., PostGIS). Returns `{definitionTruncated: true}` per view and `{truncatedDefinitions: N}` in response. Use `truncateDefinition: 0` for full definitions
- **pg_list_views default limit** — `pg_list_views` now applies a default limit of 50 views when no `limit` parameter is specified. Returns `{truncated: true, note}` metadata when results are limited. Use `limit: 0` for all views. Prevents large payloads in databases with many system and extension views
- **pg_list_views truncated field consistency** — `pg_list_views` now always includes the `truncated` field in the response (set to `true` or `false`) for consistent response structure. Previously, the field was only included when `truncated: true`, which required callers to check for field existence
- **pg_list_partitions default limit** — `pg_list_partitions` now applies a default limit of 50 partitions when no `limit` parameter is specified. Returns `{truncated: true, totalCount}` metadata when results are limited. Use `limit: 0` for all partitions. Prevents large payloads for heavily-partitioned tables
- **pg_list_partitions bounds field consistency** — `pg_list_partitions` now uses the `bounds` field name instead of `partition_bounds`, consistent with `pg_partition_info`. Provides uniform field naming across partitioning tools
- **pg_list_partitions truncated field** — `pg_list_partitions` now always includes the `truncated` field in the response (set to `true` or `false`) for consistent response structure, matching the pattern used by other list tools
- **pg_stats_sampling default limit** — `pg_stats_sampling` now applies a default limit of 20 rows when no `sampleSize` parameter is specified (reduced from 100). Optimized for LLM context usage. Use `sampleSize: 100` or higher for larger samples
- **pg_stats_sampling system method hint** — `pg_stats_sampling` with `method: 'system'` now includes an inline hint in the response: "Consider using 'bernoulli' or 'random' method for more reliable results on small tables." Helps users understand why 0 rows may be returned
- **pg_stats_sampling percentage limit** — `pg_stats_sampling` with `bernoulli` or `system` methods using `percentage` parameter now applies a default limit of 100 rows to prevent large payloads. Returns `truncated: boolean` and `totalSampled: number` when TABLESAMPLE returns more rows than the limit. Use explicit `sampleSize` to override
- **pg_vector_embed embedding summarization** — `pg_vector_embed` now returns embeddings in the compact `{preview, dimensions, truncated}` format by default, reducing payload size from ~6KB to a concise preview for 384-dimension embeddings. Shows first 5 and last 5 values of the normalized vector. Use `summarize: false` parameter to get the raw full embedding array when needed for insertion into vector columns
- **pg_vector_performance benchmark payload reduction** — `pg_vector_performance` benchmark output now truncates large vectors in EXPLAIN ANALYZE query plans. Previously, 384-dimension vectors were included verbatim in the `Sort Key` line (~3KB per benchmark). Now displays `[...384 dims]` placeholder, reducing payload by ~85% for high-dimensional embeddings
- **pg_vector_dimension_reduce table mode summarization** — `pg_vector_dimension_reduce` in table mode now returns reduced vectors in the compact `{preview, dimensions, truncated}` format by default, significantly reducing payload size. For example, 5 rows with 32-dim reduced vectors now return ~500 bytes instead of ~2KB. Use `summarize: false` to get full reduced vectors when needed for downstream processing
- **pg_geo_index_optimize tableStats filtering** — `pg_geo_index_optimize` without a `table` parameter now returns `tableStats` only for tables with geometry/geography columns, instead of all tables in the schema. Prevents unnecessarily large payloads in databases with many non-spatial tables
- **PostGIS tools raw WKB removal** — `pg_distance`, `pg_buffer`, `pg_point_in_polygon`, `pg_intersection`, `pg_bounding_box`, and `pg_geo_transform` no longer return the raw WKB hex string for geometry columns. Responses now include only readable `geometry_text` (WKT format) plus computed fields (`distance_meters`, `buffer_geojson`, `transformed_geojson`, `transformed_wkt`). Reduces payload size by ~50% for tables with geometry columns

### Added

- **pg_drop_table existed property** — `pg_drop_table` now returns `existed: boolean` in response, indicating whether the table existed before the drop operation. Consistent with `dropSchema()`, `dropView()`, and `dropSequence()` behavior
- **pg_object_details materialized_view/partitioned_table support** — `pg_object_details` `type`/`objectType` parameter now accepts `materialized_view` and `partitioned_table` in addition to `table`, `view`, `function`, `sequence`, and `index`. Materialized views now return their `definition` SQL like regular views
- **pg_create_table now() auto-conversion** — `defaultValue: 'now()'` is now automatically converted to `CURRENT_TIMESTAMP` to prevent PostgreSQL "cannot use column reference in DEFAULT expression" error. Also converts `current_date()`, `current_time()`, and `current_timestamp()` to their SQL keyword equivalents
- **pg_create_table string literal auto-quoting** — `defaultValue` parameter now auto-quotes plain string literals (e.g., `defaultValue: 'active'` → `DEFAULT 'active'`). Detects SQL expressions (functions, keywords, casts, numerics) and only quotes literal text values. Internal single quotes are escaped automatically (e.g., `"it's working"` → `'it''s working'`)

- **pg.readQuery() and 10 other top-level core aliases** — Code mode now supports top-level aliases for the most common starter tools: `pg.readQuery()`, `pg.writeQuery()`, `pg.listTables()`, `pg.describeTable()`, `pg.createTable()`, `pg.dropTable()`, `pg.count()`, `pg.exists()`, `pg.upsert()`, `pg.batchInsert()`, `pg.truncate()`. These map directly to `pg.core.*` methods for improved ergonomics
- **pg_upsert/pg_batch_insert RETURNING documentation** — Added critical gotcha #13 documenting that `returning` parameter must be an array of column names (e.g., `["id", "name"]`) and does not support `"*"` wildcard
- **pg_create_table constraints documentation** — Added critical gotcha #5 documenting that `constraints` array only accepts `{type: 'unique'|'check'}`. Primary keys must use `column.primaryKey` property or top-level `primaryKey: ['col1', 'col2']` array
- **pg.transactions.execute response structure documentation** — Updated critical gotcha #1 to document actual response structure: `{success, statementsExecuted, results}` with automatic rollback on error

- **pg_citext_analyze_candidates filter parameters** — `pg_citext_analyze_candidates` now accepts optional `table` and `limit` parameters to narrow results. Useful for large databases where scanning all tables produces too many candidates. Response now includes applied filters in output
- **pg_citext_schema_advisor previousType field** — `pg_citext_schema_advisor` recommendations for already-citext columns now include `previousType: "text or varchar (converted)"` field, providing clearer indication that the column was converted from a text-based type

- **pg_batch_insert insertedCount alias** — Response now includes `insertedCount` as a semantic alias for batch insert operations (alongside `rowsAffected` and `affectedRows`)
- **Parameter binding for performance tools** — `indexRecommendations()`, `explain()`, `explainAnalyze()`, and `explainBuffers()` now accept `params` array for parameterized query support (e.g., `sql: 'SELECT * FROM orders WHERE id = $1', params: [5]`)
- **queryPlanCompare parameter support** — `queryPlanCompare()` now accepts `params1` and `params2` arrays for comparing parameterized queries
- **Monitoring tools documentation** — Added documentation for `uptime()`, `serverVersion()`, `recoveryStatus()`, and `replicationStatus()` with correct output key names in ServerInstructions.ts
- **copyExport limit parameter** — `copyExport()` now supports `limit: N` parameter to cap the number of exported rows (works with both `table` and `query` modes)
- **Comprehensive Backup tools documentation** — Enhanced ServerInstructions.ts with complete documentation for all 9 backup tools including parameters, usage notes, binary format limitation for `copyExport`, and response structures (`dumpTable`, `copyExport`, `copyImport`, `createBackupPlan`, `restoreCommand`, `physical`, `scheduleOptimize`). Documents that `dumpTable({ includeData: true })` returns INSERT statements in a separate `insertStatements` field
- **scheduleOptimize changeVelocity numeric field** — `scheduleOptimize()` now returns both `changeVelocity` (number) and `changeVelocityRatio` (formatted string with %) for type consistency with other tools
- **createView schema.name format support** — `createView()` now supports `schema.name` format (e.g., `'myschema.myview'`) with auto-parsing, consistent with other tools like `createTable` and `upsert`
- **createView checkOption validation** — `createView()` now validates `checkOption` with enum: `'cascaded'`, `'local'`, `'none'`. Invalid values are rejected with a descriptive Zod error instead of being silently passed to PostgreSQL
- **Comprehensive Schema tools documentation** — Enhanced ServerInstructions.ts with complete documentation for all 12 schema tools including response structures (`listSchemas`, `listViews`, `listSequences`, `listFunctions`, `listTriggers`, `listConstraints`), parameters, and constraint type codes. Includes clarifications: `listFunctions({ exclude })` filters by **schema name** not function name prefix; `listSequences` `owned_by` omits `public.` prefix for sequences in public schema; `createView` OR REPLACE can add columns but cannot rename/remove existing ones
- **dropView/dropSequence `existed` field** — `dropView()` and `dropSequence()` now return `existed: boolean` field for consistency with `dropSchema()`, indicating whether the object existed before the drop operation
- **Schema tools discovery documentation** — Added note that `pg.schema.help()` returns `{methods: string[], examples: string[]}` object with available methods and usage examples
- **createView `orReplace` parameter documentation** — Clarified that the parameter name is `orReplace: true` (not `replace`) for CREATE OR REPLACE functionality in `createView()`
- **Partitioning tools documentation** — Updated ServerInstructions.ts to clarify: `forValues` requires raw SQL string format (e.g., `"FROM ('2024-01-01') TO ('2024-07-01')"`), `isDefault: true` is a separate boolean param for DEFAULT partitions, and `createPartitionedTable` does NOT support `schema.table` format (requires separate `schema` param)
- **listPartitions/partitionInfo schema.table support** — `pg_list_partitions` and `pg_partition_info` now support `schema.table` format (auto-parsed) and accept `table`, `parent`, `parentTable`, or `name` aliases for ergonomic consistency with other partitioning tools
- **attachPartition/detachPartition schema.table support** — `pg_attach_partition` and `pg_detach_partition` now support `schema.table` format for `parent` and `partition` parameters (auto-parsed). Explicit `schema` parameter also now works correctly
- **createPartition schema.table support** — `pg_create_partition` now supports `schema.table` format for `parent` parameter (auto-parsed)
- **createPartitionedTable schema.table support** — `pg_create_partitioned_table` now supports `schema.table` format for `name` parameter (e.g., `'myschema.events'` → schema='myschema', name='events'). Auto-parsed, eliminating the need for separate `schema` parameter
- **createPartitionedTable table-level primaryKey** — `pg_create_partitioned_table` now supports `primaryKey: ['col1', 'col2']` array for composite primary keys, matching the behavior of `pg_create_table`
- **createPartitionedTable primaryKey validation** — `pg_create_partitioned_table` now validates that `primaryKey` array includes the partition key column. Throws a descriptive error if validation fails (e.g., "Primary key must include partition key column 'event_date'") instead of silently skipping the primary key constraint
- **Stats tools schema.table support** — All 8 stats tools (`descriptive`, `percentiles`, `correlation`, `regression`, `timeSeries`, `distribution`, `hypothesis`, `sampling`) now support `schema.table` format for the `table` parameter (auto-parsed, embedded schema takes priority over explicit `schema` param). Consistent with other tool groups
- **Enhanced Stats tools documentation** — Updated ServerInstructions.ts to clarify `sampling` behavior: `percentage` param only works with `bernoulli`/`system` methods and is ignored for default `random` method
- **Hypothesis test p-value calculation** — `pg_stats_hypothesis` now returns actual two-tailed `pValue` calculated using numerical approximation (t-distribution CDF for t-tests, normal CDF for z-tests). Interpretation now based on p-value thresholds (p<0.001 highly significant, p<0.01 very significant, p<0.05 significant, p<0.1 marginal, p≥0.1 not significant). Previously only returned test statistic without p-value
- **Percentiles scale consistency documentation** — Updated ServerInstructions.ts to clarify that `percentiles()` parameter values should use a consistent scale (all 0-1 OR all 0-100). Mixing scales (e.g., `[0.1, 50]`) produces unexpected key names due to the auto-normalization logic
- **timeSeries second-level granularity** — `pg_stats_time_series` now supports `second` as an interval option for sub-minute time series analysis. Valid intervals: `second`, `minute`, `hour`, `day`, `week`, `month`, `year`
- **timeSeries time/value aliases** — `pg_stats_time_series` now accepts `time` as alias for `timeColumn` and `value` as alias for `valueColumn` for ergonomic consistency
- **correlation x/y aliases** — `pg_stats_correlation` now accepts `x`/`y` as aliases for `column1`/`column2`, matching `pg_stats_regression` for API consistency
- **timeSeries valueColumn upfront validation** — `pg_stats_time_series` now validates `valueColumn` exists and is numeric upfront, matching the validation behavior for `timeColumn`. Provides clear error messages (e.g., "Column not found", "Column is not a numeric type") instead of raw PostgreSQL errors
- **percentiles mixed scale warning** — `pg_stats_percentiles` now returns a `warning` field when mixed percentile scales are detected (e.g., `[0.1, 50]` where some values appear to be 0-1 format and others 0-100 format). Helps users understand unexpected key names like p0 instead of p10
- **hypothesis() and regression() response structure documentation** — Clarified in ServerInstructions.ts that `hypothesis()` returns results in a nested `results` object (access via `hyp.results.pValue`) and `regression()` returns results in a nested `regression` object (access via `reg.regression.slope`). Prevents confusion when accessing response fields
- **regression column1/column2 aliases** — `pg_stats_regression` now accepts `column1`/`column2` as aliases for `xColumn`/`yColumn`, matching the API of `pg_stats_correlation` for consistency. Users can now use the same parameter names across both tools
- **Vector tools documentation improvements** — Enhanced ServerInstructions.ts vector tools section:
  - `pg_vector_search` now documents return structure: `{results: [...], count, metric}` (not `rows`). Added note about parsing vector strings from DB
  - `pg_vector_insert` now documents `schema.table` format support and `updateExisting` mode usage
  - `pg_vector_normalize` documents accurate response: `{normalized: [...], magnitude: N}` where `magnitude` is the **original** vector length (not 1)
  - `pg_vector_aggregate` documents both ungrouped and grouped response structures, clarifying that `average_vector` is wrapped in a preview object for large vectors
  - `pg_vector_dimension_reduce` now documented with return structure for both direct vector mode and table mode
  - `pg_vector_create_index` documents `type` parameter with `method` alias, plus IVFFlat/HNSW-specific parameters
  - `pg_vector_performance` documents `testVectorSource` return field
  - `pg_vector_validate` documents empty vector behavior: `[]` returns `{valid: true, vectorDimensions: 0}`
- **pg_vector_insert schema.table format support** — `pg_vector_insert` now supports `schema.table` format (e.g., `'myschema.embeddings'` → auto-parsed). Embedded schema takes priority over explicit `schema` parameter
- **pg_vector_batch_insert schema.table format support** — `pg_vector_batch_insert` now supports `schema.table` format for consistency with `pg_vector_insert`
- **pg_vector_create_index method alias** — `pg_vector_create_index` now accepts `method` as an alias for `type` parameter (e.g., `method: 'hnsw'` or `type: 'ivfflat'`)
- **pg_hybrid_search schema.table support** — `pg_hybrid_search` now supports `schema.table` format (e.g., `'myschema.embeddings'` → auto-parsed). Embedded schema takes priority over explicit `schema` parameter, consistent with other vector tools
- **pg_vector_aggregate schema.table support and column type validation** — `pg_vector_aggregate` now supports `schema.table` format (auto-parsed) and validates that the specified column is actually a vector type. Returns clear error `{success: false, error: "Column 'x' is not a vector column (type: ...)", suggestion: "..."}` for non-vector columns instead of computing meaningless averages
- **Vector tools error handling documentation** — Enhanced ServerInstructions.ts to document that vector tools return `{success: false, error: "...", suggestion: "..."}` objects for validation/semantic errors (dimension mismatch, non-vector column, table not found). Users should check the `success` field before processing results
- **pg_vector_distance documentation** — Added documentation for `pg_vector_distance` tool in ServerInstructions.ts. Documents `metric` parameter ('l2', 'cosine', 'inner_product') and return structure `{distance, metric}`
- **pg_vector_aggregate groupBy limitation documentation** — Added note that `groupBy` parameter only supports simple column names (not expressions) due to SQL injection safety measures
- **pg_vector_search schema.table support** — `pg_vector_search` now supports `schema.table` format (e.g., `'myschema.embeddings'` → auto-parsed). Embedded schema takes priority over explicit `schema` parameter, consistent with other vector tools (`pg_vector_insert`, `pg_vector_aggregate`, `pg_hybrid_search`)
- **pg.hybridSearch top-level alias** — Code mode now supports `pg.hybridSearch()` as a top-level alias for `pg.vector.hybridSearch()`, providing more intuitive access to hybrid search functionality
- **pg_vector_cluster centroid preview format** — `pg_vector_cluster` now returns centroids in the compact `{preview, dimensions, truncated}` format for large vectors (>10 dimensions), consistent with `pg_vector_aggregate`. Reduces output from ~15KB to a compact preview for 384-dim embeddings
- **Comprehensive PostGIS tools documentation** — Enhanced ServerInstructions.ts with categorized documentation for all 15 PostGIS tools covering geometry creation, spatial queries, table-based operations, standalone geometry operations, and administration tools. Documents response structures, parameter aliases, and code mode aliases (`pg.postgis.addColumn()` → `geometryColumn`, `pg.postgis.indexOptimize()` → `geoIndexOptimize`)
- **PostGIS point bounds validation** — `preprocessPoint()` now validates coordinate bounds (lat: ±90°, lng: ±180°) by default for consistency with `pg_geocode`. Tools accepting `point` parameter (`pg_distance`, `pg_point_in_polygon`, `pg_bounding_box`, `pg_buffer`) now throw clear errors for out-of-bounds coordinates instead of passing invalid geometry to PostgreSQL
- **help() response structure documentation** — Clarified in ServerInstructions.ts that `pg.{group}.help()` returns `{methods, aliases, examples}` structure (not just methods array), making alias discovery more intuitive
- **Comprehensive Cron tools documentation** — Added `## Cron Tools (pg_cron)` section to ServerInstructions.ts documenting all 8 pg_cron tools with parameters, aliases (`sql`/`query` for `command`, `name` for `jobName`, `db` for `database`, `days` for `olderThanDays`), error handling behavior, and discovery via `pg.cron.help()`
- **Enhanced pg_partman tools documentation** — Expanded `## pg_partman Tools` section in ServerInstructions.ts with comprehensive documentation for all 10 tools including:
  - `pg_partman_create_parent`: Required params (`parentTable`, `controlColumn`/`control`, `interval`) and `startPartition` 'now' shorthand
  - `pg_partman_run_maintenance`: Behavior without `parentTable` (maintains ALL), `partial: true` response with `skipped` array
  - `pg_partman_show_config`: `schema.table` format support with auto-prefix `public.`, `orphaned` flag in response
  - `pg_partman_set_retention`: `retentionKeepTable` behavior (detach vs DROP), `retention: null` to disable
  - `pg_partman_analyze_partition_health`: Response structure with `overallHealth` status values
  - Schema resolution note: All partman tools auto-prefix `public.` when no schema specified
- **Comprehensive citext tools documentation** — Expanded `## citext Tools` section in ServerInstructions.ts with documentation for all 6 tools including:
  - Core methods: `createExtension()`, `convertColumn()`, `listColumns()`, `analyzeCandidates()`, `compare()`, `schemaAdvisor()`
  - Response structures for all tools
  - `schema.table` format support documentation for `convertColumn` and `schemaAdvisor`
  - Discovery via `pg.citext.help()` returning `{methods, aliases, examples}`
- **citext schema.table format support** — `pg_citext_convert_column` and `pg_citext_schema_advisor` now support `schema.table` format (e.g., `'myschema.users'` → auto-parsed). Embedded schema takes priority over explicit `schema` parameter, consistent with other tool groups
- **pg.citextXxx() top-level aliases** — Code mode now supports top-level citext method aliases for convenience: `pg.citextCreateExtension()`, `pg.citextConvertColumn()`, `pg.citextListColumns()`, `pg.citextAnalyzeCandidates()`, `pg.citextCompare()`, `pg.citextSchemaAdvisor()`. These map directly to `pg.citext.xxx()` methods, matching the aliases documented in `pg.citext.help()`
- **pg.ltreeXxx() top-level aliases** — Code mode now supports top-level ltree method aliases for convenience: `pg.ltreeCreateExtension()`, `pg.ltreeQuery()`, `pg.ltreeSubpath()`, `pg.ltreeLca()`, `pg.ltreeMatch()`, `pg.ltreeListColumns()`, `pg.ltreeConvertColumn()`, `pg.ltreeCreateIndex()`. These map directly to `pg.ltree.xxx()` methods, matching the aliases documented in `pg.ltree.help()`
- **Comprehensive ltree tools documentation** — Expanded `## ltree Tools` section in ServerInstructions.ts with documentation for all 8 tools including:
  - Core methods: `createExtension()`, `query()`, `match()`, `subpath()`, `lca()`, `listColumns()`, `convertColumn()`, `createIndex()`
  - Response structures for all tools
  - `schema.table` format support documentation for `query`, `match`, `convertColumn`, `createIndex`
  - Parameter aliases documentation (`offset`/`start`/`from`, `length`/`len`, `pattern`/`lquery`/`query`, `mode`/`type`)
  - Enhanced error handling documentation (column type validation, offset bounds checking, dependent views)
  - Discovery via `pg.ltree.help()` returning `{methods, aliases, examples}`
- **pg.pgcryptoXxx() top-level aliases** — Code mode now supports top-level pgcrypto method aliases for convenience: `pg.pgcryptoCreateExtension()`, `pg.pgcryptoHash()`, `pg.pgcryptoHmac()`, `pg.pgcryptoEncrypt()`, `pg.pgcryptoDecrypt()`, `pg.pgcryptoGenRandomUuid()`, `pg.pgcryptoGenRandomBytes()`, `pg.pgcryptoGenSalt()`, `pg.pgcryptoCrypt()`. These map directly to `pg.pgcrypto.xxx()` methods, matching the aliases documented in `pg.pgcrypto.help()`
- **pg_pgcrypto_gen_random_uuid convenience `uuid` property** — `pg_pgcrypto_gen_random_uuid` response now includes a `uuid` convenience property (containing the first UUID) when generating a single UUID. Previously only returned `uuids` array. Now returns `{success, uuid, uuids, count}` for single UUID requests
- **Comprehensive pgcrypto tools documentation** — Added `## pgcrypto Tools` section to ServerInstructions.ts documenting all 9 tools with parameters, aliases (`key`/`password`, `encryptedData`/`data`), response structures, password workflow pattern (genSalt → crypt → store → verify), and discovery via `pg.pgcrypto.help()`
- **pg.transactions.execute statement format clarification** — Updated Critical Gotcha #1 to clarify that `pg.transactions.execute` requires statements as array of objects with `sql` property (`statements: [{sql: "..."}, ...]`), not raw strings. Prevents validation errors from passing raw SQL strings
- **pg.exists() positional args with params support** — Code mode `pg.exists()` now supports positional arguments with params array: `pg.exists("users", "id=$1", [1])`. The third positional argument maps to `params`, enabling parameterized WHERE clauses without object syntax
- **Enhanced error messages with usage examples** — Starter tools (`pg_count`, `pg_exists`, `pg_truncate`, `pg_upsert`, `pg_batch_insert`, `pg_describe_table`) now include usage examples in error messages when required parameters are missing. Example: `table (or tableName alias) is required. Usage: pg_count({ table: "users" })`
- **pg.transactionXxx() top-level aliases** — Code mode now supports top-level transaction method aliases for consistency: `pg.transactionBegin()`, `pg.transactionCommit()`, `pg.transactionRollback()`, `pg.transactionSavepoint()`, `pg.transactionRelease()`, `pg.transactionRollbackTo()`, `pg.transactionExecute()`. These map directly to `pg.transactions.xxx()` methods

### Fixed

- **pg_partman_show_config/analyze_partition_health schema auto-resolution** — `pg_partman_show_config` and `pg_partman_analyze_partition_health` now auto-prefix `public.` when `parentTable` is specified without a schema (e.g., `showConfig({ parentTable: 'events' })` now correctly resolves to `public.events`). Previously, plain table names returned empty results or "not_found" status instead of matching the partman config. Also added `table` alias support for consistency with other partman tools
- **pg_geometry_intersection SRID mismatch** — `pg_geometry_intersection` now normalizes both geometries to SRID 4326 before computing intersection. Previously, mixing GeoJSON input (implicit SRID 4326) with WKT input (no SRID) caused PostgreSQL error: "ST_Intersects: Operation on mixed SRID geometries". Now safe to mix formats; returns `sridUsed: 4326` in response
- **pg_hybrid_search error handling consistency** — `pg_hybrid_search` now returns `{success: false, error: "...", suggestion: "..."}` objects for all error cases (dimension mismatch, table not found, column not found) instead of throwing exceptions. Consistent with other vector tools like `pg_vector_search`, `pg_vector_insert`, and `pg_vector_aggregate`
- **pg_vector_aggregate direct tool call parameters** — Fixed `pg_vector_aggregate` direct MCP tool call failing with "table parameter is required" error even when `table` was provided. The issue was caused by using a transformed Zod schema for `inputSchema`, which prevented proper JSON Schema generation for MCP clients. Now uses a base schema for MCP visibility and applies transforms only in the handler
- **pg_vector_dimension_reduce table mode response documentation** — Fixed ServerInstructions.ts documentation for table mode response structure. Documents correct `{rows: [{id, original_dimensions, reduced}], processedCount}` structure (previously incorrectly documented as `{results: [{id, reduced}]}`)
- **test_embeddings identical vectors** — Fixed test database seeding to generate **unique** random vectors for each row instead of identical vectors. The previous SQL approach using `ARRAY(SELECT random() FROM generate_series(...))` was optimized by PostgreSQL to compute once and reuse for all rows. Now uses a DO block with explicit loop iteration to ensure truly diverse embeddings for meaningful vector search/clustering tests. Also added `category` column (tech, science, business, sports, entertainment) for groupBy testing
- **Stats tools error handling consistency** — `pg_stats_descriptive`, `pg_stats_correlation`, and `pg_stats_time_series` now throw exceptions for invalid columns/tables instead of returning `{error: ...}` objects. Consistent with other stats tools (`percentiles`, `distribution`, `regression`, `hypothesis`, `sampling`)
- **attachPartition DEFAULT partition handling** — `attachPartition` with `isDefault: true` now correctly generates `ATTACH PARTITION ... DEFAULT` SQL syntax (previously generated invalid `FOR VALUES __DEFAULT__`)
- **attachPartition/detachPartition schema parameter** — Both tools now correctly use the `schema` parameter when building SQL statements (previously ignored schema, causing "relation does not exist" errors for non-public schemas)
- **createPartition forValues: "DEFAULT" support** — `createPartition` now accepts `forValues: "DEFAULT"` as an alternative to `isDefault: true` for creating DEFAULT partitions, matching the behavior of `attachPartition` for API consistency
- **createPartitionedTable multi-column partition key validation** — Primary key validation now correctly handles multi-column partition keys (e.g., `partitionKey: 'region, event_date'`). Previously, the validation checked for an exact string match instead of verifying that all partition key columns are included in the `primaryKey` array
- **Stats tools comprehensive error validation** — `pg_stats_percentiles`, `pg_stats_distribution`, `pg_stats_regression`, `pg_stats_hypothesis`, and `pg_stats_sampling` now have consistent, user-friendly error validation. All tools now validate table existence and column types upfront, throwing descriptive errors (e.g., "Table not found", "Column not found", "Column is not a numeric type") instead of passing raw PostgreSQL errors
- **hypothesis populationStdDev validation** — `pg_stats_hypothesis` now validates that `populationStdDev` must be greater than 0 when provided. Previously accepted negative or zero values, producing mathematically invalid results (negative standard error or division by zero)
- **pg_vector_aggregate groupBy expression error handling** — `pg_vector_aggregate` now returns a structured error object `{success: false, error: \"...\", suggestion: \"...\"}` when an expression (e.g., `LOWER(category)`) is passed to `groupBy` instead of throwing an unrecoverable `InvalidIdentifierError`. Consistent with other vector tool error handling patterns
- **timeSeries table existence error message** — `pg_stats_time_series` now checks table existence before column validation, returning a clear "Table not found" error instead of the confusing "Column not found in table" message when the table doesn't exist
- **pg_vector_insert updateExisting mode additionalColumns** — Fixed `pg_vector_insert` `updateExisting` mode to also update `additionalColumns` alongside the vector column. Previously, only the vector was updated and additional columns were ignored. Now returns `columnsUpdated: N` indicating total columns modified
- **pg_vector_validate direct MCP tool exposure** — Fixed `pg_vector_validate` not appearing as a direct MCP tool. Applied Split Schema pattern (base schema for MCP visibility, transformed schema for handler). Also enhanced tool description to document return structure `{valid: bool, vectorDimensions}` and empty vector behavior
- **pg_partman_undo_partition targetTable schema auto-resolution** — `pg_partman_undo_partition` now auto-prefixes `public.` to `targetTable` when no schema is specified, consistent with `parentTable` behavior. Previously, plain table names caused \"Unable to find given target table in system catalogs\" errors because pg_partman requires schema-qualified table references
- **pg_citext_convert_column previousType display** — `pg_citext_convert_column` now correctly reports `previousType: \"citext\"` instead of `\"USER-DEFINED\"` when converting an already-citext column. The fix queries both `data_type` and `udt_name` columns and normalizes the display for user-defined types
- **pg_ltree_query column type validation** — `pg_ltree_query` now validates that the specified column is an ltree type before querying. Returns clear error message (e.g., `Column "name" is not an ltree type (found: varchar)`) instead of cryptic PostgreSQL function error `function nlevel(character varying) does not exist`
- **pg_ltree_subpath offset bounds validation** — `pg_ltree_subpath` now validates offset before calling PostgreSQL `subpath()` function. Returns structured error `{success: false, error: \"Invalid offset: 5. Path 'a.b' has 2 labels...\", pathDepth: 2}` instead of raw PostgreSQL error `invalid positions`
- **pg_ltree_convert_column dependent views handling** — `pg_ltree_convert_column` now checks for dependent views before attempting type conversion, matching `pg_citext_convert_column` behavior. Returns `{success: false, dependentViews: [...], hint: \"...\"}` instead of raw PostgreSQL error. Also validates ltree extension is installed, enhanced error messages for column not found, and catches conversion errors with helpful hints

- **pg_transaction_execute transaction isolation** — `pg_transaction_execute` now correctly joins an existing transaction when `transactionId` parameter is provided. Previously, it always created a new auto-commit transaction, ignoring the `transactionId` from `pg_transaction_begin`. Fix enables proper multi-step transaction workflows: `begin() → execute({transactionId, ...}) → commit()/rollback()`. When joining an existing transaction, the tool does NOT auto-commit, letting the caller control the transaction lifecycle
- **pg_jsonb_object code mode double-wrapping fix** — `pg.jsonb.object({ data: { name: "John" } })` now correctly passes through to the tool without double-wrapping. Previously, Code Mode wrapped all objects unconditionally, causing `{ data: { key: 'val' } }` to become `{ data: { data: { key: 'val' } } }`. The fix uses skipKeys detection: when the object already contains expected keys (`data`, `object`, or `pairs`), it passes through unchanged. Both usage patterns now work correctly: `pg.jsonb.object({ name: "John" })` wraps to `{ data: { name: "John" } }`, while `pg.jsonb.object({ data: { name: "John" } })` passes through as-is
- **pg_batch_insert JSONB column support** — `pg_batch_insert` now correctly handles objects and arrays in row data, serializing them to JSON strings for JSONB column compatibility. Previously, passing objects/arrays to JSONB columns caused "invalid input syntax for type json" errors. Now `pg.batchInsert("table", [{ data: { nested: "object" }, tags: ["a", "b"] }])` works correctly

- **Text tools filter/where parameter support** — `pg_trigram_similarity`, `pg_fuzzy_match`, `pg_like_search`, and `pg_regexp_match` now properly support `filter` and `where` parameters. Previously, these parameters were silently ignored and all matching rows were returned
- **Text tools `text` parameter alias** — `pg_trigram_similarity` and `pg_fuzzy_match` now accept `text` as an alias for `value` parameter, matching the examples in `pg.text.help()` output
- **pg_text_search `column` singular alias** — `pg_text_search` now accepts `column` (singular string) as an alias for `columns` (array) in both Direct Tool Calls and Code Mode, auto-wrapping to array. MCP schema exposes both parameters with validation requiring at least one
- **Text tools table vs standalone clarification** — Updated ServerInstructions.ts to clearly distinguish between standalone text utilities (`normalize`, `sentiment`, `toVector`, `toQuery`, `searchConfig` — text input only) and table-based text operations (`soundex`, `metaphone` — require `table`, `column`, `value` parameters to query database rows). Prevents confusion when using `pg.text.help()` which lists both types under methods
- **pg_create_fts_index `indexName` parameter alias** — `pg_create_fts_index` now accepts `indexName` as an alias for `name` parameter
- **pg_create_fts_index default `ifNotExists: true`** — `pg_create_fts_index` now defaults `ifNotExists` to `true`, gracefully skipping existing indexes instead of throwing an error. Use `ifNotExists: false` to force error on existing index. Returns `{skipped: true}` when index already exists
- **pg_text_headline convenience parameters** — `pg_text_headline` now accepts `startSel`, `stopSel`, `maxWords`, and `minWords` as separate parameters for easier use. Previously these could only be set via the raw `options` string. When using separate params, they are merged into the options string automatically. The raw `options` parameter still takes priority if provided
- **dumpTable table parameter validation** — `dumpTable()` now validates that the `table` parameter is provided and throws a descriptive error if missing (previously created invalid DDL for "undefined")
- **dumpTable schema.table format parsing** — `dumpTable()` now correctly parses `schema.table` format (e.g., `'public.users'` → schema='public', table='users'). Embedded schema takes priority over explicit `schema` parameter to prevent duplication errors
- **copyExport schema.table format parsing** — `copyExport()` now correctly parses `schema.table` format with embedded schema taking priority over explicit `schema` parameter to prevent `public.public.table` duplication errors
- **copyImport schema.table format parsing** — `copyImport()` now correctly parses `schema.table` format with embedded schema taking priority over explicit `schema` parameter. Previously could cause `"schema"."schema.table"` quoting issues
- **scheduleOptimize numeric type coercion** — `scheduleOptimize()` now returns `activityByHour[].hour` and `activityByHour[].connection_count` as JavaScript numbers instead of strings
- **uptime() component breakdown** — `uptime()` now returns all time components (`days`, `hours`, `minutes`, `seconds`, `milliseconds`) instead of a raw PostgreSQL interval string. Documentation updated to reflect accurate output structure
- **capacityPlanning() negative days validation** — `capacityPlanning()` now validates and rejects negative `days`/`projectionDays` values with a descriptive Zod error message
- **Numeric type coercion in monitoring tools** — All monitoring tool outputs now consistently return JavaScript numbers instead of strings for numeric fields (affects `databaseSize`, `tableSizes`, `connectionStats`, `serverVersion`, `capacityPlanning`, `resourceUsageAnalyze`)
- **Numeric type coercion in performance tools** — All performance tool outputs now consistently return JavaScript numbers instead of strings for numeric fields (affects `tableStats`, `indexStats`, `vacuumStats`, `statStatements`, `bloatCheck`, `cacheHitRatio`, `seqScanTables`, `indexRecommendations`, `baseline`, `connectionPoolOptimize`, `queryPlanStats`, `partitionStrategySuggest`, `unusedIndexes`)
- **Output key standardization** — `vacuumStats()` now returns data under the `tables` key (previously `vacuumStats`) and `bloatCheck()` returns `tables` (previously `bloatedTables`) for consistency with other tools
- **Expression index column display** — `pg_get_indexes`, `pg_describe_table`, and `pg_object_details` now correctly display expression columns (e.g., `lower((name)::text)`) instead of `NULL` for expression-based indexes
- **Double schema prefix in performance tools** — `partitionStrategySuggest()` and `analyzeTable()` now correctly handle `schema.table` format without creating `public.public.table` errors
- **longRunningQueries minDuration alias** — Now recognizes `minDuration` as a parameter alias alongside `seconds`, `threshold`, and `minSeconds`
- **alertThresholdSet metric validation** — Invalid metric values now throw a Zod validation error instead of silently falling back to returning all thresholds
- **Code mode no-argument handling** — Code mode methods (e.g., `pg.backup.dumpSchema()`) now work correctly when called without arguments, matching direct tool call behavior. Previously threw "Invalid input: expected object, received undefined"
- **copyImport tableName alias** — `copyImport()` now correctly resolves `tableName` as an alias for `table` parameter. Previously threw "Cannot read properties of undefined" when using the alias
- **Backup tools code mode positional arguments** — Added positional argument support for backup tools in code mode: `copyExport('table_name')`, `copyImport('table_name')`, `dumpTable('table_name')`, `restoreCommand('backup.dump')`, `physical('/backups/dir')`, `restoreValidate('backup.dump')` now work with single string arguments
- **Numeric type coercion in partitioning tools** — `pg_list_partitions` and `pg_partition_info` now return `size_bytes` as a JavaScript number instead of string. `pg_partition_info` also returns `partition_count` as a number for consistency with other tools
- **partitioning help() example** — Fixed `pg.partitioning.help()` example for `createPartition` to show correct string format for `forValues` (e.g., `"FROM ('2024-01-01') TO ('2024-04-01')"`) instead of incorrect object format

### Changed

- **Node.js 24 LTS Baseline** — Upgraded from Node 18 to Node 24 LTS as the project baseline
  - `package.json` now requires Node.js >=24.0.0 in `engines` field
  - README prerequisites updated to specify Node.js 24+ (LTS)
- **Dependency Updates** — Updated npm dependencies to latest versions
  - `@modelcontextprotocol/sdk`: 1.25.1 → 1.25.2
  - `@types/node`: 25.0.3 → 25.0.9
  - `@vitest/coverage-v8`: 4.0.16 → 4.0.17
  - `globals`: 16.0.0 → 17.0.0 (major version bump)
  - `pg`: 8.13.0 → 8.17.1
  - `typescript-eslint`: 8.50.0 → 8.53.0
  - `vitest`: 4.0.15 → 4.0.17
  - `zod`: 4.2.1 → 4.3.5

### Security

- **Transitive Dependency Fixes** — Resolved 2 high severity vulnerabilities via npm audit fix
  - hono <=4.11.3 → upgraded (JWT algorithm confusion vulnerability)
  - qs <6.14.1 → upgraded (DoS via memory exhaustion vulnerability)

### Performance

- **Parallelized Health Queries** — Health resource now executes 5 checks concurrently using `Promise.all()`
  - Expected ~5x latency improvement for `postgres://health` resource
- **Batched Index Queries** — `getSchema()` now fetches all indexes in a single query
  - Eliminates N+1 query pattern (e.g., 101 queries → 1 query for 100 tables)
- **Tool Definition Caching** — 194 tool definitions are now cached after first generation
  - Subsequent calls return cached array without re-creation
- **Metadata Cache with TTL** — Added configurable TTL-based cache for expensive metadata queries
  - Default 30s TTL, configurable via `METADATA_CACHE_TTL_MS` environment variable
  - `clearMetadataCache()` method for invalidation after schema changes
- **Benchmark Tests** — Added performance benchmark test suite (`src/adapters/postgresql/__tests__/performance.test.ts`)

### Security

- **Identifier Sanitization** — New utility to prevent SQL injection via identifier interpolation
  - `sanitizeIdentifier()`, `sanitizeTableName()`, `sanitizeColumnRef()` functions
  - PostgreSQL-compliant validation and double-quote escaping
  - Applied to JSONB, vector, and text search tool handlers
- **HTTP Transport Hardening** — Enhanced HTTP transport security
  - **Rate Limiting** — 100 requests/minute per IP (configurable via `rateLimitMaxRequests`, `rateLimitWindowMs`)
  - **Body Size Limits** — 1MB max request body (configurable via `maxBodySize`)
  - **HSTS Support** — Optional Strict-Transport-Security header for HTTPS deployments
  - **Enhanced CORS** — Browser MCP client support with `Vary: Origin`, credentials, and MCP-specific headers
- **Log Injection Prevention** — Control character sanitization for log messages
  - Strips ASCII 0x00-0x1F (except tab/newline), 0x7F, and C1 control characters
  - Prevents log forging and escape sequence attacks
- **CodeQL Remediation** — Fixed 4 clear-text logging vulnerabilities (js/clear-text-logging)
  - Added `sanitizeDetails()` to Logger class that redacts sensitive OAuth/security fields before console output
  - Sensitive keys redacted: password, secret, token, key, apikey, issuer, audience, jwksUri, credentials, etc.
  - Supports recursive sanitization for nested configuration objects
  - Prevents exposure of OAuth configuration data in log output
- Removed unused `beforeEach` import in middleware tests (js/unused-local-variable)

### Changed

- **Tool File Modularity Refactoring** — Restructured 8 large tool files (500+ lines each) into modular directories
  - `tools/core/` — 6 sub-modules: query, tables, indexes, objects, health, schemas (20 tools)
  - `tools/performance/` — 5 sub-modules: explain, stats, monitoring, analysis, optimization (16 tools)
  - `tools/vector/` — 2 sub-modules: basic, advanced (14 tools)
  - `tools/jsonb/` — 2 sub-modules: basic, advanced (19 tools)
  - `tools/stats/` — 2 sub-modules: basic, advanced (8 tools)
  - `tools/partman/` — 2 sub-modules: management, operations (10 tools)
  - `tools/backup/` — 2 sub-modules: dump, planning (9 tools)
  - `tools/postgis/` — 2 sub-modules: basic, advanced (12 tools)
  - Each directory has an `index.ts` barrel file for clean re-exports
  - No file exceeds 350 lines; improved maintainability and navigation
- **@modelcontextprotocol/sdk** upgraded from 1.0.0 to 1.25.1
  - Aligned with MCP spec 2025-11-25
  - Enables: Streamable HTTP transport, OAuth 2.1 framework, Tasks API, tool annotations, elicitation, and JSON-RPC batching
  - Full backwards compatibility with existing stdio transport

### Added

- **OAuth 2.1 Authentication** — Full RFC-compliant OAuth for HTTP/SSE transports
  - RFC 9728 Protected Resource Metadata at `/.well-known/oauth-protected-resource`
  - RFC 8414 Authorization Server Metadata discovery
  - JWT token validation with JWKS caching
  - PostgreSQL-specific scopes: `read`, `write`, `admin`, `full`, `db:{name}`, `schema:{name}`, `table:{schema}:{table}`
  - Configurable via CLI (`--oauth-enabled`, `--oauth-issuer`, etc.) or environment variables
  - Compatible with Keycloak and other OAuth 2.0/2.1 providers
- **HTTP/SSE Transport** — New transport mode for web clients
  - Streamable HTTP server transport using MCP SDK 1.25+
  - SSE endpoints at `/sse` and `/messages`
  - Security headers (X-Content-Type-Options, X-Frame-Options, CSP)
  - CORS support for cross-origin requests
  - Health check endpoint at `/health`
- **Tool Annotations** — All 194 tools now include MCP Tool Annotations (SDK 1.25+)
  - `title` — Human-readable tool names for UX display
  - `readOnlyHint` — Identifies read-only tools (SELECT, EXPLAIN, list operations)
  - `destructiveHint` — Marks destructive operations (DROP, DELETE, TRUNCATE)
  - `idempotentHint` — Identifies safe-to-retry operations (IF NOT EXISTS patterns)
  - `openWorldHint` — Set to `false` for all tools (no external system interaction)
  - Centralized annotation helpers: `readOnly()`, `write()`, `destructive()`, `admin()`
- **Tool Icons** — All 194 tools now include MCP Tool Icons (SDK 1.25+)
  - Per-tool icons based on behavior: warning icons for destructive, gear icons for admin
  - 19 category-specific colored SVG icons (one per tool group)
  - Embedded as data URIs for maximum portability — no external hosting required
  - Centralized icon utility: `getToolIcons()` in `src/utils/icons.ts`
- **MCP Enhanced Logging** — Full MCP protocol-compliant structured logging (SDK 1.25+)
  - RFC 5424 severity levels: debug, info, notice, warning, error, critical, alert, emergency
  - Module-prefixed error codes (e.g., `PG_CONNECT_FAILED`, `AUTH_TOKEN_INVALID`)
  - Structured log format: `[timestamp] [LEVEL] [MODULE] [CODE] message {context}`
  - Module-scoped loggers via `logger.forModule()` and `logger.child()`
  - Dual-mode output: stderr for local debugging + MCP protocol notifications to clients
  - Dynamic log level control via `logging/setLevel` request from MCP clients
  - Sensitive data redaction for OAuth 2.1 configuration fields
  - Stack trace inclusion for error-level logs with sanitization
  - Log injection prevention via control character sanitization
- **21 resources** — migrated + new extension resources
  - `postgres://capabilities` — Server version, extensions, tool categories
  - `postgres://performance` — pg_stat_statements query metrics
  - `postgres://health` — Comprehensive database health status
  - `postgres://extensions` — Extension inventory with recommendations
  - `postgres://indexes` — Index usage with unused detection
  - `postgres://replication` — Replication status and lag monitoring
  - `postgres://vacuum` — Vacuum stats and wraparound warnings
  - `postgres://locks` — Lock contention detection
  - `postgres://cron` — pg_cron job status, schedules, and execution history
  - `postgres://partman` — pg_partman partition configuration and health status
  - `postgres://kcache` — pg_stat_kcache CPU/I/O metrics summary
  - `postgres://vector` — pgvector columns, indexes, and recommendations
  - `postgres://postgis` — PostGIS spatial columns and index status
  - `postgres://crypto` — pgcrypto availability and security recommendations
  - `postgres://annotations` — Tool behavior hints categorized by type (read-only, write, destructive)
- Enhanced `postgres://stats` with stale statistics detection and recommendations
- **12 prompts** (6 migrated + 6 new extension-specific)
  - `pg_database_health_check` — Comprehensive health assessment workflow
  - `pg_backup_strategy` — Enterprise backup planning (logical/physical/PITR)
  - `pg_index_tuning` — Index usage analysis and optimization
  - `pg_extension_setup` — Extension installation guides
  - `pg_setup_pgvector` — Complete pgvector setup for semantic search
  - `pg_setup_postgis` — Complete PostGIS setup for geospatial operations
  - `pg_setup_pgcron` — Complete pg_cron setup for job scheduling
  - `pg_setup_partman` — Complete pg_partman setup for partition management
  - `pg_setup_kcache` — Complete pg_stat_kcache setup for OS-level monitoring
  - `pg_setup_citext` — Complete citext setup for case-insensitive text
  - `pg_setup_ltree` — Complete ltree setup for hierarchical tree data
  - `pg_setup_pgcrypto` — Complete pgcrypto setup for cryptographic functions
- **8 pg_cron tools** — Job scheduling extension support
  - `pg_cron_create_extension` — Enable pg_cron
  - `pg_cron_schedule` — Schedule cron jobs
  - `pg_cron_schedule_in_database` — Cross-database scheduling
  - `pg_cron_unschedule` — Remove jobs
  - `pg_cron_alter_job` — Modify existing jobs
  - `pg_cron_list_jobs` — List scheduled jobs
  - `pg_cron_job_run_details` — View execution history
  - `pg_cron_cleanup_history` — Clean old history records
- New `cron` tool-filtering group for pg_cron tools
- **10 pg_partman tools** — Automated partition lifecycle management
  - `pg_partman_create_extension` — Enable pg_partman
  - `pg_partman_create_parent` — Create partition set with automatic child creation
  - `pg_partman_run_maintenance` — Execute partition maintenance
  - `pg_partman_show_partitions` — List managed partitions
  - `pg_partman_show_config` — View partition configuration
  - `pg_partman_check_default` — Check for data in default partition
  - `pg_partman_partition_data` — Move data to child partitions
  - `pg_partman_set_retention` — Configure retention policies
  - `pg_partman_undo_partition` — Convert back to regular table
  - `pg_partman_analyze_partition_health` — Health check with recommendations
- New `partman` tool-filtering group for pg_partman tools
- **7 pg_stat_kcache tools** — OS-level performance visibility
  - `pg_kcache_create_extension` — Enable pg_stat_kcache
  - `pg_kcache_query_stats` — Query stats with CPU/IO metrics
  - `pg_kcache_top_cpu` — Top CPU-consuming queries
  - `pg_kcache_top_io` — Top I/O-consuming queries
  - `pg_kcache_database_stats` — Database-level aggregated stats
  - `pg_kcache_resource_analysis` — CPU-bound vs I/O-bound classification
  - `pg_kcache_reset` — Reset statistics
- New `kcache` tool-filtering group for pg_stat_kcache tools
- **6 citext tools** — Case-insensitive text type support
  - `pg_citext_create_extension` — Enable citext
  - `pg_citext_convert_column` — Convert text columns to citext
  - `pg_citext_list_columns` — List citext columns
  - `pg_citext_analyze_candidates` — Find columns that could benefit from citext
  - `pg_citext_compare` — Case-insensitive comparison
  - `pg_citext_schema_advisor` — Schema design recommendations
- New `citext` tool-filtering group for citext schema intelligence tools
- **8 ltree tools** — Hierarchical tree label support
  - `pg_ltree_create_extension` — Enable ltree
  - `pg_ltree_query` — Query ancestors/descendants with @> and <@ operators
  - `pg_ltree_subpath` — Extract path segments
  - `pg_ltree_lca` — Find longest common ancestor
  - `pg_ltree_match` — Pattern matching with lquery syntax
  - `pg_ltree_list_columns` — List ltree columns
  - `pg_ltree_convert_column` — Convert text to ltree
  - `pg_ltree_create_index` — Create GiST index for tree queries
- New `ltree` tool-filtering group for hierarchical tree operations
- **9 pgcrypto tools** — Cryptographic functions support
  - `pg_pgcrypto_create_extension` — Enable pgcrypto
  - `pg_pgcrypto_hash` — Hash data with digest() (SHA-256, MD5, etc.)
  - `pg_pgcrypto_hmac` — HMAC authentication
  - `pg_pgcrypto_encrypt` — Symmetric encryption with pgp_sym_encrypt()
  - `pg_pgcrypto_decrypt` — Symmetric decryption with pgp_sym_decrypt()
  - `pg_pgcrypto_gen_random_uuid` — Generate cryptographically secure UUID v4
  - `pg_pgcrypto_gen_random_bytes` — Generate random bytes for salts/tokens
  - `pg_pgcrypto_gen_salt` — Generate salt for password hashing
  - `pg_pgcrypto_crypt` — Hash passwords with crypt()
- New `pgcrypto` tool-filtering group for cryptographic operations
- **7 tool-filtering shortcuts** — Meta-groups for easier filtering
  - `starter` (49 tools) — **Recommended default**: core, transactions, jsonb, schema
  - `essential` (39 tools) — Minimal footprint: core, transactions, jsonb
  - `dev` (68 tools) — Application development: adds text search and stats
  - `ai` (80 tools) — AI/ML workloads: adds pgvector and performance
  - `dba` (90 tools) — Database administration: monitoring, backup, maintenance
  - `base` (120 tools) — All core PostgreSQL tools without extensions
  - `extensions` (74 tools) — All extension tools

### Changed

- Restructured resources into modular files for maintainability
- Resource count from 6 to 21
- Prompt count from 7 to 13
- Restructured prompts into modular files for maintainability
- Tool count from 146 to 194 (added pg_cron, pg_partman, pg_stat_kcache, citext, ltree, and pgcrypto tools)

### Planned

- Verify prompts and resources from old Python server are ported
- Verify all PostgreSQL extensions are supported
- Comprehensive testing before v1.0 release

## [0.2.0] - 2025-12-14

### Added

- **146 total tools** — comprehensive PostgreSQL coverage
- **Core tools** (13): `pg_list_objects`, `pg_object_details`, `pg_analyze_db_health`, `pg_analyze_workload_indexes`, `pg_analyze_query_indexes`
- **JSONB tools** (19): `pg_jsonb_validate_path`, `pg_jsonb_stats`, `pg_jsonb_merge`, `pg_jsonb_normalize`, `pg_jsonb_diff`, `pg_jsonb_index_suggest`, `pg_jsonb_security_scan`
- **Stats tools** (8): New group — `pg_stats_descriptive`, `pg_stats_percentiles`, `pg_stats_correlation`, `pg_stats_regression`, `pg_stats_time_series`, `pg_stats_distribution`, `pg_stats_hypothesis`, `pg_stats_sampling`
- **Vector tools** (14): `pg_vector_cluster`, `pg_vector_index_optimize`, `pg_vector_dimension_reduce`, `pg_hybrid_search`, `pg_vector_performance`, `pg_vector_embed`
- **Performance tools** (16): `pg_query_plan_compare`, `pg_performance_baseline`, `pg_connection_pool_optimize`, `pg_partition_strategy_suggest`
- **Monitoring tools** (11): `pg_capacity_planning`, `pg_resource_usage_analyze`, `pg_alert_threshold_set`
- **Backup tools** (9): `pg_backup_physical`, `pg_restore_validate`, `pg_backup_schedule_optimize`
- **PostGIS tools** (12): `pg_geo_transform`, `pg_geo_index_optimize`, `pg_geo_cluster`
- **Text tools** (11): `pg_text_sentiment`
- Tool filtering with `TOOL_GROUPS` for all 146 tools

### Changed

- Status from "Development Preview" to "Initial Implementation Complete"
- Updated README with accurate tool counts and categories

## [0.1.0] - 2025-12-13

### Added

- Initial repository setup
- Community standards (LICENSE, CONTRIBUTING, CODE_OF_CONDUCT, SECURITY)
- GitHub automation (CodeQL, Dependabot, issue/PR templates)
- Project configuration (TypeScript, ESLint, package.json)
- Core infrastructure with 106 base tools
- Connection pooling with health checks
- Tool filtering system
- 6 resources and 7 AI-powered prompts
