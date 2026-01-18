/**
 * postgres-mcp - Connection Pool Mock
 *
 * Provides mock implementation of pg Pool and PoolClient
 * for testing connection management without real database.
 */

import { vi } from "vitest";
import type { Pool } from "pg";

/**
 * Create a mock PoolClient
 */
export function createMockPoolClient(): {
  query: ReturnType<typeof vi.fn>;
  release: (err?: Error | boolean) => void;
} {
  return {
    query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    release: vi.fn(),
  };
}

/**
 * Create a mock pg Pool
 */
export function createMockPool(): Partial<Pool> & {
  connect: ReturnType<typeof vi.fn>;
  query: ReturnType<typeof vi.fn>;
  end: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
} {
  const mockClient = createMockPoolClient();

  return {
    connect: vi.fn().mockResolvedValue(mockClient),
    query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    end: vi.fn().mockResolvedValue(undefined),
    on: vi.fn().mockReturnThis(),
    totalCount: 10,
    idleCount: 8,
    waitingCount: 0,
  };
}

/**
 * Create a mock ConnectionPool (our custom wrapper)
 */
export function createMockConnectionPool(): {
  execute: ReturnType<typeof vi.fn>;
  getStats: ReturnType<typeof vi.fn>;
  healthCheck: ReturnType<typeof vi.fn>;
  shutdown: ReturnType<typeof vi.fn>;
  acquire: ReturnType<typeof vi.fn>;
  release: ReturnType<typeof vi.fn>;
} {
  const mockClient = createMockPoolClient();

  return {
    execute: vi
      .fn()
      .mockResolvedValue({ rows: [], rowCount: 0, executionTimeMs: 5 }),
    getStats: vi.fn().mockReturnValue({
      total: 10,
      active: 2,
      idle: 8,
      waiting: 0,
      totalQueries: 100,
    }),
    healthCheck: vi.fn().mockResolvedValue({ connected: true, latencyMs: 5 }),
    shutdown: vi.fn().mockResolvedValue(undefined),
    acquire: vi.fn().mockResolvedValue(mockClient),
    release: vi.fn(),
  };
}

/**
 * Configure mock pool query responses
 */
export function configureMockPoolQuery(
  pool: ReturnType<typeof createMockPool>,
  pattern: string,
  result: { rows: Record<string, unknown>[]; rowCount: number },
): void {
  const originalImpl = pool.query.getMockImplementation() as
    | ((
        sql: string,
      ) => Promise<{ rows: Record<string, unknown>[]; rowCount: number }>)
    | undefined;

  const impl = (
    sql: string,
  ): Promise<{ rows: Record<string, unknown>[]; rowCount: number }> => {
    if (sql.includes(pattern)) {
      return Promise.resolve(result);
    }
    if (typeof originalImpl === "function") {
      return originalImpl(sql);
    }
    return Promise.resolve({ rows: [], rowCount: 0 });
  };
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  pool.query.mockImplementation(impl);
}
