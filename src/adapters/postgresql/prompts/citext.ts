/**
 * citext Setup Prompt
 *
 * Complete guide for setting up case-insensitive text with citext.
 */

import type { PromptDefinition, RequestContext } from "../../../types/index.js";

export function createSetupCitextPrompt(): PromptDefinition {
  return {
    name: "pg_setup_citext",
    description:
      "Complete guide for setting up case-insensitive text columns with citext for emails, usernames, and tags.",
    arguments: [
      {
        name: "useCase",
        description: "Use case: email, username, tags, domains",
        required: false,
      },
    ],
    // eslint-disable-next-line @typescript-eslint/require-await
    handler: async (
      args: Record<string, string>,
      _context: RequestContext,
    ): Promise<string> => {
      const useCase = args["useCase"] ?? "email";

      return `# citext Setup Guide - ${useCase.charAt(0).toUpperCase() + useCase.slice(1)}s

## citext Overview

citext provides a **case-insensitive text type** that handles comparison at the type level:
- No need for \`LOWER()\` in every query
- Prevents subtle bugs in authentication systems
- Indexes work automatically
- Proper for emails, usernames, domain names, tags

## Why Use citext?

**Without citext (error-prone):**
\`\`\`sql
-- Developers must remember LOWER() every time
SELECT * FROM users WHERE LOWER(email) = LOWER($1);
CREATE INDEX ON users (LOWER(email));

-- Forgot LOWER()? Bug!
SELECT * FROM users WHERE email = 'User@Example.com';  -- Won't match 'user@example.com'
\`\`\`

**With citext (safe):**
\`\`\`sql
-- Automatic case-insensitive comparison
SELECT * FROM users WHERE email = $1;
CREATE INDEX ON users (email);  -- Just works
\`\`\`

## Setup Steps

### 1. Install citext

\`\`\`sql
CREATE EXTENSION IF NOT EXISTS citext;
SELECT * FROM pg_extension WHERE extname = 'citext';
\`\`\`

### 2. Create Table with citext

${
  useCase === "email"
    ? `\`\`\`sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email CITEXT UNIQUE NOT NULL,
    name VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index is automatically case-insensitive
CREATE INDEX idx_users_email ON users (email);

-- All these will match the same user:
INSERT INTO users (email, name) VALUES ('user@example.com', 'Test');
SELECT * FROM users WHERE email = 'USER@EXAMPLE.COM';  -- ✓ Matches
SELECT * FROM users WHERE email = 'User@Example.Com';  -- ✓ Matches
\`\`\`
`
    : useCase === "username"
      ? `\`\`\`sql
CREATE TABLE accounts (
    id SERIAL PRIMARY KEY,
    username CITEXT UNIQUE NOT NULL,
    display_name VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Prevent duplicate usernames regardless of case
INSERT INTO accounts (username, display_name) VALUES ('JohnDoe', 'John Doe');
INSERT INTO accounts (username, display_name) VALUES ('johndoe', 'Other');  -- ✗ Fails - duplicate!
\`\`\`
`
      : useCase === "tags"
        ? `\`\`\`sql
CREATE TABLE posts (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255),
    content TEXT
);

CREATE TABLE tags (
    id SERIAL PRIMARY KEY,
    name CITEXT UNIQUE NOT NULL
);

CREATE TABLE post_tags (
    post_id INTEGER REFERENCES posts(id),
    tag_id INTEGER REFERENCES tags(id),
    PRIMARY KEY (post_id, tag_id)
);

-- Tags are case-insensitive
INSERT INTO tags (name) VALUES ('JavaScript');
INSERT INTO tags (name) VALUES ('javascript');  -- ✗ Fails - duplicate!
SELECT * FROM tags WHERE name = 'JAVASCRIPT';  -- ✓ Matches
\`\`\`
`
        : `\`\`\`sql
CREATE TABLE websites (
    id SERIAL PRIMARY KEY,
    domain CITEXT UNIQUE NOT NULL,
    owner_id INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Domain names are case-insensitive by RFC
INSERT INTO websites (domain) VALUES ('Example.Com');
SELECT * FROM websites WHERE domain = 'EXAMPLE.COM';  -- ✓ Matches
\`\`\`
`
}

### 3. Migrating Existing Columns

Use \`pg_citext_convert_column\` or manually:

\`\`\`sql
-- 1. Check for case-insensitive duplicates first!
SELECT LOWER(email), COUNT(*) 
FROM users 
GROUP BY LOWER(email) 
HAVING COUNT(*) > 1;

-- 2. If duplicates exist, resolve them first

-- 3. Convert column
ALTER TABLE users ALTER COLUMN email TYPE CITEXT;

-- 4. Recreate indexes if needed
DROP INDEX IF EXISTS idx_users_email_lower;
CREATE UNIQUE INDEX idx_users_email ON users (email);
\`\`\`

### 4. Find Candidate Columns

Use \`pg_citext_analyze_candidates\` to find text columns that could benefit from citext:

- Columns with names like email, username, domain, tag
- Columns with UNIQUE constraints
- Columns used with LOWER() in queries

## Available Tools

| Tool | Purpose |
|------|---------|
| \`pg_citext_create_extension\` | Enable citext |
| \`pg_citext_convert_column\` | Convert text to citext |
| \`pg_citext_list_columns\` | List citext columns |
| \`pg_citext_analyze_candidates\` | Find conversion candidates |
| \`pg_citext_compare\` | Test case-insensitive comparison |
| \`pg_citext_schema_advisor\` | Schema recommendations |

## Comparison Behavior

\`\`\`sql
-- citext comparisons
SELECT 'ABC'::citext = 'abc'::citext;  -- true
SELECT 'ABC'::citext = 'abc';          -- true (text promoted)
SELECT 'Café'::citext = 'café'::citext; -- true (proper Unicode handling)

-- Sorting is still case-sensitive by default
SELECT * FROM tags ORDER BY name;
-- JavaScript, Python, go (capital letters first)

-- For case-insensitive sort, use collation
SELECT * FROM tags ORDER BY name COLLATE "C";
\`\`\`

## Index Considerations

\`\`\`sql
-- Regular B-tree index works for citext
CREATE INDEX ON users (email);

-- For pattern matching, use gin_trgm_ops
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX ON users USING gin (email gin_trgm_ops);

-- LIKE patterns work case-insensitively
SELECT * FROM users WHERE email LIKE '%@example%';  -- Case-insensitive!
\`\`\`

## Best Practices

1. **Use for identifiers** — Emails, usernames, domain names, tags
2. **Check for duplicates before converting** — Migration can fail
3. **Don't use for content** — Full names, descriptions should preserve case
4. **Consider collation for sorting** — citext equality is case-insensitive, but sorting depends on collation
5. **Document the type usage** — Help future developers understand

## Common Pitfalls

- ❌ Using citext for all text columns (only use for identifiers)
- ❌ Forgetting to check for duplicates before migration
- ❌ Expecting case-insensitive sorting without proper collation
- ❌ Using with binary data or non-text identifiers

## Performance Notes

- citext adds minimal overhead vs text
- Comparison uses \`lower()\` internally
- B-tree indexes work normally
- Slightly slower than text for exact matches

**Pro Tip:** citext eliminates an entire category of authentication bugs. Always use it for email and username columns!`;
    },
  };
}
