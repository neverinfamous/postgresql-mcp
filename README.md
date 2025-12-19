# postgres-mcp

<!-- mcp-name: io.github.neverinfamous/postgres-mcp -->

*Last updated December 18, 2025 - Initial Implementation Complete*

*Enterprise-grade PostgreSQL MCP Server with OAuth 2.1 authentication, code mode, connection pooling, tool filtering, plus support for citext, ltree, pgcrypto, pg_cron, pg_stat_kcache, pgvector, PostGIS, and advanced PostgreSQL features - TypeScript Edition*

> **✅ Under Development** - 195 tools, 21 resources, and 19 prompts.

[![GitHub](https://img.shields.io/badge/GitHub-neverinfamous/postgres--mcp-blue?logo=github)](https://github.com/neverinfamous/postgres-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)
[![MCP](https://img.shields.io/badge/MCP-Compatible-green.svg)](https://modelcontextprotocol.io/)
[![Tests](https://img.shields.io/badge/Tests-1554_passed-success.svg)](https://github.com/neverinfamous/postgres-mcp)
[![Coverage](https://img.shields.io/badge/Coverage-97.55%25-brightgreen.svg)](https://github.com/neverinfamous/postgres-mcp)

A **PostgreSQL MCP Server** that enables AI assistants (Claude, Cursor, etc.) to interact with PostgreSQL databases through the Model Context Protocol. Provides **195 specialized tools**, **21 resources**, and **19 AI-powered prompts**.

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
        "--tool-filter", "starter"
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
        "--tool-filter", "starter"
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

## 🧪 Code Mode

Code Mode lets you write JavaScript that orchestrates multiple database operations in a single call. Instead of calling tools one-by-one, write code that loops, aggregates, and transforms data.

### **Token Savings Estimate**

**Code Mode vs. Standard Method**

| Scenario                        | Standard (individual calls)                     | Code Mode                             | Savings |
| ------------------------------- | ----------------------------------------------- | ------------------------------------- | ------- |
| Get row counts for 10 tables    | ~10 tool calls × ~200 tokens = **2,000 tokens** | 1 call × ~300 tokens = **300 tokens** | **85%** |
| Find unused indexes + get sizes | ~20 calls = **4,000 tokens**                    | 1 call = **400 tokens**               | **90%** |
| Database health report          | ~15 calls = **3,000 tokens**                    | 1 call = **350 tokens**               | **88%** |

### **Estimated Average**

* **70–90% token reduction** for multi-step operations

### **Key Savings**

* Eliminates per-call overhead (tool name, description parsing)
* Reduces context window pollution from intermediate results
* Fewer round-trips means less “here’s what I’m going to do” explanations

### Quick Start

**No configuration changes required.** Add `codemode` to your tool filter to access `pg_execute_code`:

```json
{
  "args": ["--tool-filter", "starter,+codemode"]
}
```

### Example

```javascript
// Get row counts for all tables
const tables = await pg.core.listTables();
return Promise.all(tables.map(async t => ({
  table: t.name,
  rows: (await pg.performance.tableStats({ table: t.name })).row_count
})));
```

### Isolation Modes

| Mode | Isolation | When to Use |
|------|-----------|-------------|
| `vm` | Same process | Default, best performance |
| `worker` | Separate V8 thread | Enhanced security |

Set via environment variable:
```json
{ "env": { "CODEMODE_ISOLATION": "worker" } }
```

### Security

- Requires `admin` OAuth scope
- Blocked: `require()`, `process`, `eval()`, filesystem
- Rate limited: 60 executions/minute

📖 **Full documentation:** [docs/CODE_MODE.md](docs/CODE_MODE.md)

---

## 🛠️ Tool Filtering

> [!IMPORTANT]
> **AI IDEs like Cursor have tool limits (typically 40-50 tools).** With 195 tools available, you MUST use tool filtering to stay within your IDE's limits. We recommend `starter` (49 tools) as a starting point.

> [!TIP]
> **Code Mode:** Add `+codemode` to any shortcut to enable `pg_execute_code` (+1 tool). Example: `starter,+codemode` = 50 tools.

### What Can You Filter?

The `--tool-filter` argument accepts **shortcuts**, **groups**, or **tool names** — mix and match freely:

| Filter Pattern | Example | Tools | Description |
|----------------|---------|-------|-------------|
| Shortcut only | `starter` | 49 | Use a predefined bundle |
| Groups only | `core,jsonb,transactions` | 39 | Combine individual groups |
| Shortcut + Group | `starter,+text` | 60 | Extend a shortcut |
| Shortcut - Tool | `starter,-pg_drop_table` | 48 | Remove specific tools |

### Shortcuts (Predefined Bundles)

| Shortcut | Tools | Use Case | What's Included |
|----------|-------|----------|-----------------|
| `starter` | **49** | 🌟 **Recommended** | Core, trans, JSONB, schema |
| `essential` | 39 | Minimal footprint | Core, trans, JSONB |
| `dev-power` | 44 | Power Developer | Core, trans, schema, stats, part |
| `ai-data` | 50 | AI Data Analyst | Core, JSONB, text, trans |
| `ai-vector` | 40 | AI/ML with pgvector | Core, vector, trans, part |
| `dba-monitor` | 47 | DBA Monitoring | Core, monitoring, perf, trans |
| `dba-manage` | 48 | DBA Management | Core, admin, backup, part, schema |
| `dba-stats` | 49 | DBA Stats/Security | Core, admin, monitoring, trans, stats |
| `geo` | 32 | Geospatial Workloads | Core, PostGIS, trans |
| `base-core` | 49 | Base Building Block | Core, JSONB, trans, schema |
| `base-ops` | 50 | Operations Block | Admin, monitoring, backup, part, stats, citext |
| `ext-ai` | 23 | Extension: AI/Security | pgvector, pgcrypto |
| `ext-geo` | 20 | Extension: Spatial | PostGIS, ltree |
| `ext-schedule` | 18 | Extension: Scheduling | pg_cron, pg_partman |
| `ext-perf` | 23 | Extension: Perf/Analysis | pg_stat_kcache, performance |

### Tool Groups (20 Available)

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
| `codemode` | 1 | Code Mode (sandboxed code execution) |

---

### Quick Start: Recommended IDE Configuration

Add one of these configurations to your IDE's MCP settings file (e.g., `cline_mcp_settings.json`, `.cursorrules`, or equivalent):

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

| Prefix | Target | Example | Effect |
|--------|--------|---------|--------|
| *(none)* | Shortcut | `starter` | **Whitelist Mode:** Enable ONLY this shortcut |
| *(none)* | Group | `core` | **Whitelist Mode:** Enable ONLY this group |
| `+` | Group | `+vector` | Add tools from this group to current set |
| `-` | Group | `-admin` | Remove tools in this group from current set |
| `+` | Tool | `+pg_explain` | Add one specific tool |
| `-` | Tool | `-pg_drop_table` | Remove one specific tool |

**Legacy Syntax (still supported):**
If you start with a negative filter (e.g., `-base,-extensions`), it assumes you want to start with *all* tools enabled and then subtract.

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

| Scope | Access Level |
|-------|--------------|
| `read` | Read-only queries (SELECT, EXPLAIN) |
| `write` | Read + write operations |
| `admin` | Full administrative access |
| `full` | Grants all access |
| `db:{name}` | Access to specific database |
| `schema:{name}` | Access to specific schema |
| `table:{schema}:{table}` | Access to specific table |

### RFC Compliance

This implementation follows:
- **RFC 9728** — OAuth 2.0 Protected Resource Metadata
- **RFC 8414** — OAuth 2.0 Authorization Server Metadata
- **RFC 7591** — OAuth 2.0 Dynamic Client Registration

The server exposes metadata at `/.well-known/oauth-protected-resource`.

---

## ⚡ Performance Tuning

| Variable | Default | Description |
|----------|---------|-------------|
| `METADATA_CACHE_TTL_MS` | `30000` | Cache TTL for schema metadata (milliseconds) |
| `LOG_LEVEL` | `info` | Log verbosity: `debug`, `info`, `warning`, `error` |

> **Tip:** Lower `METADATA_CACHE_TTL_MS` for development (e.g., `5000`), or increase it for production with stable schemas (e.g., `300000` = 5 min).

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

This server provides **21 resources** for structured data access:

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
| Annotations | `postgres://annotations` | Tool behavior hints categorized by type |

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

## 🏷️ Tool Annotations

All 194 tools include **Tool Annotations** (MCP SDK 1.25+), providing UX hints to MCP clients about tool behavior:

| Annotation | Description | Example |
|------------|-------------|---------|
| `title` | Human-readable tool name | "Execute Query", "Create Index" |
| `readOnlyHint` | Tool doesn't modify data | `true` for SELECT queries |
| `destructiveHint` | Tool may delete/modify data | `true` for DROP, DELETE |
| `idempotentHint` | Safe to retry without side effects | `true` for IF NOT EXISTS |
| `openWorldHint` | Tool interacts with external systems | `false` for all tools |

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
✅ **194 Specialized Tools** - Comprehensive PostgreSQL coverage  
✅ **Tool Annotations** - UX hints for read-only, destructive, and idempotent operations  
✅ **Connection Pooling** - Efficient PostgreSQL connection management  
✅ **Extension Support** - pgvector, PostGIS, pg_stat_statements, pg_cron  
✅ **Tool Filtering** - Stay within AI IDE tool limits  
✅ **Modern Architecture** - Built on MCP SDK 1.25+  

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
