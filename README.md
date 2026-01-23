# postgres-mcp

<!-- mcp-name: io.github.neverinfamous/postgres-mcp -->

**Last updated January 22, 2026**

**PostgreSQL MCP Server** enabling AI assistants (AntiGravity, Claude, Cursor, etc.) to interact with PostgreSQL databases through the Model Context Protocol. Provides **202 specialized tools**, **20 resources**, and **19 AI-powered prompts** and includes OAuth 2.1 authentication, code mode, connection pooling, tool filtering, plus support for citext, ltree, pgcrypto, pg_cron, pg_stat_kcache, pgvector, PostGIS, HypoPG, and advanced PostgreSQL features.

> **✅ Under Development** - 202 tools, 20 resources, and 19 prompts.

[![GitHub](https://img.shields.io/badge/GitHub-neverinfamous/postgres--mcp-blue?logo=github)](https://github.com/neverinfamous/postgres-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)
[![MCP](https://img.shields.io/badge/MCP-Compatible-green.svg)](https://modelcontextprotocol.io/)
[![Tests](https://img.shields.io/badge/Tests-1768_passed-success.svg)](https://github.com/neverinfamous/postgres-mcp)
[![Coverage](https://img.shields.io/badge/Coverage-97.55%25-brightgreen.svg)](https://github.com/neverinfamous/postgres-mcp)

---

## 🚀 Quick Start

### Prerequisites

- Node.js 24+ (LTS)
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

## ⚡ MCP Client Configuration

### Cursor IDE / Claude Desktop

```json
{
  "mcpServers": {
    "postgres-mcp": {
      "command": "node",
      "args": [
        "C:/path/to/postgres-mcp/dist/cli.js",
        "--postgres",
        "postgres://user:password@localhost:5432/database",
        "--tool-filter",
        "starter"
      ]
    }
  }
}
```

> [!TIP]
> The `starter` shortcut provides 58 tools including **Code Mode** for token-efficient operations. All presets include Code Mode by default. See [Tool Filtering](#-tool-filtering) to customize.

### Using Environment Variables (Recommended)

```json
{
  "mcpServers": {
    "postgres-mcp": {
      "command": "node",
      "args": [
        "C:/path/to/postgres-mcp/dist/cli.js",
        "--tool-filter",
        "starter"
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

| Scenario                       | Host to Use                           | Example Connection String                         |
| ------------------------------ | ------------------------------------- | ------------------------------------------------- |
| **PostgreSQL on host machine** | `localhost` or `host.docker.internal` | `postgres://user:pass@localhost:5432/db`          |
| **PostgreSQL in Docker**       | Container name or network             | `postgres://user:pass@postgres-container:5432/db` |
| **Remote/Cloud PostgreSQL**    | Hostname or IP                        | `postgres://user:pass@db.example.com:5432/db`     |

| Provider           | Example Hostname                                 |
| ------------------ | ------------------------------------------------ |
| AWS RDS PostgreSQL | `your-instance.xxxx.us-east-1.rds.amazonaws.com` |
| Google Cloud SQL   | `project:region:instance` (via Cloud SQL Proxy)  |
| Azure PostgreSQL   | `your-server.postgres.database.azure.com`        |
| Supabase           | `db.xxxx.supabase.co`                            |
| Neon               | `ep-xxx.us-east-1.aws.neon.tech`                 |

---

## Code Mode: Maximum Efficiency

Code Mode (`pg_execute_code`) dramatically reduces token usage (70–90%) and is included by default in all presets.

#### Disabling Code Mode (Non-Admin Users)

If you don't have admin access or prefer individual tool calls, exclude codemode:

```json
{
  "args": ["--tool-filter", "starter,-codemode"]
}
```

### Isolation Modes

| Mode     | Isolation          | When to Use                  |
| -------- | ------------------ | ---------------------------- |
| `vm`     | Same process       | **Default, recommended**     |
| `worker` | Separate V8 thread | Not recommended (incomplete) |

The `vm` mode is fully functional and is the default. No configuration needed.

### Security

- Requires `admin` OAuth scope
- Blocked: `require()`, `process`, `eval()`, filesystem
- Rate limited: 60 executions/minute

📖 **Full documentation:** [docs/CODE_MODE.md](docs/CODE_MODE.md)

---

## 🛠️ Tool Filtering

> [!IMPORTANT]
> AI IDEs like Cursor have tool limits. With 203 tools available, you MUST use tool filtering to stay within your IDE's limits. We recommend `starter` (58 tools) as a starting point. Code Mode is included in all presets by default for 70-90% token savings on multi-step operations.

### What Can You Filter?

The `--tool-filter` argument accepts **shortcuts**, **groups**, or **tool names** — mix and match freely:

| Filter Pattern   | Example                   | Tools | Description               |
| ---------------- | ------------------------- | ----- | ------------------------- |
| Shortcut only    | `starter`                 | 58    | Use a predefined bundle   |
| Groups only      | `core,jsonb,transactions` | 45    | Combine individual groups |
| Shortcut + Group | `starter,+text`           | 69    | Extend a shortcut         |
| Shortcut - Tool  | `starter,-pg_drop_table`  | 57    | Remove specific tools     |

All shortcuts and tool groups include **Code Mode** (`pg_execute_code`) by default for token-efficient operations. To exclude it, add `-codemode` to your filter: `--tool-filter cron,pgcrypto,-codemode`

### Shortcuts (Predefined Bundles)

| Shortcut       | Tools  | Use Case                 | What's Included                                          |
| -------------- | ------ | ------------------------ | -------------------------------------------------------- |
| `starter`      | **58** | 🌟 **Recommended**       | Core, trans, JSONB, schema, codemode                     |
| `essential`    | 46     | Minimal footprint        | Core, trans, JSONB, codemode                             |
| `dev-power`    | 53     | Power Developer          | Core, trans, schema, stats, part, codemode               |
| `ai-data`      | 59     | AI Data Analyst          | Core, JSONB, text, trans, codemode                       |
| `ai-vector`    | 47     | AI/ML with pgvector      | Core, vector, trans, part, codemode                      |
| `dba-monitor`  | 58     | DBA Monitoring           | Core, monitoring, perf, trans, codemode                  |
| `dba-manage`   | 57     | DBA Management           | Core, admin, backup, part, schema, codemode              |
| `dba-stats`    | 56     | DBA Stats/Security       | Core, admin, monitoring, trans, stats, codemode          |
| `geo`          | 42     | Geospatial Workloads     | Core, PostGIS, trans, codemode                           |
| `base-core`    | 58     | Base Building Block      | Core, JSONB, trans, schema, codemode                     |
| `base-ops`     | 51     | Operations Block         | Admin, monitoring, backup, part, stats, citext, codemode |
| `ext-ai`       | 24     | Extension: AI/Security   | pgvector, pgcrypto, codemode                             |
| `ext-geo`      | 24     | Extension: Spatial       | PostGIS, ltree, codemode                                 |
| `ext-schedule` | 19     | Extension: Scheduling    | pg_cron, pg_partman, codemode                            |
| `ext-perf`     | 28     | Extension: Perf/Analysis | pg_stat_kcache, performance, codemode                    |

### Tool Groups (20 Available)

| Group          | Tools | Description                                                 |
| -------------- | ----- | ----------------------------------------------------------- |
| `core`         | 20    | Read/write queries, tables, indexes, convenience/drop tools |
| `transactions` | 8     | BEGIN, COMMIT, ROLLBACK, savepoints                         |
| `jsonb`        | 20    | JSONB manipulation and queries                              |
| `text`         | 14    | Full-text search, fuzzy matching                            |
| `performance`  | 21    | EXPLAIN, query analysis, optimization                       |
| `admin`        | 11    | VACUUM, ANALYZE, REINDEX                                    |
| `monitoring`   | 12    | Database sizes, connections, status                         |
| `backup`       | 10    | pg_dump, COPY, restore                                      |
| `schema`       | 13    | Schemas, views, sequences, functions, triggers              |
| `partitioning` | 7     | Native partition management                                 |
| `stats`        | 9     | Statistical analysis                                        |
| `vector`       | 15    | pgvector (AI/ML similarity search)                          |
| `postgis`      | 16    | PostGIS (geospatial)                                        |
| `cron`         | 9     | pg_cron (job scheduling)                                    |
| `partman`      | 11    | pg_partman (auto-partitioning)                              |
| `kcache`       | 8     | pg_stat_kcache (OS-level stats)                             |
| `citext`       | 7     | citext (case-insensitive text)                              |
| `ltree`        | 9     | ltree (hierarchical data)                                   |
| `pgcrypto`     | 10    | pgcrypto (encryption, UUIDs)                                |
| `codemode`     | 1     | Code Mode (sandboxed code execution)                        |

---

### Quick Start: Recommended IDE Configuration

Add one of these configurations to your IDE's MCP settings file:

#### Option 1: Starter (49 Essential Tools)

**Best for:** General PostgreSQL database work - CRUD operations, JSONB, schema management.

```json
{
  "mcpServers": {
    "postgres-mcp": {
      "command": "node",
      "args": [
        "/path/to/postgres-mcp/dist/cli.js",
        "--transport",
        "stdio",
        "--tool-filter",
        "starter"
      ],
      "env": {
        "POSTGRES_HOST": "localhost",
        "POSTGRES_PORT": "5432",
        "POSTGRES_USER": "your_username",
        "POSTGRES_PASSWORD": "your_password",
        "POSTGRES_DATABASE": "your_database"
      }
    }
  }
}
```

#### Option 2: AI Vector (46 Tools + pgvector)

**Best for:** AI/ML workloads with semantic search and vector similarity.

> **⚠️ Prerequisites:** Requires pgvector extension installed in your PostgreSQL database.

```json
{
  "mcpServers": {
    "postgres-mcp-ai": {
      "command": "node",
      "args": [
        "/path/to/postgres-mcp/dist/cli.js",
        "--transport",
        "stdio",
        "--tool-filter",
        "ai-vector"
      ],
      "env": {
        "POSTGRES_HOST": "localhost",
        "POSTGRES_PORT": "5432",
        "POSTGRES_USER": "your_username",
        "POSTGRES_PASSWORD": "your_password",
        "POSTGRES_DATABASE": "your_database"
      }
    }
  }
}
```

**Customization Notes:**

- Replace `/path/to/postgres-mcp/` with your actual installation path
- Update credentials (`your_username`, `your_password`, etc.) with your PostgreSQL credentials
- For Windows: Use forward slashes in paths (e.g., `C:/postgres-mcp/dist/cli.js`) or escape backslashes (`C:\\postgres-mcp\\dist\\cli.js`)
- **Extension tools** gracefully handle cases where extensions are not installed

---

### Syntax Reference

| Prefix   | Target   | Example          | Effect                                        |
| -------- | -------- | ---------------- | --------------------------------------------- |
| _(none)_ | Shortcut | `starter`        | **Whitelist Mode:** Enable ONLY this shortcut |
| _(none)_ | Group    | `core`           | **Whitelist Mode:** Enable ONLY this group    |
| `+`      | Group    | `+vector`        | Add tools from this group to current set      |
| `-`      | Group    | `-admin`         | Remove tools in this group from current set   |
| `+`      | Tool     | `+pg_explain`    | Add one specific tool                         |
| `-`      | Tool     | `-pg_drop_table` | Remove one specific tool                      |

**Legacy Syntax (still supported):**
If you start with a negative filter (e.g., `-base,-extensions`), it assumes you want to start with _all_ tools enabled and then subtract.

---

## 🔐 OAuth 2.1 Authentication

When using HTTP/SSE transport, oauth 2.1 authentication can protect your MCP endpoints.

### Configuration

**CLI Options:**

```bash
node dist/cli.js \
  --transport http \
  --port 3000 \
  --oauth-enabled \
  --oauth-issuer http://localhost:8080/realms/db-mcp \
  --oauth-audience postgres-mcp
```

**Environment Variables:**

```bash
# Required
OAUTH_ENABLED=true
OAUTH_ISSUER=http://localhost:8080/realms/db-mcp
OAUTH_AUDIENCE=postgres-mcp

# Optional (auto-discovered from issuer)
OAUTH_JWKS_URI=http://localhost:8080/realms/db-mcp/protocol/openid-connect/certs
OAUTH_CLOCK_TOLERANCE=60
```

### OAuth Scopes

Access control is managed through OAuth scopes:

| Scope                    | Access Level                        |
| ------------------------ | ----------------------------------- |
| `read`                   | Read-only queries (SELECT, EXPLAIN) |
| `write`                  | Read + write operations             |
| `admin`                  | Full administrative access          |
| `full`                   | Grants all access                   |
| `db:{name}`              | Access to specific database         |
| `schema:{name}`          | Access to specific schema           |
| `table:{schema}:{table}` | Access to specific table            |

### RFC Compliance

This implementation follows:

- **RFC 9728** — OAuth 2.0 Protected Resource Metadata
- **RFC 8414** — OAuth 2.0 Authorization Server Metadata
- **RFC 7591** — OAuth 2.0 Dynamic Client Registration

The server exposes metadata at `/.well-known/oauth-protected-resource`.

---

## ⚡ Performance Tuning

| Variable                | Default | Description                                        |
| ----------------------- | ------- | -------------------------------------------------- |
| `METADATA_CACHE_TTL_MS` | `30000` | Cache TTL for schema metadata (milliseconds)       |
| `LOG_LEVEL`             | `info`  | Log verbosity: `debug`, `info`, `warning`, `error` |

> **Tip:** Lower `METADATA_CACHE_TTL_MS` for development (e.g., `5000`), or increase it for production with stable schemas (e.g., `300000` = 5 min).

---

## 🤖 AI-Powered Prompts

Prompts provide step-by-step guidance for complex database tasks. Instead of figuring out which tools to use and in what order, simply invoke a prompt and follow its workflow — great for learning PostgreSQL best practices or automating repetitive DBA tasks.

This server includes **19 intelligent prompts** for guided workflows:

| Prompt                     | Description                                                 |
| -------------------------- | ----------------------------------------------------------- |
| `pg_query_builder`         | Construct PostgreSQL queries with CTEs and window functions |
| `pg_schema_design`         | Design normalized schemas with constraints and indexes      |
| `pg_performance_analysis`  | Analyze queries with EXPLAIN and optimization tips          |
| `pg_migration`             | Generate migration scripts with rollback support            |
| `pg_tool_index`            | Lazy hydration - compact index of all tools                 |
| `pg_quick_query`           | Quick SQL query guidance for common operations              |
| `pg_quick_schema`          | Quick reference for exploring database schema               |
| `pg_database_health_check` | Comprehensive database health assessment                    |
| `pg_backup_strategy`       | Enterprise backup planning with RTO/RPO                     |
| `pg_index_tuning`          | Index analysis and optimization workflow                    |
| `pg_extension_setup`       | Extension installation and configuration guide              |
| `pg_setup_pgvector`        | Complete pgvector setup for semantic search                 |
| `pg_setup_postgis`         | Complete PostGIS setup for geospatial operations            |
| `pg_setup_pgcron`          | Complete pg_cron setup for job scheduling                   |
| `pg_setup_partman`         | Complete pg_partman setup for partition management          |
| `pg_setup_kcache`          | Complete pg_stat_kcache setup for OS-level monitoring       |
| `pg_setup_citext`          | Complete citext setup for case-insensitive text             |
| `pg_setup_ltree`           | Complete ltree setup for hierarchical data                  |
| `pg_setup_pgcrypto`        | Complete pgcrypto setup for cryptographic functions         |

---

## 📦 Resources

Resources give you instant snapshots of database state without writing queries. Perfect for quickly checking schema, health, or performance metrics — the AI can read these to understand your database context before suggesting changes.

This server provides **20 resources** for structured data access:

| Resource     | URI                       | Description                                        |
| ------------ | ------------------------- | -------------------------------------------------- |
| Schema       | `postgres://schema`       | Full database schema                               |
| Tables       | `postgres://tables`       | Table listing with sizes                           |
| Settings     | `postgres://settings`     | PostgreSQL configuration                           |
| Statistics   | `postgres://stats`        | Database statistics with stale detection           |
| Activity     | `postgres://activity`     | Current connections                                |
| Pool         | `postgres://pool`         | Connection pool status                             |
| Capabilities | `postgres://capabilities` | Server version, extensions, tool categories        |
| Performance  | `postgres://performance`  | pg_stat_statements query metrics                   |
| Health       | `postgres://health`       | Comprehensive database health status               |
| Extensions   | `postgres://extensions`   | Extension inventory with recommendations           |
| Indexes      | `postgres://indexes`      | Index usage with unused detection                  |
| Replication  | `postgres://replication`  | Replication status and lag monitoring              |
| Vacuum       | `postgres://vacuum`       | Vacuum stats and wraparound warnings               |
| Locks        | `postgres://locks`        | Lock contention detection                          |
| Cron         | `postgres://cron`         | pg_cron job status and execution history           |
| Partman      | `postgres://partman`      | pg_partman partition configuration and health      |
| Kcache       | `postgres://kcache`       | pg_stat_kcache CPU/I/O metrics summary             |
| Vector       | `postgres://vector`       | pgvector columns, indexes, and recommendations     |
| PostGIS      | `postgres://postgis`      | PostGIS spatial columns and index status           |
| Crypto       | `postgres://crypto`       | pgcrypto availability and security recommendations |

---

## 🔧 Extension Support

| Extension            | Purpose                        | Tools                      |
| -------------------- | ------------------------------ | -------------------------- |
| `pg_stat_statements` | Query performance tracking     | `pg_stat_statements`       |
| `pg_trgm`            | Text similarity                | `pg_trigram_similarity`    |
| `fuzzystrmatch`      | Fuzzy matching                 | `pg_fuzzy_match`           |
| `hypopg`             | Hypothetical indexes           | `pg_index_recommendations` |
| `pgvector`           | Vector similarity search       | 14 vector tools            |
| `PostGIS`            | Geospatial operations          | 15 postgis tools           |
| `pg_cron`            | Job scheduling                 | 8 cron tools               |
| `pg_partman`         | Automated partition management | 10 partman tools           |
| `pg_stat_kcache`     | OS-level CPU/memory/I/O stats  | 7 kcache tools             |
| `citext`             | Case-insensitive text          | 6 citext tools             |
| `ltree`              | Hierarchical tree labels       | 8 ltree tools              |
| `pgcrypto`           | Hashing, encryption, UUIDs     | 9 pgcrypto tools           |

> Extension tools gracefully handle cases where extensions are not installed.

---

## 🏷️ Tool Annotations

All 199 tools include **Tool Annotations** (MCP SDK 1.25+), providing UX hints to MCP clients about tool behavior:

| Annotation        | Description                          | Example                         |
| ----------------- | ------------------------------------ | ------------------------------- |
| `title`           | Human-readable tool name             | "Execute Query", "Create Index" |
| `readOnlyHint`    | Tool doesn't modify data             | `true` for SELECT queries       |
| `destructiveHint` | Tool may delete/modify data          | `true` for DROP, DELETE         |
| `idempotentHint`  | Safe to retry without side effects   | `true` for IF NOT EXISTS        |
| `openWorldHint`   | Tool interacts with external systems | `false` for all tools           |

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

- 🔐 **OAuth 2.1 Authentication** - RFC 9728/8414 compliant
- 🛡️ **Tool Filtering** - Control which database operations are exposed
- 📈 **Monitoring** - Process lists, replication lag, cache hit ratios

---

## 🏆 Why Choose postgres-mcp?

✅ **TypeScript Native** - Full type safety with strict mode  
✅ **199 Specialized Tools** - Comprehensive PostgreSQL coverage  
✅ **Tool Annotations** - UX hints for read-only, destructive, and idempotent operations  
✅ **Connection Pooling** - Efficient PostgreSQL connection management  
✅ **Extension Support** - pgvector, PostGIS, pg_stat_statements, pg_cron  
✅ **Tool Filtering** - Stay within AI IDE tool limits  
✅ **Modern Architecture** - Built on MCP SDK 1.25+

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
