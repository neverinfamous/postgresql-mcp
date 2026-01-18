/**
 * postgres-mcp - Database Types
 *
 * Core database configuration and query result types.
 */

/**
 * Database type identifier (PostgreSQL only for this server)
 */
export type DatabaseType = "postgresql";

/**
 * PostgreSQL connection configuration
 */
export interface DatabaseConfig {
  /** Database type identifier */
  type: DatabaseType;

  /** Connection string (postgres://user:pass@host:port/database) */
  connectionString?: string;

  /** Individual connection parameters (alternative to connectionString) */
  host?: string;
  port?: number;
  database?: string;
  username?: string;
  password?: string;

  /** Connection pool options */
  pool?: PoolConfig;

  /** Additional PostgreSQL-specific options */
  options?: PostgresOptions;
}

/**
 * PostgreSQL-specific connection options
 */
export interface PostgresOptions {
  /** SSL configuration */
  ssl?:
    | boolean
    | {
        ca?: string;
        cert?: string;
        key?: string;
        rejectUnauthorized?: boolean;
      };

  /** Statement timeout in milliseconds */
  statementTimeout?: number;

  /** Query timeout in milliseconds */
  queryTimeout?: number;

  /** Connection timeout in milliseconds */
  connectionTimeoutMillis?: number;

  /** Idle connection timeout in milliseconds */
  idleTimeoutMillis?: number;

  /** Application name for pg_stat_activity */
  applicationName?: string;

  /** Search path (schema search order) */
  searchPath?: string;

  /** Enable prepared statement caching */
  preparedStatements?: boolean;
}

/**
 * Connection pool configuration
 */
export interface PoolConfig {
  /** Maximum number of connections in pool (default: 10) */
  max?: number;

  /** Minimum number of connections in pool (default: 0) */
  min?: number;

  /** Connection acquire timeout in ms (default: 10000) */
  acquireTimeoutMillis?: number;

  /** Idle timeout before closing connection in ms (default: 10000) */
  idleTimeoutMillis?: number;

  /** Maximum connection lifetime in ms (default: unlimited) */
  maxLifetimeMillis?: number;

  /** Connection timeout in ms (default: 0 = unlimited) */
  connectionTimeoutMillis?: number;

  /** Allow exit on idle (default: true) */
  allowExitOnIdle?: boolean;
}

/**
 * Connection pool statistics
 */
export interface PoolStats {
  /** Total connections in pool */
  total: number;

  /** Active connections (in use) */
  active: number;

  /** Idle connections (available) */
  idle: number;

  /** Waiting requests in queue */
  waiting: number;

  /** Total queries executed */
  totalQueries: number;
}

/**
 * Database connection health status
 */
export interface HealthStatus {
  connected: boolean;
  latencyMs?: number | undefined;
  version?: string | undefined;
  poolStats?: PoolStats | undefined;
  details?: Record<string, unknown> | undefined;
  error?: string | undefined;
}

/**
 * Query execution result
 */
export interface QueryResult {
  /** Rows returned (for SELECT queries) */
  rows?: Record<string, unknown>[] | undefined;

  /** Number of rows affected (for INSERT/UPDATE/DELETE) */
  rowsAffected?: number | undefined;

  /** Returned rows from RETURNING clause */
  returning?: Record<string, unknown>[] | undefined;

  /** Query execution time in milliseconds */
  executionTimeMs?: number | undefined;

  /** Column metadata */
  columns?: ColumnInfo[] | undefined;

  /** Field info from PostgreSQL */
  fields?: FieldInfo[] | undefined;

  /** Command type (SELECT, INSERT, etc.) */
  command?: string | undefined;
}

/**
 * Column metadata information
 */
export interface ColumnInfo {
  name: string;
  type: string;
  nullable?: boolean | undefined;
  primaryKey?: boolean | undefined;
  defaultValue?: unknown;
  isSerial?: boolean | undefined;
  isGenerated?: boolean | undefined;
  generatedExpression?: string | undefined;
  characterMaxLength?: number | undefined;
  numericPrecision?: number | undefined;
  numericScale?: number | undefined;
  arrayDimensions?: number | undefined;
  comment?: string | undefined;
  /** Foreign key reference for this column */
  foreignKey?:
    | {
        table: string;
        schema: string;
        column: string;
      }
    | undefined;
}

/**
 * PostgreSQL field information from result set
 */
export interface FieldInfo {
  name: string;
  tableID: number;
  columnID: number;
  dataTypeID: number;
  dataTypeSize: number;
  dataTypeModifier: number;
  format: string;
}

/**
 * Table information
 */
export interface TableInfo {
  name: string;
  schema?: string | undefined;
  type:
    | "table"
    | "view"
    | "materialized_view"
    | "foreign_table"
    | "partitioned_table";
  owner?: string | undefined;
  rowCount?: number | undefined;
  sizeBytes?: number | undefined;
  totalSizeBytes?: number | undefined;
  createTime?: Date | undefined;
  comment?: string | undefined;
  columns?: ColumnInfo[] | undefined;
  isPartitioned?: boolean | undefined;
  partitionKey?: string | undefined;
  /** True if table statistics are stale (reltuples = -1, needs ANALYZE) */
  statsStale?: boolean | undefined;
  /** Table indexes */
  indexes?:
    | {
        name: string;
        indexName: string;
        type: string;
        isUnique: boolean;
        isPrimary: boolean;
        columns: string[];
        definition: string;
      }[]
    | undefined;
  /** Table constraints (PRIMARY KEY, CHECK, UNIQUE, EXCLUSION, NOT NULL) */
  constraints?:
    | {
        name: string;
        type: string;
        definition: string;
        columns?: string[];
      }[]
    | undefined;
  /** Foreign key relationships */
  foreignKeys?:
    | {
        name: string;
        column: string;
        referencedTable: string;
        referencedSchema: string;
        referencedColumn: string;
        onUpdate: string;
        onDelete: string;
      }[]
    | undefined;
}
