# postgres-mcp

**Last Updated January 24, 2026**

[![GitHub](https://img.shields.io/badge/GitHub-neverinfamous/postgres--mcp-blue?logo=github)](https://github.com/neverinfamous/postgres-mcp)
![GitHub Release](https://img.shields.io/github/v/release/neverinfamous/postgres-mcp)
[![Docker Pulls](https://img.shields.io/docker/pulls/writenotenow/postgres-mcp)](https://hub.docker.com/r/writenotenow/postgres-mcp)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![MCP](https://img.shields.io/badge/MCP-Compatible-green.svg)](https://modelcontextprotocol.io/)
![Status](https://img.shields.io/badge/status-Production%2FStable-brightgreen)
[![npm](https://img.shields.io/npm/v/@neverinfamous/postgres-mcp)](https://www.npmjs.com/package/@neverinfamous/postgres-mcp)
[![Security](https://img.shields.io/badge/Security-Enhanced-green.svg)](https://github.com/neverinfamous/postgres-mcp/blob/master/SECURITY.md)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-blue.svg)](https://github.com/neverinfamous/postgres-mcp)

**PostgreSQL MCP Server** enabling AI assistants (AntiGravity, Claude, Cursor, etc.) to interact with PostgreSQL databases through the Model Context Protocol. Features connection pooling, HTTP/SSE Transport, OAuth 2.1 authentication, Code Mode, tool filtering, and extension support for citext, ltree, pgcrypto, pg_cron, pg_stat_kcache, pgvector, PostGIS, and HypoPG.

**[GitHub](https://github.com/neverinfamous/postgres-mcp)** • **[npm Package](https://www.npmjs.com/package/@neverinfamous/postgres-mcp)** • **[MCP Registry](https://registry.modelcontextprotocol.io/v0/servers?search=io.github.neverinfamous/postgres-mcp)**

## 🎯 What This Does

### Key Benefits

- 🔧 **203 specialized tools** — Comprehensive PostgreSQL coverage
- 📊 **20 resources** — Instant database state snapshots
- 🤖 **19 AI-powered prompts** — Guided workflows for complex tasks
- ⚡ **Code Mode** — 70-90% token reduction for multi-step operations
- 🔐 **OAuth 2.1** — RFC-compliant authentication for HTTP/SSE transport
- 🎛️ **Tool Filtering** — Stay within AI IDE tool limits

### Deployment Options

- **[Docker Hub](https://hub.docker.com/r/writenotenow/postgres-mcp)** - Node.js Alpine-based multi-platform support
- **[npm Package](https://www.npmjs.com/package/@neverinfamous/postgres-mcp)** - Simple `npm install -g` for local deployment
- **[MCP Registry](https://registry.modelcontextprotocol.io/v0/servers?search=io.github.neverinfamous/postgres-mcp)**

### Extension Support

| Extension            | Purpose                        |
| -------------------- | ------------------------------ |
| `pg_stat_statements` | Query performance tracking     |
| `pgvector`           | Vector similarity search       |
| `PostGIS`            | Geospatial operations          |
| `pg_cron`            | Job scheduling                 |
| `pg_partman`         | Automated partition management |
| `pg_stat_kcache`     | OS-level CPU/memory/I/O stats  |
| `citext`             | Case-insensitive text          |
| `ltree`              | Hierarchical tree labels       |
| `pgcrypto`           | Hashing, encryption, UUIDs     |

---

## 🚀 Quick Start (2 Minutes)

### 1. Pull the Image

```bash
docker pull writenotenow/postgres-mcp:latest
```

### 2. Add to MCP Config

Add this to your `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "postgres-mcp": {
      "command": "docker",
      "args": [
        "run",
        "--rm",
        "-i",
        "-e",
        "POSTGRES_HOST",
        "-e",
        "POSTGRES_PORT",
        "-e",
        "POSTGRES_USER",
        "-e",
        "POSTGRES_PASSWORD",
        "-e",
        "POSTGRES_DATABASE",
        "writenotenow/postgres-mcp:latest",
        "--tool-filter",
        "starter"
      ],
      "env": {
        "POSTGRES_HOST": "host.docker.internal",
        "POSTGRES_PORT": "5432",
        "POSTGRES_USER": "your_username",
        "POSTGRES_PASSWORD": "your_password",
        "POSTGRES_DATABASE": "your_database"
      }
    }
  }
}
```

### 3. Restart & Query!

Restart Cursor or your MCP client and start querying PostgreSQL!

> **Note for Docker**: Use `host.docker.internal` to connect to PostgreSQL running on your host machine.

---

## ⚡ Install to Cursor IDE

### One-Click Installation

Click the button below to install directly into Cursor:

[![Install to Cursor](https://img.shields.io/badge/Install%20to%20Cursor-Click%20Here-blue?style=for-the-badge)](cursor://anysphere.cursor-deeplink/mcp/install?name=PostgreSQL%20MCP&config=eyJwb3N0Z3Jlcy1tY3AiOnsiYXJncyI6WyJydW4iLCItLXJtIiwiLWkiLCItZSIsIlBPU1RHUkVTX0hPU1QiLCItZSIsIlBPU1RHUkVTX1BPUlQiLCItZSIsIlBPU1RHUkVTX1VTRVIiLCItZSIsIlBPU1RHUkVTX1BBU1NXT1JEIiwiLWUiLCJQT1NUR1JFU19EQVRBQkFTRSIsIndyaXRlbm90ZW5vdy9wb3N0Z3Jlcy1tY3A6bGF0ZXN0IiwiLS10b29sLWZpbHRlciIsInN0YXJ0ZXIiXSwiY29tbWFuZCI6ImRvY2tlciIsImVudiI6eyJQT1NUR1JFU19IT1NUIjoibG9jYWxob3N0IiwiUE9TVEdSRVNfUE9SVCI6IjU0MzIiLCJQT1NUR1JFU19VU0VSIjoieW91cl91c2VybmFtZSIsIlBPU1RHUkVTX1BBU1NXT1JEIjoieW91cl9wYXNzd29yZCIsIlBPU1RHUkVTX0RBVEFCQVNFIjoieW91cl9kYXRhYmFzZSJ9fX0=)

### Prerequisites

- ✅ Docker installed and running
- ✅ PostgreSQL database accessible

**📖 [See Full Installation Guide →](https://github.com/neverinfamous/postgres-mcp#readme)**

---

## 🔧 Configuration

### Environment Variables

```bash
# PostgreSQL Connection (required)
-e POSTGRES_HOST=localhost
-e POSTGRES_PORT=5432
-e POSTGRES_USER=your_user
-e POSTGRES_PASSWORD=your_password
-e POSTGRES_DATABASE=your_database

# Or use a connection string
-e POSTGRES_URL=postgres://user:pass@host:5432/database

# Performance (optional)
-e METADATA_CACHE_TTL_MS=30000  # Schema cache TTL, default 30s
-e LOG_LEVEL=info               # debug, info, warning, error
```

### Tool Filtering

Control which tools are exposed using `--tool-filter`:

```json
{
  "args": [
    "...",
    "--tool-filter",
    "starter"
  ]
}
```

**Available Shortcuts:**

| Shortcut      | Tools  | Use Case                 |
| ------------- | ------ | ------------------------ |
| `starter`     | **58** | 🌟 **Recommended**       |
| `essential`   | 46     | Minimal footprint        |
| `dev-power`   | 53     | Power Developer          |
| `ai-data`     | 59     | AI Data Analyst          |
| `ai-vector`   | 47     | AI/ML with pgvector      |
| `dba-monitor` | 58     | DBA Monitoring           |
| `geo`         | 42     | Geospatial Workloads     |

**[Complete tool filtering guide →](https://github.com/neverinfamous/postgres-mcp#-tool-filtering)**

---

## 🌐 HTTP/SSE Transport (Remote Access)

For remote access, web-based clients, or HTTP-compatible MCP hosts:

```bash
docker run --rm -p 3000:3000 \
  -e POSTGRES_URL=postgres://user:pass@host:5432/db \
  writenotenow/postgres-mcp:latest \
  --transport http --port 3000
```

**With OAuth 2.1:**

```bash
docker run --rm -p 3000:3000 \
  -e POSTGRES_URL=postgres://user:pass@host:5432/db \
  -e OAUTH_ENABLED=true \
  -e OAUTH_ISSUER=http://keycloak:8080/realms/postgres-mcp \
  -e OAUTH_AUDIENCE=postgres-mcp-client \
  writenotenow/postgres-mcp:latest \
  --transport http --port 3000
```

**Endpoints:**

- `POST /mcp` — JSON-RPC requests
- `GET /mcp` — SSE stream for notifications
- `DELETE /mcp` — Session termination
- `GET /health` — Health check

---

## 🛡️ Supply Chain Security

For enhanced security and reproducible builds, use SHA-pinned images:

**Find SHA tags:** https://hub.docker.com/r/writenotenow/postgres-mcp/tags

**Option 1: Multi-arch manifest (recommended)**

```bash
docker pull writenotenow/postgres-mcp:sha256-<manifest-digest>
```

**Option 2: Direct digest (maximum security)**

```bash
docker pull writenotenow/postgres-mcp@sha256:<manifest-digest>
```

**Security Features:**

- ✅ **Build Provenance** - Cryptographic proof of build process
- ✅ **SBOM Available** - Complete software bill of materials
- ✅ **Supply Chain Attestations** - Verifiable build integrity
- ✅ **Non-root Execution** - Minimal attack surface
- ✅ **No Native Dependencies** - Pure JS stack reduces attack surface

---

## 📦 Image Details

| Platform                  | Features                           |
| ------------------------- | ---------------------------------- |
| **AMD64** (x86_64)        | Complete: all tools, OAuth, Code Mode |
| **ARM64** (Apple Silicon) | Complete: all tools, OAuth, Code Mode |

**TypeScript Image Benefits:**

- **Node.js 24 on Alpine Linux** - Minimal footprint (~80MB compressed)
- **Pure JS Stack** - No native compilation, identical features on all platforms
- **pg driver** - Native PostgreSQL protocol support
- **Instant Startup** - No ML model loading required
- **Production/Stable** - Comprehensive error handling

**Available Tags:**

- `1.0.0` - Specific version (recommended for production)
- `latest` - Always the newest version
- `sha256-<digest>` - SHA-pinned for maximum security

---

## 🏗️ Build from Source

**Step 1: Clone the repository**

```bash
git clone https://github.com/neverinfamous/postgres-mcp.git
cd postgres-mcp
```

**Step 2: Build the Docker image**

```bash
docker build -f Dockerfile -t postgres-mcp-local .
```

**Step 3: Add to MCP config**

Update your `~/.cursor/mcp.json` to use the local build:

```json
{
  "mcpServers": {
    "postgres-mcp": {
      "command": "docker",
      "args": [
        "run",
        "--rm",
        "-i",
        "-e",
        "POSTGRES_URL",
        "postgres-mcp-local",
        "--tool-filter",
        "starter"
      ],
      "env": {
        "POSTGRES_URL": "postgres://user:pass@host.docker.internal:5432/database"
      }
    }
  }
}
```

---

## 📚 Documentation & Resources

- **[GitHub Repository](https://github.com/neverinfamous/postgres-mcp)** - Source code & full documentation
- **[npm Package](https://www.npmjs.com/package/@neverinfamous/postgres-mcp)** - Node.js distribution
- **[Issues](https://github.com/neverinfamous/postgres-mcp/issues)** - Bug reports & feature requests

---

## 📄 License

MIT License - See [LICENSE](https://github.com/neverinfamous/postgres-mcp/blob/master/LICENSE)
