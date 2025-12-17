/**
 * PostgreSQL pgcrypto Extension Tools
 * 9 tools total.
 */

import type { PostgresAdapter } from '../PostgresAdapter.js';
import type { ToolDefinition, RequestContext } from '../../../types/index.js';
import { z } from 'zod';
import { readOnly, write } from '../../../utils/annotations.js';
import {
    PgcryptoHashSchema, PgcryptoHmacSchema, PgcryptoEncryptSchema,
    PgcryptoDecryptSchema, PgcryptoRandomBytesSchema, PgcryptoGenSaltSchema, PgcryptoCryptSchema
} from '../types.js';

export function getPgcryptoTools(adapter: PostgresAdapter): ToolDefinition[] {
    return [
        createPgcryptoExtensionTool(adapter), createPgcryptoHashTool(adapter),
        createPgcryptoHmacTool(adapter), createPgcryptoEncryptTool(adapter),
        createPgcryptoDecryptTool(adapter), createPgcryptoGenRandomUuidTool(adapter),
        createPgcryptoGenRandomBytesTool(adapter), createPgcryptoGenSaltTool(adapter),
        createPgcryptoCryptTool(adapter)
    ];
}

function createPgcryptoExtensionTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_pgcrypto_create_extension',
        description: 'Enable the pgcrypto extension for cryptographic functions.',
        group: 'pgcrypto',
        inputSchema: z.object({}),
        annotations: write('Create Pgcrypto Extension'),
        handler: async (_params: unknown, _context: RequestContext) => {
            await adapter.executeQuery('CREATE EXTENSION IF NOT EXISTS pgcrypto');
            return { success: true, message: 'pgcrypto extension enabled' };
        }
    };
}

function createPgcryptoHashTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_pgcrypto_hash',
        description: 'Hash data using various algorithms (SHA-256, SHA-512, MD5, etc.).',
        group: 'pgcrypto',
        inputSchema: PgcryptoHashSchema,
        annotations: readOnly('Hash Data'),
        handler: async (params: unknown, _context: RequestContext) => {
            const { data, algorithm, encoding } = PgcryptoHashSchema.parse(params);
            const enc = encoding ?? 'hex';
            const encodeFunc = enc === 'base64' ? "encode(digest($1, $2), 'base64')" : "encode(digest($1, $2), 'hex')";
            const result = await adapter.executeQuery(`SELECT ${encodeFunc} as hash`, [data, algorithm]);
            return { success: true, algorithm, encoding: enc, hash: result.rows?.[0]?.['hash'] as string, inputLength: data.length };
        }
    };
}

function createPgcryptoHmacTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_pgcrypto_hmac',
        description: 'Compute HMAC for data with a secret key.',
        group: 'pgcrypto',
        inputSchema: PgcryptoHmacSchema,
        annotations: readOnly('HMAC'),
        handler: async (params: unknown, _context: RequestContext) => {
            const { data, key, algorithm, encoding } = PgcryptoHmacSchema.parse(params);
            const enc = encoding ?? 'hex';
            const encodeFunc = enc === 'base64' ? "encode(hmac($1, $2, $3), 'base64')" : "encode(hmac($1, $2, $3), 'hex')";
            const result = await adapter.executeQuery(`SELECT ${encodeFunc} as hmac`, [data, key, algorithm]);
            return { success: true, algorithm, encoding: enc, hmac: result.rows?.[0]?.['hmac'] as string };
        }
    };
}

function createPgcryptoEncryptTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_pgcrypto_encrypt',
        description: 'Encrypt data using PGP symmetric encryption.',
        group: 'pgcrypto',
        inputSchema: PgcryptoEncryptSchema,
        annotations: readOnly('Encrypt Data'),
        handler: async (params: unknown, _context: RequestContext) => {
            const { data, password, options } = PgcryptoEncryptSchema.parse(params);
            const sql = options !== undefined
                ? `SELECT encode(pgp_sym_encrypt($1, $2, $3), 'base64') as encrypted`
                : `SELECT encode(pgp_sym_encrypt($1, $2), 'base64') as encrypted`;
            const queryParams = options !== undefined ? [data, password, options] : [data, password];
            const result = await adapter.executeQuery(sql, queryParams);
            return { success: true, encrypted: result.rows?.[0]?.['encrypted'] as string, encoding: 'base64' };
        }
    };
}

function createPgcryptoDecryptTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_pgcrypto_decrypt',
        description: 'Decrypt data that was encrypted with pg_pgcrypto_encrypt.',
        group: 'pgcrypto',
        inputSchema: PgcryptoDecryptSchema,
        annotations: readOnly('Decrypt Data'),
        handler: async (params: unknown, _context: RequestContext) => {
            const { encryptedData, password } = PgcryptoDecryptSchema.parse(params);
            try {
                const result = await adapter.executeQuery(`SELECT pgp_sym_decrypt(decode($1, 'base64'), $2) as decrypted`, [encryptedData, password]);
                return { success: true, decrypted: result.rows?.[0]?.['decrypted'] as string };
            } catch (error) {
                return { success: false, error: 'Decryption failed - wrong password or corrupted data', details: String(error) };
            }
        }
    };
}

function createPgcryptoGenRandomUuidTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_pgcrypto_gen_random_uuid',
        description: 'Generate a cryptographically secure UUID v4.',
        group: 'pgcrypto',
        inputSchema: z.object({ count: z.number().min(1).max(100).optional().describe('Number of UUIDs to generate (default: 1)') }),
        annotations: readOnly('Generate UUID'),
        handler: async (params: unknown, _context: RequestContext) => {
            const { count } = (params as { count?: number });
            const generateCount = count ?? 1;
            const result = await adapter.executeQuery(`SELECT gen_random_uuid()::text as uuid FROM generate_series(1, $1)`, [generateCount]);
            const uuids = (result.rows ?? []).map(r => r['uuid'] as string);
            return { success: true, uuids, count: uuids.length };
        }
    };
}

function createPgcryptoGenRandomBytesTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_pgcrypto_gen_random_bytes',
        description: 'Generate cryptographically secure random bytes.',
        group: 'pgcrypto',
        inputSchema: PgcryptoRandomBytesSchema,
        annotations: readOnly('Generate Random Bytes'),
        handler: async (params: unknown, _context: RequestContext) => {
            const { length, encoding } = PgcryptoRandomBytesSchema.parse(params);
            const enc = encoding ?? 'hex';
            const encodeFormat = enc === 'base64' ? 'base64' : 'hex';
            const result = await adapter.executeQuery(`SELECT encode(gen_random_bytes($1), $2) as random_bytes`, [length, encodeFormat]);
            return { success: true, randomBytes: result.rows?.[0]?.['random_bytes'] as string, length, encoding: enc };
        }
    };
}

function createPgcryptoGenSaltTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_pgcrypto_gen_salt',
        description: 'Generate a salt for use with crypt() password hashing.',
        group: 'pgcrypto',
        inputSchema: PgcryptoGenSaltSchema,
        annotations: readOnly('Generate Salt'),
        handler: async (params: unknown, _context: RequestContext) => {
            const { type, iterations } = PgcryptoGenSaltSchema.parse(params);
            const result = iterations !== undefined && (type === 'bf' || type === 'xdes')
                ? await adapter.executeQuery(`SELECT gen_salt($1, $2) as salt`, [type, iterations])
                : await adapter.executeQuery(`SELECT gen_salt($1) as salt`, [type]);
            return { success: true, salt: result.rows?.[0]?.['salt'] as string, type };
        }
    };
}

function createPgcryptoCryptTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_pgcrypto_crypt',
        description: 'Hash a password using crypt() with a salt from gen_salt().',
        group: 'pgcrypto',
        inputSchema: PgcryptoCryptSchema,
        annotations: readOnly('Crypt Password'),
        handler: async (params: unknown, _context: RequestContext) => {
            const { password, salt } = PgcryptoCryptSchema.parse(params);
            const result = await adapter.executeQuery(`SELECT crypt($1, $2) as hash`, [password, salt]);
            const hash = result.rows?.[0]?.['hash'] as string;
            const algorithm = salt.startsWith('$2a$') || salt.startsWith('$2b$') ? 'bcrypt'
                : salt.startsWith('$1$') ? 'md5' : salt.startsWith('_') ? 'xdes' : 'des';
            return { success: true, hash, algorithm };
        }
    };
}
