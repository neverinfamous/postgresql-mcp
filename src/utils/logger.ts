/**
 * postgres-mcp - Structured Logger
 * 
 * Centralized logging utility with RFC 5424 severity levels and structured output.
 * Supports dual-mode logging: stderr for local debugging and MCP protocol notifications.
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

interface LogEntry {
    level: LogLevel;
    message: string;
    timestamp: string;
    details?: Record<string, unknown> | undefined;
}

/**
 * MCP-aware structured logger with dual-mode output
 */
class Logger {
    private minLevel: LogLevel = 'info';
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    private mcpServer: Server | null = null;
    private loggerName = 'postgres-mcp';

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
     * Sanitize details object by redacting sensitive values
     * This prevents clear-text logging of OAuth config and other secrets
     */
    private sanitizeDetails(details: Record<string, unknown>): Record<string, unknown> {
        const sanitized: Record<string, unknown> = {};

        for (const [key, value] of Object.entries(details)) {
            const lowerKey = key.toLowerCase();

            // Check if this key matches any sensitive pattern
            const isSensitive = this.sensitiveKeys.has(lowerKey) ||
                [...this.sensitiveKeys].some(sk => lowerKey.includes(sk));

            if (isSensitive && value !== undefined && value !== null) {
                sanitized[key] = '[REDACTED]';
            } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                // Recursively sanitize nested objects
                sanitized[key] = this.sanitizeDetails(value as Record<string, unknown>);
            } else {
                sanitized[key] = value;
            }
        }

        return sanitized;
    }

    private formatEntry(entry: LogEntry): string {
        const base = `[${entry.timestamp}] [${entry.level.toUpperCase()}] ${entry.message}`;
        if (entry.details) {
            const sanitizedDetails = this.sanitizeDetails(entry.details);
            return `${base} ${JSON.stringify(sanitizedDetails)}`;
        }
        return base;
    }

    /**
     * Send log message to MCP client if connected
     */
    private async sendToMcp(level: LogLevel, message: string, details?: Record<string, unknown>): Promise<void> {
        if (!this.mcpServer) {
            return;
        }

        try {
            const sanitizedData = details ? this.sanitizeDetails(details) : {};
            await this.mcpServer.sendLoggingMessage({
                level,
                logger: this.loggerName,
                data: {
                    message,
                    ...sanitizedData
                }
            });
        } catch {
            // Silently ignore MCP logging failures to avoid infinite loops
        }
    }

    private log(level: LogLevel, message: string, details?: Record<string, unknown>): void {
        if (!this.shouldLog(level)) {
            return;
        }

        const entry: LogEntry = {
            level,
            message,
            timestamp: new Date().toISOString(),
            details
        };

        const formatted = this.formatEntry(entry);

        // Write to stderr to avoid interfering with MCP stdio transport
        switch (level) {
            case 'error':
            case 'critical':
            case 'alert':
            case 'emergency':
                console.error(formatted);
                break;
            case 'warning':
                console.warn(formatted);
                break;
            default:
                console.error(formatted); // Use stderr for all levels
        }

        // Also send to MCP client if connected (fire and forget)
        void this.sendToMcp(level, message, details);
    }

    debug(message: string, details?: Record<string, unknown>): void {
        this.log('debug', message, details);
    }

    info(message: string, details?: Record<string, unknown>): void {
        this.log('info', message, details);
    }

    notice(message: string, details?: Record<string, unknown>): void {
        this.log('notice', message, details);
    }

    warn(message: string, details?: Record<string, unknown>): void {
        this.log('warning', message, details);
    }

    warning(message: string, details?: Record<string, unknown>): void {
        this.log('warning', message, details);
    }

    error(message: string, details?: Record<string, unknown>): void {
        this.log('error', message, details);
    }

    critical(message: string, details?: Record<string, unknown>): void {
        this.log('critical', message, details);
    }

    alert(message: string, details?: Record<string, unknown>): void {
        this.log('alert', message, details);
    }

    emergency(message: string, details?: Record<string, unknown>): void {
        this.log('emergency', message, details);
    }
}

export const logger = new Logger();
