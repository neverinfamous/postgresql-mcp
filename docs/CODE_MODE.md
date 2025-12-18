# Code Mode

Code Mode enables LLM-generated code execution in a sandboxed environment with access to all PostgreSQL tools via the `pg.*` API.

## Overview

Instead of calling individual tools sequentially, Code Mode allows you to write JavaScript/TypeScript that orchestrates multiple tool calls, aggregates results, and returns complex data structures in a single execution.

## The `pg_execute_code` Tool

```typescript
// Tool input
{
  code: string;       // JavaScript/TypeScript code to execute
  readonly?: boolean; // Optional: restrict to read-only operations
}
```

## API Reference

All tools are accessible via `pg.{group}.{methodName}()` where the method name is the camelCase version of the tool name without the `pg_` prefix.

| Group | Methods | Examples |
|-------|---------|----------|
| `pg.core` | 13 | `listTables()`, `readQuery()`, `describeTable()` |
| `pg.transactions` | 7 | `transactionBegin()`, `transactionCommit()` |
| `pg.jsonb` | 19 | `pathQuery()`, `set()`, `arrayAppend()` |
| `pg.text` | 11 | `search()`, `fuzzyMatch()`, `highlight()` |
| `pg.performance` | 16 | `explain()`, `tableStats()`, `indexUsage()` |
| `pg.admin` | 10 | `vacuum()`, `analyze()`, `reindex()` |
| `pg.monitoring` | 11 | `tableSizes()`, `activeConnections()` |
| `pg.backup` | 9 | `export()`, `copyToFile()` |
| `pg.schema` | 10 | `createSchema()`, `createView()` |
| `pg.vector` | 14 | `similaritySearch()`, `createIndex()` |
| `pg.postgis` | 12 | `stDistance()`, `stBuffer()` |
| `pg.partitioning` | 6 | `createPartitionedTable()` |
| `pg.stats` | 8 | `correlation()`, `percentiles()` |
| `pg.cron` | 8 | `scheduleJob()`, `listJobs()` |
| `pg.partman` | 10 | `createPartitionConfig()` |
| `pg.kcache` | 7 | `queryStats()`, `topQueries()` |
| `pg.citext` | 6 | `citextSearch()`, `citextCompare()` |
| `pg.ltree` | 8 | `ltreeQuery()`, `ltreeAncestors()` |
| `pg.pgcrypto` | 9 | `encrypt()`, `decrypt()`, `genRandomUuid()` |

## Examples

### List All Tables with Row Counts

```javascript
const tables = await pg.core.listTables();
const results = [];

for (const t of tables) {
  const stats = await pg.performance.tableStats({ table: t.name });
  results.push({ 
    table: t.name, 
    rows: stats.row_count,
    size: stats.size_bytes 
  });
}

return results.sort((a, b) => b.rows - a.rows);
```

### Find Unused Indexes

```javascript
const usage = await pg.performance.indexUsage();
const unused = usage.filter(idx => idx.scans === 0 && idx.size_bytes > 1024 * 1024);

return unused.map(idx => ({
  index: idx.name,
  table: idx.table,
  sizeMb: Math.round(idx.size_bytes / 1024 / 1024),
  definition: idx.definition
}));
```

### Database Health Report

```javascript
const [connections, sizes, locks, stats] = await Promise.all([
  pg.monitoring.activeConnections(),
  pg.monitoring.tableSizes(),
  pg.monitoring.locks(),
  pg.performance.databaseStats()
]);

return {
  connections: {
    active: connections.filter(c => c.state === 'active').length,
    idle: connections.filter(c => c.state === 'idle').length,
    total: connections.length
  },
  largestTables: sizes.slice(0, 5).map(t => ({
    name: t.table,
    sizeMb: Math.round(t.size_bytes / 1024 / 1024)
  })),
  activeLocks: locks.length,
  cacheHitRatio: stats.cache_hit_ratio
};
```

### Batch JSONB Updates

```javascript
const items = await pg.core.readQuery({ 
  sql: "SELECT id, data FROM products WHERE data->>'status' = 'pending'" 
});

const updates = [];
for (const item of items.rows) {
  await pg.jsonb.set({
    table: 'products',
    column: 'data',
    path: ['status'],
    value: 'processed',
    where: `id = ${item.id}`
  });
  updates.push(item.id);
}

return { updated: updates.length, ids: updates };
```

## Security

### Blocked Patterns

The following are blocked for security:
- `require()`, `import()` - No module loading
- `process`, `global`, `globalThis` - No Node.js globals
- `eval()`, `Function()` - No dynamic code execution
- `__proto__`, `constructor` - No prototype manipulation
- `child_process`, `fs`, `net`, `http` - No system access

### Resource Limits

| Limit | Default | Purpose |
|-------|---------|---------|
| Execution timeout | 30 seconds | Prevent infinite loops |
| Max code length | 50 KB | Limit input size |
| Max result size | 10 MB | Prevent memory issues |
| Rate limit | 60/minute | Prevent abuse |

### OAuth Scope

Code Mode requires the `admin` OAuth scope because it can execute any database operation.

## Limitations

1. **No External Network** - Cannot make HTTP requests or connect to other services
2. **No File System** - Cannot read or write files
3. **No Timers** - `setTimeout`, `setInterval`, `setImmediate` are disabled
4. **Single Execution** - Each call is stateless; no persistent variables between calls

## Sandbox Modes

Code Mode supports two isolation levels:

| Mode | Isolation | Performance | Use Case |
|------|-----------|-------------|----------|
| `vm` | Script isolation within same process | Low overhead | Default, LLM-generated code |
| `worker` | Separate V8 instance per execution | Higher overhead | Enhanced security |

### Setting the Mode

```javascript
import { setDefaultSandboxMode } from './codemode/index.js';

// Use worker threads for enhanced isolation
setDefaultSandboxMode('worker');
```

### VM Mode (Default)
- Uses Node.js `vm` module
- Restricted global context (no Node.js APIs)
- Reusable execution contexts for performance
- Suitable for trusted LLM-generated code

### Worker Mode (Enhanced)
- Uses Node.js `worker_threads`
- Separate V8 instance per execution
- Hard timeout enforcement (thread termination)
- Isolated memory space
- Fresh process state on each execution
- Recommended for higher security requirements

> **Note**: For truly untrusted code in production environments, consider running Code Mode in a separate container or using `isolated-vm` for true V8 isolate separation.
