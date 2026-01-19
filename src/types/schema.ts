/**
 * postgres-mcp - Schema Types
 *
 * Database schema metadata types for introspection.
 */

import type { TableInfo } from "./database.js";

/**
 * Schema information for a database
 */
export interface SchemaInfo {
  tables: TableInfo[];
  views?: TableInfo[];
  materializedViews?: TableInfo[];
  indexes?: IndexInfo[];
  constraints?: ConstraintInfo[];
  functions?: FunctionInfo[];
  triggers?: TriggerInfo[];
  sequences?: SequenceInfo[];
  types?: CustomTypeInfo[];
}

/**
 * Index information
 */
export interface IndexInfo {
  name: string;
  /** Alias for name (consistency with other responses) */
  indexName?: string | undefined;
  tableName: string;
  schemaName?: string | undefined;
  columns: string[];
  unique: boolean;
  type: "btree" | "hash" | "gist" | "gin" | "spgist" | "brin";
  /** Alias for type (consistency with different API contexts) */
  indexType?: "btree" | "hash" | "gist" | "gin" | "spgist" | "brin" | undefined;
  isPartial?: boolean | undefined;
  predicate?: string | undefined;
  sizeBytes?: number | undefined;
  numberOfScans?: number | undefined;
}

/**
 * Constraint information
 */
export interface ConstraintInfo {
  name: string;
  tableName: string;
  schemaName?: string;
  type: "primary_key" | "foreign_key" | "unique" | "check" | "exclusion";
  columns: string[];
  definition?: string;
  referencedTable?: string;
  referencedColumns?: string[];
  onDelete?: "CASCADE" | "SET NULL" | "SET DEFAULT" | "RESTRICT" | "NO ACTION";
  onUpdate?: "CASCADE" | "SET NULL" | "SET DEFAULT" | "RESTRICT" | "NO ACTION";
  isDeferrable?: boolean;
  isDeferred?: boolean;
}

/**
 * Function/procedure information
 */
export interface FunctionInfo {
  name: string;
  schemaName?: string;
  type: "FUNCTION" | "PROCEDURE" | "AGGREGATE" | "WINDOW";
  language: string;
  returnType?: string;
  argumentTypes?: string[];
  owner: string;
  isStrict?: boolean;
  securityDefiner?: boolean;
  volatility?: "IMMUTABLE" | "STABLE" | "VOLATILE";
}

/**
 * Trigger information
 */
export interface TriggerInfo {
  name: string;
  tableName: string;
  schemaName?: string;
  event: ("INSERT" | "UPDATE" | "DELETE" | "TRUNCATE")[];
  timing: "BEFORE" | "AFTER" | "INSTEAD OF";
  orientation: "ROW" | "STATEMENT";
  functionName: string;
  isEnabled: boolean;
}

/**
 * Sequence information
 */
export interface SequenceInfo {
  name: string;
  schemaName?: string;
  dataType: string;
  startValue: bigint;
  minValue: bigint;
  maxValue: bigint;
  increment: bigint;
  cycled: boolean;
  cacheSize: number;
  lastValue?: bigint;
  ownedBy?: string;
}

/**
 * Custom type information
 */
export interface CustomTypeInfo {
  name: string;
  schemaName?: string;
  type: "ENUM" | "COMPOSITE" | "DOMAIN" | "RANGE";
  values?: string[];
  attributes?: { name: string; type: string }[];
}
