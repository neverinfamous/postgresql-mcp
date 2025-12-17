# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed
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

