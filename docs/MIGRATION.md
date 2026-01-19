# PostgreSQL MCP Migration Guide

This document maps the legacy 202 tools to the new 6-tool architecture.

## Tool Mapping

| Legacy Tool | New Action | New Parameters |
|-------------|------------|----------------|
| `pg_read_query` | `pg_query` | `{ "action": "read", "sql": "..." }` |
| `pg_write_query` | `pg_query` | `{ "action": "write", "sql": "..." }` |
| `pg_explain_query` | `pg_query` | `{ "action": "explain", "sql": "..." }` |
| `pg_list_tables` | `pg_schema` | `{ "action": "list", "target": "table" }` |
| `pg_list_views` | `pg_schema` | `{ "action": "list", "target": "view" }` |
| `pg_describe_table` | `pg_schema` | `{ "action": "describe", "name": "..." }` |
| `pg_vacuum_table` | `pg_admin` | `{ "action": "vacuum", "target": "..." }` |
| `pg_analyze_table` | `pg_admin` | `{ "action": "analyze", "target": "..." }` |
| `pg_list_connections` | `pg_monitor` | `{ "action": "connections" }` |
| `pg_begin` | `pg_tx` | `{ "action": "begin" }` |

## Benefits

1. **Context Efficiency**: Reduces context tokens from ~40,000 to ~1,200 (97% reduction).
2. **SOLID Principles**: Focused domain tools with action-based routing.
3. **Extensibility**: New actions can be added without bloating the tool count.
