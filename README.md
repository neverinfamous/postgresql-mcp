# postgresql-mcp

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue.svg)](https://www.typescriptlang.org/)
[![MCP](https://img.shields.io/badge/MCP-Compatible-green.svg)](https://modelcontextprotocol.io/)

PostgreSQL MCP server with connection pooling, tool filtering, and full extension support.

## Features

- **Full PostgreSQL Support** - 100% coverage of PostgreSQL features
- **Connection Pooling** - Built-in connection pool management
- **Tool Filtering** - Filter tools by category or custom patterns
- **Extension Support** - PostGIS, pgvector, pg_stat_statements, and more
- **Code Mode** - TypeScript implementation with strict typing

## Quick Start

```bash
# Install
npm install -g postgresql-mcp

# Run with connection string
postgresql-mcp --postgres postgres://user:password@localhost:5432/database
```

## MCP Client Configuration

### Claude Desktop / Cursor

```json
{
  "mcpServers": {
    "postgres": {
      "command": "npx",
      "args": ["-y", "postgresql-mcp", "--postgres", "postgres://user:password@localhost:5432/database"]
    }
  }
}
```

## Tool Categories

| Category | Tools | Description |
|----------|-------|-------------|
| Core Database | TBD | Schema, SQL execution, health |
| JSON Operations | TBD | JSONB operations, validation |
| Text Processing | TBD | Similarity, full-text, fuzzy |
| Statistical Analysis | TBD | Stats, correlation, regression |
| Performance | TBD | Query optimization, index tuning |
| Vector/Semantic | TBD | pgvector integration |
| Geospatial | TBD | PostGIS operations |
| Backup & Recovery | TBD | Backup planning, restore |
| Monitoring | TBD | Real-time monitoring, alerting |

## Extension Support

| Extension | Purpose |
|-----------|---------|
| `pg_stat_statements` | Query performance tracking |
| `pg_trgm` | Text similarity |
| `fuzzystrmatch` | Fuzzy matching |
| `hypopg` | Hypothetical indexes |
| `pgvector` | Vector similarity search |
| `PostGIS` | Geospatial operations |

## Development

```bash
# Clone and install
git clone https://github.com/neverinfamous/postgresql-mcp.git
cd postgresql-mcp
npm install

# Build
npm run build

# Run checks
npm run check
```

## License

MIT License - see [LICENSE](LICENSE) for details.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines.
