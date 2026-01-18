/**
 * pgcrypto Setup Prompt
 *
 * Complete guide for setting up cryptographic functions with pgcrypto.
 */

import type { PromptDefinition, RequestContext } from "../../../types/index.js";

export function createSetupPgcryptoPrompt(): PromptDefinition {
  return {
    name: "pg_setup_pgcrypto",
    description:
      "Complete guide for setting up cryptographic functions with pgcrypto including hashing, encryption, and secure password storage.",
    arguments: [
      {
        name: "useCase",
        description: "Use case: password_hashing, encryption, uuid, hmac",
        required: false,
      },
    ],
    // eslint-disable-next-line @typescript-eslint/require-await
    handler: async (
      args: Record<string, string>,
      _context: RequestContext,
    ): Promise<string> => {
      const useCase = args["useCase"] ?? "password_hashing";

      return `# pgcrypto Setup Guide - ${useCase
        .split("_")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ")}

## pgcrypto Overview

pgcrypto provides cryptographic functions for PostgreSQL:
- **Hashing:** SHA-256, SHA-512, MD5, etc.
- **Password hashing:** bcrypt, scrypt (via crypt/gen_salt)
- **Symmetric encryption:** AES with PGP
- **Random generation:** Secure UUIDs, random bytes
- **HMAC:** Message authentication

## Setup Steps

### 1. Install pgcrypto

\`\`\`sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;
SELECT * FROM pg_extension WHERE extname = 'pgcrypto';
\`\`\`

${
  useCase === "password_hashing"
    ? `
### 2. Secure Password Storage

**The RIGHT way: bcrypt with crypt()**

\`\`\`sql
-- Store password hash
INSERT INTO users (email, password_hash)
VALUES (
    'user@example.com',
    crypt('mypassword', gen_salt('bf', 10))  -- bcrypt with cost 10
);

-- Verify password
SELECT id, email FROM users
WHERE email = 'user@example.com'
  AND password_hash = crypt('mypassword', password_hash);
\`\`\`

**Salt algorithms:**
| Algorithm | \`gen_salt()\` | Security | Speed |
|-----------|--------------|----------|-------|
| bcrypt | \`'bf'\` | ✓ Best | Slowest (good!) |
| DES extended | \`'xdes'\` | ✗ Weak | Fast |
| MD5 | \`'md5'\` | ✗ Avoid | Fast |

**bcrypt cost factors:**
\`\`\`sql
SELECT gen_salt('bf', 8);   -- Faster, less secure
SELECT gen_salt('bf', 10);  -- Good balance (recommended)
SELECT gen_salt('bf', 12);  -- Slower, more secure
SELECT gen_salt('bf', 14);  -- Very slow, very secure
\`\`\`

**Complete user table:**
\`\`\`sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email CITEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_login TIMESTAMPTZ
);

-- Hash on insert
CREATE OR REPLACE FUNCTION hash_password()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.password_hash !~ '^\\$2[aby]\\$' THEN
        NEW.password_hash := crypt(NEW.password_hash, gen_salt('bf', 10));
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER hash_password_trigger
    BEFORE INSERT OR UPDATE OF password_hash ON users
    FOR EACH ROW EXECUTE FUNCTION hash_password();
\`\`\`
`
    : useCase === "encryption"
      ? `
### 2. Symmetric Encryption (AES)

**Encrypt sensitive data:**
\`\`\`sql
-- Encrypt with AES (via PGP symmetric)
INSERT INTO secrets (name, encrypted_value)
VALUES (
    'api_key',
    pgp_sym_encrypt('sk-1234567890abcdef', 'my-encryption-key')
);

-- Decrypt
SELECT name, pgp_sym_decrypt(encrypted_value, 'my-encryption-key') as value
FROM secrets
WHERE name = 'api_key';
\`\`\`

**Table design for encrypted data:**
\`\`\`sql
CREATE TABLE secrets (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    encrypted_value BYTEA NOT NULL,  -- Encrypted data is binary
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on name (can't index encrypted content)
CREATE INDEX ON secrets (name);
\`\`\`

**Encryption options:**
\`\`\`sql
-- With compression
SELECT pgp_sym_encrypt('data', 'key', 'compress-algo=1');

-- With specific cipher
SELECT pgp_sym_encrypt('data', 'key', 'cipher-algo=aes256');
\`\`\`

**⚠️ Key management is crucial:**
- Never hardcode keys in SQL
- Use environment variables or key management service
- Rotate keys periodically
- Consider column-level encryption only for truly sensitive data
`
      : useCase === "uuid"
        ? `
### 2. Secure UUID Generation

**Generate UUID v4 (random):**
\`\`\`sql
SELECT gen_random_uuid();
-- Result: 550e8400-e29b-41d4-a716-446655440000

-- Use as primary key
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id INTEGER REFERENCES users(id),
    token TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert without specifying ID
INSERT INTO sessions (user_id, token, expires_at)
VALUES (1, gen_random_bytes(32)::text, NOW() + INTERVAL '24 hours')
RETURNING id;
\`\`\`

**PostgreSQL 13+ has built-in gen_random_uuid()**
For older versions, pgcrypto provides it.

**Random bytes for tokens:**
\`\`\`sql
-- Generate secure token (32 bytes = 256 bits)
SELECT encode(gen_random_bytes(32), 'hex') as token;

-- URL-safe base64 token
SELECT translate(
    encode(gen_random_bytes(32), 'base64'),
    '+/', '-_'
) as token;
\`\`\`
`
        : `
### 2. HMAC for Message Authentication

**Sign data with HMAC:**
\`\`\`sql
-- Create HMAC-SHA256 signature
SELECT encode(
    hmac('message to sign', 'secret-key', 'sha256'),
    'hex'
) as signature;

-- Verify signature
SELECT encode(hmac('message to sign', 'secret-key', 'sha256'), 'hex')
    = 'expected_signature_hex';
\`\`\`

**Webhook signature verification:**
\`\`\`sql
CREATE OR REPLACE FUNCTION verify_webhook_signature(
    payload TEXT,
    signature TEXT,
    secret TEXT
) RETURNS BOOLEAN AS $$
BEGIN
    RETURN encode(hmac(payload, secret, 'sha256'), 'hex') = signature;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Use in webhook processing
SELECT * FROM webhooks
WHERE verify_webhook_signature(body, header_signature, webhook_secret);
\`\`\`

**HMAC algorithms:**
| Algorithm | Function | Output Size |
|-----------|----------|-------------|
| SHA-256 | \`hmac(data, key, 'sha256')\` | 32 bytes |
| SHA-512 | \`hmac(data, key, 'sha512')\` | 64 bytes |
| SHA-384 | \`hmac(data, key, 'sha384')\` | 48 bytes |
`
}

### 3. Data Hashing

**For data integrity (not passwords!):**
\`\`\`sql
-- SHA-256 hash
SELECT encode(digest('data to hash', 'sha256'), 'hex');

-- SHA-512 hash
SELECT encode(digest('data to hash', 'sha512'), 'hex');

-- MD5 (only for checksums, NOT security)
SELECT encode(digest('data', 'md5'), 'hex');
\`\`\`

**Hash algorithms:**
| Algorithm | Security | Use Case |
|-----------|----------|----------|
| SHA-256 | ✓ Good | Data integrity, fingerprints |
| SHA-512 | ✓ Better | Higher security needs |
| MD5 | ✗ Broken | Legacy checksums only |
| SHA-1 | ✗ Weak | Avoid |

## Available Tools

| Tool | Purpose |
|------|---------|
| \`pg_pgcrypto_create_extension\` | Enable pgcrypto |
| \`pg_pgcrypto_hash\` | Hash data with digest() |
| \`pg_pgcrypto_hmac\` | HMAC authentication |
| \`pg_pgcrypto_encrypt\` | Symmetric encryption |
| \`pg_pgcrypto_decrypt\` | Symmetric decryption |
| \`pg_pgcrypto_gen_random_uuid\` | Generate UUID v4 |
| \`pg_pgcrypto_gen_random_bytes\` | Generate random bytes |
| \`pg_pgcrypto_gen_salt\` | Generate salt |
| \`pg_pgcrypto_crypt\` | Password hashing |

## Security Best Practices

1. **Passwords:** Always use bcrypt via \`crypt()\` with cost ≥10
2. **Encryption keys:** Never store in database or code
3. **Random data:** Use \`gen_random_bytes()\`, never \`random()\`
4. **Hashing:** SHA-256 minimum, avoid MD5/SHA-1
5. **Salt:** Generated fresh for each password
6. **Key rotation:** Plan for changing encryption keys

## Common Pitfalls

- ❌ Using MD5 or SHA-1 for passwords (use bcrypt!)
- ❌ Storing encryption keys in the database
- ❌ Using predictable values instead of \`gen_random_bytes()\`
- ❌ Low bcrypt cost factor (use at least 10)
- ❌ Encrypting everything (performance impact)

## When to Use What

| Need | Solution |
|------|----------|
| Password storage | \`crypt()\` + \`gen_salt('bf')\` |
| Data integrity | \`digest(data, 'sha256')\` |
| Message authentication | \`hmac(data, key, 'sha256')\` |
| Sensitive data at rest | \`pgp_sym_encrypt()\` |
| Unique identifiers | \`gen_random_uuid()\` |
| Session tokens | \`gen_random_bytes(32)\` |

**Pro Tip:** pgcrypto + citext = secure authentication done right!`;
    },
  };
}
