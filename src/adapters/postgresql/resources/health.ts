/**
 * Health Resource
 * 
 * Comprehensive database health status.
 */

import type { PostgresAdapter } from '../PostgresAdapter.js';
import type { ResourceDefinition, RequestContext } from '../../../types/index.js';

interface HealthCheck {
    status: 'healthy' | 'warning' | 'critical';
    message: string;
    details?: Record<string, unknown>;
}

export function createHealthResource(adapter: PostgresAdapter): ResourceDefinition {
    return {
        uri: 'postgres://health',
        name: 'Database Health',
        description: 'Comprehensive database health status across multiple dimensions',
        mimeType: 'application/json',
        handler: async (_uri: string, _context: RequestContext) => {
            const checks: Record<string, HealthCheck> = {};

            // Execute all health checks in parallel for better performance
            const [connResult, cacheResult, vacuumResult, wraparoundResult, longQueryResult] = await Promise.all([
                // 1. Connection health
                adapter.executeQuery(`
                    SELECT 
                        count(*) as active_connections,
                        (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') as max_connections
                    FROM pg_stat_activity
                    WHERE state IS NOT NULL
                `),
                // 2. Cache health
                adapter.executeQuery(`
                    SELECT 
                        sum(heap_blks_read) as heap_read,
                        sum(heap_blks_hit) as heap_hit,
                        CASE WHEN sum(heap_blks_read) + sum(heap_blks_hit) > 0 
                            THEN round(100.0 * sum(heap_blks_hit) / (sum(heap_blks_hit) + sum(heap_blks_read)), 2)
                            ELSE 100 
                        END as cache_hit_ratio
                    FROM pg_statio_user_tables
                `),
                // 3. Dead tuples (vacuum health)
                adapter.executeQuery(`
                    SELECT 
                        SUM(n_dead_tup) as total_dead,
                        SUM(n_live_tup) as total_live,
                        CASE WHEN SUM(n_live_tup) > 0 
                            THEN round(100.0 * SUM(n_dead_tup) / SUM(n_live_tup), 2)
                            ELSE 0 
                        END as dead_pct
                    FROM pg_stat_user_tables
                `),
                // 4. Transaction ID wraparound
                adapter.executeQuery(`
                    SELECT 
                        age(datfrozenxid) as xid_age,
                        round(100.0 * age(datfrozenxid) / 2147483648, 2) as percent_toward_wraparound
                    FROM pg_database
                    WHERE datname = current_database()
                `),
                // 5. Long-running queries
                adapter.executeQuery(`
                    SELECT COUNT(*) as count
                    FROM pg_stat_activity
                    WHERE state = 'active'
                      AND query NOT LIKE '%pg_stat_activity%'
                      AND now() - query_start > interval '5 minutes'
                `)
            ]);

            // Process connection health
            const connRow = connResult.rows?.[0];
            const activeConns = Number(connRow?.['active_connections'] ?? 0);
            const maxConns = Number(connRow?.['max_connections'] ?? 100);
            const connPct = (activeConns / maxConns) * 100;
            checks['connections'] = {
                status: connPct > 80 ? 'critical' : connPct > 60 ? 'warning' : 'healthy',
                message: activeConns.toString() + '/' + maxConns.toString() + ' connections (' + connPct.toFixed(1) + '%)',
                details: { active: activeConns, max: maxConns, percentage: connPct }
            };

            // Process cache health
            const cacheRatio = Number(cacheResult.rows?.[0]?.['cache_hit_ratio'] ?? 100);
            checks['cache'] = {
                status: cacheRatio < 90 ? 'critical' : cacheRatio < 95 ? 'warning' : 'healthy',
                message: cacheRatio.toString() + '% cache hit ratio',
                details: { cacheHitRatio: cacheRatio }
            };

            // Process vacuum health
            const deadPct = Number(vacuumResult.rows?.[0]?.['dead_pct'] ?? 0);
            checks['vacuum'] = {
                status: deadPct > 20 ? 'critical' : deadPct > 10 ? 'warning' : 'healthy',
                message: deadPct.toString() + '% dead tuples',
                details: {
                    deadTuples: Number(vacuumResult.rows?.[0]?.['total_dead'] ?? 0),
                    liveTuples: Number(vacuumResult.rows?.[0]?.['total_live'] ?? 0)
                }
            };

            // Process wraparound health
            const wraparoundPct = Number(wraparoundResult.rows?.[0]?.['percent_toward_wraparound'] ?? 0);
            checks['wraparound'] = {
                status: wraparoundPct > 75 ? 'critical' : wraparoundPct > 50 ? 'warning' : 'healthy',
                message: wraparoundPct.toString() + '% toward transaction ID wraparound',
                details: {
                    xidAge: Number(wraparoundResult.rows?.[0]?.['xid_age'] ?? 0),
                    percentage: wraparoundPct
                }
            };

            // Process long-running queries
            const longQueries = Number(longQueryResult.rows?.[0]?.['count'] ?? 0);
            checks['longQueries'] = {
                status: longQueries > 5 ? 'critical' : longQueries > 0 ? 'warning' : 'healthy',
                message: longQueries.toString() + ' queries running > 5 minutes',
                details: { count: longQueries }
            };

            // Overall status
            const statuses = Object.values(checks).map(c => c.status);
            const overallStatus = statuses.includes('critical') ? 'critical'
                : statuses.includes('warning') ? 'warning'
                    : 'healthy';

            return {
                overallStatus,
                checks,
                timestamp: new Date().toISOString(),
                nextSteps: overallStatus !== 'healthy'
                    ? 'Review warnings and use appropriate tools to address issues'
                    : 'No immediate action required'
            };
        }
    };
}
