# Code Mode Implementation Plan for postgres-mcp

## Background

**Code Mode** is an MCP interaction paradigm where LLMs generate executable code (TypeScript/JavaScript) that runs in a sandboxed environment, orchestrating multiple tool calls efficiently. This differs from traditional direct tool calling.

### Current State
- postgres-mcp README claims "code mode" support (line 7)
- Server is a standard MCP server with 194 direct-call tools
- No actual Code Mode sandbox/proxy implementation exists

### Decision Required
Choose one of the following approaches:

---

## Implement Code Mode Proxy

Add a Code Mode execution layer to postgres-mcp.

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        LLM Client                           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼ (generates TypeScript code)
┌─────────────────────────────────────────────────────────────┐
│                   Code Mode Tool                            │
│  pg_execute_code({ code: "..." })                          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼ (runs in sandbox)
┌─────────────────────────────────────────────────────────────┐
│                   Sandboxed Runtime                         │
│  - Isolated V8 context (vm2 or isolated-vm)                │
│  - Exposes pg.* API for tool calls                         │
│  - Memory/time limits                                       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼ (orchestrates)
┌─────────────────────────────────────────────────────────────┐
│              Existing postgres-mcp Tools (194)              │
└─────────────────────────────────────────────────────────────┘
```

### Implementation Checklist

#### Phase 1: Core Infrastructure
- [ ] Add dependency: `isolated-vm` or `vm2` for sandboxed execution
- [ ] Create `src/codemode/` directory structure:
  - [ ] `sandbox.ts` — Isolated execution environment
  - [ ] `api.ts` — Exposed `pg.*` API for sandbox
  - [ ] `types.ts` — Type definitions
  - [ ] `security.ts` — Input validation, resource limits
- [ ] Implement sandbox with:
  - [ ] Memory limit (default: 128MB)
  - [ ] Execution timeout (default: 30 seconds)
  - [ ] CPU time tracking
  - [ ] No filesystem/network access

#### Phase 2: Tool API Exposure
- [ ] Create `PgApi` class exposing selected tools to sandbox:
  ```typescript
  // Inside sandbox, LLM-generated code uses:
  const results = await pg.query("SELECT * FROM users");
  const tables = await pg.listTables();
  await pg.createIndex({ table: "users", columns: ["email"] });
  ```
- [ ] Map existing tools to simplified API surface
- [ ] Implement result serialization (sandbox ↔ host)
- [ ] Add batching support for multiple operations

#### Phase 3: MCP Tool Registration
- [ ] Create `pg_execute_code` tool:
  ```typescript
  {
    name: "pg_execute_code",
    description: "Execute TypeScript code that orchestrates PostgreSQL operations",
    inputSchema: {
      type: "object",
      properties: {
        code: { type: "string", description: "TypeScript code to execute" },
        timeout: { type: "number", description: "Timeout in ms (max 30000)" }
      },
      required: ["code"]
    }
  }
  ```
- [ ] Add tool to `codemode` group for filtering
- [ ] Update tool count in README (195 tools)

#### Phase 4: Security Hardening
- [ ] Whitelist allowed sandbox APIs (no `require`, `eval`, `fetch`)
- [ ] Sanitize code input (no shell injection vectors)
- [ ] Implement rate limiting per execution
- [ ] Add audit logging for all code executions
- [ ] Test for sandbox escape vulnerabilities

#### Phase 5: Documentation
- [ ] Add Code Mode section to README with examples
- [ ] Create `docs/CODE_MODE.md` with:
  - [ ] API reference for `pg.*` functions
  - [ ] Example workflows (batched queries, conditional logic)
  - [ ] Security considerations
  - [ ] Performance tuning (timeout, memory limits)
- [ ] Update CHANGELOG

#### Phase 6: Testing
- [ ] Unit tests for sandbox isolation
- [ ] Integration tests for tool execution via code
- [ ] Security tests (attempted sandbox escapes)
- [ ] Performance benchmarks vs direct tool calls

### Dependencies to Add
```json
{
  "isolated-vm": "^5.0.1"
}
```

### Example Usage (After Implementation)

**LLM generates code like:**
```typescript
// Batch operation: analyze all tables and suggest indexes
const tables = await pg.listTables();
const recommendations = [];

for (const table of tables) {
  const stats = await pg.getTableStats({ table: table.name });
  if (stats.seq_scan > 1000 && stats.idx_scan < 100) {
    const columns = await pg.getColumns({ table: table.name });
    recommendations.push({
      table: table.name,
      suggestion: `Consider index on frequently filtered columns`,
      stats: { seq_scan: stats.seq_scan, idx_scan: stats.idx_scan }
    });
  }
}

return { recommendations, analyzed: tables.length };
```

**Benefits:**
- Single tool call instead of N×3 calls
- Logic stays in sandbox, reduces token usage
- Cleaner LLM output (just code, not JSON orchestration)

---

## Recommendation

**For immediate accuracy:** Choose **Option A** (clarify README)

**For competitive advantage:** Choose **Option B** if you want postgres-mcp to be a first-class Code Mode server. This is a significant feature that few MCP servers currently implement natively.

---

## Effort Estimates

| Phase | Effort |
|-------|--------|
| Option A (README only) | 15 min |
| Phase 1: Infrastructure | 4-6 hours |
| Phase 2: Tool API | 3-4 hours |
| Phase 3: MCP Registration | 1 hour |
| Phase 4: Security | 2-3 hours |
| Phase 5: Documentation | 2 hours |
| Phase 6: Testing | 3-4 hours |
| **Total (Option B)** | **15-20 hours** |
