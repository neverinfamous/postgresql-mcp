# Test Database Reset

This document describes how to reset the postgres-mcp test database between test runs.

> [!IMPORTANT]
> The database accumulates temporary tables, partitions, and test artifacts over multiple test runs.
> Always run the **Full Cleanup** before testing to prevent performance issues caused by accumulated objects.

## Quick Reset (Known Test Tables Only)

Use this if you're confident no extra tables have accumulated:

```powershell
docker exec postgres-server psql -U postgres -d postgres -c "DROP TABLE IF EXISTS test_orders CASCADE; DROP TABLE IF EXISTS test_products CASCADE; DROP TABLE IF EXISTS test_jsonb_docs CASCADE; DROP TABLE IF EXISTS test_articles CASCADE; DROP SCHEMA IF EXISTS test_schema CASCADE; DROP TABLE IF EXISTS test_events CASCADE; DROP TABLE IF EXISTS test_measurements CASCADE; DROP TABLE IF EXISTS test_embeddings CASCADE; DROP TABLE IF EXISTS test_locations CASCADE; DROP TABLE IF EXISTS test_logs CASCADE; DROP TABLE IF EXISTS test_users CASCADE; DROP TABLE IF EXISTS test_categories CASCADE; DROP TABLE IF EXISTS test_secure_data CASCADE;" && docker cp c:\Users\chris\Desktop\postgres-mcp\test-database\test-database.sql postgres-server:/tmp/test-database.sql && docker exec postgres-server psql -U postgres -d postgres -f /tmp/test-database.sql 2>&1 | Select-Object -Last 10
```

## Full Cleanup (Recommended)

Use this to clean up ALL accumulated test artifacts including `temp_*` tables, partition tables, and test schemas:

```powershell
# Step 1: Drop ALL temp_* and accumulated test tables (run in psql or via docker exec)
docker exec postgres-server psql -U postgres -d postgres -c "
DO \$\$
DECLARE
    r RECORD;
BEGIN
    -- Drop all temp_* tables
    FOR r IN SELECT schemaname, tablename FROM pg_tables WHERE tablename LIKE 'temp_%' AND schemaname = 'public'
    LOOP
        EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.schemaname) || '.' || quote_ident(r.tablename) || ' CASCADE';
    END LOOP;

    -- Drop all test_* tables (except partman-managed)
    FOR r IN SELECT schemaname, tablename FROM pg_tables WHERE tablename LIKE 'test_%' AND schemaname = 'public'
    LOOP
        EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.schemaname) || '.' || quote_ident(r.tablename) || ' CASCADE';
    END LOOP;

    -- Drop accumulated ai_test_* tables
    FOR r IN SELECT schemaname, tablename FROM pg_tables WHERE tablename LIKE 'ai_test_%' AND schemaname = 'public'
    LOOP
        EXECUTE 'DROP TABLE IF EXISTS ' || quote_ident(r.schemaname) || '.' || quote_ident(r.tablename) || ' CASCADE';
    END LOOP;

    -- Drop test schemas
    DROP SCHEMA IF EXISTS test_schema CASCADE;
    DROP SCHEMA IF EXISTS test_vector_schema CASCADE;
END \$\$;
"

# Step 2: Re-seed the database
docker cp c:\Users\chris\Desktop\postgres-mcp\test-database\test-database.sql postgres-server:/tmp/test-database.sql && docker exec postgres-server psql -U postgres -d postgres -f /tmp/test-database.sql 2>&1 | Select-Object -Last 10
```

## Verify Cleanup

After cleanup, verify the database has a reasonable number of objects:

```powershell
docker exec postgres-server psql -U postgres -d postgres -c "SELECT COUNT(*) as table_count FROM pg_tables WHERE schemaname = 'public';"
```

Expected: ~15-25 tables (test\_\* plus a few system tables)

## What This Creates

Available Test Data
Core Tables:

test_products (15 rows): id, name, description, price, created_at
test_orders (20 rows): id, product_id, quantity, total_price, order_date, status
Indexes: idx_orders_status, idx_orders_date
JSONB Table:

test_jsonb_docs (3 rows): id, metadata (JSONB), settings (JSONB), tags (JSONB array)
Row 1: {"type": "article", "author": "Alice", "views": 100}
Row 2: {"type": "video", "author": "Bob", "duration": 3600}
Row 3: {"type": "article", "author": "Charlie", "views": 500, "nested": {"level1": {"level2": "deep"}}}
Full-Text Search:

test_articles (3 rows): id, title, body, search_vector (TSVECTOR)
Index: idx_articles_fts (GIN)
Schema Objects:

Schema: test_schema
Sequence: test_schema.order_seq (starts at 1000)
View: test_order_summary
Function: test_get_order_count()
Stats/Measurements:

test_measurements (500 rows): id, sensor_id, temperature, humidity, pressure, measured_at

Vector Embeddings:

test_embeddings (50 rows): id, content, category, embedding (vector(384))

- Categories: tech, science, business, sports, entertainment (for groupBy testing)
- Each row has a **unique** random 384-dim vector (not identical) for meaningful search/clustering tests

---

## Testing Tools

Core Tool Group (19 tools +1 for code mode):

'pg_read_query'
'pg_write_query'
'pg_list_tables'
'pg_describe_table'
'pg_create_table'
'pg_drop_table'
'pg_get_indexes'
'pg_create_index'
'pg_list_objects'
'pg_object_details'
'pg_analyze_db_health'
'pg_analyze_workload_indexes'
'pg_analyze_query_indexes'
// Convenience tools
'pg_upsert'
'pg_batch_insert'
'pg_count'
'pg_exists'
'pg_truncate'
'pg_drop_index'
'pg_execute_code' (codemode, auto-added)

---

Transactions Tool Group (7 tools +1 for code mode):

'pg_transaction_begin',
'pg_transaction_commit'
'pg_transaction_rollback'
'pg_transaction_savepoint'
'pg_transaction_release'
'pg_transaction_rollback_to'
'pg_transaction_execute'
'pg_execute_code' (codemode, auto-added)

---

JSONB Tool Group (19 tools +1 for code mode):

'pg_jsonb_extract'
'pg_jsonb_set'
'pg_jsonb_insert'
'pg_jsonb_delete'
'pg_jsonb_contains'
'pg_jsonb_path_query'
'pg_jsonb_agg'
'pg_jsonb_object'
'pg_jsonb_array'
'pg_jsonb_keys'
'pg_jsonb_strip_nulls'
'pg_jsonb_typeof'
'pg_jsonb_validate_path'
'pg_jsonb_stats'
'pg_jsonb_merge'
'pg_jsonb_normalize'
'pg_jsonb_diff'
'pg_jsonb_index_suggest'
'pg_jsonb_security_scan'
'pg_execute_code' (codemode, auto-added)

---

Text Tool Group (13 tools +1 for code mode)

'pg_text_search'
'pg_text_rank'
'pg_trigram_similarity'
'pg_fuzzy_match'
'pg_regexp_match'
'pg_like_search'
'pg_text_headline'
'pg_create_fts_index'
'pg_text_normalize'
'pg_text_sentiment'
'pg_text_to_vector'
'pg_text_to_query'
'pg_text_search_config'
'pg_execute_code' (codemode, auto-added)

---

Performance Tool Group (20 tools +1 code mode)

'pg_explain',
'pg_explain_analyze'
'pg_explain_buffers'
'pg_index_stats'
'pg_table_stats'
'pg_stat_statements'
'pg_stat_activity'
'pg_locks'
'pg_bloat_check,
'pg_cache_hit_ratio'
'pg_seq_scan_tables'
'pg_index_recommendations'
'pg_query_plan_compare'
'pg_performance_baseline'
'pg_connection_pool_optimize'
'pg_partition_strategy_suggest'
'pg_unused_indexes'
'pg_duplicate_indexes'
'pg_vacuum_stats'
'pg_query_plan_stats'
'pg_execute_code' (codemode, auto-added)

---

Admin Tool Group (10 tools +1 code mode):

'pg_vacuum',
'pg_vacuum_analyze'
'pg_analyze'
'pg_reindex'
'pg_terminate_backend'
'pg_cancel_backend'
'pg_reload_conf'
'pg_set_config'
'pg_reset_stats'
'pg_cluster'
'pg_execute_code' (codemode, auto-added)

---

Monitoring group (11 tools +1 for code mode)

'pg_database_size',
'pg_table_sizes'
'pg_connection_stats'
'pg_replication_status'
'pg_server_version'
'pg_show_settings'
'pg_uptime'
'pg_recovery_status'
'pg_capacity_planning'
'pg_resource_usage_analyze'
'pg_alert_threshold_set'
'pg_execute_code' (codemode, auto-added)

---

Backup Tool Group (9 tools +1 for code mode)

'pg_dump_table'
'pg_dump_schema'
'pg_copy_export'
'pg_copy_import'
'pg_create_backup_plan'
'pg_restore_command'
'pg_backup_physical'
'pg_restore_validate'
'pg_backup_schedule_optimize'
'pg_execute_code' (codemode, auto-added)

---

Schema Tool Group (12 tools +1 for code mode)

'pg_list_schemas',
'pg_create_schema'
'pg_drop_schema'
'pg_list_sequences'
'pg_create_sequence'
'pg_drop_sequence'
'pg_list_views'
'pg_create_view'
'pg_drop_view'
'pg_list_functions'
'pg_list_triggers'
'pg_list_constraints'
'pg_execute_code' (codemode, auto-added)

---

Partitioning Tool Group (6 tools +1 for code mode)

'pg_list_partitions'
'pg_create_partition'
'pg_attach_partition'
'pg_detach_partition'
'pg_partition_info'
'pg_create_partitioned_table'
'pg_execute_code' (codemode, auto-added)

---

Stats Group (8 tools +1 for code mode)

'pg_stats_descriptive'
'pg_stats_percentiles'
'pg_stats_correlation'
'pg_stats_regression'
'pg_stats_time_series'
'pg_stats_distribution'
'pg_stats_hypothesis'
'pg_stats_sampling'
'pg_execute_code' (codemode, auto-added)

---

Vector Tool Group (14 tools +1 for code mode)

'pg_vector_create_extension'
'pg_vector_add_column'
'pg_vector_insert'
'pg_vector_search'
'pg_vector_create_index'
'pg_vector_distance'
'pg_vector_normalize'
'pg_vector_aggregate'
'pg_vector_cluster'
'pg_vector_index_optimize'
'pg_hybrid_search'
'pg_vector_performance'
'pg_vector_dimension_reduce'
'pg_vector_embed'
'pg_execute_code' (codemode, auto-added)

---

PostGIS Tool Group (15 tools +1 for code mode)

'pg_postgis_create_extension'
'pg_geometry_column'
'pg_point_in_polygon'
'pg_distance'
'pg_buffer'
'pg_intersection'
'pg_bounding_box'
'pg_spatial_index'
'pg_geocode'
'pg_geo_transform'
'pg_geo_index_optimize'
'pg_geo_cluster'
'pg_geometry_buffer'
'pg_geometry_intersection'
'pg_geometry_transform'
'pg_execute_code' (codemode, auto-added)

---

Cron Tool Group (8 tools +1 for code mode)

'pg_cron_create_extension'
'pg_cron_schedule'
'pg_cron_schedule_in_database'
'pg_cron_unschedule'
'pg_cron_alter_job'
'pg_cron_list_jobs'
'pg_cron_job_run_details'
'pg_cron_cleanup_history'
'pg_execute_code' (codemode, auto-added)

---

Partman Tool Group (10 tools +1 for code mode)

'pg_partman_create_extension'
'pg_partman_create_parent'
'pg_partman_run_maintenance'
'pg_partman_show_partitions'
'pg_partman_show_config'
'pg_partman_check_default'
'pg_partman_partition_data'
'pg_partman_set_retention'
'pg_partman_undo_partition'
'pg_partman_analyze_partition_health'
'pg_execute_code' (codemode, auto-added)

---

kcache Tool Group (7 tools +1 for code mode)

'pg_kcache_create_extension'
'pg_kcache_query_stats'
'pg_kcache_top_cpu'
'pg_kcache_top_io'
'pg_kcache_database_stats'
'pg_kcache_resource_analysis'
'pg_kcache_reset'
'pg_execute_code' (codemode, auto-added)

---

citext Tool Group (6 tools +1 for code mode)

'pg_citext_create_extension'
'pg_citext_convert_column'
'pg_citext_list_columns'
'pg_citext_analyze_candidates'
'pg_citext_compare'
'pg_citext_schema_advisor
'pg_execute_code' (codemode, auto-added)

---

ltree Tool Group (8 tools +1 for code mode)

'pg_ltree_create_extension'
'pg_ltree_query'
'pg_ltree_subpath'
'pg_ltree_lca'
'pg_ltree_match'
'pg_ltree_list_columns'
'pg_ltree_convert_column'
'pg_ltree_create_index'
'pg_execute_code' (codemode, auto-added)

---

pgcrypto Tool Group (9 tools +1 for code mode)

'pg_pgcrypto_create_extension'
'pg_pgcrypto_hash'
'pg_pgcrypto_hmac'
'pg_pgcrypto_encrypt'
'pg_pgcrypto_decrypt'
'pg_pgcrypto_gen_random_uuid'
'pg_pgcrypto_gen_random_bytes'
'pg_pgcrypto_gen_salt'
'pg_pgcrypto_crypt'
'pg_execute_code' (codemode, auto-added)

## Testing Resources

Resources:

postgres://schema
postgres://tables
postgres://settings
postgres://stats
postgres://activity
postgres://pool
postgres://capabilities
postgres://performance
postgres://health
postgres://extensions
postgres://indexes
postgres://replication
postgres://vacuum
postgres://locks
postgres://cron
postgres://partman
postgres://kcache
postgres://vector
postgres://postgis
postgres://crypto
