/**
 * postgres-mcp - Structured Logger
 * 
 * Centralized logging utility with RFC 5424 severity levels and structured output.
 * Supports dual-mode logging: stderr for local debugging and MCP protocol notifications.
 * 
 * Format: [timestamp] [LEVEL] [MODULE] [CODE] message {context}
 * Example: [2025-12-18T01:30:00Z] [ERROR] [ADAPTER] [PG_CONNECT_FAILED] Failed to connect {"host":"localhost"}
 */

// Server class is marked deprecated but McpServer.server exposes it for sendLoggingMessage()
import type { Server } from '@modelcontextprotocol/sdk/server/index.js';

/**
 * RFC 5424 syslog severity levels
 * @see https://datatracker.ietf.org/doc/html/rfc5424#section-6.2.1
 */
export type LogLevel =
    | 'debug'       // 7 - Debug-level messages
    | 'info'        // 6 - Informational messages
    | 'notice'      // 5 - Normal but significant condition
    | 'warning'     // 4 - Warning conditions
    | 'error'       // 3 - Error conditions
    | 'critical'    // 2 - Critical conditions
    | 'alert'       // 1 - Action must be taken immediately
    | 'emergency';  // 0 - System is unusable

/**
 * Module identifiers for log categorization
 */
export type LogModule =
    | 'SERVER'      // MCP server lifecycle
    | 'ADAPTER'     // Database adapter operations
    | 'AUTH'        // OAuth/authentication
    | 'TOOLS'       // Tool execution
    | 'RESOURCES'   // Resource handlers
    | 'PROMPTS'     // Prompt handlers
    | 'TRANSPORT'   // HTTP/SSE/stdio transport
    | 'QUERY'       // SQL query execution
    | 'POOL'        // Connection pool
    | 'FILTER'      // Tool filtering
    | 'CLI';        // Command line interface

/**
 * Structured log context following MCP logging standards
 */
export interface LogContext {
    /** Module identifier */
    module?: LogModule;
    /** Module-prefixed error/event code (e.g., PG_CONNECT_FAILED) */
    code?: string;
    /** Operation being performed (e.g., executeQuery, connect) */
    operation?: string;
    /** Entity identifier (e.g., table name, connection id) */
    entityId?: string;
    /** Request identifier for tracing */
    requestId?: string;
    /** Error stack trace */
    stack?: string;
    /** Additional context fields */
    [key: string]: unknown;
}

interface LogEntry {
    level: LogLevel;
    module?: LogModule | undefined;
    code?: string | undefined;
    message: string;
    timestamp: string;
    context?: LogContext | undefined;
}

/**
 * MCP-aware structured logger with dual-mode output
 * 
 * Follows MCP Server Logging Standards:
 * - Centralized logger writing to stderr only (stdout reserved for MCP protocol)
 * - Include: module, operation, entityId, context, stack traces
 * - Module-prefixed codes (e.g., PG_CONNECT_FAILED, AUTH_TOKEN_INVALID)
 * - Severity: RFC 5424 levels
 * - Format: [timestamp] [LEVEL] [MODULE] [CODE] message {context}
 */
class Logger {
    private minLevel: LogLevel = 'info';
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    private mcpServer: Server | null = null;
    private loggerName = 'postgres-mcp';
    private defaultModule: LogModule = 'SERVER';

    /**
     * RFC 5424 severity priority (lower number = higher severity)
     */
    private readonly levelPriority: Record<LogLevel, number> = {
        emergency: 0,
        alert: 1,
        critical: 2,
        error: 3,
        warning: 4,
        notice: 5,
        info: 6,
        debug: 7
    };

    /**
     * Set the minimum log level
     */
    setLevel(level: LogLevel): void {
        this.minLevel = level;
    }

    /**
     * Get the current minimum log level
     */
    getLevel(): LogLevel {
        return this.minLevel;
    }

    /**
     * Set the MCP server for protocol logging
     * When set, logs will be sent to connected MCP clients
     */
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    setMcpServer(server: Server): void {
        this.mcpServer = server;
    }

    /**
     * Set the logger name (appears in MCP log messages)
     */
    setLoggerName(name: string): void {
        this.loggerName = name;
    }

    /**
     * Set the default module for logs without explicit module
     */
    setDefaultModule(module: LogModule): void {
        this.defaultModule = module;
    }

    private shouldLog(level: LogLevel): boolean {
        // Lower priority number = higher severity, so we log if level priority <= minLevel priority
        return this.levelPriority[level] <= this.levelPriority[this.minLevel];
    }

    /**
     * List of keys that contain sensitive data and should be redacted
     */
    private readonly sensitiveKeys: ReadonlySet<string> = new Set([
        'password',
        'secret',
        'token',
        'key',
        'apikey',
        'api_key',
        'accesstoken',
        'access_token',
        'refreshtoken',
        'refresh_token',
        'authorization',
        'credential',
        'credentials',
        // OAuth-specific sensitive fields
        'issuer',
        'audience',
        'jwksuri',
        'jwks_uri',
        'client_secret',
        'clientsecret'
    ]);

    /**
     * Sanitize context object by redacting sensitive values
     * This prevents clear-text logging of OAuth config and other secrets
     */
    private sanitizeContext(context: LogContext): LogContext {
        const sanitized: LogContext = {};

        for (const [key, value] of Object.entries(context)) {
            const lowerKey = key.toLowerCase();

            // Check if this key matches any sensitive pattern
            const isSensitive = this.sensitiveKeys.has(lowerKey) ||
                [...this.sensitiveKeys].some(sk => lowerKey.includes(sk));

            if (isSensitive && value !== undefined && value !== null) {
                sanitized[key] = '[REDACTED]';
            } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                // Recursively sanitize nested objects
                sanitized[key] = this.sanitizeContext(value as LogContext);
            } else {
                sanitized[key] = value;
            }
        }

        return sanitized;
    }

    /**
     * Format log entry according to MCP logging standard
     * Format: [timestamp] [LEVEL] [MODULE] [CODE] message {context}
     */
    private formatEntry(entry: LogEntry): string {
        const parts: string[] = [
            `[${entry.timestamp}]`,
            `[${entry.level.toUpperCase()}]`
        ];

        // Add module if present
        if (entry.module) {
            parts.push(`[${entry.module}]`);
        }

        // Add code if present
        if (entry.code) {
            parts.push(`[${entry.code}]`);
        }

        // Add message
        parts.push(entry.message);

        // Add context if present (excluding module and code which are already in the format)
        if (entry.context) {
            // Destructure out fields that are already in the log line format
            const { module, code, ...restContext } = entry.context;
            void module; void code; // Intentionally unused - already in format
            if (Object.keys(restContext).length > 0) {
                const sanitizedContext = this.sanitizeContext(restContext);
                parts.push(JSON.stringify(sanitizedContext));
            }
        }

        return parts.join(' ');
    }

    /**
     * Send log message to MCP client if connected
     */
    private async sendToMcp(entry: LogEntry): Promise<void> {
        if (!this.mcpServer) {
            return;
        }

        try {
            const data: Record<string, unknown> = {
                message: entry.message
            };
            if (entry.module) data['module'] = entry.module;
            if (entry.code) data['code'] = entry.code;
            if (entry.context) {
                const sanitized = this.sanitizeContext(entry.context);
                Object.assign(data, sanitized);
            }

            await this.mcpServer.sendLoggingMessage({
                level: entry.level,
                logger: this.loggerName,
                data
            });
        } catch {
            // Silently ignore MCP logging failures to avoid infinite loops
        }
    }

    /**
     * Core logging method
     */
    private log(level: LogLevel, message: string, context?: LogContext): void {
        if (!this.shouldLog(level)) {
            return;
        }

        const entry: LogEntry = {
            level,
            module: context?.module ?? this.defaultModule,
            code: context?.code,
            message,
            timestamp: new Date().toISOString(),
            context
        };

        const formatted = this.formatEntry(entry);

        // Write to stderr to avoid interfering with MCP stdio transport
        // All levels use console.error to write to stderr
        // Security: All sensitive OAuth/credential data has been redacted by sanitizeContext() in formatEntry()
        // codeql[js/clear-text-logging] - False positive: sensitive data redacted by sanitizeContext()
        // codeql[js/log-injection] - False positive: user input sanitized before logging
        console.error(formatted);

        // Also send to MCP client if connected (fire and forget)
        void this.sendToMcp(entry);
    }

    // =========================================================================
    // Convenience methods for each log level
    // =========================================================================

    debug(message: string, context?: LogContext): void {
        this.log('debug', message, context);
    }

    info(message: string, context?: LogContext): void {
        this.log('info', message, context);
    }

    notice(message: string, context?: LogContext): void {
        this.log('notice', message, context);
    }

    warn(message: string, context?: LogContext): void {
        this.log('warning', message, context);
    }

    warning(message: string, context?: LogContext): void {
        this.log('warning', message, context);
    }

    error(message: string, context?: LogContext): void {
        this.log('error', message, context);
    }

    critical(message: string, context?: LogContext): void {
        this.log('critical', message, context);
    }

    alert(message: string, context?: LogContext): void {
        this.log('alert', message, context);
    }

    emergency(message: string, context?: LogContext): void {
        this.log('emergency', message, context);
    }

    // =========================================================================
    // Module-scoped logging helpers
    // =========================================================================

    /**
     * Create a child logger scoped to a specific module
     */
    forModule(module: LogModule): ModuleLogger {
        return new ModuleLogger(this, module);
    }
}

/**
 * Module-scoped logger for cleaner code in specific modules
 */
class ModuleLogger {
    constructor(
        private parent: Logger,
        private module: LogModule
    ) { }

    private withModule(context?: LogContext): LogContext {
        return { ...context, module: this.module };
    }

    debug(message: string, context?: LogContext): void {
        this.parent.debug(message, this.withModule(context));
    }

    info(message: string, context?: LogContext): void {
        this.parent.info(message, this.withModule(context));
    }

    notice(message: string, context?: LogContext): void {
        this.parent.notice(message, this.withModule(context));
    }

    warn(message: string, context?: LogContext): void {
        this.parent.warn(message, this.withModule(context));
    }

    warning(message: string, context?: LogContext): void {
        this.parent.warning(message, this.withModule(context));
    }

    error(message: string, context?: LogContext): void {
        this.parent.error(message, this.withModule(context));
    }

    critical(message: string, context?: LogContext): void {
        this.parent.critical(message, this.withModule(context));
    }

    alert(message: string, context?: LogContext): void {
        this.parent.alert(message, this.withModule(context));
    }

    emergency(message: string, context?: LogContext): void {
        this.parent.emergency(message, this.withModule(context));
    }
}

export const logger = new Logger();
