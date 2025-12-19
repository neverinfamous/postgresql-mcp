/**
 * postgres-mcp - Test Mocks
 * 
 * Centralized mock factories for testing. All tests should import
 * mocks from this module for consistency.
 */

// PostgreSQL Adapter mocks
export {
    createMockQueryResult,
    createMockColumnInfo,
    createMockTableInfo,
    createMockIndexInfo,
    createMockSchemaInfo,
    createMockHealthStatus,
    createMockPostgresAdapter,
    createMockPostgresAdapterEmpty,
    createMockPostgresAdapterWithError,
    createMockPostgresAdapterWithTransaction,
    createMockRequestContext,
    configureMockAdapterQuery
} from './adapter.js';
export type { MockPostgresAdapter } from './adapter.js';

// Connection pool mocks
export {
    createMockPoolClient,
    createMockPool,
    createMockConnectionPool,
    configureMockPoolQuery
} from './pool.js';

// Re-export types for convenience
export type {
    QueryResult,
    TableInfo,
    IndexInfo,
    SchemaInfo,
    HealthStatus,
    ColumnInfo
} from '../../types/index.js';
