# postgres-mcp

<!-- mcp-name: io.github.neverinfamous/postgres-mcp -->

*Last updated December 17, 2025 - Initial Implementation Complete*

*Enterprise-grade PostgreSQL MCP Server with OAuth 2.0 authentication, code mode, connection pooling, tool filtering, plus support for citext, ltree, pgcrypto, pg_cron, pg_stat_kcache, pgvector, PostGIS, and advanced PostgreSQL features - TypeScript Edition*

> **✅ Initial Implementation Complete** - 194 tools, 20 resources, and 19 prompts. Thorough testing before release in progress.

[![GitHub](https://img.shields.io/badge/GitHub-neverinfamous/postgres--mcp-blue?logo=github)](https://github.com/neverinfamous/postgres-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)
[![MCP](https://img.shields.io/badge/MCP-Compatible-green.svg)](https://modelcontextprotocol.io/)
![Status](https://img.shields.io/badge/status-Testing-blue)

A **PostgreSQL MCP Server** that enables AI assistants (Claude, Cursor, etc.) to interact with PostgreSQL databases through the Model Context Protocol. Provides **194 specialized tools**, **20 resources**, and **19 AI-powered prompts**.

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 12-18 (tested with PostgreSQL 18.1)
- npm or yarn

### Installation

```bash
git clone https://github.com/neverinfamous/postgres-mcp.git
cd postgres-mcp
npm install
npm run build
node dist/cli.js --transport stdio --postgres postgres://user:password@localhost:5432/database
```

---

## ⚡ MCP Client Configuration

### Cursor IDE / Claude Desktop

```json
{
  "mcpServers": {
    "postgres-mcp": {
      "command": "node",
      "args": [
        "C:/path/to/postgres-mcp/dist/cli.js",
        "--postgres", "postgres://user:password@localhost:5432/database",
        "--tool-filter", "-base,-extensions,+starter"
      ]
    }
  }
}
```

> [!TIP]
> The `starter` shortcut provides 49 essential tools that work well with all AI IDEs. See [Tool Filtering](#-tool-filtering) to add more tools as needed.

### Using Environment Variables (Recommended)

```json
{
  "mcpServers": {
    "postgres-mcp": {
      "command": "node",
      "args": [
        "C:/path/to/postgres-mcp/dist/cli.js",
        "--tool-filter", "-base,-extensions,+starter"
      ],
      "env": {
        "POSTGRES_HOST": "localhost",
        "POSTGRES_PORT": "5432",
        "POSTGRES_USER": "your_user",
        "POSTGRES_PASSWORD": "your_password",
        "POSTGRES_DATABASE": "your_database"
      }
    }
  }
}
```

---

## 🔗 Database Connection Scenarios

| Scenario | Host to Use | Example Connection String |
|----------|-------------|---------------------------|
| **PostgreSQL on host machine** | `localhost` or `host.docker.internal` | `postgres://user:pass@localhost:5432/db` |
| **PostgreSQL in Docker** | Container name or network | `postgres://user:pass@postgres-container:5432/db` |
| **Remote/Cloud PostgreSQL** | Hostname or IP | `postgres://user:pass@db.example.com:5432/db` |

| Provider | Example Hostname |
|----------|------------------|
| AWS RDS PostgreSQL | `your-instance.xxxx.us-east-1.rds.amazonaws.com` |
| Google Cloud SQL | `project:region:instance` (via Cloud SQL Proxy) |
| Azure PostgreSQL | `your-server.postgres.database.azure.com` |
| Supabase | `db.xxxx.supabase.co` |
| Neon | `ep-xxx.us-east-1.aws.neon.tech` |

---

## 🛠️ Tool Categories

This server provides **194 tools** across 19 categories:

| Category | Tools | Description |
|----------|-------|-------------|
| Core | 13 | CRUD, schema, tables, indexes, health analysis |
| Transactions | 7 | BEGIN, COMMIT, ROLLBACK, savepoints with isolation levels |
| JSONB | 19 | jsonb_set, jsonb_extract, jsonb_path_query, merge, diff, security scan |
| Text | 11 | Full-text search, trigram similarity, fuzzy matching, sentiment |
| Stats | 8 | Descriptive stats, percentiles, correlation, regression, time series |
| Performance | 16 | EXPLAIN ANALYZE, plan compare, baseline, connection pool, partitioning |
| Admin | 10 | VACUUM, ANALYZE, REINDEX, configuration |
| Monitoring | 11 | Database sizes, connections, replication, capacity planning, alerts |
| Backup | 9 | pg_dump, COPY, physical backup, restore validation, scheduling |
| Schema | 10 | Schemas, sequences, views, functions, triggers |
| Vector | 14 | pgvector extension - similarity search, clustering, hybrid search |
| PostGIS | 12 | Geospatial operations - distance, transform, clustering, index optimization |
| Partitioning | 6 | Range/list/hash partitioning management |
| Cron | 8 | pg_cron extension - job scheduling, monitoring, cleanup |
| Partman | 10 | pg_partman extension - automated partition lifecycle management |
| Kcache | 7 | pg_stat_kcache extension - OS-level CPU/memory/I/O stats per query |
| Citext | 6 | citext extension - case-insensitive text for emails, usernames |
| Ltree | 8 | ltree extension - hierarchical tree labels for taxonomies, org charts |
| Pgcrypto | 9 | pgcrypto extension - hashing, encryption, password hashing, random UUIDs |

---

## 🎛️ Tool Filtering

> [!IMPORTANT]
> **AI-enabled IDEs have tool limits.** With 194 tools, you MUST use tool filtering to stay within your IDE's limits.

### Quick Start: Use Shortcuts

The easiest way to filter tools is with **shortcuts** — predefined groups for common use cases:

| Shortcut | Tools | Includes |
|----------|-------|----------|
| `starter` | **49** | **Recommended default** — queries, tables, JSONB, schema |
| `essential` | 39 | Minimal — queries, tables, JSONB only |
| `dev` | 68 | Development — adds text search and stats |
| `ai` | 80 | AI/ML — adds pgvector and performance tools |
| `dba` | 90 | Administration — monitoring, backup, maintenance |
| `base` | 120 | Everything except extensions |
| `extensions` | 74 | All PostgreSQL extensions |

**Recommended Configuration (~49 tools)**
```json
{
  "mcpServers": {
    "postgres-mcp": {
      "command": "node",
      "args": [
        "C:/path/to/postgres-mcp/dist/cli.js",
        "--postgres", "postgres://user:pass@localhost:5432/db",
        "--tool-filter", "-base,-extensions,+starter"
      ]
    }
  }
}
```

### Need More Tools?

Start with `starter` and add individual groups as needed:

**Add text search:**
```json
"--tool-filter", "-base,-extensions,+starter,+text"
```

**Add performance analysis (EXPLAIN, query stats):**
```json
"--tool-filter", "-base,-extensions,+starter,+performance"
```

**Add admin tools (VACUUM, ANALYZE, REINDEX):**
```json
"--tool-filter", "-base,-extensions,+starter,+admin"
```

**Use a larger shortcut instead:**
```json
"--tool-filter", "-base,-extensions,+dev"
```

### How Filtering Works

1. **All 194 tools start enabled** by default
2. Use `-` to exclude, `+` to include
3. Rules apply left-to-right, so order matters

**Syntax:**
- `-shortcut` — Exclude all tools in a shortcut
- `+shortcut` — Include all tools in a shortcut
- `-group` — Exclude a specific group
- `+group` — Include a specific group
- `-pg_tool_name` — Exclude one tool
- `+pg_tool_name` — Include one tool

### All Tool Groups (19 groups)

If you need fine-grained control, use individual groups:

| Group | Tools | Description |
|-------|-------|-------------|
| `core` | 13 | Read/write queries, tables, indexes |
| `transactions` | 7 | BEGIN, COMMIT, ROLLBACK, savepoints |
| `jsonb` | 19 | JSONB manipulation and queries |
| `text` | 11 | Full-text search, fuzzy matching |
| `performance` | 16 | EXPLAIN, query analysis, optimization |
| `admin` | 10 | VACUUM, ANALYZE, REINDEX |
| `monitoring` | 11 | Database sizes, connections, status |
| `backup` | 9 | pg_dump, COPY, restore |
| `schema` | 10 | Schemas, views, functions, triggers |
| `partitioning` | 6 | Native partition management |
| `stats` | 8 | Statistical analysis |
| `vector` | 14 | pgvector (AI/ML similarity search) |
| `postgis` | 12 | PostGIS (geospatial) |
| `cron` | 8 | pg_cron (job scheduling) |
| `partman` | 10 | pg_partman (auto-partitioning) |
| `kcache` | 7 | pg_stat_kcache (OS-level stats) |
| `citext` | 6 | citext (case-insensitive text) |
| `ltree` | 8 | ltree (hierarchical data) |
| `pgcrypto` | 9 | pgcrypto (encryption, UUIDs) |

---

## 🤖 AI-Powered Prompts

Prompts provide step-by-step guidance for complex database tasks. Instead of figuring out which tools to use and in what order, simply invoke a prompt and follow its workflow — great for learning PostgreSQL best practices or automating repetitive DBA tasks.

This server includes **19 intelligent prompts** for guided workflows:

| Prompt | Description |
|--------|-------------|
| `pg_query_builder` | Construct PostgreSQL queries with CTEs and window functions |
| `pg_schema_design` | Design normalized schemas with constraints and indexes |
| `pg_performance_analysis` | Analyze queries with EXPLAIN and optimization tips |
| `pg_migration` | Generate migration scripts with rollback support |
| `pg_tool_index` | Lazy hydration - compact index of all tools |
| `pg_quick_query` | Quick SQL query guidance for common operations |
| `pg_quick_schema` | Quick reference for exploring database schema |
| `pg_database_health_check` | Comprehensive database health assessment |
| `pg_backup_strategy` | Enterprise backup planning with RTO/RPO |
| `pg_index_tuning` | Index analysis and optimization workflow |
| `pg_extension_setup` | Extension installation and configuration guide |
| `pg_setup_pgvector` | Complete pgvector setup for semantic search |
| `pg_setup_postgis` | Complete PostGIS setup for geospatial operations |
| `pg_setup_pgcron` | Complete pg_cron setup for job scheduling |
| `pg_setup_partman` | Complete pg_partman setup for partition management |
| `pg_setup_kcache` | Complete pg_stat_kcache setup for OS-level monitoring |
| `pg_setup_citext` | Complete citext setup for case-insensitive text |
| `pg_setup_ltree` | Complete ltree setup for hierarchical data |
| `pg_setup_pgcrypto` | Complete pgcrypto setup for cryptographic functions |

---

## 📦 Resources

Resources give you instant snapshots of database state without writing queries. Perfect for quickly checking schema, health, or performance metrics — the AI can read these to understand your database context before suggesting changes.

This server provides **20 resources** for structured data access:

| Resource | URI | Description |
|----------|-----|-------------|
| Schema | `postgres://schema` | Full database schema |
| Tables | `postgres://tables` | Table listing with sizes |
| Settings | `postgres://settings` | PostgreSQL configuration |
| Statistics | `postgres://stats` | Database statistics with stale detection |
| Activity | `postgres://activity` | Current connections |
| Pool | `postgres://pool` | Connection pool status |
| Capabilities | `postgres://capabilities` | Server version, extensions, tool categories |
| Performance | `postgres://performance` | pg_stat_statements query metrics |
| Health | `postgres://health` | Comprehensive database health status |
| Extensions | `postgres://extensions` | Extension inventory with recommendations |
| Indexes | `postgres://indexes` | Index usage with unused detection |
| Replication | `postgres://replication` | Replication status and lag monitoring |
| Vacuum | `postgres://vacuum` | Vacuum stats and wraparound warnings |
| Locks | `postgres://locks` | Lock contention detection |
| Cron | `postgres://cron` | pg_cron job status and execution history |
| Partman | `postgres://partman` | pg_partman partition configuration and health |
| Kcache | `postgres://kcache` | pg_stat_kcache CPU/I/O metrics summary |
| Vector | `postgres://vector` | pgvector columns, indexes, and recommendations |
| PostGIS | `postgres://postgis` | PostGIS spatial columns and index status |
| Crypto | `postgres://crypto` | pgcrypto availability and security recommendations |

---

## 🔧 Extension Support

| Extension | Purpose | Tools |
|-----------|---------|-------|
| `pg_stat_statements` | Query performance tracking | `pg_stat_statements` |
| `pg_trgm` | Text similarity | `pg_trigram_similarity` |
| `fuzzystrmatch` | Fuzzy matching | `pg_fuzzy_match` |
| `hypopg` | Hypothetical indexes | `pg_index_recommendations` |
| `pgvector` | Vector similarity search | 14 vector tools |
| `PostGIS` | Geospatial operations | 12 postgis tools |
| `pg_cron` | Job scheduling | 8 cron tools |
| `pg_partman` | Automated partition management | 10 partman tools |
| `pg_stat_kcache` | OS-level CPU/memory/I/O stats | 7 kcache tools |
| `citext` | Case-insensitive text | 6 citext tools |
| `ltree` | Hierarchical tree labels | 8 ltree tools |
| `pgcrypto` | Hashing, encryption, UUIDs | 9 pgcrypto tools |

> Extension tools gracefully handle cases where extensions are not installed.

---

## 🔥 Core Capabilities

- 📊 **Full SQL Support** - Execute any PostgreSQL query with parameter binding
- 🔍 **JSONB Operations** - Native JSONB functions and path queries
- 🔐 **Connection Pooling** - Efficient connection management with health checks
- 🎛️ **Tool Filtering** - Control which operations are exposed
- ⚡ **Performance Tools** - EXPLAIN ANALYZE, buffer analysis, index hints
- 🗺️ **PostGIS Support** - Geospatial queries and spatial indexes
- 🧠 **pgvector Support** - AI/ML vector similarity search

### 🏢 Enterprise Features

- 🔐 **OAuth 2.0 Authentication** - RFC 9728/8414 compliant (coming soon)
- 🛡️ **Tool Filtering** - Control which database operations are exposed
- 📈 **Monitoring** - Process lists, replication lag, cache hit ratios

---

## 🏆 Why Choose postgres-mcp?

✅ **TypeScript Native** - Full type safety with strict mode  
✅ **154 Specialized Tools** - Comprehensive PostgreSQL coverage  
✅ **Connection Pooling** - Efficient PostgreSQL connection management  
✅ **Extension Support** - pgvector, PostGIS, pg_stat_statements, pg_cron  
✅ **Tool Filtering** - Stay within AI IDE tool limits  
✅ **Modern Architecture** - Built on MCP SDK  

---

## Development

```bash
# Clone and install
git clone https://github.com/neverinfamous/postgres-mcp.git
cd postgres-mcp
npm install

# Build
npm run build

# Run checks
npm run lint && npm run typecheck

# Test CLI
node dist/cli.js info
node dist/cli.js list-tools
```

---

## Contributing

Contributions are welcome! Please read our [Contributing Guidelines](CONTRIBUTING.md) before submitting a pull request.

## Security

For security concerns, please see our [Security Policy](SECURITY.md).

> **⚠️ Never commit credentials** - Store secrets in environment variables

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Code of Conduct

Please read our [Code of Conduct](CODE_OF_CONDUCT.md) before participating in this project.
