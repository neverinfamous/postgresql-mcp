/**
 * postgres-mcp - Adapter Types
 *
 * Database adapter capabilities and tool/resource/prompt definitions.
 */

import type { OAuthScope, RequestContext } from "./oauth.js";
import type { ToolGroup } from "./filtering.js";

/**
 * Capabilities supported by a database adapter
 */
export interface AdapterCapabilities {
  /** Supports JSON/JSONB operations */
  json: boolean;

  /** Supports full-text search */
  fullTextSearch: boolean;

  /** Supports vector/embedding operations (pgvector) */
  vector: boolean;

  /** Supports geospatial operations (PostGIS) */
  geospatial: boolean;

  /** Supports transactions */
  transactions: boolean;

  /** Supports prepared statements */
  preparedStatements: boolean;

  /** Supports connection pooling */
  connectionPooling: boolean;

  /** Supports partitioning */
  partitioning: boolean;

  /** Supports logical replication */
  replication: boolean;

  /** Supports CTE (WITH queries) */
  cte: boolean;

  /** Supports window functions */
  windowFunctions: boolean;

  /** Additional capability flags */
  [key: string]: boolean;
}

/**
 * MCP Tool Annotations (SDK 1.25+)
 * Provides metadata hints about tool behavior to help clients
 * present and manage tools appropriately.
 */
export interface ToolAnnotations {
  /** Human-readable title for display */
  title?: string;
  /** Tool does not modify its environment (default: false) */
  readOnlyHint?: boolean;
  /** Tool may perform destructive updates (default: true) */
  destructiveHint?: boolean;
  /** Repeated calls with same args have no additional effect */
  idempotentHint?: boolean;
  /** Tool may interact with external systems (default: false) */
  openWorldHint?: boolean;
}

/**
 * MCP Tool Icon (SDK 1.25+)
 * Visual representation of a tool for display in client UIs.
 */
export interface ToolIcon {
  /** URI for the icon (data:, http:, https:, file://) */
  src: string;
  /** MIME type (image/svg+xml, image/png, image/jpeg) */
  mimeType?: string;
  /** Size hints (e.g., ["48x48"] or ["any"] for SVG) */
  sizes?: string[];
}

/**
 * Tool definition for registration
 */
export interface ToolDefinition {
  /** Unique tool name */
  name: string;

  /** Human-readable description */
  description: string;

  /** Tool group for filtering */
  group: ToolGroup;

  /** Searchable tags for tool discovery (used by lazy hydration) */
  tags?: string[];

  /** Zod schema for input validation */
  inputSchema: unknown;

  /** Required OAuth scopes */
  requiredScopes?: OAuthScope[];

  /** MCP Tool Annotations for behavior hints */
  annotations?: ToolAnnotations;

  /** MCP Tool Icons for visual representation */
  icons?: ToolIcon[];

  /** Tool handler function */
  handler: (params: unknown, context: RequestContext) => Promise<unknown>;
}

/**
 * Resource definition for MCP
 */
export interface ResourceDefinition {
  /** Resource URI template */
  uri: string;

  /** Human-readable name */
  name: string;

  /** Description */
  description: string;

  /** MIME type */
  mimeType?: string;

  /** MCP Resource Annotations for behavior hints */
  annotations?: ResourceAnnotations;

  /** Resource handler */
  handler: (uri: string, context: RequestContext) => Promise<unknown>;
}

/**
 * MCP Resource Annotations (SDK 1.25+)
 * Provides metadata hints about resource content to help clients
 * manage and display resources appropriately.
 */
export interface ResourceAnnotations {
  /** Intended audience for the resource content */
  audience?: ("user" | "assistant")[];
  /** Priority hint for display ordering (0-1 range) */
  priority?: number;
  /** ISO 8601 timestamp of last modification for cache invalidation */
  lastModified?: string;
}

/**
 * Prompt definition for MCP
 */
export interface PromptDefinition {
  /** Prompt name */
  name: string;

  /** Description */
  description: string;

  /** Argument definitions */
  arguments?: {
    name: string;
    description: string;
    required?: boolean;
  }[];

  /** Prompt handler */
  handler: (
    args: Record<string, string>,
    context: RequestContext,
  ) => Promise<unknown>;
}
