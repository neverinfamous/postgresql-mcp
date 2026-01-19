# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

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

### Fixed

- **attachPartition DEFAULT partition handling** — `attachPartition` with `isDefault: true` now correctly generates `ATTACH PARTITION ... DEFAULT` SQL syntax (previously generated invalid `FOR VALUES __DEFAULT__`)
- **attachPartition/detachPartition schema parameter** — Both tools now correctly use the `schema` parameter when building SQL statements (previously ignored schema, causing "relation does not exist" errors for non-public schemas)
- **createPartition forValues: "DEFAULT" support** — `createPartition` now accepts `forValues: "DEFAULT"` as an alternative to `isDefault: true` for creating DEFAULT partitions, matching the behavior of `attachPartition` for API consistency
- **createPartitionedTable multi-column partition key validation** — Primary key validation now correctly handles multi-column partition keys (e.g., `partitionKey: 'region, event_date'`). Previously, the validation checked for an exact string match instead of verifying that all partition key columns are included in the `primaryKey` array

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
