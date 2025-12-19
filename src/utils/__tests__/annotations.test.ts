/**
 * Unit tests for Tool Annotations Presets
 * 
 * Tests the annotation presets and helper functions.
 */

import { describe, it, expect } from 'vitest';
import {
    READ_ONLY,
    WRITE,
    DESTRUCTIVE,
    IDEMPOTENT,
    ADMIN,
    withTitle,
    readOnly,
    write,
    destructive,
    idempotent,
    admin
} from '../annotations.js';

describe('Tool Annotations Presets', () => {
    describe('Base Presets', () => {
        it('READ_ONLY should have correct flags', () => {
            expect(READ_ONLY.readOnlyHint).toBe(true);
            expect(READ_ONLY.destructiveHint).toBe(false);
        });

        it('WRITE should have correct flags', () => {
            expect(WRITE.readOnlyHint).toBe(false);
            expect(WRITE.destructiveHint).toBe(false);
        });

        it('DESTRUCTIVE should have correct flags', () => {
            expect(DESTRUCTIVE.readOnlyHint).toBe(false);
            expect(DESTRUCTIVE.destructiveHint).toBe(true);
        });

        it('IDEMPOTENT should have correct flags', () => {
            expect(IDEMPOTENT.readOnlyHint).toBe(false);
            expect(IDEMPOTENT.destructiveHint).toBe(false);
            expect(IDEMPOTENT.idempotentHint).toBe(true);
        });

        it('ADMIN should have correct flags', () => {
            expect(ADMIN.readOnlyHint).toBe(false);
            expect(ADMIN.destructiveHint).toBe(false);
        });
    });

    describe('Helper Functions', () => {
        describe('withTitle', () => {
            it('should add title to default READ_ONLY base', () => {
                const result = withTitle('List Tables');
                expect(result.title).toBe('List Tables');
                expect(result.readOnlyHint).toBe(true);
                expect(result.destructiveHint).toBe(false);
            });

            it('should add title to custom base annotations', () => {
                const result = withTitle('Delete Row', DESTRUCTIVE);
                expect(result.title).toBe('Delete Row');
                expect(result.destructiveHint).toBe(true);
            });

            it('should add title to WRITE base', () => {
                const result = withTitle('Insert Data', WRITE);
                expect(result.title).toBe('Insert Data');
                expect(result.readOnlyHint).toBe(false);
            });
        });

        describe('readOnly', () => {
            it('should create read-only annotations with title', () => {
                const result = readOnly('Query Data');
                expect(result.title).toBe('Query Data');
                expect(result.readOnlyHint).toBe(true);
                expect(result.destructiveHint).toBe(false);
            });
        });

        describe('write', () => {
            it('should create write annotations with title', () => {
                const result = write('Create Table');
                expect(result.title).toBe('Create Table');
                expect(result.readOnlyHint).toBe(false);
                expect(result.destructiveHint).toBe(false);
            });
        });

        describe('destructive', () => {
            it('should create destructive annotations with title', () => {
                const result = destructive('Drop Table');
                expect(result.title).toBe('Drop Table');
                expect(result.readOnlyHint).toBe(false);
                expect(result.destructiveHint).toBe(true);
            });
        });

        describe('idempotent', () => {
            it('should create idempotent annotations with title', () => {
                const result = idempotent('Upsert Record');
                expect(result.title).toBe('Upsert Record');
                expect(result.readOnlyHint).toBe(false);
                expect(result.destructiveHint).toBe(false);
                expect(result.idempotentHint).toBe(true);
            });
        });

        describe('admin', () => {
            it('should create admin annotations with title', () => {
                const result = admin('VACUUM Table');
                expect(result.title).toBe('VACUUM Table');
                expect(result.readOnlyHint).toBe(false);
                expect(result.destructiveHint).toBe(false);
            });
        });
    });
});
