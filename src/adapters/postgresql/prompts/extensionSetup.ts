/**
 * Extension Setup Prompt
 * 
 * Guide for installing and configuring PostgreSQL extensions.
 */

import type { PromptDefinition, RequestContext } from '../../../types/index.js';

interface ExtensionInfo {
    purpose: string;
    useCases: string[];
}

const extensionInfo: Record<string, ExtensionInfo> = {
    'pgvector': {
        purpose: 'AI-native vector similarity search',
        useCases: ['Semantic search', 'Recommendation systems', 'Image similarity']
    },
    'postgis': {
        purpose: 'Geospatial operations and GIS',
        useCases: ['Mapping', 'Location-based services', 'Spatial analysis']
    },
    'hypopg': {
        purpose: 'Hypothetical index testing',
        useCases: ['Index optimization', 'Zero-risk testing', 'Performance tuning']
    },
    'pg_stat_statements': {
        purpose: 'Query performance tracking',
        useCases: ['Performance monitoring', 'Slow query detection', 'Workload analysis']
    },
    'pg_trgm': {
        purpose: 'Fuzzy text search with trigrams',
        useCases: ['Fuzzy matching', 'Typo tolerance', 'Text similarity']
    },
    'fuzzystrmatch': {
        purpose: 'Phonetic matching and edit distance',
        useCases: ['Soundex matching', 'Levenshtein distance', 'Metaphone']
    }
};

export function createExtensionSetupPrompt(): PromptDefinition {
    return {
        name: 'pg_extension_setup',
        description: 'Guide for installing and configuring PostgreSQL extensions (pgvector, postgis, hypopg, pg_stat_statements, etc.).',
        arguments: [
            {
                name: 'extensionName',
                description: 'Extension name: pgvector, postgis, hypopg, pg_stat_statements, pg_trgm, fuzzystrmatch',
                required: true
            }
        ],
        // eslint-disable-next-line @typescript-eslint/require-await
        handler: async (args: Record<string, string>, _context: RequestContext): Promise<string> => {
            const extensionName = args['extensionName'] ?? 'pg_stat_statements';
            const info = extensionInfo[extensionName] ?? { purpose: 'PostgreSQL extension', useCases: ['Database operations'] };

            let content = `# Extension Setup Guide - ${extensionName}

**Purpose:** ${info.purpose}

## Use Cases
${info.useCases.map(uc => `- ${uc}`).join('\n')}

## Setup Steps

### 1. Check Availability

\`\`\`sql
SELECT * FROM pg_available_extensions WHERE name = '${extensionName}';
\`\`\`

If not available, install at system level:
\`\`\`bash
# Ubuntu/Debian
sudo apt-get install postgresql-${extensionName}

# macOS (Homebrew)
brew install ${extensionName}
\`\`\`

### 2. Install Extension

\`\`\`sql
CREATE EXTENSION IF NOT EXISTS ${extensionName};
\`\`\`

Verify: \`SELECT extname, extversion FROM pg_extension WHERE extname = '${extensionName}';\`

### 3. Configuration
`;

            if (extensionName === 'pg_stat_statements') {
                content += `
**postgresql.conf:**
\`\`\`
shared_preload_libraries = 'pg_stat_statements'
pg_stat_statements.track = all
pg_stat_statements.max = 10000
\`\`\`

**Restart PostgreSQL after configuration!**

**Verify:**
\`\`\`sql
SELECT query, calls, mean_exec_time
FROM pg_stat_statements
ORDER BY mean_exec_time DESC LIMIT 10;
\`\`\`
`;
            } else if (extensionName === 'hypopg') {
                content += `
No configuration needed - works out of the box!

**Test it:**
\`\`\`sql
SELECT * FROM hypopg_create_index('CREATE INDEX ON users(email)');
EXPLAIN SELECT * FROM users WHERE email = 'test@example.com';
SELECT hypopg_reset();
\`\`\`
`;
            } else if (extensionName === 'pgvector') {
                content += `
**Create vector column:**
\`\`\`sql
ALTER TABLE documents ADD COLUMN embedding vector(1536);
\`\`\`

**Create HNSW index:**
\`\`\`sql
CREATE INDEX ON documents USING hnsw (embedding vector_cosine_ops);
\`\`\`

Use \`pg_setup_pgvector\` prompt for detailed setup.
`;
            } else if (extensionName === 'postgis') {
                content += `
**Check version:**
\`\`\`sql
SELECT PostGIS_Full_Version();
\`\`\`

**Create spatial column:**
\`\`\`sql
ALTER TABLE locations ADD COLUMN geom GEOGRAPHY(POINT, 4326);
CREATE INDEX ON locations USING GIST (geom);
\`\`\`

Use \`pg_setup_postgis\` prompt for detailed setup.
`;
            } else {
                content += `
Extension-specific configuration may vary. Check the official documentation.
`;
            }

            content += `
### 4. Best Practices

- Always test extensions in development first
- Check compatibility with your PostgreSQL version
- Monitor performance impact after enabling
- Keep extensions updated

### 5. Troubleshooting

**Extension not found:** Verify system-level installation, check pg_config --sharedir
**Permission denied:** Must be superuser to install extensions
**Version mismatch:** Ensure extension compatible with PostgreSQL version

**Pro Tip:** PostgreSQL's extension ecosystem is one of its greatest strengths!`;

            return content;
        }
    };
}
