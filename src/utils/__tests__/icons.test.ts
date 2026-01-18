/**
 * Unit tests for Tool Icons Utility
 *
 * Tests icon generation for tool categories and behavior annotations.
 */

import { describe, it, expect } from "vitest";
import {
  getToolIcons,
  getCategoryIcon,
  getAllCategoryIcons,
} from "../icons.js";
import type { ToolGroup } from "../../types/index.js";

describe("Tool Icons Utility", () => {
  describe("getToolIcons", () => {
    it("should return warning icon for destructive tools", () => {
      const icons = getToolIcons("core", { destructiveHint: true });
      expect(icons.length).toBe(1);
      expect(icons[0]?.mimeType).toBe("image/svg+xml");
      // Warning icons have red color
      expect(icons[0]?.src).toContain("data:image/svg+xml;base64,");
    });

    it("should return admin icon for VACUUM operations", () => {
      const icons = getToolIcons("admin", { title: "VACUUM Tables" });
      expect(icons.length).toBe(1);
      expect(icons[0]?.mimeType).toBe("image/svg+xml");
    });

    it("should return admin icon for ANALYZE operations", () => {
      const icons = getToolIcons("admin", {
        title: "Analyze Table Statistics",
      });
      expect(icons.length).toBe(1);
    });

    it("should return admin icon for REINDEX operations", () => {
      const icons = getToolIcons("admin", { title: "Reindex Database" });
      expect(icons.length).toBe(1);
    });

    it("should return category icon for non-destructive tools", () => {
      const icons = getToolIcons("core", { readOnlyHint: true });
      expect(icons.length).toBe(1);
      expect(icons[0]?.mimeType).toBe("image/svg+xml");
    });

    it("should return category icon when no annotations provided", () => {
      const icons = getToolIcons("vector");
      expect(icons.length).toBe(1);
    });

    it("should handle undefined annotations title", () => {
      const icons = getToolIcons("postgis", { readOnlyHint: true });
      expect(icons.length).toBe(1);
    });
  });

  describe("getCategoryIcon", () => {
    const toolGroups: ToolGroup[] = [
      "core",
      "transactions",
      "jsonb",
      "text",
      "performance",
      "admin",
      "monitoring",
      "backup",
      "schema",
      "vector",
      "postgis",
      "partitioning",
      "stats",
      "cron",
      "partman",
      "kcache",
      "citext",
      "ltree",
      "pgcrypto",
      "codemode",
    ];

    it.each(toolGroups)("should return icon for %s group", (group) => {
      const icons = getCategoryIcon(group);
      expect(icons.length).toBe(1);
      expect(icons[0]?.src).toBeDefined();
      expect(icons[0]?.mimeType).toBe("image/svg+xml");
      expect(icons[0]?.sizes).toEqual(["any"]);
    });
  });

  describe("getAllCategoryIcons", () => {
    it("should return icons for all tool groups", () => {
      const allIcons = getAllCategoryIcons();
      expect(Object.keys(allIcons).length).toBeGreaterThan(0);
    });

    it("should return valid icons for each group", () => {
      const allIcons = getAllCategoryIcons();

      for (const [, icons] of Object.entries(allIcons)) {
        expect(icons.length).toBe(1);
        expect(icons[0]?.src).toContain("data:image/svg+xml;base64,");
        expect(icons[0]?.mimeType).toBe("image/svg+xml");
        expect(icons[0]?.sizes).toEqual(["any"]);
      }
    });

    it("should include core group", () => {
      const allIcons = getAllCategoryIcons();
      expect(allIcons["core"]).toBeDefined();
    });

    it("should include vector group", () => {
      const allIcons = getAllCategoryIcons();
      expect(allIcons["vector"]).toBeDefined();
    });

    it("should include postgis group", () => {
      const allIcons = getAllCategoryIcons();
      expect(allIcons["postgis"]).toBeDefined();
    });

    it("should include codemode group", () => {
      const allIcons = getAllCategoryIcons();
      expect(allIcons["codemode"]).toBeDefined();
    });
  });

  describe("Icon Data URI Format", () => {
    it("should generate valid base64 encoded SVG", () => {
      const icons = getCategoryIcon("core");
      const src = icons[0]?.src ?? "";

      // Should be a data URI
      expect(src.startsWith("data:image/svg+xml;base64,")).toBe(true);

      // Extract base64 part and decode
      const base64Part = src.replace("data:image/svg+xml;base64,", "");
      const decodedSvg = Buffer.from(base64Part, "base64").toString("utf-8");

      // Should be valid SVG
      expect(decodedSvg).toContain("<svg");
      expect(decodedSvg).toContain("</svg>");
      expect(decodedSvg).toContain("viewBox");
    });

    it("should include stroke properties in SVG", () => {
      const icons = getCategoryIcon("transactions");
      const src = icons[0]?.src ?? "";
      const base64Part = src.replace("data:image/svg+xml;base64,", "");
      const decodedSvg = Buffer.from(base64Part, "base64").toString("utf-8");

      expect(decodedSvg).toContain("stroke=");
      expect(decodedSvg).toContain("stroke-width");
    });
  });
});
