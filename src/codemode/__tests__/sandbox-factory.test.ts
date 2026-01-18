/**
 * Unit tests for Sandbox Factory
 *
 * Tests the factory functions for creating sandbox instances
 * with configurable isolation modes.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  setDefaultSandboxMode,
  getDefaultSandboxMode,
  getAvailableSandboxModes,
  createSandbox,
  createSandboxPool,
  getSandboxModeInfo,
  type SandboxMode,
} from "../sandbox-factory.js";
import { CodeModeSandbox, SandboxPool } from "../sandbox.js";
import { WorkerSandbox, WorkerSandboxPool } from "../worker-sandbox.js";

// Mock the logger
vi.mock("../../utils/logger.js", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe("Sandbox Factory", () => {
  // Store original default mode to restore after tests
  let originalMode: SandboxMode;

  beforeEach(() => {
    originalMode = getDefaultSandboxMode();
  });

  afterEach(() => {
    // Restore original mode
    setDefaultSandboxMode(originalMode);
  });

  describe("setDefaultSandboxMode / getDefaultSandboxMode", () => {
    it("should default to vm mode", () => {
      setDefaultSandboxMode("vm");
      expect(getDefaultSandboxMode()).toBe("vm");
    });

    it("should switch to worker mode", () => {
      setDefaultSandboxMode("worker");
      expect(getDefaultSandboxMode()).toBe("worker");
    });

    it("should switch back to vm mode", () => {
      setDefaultSandboxMode("worker");
      setDefaultSandboxMode("vm");
      expect(getDefaultSandboxMode()).toBe("vm");
    });
  });

  describe("getAvailableSandboxModes", () => {
    it("should return array with vm and worker modes", () => {
      const modes = getAvailableSandboxModes();
      expect(modes).toContain("vm");
      expect(modes).toContain("worker");
    });

    it("should return exactly two modes", () => {
      const modes = getAvailableSandboxModes();
      expect(modes.length).toBe(2);
    });
  });

  describe("createSandbox", () => {
    it("should create CodeModeSandbox when mode is vm", () => {
      const sandbox = createSandbox("vm");
      expect(sandbox).toBeInstanceOf(CodeModeSandbox);
    });

    it("should create WorkerSandbox when mode is worker", () => {
      const sandbox = createSandbox("worker");
      expect(sandbox).toBeInstanceOf(WorkerSandbox);
    });

    it("should use default mode when not specified", () => {
      setDefaultSandboxMode("vm");
      const sandbox = createSandbox();
      expect(sandbox).toBeInstanceOf(CodeModeSandbox);
    });

    it("should use worker as default when set", () => {
      setDefaultSandboxMode("worker");
      const sandbox = createSandbox();
      expect(sandbox).toBeInstanceOf(WorkerSandbox);
    });

    it("should pass options to vm sandbox", () => {
      const sandbox = createSandbox("vm", { timeoutMs: 5000 });
      expect(sandbox).toBeInstanceOf(CodeModeSandbox);
      // Sandbox should be functional
      expect(sandbox.isHealthy()).toBe(true);
    });

    it("should pass options to worker sandbox", () => {
      const sandbox = createSandbox("worker", { timeoutMs: 5000 });
      expect(sandbox).toBeInstanceOf(WorkerSandbox);
      expect(sandbox.isHealthy()).toBe(true);
    });
  });

  describe("createSandboxPool", () => {
    it("should create SandboxPool when mode is vm", () => {
      const pool = createSandboxPool("vm");
      expect(pool).toBeInstanceOf(SandboxPool);
      pool.dispose();
    });

    it("should create WorkerSandboxPool when mode is worker", () => {
      const pool = createSandboxPool("worker");
      expect(pool).toBeInstanceOf(WorkerSandboxPool);
      pool.dispose();
    });

    it("should use default mode when not specified", () => {
      setDefaultSandboxMode("vm");
      const pool = createSandboxPool();
      expect(pool).toBeInstanceOf(SandboxPool);
      pool.dispose();
    });

    it("should pass pool options to vm pool", () => {
      const pool = createSandboxPool("vm", { maxInstances: 5 });
      expect(pool).toBeInstanceOf(SandboxPool);
      pool.initialize();
      const stats = pool.getStats();
      expect(stats.max).toBe(5);
      pool.dispose();
    });

    it("should pass pool options to worker pool", () => {
      const pool = createSandboxPool("worker", { maxInstances: 3 });
      expect(pool).toBeInstanceOf(WorkerSandboxPool);
      pool.initialize();
      const stats = pool.getStats();
      expect(stats.max).toBe(3);
      pool.dispose();
    });

    it("should pass sandbox options to pool", () => {
      const pool = createSandboxPool("vm", undefined, { timeoutMs: 10000 });
      expect(pool).toBeInstanceOf(SandboxPool);
      pool.dispose();
    });
  });

  describe("getSandboxModeInfo", () => {
    describe("vm mode info", () => {
      it("should return correct name for vm mode", () => {
        const info = getSandboxModeInfo("vm");
        expect(info.name).toBe("VM Context");
      });

      it("should describe vm isolation", () => {
        const info = getSandboxModeInfo("vm");
        expect(info.isolation).toContain("Script isolation");
      });

      it("should describe vm performance", () => {
        const info = getSandboxModeInfo("vm");
        expect(info.performance).toContain("Low overhead");
      });

      it("should describe vm security", () => {
        const info = getSandboxModeInfo("vm");
        expect(info.security).toContain("Standard");
      });

      it("should describe vm requirements", () => {
        const info = getSandboxModeInfo("vm");
        expect(info.requirements).toContain("vm module");
      });
    });

    describe("worker mode info", () => {
      it("should return correct name for worker mode", () => {
        const info = getSandboxModeInfo("worker");
        expect(info.name).toBe("Worker Thread");
      });

      it("should describe worker isolation", () => {
        const info = getSandboxModeInfo("worker");
        expect(info.isolation).toContain("Separate V8 instance");
      });

      it("should describe worker performance", () => {
        const info = getSandboxModeInfo("worker");
        expect(info.performance).toContain("Higher overhead");
      });

      it("should describe worker security", () => {
        const info = getSandboxModeInfo("worker");
        expect(info.security).toContain("Enhanced");
      });

      it("should describe worker requirements", () => {
        const info = getSandboxModeInfo("worker");
        expect(info.requirements).toContain("worker_threads");
      });
    });
  });
});
