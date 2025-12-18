/**
 * Unit tests for identifier sanitization utility
 */

import { describe, it, expect } from 'vitest';
import {
    validateIdentifier,
    sanitizeIdentifier,
    sanitizeTableName,
    sanitizeColumnRef,
    sanitizeIdentifiers,
    generateIndexName,
    InvalidIdentifierError
} from '../../utils/identifiers.js';

describe('Identifier Sanitization', () => {
    describe('validateIdentifier', () => {
        it('should accept valid simple identifiers', () => {
            expect(() => validateIdentifier('users')).not.toThrow();
            expect(() => validateIdentifier('User')).not.toThrow();
            expect(() => validateIdentifier('_private')).not.toThrow();
            expect(() => validateIdentifier('table1')).not.toThrow();
            expect(() => validateIdentifier('my_table_name')).not.toThrow();
        });

        it('should accept valid identifiers with $', () => {
            expect(() => validateIdentifier('pg$temp')).not.toThrow();
            expect(() => validateIdentifier('table$1')).not.toThrow();
        });

        it('should reject identifiers starting with numbers', () => {
            expect(() => validateIdentifier('1table')).toThrow(InvalidIdentifierError);
            expect(() => validateIdentifier('123')).toThrow(InvalidIdentifierError);
        });

        it('should reject identifiers with special characters', () => {
            expect(() => validateIdentifier('table-name')).toThrow(InvalidIdentifierError);
            expect(() => validateIdentifier('table.name')).toThrow(InvalidIdentifierError);
            expect(() => validateIdentifier('table;name')).toThrow(InvalidIdentifierError);
            expect(() => validateIdentifier('table name')).toThrow(InvalidIdentifierError);
            expect(() => validateIdentifier("table'name")).toThrow(InvalidIdentifierError);
        });

        it('should reject SQL injection attempts', () => {
            expect(() => validateIdentifier('users"; DROP TABLE users;--')).toThrow(InvalidIdentifierError);
            expect(() => validateIdentifier('users" OR "1"="1')).toThrow(InvalidIdentifierError);
        });

        it('should reject empty strings', () => {
            expect(() => validateIdentifier('')).toThrow(InvalidIdentifierError);
        });

        it('should reject oversized identifiers (>63 chars)', () => {
            const longName = 'a'.repeat(64);
            expect(() => validateIdentifier(longName)).toThrow(InvalidIdentifierError);
            expect(() => validateIdentifier('a'.repeat(63))).not.toThrow();
        });
    });

    describe('sanitizeIdentifier', () => {
        it('should quote valid identifiers', () => {
            expect(sanitizeIdentifier('users')).toBe('"users"');
            expect(sanitizeIdentifier('MyTable')).toBe('"MyTable"');
            expect(sanitizeIdentifier('_private')).toBe('"_private"');
        });

        it('should throw for invalid identifiers', () => {
            expect(() => sanitizeIdentifier('table;drop')).toThrow(InvalidIdentifierError);
            expect(() => sanitizeIdentifier('')).toThrow(InvalidIdentifierError);
            expect(() => sanitizeIdentifier('1table')).toThrow(InvalidIdentifierError);
        });

        it('should prevent SQL injection via identifier', () => {
            // These should all throw
            expect(() => sanitizeIdentifier('users"; DROP TABLE users;--')).toThrow(InvalidIdentifierError);
            expect(() => sanitizeIdentifier('a; SELECT * FROM passwords;--')).toThrow(InvalidIdentifierError);
        });
    });

    describe('sanitizeTableName', () => {
        it('should quote simple table names', () => {
            expect(sanitizeTableName('users')).toBe('"users"');
            expect(sanitizeTableName('UserProfiles')).toBe('"UserProfiles"');
        });

        it('should handle schema-qualified names', () => {
            expect(sanitizeTableName('users', 'public')).toBe('"public"."users"');
            expect(sanitizeTableName('accounts', 'myschema')).toBe('"myschema"."accounts"');
        });

        it('should throw for invalid table names', () => {
            expect(() => sanitizeTableName('table;drop')).toThrow(InvalidIdentifierError);
        });

        it('should throw for invalid schema names', () => {
            expect(() => sanitizeTableName('users', 'bad;schema')).toThrow(InvalidIdentifierError);
        });
    });

    describe('sanitizeColumnRef', () => {
        it('should handle simple column references', () => {
            expect(sanitizeColumnRef('id')).toBe('"id"');
            expect(sanitizeColumnRef('created_at')).toBe('"created_at"');
        });

        it('should handle column with table qualifier', () => {
            expect(sanitizeColumnRef('id', 'users')).toBe('"users"."id"');
            expect(sanitizeColumnRef('balance', 'accounts')).toBe('"accounts"."balance"');
        });

        it('should throw for invalid column names', () => {
            expect(() => sanitizeColumnRef('bad;column')).toThrow(InvalidIdentifierError);
        });
    });

    describe('sanitizeIdentifiers', () => {
        it('should sanitize array of identifiers', () => {
            const result = sanitizeIdentifiers(['id', 'name', 'email']);
            expect(result).toEqual(['"id"', '"name"', '"email"']);
        });

        it('should throw if any identifier is invalid', () => {
            expect(() => sanitizeIdentifiers(['id', 'bad;name', 'email'])).toThrow(InvalidIdentifierError);
        });

        it('should handle empty array', () => {
            expect(sanitizeIdentifiers([])).toEqual([]);
        });
    });

    describe('generateIndexName', () => {
        it('should generate valid index name', () => {
            const name = generateIndexName('users', 'email');
            expect(name).toBe('"idx_users_email"');
        });

        it('should handle column array', () => {
            const name = generateIndexName('users', ['first_name', 'last_name']);
            expect(name).toBe('"idx_users_first_name_last_name"');
        });

        it('should truncate long names to 63 chars', () => {
            const longTable = 'a'.repeat(30);
            const longColumn = 'b'.repeat(30);
            const name = generateIndexName(longTable, longColumn);
            // The result includes quotes, but the inner identifier must be <= 63
            expect(name.length).toBeLessThanOrEqual(65); // 63 + 2 for quotes
        });

        it('should use custom prefix', () => {
            const name = generateIndexName('users', 'email', 'ix');
            expect(name).toBe('"ix_users_email"');
        });
    });

    describe('SQL injection prevention', () => {
        it('should prevent DROP TABLE injection via table name', () => {
            // Classic SQL injection attempt
            expect(() => sanitizeTableName('users"; DROP TABLE users;--')).toThrow(InvalidIdentifierError);
        });

        it('should prevent UNION injection via column name', () => {
            expect(() => sanitizeIdentifier('id UNION SELECT password FROM users--')).toThrow(InvalidIdentifierError);
        });

        it('should prevent comment injection', () => {
            expect(() => sanitizeIdentifier('id--')).toThrow(InvalidIdentifierError);
        });
    });
});
