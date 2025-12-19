/**
 * postgres-mcp - Code Mode Sandbox
 * 
 * Sandboxed execution environment using Node.js vm module.
 * Provides code isolation with memory/time limits for LLM-generated code.
 * 
 * Note: This uses Node.js vm module which provides script isolation but not
 * true V8 isolate separation. For production environments with untrusted code,
 * consider using isolated-vm or running in a separate process/container.
 */

import vm from 'node:vm';
import { logger } from '../utils/logger.js';
import {
    DEFAULT_SANDBOX_OPTIONS,
    DEFAULT_POOL_OPTIONS,
    type SandboxOptions,
    type PoolOptions,
    type SandboxResult,
    type ExecutionMetrics
} from './types.js';

/**
 * A sandboxed execution context using Node.js vm module
 */
export class CodeModeSandbox {
    private context: vm.Context;
    private readonly options: Required<SandboxOptions>;
    private disposed = false;
    private readonly logBuffer: string[] = [];

    private constructor(
        context: vm.Context,
        options: Required<SandboxOptions>
    ) {
        this.context = context;
        this.options = options;
    }

    /**
     * Create a new sandbox instance
     */
    static create(options?: SandboxOptions): CodeModeSandbox {
        const opts = { ...DEFAULT_SANDBOX_OPTIONS, ...options };

        // Create a shared log buffer that will be used by both sandbox console and instance
        const sharedLogBuffer: string[] = [];

        // Create a minimal sandbox context
        const sandbox = {
            console: {
                log: (...args: unknown[]) => {
                    sharedLogBuffer.push(args.map(a =>
                        typeof a === 'object' && a !== null ? JSON.stringify(a) : String(a)
                    ).join(' '));
                },
                warn: (...args: unknown[]) => sharedLogBuffer.push('[WARN] ' + args.map(a => typeof a === 'object' && a !== null ? JSON.stringify(a) : String(a)).join(' ')),
                error: (...args: unknown[]) => sharedLogBuffer.push('[ERROR] ' + args.map(a => typeof a === 'object' && a !== null ? JSON.stringify(a) : String(a)).join(' ')),
                info: (...args: unknown[]) => sharedLogBuffer.push('[INFO] ' + args.map(a => typeof a === 'object' && a !== null ? JSON.stringify(a) : String(a)).join(' '))
            },
            // No access to Node.js globals
            require: undefined,
            process: undefined,
            global: undefined,
            globalThis: undefined,
            __dirname: undefined,
            __filename: undefined,
            module: undefined,
            exports: undefined,
            // Safe built-ins only
            JSON,
            Math,
            Date,
            Array,
            Object,
            String,
            Number,
            Boolean,
            Map,
            Set,
            Promise,
            Error,
            TypeError,
            RangeError,
            SyntaxError,
            // Async support
            setTimeout: undefined,  // Disabled for security
            setInterval: undefined, // Disabled for security
            setImmediate: undefined // Disabled for security
        };

        const context = vm.createContext(sandbox);
        const instance = new CodeModeSandbox(context, opts);

        // Use the shared buffer directly - replace instance's buffer with the shared one
        (instance as unknown as { logBuffer: string[] }).logBuffer = sharedLogBuffer;

        return instance;
    }

    /**
     * Execute code in the sandbox
     * @param code - TypeScript/JavaScript code to execute
     * @param apiBindings - Object with pg.* API methods to expose
     */
    async execute(
        code: string,
        apiBindings: Record<string, unknown>
    ): Promise<SandboxResult> {
        if (this.disposed) {
            return {
                success: false,
                error: 'Sandbox has been disposed',
                metrics: { wallTimeMs: 0, cpuTimeMs: 0, memoryUsedMb: 0 }
            };
        }

        const startTime = performance.now();
        const startMemory = process.memoryUsage().heapUsed;

        try {
            // Inject pg API bindings into the context
            this.context['pg'] = apiBindings;

            // Wrap code in async IIFE to support await
            const wrappedCode = `
                (async () => {
                    ${code}
                })();
            `;

            // Compile and run with timeout
            const script = new vm.Script(wrappedCode, {
                filename: 'codemode-script.js'
            });

            const result = await (script.runInContext(this.context, {
                timeout: this.options.timeoutMs,
                breakOnSigint: true
            }) as Promise<unknown>);

            const endTime = performance.now();
            const endMemory = process.memoryUsage().heapUsed;

            return {
                success: true,
                result,
                metrics: this.calculateMetrics(startTime, endTime, startMemory, endMemory)
            };
        } catch (error) {
            const endTime = performance.now();
            const endMemory = process.memoryUsage().heapUsed;

            const errorMessage = error instanceof Error ? error.message : String(error);
            const stack = error instanceof Error ? error.stack : undefined;

            // Check for specific error types
            if (errorMessage.includes('Script execution timed out')) {
                return {
                    success: false,
                    error: `Execution timeout: exceeded ${String(this.options.timeoutMs)}ms limit`,
                    stack,
                    metrics: this.calculateMetrics(startTime, endTime, startMemory, endMemory)
                };
            }

            return {
                success: false,
                error: errorMessage,
                stack,
                metrics: this.calculateMetrics(startTime, endTime, startMemory, endMemory)
            };
        }
    }

    /**
     * Calculate execution metrics
     */
    private calculateMetrics(
        startTime: number,
        endTime: number,
        startMemory: number,
        endMemory: number
    ): ExecutionMetrics {
        return {
            wallTimeMs: Math.round(endTime - startTime),
            cpuTimeMs: Math.round(endTime - startTime), // Approximation
            memoryUsedMb: Math.round((endMemory - startMemory) / (1024 * 1024) * 100) / 100
        };
    }

    /**
     * Get console output from the sandbox
     */
    getConsoleOutput(): string[] {
        return [...this.logBuffer];
    }

    /**
     * Clear console output buffer
     */
    clearConsoleOutput(): void {
        this.logBuffer.length = 0;
    }

    /**
     * Check if sandbox is healthy
     */
    isHealthy(): boolean {
        return !this.disposed;
    }

    /**
     * Dispose of the sandbox and release resources
     */
    dispose(): void {
        if (this.disposed) return;

        this.disposed = true;
        // vm.Context doesn't need explicit cleanup, but we mark as disposed
        this.logBuffer.length = 0;
    }
}

/**
 * Pool of sandbox instances for reuse
 */
export class SandboxPool {
    private readonly options: Required<PoolOptions>;
    private readonly sandboxOptions: Required<SandboxOptions>;
    private readonly available: CodeModeSandbox[] = [];
    private readonly inUse = new Set<CodeModeSandbox>();
    private disposed = false;
    private cleanupInterval: NodeJS.Timeout | null = null;

    constructor(poolOptions?: PoolOptions, sandboxOptions?: SandboxOptions) {
        this.options = { ...DEFAULT_POOL_OPTIONS, ...poolOptions };
        this.sandboxOptions = { ...DEFAULT_SANDBOX_OPTIONS, ...sandboxOptions };
    }

    /**
     * Initialize the pool with minimum instances
     */
    initialize(): void {
        logger.info(`Initializing sandbox pool with ${String(this.options.minInstances)} instances`, {
            module: 'CODEMODE' as const
        });

        for (let i = 0; i < this.options.minInstances; i++) {
            const sandbox = CodeModeSandbox.create(this.sandboxOptions);
            this.available.push(sandbox);
        }

        // Start cleanup interval
        this.cleanupInterval = setInterval(() => {
            this.cleanup();
        }, this.options.idleTimeoutMs);
    }

    /**
     * Acquire a sandbox from the pool
     */
    acquire(): CodeModeSandbox {
        if (this.disposed) {
            throw new Error('Pool has been disposed');
        }

        // Try to get an available sandbox
        while (this.available.length > 0) {
            const sandbox = this.available.pop();
            if (sandbox?.isHealthy()) {
                this.inUse.add(sandbox);
                return sandbox;
            }
            // Sandbox is unhealthy, dispose it
            sandbox?.dispose();
        }

        // Create a new sandbox if under limit
        const totalCount = this.inUse.size;
        if (totalCount < this.options.maxInstances) {
            const sandbox = CodeModeSandbox.create(this.sandboxOptions);
            this.inUse.add(sandbox);
            return sandbox;
        }

        // Pool exhausted
        throw new Error(`Sandbox pool exhausted (max: ${String(this.options.maxInstances)})`);
    }

    /**
     * Release a sandbox back to the pool
     */
    release(sandbox: CodeModeSandbox): void {
        if (!this.inUse.has(sandbox)) {
            return;
        }

        this.inUse.delete(sandbox);

        if (this.disposed) {
            sandbox.dispose();
            return;
        }

        // Return to pool if healthy and under limit
        if (sandbox.isHealthy() && this.available.length < this.options.maxInstances) {
            sandbox.clearConsoleOutput();
            this.available.push(sandbox);
        } else {
            sandbox.dispose();
        }
    }

    /**
     * Execute code using a pooled sandbox
     */
    async execute(
        code: string,
        apiBindings: Record<string, unknown>
    ): Promise<SandboxResult> {
        const sandbox = this.acquire();
        try {
            return await sandbox.execute(code, apiBindings);
        } finally {
            this.release(sandbox);
        }
    }

    /**
     * Clean up excess idle sandboxes
     */
    private cleanup(): void {
        // Remove unhealthy sandboxes
        const healthy: CodeModeSandbox[] = [];
        for (const sandbox of this.available) {
            if (sandbox.isHealthy()) {
                healthy.push(sandbox);
            } else {
                sandbox.dispose();
            }
        }
        this.available.length = 0;
        this.available.push(...healthy);

        // Trim to minimum
        while (this.available.length > this.options.minInstances) {
            const sandbox = this.available.pop();
            sandbox?.dispose();
        }
    }

    /**
     * Get pool statistics
     */
    getStats(): { available: number; inUse: number; max: number } {
        return {
            available: this.available.length,
            inUse: this.inUse.size,
            max: this.options.maxInstances
        };
    }

    /**
     * Dispose of all sandboxes in the pool
     */
    dispose(): void {
        if (this.disposed) return;

        this.disposed = true;

        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }

        for (const sandbox of this.available) {
            sandbox.dispose();
        }
        this.available.length = 0;

        for (const sandbox of this.inUse) {
            sandbox.dispose();
        }
        this.inUse.clear();

        logger.info('Sandbox pool disposed', { module: 'CODEMODE' as const });
    }
}
