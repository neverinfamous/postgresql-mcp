/**
 * postgres-mcp - Sandbox Factory
 *
 * Factory functions for creating sandbox instances with configurable isolation modes.
 * Allows runtime selection between vm-based and worker-based sandboxes.
 */

import { CodeModeSandbox, SandboxPool } from "./sandbox.js";
import { WorkerSandbox, WorkerSandboxPool } from "./worker-sandbox.js";
import { logger } from "../utils/logger.js";
import type { SandboxOptions, PoolOptions, SandboxResult } from "./types.js";

/**
 * Sandbox isolation mode
 */
export type SandboxMode = "vm" | "worker";

/**
 * Unified sandbox interface
 */
export interface ISandbox {
  execute(
    code: string,
    apiBindings: Record<string, unknown>,
  ): Promise<SandboxResult>;
  isHealthy(): boolean;
  dispose(): void;
}

/**
 * Unified sandbox pool interface
 */
export interface ISandboxPool {
  initialize(): void;
  execute(
    code: string,
    apiBindings: Record<string, unknown>,
  ): Promise<SandboxResult>;
  getStats(): { available: number; inUse: number; max: number };
  dispose(): void;
}

/**
 * Mode info for documentation/selection
 */
export interface SandboxModeInfo {
  name: string;
  isolation: string;
  performance: string;
  security: string;
  requirements: string;
}

// Default mode (module-level state)
let defaultMode: SandboxMode = "vm";

/**
 * Set the default sandbox mode
 */
export function setDefaultSandboxMode(mode: SandboxMode): void {
  defaultMode = mode;
  logger.info(`Sandbox default mode set to: ${mode}`, {
    module: "CODEMODE" as const,
  });
}

/**
 * Get the current default mode
 */
export function getDefaultSandboxMode(): SandboxMode {
  return defaultMode;
}

/**
 * Get available sandbox modes
 */
export function getAvailableSandboxModes(): SandboxMode[] {
  return ["vm", "worker"];
}

/**
 * Create a sandbox instance
 * @param mode - Isolation mode ('vm' or 'worker')
 * @param options - Sandbox options
 */
export function createSandbox(
  mode?: SandboxMode,
  options?: SandboxOptions,
): ISandbox {
  const selectedMode = mode ?? defaultMode;

  switch (selectedMode) {
    case "worker":
      return WorkerSandbox.create(options);
    case "vm":
    default:
      return CodeModeSandbox.create(options);
  }
}

/**
 * Create a sandbox pool
 * @param mode - Isolation mode ('vm' or 'worker')
 * @param poolOptions - Pool configuration
 * @param sandboxOptions - Sandbox configuration
 */
export function createSandboxPool(
  mode?: SandboxMode,
  poolOptions?: PoolOptions,
  sandboxOptions?: SandboxOptions,
): ISandboxPool {
  const selectedMode = mode ?? defaultMode;

  switch (selectedMode) {
    case "worker":
      return new WorkerSandboxPool(poolOptions, sandboxOptions);
    case "vm":
    default:
      return new SandboxPool(poolOptions, sandboxOptions);
  }
}

/**
 * Get mode characteristics for documentation/selection
 */
export function getSandboxModeInfo(mode: SandboxMode): SandboxModeInfo {
  switch (mode) {
    case "worker":
      return {
        name: "Worker Thread",
        isolation: "Separate V8 instance per worker",
        performance: "Higher overhead (thread spawn per execution)",
        security: "Enhanced - isolated memory, hard timeouts",
        requirements: "Node.js worker_threads (built-in)",
      };
    case "vm":
    default:
      return {
        name: "VM Context",
        isolation: "Script isolation within same process",
        performance: "Low overhead (reusable contexts)",
        security: "Standard - script isolation, blocked globals",
        requirements: "Node.js vm module (built-in)",
      };
  }
}
