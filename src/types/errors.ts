/**
 * postgres-mcp - Error Types
 *
 * Custom error classes for postgres-mcp operations.
 */

/**
 * Base error class for postgres-mcp
 */
export class PostgresMcpError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "PostgresMcpError";
  }
}

/**
 * Database connection error
 */
export class ConnectionError extends PostgresMcpError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "CONNECTION_ERROR", details);
    this.name = "ConnectionError";
  }
}

/**
 * Connection pool error
 */
export class PoolError extends PostgresMcpError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "POOL_ERROR", details);
    this.name = "PoolError";
  }
}

/**
 * Query execution error
 */
export class QueryError extends PostgresMcpError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "QUERY_ERROR", details);
    this.name = "QueryError";
  }
}

/**
 * Authentication error
 */
export class AuthenticationError extends PostgresMcpError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "AUTHENTICATION_ERROR", details);
    this.name = "AuthenticationError";
  }
}

/**
 * Authorization error (insufficient permissions)
 */
export class AuthorizationError extends PostgresMcpError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "AUTHORIZATION_ERROR", details);
    this.name = "AuthorizationError";
  }
}

/**
 * Validation error for input parameters
 */
export class ValidationError extends PostgresMcpError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "VALIDATION_ERROR", details);
    this.name = "ValidationError";
  }
}

/**
 * Transaction error
 */
export class TransactionError extends PostgresMcpError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "TRANSACTION_ERROR", details);
    this.name = "TransactionError";
  }
}

/**
 * Extension not available error
 */
export class ExtensionNotAvailableError extends PostgresMcpError {
  constructor(extensionName: string, details?: Record<string, unknown>) {
    super(
      `Extension '${extensionName}' is not installed or enabled`,
      "EXTENSION_NOT_AVAILABLE",
      { extension: extensionName, ...details },
    );
    this.name = "ExtensionNotAvailableError";
  }
}
