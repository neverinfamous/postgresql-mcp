/**
 * Unit tests for Code Mode Sandbox
 * 
 * Tests sandbox creation, code execution, timeout handling,
 * and resource cleanup.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CodeModeSandbox, SandboxPool } from '../sandbox.js';

describe('CodeModeSandbox', () => {
    let sandbox: CodeModeSandbox;

    beforeEach(() => {
        sandbox = CodeModeSandbox.create();
    });

    afterEach(() => {
        sandbox.dispose();
    });

    describe('create()', () => {
        it('should create a sandbox instance', () => {
            expect(sandbox).toBeDefined();
            expect(sandbox.isHealthy()).toBe(true);
        });

        it('should accept custom options', () => {
            const customSandbox = CodeModeSandbox.create({
                timeoutMs: 5000,
                memoryLimitMb: 64
            });
            expect(customSandbox).toBeDefined();
            expect(customSandbox.isHealthy()).toBe(true);
            customSandbox.dispose();
        });
    });

    describe('execute()', () => {
        it('should execute simple code and return result', async () => {
            const result = await sandbox.execute(
                'return 1 + 2;',
                {}
            );
            expect(result.success).toBe(true);
            expect(result.result).toBe(3);
            expect(result.metrics.wallTimeMs).toBeGreaterThanOrEqual(0);
        });

        it('should execute async code', async () => {
            const result = await sandbox.execute(
                'return await Promise.resolve(42);',
                {}
            );
            expect(result.success).toBe(true);
            expect(result.result).toBe(42);
        });

        it('should provide access to pg bindings', async () => {
            const mockBindings = {
                core: {
                    listTables: async () => [{ name: 'users' }, { name: 'products' }]
                }
            };
            const result = await sandbox.execute(
                'const tables = await pg.core.listTables(); return tables.length;',
                mockBindings
            );
            expect(result.success).toBe(true);
            expect(result.result).toBe(2);
        });

        it('should handle execution errors', async () => {
            const result = await sandbox.execute(
                'throw new Error("test error");',
                {}
            );
            expect(result.success).toBe(false);
            expect(result.error).toContain('test error');
        });

        it('should block access to require', async () => {
            const result = await sandbox.execute(
                'const fs = require("fs"); return fs;',
                {}
            );
            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });

        it('should block access to process', async () => {
            const result = await sandbox.execute(
                'return process.env;',
                {}
            );
            expect(result.success).toBe(false);
            expect(result.error).toBeDefined();
        });

        it('should return error after disposed', async () => {
            sandbox.dispose();
            const result = await sandbox.execute('return 1;', {});
            expect(result.success).toBe(false);
            expect(result.error).toContain('disposed');
        });

        it('should provide execution metrics', async () => {
            const result = await sandbox.execute('return "test";', {});
            expect(result.metrics).toBeDefined();
            expect(result.metrics.wallTimeMs).toBeGreaterThanOrEqual(0);
            expect(result.metrics.cpuTimeMs).toBeGreaterThanOrEqual(0);
            expect(typeof result.metrics.memoryUsedMb).toBe('number');
        });
    });

    describe('dispose()', () => {
        it('should mark sandbox as unhealthy', () => {
            expect(sandbox.isHealthy()).toBe(true);
            sandbox.dispose();
            expect(sandbox.isHealthy()).toBe(false);
        });

        it('should be idempotent', () => {
            sandbox.dispose();
            sandbox.dispose(); // Should not throw
            expect(sandbox.isHealthy()).toBe(false);
        });
    });
});

describe('SandboxPool', () => {
    let pool: SandboxPool;

    beforeEach(() => {
        pool = new SandboxPool({ minInstances: 2, maxInstances: 5 });
        pool.initialize();
    });

    afterEach(() => {
        pool.dispose();
    });

    describe('initialize()', () => {
        it('should create minimum instances', () => {
            const stats = pool.getStats();
            expect(stats.available).toBe(2);
            expect(stats.inUse).toBe(0);
        });
    });

    describe('acquire()', () => {
        it('should return a sandbox from the pool', () => {
            const sandbox = pool.acquire();
            expect(sandbox).toBeDefined();
            expect(sandbox.isHealthy()).toBe(true);
            const stats = pool.getStats();
            expect(stats.inUse).toBe(1);
        });

        it('should create new sandboxes if pool is empty', () => {
            // Acquire more than minInstances
            const s1 = pool.acquire();
            const s2 = pool.acquire();
            const s3 = pool.acquire();
            expect(pool.getStats().inUse).toBe(3);
            pool.release(s1);
            pool.release(s2);
            pool.release(s3);
        });

        it('should throw when pool is exhausted', () => {
            const sandboxes: CodeModeSandbox[] = [];
            for (let i = 0; i < 5; i++) {
                sandboxes.push(pool.acquire());
            }
            expect(() => pool.acquire()).toThrowError(/exhausted/);
            sandboxes.forEach(s => pool.release(s));
        });

        it('should throw after disposed', () => {
            pool.dispose();
            expect(() => pool.acquire()).toThrowError(/disposed/);
        });
    });

    describe('release()', () => {
        it('should return sandbox to pool', () => {
            const sandbox = pool.acquire();
            expect(pool.getStats().inUse).toBe(1);
            pool.release(sandbox);
            expect(pool.getStats().inUse).toBe(0);
            expect(pool.getStats().available).toBeGreaterThan(0);
        });

        it('should ignore sandboxes not from pool', () => {
            const external = CodeModeSandbox.create();
            pool.release(external); // Should not throw
            external.dispose();
        });
    });

    describe('execute()', () => {
        it('should execute code and return result', async () => {
            const result = await pool.execute('return 5 * 5;', {});
            expect(result.success).toBe(true);
            expect(result.result).toBe(25);
        });

        it('should return sandbox to pool after execution', async () => {
            await pool.execute('return 1;', {});
            const stats = pool.getStats();
            expect(stats.inUse).toBe(0);
        });

        it('should return sandbox to pool even on error', async () => {
            await pool.execute('throw new Error("fail");', {});
            const stats = pool.getStats();
            expect(stats.inUse).toBe(0);
        });
    });

    describe('dispose()', () => {
        it('should clear all sandboxes', () => {
            pool.dispose();
            const stats = pool.getStats();
            expect(stats.available).toBe(0);
            expect(stats.inUse).toBe(0);
        });

        it('should be idempotent', () => {
            pool.dispose();
            pool.dispose(); // Should not throw
        });
    });
});
