/**
 * postgres-mcp - Partitioning Tool Schemas
 *
 * Input validation schemas for table partitioning.
 * Includes parameter preprocessing to smooth common agent input mistakes.
 */

import { z } from "zod";

/**
 * Parse schema from schema.table format identifier
 * Returns { name, schema? } or undefined if input is undefined
 */
function parseSchemaFromIdentifier(
  value: string | undefined,
): { name: string; schema: string | undefined } | undefined {
  if (!value) return undefined;
  if (value.includes(".")) {
    const parts = value.split(".");
    return { name: parts[1] ?? value, schema: parts[0] };
  }
  return { name: value, schema: undefined };
}

/**
 * Helper type for raw partition input with common aliases
 */
interface RawPartitionInput {
  parent?: string;
  parentTable?: string; // Common alias for parent
  table?: string; // Common alias for parent
  name?: string;
  partitionName?: string; // Common alias for name AND partition
  partition?: string;
  partitionTable?: string; // Common alias for partition
  schema?: string;
  forValues?: string;
  isDefault?: boolean; // Create DEFAULT partition
  default?: boolean; // Alias for isDefault
  from?: string; // Alias for RANGE bounds
  to?: string; // Alias for RANGE bounds
  rangeFrom?: string; // Intuitive alias for RANGE bounds
  rangeTo?: string; // Intuitive alias for RANGE bounds
  values?: string[]; // Alias for LIST partition values
  listValues?: string[]; // Intuitive alias for LIST partition values
  modulus?: number; // Alias for HASH partition modulus
  remainder?: number; // Alias for HASH partition remainder
  hashModulus?: number; // Intuitive alias for HASH partition modulus
  hashRemainder?: number; // Intuitive alias for HASH partition remainder
  concurrently?: boolean;
  subpartitionBy?: string; // Sub-partition strategy (case-insensitive)
}

/**
 * Preprocess partition parameters to normalize common input patterns:
 * - parentTable → parent (common alias)
 * - table → parent (common alias)
 * - partitionName → name OR partition (common alias)
 * - partitionTable → partition (common alias)
 * - from/to → forValues (build RANGE bounds)
 * - values → forValues (build LIST bounds)
 * - modulus/remainder → forValues (build HASH bounds)
 */
function preprocessPartitionParams(input: unknown): unknown {
  if (typeof input !== "object" || input === null) {
    return input;
  }

  const raw = input as RawPartitionInput;
  const result: RawPartitionInput & { schema?: string } = { ...raw };

  // Parse schema.table format from parent parameter
  const parsedParent = parseSchemaFromIdentifier(
    raw.parent ?? raw.parentTable ?? raw.table,
  );
  if (parsedParent?.schema && result.schema === undefined) {
    result.schema = parsedParent.schema;
    // Update the resolved parent to just the table name
    if (raw.parent?.includes(".")) result.parent = parsedParent.name;
    if (raw.parentTable?.includes(".")) result.parentTable = parsedParent.name;
    if (raw.table?.includes(".")) result.table = parsedParent.name;
  }

  // Parse schema.table format from partition parameter
  const parsedPartition = parseSchemaFromIdentifier(
    raw.partition ?? raw.partitionTable ?? raw.partitionName,
  );
  if (parsedPartition?.schema && result.schema === undefined) {
    result.schema = parsedPartition.schema;
  }
  // Update resolved partition to just the table name
  if (raw.partition?.includes(".") && parsedPartition) {
    result.partition = parsedPartition.name;
  }
  if (raw.partitionTable?.includes(".") && parsedPartition) {
    result.partitionTable = parsedPartition.name;
  }
  if (raw.partitionName?.includes(".") && parsedPartition) {
    result.partitionName = parsedPartition.name;
  }

  // Alias: parentTable → parent
  if (result.parentTable !== undefined && result.parent === undefined) {
    result.parent = result.parentTable;
  }

  // Alias: table → parent
  if (result.table !== undefined && result.parent === undefined) {
    result.parent = result.table;
  }

  // Alias: partitionName → name (for pg_create_partition)
  if (result.partitionName !== undefined && result.name === undefined) {
    result.name = result.partitionName;
  }

  // Alias: name → partitionName (for detachPartition API consistency in Code Mode)
  if (result.name !== undefined && result.partitionName === undefined) {
    result.partitionName = result.name;
  }

  // Alias: partitionName → partition (for pg_attach_partition, pg_detach_partition)
  if (result.partitionName !== undefined && result.partition === undefined) {
    result.partition = result.partitionName;
  }

  // Alias: partitionTable → partition
  if (result.partitionTable !== undefined && result.partition === undefined) {
    result.partition = result.partitionTable;
  }

  // Alias: rangeFrom → from, rangeTo → to
  if (result.rangeFrom !== undefined && result.from === undefined) {
    result.from = result.rangeFrom;
  }
  if (result.rangeTo !== undefined && result.to === undefined) {
    result.to = result.rangeTo;
  }

  // Build forValues from from/to for RANGE partitions
  if (
    result.from !== undefined &&
    result.to !== undefined &&
    result.forValues === undefined
  ) {
    result.forValues = `FROM ('${result.from}') TO ('${result.to}')`;
  }

  // Alias: listValues → values
  if (result.listValues !== undefined && result.values === undefined) {
    result.values = result.listValues;
  }

  // Build forValues from values array for LIST partitions
  if (
    result.values !== undefined &&
    Array.isArray(result.values) &&
    result.forValues === undefined
  ) {
    const quotedValues = result.values.map((v: string) => `'${v}'`).join(", ");
    result.forValues = `IN (${quotedValues})`;
  }

  // Alias: hashModulus → modulus, hashRemainder → remainder
  if (result.hashModulus !== undefined && result.modulus === undefined) {
    result.modulus = result.hashModulus;
  }
  if (result.hashRemainder !== undefined && result.remainder === undefined) {
    result.remainder = result.hashRemainder;
  }
  // Build forValues from modulus/remainder for HASH partitions
  if (
    result.modulus !== undefined &&
    result.remainder !== undefined &&
    result.forValues === undefined
  ) {
    result.forValues = `WITH (MODULUS ${String(result.modulus)}, REMAINDER ${String(result.remainder)})`;
  }

  // Alias: default → isDefault
  if (result.default === true && result.isDefault === undefined) {
    result.isDefault = result.default;
  }

  // Handle isDefault: true for DEFAULT partitions
  if (result.isDefault === true && result.forValues === undefined) {
    result.forValues = "__DEFAULT__"; // Special marker for handler
  }

  // Normalize subpartitionBy to lowercase (RANGE → range, LIST → list, HASH → hash)
  if (typeof result.subpartitionBy === "string") {
    result.subpartitionBy = result.subpartitionBy.toLowerCase();
  }

  return result;
}

/**
 * Preprocess CreatePartitionedTable parameters:
 * - Parse schema.table format from name (e.g., 'myschema.events' → schema: 'myschema', name: 'events')
 * - Normalize partitionBy to lowercase (RANGE → range)
 * - Alias: table → name
 * - Alias: key → partitionKey
 */
function preprocessCreatePartitionedTable(input: unknown): unknown {
  if (typeof input !== "object" || input === null) {
    return input;
  }

  const result = { ...(input as Record<string, unknown>) };

  // Alias: table → name
  if (result["table"] !== undefined && result["name"] === undefined) {
    result["name"] = result["table"];
  }

  // Parse schema.table format from name parameter
  const nameValue = result["name"];
  if (typeof nameValue === "string" && nameValue.includes(".")) {
    const parsed = parseSchemaFromIdentifier(nameValue);
    if (parsed?.schema && result["schema"] === undefined) {
      result["schema"] = parsed.schema;
      result["name"] = parsed.name;
    }
  }

  // Alias: key → partitionKey
  if (result["key"] !== undefined && result["partitionKey"] === undefined) {
    result["partitionKey"] = result["key"];
  }

  // Normalize partitionBy to lowercase
  if (typeof result["partitionBy"] === "string") {
    result["partitionBy"] = result["partitionBy"].toLowerCase();
  }

  return result;
}

// Base schema for MCP visibility (no preprocessing)
export const CreatePartitionedTableSchemaBase = z.object({
  name: z.string().describe("Table name"),
  schema: z.string().optional().describe("Schema name"),
  columns: z
    .array(
      z.object({
        name: z.string(),
        type: z.string(),
        nullable: z
          .boolean()
          .optional()
          .describe("Allow NULL values (default: true)"),
        notNull: z.boolean().optional().describe("Alias for nullable: false"),
        primaryKey: z
          .boolean()
          .optional()
          .describe("Create PRIMARY KEY constraint"),
        unique: z.boolean().optional().describe("Create UNIQUE constraint"),
        default: z
          .union([z.string(), z.number(), z.boolean(), z.null()])
          .optional()
          .describe("Default value"),
      }),
    )
    .describe("Column definitions"),
  partitionBy: z
    .enum(["range", "list", "hash"])
    .describe("Partition strategy (range, list, or hash)"),
  partitionKey: z.string().describe("Partition key column(s)"),
  primaryKey: z
    .array(z.string())
    .optional()
    .describe(
      "Table-level primary key columns. Must include partition key column.",
    ),
});

// Preprocessed schema for handler parsing (with alias support)
export const CreatePartitionedTableSchema = z.preprocess(
  preprocessCreatePartitionedTable,
  CreatePartitionedTableSchemaBase,
);

// Base schema for MCP visibility (no preprocessing)
export const CreatePartitionSchemaBase = z.object({
  parent: z
    .string()
    .describe("Parent table name (aliases: parentTable, table)"),
  name: z.string().describe("Partition name (alias: partitionName)"),
  schema: z.string().optional().describe("Schema name"),
  forValues: z
    .string()
    .describe(
      "Partition bounds (REQUIRED). Provide: from/to (RANGE), values (LIST), modulus/remainder (HASH), or default: true (DEFAULT)",
    ),
  // Sub-partitioning support for multi-level partitions
  subpartitionBy: z
    .enum(["range", "list", "hash"])
    .optional()
    .describe(
      "Make this partition itself partitionable. For multi-level partitioning.",
    ),
  subpartitionKey: z
    .string()
    .optional()
    .describe(
      "Column(s) to partition sub-partitions by. Required if subpartitionBy is set.",
    ),
});

// Preprocessed schema for handler parsing (with alias support)
export const CreatePartitionSchema = z.preprocess(
  preprocessPartitionParams,
  CreatePartitionSchemaBase,
);

// Base schema for MCP visibility (no preprocessing)
export const AttachPartitionSchemaBase = z.object({
  parent: z
    .string()
    .describe("Parent table name (aliases: parentTable, table)"),
  partition: z
    .string()
    .describe("Table to attach (aliases: partitionTable, partitionName)"),
  schema: z
    .string()
    .optional()
    .describe("Schema name (auto-parsed from schema.table format)"),
  forValues: z
    .string()
    .describe(
      "Partition bounds (REQUIRED). Provide: from/to (RANGE), values (LIST), modulus/remainder (HASH), or default: true (DEFAULT)",
    ),
});

// Preprocessed schema for handler parsing (with alias support)
export const AttachPartitionSchema = z.preprocess(
  preprocessPartitionParams,
  AttachPartitionSchemaBase,
);

// Base schema for MCP visibility (no preprocessing)
export const DetachPartitionSchemaBase = z.object({
  parent: z
    .string()
    .describe("Parent table name (aliases: parentTable, table)"),
  partition: z
    .string()
    .describe("Partition to detach (aliases: partitionTable, partitionName)"),
  schema: z
    .string()
    .optional()
    .describe("Schema name (auto-parsed from schema.table format)"),
  concurrently: z
    .boolean()
    .optional()
    .describe("Detach concurrently (non-blocking)"),
  finalize: z
    .boolean()
    .optional()
    .describe(
      "Complete an interrupted CONCURRENTLY detach. Only use after a prior CONCURRENTLY detach was interrupted.",
    ),
});

// Preprocessed schema for handler parsing (with alias support)
export const DetachPartitionSchema = z.preprocess(
  preprocessPartitionParams,
  DetachPartitionSchemaBase,
);
