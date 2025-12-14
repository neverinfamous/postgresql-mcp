/**
 * postgres-mcp - PostgreSQL MCP Server
 * 
 * Core type definitions for the MCP server, database adapters,
 * OAuth 2.0 authentication, and tool filtering.
 */

// =============================================================================
// Database Types
// =============================================================================

/**
 * Database type identifier (PostgreSQL only for this server)
 */
export type DatabaseType = 'postgresql';

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
    ssl?: boolean | {
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
    type: 'table' | 'view' | 'materialized_view' | 'foreign_table' | 'partitioned_table';
    owner?: string | undefined;
    rowCount?: number | undefined;
    sizeBytes?: number | undefined;
    totalSizeBytes?: number | undefined;
    createTime?: Date | undefined;
    comment?: string | undefined;
    columns?: ColumnInfo[] | undefined;
    isPartitioned?: boolean | undefined;
    partitionKey?: string | undefined;
}

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
    tableName: string;
    schemaName?: string | undefined;
    columns: string[];
    unique: boolean;
    type: 'btree' | 'hash' | 'gist' | 'gin' | 'spgist' | 'brin';
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
    type: 'primary_key' | 'foreign_key' | 'unique' | 'check' | 'exclusion';
    columns: string[];
    definition?: string;
    referencedTable?: string;
    referencedColumns?: string[];
    onDelete?: 'CASCADE' | 'SET NULL' | 'SET DEFAULT' | 'RESTRICT' | 'NO ACTION';
    onUpdate?: 'CASCADE' | 'SET NULL' | 'SET DEFAULT' | 'RESTRICT' | 'NO ACTION';
    isDeferrable?: boolean;
    isDeferred?: boolean;
}

/**
 * Function/procedure information
 */
export interface FunctionInfo {
    name: string;
    schemaName?: string;
    type: 'FUNCTION' | 'PROCEDURE' | 'AGGREGATE' | 'WINDOW';
    language: string;
    returnType?: string;
    argumentTypes?: string[];
    owner: string;
    isStrict?: boolean;
    securityDefiner?: boolean;
    volatility?: 'IMMUTABLE' | 'STABLE' | 'VOLATILE';
}

/**
 * Trigger information
 */
export interface TriggerInfo {
    name: string;
    tableName: string;
    schemaName?: string;
    event: ('INSERT' | 'UPDATE' | 'DELETE' | 'TRUNCATE')[];
    timing: 'BEFORE' | 'AFTER' | 'INSTEAD OF';
    orientation: 'ROW' | 'STATEMENT';
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
    type: 'ENUM' | 'COMPOSITE' | 'DOMAIN' | 'RANGE';
    values?: string[];
    attributes?: { name: string; type: string }[];
}

// =============================================================================
// MCP Server Types
// =============================================================================

/**
 * Transport type for MCP communication
 */
export type TransportType = 'stdio' | 'http' | 'sse';

/**
 * MCP Server configuration
 */
export interface McpServerConfig {
    /** Server name */
    name: string;

    /** Server version */
    version: string;

    /** Transport configuration */
    transport: TransportType;

    /** HTTP port (for http/sse transports) */
    port?: number;

    /** Database configurations */
    databases: DatabaseConfig[];

    /** OAuth configuration */
    oauth?: OAuthConfig;

    /** Tool filtering configuration */
    toolFilter?: string;
}

// =============================================================================
// OAuth 2.0 Types
// =============================================================================

/**
 * OAuth 2.0 configuration
 */
export interface OAuthConfig {
    /** Enable OAuth authentication */
    enabled: boolean;

    /** Authorization server URL */
    authorizationServerUrl?: string;

    /** Token validation endpoint */
    tokenEndpoint?: string;

    /** JWKS URI for token verification */
    jwksUri?: string;

    /** Expected audience in tokens */
    audience?: string;

    /** Expected issuer in tokens */
    issuer?: string;

    /** Clock tolerance for token validation (seconds) */
    clockTolerance?: number;

    /** JWKS cache TTL (seconds) */
    jwksCacheTtl?: number;

    /** Paths that bypass authentication */
    publicPaths?: string[];
}

/**
 * OAuth scopes for access control
 */
export type OAuthScope =
    | 'read'           // Read-only access to all databases
    | 'write'          // Read and write access
    | 'admin'          // Full administrative access
    | `db:${string}`   // Access to specific database
    | `schema:${string}` // Access to specific schema
    | `table:${string}:${string}`; // Access to specific table

/**
 * Validated OAuth token claims
 */
export interface TokenClaims {
    /** Subject (user ID) */
    sub: string;

    /** Granted scopes */
    scopes: OAuthScope[];

    /** Token expiration time */
    exp: number;

    /** Token issued at time */
    iat: number;

    /** Token issuer */
    iss?: string;

    /** Token audience */
    aud?: string | string[];

    /** Additional claims */
    [key: string]: unknown;
}

/**
 * Request context with authentication info
 */
export interface RequestContext {
    /** Validated token claims (if authenticated) */
    auth?: TokenClaims;

    /** Raw access token */
    accessToken?: string;

    /** Request timestamp */
    timestamp: Date;

    /** Request ID for tracing */
    requestId: string;
}

// =============================================================================
// Tool Filtering Types
// =============================================================================

/**
 * Tool group identifiers for PostgreSQL
 */
export type ToolGroup =
    | 'core'           // Basic CRUD, schema operations
    | 'transactions'   // Transaction control
    | 'jsonb'          // JSONB operations
    | 'text'           // Text processing, FTS, trigrams
    | 'performance'    // EXPLAIN, pg_stat_statements
    | 'admin'          // VACUUM, ANALYZE, REINDEX
    | 'monitoring'     // Sizes, connections, status
    | 'backup'         // COPY, dump commands
    | 'schema'         // DDL operations
    | 'vector'         // pgvector extension
    | 'postgis'        // PostGIS extension
    | 'partitioning'   // Partition management
    | 'stats'          // Statistical analysis
    | 'cron';          // pg_cron extension - job scheduling

/**
 * Tool filter rule
 */
export interface ToolFilterRule {
    /** Rule type: include or exclude */
    type: 'include' | 'exclude';

    /** Target: group name or tool name */
    target: string;

    /** Whether target is a group (true) or individual tool (false) */
    isGroup: boolean;
}

/**
 * Parsed tool filter configuration
 */
export interface ToolFilterConfig {
    /** Original filter string */
    raw: string;

    /** Parsed rules in order */
    rules: ToolFilterRule[];

    /** Set of enabled tool names after applying rules */
    enabledTools: Set<string>;
}

// =============================================================================
// Adapter Types
// =============================================================================

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

    /** Resource handler */
    handler: (uri: string, context: RequestContext) => Promise<unknown>;
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
    handler: (args: Record<string, string>, context: RequestContext) => Promise<unknown>;
}

// =============================================================================
// Error Types
// =============================================================================

/**
 * Base error class for postgres-mcp
 */
export class PostgresMcpError extends Error {
    constructor(
        message: string,
        public readonly code: string,
        public readonly details?: Record<string, unknown>
    ) {
        super(message);
        this.name = 'PostgresMcpError';
    }
}

/**
 * Database connection error
 */
export class ConnectionError extends PostgresMcpError {
    constructor(message: string, details?: Record<string, unknown>) {
        super(message, 'CONNECTION_ERROR', details);
        this.name = 'ConnectionError';
    }
}

/**
 * Connection pool error
 */
export class PoolError extends PostgresMcpError {
    constructor(message: string, details?: Record<string, unknown>) {
        super(message, 'POOL_ERROR', details);
        this.name = 'PoolError';
    }
}

/**
 * Query execution error
 */
export class QueryError extends PostgresMcpError {
    constructor(message: string, details?: Record<string, unknown>) {
        super(message, 'QUERY_ERROR', details);
        this.name = 'QueryError';
    }
}

/**
 * Authentication error
 */
export class AuthenticationError extends PostgresMcpError {
    constructor(message: string, details?: Record<string, unknown>) {
        super(message, 'AUTHENTICATION_ERROR', details);
        this.name = 'AuthenticationError';
    }
}

/**
 * Authorization error (insufficient permissions)
 */
export class AuthorizationError extends PostgresMcpError {
    constructor(message: string, details?: Record<string, unknown>) {
        super(message, 'AUTHORIZATION_ERROR', details);
        this.name = 'AuthorizationError';
    }
}

/**
 * Validation error for input parameters
 */
export class ValidationError extends PostgresMcpError {
    constructor(message: string, details?: Record<string, unknown>) {
        super(message, 'VALIDATION_ERROR', details);
        this.name = 'ValidationError';
    }
}

/**
 * Transaction error
 */
export class TransactionError extends PostgresMcpError {
    constructor(message: string, details?: Record<string, unknown>) {
        super(message, 'TRANSACTION_ERROR', details);
        this.name = 'TransactionError';
    }
}

/**
 * Extension not available error
 */
export class ExtensionNotAvailableError extends PostgresMcpError {
    constructor(extensionName: string, details?: Record<string, unknown>) {
        super(
            `Extension '${extensionName}' is not installed or enabled`,
            'EXTENSION_NOT_AVAILABLE',
            { extension: extensionName, ...details }
        );
        this.name = 'ExtensionNotAvailableError';
    }
}
