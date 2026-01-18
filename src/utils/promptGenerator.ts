/**
 * postgres-mcp - Prompt Generator Utilities
 *
 * Helper functions for generating prompts, especially for lazy hydration.
 */

import type { ToolDefinition } from "../types/index.js";

/**
 * Generate a compact tool index for lazy hydration.
 * Groups tools by category and provides minimal token overhead.
 */
export function generateCompactIndex(tools: ToolDefinition[]): string {
  // Group tools by their group
  const grouped = new Map<string, ToolDefinition[]>();

  for (const tool of tools) {
    const group = tool.group;
    const groupTools = grouped.get(group) ?? [];
    groupTools.push(tool);
    grouped.set(group, groupTools);
  }

  // Build compact index
  const lines: string[] = [
    `# PostgreSQL MCP Tools (${String(tools.length)} total)`,
    "",
    "Use specific tool names when needed. Ask for details about any tool.",
    "",
  ];

  for (const [group, groupTools] of grouped) {
    lines.push(`## ${group} (${String(groupTools.length)})`);
    for (const tool of groupTools) {
      // Compact format: name - short description
      const shortDesc = tool.description.split(".")[0] ?? tool.description;
      lines.push(`- ${tool.name}: ${shortDesc}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}

/**
 * Generate a discovery prompt that helps the AI find relevant tools.
 */
export function generateDiscoveryPrompt(tools: ToolDefinition[]): string {
  const lines: string[] = [
    "You have access to PostgreSQL database tools. Here is how to find what you need:",
    "",
    "**Tool Categories:**",
  ];

  // Group and count
  const grouped = new Map<string, number>();
  for (const tool of tools) {
    grouped.set(tool.group, (grouped.get(tool.group) ?? 0) + 1);
  }

  for (const [group, count] of grouped) {
    lines.push(`- ${group}: ${String(count)} tools`);
  }

  lines.push("");
  lines.push("**Common Tasks:**");
  lines.push("- Query data: pg_read_query");
  lines.push("- Modify data: pg_write_query");
  lines.push("- View tables: pg_list_tables, pg_describe_table");
  lines.push("- Analyze performance: pg_explain_analyze, pg_stat_statements");
  lines.push("- Manage transactions: pg_transaction_begin/commit/rollback");
  lines.push("");
  lines.push(
    "Ask about any category or task for specific tool recommendations.",
  );

  return lines.join("\n");
}

/**
 * Generate tool tags for search/discovery.
 */
export function generateToolTags(tool: ToolDefinition): string[] {
  const tags: string[] = [tool.group];

  // Extract keywords from name
  const nameParts = tool.name.replace("pg_", "").split("_");
  tags.push(...nameParts);

  // Extract keywords from description
  const descWords = tool.description
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 3 && !["the", "and", "for", "with"].includes(w));
  tags.push(...descWords.slice(0, 5)); // Limit to 5 keywords

  return [...new Set(tags)]; // Deduplicate
}
