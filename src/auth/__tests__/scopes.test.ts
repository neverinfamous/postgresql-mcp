/**
 * postgres-mcp - OAuth Scopes Tests
 *
 * Tests for scope definitions, parsing, matching, and tool group mapping.
 */

import { describe, it, expect } from 'vitest';
import {
    SCOPES,
    ALL_SCOPES,
    TOOL_GROUP_SCOPES,
    parseScopes,
    hasScope,
    hasAnyScope,
    hasAllScopes,
    getScopeForToolGroup,
    hasDatabaseScope,
    hasSchemaScope,
    hasTableScope,
    getScopeDisplayName
} from '../scopes.js';

describe('OAuth Scopes', () => {
    describe('SCOPES constant', () => {
        it('should define standard scopes', () => {
            expect(SCOPES.READ).toBe('read');
            expect(SCOPES.WRITE).toBe('write');
            expect(SCOPES.ADMIN).toBe('admin');
            expect(SCOPES.FULL).toBe('full');
        });
    });

    describe('ALL_SCOPES constant', () => {
        it('should include all standard scopes', () => {
            expect(ALL_SCOPES).toContain('read');
            expect(ALL_SCOPES).toContain('write');
            expect(ALL_SCOPES).toContain('admin');
            expect(ALL_SCOPES).toContain('full');
        });
    });

    describe('TOOL_GROUP_SCOPES mapping', () => {
        it('should map core groups to read scope', () => {
            expect(TOOL_GROUP_SCOPES.core).toBe('read');
            expect(TOOL_GROUP_SCOPES.jsonb).toBe('read');
            expect(TOOL_GROUP_SCOPES.text).toBe('read');
            expect(TOOL_GROUP_SCOPES.stats).toBe('read');
        });

        it('should map write operations to write scope', () => {
            expect(TOOL_GROUP_SCOPES.transactions).toBe('write');
        });

        it('should map administrative groups to admin scope', () => {
            expect(TOOL_GROUP_SCOPES.admin).toBe('admin');
            expect(TOOL_GROUP_SCOPES.backup).toBe('admin');
            expect(TOOL_GROUP_SCOPES.partitioning).toBe('admin');
            expect(TOOL_GROUP_SCOPES.cron).toBe('admin');
            expect(TOOL_GROUP_SCOPES.partman).toBe('admin');
        });

        it('should map extension groups appropriately', () => {
            expect(TOOL_GROUP_SCOPES.vector).toBe('read');
            expect(TOOL_GROUP_SCOPES.postgis).toBe('read');
            expect(TOOL_GROUP_SCOPES.citext).toBe('read');
            expect(TOOL_GROUP_SCOPES.ltree).toBe('read');
        });
    });

    describe('parseScopes', () => {
        it('should parse space-delimited scope string', () => {
            const scopes = parseScopes('read write admin');

            expect(scopes).toEqual(['read', 'write', 'admin']);
        });

        it('should handle single scope', () => {
            const scopes = parseScopes('read');

            expect(scopes).toEqual(['read']);
        });

        it('should handle empty string', () => {
            const scopes = parseScopes('');

            expect(scopes).toEqual([]);
        });

        it('should handle undefined', () => {
            const scopes = parseScopes(undefined);

            expect(scopes).toEqual([]);
        });

        it('should filter out empty strings from extra spaces', () => {
            const scopes = parseScopes('read  write   admin');

            expect(scopes).toEqual(['read', 'write', 'admin']);
        });

        it('should handle pattern scopes', () => {
            const scopes = parseScopes('read db:mydb table:public:users');

            expect(scopes).toEqual(['read', 'db:mydb', 'table:public:users']);
        });
    });

    describe('hasScope', () => {
        it('should return true for direct match', () => {
            expect(hasScope(['read', 'write'], 'read')).toBe(true);
            expect(hasScope(['read', 'write'], 'write')).toBe(true);
        });

        it('should return false when scope not present', () => {
            expect(hasScope(['read'], 'write')).toBe(false);
            expect(hasScope(['read'], 'admin')).toBe(false);
        });

        it('should grant full access from full scope', () => {
            expect(hasScope(['full'], 'read')).toBe(true);
            expect(hasScope(['full'], 'write')).toBe(true);
            expect(hasScope(['full'], 'admin')).toBe(true);
            expect(hasScope(['full'], 'anything')).toBe(true);
        });

        it('should grant read and write access from admin scope', () => {
            expect(hasScope(['admin'], 'read')).toBe(true);
            expect(hasScope(['admin'], 'write')).toBe(true);
        });

        it('should grant read access from write scope', () => {
            expect(hasScope(['write'], 'read')).toBe(true);
            expect(hasScope(['write'], 'admin')).toBe(false);
        });

        it('should not grant admin access from read/write', () => {
            expect(hasScope(['read'], 'admin')).toBe(false);
            expect(hasScope(['write'], 'admin')).toBe(false);
        });

        it('should handle empty scopes array', () => {
            expect(hasScope([], 'read')).toBe(false);
        });
    });

    describe('hasAnyScope', () => {
        it('should return true if any scope matches', () => {
            expect(hasAnyScope(['read'], ['read', 'write'])).toBe(true);
            expect(hasAnyScope(['write'], ['read', 'write'])).toBe(true);
        });

        it('should return false if no scope matches', () => {
            expect(hasAnyScope(['read'], ['admin', 'write'])).toBe(false);
        });

        it('should consider scope hierarchy', () => {
            expect(hasAnyScope(['full'], ['admin'])).toBe(true);
            expect(hasAnyScope(['admin'], ['read', 'write'])).toBe(true);
        });

        it('should handle empty required scopes', () => {
            expect(hasAnyScope(['read'], [])).toBe(false);
        });
    });

    describe('hasAllScopes', () => {
        it('should return true if all scopes match', () => {
            expect(hasAllScopes(['read', 'write'], ['read', 'write'])).toBe(true);
        });

        it('should return false if any scope missing', () => {
            expect(hasAllScopes(['read'], ['read', 'write'])).toBe(false);
        });

        it('should consider scope hierarchy', () => {
            // Full grants everything
            expect(hasAllScopes(['full'], ['read', 'write', 'admin'])).toBe(true);
            // Admin grants read and write
            expect(hasAllScopes(['admin'], ['read', 'write'])).toBe(true);
        });

        it('should handle empty required scopes', () => {
            expect(hasAllScopes(['read'], [])).toBe(true);
        });
    });

    describe('getScopeForToolGroup', () => {
        it('should return correct scope for known groups', () => {
            expect(getScopeForToolGroup('core')).toBe('read');
            expect(getScopeForToolGroup('transactions')).toBe('write');
            expect(getScopeForToolGroup('admin')).toBe('admin');
        });

        it('should default to read for unknown groups', () => {
            // Type assertion needed for testing unknown group
            expect(getScopeForToolGroup('unknown' as never)).toBe('read');
        });
    });

    describe('hasDatabaseScope', () => {
        it('should match database pattern scope', () => {
            expect(hasDatabaseScope(['db:mydb'], 'mydb')).toBe(true);
            expect(hasDatabaseScope(['db:mydb'], 'otherdb')).toBe(false);
        });

        it('should grant access with full scope', () => {
            expect(hasDatabaseScope(['full'], 'anydb')).toBe(true);
        });

        it('should grant access with admin scope', () => {
            expect(hasDatabaseScope(['admin'], 'anydb')).toBe(true);
        });

        it('should not match without pattern scope', () => {
            expect(hasDatabaseScope(['read'], 'mydb')).toBe(false);
        });
    });

    describe('hasSchemaScope', () => {
        it('should match schema pattern scope', () => {
            expect(hasSchemaScope(['schema:public'], 'public')).toBe(true);
            expect(hasSchemaScope(['schema:public'], 'private')).toBe(false);
        });

        it('should grant access with full scope', () => {
            expect(hasSchemaScope(['full'], 'anyschema')).toBe(true);
        });

        it('should grant access with admin scope', () => {
            expect(hasSchemaScope(['admin'], 'anyschema')).toBe(true);
        });
    });

    describe('hasTableScope', () => {
        it('should match table pattern scope', () => {
            expect(hasTableScope(['table:public:users'], 'public', 'users')).toBe(true);
            expect(hasTableScope(['table:public:users'], 'public', 'orders')).toBe(false);
        });

        it('should inherit from schema scope', () => {
            expect(hasTableScope(['schema:public'], 'public', 'users')).toBe(true);
            expect(hasTableScope(['schema:public'], 'private', 'users')).toBe(false);
        });

        it('should grant access with full scope', () => {
            expect(hasTableScope(['full'], 'any', 'table')).toBe(true);
        });

        it('should grant access with admin scope', () => {
            expect(hasTableScope(['admin'], 'any', 'table')).toBe(true);
        });
    });

    describe('getScopeDisplayName', () => {
        it('should return friendly names for standard scopes', () => {
            expect(getScopeDisplayName('read')).toBe('Read Only');
            expect(getScopeDisplayName('write')).toBe('Read/Write');
            expect(getScopeDisplayName('admin')).toBe('Administrative');
            expect(getScopeDisplayName('full')).toBe('Full Access');
        });

        it('should format database scope', () => {
            expect(getScopeDisplayName('db:mydb')).toBe('Database: mydb');
        });

        it('should format schema scope', () => {
            expect(getScopeDisplayName('schema:public')).toBe('Schema: public');
        });

        it('should format table scope', () => {
            expect(getScopeDisplayName('table:public:users')).toBe('Table: public:users');
        });

        it('should return unknown scopes unchanged', () => {
            expect(getScopeDisplayName('custom:scope')).toBe('custom:scope');
        });
    });
});
