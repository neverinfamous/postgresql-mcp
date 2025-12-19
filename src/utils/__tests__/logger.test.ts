/**
 * Unit tests for the structured logger
 * 
 * Tests RFC 5424 severity levels, message sanitization (log injection prevention),
 * and context sanitization (credential redaction).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logger } from '../logger.js';
import type { LogContext } from '../logger.js';

describe('Logger', () => {
    let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
        logger.setLevel('debug'); // Enable all levels for testing
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
        logger.setLevel('info'); // Reset to default
    });

    describe('RFC 5424 Severity Levels', () => {
        it('should log at all 8 severity levels', () => {
            logger.debug('debug message');
            logger.info('info message');
            logger.notice('notice message');
            logger.warn('warning message');
            logger.error('error message');
            logger.critical('critical message');
            logger.alert('alert message');
            logger.emergency('emergency message');

            expect(consoleErrorSpy).toHaveBeenCalledTimes(8);
        });

        it('should filter messages below minimum level', () => {
            logger.setLevel('error');

            logger.debug('debug message');
            logger.info('info message');
            logger.warning('warning message');
            logger.error('error message'); // Should log
            logger.critical('critical message'); // Should log

            // Only error and critical (higher severity) should be logged
            expect(consoleErrorSpy).toHaveBeenCalledTimes(2);
        });

        it('should respect RFC 5424 priority ordering (lower number = higher severity)', () => {
            logger.setLevel('warning');

            // These are below warning severity (higher number = lower priority)
            logger.debug('debug');
            logger.info('info');
            logger.notice('notice');
            expect(consoleErrorSpy).toHaveBeenCalledTimes(0);

            // These are at or above warning severity
            logger.warning('warning');
            logger.error('error');
            logger.critical('critical');
            expect(consoleErrorSpy).toHaveBeenCalledTimes(3);
        });

        it('should include level in uppercase in formatted output', () => {
            logger.error('test message');

            const output = consoleErrorSpy.mock.calls[0]?.[0] as string;
            expect(output).toContain('[ERROR]');
        });
    });

    describe('Message Sanitization (Log Injection Prevention)', () => {
        it('should strip null bytes from messages', () => {
            logger.info('message\x00with\x00nulls');

            const output = consoleErrorSpy.mock.calls[0]?.[0] as string;
            expect(output).not.toContain('\x00');
            expect(output).toContain('messagewithnulls');
        });

        it('should strip bell and backspace characters', () => {
            logger.info('message\x07bell\x08backspace');

            const output = consoleErrorSpy.mock.calls[0]?.[0] as string;
            expect(output).not.toContain('\x07');
            expect(output).not.toContain('\x08');
        });

        it('should strip form feed and vertical tab', () => {
            logger.info('message\x0Bvtab\x0Cformfeed');

            const output = consoleErrorSpy.mock.calls[0]?.[0] as string;
            expect(output).not.toContain('\x0B');
            expect(output).not.toContain('\x0C');
        });

        it('should strip DEL character (0x7F)', () => {
            logger.info('message\x7Fwith\x7Fdel');

            const output = consoleErrorSpy.mock.calls[0]?.[0] as string;
            expect(output).not.toContain('\x7F');
        });

        it('should strip C1 control characters (0x80-0x9F)', () => {
            logger.info('message\x80\x9Fcontrol');

            const output = consoleErrorSpy.mock.calls[0]?.[0] as string;
            expect(output).not.toContain('\x80');
            expect(output).not.toContain('\x9F');
        });

        it('should preserve tabs, newlines, and carriage returns', () => {
            logger.info('line1\nline2\ttabbed\r\nwindows');

            const output = consoleErrorSpy.mock.calls[0]?.[0] as string;
            expect(output).toContain('\n');
            expect(output).toContain('\t');
        });

        it('should prevent log forgery via control character injection', () => {
            // Attacker tries to inject escape sequences to manipulate terminal
            logger.info('user input\x00\x1B[2Kwith control chars');

            const output = consoleErrorSpy.mock.calls[0]?.[0] as string;
            // Null bytes and escape sequence prefix should be stripped
            expect(output).toContain('[INFO]');
            expect(output).not.toContain('\x00');
            expect(output).not.toContain('\x1B'); // ESC character stripped
            // The printable part of the message remains
            expect(output).toContain('user input');
        });
    });

    describe('Context Sanitization (Credential Redaction)', () => {
        it('should redact password fields', () => {
            logger.info('test', { password: 'secret123' } as LogContext);

            const output = consoleErrorSpy.mock.calls[0]?.[0] as string;
            expect(output).toContain('[REDACTED]');
            expect(output).not.toContain('secret123');
        });

        it('should redact token fields', () => {
            logger.info('test', { token: 'jwt.token.here', accessToken: 'bearer_abc' } as LogContext);

            const output = consoleErrorSpy.mock.calls[0]?.[0] as string;
            expect(output).toContain('[REDACTED]');
            expect(output).not.toContain('jwt.token.here');
            expect(output).not.toContain('bearer_abc');
        });

        it('should redact OAuth-specific fields', () => {
            const context: LogContext = {
                issuer: 'https://auth.example.com',
                audience: 'my-api',
                jwksUri: 'https://auth.example.com/.well-known/jwks.json',
                client_secret: 'super_secret'
            };
            logger.info('oauth config', context);

            const output = consoleErrorSpy.mock.calls[0]?.[0] as string;
            expect(output).toContain('[REDACTED]');
            expect(output).not.toContain('https://auth.example.com');
            expect(output).not.toContain('super_secret');
        });

        it('should redact nested sensitive fields', () => {
            const context: LogContext = {
                config: {
                    database: 'mydb',
                    credentials: {
                        user: 'admin',
                        password: 'nested_secret'
                    }
                }
            };
            logger.info('nested config', context);

            const output = consoleErrorSpy.mock.calls[0]?.[0] as string;
            expect(output).not.toContain('nested_secret');
            expect(output).toContain('mydb'); // Non-sensitive field preserved
        });

        it('should handle partial key matches', () => {
            logger.info('test', {
                apiKey: 'key123',
                api_key: 'key456',
                myApiKeyValue: 'key789'
            } as LogContext);

            const output = consoleErrorSpy.mock.calls[0]?.[0] as string;
            expect(output).not.toContain('key123');
            expect(output).not.toContain('key456');
            expect(output).not.toContain('key789');
        });

        it('should preserve non-sensitive fields', () => {
            logger.info('test', {
                operation: 'query',
                entityId: 'users_table',
                count: 42
            });

            const output = consoleErrorSpy.mock.calls[0]?.[0] as string;
            expect(output).toContain('query');
            expect(output).toContain('users_table');
            expect(output).toContain('42');
        });
    });

    describe('Log Entry Formatting', () => {
        it('should include timestamp in ISO format', () => {
            logger.info('test message');

            const output = consoleErrorSpy.mock.calls[0]?.[0] as string;
            // Should have ISO timestamp format: [YYYY-MM-DDTHH:mm:ss.sssZ]
            expect(output).toMatch(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z\]/);
        });

        it('should include module when provided', () => {
            logger.info('test', { module: 'ADAPTER' });

            const output = consoleErrorSpy.mock.calls[0]?.[0] as string;
            expect(output).toContain('[ADAPTER]');
        });

        it('should include code when provided', () => {
            logger.error('connection failed', { code: 'PG_CONNECT_FAILED' });

            const output = consoleErrorSpy.mock.calls[0]?.[0] as string;
            expect(output).toContain('[PG_CONNECT_FAILED]');
        });

        it('should format: [timestamp] [LEVEL] [MODULE] [CODE] message {context}', () => {
            logger.error('Database error', {
                module: 'QUERY',
                code: 'PG_EXEC_FAILED',
                operation: 'executeQuery'
            });

            const output = consoleErrorSpy.mock.calls[0]?.[0] as string;
            expect(output).toMatch(/\[.*\] \[ERROR\] \[QUERY\] \[PG_EXEC_FAILED\] Database error/);
        });
    });

    describe('Module-Scoped Logger', () => {
        it('should create child logger with fixed module', () => {
            const poolLogger = logger.forModule('POOL');
            poolLogger.info('Connection acquired');

            const output = consoleErrorSpy.mock.calls[0]?.[0] as string;
            expect(output).toContain('[POOL]');
        });

        it('should override module from context', () => {
            const poolLogger = logger.forModule('POOL');
            // Even if context has different module, forModule takes precedence
            poolLogger.error('Error', { module: 'ADAPTER', code: 'POOL_ERROR' });

            const output = consoleErrorSpy.mock.calls[0]?.[0] as string;
            expect(output).toContain('[POOL]');
        });

        it('should support all log levels on child logger', () => {
            const authLogger = logger.forModule('AUTH');

            authLogger.debug('debug');
            authLogger.info('info');
            authLogger.notice('notice');
            authLogger.warn('warn');
            authLogger.warning('warning');
            authLogger.error('error');
            authLogger.critical('critical');
            authLogger.alert('alert');
            authLogger.emergency('emergency');

            expect(consoleErrorSpy).toHaveBeenCalledTimes(9);
            for (const call of consoleErrorSpy.mock.calls) {
                expect(call[0]).toContain('[AUTH]');
            }
        });
    });

    describe('Logger Configuration', () => {
        it('setLevel should change minimum log level', () => {
            logger.setLevel('critical');

            logger.error('Should not log');
            expect(consoleErrorSpy).not.toHaveBeenCalled();

            logger.critical('Should log');
            expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
        });

        it('getLevel should return current minimum level', () => {
            logger.setLevel('warning');
            expect(logger.getLevel()).toBe('warning');

            logger.setLevel('debug');
            expect(logger.getLevel()).toBe('debug');
        });

        it('setDefaultModule should change default module for logs', () => {
            logger.setDefaultModule('TOOLS');
            logger.info('test message');

            const output = consoleErrorSpy.mock.calls[0]?.[0] as string;
            expect(output).toContain('[TOOLS]');

            // Reset to default
            logger.setDefaultModule('SERVER');
        });

        it('setLoggerName should configure the logger name', () => {
            // This is used for MCP logging, just verify it doesn't throw
            expect(() => logger.setLoggerName('custom-logger')).not.toThrow();

            // Reset
            logger.setLoggerName('postgres-mcp');
        });

        it('setMcpServer should accept server reference', () => {
            // Create a mock MCP server
            const mockServer = {
                sendLoggingMessage: vi.fn().mockResolvedValue(undefined)
            };

            // Should not throw
            expect(() => logger.setMcpServer(mockServer as unknown as Parameters<typeof logger.setMcpServer>[0])).not.toThrow();
        });
    });

    describe('MCP Logging Integration', () => {
        it('should send log messages to MCP server when connected', async () => {
            const mockServer = {
                sendLoggingMessage: vi.fn().mockResolvedValue(undefined)
            };

            logger.setMcpServer(mockServer as unknown as Parameters<typeof logger.setMcpServer>[0]);

            logger.info('test message');

            // Wait a tick for async sendLoggingMessage to be called
            await new Promise(resolve => setTimeout(resolve, 10));

            expect(mockServer.sendLoggingMessage).toHaveBeenCalledWith(
                expect.objectContaining({
                    level: 'info',
                    logger: expect.any(String),
                    data: expect.objectContaining({
                        message: expect.stringContaining('test message')
                    })
                })
            );

            // Reset
            logger.setMcpServer(null as unknown as Parameters<typeof logger.setMcpServer>[0]);
        });

        it('should include module in MCP log data', async () => {
            const mockServer = {
                sendLoggingMessage: vi.fn().mockResolvedValue(undefined)
            };

            logger.setMcpServer(mockServer as unknown as Parameters<typeof logger.setMcpServer>[0]);

            logger.info('test', { module: 'ADAPTER' });

            await new Promise(resolve => setTimeout(resolve, 10));

            expect(mockServer.sendLoggingMessage).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        module: 'ADAPTER'
                    })
                })
            );

            logger.setMcpServer(null as unknown as Parameters<typeof logger.setMcpServer>[0]);
        });

        it('should include code in MCP log data', async () => {
            const mockServer = {
                sendLoggingMessage: vi.fn().mockResolvedValue(undefined)
            };

            logger.setMcpServer(mockServer as unknown as Parameters<typeof logger.setMcpServer>[0]);

            logger.error('failed', { code: 'PG_CONNECT_FAILED' });

            await new Promise(resolve => setTimeout(resolve, 10));

            expect(mockServer.sendLoggingMessage).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        code: 'PG_CONNECT_FAILED'
                    })
                })
            );

            logger.setMcpServer(null as unknown as Parameters<typeof logger.setMcpServer>[0]);
        });

        it('should sanitize context in MCP log data', async () => {
            const mockServer = {
                sendLoggingMessage: vi.fn().mockResolvedValue(undefined)
            };

            logger.setMcpServer(mockServer as unknown as Parameters<typeof logger.setMcpServer>[0]);

            logger.info('test', {
                password: 'secret',
                operation: 'query'
            } as LogContext);

            await new Promise(resolve => setTimeout(resolve, 10));

            const call = mockServer.sendLoggingMessage.mock.calls[0]?.[0] as { data?: Record<string, unknown> };
            expect(call?.data?.['operation']).toBe('query');
            // Password should be redacted
            expect(call?.data?.['password']).toBe('[REDACTED]');

            logger.setMcpServer(null as unknown as Parameters<typeof logger.setMcpServer>[0]);
        });

        it('should silently handle MCP logging failures', async () => {
            const mockServer = {
                sendLoggingMessage: vi.fn().mockRejectedValue(new Error('MCP send failed'))
            };

            logger.setMcpServer(mockServer as unknown as Parameters<typeof logger.setMcpServer>[0]);

            // Should not throw
            logger.info('test message');

            await new Promise(resolve => setTimeout(resolve, 10));

            // The error should be silently caught
            expect(mockServer.sendLoggingMessage).toHaveBeenCalled();

            logger.setMcpServer(null as unknown as Parameters<typeof logger.setMcpServer>[0]);
        });
    });
});

