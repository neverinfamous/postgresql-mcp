# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **14 resources** — migrated from legacy postgres-mcp-server
  - `postgres://capabilities` — Server version, extensions, tool categories
  - `postgres://performance` — pg_stat_statements query metrics
  - `postgres://health` — Comprehensive database health status
  - `postgres://extensions` — Extension inventory with recommendations
  - `postgres://indexes` — Index usage with unused detection
  - `postgres://replication` — Replication status and lag monitoring
  - `postgres://vacuum` — Vacuum stats and wraparound warnings
  - `postgres://locks` — Lock contention detection
- Enhanced `postgres://stats` with stale statistics detection and recommendations
- **6 new prompts** — migrated from legacy postgres-mcp-server
  - `pg_database_health_check` — Comprehensive health assessment workflow
  - `pg_backup_strategy` — Enterprise backup planning (logical/physical/PITR)
  - `pg_index_tuning` — Index usage analysis and optimization
  - `pg_extension_setup` — Extension installation guides
  - `pg_setup_pgvector` — Complete pgvector setup for semantic search
  - `pg_setup_postgis` — Complete PostGIS setup for geospatial operations
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

### Changed
- Restructured resources into modular files for maintainability
- Resource count from 6 to 14
- Prompt count from 7 to 13
- Restructured prompts into modular files for maintainability
- Tool count from 146 to 154 (added pg_cron tools)

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

