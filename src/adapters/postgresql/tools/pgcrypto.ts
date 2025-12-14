/**
 * PostgreSQL pgcrypto Extension Tools
 * 
 * Cryptographic functions for hashing, encryption, and secure random generation.
 * 9 tools total.
 * 
 * pgcrypto provides:
 * - Hashing: digest(), hmac() for SHA-256/512, MD5, etc.
 * - Password Hashing: crypt(), gen_salt() for bcrypt-like functions
 * - Encryption: pgp_sym_encrypt(), pgp_sym_decrypt() for symmetric encryption
 * - Random: gen_random_uuid(), gen_random_bytes()
 */

import type { PostgresAdapter } from '../PostgresAdapter.js';
import type { ToolDefinition, RequestContext } from '../../../types/index.js';
import { z } from 'zod';
import {
    PgcryptoHashSchema,
    PgcryptoHmacSchema,
    PgcryptoEncryptSchema,
    PgcryptoDecryptSchema,
    PgcryptoRandomBytesSchema,
    PgcryptoGenSaltSchema,
    PgcryptoCryptSchema
} from '../types.js';

/**
 * Get all pgcrypto tools
 */
export function getPgcryptoTools(adapter: PostgresAdapter): ToolDefinition[] {
    return [
        createPgcryptoExtensionTool(adapter),
        createPgcryptoHashTool(adapter),
        createPgcryptoHmacTool(adapter),
        createPgcryptoEncryptTool(adapter),
        createPgcryptoDecryptTool(adapter),
        createPgcryptoGenRandomUuidTool(adapter),
        createPgcryptoGenRandomBytesTool(adapter),
        createPgcryptoGenSaltTool(adapter),
        createPgcryptoCryptTool(adapter)
    ];
}

/**
 * Enable the pgcrypto extension
 */
function createPgcryptoExtensionTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_pgcrypto_create_extension',
        description: `Enable the pgcrypto extension for cryptographic functions.
pgcrypto provides hashing, encryption, password hashing, and secure random generation inside PostgreSQL.`,
        group: 'pgcrypto',
        inputSchema: z.object({}),
        handler: async (_params: unknown, _context: RequestContext) => {
            await adapter.executeQuery('CREATE EXTENSION IF NOT EXISTS pgcrypto');
            return {
                success: true,
                message: 'pgcrypto extension enabled',
                availableFunctions: [
                    'digest(data, algorithm) - Hash data',
                    'hmac(data, key, algorithm) - HMAC authentication',
                    'crypt(password, salt) - Password hashing',
                    'gen_salt(type) - Generate salt for crypt()',
                    'pgp_sym_encrypt(data, password) - Symmetric encryption',
                    'pgp_sym_decrypt(data, password) - Symmetric decryption',
                    'gen_random_uuid() - Generate UUID v4',
                    'gen_random_bytes(count) - Random bytes'
                ]
            };
        }
    };
}

/**
 * Hash data using digest()
 */
function createPgcryptoHashTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_pgcrypto_hash',
        description: `Hash data using various algorithms (SHA-256, SHA-512, MD5, etc.).
Uses pgcrypto's digest() function. Returns the hash in hex or base64 encoding.`,
        group: 'pgcrypto',
        inputSchema: PgcryptoHashSchema,
        handler: async (params: unknown, _context: RequestContext) => {
            const { data, algorithm, encoding } = PgcryptoHashSchema.parse(params);
            const enc = encoding ?? 'hex';

            // Check if pgcrypto is installed
            const extCheck = await adapter.executeQuery(`
                SELECT EXISTS(
                    SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto'
                ) as installed
            `);

            const hasExt = extCheck.rows?.[0]?.['installed'] as boolean ?? false;
            if (!hasExt) {
                return {
                    success: false,
                    error: 'pgcrypto extension is not installed',
                    hint: 'Run pg_pgcrypto_create_extension first'
                };
            }

            const encodeFunc = enc === 'base64' ? 'encode(digest($1, $2), \'base64\')' : 'encode(digest($1, $2), \'hex\')';
            const result = await adapter.executeQuery(`
                SELECT ${encodeFunc} as hash
            `, [data, algorithm]);

            return {
                success: true,
                algorithm,
                encoding: enc,
                hash: result.rows?.[0]?.['hash'] as string,
                inputLength: data.length
            };
        }
    };
}

/**
 * HMAC authentication
 */
function createPgcryptoHmacTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_pgcrypto_hmac',
        description: `Compute HMAC (Hash-based Message Authentication Code) for data with a secret key.
Useful for message authentication and integrity verification.`,
        group: 'pgcrypto',
        inputSchema: PgcryptoHmacSchema,
        handler: async (params: unknown, _context: RequestContext) => {
            const { data, key, algorithm, encoding } = PgcryptoHmacSchema.parse(params);
            const enc = encoding ?? 'hex';

            const extCheck = await adapter.executeQuery(`
                SELECT EXISTS(
                    SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto'
                ) as installed
            `);

            const hasExt = extCheck.rows?.[0]?.['installed'] as boolean ?? false;
            if (!hasExt) {
                return {
                    success: false,
                    error: 'pgcrypto extension is not installed',
                    hint: 'Run pg_pgcrypto_create_extension first'
                };
            }

            const encodeFunc = enc === 'base64'
                ? 'encode(hmac($1, $2, $3), \'base64\')'
                : 'encode(hmac($1, $2, $3), \'hex\')';
            const result = await adapter.executeQuery(`
                SELECT ${encodeFunc} as hmac
            `, [data, key, algorithm]);

            return {
                success: true,
                algorithm,
                encoding: enc,
                hmac: result.rows?.[0]?.['hmac'] as string
            };
        }
    };
}

/**
 * Symmetric encryption using PGP
 */
function createPgcryptoEncryptTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_pgcrypto_encrypt',
        description: `Encrypt data using PGP symmetric encryption.
Returns base64-encoded encrypted data. Use pg_pgcrypto_decrypt to decrypt.

⚠️ SECURITY NOTE: Consider whether encryption should happen at the application layer instead.
Database-level encryption is appropriate for data-at-rest protection when the DB admin is trusted.`,
        group: 'pgcrypto',
        inputSchema: PgcryptoEncryptSchema,
        handler: async (params: unknown, _context: RequestContext) => {
            const { data, password, options } = PgcryptoEncryptSchema.parse(params);

            const extCheck = await adapter.executeQuery(`
                SELECT EXISTS(
                    SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto'
                ) as installed
            `);

            const hasExt = extCheck.rows?.[0]?.['installed'] as boolean ?? false;
            if (!hasExt) {
                return {
                    success: false,
                    error: 'pgcrypto extension is not installed',
                    hint: 'Run pg_pgcrypto_create_extension first'
                };
            }

            let sql: string;
            let queryParams: unknown[];

            if (options !== undefined) {
                sql = `SELECT encode(pgp_sym_encrypt($1, $2, $3), 'base64') as encrypted`;
                queryParams = [data, password, options];
            } else {
                sql = `SELECT encode(pgp_sym_encrypt($1, $2), 'base64') as encrypted`;
                queryParams = [data, password];
            }

            const result = await adapter.executeQuery(sql, queryParams);

            return {
                success: true,
                encrypted: result.rows?.[0]?.['encrypted'] as string,
                encoding: 'base64',
                note: 'Store this value and use pg_pgcrypto_decrypt with the same password to recover the data'
            };
        }
    };
}

/**
 * Symmetric decryption using PGP
 */
function createPgcryptoDecryptTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_pgcrypto_decrypt',
        description: `Decrypt data that was encrypted with pg_pgcrypto_encrypt.
Expects base64-encoded encrypted data and the same password used for encryption.`,
        group: 'pgcrypto',
        inputSchema: PgcryptoDecryptSchema,
        handler: async (params: unknown, _context: RequestContext) => {
            const { encryptedData, password } = PgcryptoDecryptSchema.parse(params);

            const extCheck = await adapter.executeQuery(`
                SELECT EXISTS(
                    SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto'
                ) as installed
            `);

            const hasExt = extCheck.rows?.[0]?.['installed'] as boolean ?? false;
            if (!hasExt) {
                return {
                    success: false,
                    error: 'pgcrypto extension is not installed',
                    hint: 'Run pg_pgcrypto_create_extension first'
                };
            }

            try {
                const result = await adapter.executeQuery(`
                    SELECT pgp_sym_decrypt(decode($1, 'base64'), $2) as decrypted
                `, [encryptedData, password]);

                return {
                    success: true,
                    decrypted: result.rows?.[0]?.['decrypted'] as string
                };
            } catch (error) {
                return {
                    success: false,
                    error: 'Decryption failed - wrong password or corrupted data',
                    details: String(error)
                };
            }
        }
    };
}

/**
 * Generate cryptographically secure UUID v4
 */
function createPgcryptoGenRandomUuidTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_pgcrypto_gen_random_uuid',
        description: `Generate a cryptographically secure UUID v4.
Uses pgcrypto's gen_random_uuid() for better randomness than uuid-ossp.`,
        group: 'pgcrypto',
        inputSchema: z.object({
            count: z.number().min(1).max(100).optional()
                .describe('Number of UUIDs to generate (default: 1, max: 100)')
        }),
        handler: async (params: unknown, _context: RequestContext) => {
            const { count } = (params as { count?: number });
            const generateCount = count ?? 1;

            const extCheck = await adapter.executeQuery(`
                SELECT EXISTS(
                    SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto'
                ) as installed
            `);

            const hasExt = extCheck.rows?.[0]?.['installed'] as boolean ?? false;
            if (!hasExt) {
                return {
                    success: false,
                    error: 'pgcrypto extension is not installed',
                    hint: 'Run pg_pgcrypto_create_extension first'
                };
            }

            const result = await adapter.executeQuery(`
                SELECT gen_random_uuid()::text as uuid
                FROM generate_series(1, $1)
            `, [generateCount]);

            const uuids = (result.rows ?? []).map(r => r['uuid'] as string);

            return {
                success: true,
                uuids,
                count: uuids.length
            };
        }
    };
}

/**
 * Generate random bytes
 */
function createPgcryptoGenRandomBytesTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_pgcrypto_gen_random_bytes',
        description: `Generate cryptographically secure random bytes.
Useful for creating salts, tokens, API keys, and other random data.`,
        group: 'pgcrypto',
        inputSchema: PgcryptoRandomBytesSchema,
        handler: async (params: unknown, _context: RequestContext) => {
            const { length, encoding } = PgcryptoRandomBytesSchema.parse(params);
            const enc = encoding ?? 'hex';

            const extCheck = await adapter.executeQuery(`
                SELECT EXISTS(
                    SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto'
                ) as installed
            `);

            const hasExt = extCheck.rows?.[0]?.['installed'] as boolean ?? false;
            if (!hasExt) {
                return {
                    success: false,
                    error: 'pgcrypto extension is not installed',
                    hint: 'Run pg_pgcrypto_create_extension first'
                };
            }

            const encodeFormat = enc === 'base64' ? 'base64' : 'hex';
            const result = await adapter.executeQuery(`
                SELECT encode(gen_random_bytes($1), $2) as random_bytes
            `, [length, encodeFormat]);

            return {
                success: true,
                randomBytes: result.rows?.[0]?.['random_bytes'] as string,
                length,
                encoding: enc
            };
        }
    };
}

/**
 * Generate salt for password hashing
 */
function createPgcryptoGenSaltTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_pgcrypto_gen_salt',
        description: `Generate a salt for use with crypt() password hashing.
Supports bcrypt (bf), md5, xdes, and des algorithms. bcrypt is recommended.`,
        group: 'pgcrypto',
        inputSchema: PgcryptoGenSaltSchema,
        handler: async (params: unknown, _context: RequestContext) => {
            const { type, iterations } = PgcryptoGenSaltSchema.parse(params);

            const extCheck = await adapter.executeQuery(`
                SELECT EXISTS(
                    SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto'
                ) as installed
            `);

            const hasExt = extCheck.rows?.[0]?.['installed'] as boolean ?? false;
            if (!hasExt) {
                return {
                    success: false,
                    error: 'pgcrypto extension is not installed',
                    hint: 'Run pg_pgcrypto_create_extension first'
                };
            }

            let result;
            if (iterations !== undefined && (type === 'bf' || type === 'xdes')) {
                result = await adapter.executeQuery(`
                    SELECT gen_salt($1, $2) as salt
                `, [type, iterations]);
            } else {
                result = await adapter.executeQuery(`
                    SELECT gen_salt($1) as salt
                `, [type]);
            }

            return {
                success: true,
                salt: result.rows?.[0]?.['salt'] as string,
                type,
                usage: 'Use this salt with pg_pgcrypto_crypt to hash passwords'
            };
        }
    };
}

/**
 * Hash password with crypt()
 */
function createPgcryptoCryptTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_pgcrypto_crypt',
        description: `Hash a password using crypt() with a salt from gen_salt().
For verification, call crypt() with the stored hash as the salt - if result matches, password is correct.

Example workflow:
1. Generate salt: pg_pgcrypto_gen_salt(type='bf')
2. Hash password: pg_pgcrypto_crypt(password, salt) → store this hash
3. Verify: pg_pgcrypto_crypt(input_password, stored_hash) === stored_hash`,
        group: 'pgcrypto',
        inputSchema: PgcryptoCryptSchema,
        handler: async (params: unknown, _context: RequestContext) => {
            const { password, salt } = PgcryptoCryptSchema.parse(params);

            const extCheck = await adapter.executeQuery(`
                SELECT EXISTS(
                    SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto'
                ) as installed
            `);

            const hasExt = extCheck.rows?.[0]?.['installed'] as boolean ?? false;
            if (!hasExt) {
                return {
                    success: false,
                    error: 'pgcrypto extension is not installed',
                    hint: 'Run pg_pgcrypto_create_extension first'
                };
            }

            const result = await adapter.executeQuery(`
                SELECT crypt($1, $2) as hash
            `, [password, salt]);

            const hash = result.rows?.[0]?.['hash'] as string;

            // Detect algorithm from salt prefix
            const algorithm = (() => {
                if (salt.startsWith('$2a$') || salt.startsWith('$2b$')) {
                    return 'bcrypt';
                } else if (salt.startsWith('$1$')) {
                    return 'md5';
                } else if (salt.startsWith('_')) {
                    return 'xdes';
                } else {
                    return 'des';
                }
            })();

            return {
                success: true,
                hash,
                algorithm,
                note: 'To verify a password, call crypt(input_password, stored_hash) and compare result to stored_hash'
            };
        }
    };
}
