/**
 * PostgreSQL ltree Extension Tools
 * 8 tools total.
 */

import type { PostgresAdapter } from "../PostgresAdapter.js";
import type { ToolDefinition, RequestContext } from "../../../types/index.js";
import { z } from "zod";
import { readOnly, write } from "../../../utils/annotations.js";
import { getToolIcons } from "../../../utils/icons.js";
import {
  LtreeQuerySchema,
  LtreeQuerySchemaBase,
  LtreeSubpathSchema,
  LtreeSubpathSchemaBase,
  LtreeLcaSchema,
  LtreeMatchSchema,
  LtreeMatchSchemaBase,
  LtreeListColumnsSchema,
  LtreeConvertColumnSchema,
  LtreeConvertColumnSchemaBase,
  LtreeIndexSchema,
  LtreeIndexSchemaBase,
} from "../schemas/index.js";

export function getLtreeTools(adapter: PostgresAdapter): ToolDefinition[] {
  return [
    createLtreeExtensionTool(adapter),
    createLtreeQueryTool(adapter),
    createLtreeSubpathTool(adapter),
    createLtreeLcaTool(adapter),
    createLtreeMatchTool(adapter),
    createLtreeListColumnsTool(adapter),
    createLtreeConvertColumnTool(adapter),
    createLtreeCreateIndexTool(adapter),
  ];
}

function createLtreeExtensionTool(adapter: PostgresAdapter): ToolDefinition {
  return {
    name: "pg_ltree_create_extension",
    description:
      "Enable the ltree extension for hierarchical tree-structured labels.",
    group: "ltree",
    inputSchema: z.object({}),
    annotations: write("Create Ltree Extension"),
    icons: getToolIcons("ltree", write("Create Ltree Extension")),
    handler: async (_params: unknown, _context: RequestContext) => {
      await adapter.executeQuery("CREATE EXTENSION IF NOT EXISTS ltree");
      return { success: true, message: "ltree extension enabled" };
    },
  };
}

function createLtreeQueryTool(adapter: PostgresAdapter): ToolDefinition {
  return {
    name: "pg_ltree_query",
    description:
      "Query hierarchical relationships in ltree columns. Supports exact paths (descendants/ancestors) and lquery patterns with wildcards.",
    group: "ltree",
    inputSchema: LtreeQuerySchemaBase, // Base schema for MCP visibility
    annotations: readOnly("Query Ltree"),
    icons: getToolIcons("ltree", readOnly("Query Ltree")),
    handler: async (params: unknown, _context: RequestContext) => {
      const { table, column, path, mode, schema, limit } =
        LtreeQuerySchema.parse(params);
      const schemaName = schema ?? "public";
      const queryMode = mode ?? "descendants";
      const qualifiedTable = `"${schemaName}"."${table}"`;
      const limitClause = limit !== undefined ? `LIMIT ${String(limit)}` : "";

      // Detect if path contains lquery pattern characters
      const isLqueryPattern = /[*?{!@|]/.test(path);

      let sql: string;
      if (isLqueryPattern) {
        // Use lquery pattern matching with ~ operator
        sql = `SELECT *, nlevel("${column}") as depth FROM ${qualifiedTable} WHERE "${column}" ~ $1::lquery ORDER BY "${column}" ${limitClause}`;
      } else {
        // Use standard ltree hierarchy operators
        // @> means "is ancestor of" (left contains right)
        // <@ means "is descendant of" (left is contained by right)
        let operator: string;
        switch (queryMode) {
          // ancestors: column @> path means column contains path, i.e., column is ancestor of path
          case "ancestors":
            operator = "@>";
            break;
          case "exact":
            operator = "=";
            break;
          // descendants: column <@ path means column is contained by path, i.e., column is descendant of path
          default:
            operator = "<@";
        }
        sql = `SELECT *, nlevel("${column}") as depth FROM ${qualifiedTable} WHERE "${column}" ${operator} $1::ltree ORDER BY "${column}" ${limitClause}`;
      }

      const result = await adapter.executeQuery(sql, [path]);
      return {
        path,
        mode: isLqueryPattern ? "pattern" : queryMode,
        isPattern: isLqueryPattern,
        results: result.rows ?? [],
        count: result.rows?.length ?? 0,
      };
    },
  };
}

function createLtreeSubpathTool(adapter: PostgresAdapter): ToolDefinition {
  return {
    name: "pg_ltree_subpath",
    description: "Extract a portion of an ltree path.",
    group: "ltree",
    inputSchema: LtreeSubpathSchemaBase, // Base schema for MCP visibility
    annotations: readOnly("Ltree Subpath"),
    icons: getToolIcons("ltree", readOnly("Ltree Subpath")),
    handler: async (params: unknown, _context: RequestContext) => {
      const { path, offset, length } = LtreeSubpathSchema.parse(params);
      const sql =
        length !== undefined
          ? `SELECT subpath($1::ltree, $2, $3) as subpath, nlevel($1::ltree) as original_depth`
          : `SELECT subpath($1::ltree, $2) as subpath, nlevel($1::ltree) as original_depth`;
      const queryParams =
        length !== undefined ? [path, offset, length] : [path, offset];
      const result = await adapter.executeQuery(sql, queryParams);
      const row = result.rows?.[0];
      return {
        originalPath: path,
        offset,
        length: length ?? "to end",
        subpath: row?.["subpath"] as string,
        originalDepth: row?.["original_depth"] as number,
      };
    },
  };
}

function createLtreeLcaTool(adapter: PostgresAdapter): ToolDefinition {
  return {
    name: "pg_ltree_lca",
    description: "Find the longest common ancestor of multiple ltree paths.",
    group: "ltree",
    inputSchema: LtreeLcaSchema,
    annotations: readOnly("Ltree LCA"),
    icons: getToolIcons("ltree", readOnly("Ltree LCA")),
    handler: async (params: unknown, _context: RequestContext) => {
      const { paths } = LtreeLcaSchema.parse(params);
      const arrayLiteral = paths
        .map((p) => `'${p.replace(/'/g, "''")}'::ltree`)
        .join(", ");
      const sql = `SELECT lca(ARRAY[${arrayLiteral}]) as lca`;
      const result = await adapter.executeQuery(sql);
      const lca = result.rows?.[0]?.["lca"] as string | null;
      return {
        paths,
        longestCommonAncestor: lca ?? "",
        hasCommonAncestor: lca !== null && lca !== "",
      };
    },
  };
}

function createLtreeMatchTool(adapter: PostgresAdapter): ToolDefinition {
  return {
    name: "pg_ltree_match",
    description: "Match ltree paths using lquery pattern syntax.",
    group: "ltree",
    inputSchema: LtreeMatchSchemaBase, // Base schema for MCP visibility
    annotations: readOnly("Ltree Match"),
    icons: getToolIcons("ltree", readOnly("Ltree Match")),
    handler: async (params: unknown, _context: RequestContext) => {
      const { table, column, pattern, schema, limit } =
        LtreeMatchSchema.parse(params);
      const schemaName = schema ?? "public";
      const qualifiedTable = `"${schemaName}"."${table}"`;
      const limitClause = limit !== undefined ? `LIMIT ${String(limit)}` : "";
      const sql = `SELECT *, nlevel("${column}") as depth FROM ${qualifiedTable} WHERE "${column}" ~ $1::lquery ORDER BY "${column}" ${limitClause}`;
      const result = await adapter.executeQuery(sql, [pattern]);
      return {
        pattern,
        results: result.rows ?? [],
        count: result.rows?.length ?? 0,
      };
    },
  };
}

function createLtreeListColumnsTool(adapter: PostgresAdapter): ToolDefinition {
  return {
    name: "pg_ltree_list_columns",
    description: "List all columns using the ltree type in the database.",
    group: "ltree",
    inputSchema: LtreeListColumnsSchema,
    annotations: readOnly("List Ltree Columns"),
    icons: getToolIcons("ltree", readOnly("List Ltree Columns")),
    handler: async (params: unknown, _context: RequestContext) => {
      const { schema } = LtreeListColumnsSchema.parse(params);
      const conditions: string[] = [
        "udt_name = 'ltree'",
        "table_schema NOT IN ('pg_catalog', 'information_schema')",
      ];
      const queryParams: unknown[] = [];
      if (schema !== undefined) {
        conditions.push(`table_schema = $1`);
        queryParams.push(schema);
      }
      const sql = `SELECT table_schema, table_name, column_name, is_nullable, column_default FROM information_schema.columns WHERE ${conditions.join(" AND ")} ORDER BY table_schema, table_name, ordinal_position`;
      const result = await adapter.executeQuery(sql, queryParams);
      return { columns: result.rows ?? [], count: result.rows?.length ?? 0 };
    },
  };
}

function createLtreeConvertColumnTool(
  adapter: PostgresAdapter,
): ToolDefinition {
  return {
    name: "pg_ltree_convert_column",
    description: "Convert an existing TEXT column to LTREE type.",
    group: "ltree",
    inputSchema: LtreeConvertColumnSchemaBase, // Base schema for MCP visibility
    annotations: write("Convert to Ltree"),
    icons: getToolIcons("ltree", write("Convert to Ltree")),
    handler: async (params: unknown, _context: RequestContext) => {
      const { table, column, schema } = LtreeConvertColumnSchema.parse(params);
      const schemaName = schema ?? "public";
      const qualifiedTable = `"${schemaName}"."${table}"`;
      const colCheck = await adapter.executeQuery(
        `SELECT data_type, udt_name FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2 AND column_name = $3`,
        [schemaName, table, column],
      );
      if (!colCheck.rows || colCheck.rows.length === 0)
        return { success: false, error: `Column ${column} not found` };
      const udtName = colCheck.rows[0]?.["udt_name"] as string;
      if (udtName === "ltree")
        return {
          success: true,
          message: `Column ${column} is already ltree`,
          wasAlreadyLtree: true,
        };
      await adapter.executeQuery(
        `ALTER TABLE ${qualifiedTable} ALTER COLUMN "${column}" TYPE ltree USING "${column}"::ltree`,
      );
      return {
        success: true,
        message: `Column ${column} converted to ltree`,
        table: qualifiedTable,
        previousType: colCheck.rows[0]?.["data_type"] as string,
      };
    },
  };
}

function createLtreeCreateIndexTool(adapter: PostgresAdapter): ToolDefinition {
  return {
    name: "pg_ltree_create_index",
    description:
      "Create a GiST index on an ltree column for efficient tree queries.",
    group: "ltree",
    inputSchema: LtreeIndexSchemaBase, // Base schema for MCP visibility
    annotations: write("Create Ltree Index"),
    icons: getToolIcons("ltree", write("Create Ltree Index")),
    handler: async (params: unknown, _context: RequestContext) => {
      const { table, column, indexName, schema } =
        LtreeIndexSchema.parse(params);
      const schemaName = schema ?? "public";
      const qualifiedTable = `"${schemaName}"."${table}"`;
      const idxName = indexName ?? `idx_${table}_${column}_ltree`;
      const idxCheck = await adapter.executeQuery(
        `SELECT EXISTS(SELECT 1 FROM pg_indexes WHERE schemaname = $1 AND indexname = $2) as exists`,
        [schemaName, idxName],
      );
      if (idxCheck.rows?.[0]?.["exists"] as boolean)
        return {
          success: true,
          message: `Index ${idxName} already exists`,
          indexName: idxName,
          alreadyExists: true,
        };
      await adapter.executeQuery(
        `CREATE INDEX "${idxName}" ON ${qualifiedTable} USING GIST ("${column}")`,
      );
      return {
        success: true,
        message: `GiST index created`,
        indexName: idxName,
        table: qualifiedTable,
        column,
        indexType: "gist",
      };
    },
  };
}
