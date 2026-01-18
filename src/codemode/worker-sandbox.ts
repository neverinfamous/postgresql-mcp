/**
 * postgres-mcp - Code Mode Worker Sandbox
 *
 * Enhanced sandboxed execution using worker_threads for process-level isolation.
 * Provides stronger isolation than vm module by running code in a separate thread
 * with isolated memory space.
 *
 * Features:
 * - Separate V8 instance per worker thread
 * - Hard timeout enforcement (worker termination)
 * - Isolated memory space
 * - Clean process state on each execution
 */

import { Worker } from "node:worker_threads";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { logger } from "../utils/logger.js";
import {
  DEFAULT_SANDBOX_OPTIONS,
  DEFAULT_POOL_OPTIONS,
  type SandboxOptions,
  type PoolOptions,
  type SandboxResult,
  type ExecutionMetrics,
} from "./types.js";

// Get directory for worker script
const __dirname = dirname(fileURLToPath(import.meta.url));
const WORKER_SCRIPT_PATH = join(__dirname, "worker-script.js");

/**
 * A sandboxed execution context using worker_threads
 * Provides stronger isolation than vm module with separate V8 instance
 */
export class WorkerSandbox {
  private readonly options: Required<SandboxOptions>;
  private disposed = false;

  private constructor(options: Required<SandboxOptions>) {
    this.options = options;
  }

  /**
   * Create a new worker sandbox instance
   */
  static create(options?: SandboxOptions): WorkerSandbox {
    const opts = { ...DEFAULT_SANDBOX_OPTIONS, ...options };
    return new WorkerSandbox(opts);
  }

  /**
   * Execute code in a worker thread
   * Each execution spawns a fresh worker for maximum isolation
   */
  async execute(
    code: string,
    apiBindings: Record<string, unknown>,
  ): Promise<SandboxResult> {
    if (this.disposed) {
      return {
        success: false,
        error: "Sandbox has been disposed",
        metrics: { wallTimeMs: 0, cpuTimeMs: 0, memoryUsedMb: 0 },
      };
    }

    const startTime = performance.now();
    const startMemory = process.memoryUsage().heapUsed;

    return new Promise((resolve) => {
      let worker: Worker | null = null;
      let timeoutId: NodeJS.Timeout | null = null;
      let resolved = false;

      const cleanup = (): void => {
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        if (worker) {
          worker.terminate().catch((): void => {
            /* intentionally empty */
          });
          worker = null;
        }
      };

      const respond = (result: SandboxResult): void => {
        if (resolved) return;
        resolved = true;
        cleanup();
        resolve(result);
      };

      try {
        worker = new Worker(WORKER_SCRIPT_PATH, {
          workerData: {
            code,
            apiBindings: this.serializeBindings(apiBindings),
            timeout: this.options.timeoutMs,
          },
        });

        // Set hard timeout (will kill worker)
        timeoutId = setTimeout(() => {
          const endTime = performance.now();
          const endMemory = process.memoryUsage().heapUsed;
          respond({
            success: false,
            error: `Execution timeout: exceeded ${String(this.options.timeoutMs)}ms limit`,
            metrics: this.calculateMetrics(
              startTime,
              endTime,
              startMemory,
              endMemory,
            ),
          });
        }, this.options.timeoutMs + 1000); // Extra buffer for cleanup

        worker.on(
          "message",
          (result: {
            success: boolean;
            result?: unknown;
            error?: string;
            stack?: string;
          }) => {
            const endTime = performance.now();
            const endMemory = process.memoryUsage().heapUsed;
            respond({
              success: result.success,
              result: result.result,
              error: result.error,
              stack: result.stack,
              metrics: this.calculateMetrics(
                startTime,
                endTime,
                startMemory,
                endMemory,
              ),
            });
          },
        );

        worker.on("error", (error: Error) => {
          const endTime = performance.now();
          const endMemory = process.memoryUsage().heapUsed;
          respond({
            success: false,
            error: error.message,
            stack: error.stack,
            metrics: this.calculateMetrics(
              startTime,
              endTime,
              startMemory,
              endMemory,
            ),
          });
        });

        worker.on("exit", (exitCode: number) => {
          if (!resolved && exitCode !== 0) {
            const endTime = performance.now();
            const endMemory = process.memoryUsage().heapUsed;
            respond({
              success: false,
              error: `Worker exited with code ${String(exitCode)}`,
              metrics: this.calculateMetrics(
                startTime,
                endTime,
                startMemory,
                endMemory,
              ),
            });
          }
        });
      } catch (error) {
        const endTime = performance.now();
        const endMemory = process.memoryUsage().heapUsed;
        respond({
          success: false,
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
          metrics: this.calculateMetrics(
            startTime,
            endTime,
            startMemory,
            endMemory,
          ),
        });
      }
    });
  }

  /**
   * Serialize API bindings for worker transfer
   * We can't transfer functions directly, so we send method names
   */
  private serializeBindings(
    bindings: Record<string, unknown>,
  ): Record<string, string[]> {
    const serialized: Record<string, string[]> = {};
    for (const [group, methods] of Object.entries(bindings)) {
      if (typeof methods === "object" && methods !== null) {
        serialized[group] = Object.keys(methods);
      }
    }
    return serialized;
  }

  /**
   * Calculate execution metrics
   */
  private calculateMetrics(
    startTime: number,
    endTime: number,
    startMemory: number,
    endMemory: number,
  ): ExecutionMetrics {
    return {
      wallTimeMs: Math.round(endTime - startTime),
      cpuTimeMs: Math.round(endTime - startTime), // Approximation
      memoryUsedMb:
        Math.round(((endMemory - startMemory) / (1024 * 1024)) * 100) / 100,
    };
  }

  /**
   * Check if sandbox is healthy
   */
  isHealthy(): boolean {
    return !this.disposed;
  }

  /**
   * Dispose of the sandbox
   */
  dispose(): void {
    this.disposed = true;
  }
}

/**
 * Pool of worker sandboxes
 * Unlike VM pool, worker sandboxes are created fresh for each execution
 * so this pool is simpler (mainly for statistics and control)
 */
export class WorkerSandboxPool {
  private readonly options: Required<PoolOptions>;
  private readonly sandboxOptions: Required<SandboxOptions>;
  private activeCount = 0;
  private disposed = false;

  constructor(poolOptions?: PoolOptions, sandboxOptions?: SandboxOptions) {
    this.options = { ...DEFAULT_POOL_OPTIONS, ...poolOptions };
    this.sandboxOptions = { ...DEFAULT_SANDBOX_OPTIONS, ...sandboxOptions };
  }

  /**
   * Initialize the pool
   */
  initialize(): void {
    logger.info(
      `Worker sandbox pool initialized (max: ${String(this.options.maxInstances)} concurrent)`,
      {
        module: "CODEMODE" as const,
      },
    );
  }

  /**
   * Execute code using a worker sandbox
   */
  async execute(
    code: string,
    apiBindings: Record<string, unknown>,
  ): Promise<SandboxResult> {
    if (this.disposed) {
      return {
        success: false,
        error: "Pool has been disposed",
        metrics: { wallTimeMs: 0, cpuTimeMs: 0, memoryUsedMb: 0 },
      };
    }

    if (this.activeCount >= this.options.maxInstances) {
      return {
        success: false,
        error: `Worker pool exhausted (max: ${String(this.options.maxInstances)} concurrent)`,
        metrics: { wallTimeMs: 0, cpuTimeMs: 0, memoryUsedMb: 0 },
      };
    }

    this.activeCount++;
    try {
      const sandbox = WorkerSandbox.create(this.sandboxOptions);
      return await sandbox.execute(code, apiBindings);
    } finally {
      this.activeCount--;
    }
  }

  /**
   * Get pool statistics
   */
  getStats(): { available: number; inUse: number; max: number } {
    return {
      available: this.options.maxInstances - this.activeCount,
      inUse: this.activeCount,
      max: this.options.maxInstances,
    };
  }

  /**
   * Dispose of the pool
   */
  dispose(): void {
    this.disposed = true;
    logger.info("Worker sandbox pool disposed", {
      module: "CODEMODE" as const,
    });
  }
}
