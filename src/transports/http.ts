/**
 * postgres-mcp - HTTP Transport
 *
 * HTTP/SSE transport with OAuth 2.0 support.
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import type { OAuthResourceServer } from '../auth/OAuthResourceServer.js';
import type { TokenValidator } from '../auth/TokenValidator.js';
import { validateAuth, formatOAuthError } from '../auth/middleware.js';
import { logger } from '../utils/logger.js';

/**
 * HTTP transport configuration
 */
export interface HttpTransportConfig {
    /** Port to listen on */
    port: number;

    /** Host to bind to (default: localhost) */
    host?: string;

    /** OAuth resource server (optional) */
    resourceServer?: OAuthResourceServer;

    /** Token validator (optional, required if resourceServer is provided) */
    tokenValidator?: TokenValidator;

    /** CORS allowed origins (default: none) */
    corsOrigins?: string[];

    /** Paths that bypass authentication */
    publicPaths?: string[];
}

/**
 * HTTP Transport for MCP
 */
export class HttpTransport {
    private server: ReturnType<typeof createServer> | null = null;
    private readonly config: HttpTransportConfig;
    private transport: StreamableHTTPServerTransport | null = null;
    private readonly onConnect?: (transport: StreamableHTTPServerTransport) => void;

    constructor(config: HttpTransportConfig, onConnect?: (transport: StreamableHTTPServerTransport) => void) {
        this.config = {
            ...config,
            host: config.host ?? 'localhost',
            publicPaths: config.publicPaths ?? ['/health', '/.well-known/*']
        };
        if (onConnect) {
            this.onConnect = onConnect;
        }
    }

    /**
     * Start the HTTP server
     */
    async start(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.server = createServer((req, res) => {
                this.handleRequest(req, res).catch((error: unknown) => {
                    logger.error('HTTP request handler error', { error: String(error) });
                    if (!res.headersSent) {
                        res.writeHead(500);
                        res.end(JSON.stringify({ error: 'Internal server error' }));
                    }
                });
            });

            this.server.on('error', reject);

            this.server.listen(this.config.port, this.config.host, () => {
                logger.info(`HTTP transport listening on ${this.config.host ?? 'localhost'}:${String(this.config.port)}`);
                resolve();
            });
        });
    }

    /**
     * Stop the HTTP server
     */
    async stop(): Promise<void> {
        return new Promise((resolve) => {
            if (this.server) {
                this.server.close(() => {
                    logger.info('HTTP transport stopped');
                    resolve();
                });
            } else {
                resolve();
            }
        });
    }

    /**
     * Check if a path is public (bypasses authentication)
     */
    private isPublicPath(pathname: string): boolean {
        const publicPaths = this.config.publicPaths ?? [];
        for (const pattern of publicPaths) {
            if (pattern.endsWith('/*')) {
                // Wildcard pattern
                const prefix = pattern.slice(0, -2);
                if (pathname.startsWith(prefix)) {
                    return true;
                }
            } else if (pattern === pathname) {
                return true;
            }
        }
        return false;
    }

    /**
     * Handle incoming HTTP request
     */
    private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
        // Set security headers for all responses
        this.setSecurityHeaders(res);

        // Set CORS headers
        this.setCorsHeaders(req, res);

        // Handle preflight
        if (req.method === 'OPTIONS') {
            res.writeHead(204);
            res.end();
            return;
        }

        const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`);

        // Handle well-known endpoints
        if (url.pathname === '/.well-known/oauth-protected-resource') {
            this.handleProtectedResourceMetadata(res);
            return;
        }

        // Health check
        if (url.pathname === '/health') {
            this.handleHealthCheck(res);
            return;
        }

        // Authenticate if OAuth is configured and path is not public
        if (this.config.resourceServer && this.config.tokenValidator) {
            if (!this.isPublicPath(url.pathname)) {
                try {
                    await validateAuth(req.headers.authorization, {
                        tokenValidator: this.config.tokenValidator,
                        required: true
                    });
                } catch (error) {
                    const { status, body } = formatOAuthError(error);
                    res.writeHead(status, {
                        'Content-Type': 'application/json',
                        'WWW-Authenticate': 'Bearer'
                    });
                    res.end(JSON.stringify(body));
                    return;
                }
            }
        }

        // Handle MCP requests
        if (url.pathname === '/sse') {
            await this.handleSSERequest(req, res);
            return;
        }

        if (url.pathname === '/messages') {
            await this.handleMessageRequest(req, res);
            return;
        }

        res.writeHead(404);
        res.end(JSON.stringify({ error: 'Not found' }));
    }

    /**
     * Handle SSE connection request
     */
    private async handleSSERequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
        // StreamableHTTPServerTransport usage guided by type feedback and introspection
        const transport = new StreamableHTTPServerTransport();
        this.transport = transport;

        await transport.start();

        if (this.onConnect) {
            this.onConnect(transport);
        }

        // Handle the request (keeps connection open for SSE)
        await transport.handleRequest(req, res);
    }

    /**
     * Handle MCP message request
     */
    private async handleMessageRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
        if (!this.transport) {
            res.writeHead(400);
            res.end(JSON.stringify({ error: 'No active connection' }));
            return;
        }

        await this.transport.handleRequest(req, res);
    }

    /**
     * Handle protected resource metadata endpoint
     */
    private handleProtectedResourceMetadata(res: ServerResponse): void {
        if (!this.config.resourceServer) {
            res.writeHead(404);
            res.end(JSON.stringify({ error: 'OAuth not configured' }));
            return;
        }

        const metadata = this.config.resourceServer.getMetadata();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(metadata));
    }

    /**
     * Handle health check endpoint
     */
    private handleHealthCheck(res: ServerResponse): void {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'healthy', timestamp: new Date().toISOString() }));
    }

    /**
     * Set security headers for all responses
     */
    private setSecurityHeaders(res: ServerResponse): void {
        // Prevent MIME type sniffing
        res.setHeader('X-Content-Type-Options', 'nosniff');
        // Prevent clickjacking
        res.setHeader('X-Frame-Options', 'DENY');
        // Enable XSS filtering
        res.setHeader('X-XSS-Protection', '1; mode=block');
        // Prevent caching of API responses
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
        // Content Security Policy - API server has no content to load
        res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
    }

    /**
     * Set CORS headers
     */
    private setCorsHeaders(req: IncomingMessage, res: ServerResponse): void {
        const origin = req.headers.origin;

        // Only allow configured origins
        if (origin && this.config.corsOrigins?.includes(origin)) {
            res.setHeader('Access-Control-Allow-Origin', origin);
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
            res.setHeader('Access-Control-Max-Age', '86400');
        }
    }

    /**
     * Get the underlying transport
     */
    getTransport(): StreamableHTTPServerTransport | null {
        return this.transport;
    }
}

/**
 * Create an HTTP transport instance
 */
export function createHttpTransport(config: HttpTransportConfig, onConnect?: (transport: StreamableHTTPServerTransport) => void): HttpTransport {
    return new HttpTransport(config, onConnect);
}
