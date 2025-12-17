/**
 * postgres-mcp - Token Validator Tests
 *
 * Tests for JWT token validation with JWKS support.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TokenValidator, createTokenValidator } from '../TokenValidator.js';

// Mock jose module
vi.mock('jose', () => ({
    jwtVerify: vi.fn(),
    createRemoteJWKSet: vi.fn(() => {
        return () => Promise.resolve({ type: 'remote' });
    }),
    errors: {
        JWTExpired: class JWTExpired extends Error {
            constructor() {
                super('jwt expired');
                this.name = 'JWTExpired';
            }
        },
        JWSSignatureVerificationFailed: class JWSSignatureVerificationFailed extends Error {
            constructor() {
                super('signature verification failed');
                this.name = 'JWSSignatureVerificationFailed';
            }
        },
        JWTClaimValidationFailed: class JWTClaimValidationFailed extends Error {
            constructor() {
                super('claim validation failed');
                this.name = 'JWTClaimValidationFailed';
            }
        }
    }
}));

// Import after mock
const jose = await import('jose');

describe('TokenValidator', () => {
    const defaultConfig = {
        jwksUri: 'http://localhost:8080/realms/postgres-mcp/protocol/openid-connect/certs',
        issuer: 'http://localhost:8080/realms/postgres-mcp',
        audience: 'postgres-mcp'
    };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('constructor', () => {
        it('should create instance with default config values', () => {
            const validator = new TokenValidator(defaultConfig);
            expect(validator).toBeInstanceOf(TokenValidator);
        });

        it('should accept custom config values', () => {
            const validator = new TokenValidator({
                ...defaultConfig,
                clockTolerance: 120,
                jwksCacheTtl: 7200,
                algorithms: ['RS256']
            });
            expect(validator).toBeInstanceOf(TokenValidator);
        });
    });

    describe('validate', () => {
        it('should return valid result for valid token', async () => {
            vi.mocked(jose.jwtVerify).mockResolvedValueOnce({
                payload: {
                    sub: 'user123',
                    scope: 'read write',
                    exp: Math.floor(Date.now() / 1000) + 3600,
                    iat: Math.floor(Date.now() / 1000),
                    iss: 'http://localhost:8080/realms/postgres-mcp',
                    aud: 'postgres-mcp'
                },
                protectedHeader: { alg: 'RS256' }
            } as unknown as Awaited<ReturnType<typeof jose.jwtVerify>>);

            const validator = new TokenValidator(defaultConfig);
            const result = await validator.validate('valid.jwt.token');

            expect(result.valid).toBe(true);
            expect(result.claims?.sub).toBe('user123');
            expect(result.claims?.scopes).toEqual(['read', 'write']);
        });

        it('should handle tokens without scope claim', async () => {
            vi.mocked(jose.jwtVerify).mockResolvedValueOnce({
                payload: {
                    sub: 'user123',
                    exp: Math.floor(Date.now() / 1000) + 3600,
                    iat: Math.floor(Date.now() / 1000)
                },
                protectedHeader: { alg: 'RS256' }
            } as unknown as Awaited<ReturnType<typeof jose.jwtVerify>>);

            const validator = new TokenValidator(defaultConfig);
            const result = await validator.validate('token.without.scope');

            expect(result.valid).toBe(true);
            expect(result.claims?.scopes).toEqual([]);
        });

        it('should return TOKEN_EXPIRED error for expired tokens', async () => {
            vi.mocked(jose.jwtVerify).mockRejectedValueOnce(new jose.errors.JWTExpired());

            const validator = new TokenValidator(defaultConfig);
            const result = await validator.validate('expired.jwt.token');

            expect(result.valid).toBe(false);
            expect(result.errorCode).toBe('TOKEN_EXPIRED');
        });

        it('should return INVALID_SIGNATURE for bad signatures', async () => {
            vi.mocked(jose.jwtVerify).mockRejectedValueOnce(
                new jose.errors.JWSSignatureVerificationFailed()
            );

            const validator = new TokenValidator(defaultConfig);
            const result = await validator.validate('bad.sig.token');

            expect(result.valid).toBe(false);
            expect(result.errorCode).toBe('INVALID_SIGNATURE');
        });

        it('should return INVALID_CLAIMS for claim validation failures', async () => {
            vi.mocked(jose.jwtVerify).mockRejectedValueOnce(
                new jose.errors.JWTClaimValidationFailed()
            );

            const validator = new TokenValidator(defaultConfig);
            const result = await validator.validate('wrong.claims.token');

            expect(result.valid).toBe(false);
            expect(result.errorCode).toBe('INVALID_CLAIMS');
        });

        it('should return INVALID_TOKEN for generic errors', async () => {
            vi.mocked(jose.jwtVerify).mockRejectedValueOnce(new Error('Unknown error'));

            const validator = new TokenValidator(defaultConfig);
            const result = await validator.validate('malformed.token');

            expect(result.valid).toBe(false);
            expect(result.errorCode).toBe('INVALID_TOKEN');
        });

        it('should extract client_id from payload', async () => {
            vi.mocked(jose.jwtVerify).mockResolvedValueOnce({
                payload: {
                    sub: 'user123',
                    scope: 'read',
                    exp: Math.floor(Date.now() / 1000) + 3600,
                    iat: Math.floor(Date.now() / 1000),
                    client_id: 'my-client-app'
                },
                protectedHeader: { alg: 'RS256' }
            } as unknown as Awaited<ReturnType<typeof jose.jwtVerify>>);

            const validator = new TokenValidator(defaultConfig);
            const result = await validator.validate('token.with.clientid');

            expect(result.claims?.client_id).toBe('my-client-app');
        });
    });

    describe('invalidateCache', () => {
        it('should clear the JWKS cache', () => {
            const validator = new TokenValidator(defaultConfig);
            // This should not throw
            expect(() => validator.invalidateCache()).not.toThrow();
        });
    });

    describe('createTokenValidator factory', () => {
        it('should create a TokenValidator instance', () => {
            const validator = createTokenValidator(defaultConfig);
            expect(validator).toBeInstanceOf(TokenValidator);
        });
    });
});
