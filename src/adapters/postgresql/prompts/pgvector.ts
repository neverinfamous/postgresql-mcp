/**
 * pgvector Setup Prompt
 *
 * Complete guide for setting up semantic search with pgvector.
 */

import type { PromptDefinition, RequestContext } from "../../../types/index.js";

export function createSetupPgvectorPrompt(): PromptDefinition {
  return {
    name: "pg_setup_pgvector",
    description:
      "Complete guide for setting up semantic search with pgvector including table design, indexing, and queries.",
    arguments: [
      {
        name: "contentType",
        description: "Type of content: documents, products, images",
        required: false,
      },
      {
        name: "dimensions",
        description: "Embedding dimensions (default: 1536 for OpenAI ada-002)",
        required: false,
      },
      {
        name: "distanceMetric",
        description: "Distance metric: cosine, l2, inner_product",
        required: false,
      },
    ],
    // eslint-disable-next-line @typescript-eslint/require-await
    handler: async (
      args: Record<string, string>,
      _context: RequestContext,
    ): Promise<string> => {
      const contentType = args["contentType"] ?? "documents";
      const dimensions = args["dimensions"] ?? "1536";
      const distanceMetric = args["distanceMetric"] ?? "cosine";

      return `# pgVector Setup Guide - ${contentType.charAt(0).toUpperCase() + contentType.slice(1)}

**Configuration:**
- Content Type: ${contentType}
- Embedding Dimensions: ${dimensions} (OpenAI ada-002 standard)
- Distance Metric: ${distanceMetric}

## Setup Steps

### 1. Install pgvector

\`\`\`sql
CREATE EXTENSION IF NOT EXISTS vector;
SELECT * FROM pg_extension WHERE extname = 'vector';
\`\`\`

### 2. Create Table

\`\`\`sql
CREATE TABLE ${contentType} (
    id SERIAL PRIMARY KEY,
    content TEXT NOT NULL,
    metadata JSONB,
    embedding vector(${dimensions}),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
\`\`\`

### 3. Distance Metrics

**Cosine (${distanceMetric === "cosine" ? "✓ Selected" : ""})** - Most common for embeddings:
\`\`\`sql
SELECT id, 1 - (embedding <=> query_vector) as similarity
FROM ${contentType} ORDER BY embedding <=> query_vector LIMIT 10;
\`\`\`

**L2/Euclidean (${distanceMetric === "l2" ? "✓ Selected" : ""}):**
\`\`\`sql
SELECT id, embedding <-> query_vector as distance
FROM ${contentType} ORDER BY embedding <-> query_vector LIMIT 10;
\`\`\`

**Inner Product (${distanceMetric === "inner_product" ? "✓ Selected" : ""}):**
\`\`\`sql
SELECT id, (embedding <#> query_vector) * -1 as similarity
FROM ${contentType} ORDER BY embedding <#> query_vector LIMIT 10;
\`\`\`

### 4. Create Index

**HNSW (Best Quality):**
\`\`\`sql
CREATE INDEX ON ${contentType}
USING hnsw (embedding vector_${distanceMetric}_ops)
WITH (m = 16, ef_construction = 64);
\`\`\`

**IVFFlat (Faster Build):**
\`\`\`sql
CREATE INDEX ON ${contentType}
USING ivfflat (embedding vector_${distanceMetric}_ops)
WITH (lists = 100);
\`\`\`

### 5. Query Similar Content

Use \`pg_vector_search\`:
\`\`\`
pg_vector_search(
    table_name: "${contentType}",
    vector_column: "embedding",
    query_vector: [...],
    distance_metric: "${distanceMetric}",
    limit: 10
)
\`\`\`

### 6. Performance Tuning

- **Small dataset (<100K):** m=16, ef_construction=64
- **Medium dataset (100K-1M):** m=32, ef_construction=128
- **Large dataset (>1M):** m=48, ef_construction=256

Use \`pg_vector_performance\` to benchmark your configuration.

## Available Tools

| Tool | Purpose |
|------|---------|
| \`pg_vector_create_extension\` | Enable pgvector extension |
| \`pg_vector_add_column\` | Add vector column to table |
| \`pg_vector_search\` | Similarity search with distance metrics |
| \`pg_vector_create_index\` | Create HNSW or IVFFlat index |
| \`pg_vector_update\` | Update vector values |
| \`pg_vector_batch_insert\` | Bulk insert embeddings |
| \`pg_vector_aggregate\` | Aggregate vector operations |
| \`pg_vector_distance\` | Calculate distance between vectors |
| \`pg_vector_nearest\` | Find K nearest neighbors |
| \`pg_vector_hybrid_search\` | Combine vector + keyword search |
| \`pg_vector_normalize\` | Normalize vectors |
| \`pg_vector_performance\` | Benchmark configuration |
| \`pg_vector_info\` | Get pgvector version and columns |
| \`pg_vector_drop_index\` | Drop vector index |
| \`pg_vector_reindex\` | Rebuild vector index |

## Best Practices

1. Normalize embeddings if using inner product
2. Batch insert embeddings for performance
3. Use HNSW indexes for production
4. VACUUM ANALYZE after bulk inserts

**Pro Tip:** pgvector is PostgreSQL's killer AI feature - no other database does vector search this well!`;
    },
  };
}
