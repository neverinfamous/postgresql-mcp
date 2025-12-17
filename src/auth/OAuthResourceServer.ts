/**
 * postgres-mcp - OAuth Resource Server
 *
 * RFC 9728 Protected Resource Metadata implementation.
 */

import type { ResourceServerConfig, ProtectedResourceMetadata } from './types.js';

/**
 * OAuth 2.0 Resource Server (RFC 9728)
 */
export class OAuthResourceServer {
    private readonly config: ResourceServerConfig;

    constructor(config: ResourceServerConfig) {
        this.config = {
            ...config,
            bearerMethodsSupported: config.bearerMethodsSupported ?? ['header']
        };
    }

    /**
     * Get protected resource metadata (RFC 9728)
     */
    getMetadata(): ProtectedResourceMetadata {
        const metadata: ProtectedResourceMetadata = {
            resource: this.config.resource,
            authorization_servers: this.config.authorizationServers,
            scopes_supported: this.config.scopesSupported,
            resource_documentation: `${this.config.resource}/docs`,
            resource_signing_alg_values_supported: ['RS256', 'ES256']
        };
        if (this.config.bearerMethodsSupported) {
            metadata.bearer_methods_supported = this.config.bearerMethodsSupported;
        }
        return metadata;
    }

    /**
     * Get the well-known endpoint path for protected resource metadata
     */
    getWellKnownPath(): string {
        return '/.well-known/oauth-protected-resource';
    }

    /**
     * Verify that a scope is supported by this resource
     */
    isScopeSupported(scope: string): boolean {
        // Check if in explicit list
        if (this.config.scopesSupported.includes(scope)) {
            return true;
        }

        // Check for PostgreSQL-specific scope patterns
        if (scope.startsWith('db:') || scope.startsWith('schema:') || scope.startsWith('table:')) {
            return true;
        }

        return false;
    }

    /**
     * Get the resource identifier
     */
    getResourceId(): string {
        return this.config.resource;
    }

    /**
     * Get all supported scopes
     */
    getSupportedScopes(): string[] {
        return [...this.config.scopesSupported];
    }

    /**
     * Get authorization servers
     */
    getAuthorizationServers(): string[] {
        return [...this.config.authorizationServers];
    }
}

/**
 * Create an OAuth resource server instance
 */
export function createOAuthResourceServer(config: ResourceServerConfig): OAuthResourceServer {
    return new OAuthResourceServer(config);
}
