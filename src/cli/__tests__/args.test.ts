/**
 * postgres-mcp - CLI Arguments Parser Tests
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { parseArgs } from "../args.js";

describe("parseArgs", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset env to avoid leakage between tests
    process.env = { ...originalEnv };
    delete process.env["MCP_HOST"];
    delete process.env["HOST"];
    delete process.env["PGHOST"];
    delete process.env["POSTGRES_HOST"];
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("--server-host", () => {
    it("should parse --server-host flag", () => {
      const result = parseArgs(["--server-host", "0.0.0.0"]);
      expect(result.serverHost).toBe("0.0.0.0");
    });

    it("should leave serverHost undefined when not provided", () => {
      const result = parseArgs([]);
      expect(result.serverHost).toBeUndefined();
    });

    it("should fall back to MCP_HOST env var", () => {
      process.env["MCP_HOST"] = "0.0.0.0";
      const result = parseArgs([]);
      expect(result.serverHost).toBe("0.0.0.0");
    });

    it("should fall back to HOST env var", () => {
      process.env["HOST"] = "127.0.0.1";
      const result = parseArgs([]);
      expect(result.serverHost).toBe("127.0.0.1");
    });

    it("should prioritize MCP_HOST over HOST env var", () => {
      process.env["MCP_HOST"] = "0.0.0.0";
      process.env["HOST"] = "127.0.0.1";
      const result = parseArgs([]);
      expect(result.serverHost).toBe("0.0.0.0");
    });

    it("should prioritize CLI flag over env vars", () => {
      process.env["MCP_HOST"] = "10.0.0.1";
      process.env["HOST"] = "10.0.0.2";
      const result = parseArgs(["--server-host", "192.168.1.1"]);
      expect(result.serverHost).toBe("192.168.1.1");
    });
  });

  describe("--host (PostgreSQL database host)", () => {
    it("should parse --host as database host, not server host", () => {
      const result = parseArgs(["--host", "db.example.com"]);
      expect(result.database?.host).toBe("db.example.com");
      expect(result.serverHost).toBeUndefined();
    });

    it("should allow --host and --server-host simultaneously", () => {
      const result = parseArgs([
        "--host",
        "db.example.com",
        "--server-host",
        "0.0.0.0",
      ]);
      expect(result.database?.host).toBe("db.example.com");
      expect(result.serverHost).toBe("0.0.0.0");
    });
  });

  describe("defaults", () => {
    it("should default transport to stdio", () => {
      const result = parseArgs([]);
      expect(result.transport).toBe("stdio");
    });

    it("should parse --transport flag", () => {
      const result = parseArgs(["--transport", "http"]);
      expect(result.transport).toBe("http");
    });

    it("should parse --port flag", () => {
      const result = parseArgs(["--port", "8080"]);
      expect(result.port).toBe(8080);
    });
  });
});
