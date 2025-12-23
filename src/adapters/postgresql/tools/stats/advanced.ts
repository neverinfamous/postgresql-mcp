/**
 * PostgreSQL Statistics Tools - Advanced Statistics
 * 
 * Advanced statistical analysis tools: time series, distribution, hypothesis testing, sampling.
 */

import type { PostgresAdapter } from '../../PostgresAdapter.js';
import type { ToolDefinition, RequestContext } from '../../../../types/index.js';
import { z } from 'zod';
import { readOnly } from '../../../../utils/annotations.js';
import { getToolIcons } from '../../../../utils/icons.js';

// =============================================================================
// Parameter Preprocessing
// =============================================================================

/**
 * Valid interval units for time series analysis
 */
const VALID_INTERVALS = ['minute', 'hour', 'day', 'week', 'month', 'year'] as const;

/**
 * Interval shorthand mappings
 */
const INTERVAL_SHORTHANDS: Record<string, string> = {
    'daily': 'day',
    'hourly': 'hour',
    'weekly': 'week',
    'monthly': 'month',
    'yearly': 'year',
    'minutely': 'minute'
};

/**
 * Preprocess time series parameters:
 * - Extract interval unit from PostgreSQL-style intervals ('1 day' → 'day', '2 hours' → 'hour')
 * - Normalize to lowercase
 * - Handle shorthands: daily→day, hourly→hour, weekly→week, monthly→month
 * - Alias: column → valueColumn, time → timeColumn
 * - Alias: tableName → table
 * - Default interval to 'day' if not provided
 */
function preprocessTimeSeriesParams(input: unknown): unknown {
    if (typeof input !== 'object' || input === null) {
        return input;
    }

    const result = { ...input as Record<string, unknown> };

    // Alias: tableName → table
    if (result['tableName'] !== undefined && result['table'] === undefined) {
        result['table'] = result['tableName'];
    }

    // Alias: column → valueColumn
    if (result['column'] !== undefined && result['valueColumn'] === undefined) {
        result['valueColumn'] = result['column'];
    }

    // Alias: time → timeColumn
    if (result['time'] !== undefined && result['timeColumn'] === undefined) {
        result['timeColumn'] = result['time'];
    }

    // Alias: bucket → interval
    if (result['bucket'] !== undefined && result['interval'] === undefined) {
        result['interval'] = result['bucket'];
    }

    if (typeof result['interval'] === 'string') {
        let interval = result['interval'].toLowerCase().trim();

        // Handle shorthands: daily → day, hourly → hour, etc.
        const shorthand = INTERVAL_SHORTHANDS[interval];
        if (shorthand !== undefined) {
            interval = shorthand;
        }

        // Extract unit from PostgreSQL-style interval: '1 day', '2 hours', etc.
        const match = /^\d+\s*(\w+?)s?$/.exec(interval);
        if (match?.[1] !== undefined) {
            interval = match[1];
        }

        // Handle plural forms: 'days' → 'day', 'hours' → 'hour'
        if (interval.endsWith('s') && VALID_INTERVALS.includes(interval.slice(0, -1) as typeof VALID_INTERVALS[number])) {
            interval = interval.slice(0, -1);
        }

        result['interval'] = interval;
    } else if (result['interval'] === undefined) {
        // Default interval to 'day' if not provided
        result['interval'] = 'day';
    }

    // Alias: filter → where
    if (result['filter'] !== undefined && result['where'] === undefined) {
        result['where'] = result['filter'];
    }

    return result;
}

/**
 * Preprocess hypothesis test parameters:
 * - Normalize testType variants: 'ttest', 't-test', 'T_TEST' → 't_test'
 * - Default testType to 't_test' if not provided
 * - Alias: tableName → table, col → column
 */
function preprocessHypothesisParams(input: unknown): unknown {
    if (typeof input !== 'object' || input === null) {
        return input;
    }

    const result = { ...input as Record<string, unknown> };

    // Alias: tableName → table
    if (result['tableName'] !== undefined && result['table'] === undefined) {
        result['table'] = result['tableName'];
    }

    // Alias: col → column
    if (result['col'] !== undefined && result['column'] === undefined) {
        result['column'] = result['col'];
    }

    if (typeof result['testType'] === 'string') {
        const normalized = result['testType'].toLowerCase().trim();

        // t_test variants: t, ttest, t-test, t_test, T_TEST
        if (normalized === 't' || /^t[-_]?test$/.test(normalized)) {
            result['testType'] = 't_test';
        }
        // z_test variants: z, ztest, z-test, z_test, Z_TEST
        else if (normalized === 'z' || /^z[-_]?test$/.test(normalized)) {
            result['testType'] = 'z_test';
        }
    } else if (result['testType'] === undefined) {
        // Auto-detect: if populationStdDev or sigma provided, default to z_test
        if (result['populationStdDev'] !== undefined || result['sigma'] !== undefined) {
            result['testType'] = 'z_test';
        } else {
            // Default testType to 't_test' if not provided
            result['testType'] = 't_test';
        }
    }

    // Alias: filter → where
    if (result['filter'] !== undefined && result['where'] === undefined) {
        result['where'] = result['filter'];
    }

    return result;
}

/**
 * Preprocess distribution parameters:
 * - Alias: tableName → table, col → column
 */
function preprocessDistributionParams(input: unknown): unknown {
    if (typeof input !== 'object' || input === null) {
        return input;
    }
    const result = { ...input as Record<string, unknown> };
    // Alias: tableName → table
    if (result['tableName'] !== undefined && result['table'] === undefined) {
        result['table'] = result['tableName'];
    }
    // Alias: col → column
    if (result['col'] !== undefined && result['column'] === undefined) {
        result['column'] = result['col'];
    }
    // Alias: filter → where
    if (result['filter'] !== undefined && result['where'] === undefined) {
        result['where'] = result['filter'];
    }
    return result;
}

/**
 * Preprocess sampling parameters:
 * - Alias: tableName → table, columns → select
 */
function preprocessSamplingParams(input: unknown): unknown {
    if (typeof input !== 'object' || input === null) {
        return input;
    }
    const result = { ...input as Record<string, unknown> };
    // Alias: tableName → table
    if (result['tableName'] !== undefined && result['table'] === undefined) {
        result['table'] = result['tableName'];
    }
    // Alias: columns → select
    if (result['columns'] !== undefined && result['select'] === undefined) {
        result['select'] = result['columns'];
    }
    // Alias: filter → where
    if (result['filter'] !== undefined && result['where'] === undefined) {
        result['where'] = result['filter'];
    }
    return result;
}

// =============================================================================
// Advanced Statistics Schemas
// =============================================================================

export const StatsTimeSeriesSchema = z.preprocess(
    preprocessTimeSeriesParams,
    z.object({
        table: z.string().describe('Table name'),
        valueColumn: z.string().describe('Numeric column to aggregate'),
        timeColumn: z.string().describe('Timestamp column'),
        interval: z.enum(['minute', 'hour', 'day', 'week', 'month', 'year']).describe('Time bucket size (default: day)'),
        aggregation: z.enum(['sum', 'avg', 'min', 'max', 'count']).optional().describe('Aggregation function (default: avg)'),
        schema: z.string().optional().describe('Schema name'),
        where: z.string().optional().describe('Filter condition'),
        limit: z.number().optional().describe('Max time buckets to return'),
        groupBy: z.string().optional().describe('Column to group time series by')
    })
);


export const StatsDistributionSchema = z.preprocess(
    preprocessDistributionParams,
    z.object({
        table: z.string().describe('Table name'),
        column: z.string().describe('Numeric column'),
        buckets: z.number().optional().describe('Number of histogram buckets (default: 10)'),
        schema: z.string().optional().describe('Schema name'),
        where: z.string().optional().describe('Filter condition'),
        groupBy: z.string().optional().describe('Column to group distribution by')
    }).refine((data) => data.buckets === undefined || data.buckets > 0, {
        message: 'buckets must be greater than 0',
        path: ['buckets']
    })
);

export const StatsHypothesisSchema = z.preprocess(
    preprocessHypothesisParams,
    z.object({
        table: z.string().describe('Table name'),
        column: z.string().describe('Numeric column'),
        testType: z.enum(['t_test', 'z_test']).describe('Type of hypothesis test: t_test or z_test (accepts shorthand: t, z, ttest, ztest)'),
        hypothesizedMean: z.number().optional().describe('Hypothesized population mean'),
        mean: z.number().optional().describe('Alias for hypothesizedMean'),
        expected: z.number().optional().describe('Alias for hypothesizedMean'),
        populationStdDev: z.number().optional().describe('Known population standard deviation (required for z-test)'),
        sigma: z.number().optional().describe('Alias for populationStdDev'),
        schema: z.string().optional().describe('Schema name'),
        where: z.string().optional().describe('Filter condition'),
        groupBy: z.string().optional().describe('Column to group hypothesis test by')
    }).transform((data) => ({
        table: data.table,
        column: data.column,
        testType: data.testType,
        hypothesizedMean: data.hypothesizedMean ?? data.mean ?? data.expected ?? 0,
        populationStdDev: data.populationStdDev ?? data.sigma,
        schema: data.schema,
        where: data.where,
        groupBy: data.groupBy
    })).refine((data) => data.hypothesizedMean !== 0 || data.hypothesizedMean === 0, {
        // This allows 0 as a valid hypothesized mean - refinement always passes
        message: 'hypothesizedMean (or mean/expected alias) is required'
    })
);

export const StatsSamplingSchema = z.preprocess(
    preprocessSamplingParams,
    z.object({
        table: z.string().describe('Table name'),
        method: z.enum(['random', 'bernoulli', 'system']).optional().describe('Sampling method (default: random). Note: system uses page-level sampling and may return 0 rows on small tables'),
        sampleSize: z.number().optional().describe('Number of rows for random sampling (must be > 0)'),
        percentage: z.number().optional().describe('Percentage for bernoulli/system sampling (0-100)'),
        schema: z.string().optional().describe('Schema name'),
        select: z.array(z.string()).optional().describe('Columns to select'),
        where: z.string().optional().describe('Filter condition')
    }).refine((data) => data.sampleSize === undefined || data.sampleSize > 0, {
        message: 'sampleSize must be greater than 0',
        path: ['sampleSize']
    }).refine((data) => data.percentage === undefined || (data.percentage >= 0 && data.percentage <= 100), {
        message: 'percentage must be between 0 and 100',
        path: ['percentage']
    })
);

// =============================================================================
// Tool Implementations
// =============================================================================

/**
 * Time series analysis
 */
export function createStatsTimeSeriesTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_stats_time_series',
        description: 'Aggregate data into time buckets for time series analysis. Use groupBy to get separate time series per category.',
        group: 'stats',
        inputSchema: StatsTimeSeriesSchema,
        annotations: readOnly('Time Series Analysis'),
        icons: getToolIcons('stats', readOnly('Time Series Analysis')),
        handler: async (params: unknown, _context: RequestContext) => {
            const { table, valueColumn, timeColumn, interval, aggregation, schema, where, limit, groupBy } =
                StatsTimeSeriesSchema.parse(params) as {
                    table: string;
                    valueColumn: string;
                    timeColumn: string;
                    interval: string;
                    aggregation?: string;
                    schema?: string;
                    where?: string;
                    limit?: number;
                    groupBy?: string;
                };

            const schemaPrefix = schema ? `"${schema}".` : '';
            const whereClause = where ? `WHERE ${where}` : '';
            const agg = aggregation ?? 'avg';
            const lim = limit ?? 100;

            // Validate timeColumn is a timestamp/date type
            const typeCheckQuery = `
                SELECT data_type 
                FROM information_schema.columns 
                WHERE table_schema = '${schema ?? 'public'}' 
                AND table_name = '${table}'
                AND column_name = '${timeColumn}'
            `;
            const typeResult = await adapter.executeQuery(typeCheckQuery);
            const typeRow = typeResult.rows?.[0] as { data_type: string } | undefined;

            if (!typeRow) {
                return { error: `Column "${timeColumn}" not found in table "${schema ?? 'public'}.${table}"` };
            }

            const validTypes = ['timestamp without time zone', 'timestamp with time zone', 'date', 'time', 'time without time zone', 'time with time zone'];
            if (!validTypes.includes(typeRow.data_type)) {
                return { error: `Column "${timeColumn}" is type "${typeRow.data_type}" but must be a timestamp or date type for time series analysis` };
            }

            // Helper to map bucket row
            const mapBucket = (row: Record<string, unknown>): { timeBucket: Date; value: number; count: number } => ({
                timeBucket: row['time_bucket'] as Date,
                value: Number(row['value']),
                count: Number(row['count'])
            });

            if (groupBy !== undefined) {
                // Grouped time series
                const sql = `
                    SELECT 
                        "${groupBy}" as group_key,
                        DATE_TRUNC('${interval}', "${timeColumn}") as time_bucket,
                        ${agg.toUpperCase()}("${valueColumn}")::numeric(20,6) as value,
                        COUNT(*) as count
                    FROM ${schemaPrefix}"${table}"
                    ${whereClause}
                    GROUP BY "${groupBy}", DATE_TRUNC('${interval}', "${timeColumn}")
                    ORDER BY "${groupBy}", time_bucket DESC
                `;

                const result = await adapter.executeQuery(sql);
                const rows = result.rows ?? [];

                // Group results by group_key
                const groupsMap = new Map<unknown, { timeBucket: Date; value: number; count: number }[]>();
                for (const row of rows) {
                    const key = row['group_key'];
                    if (!groupsMap.has(key)) {
                        groupsMap.set(key, []);
                    }
                    const bucketList = groupsMap.get(key);
                    if (bucketList !== undefined && bucketList.length < lim) {
                        bucketList.push(mapBucket(row));
                    }
                }

                const groups = Array.from(groupsMap.entries()).map(([key, buckets]) => ({
                    groupKey: key,
                    buckets
                }));

                return {
                    table: `${schema ?? 'public'}.${table}`,
                    valueColumn,
                    timeColumn,
                    interval,
                    aggregation: agg,
                    groupBy,
                    groups,
                    count: groups.length
                };
            }

            // Ungrouped time series (original behavior)
            const sql = `
                SELECT 
                    DATE_TRUNC('${interval}', "${timeColumn}") as time_bucket,
                    ${agg.toUpperCase()}("${valueColumn}")::numeric(20,6) as value,
                    COUNT(*) as count
                FROM ${schemaPrefix}"${table}"
                ${whereClause}
                GROUP BY DATE_TRUNC('${interval}', "${timeColumn}")
                ORDER BY time_bucket DESC
                LIMIT ${String(lim)}
            `;

            const result = await adapter.executeQuery(sql);

            const buckets = (result.rows ?? []).map(row => mapBucket(row));

            return {
                table: `${schema ?? 'public'}.${table}`,
                valueColumn,
                timeColumn,
                interval,
                aggregation: agg,
                buckets
            };
        }
    };
}


/**
 * Distribution analysis with histogram
 */
export function createStatsDistributionTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_stats_distribution',
        description: 'Analyze data distribution with histogram buckets, skewness, and kurtosis. Use groupBy to get distribution per category.',
        group: 'stats',
        inputSchema: StatsDistributionSchema,
        annotations: readOnly('Distribution Analysis'),
        icons: getToolIcons('stats', readOnly('Distribution Analysis')),
        handler: async (params: unknown, _context: RequestContext) => {
            const parsed = StatsDistributionSchema.parse(params) as {
                table: string;
                column: string;
                buckets?: number;
                schema?: string;
                where?: string;
                groupBy?: string;
            };
            const { table, column, buckets, schema, where, groupBy } = parsed;

            const schemaPrefix = schema ? `"${schema}".` : '';
            const whereClause = where ? `WHERE ${where}` : '';
            const numBuckets = buckets ?? 10;

            // Helper to compute skewness and kurtosis for a given group
            const computeMoments = async (groupFilter?: string): Promise<{
                minVal: number;
                maxVal: number;
                skewness: number | null;
                kurtosis: number | null;
            } | null> => {
                const filterClause = groupFilter
                    ? (whereClause ? `${whereClause} AND ${groupFilter}` : `WHERE ${groupFilter}`)
                    : whereClause;

                const statsQuery = `
                    WITH stats AS (
                        SELECT 
                            MIN("${column}") as min_val,
                            MAX("${column}") as max_val,
                            AVG("${column}") as mean,
                            STDDEV_POP("${column}") as stddev,
                            COUNT("${column}") as n
                        FROM ${schemaPrefix}"${table}"
                        ${filterClause}
                    ),
                    moments AS (
                        SELECT 
                            s.min_val,
                            s.max_val,
                            s.mean,
                            s.stddev,
                            s.n,
                            CASE WHEN s.stddev > 0 AND s.n > 2 THEN
                                (SUM(POWER(("${column}" - s.mean) / s.stddev, 3)) / s.n)::numeric(10,6)
                            ELSE NULL END as skewness,
                            CASE WHEN s.stddev > 0 AND s.n > 3 THEN
                                ((SUM(POWER(("${column}" - s.mean) / s.stddev, 4)) / s.n) - 3)::numeric(10,6)
                            ELSE NULL END as kurtosis
                        FROM ${schemaPrefix}"${table}" t, stats s
                        ${filterClause}
                        GROUP BY s.min_val, s.max_val, s.mean, s.stddev, s.n
                    )
                    SELECT * FROM moments
                `;

                const result = await adapter.executeQuery(statsQuery);
                const row = result.rows?.[0];

                if (row?.['min_val'] == null || row['max_val'] == null) {
                    return null;
                }

                return {
                    minVal: Number(row['min_val']),
                    maxVal: Number(row['max_val']),
                    skewness: row['skewness'] !== null ? Number(row['skewness']) : null,
                    kurtosis: row['kurtosis'] !== null ? Number(row['kurtosis']) : null
                };
            };

            // Helper to generate histogram for given min/max
            const generateHistogram = async (minVal: number, maxVal: number, groupFilter?: string): Promise<{
                bucket: number;
                frequency: number;
                rangeMin: number;
                rangeMax: number;
            }[]> => {
                const filterClause = groupFilter
                    ? (whereClause ? `${whereClause} AND ${groupFilter}` : `WHERE ${groupFilter}`)
                    : whereClause;

                const histogramQuery = `
                    SELECT 
                        WIDTH_BUCKET("${column}", ${String(minVal)}, ${String(maxVal + 0.0001)}, ${String(numBuckets)}) as bucket,
                        COUNT(*) as frequency,
                        MIN("${column}") as bucket_min,
                        MAX("${column}") as bucket_max
                    FROM ${schemaPrefix}"${table}"
                    ${filterClause}
                    GROUP BY WIDTH_BUCKET("${column}", ${String(minVal)}, ${String(maxVal + 0.0001)}, ${String(numBuckets)})
                    ORDER BY bucket
                `;

                const result = await adapter.executeQuery(histogramQuery);
                return (result.rows ?? []).map(row => ({
                    bucket: Number(row['bucket']),
                    frequency: Number(row['frequency']),
                    rangeMin: Number(row['bucket_min']),
                    rangeMax: Number(row['bucket_max'])
                }));
            };

            if (groupBy !== undefined) {
                // Get distinct groups first
                const groupsQuery = `
                    SELECT DISTINCT "${groupBy}" as group_key
                    FROM ${schemaPrefix}"${table}"
                    ${whereClause}
                    ORDER BY "${groupBy}"
                `;
                const groupsResult = await adapter.executeQuery(groupsQuery);
                const groupKeys = (groupsResult.rows ?? []).map(r => r['group_key']);

                // Process each group
                const groups: {
                    groupKey: unknown;
                    range: { min: number; max: number };
                    bucketWidth: number;
                    skewness: number | null;
                    kurtosis: number | null;
                    histogram: { bucket: number; frequency: number; rangeMin: number; rangeMax: number }[];
                }[] = [];

                for (const groupKey of groupKeys) {
                    const groupFilter = typeof groupKey === 'string'
                        ? `"${groupBy}" = '${groupKey.replace(/'/g, "''")}'`
                        : `"${groupBy}" = ${String(groupKey)}`;

                    const moments = await computeMoments(groupFilter);
                    if (moments === null) continue;

                    const { minVal, maxVal, skewness, kurtosis } = moments;
                    const bucketWidth = Math.round((maxVal - minVal) / numBuckets * 1e6) / 1e6;
                    const histogram = await generateHistogram(minVal, maxVal, groupFilter);

                    groups.push({
                        groupKey,
                        range: { min: minVal, max: maxVal },
                        bucketWidth,
                        skewness,
                        kurtosis,
                        histogram
                    });
                }

                return {
                    table: `${schema ?? 'public'}.${table}`,
                    column,
                    groupBy,
                    groups,
                    count: groups.length
                };
            }

            // Ungrouped distribution (existing logic)
            const moments = await computeMoments();
            if (moments === null) {
                return { error: 'No data or all nulls in column' };
            }

            const { minVal, maxVal, skewness, kurtosis } = moments;
            const bucketWidth = Math.round((maxVal - minVal) / numBuckets * 1e6) / 1e6;
            const histogram = await generateHistogram(minVal, maxVal);

            return {
                table: `${schema ?? 'public'}.${table}`,
                column,
                range: { min: minVal, max: maxVal },
                bucketWidth,
                skewness,
                kurtosis,
                histogram
            };
        }
    };
}


/**
 * Hypothesis testing (t-test or z-test)
 */
export function createStatsHypothesisTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_stats_hypothesis',
        description: 'Perform one-sample t-test or z-test against a hypothesized mean. For z-test, provide populationStdDev (sigma) for accurate results. Use groupBy to test each group separately.',
        group: 'stats',
        inputSchema: StatsHypothesisSchema,
        annotations: readOnly('Hypothesis Testing'),
        icons: getToolIcons('stats', readOnly('Hypothesis Testing')),
        handler: async (params: unknown, _context: RequestContext) => {
            const { table, column, testType, hypothesizedMean, populationStdDev, schema, where, groupBy } =
                StatsHypothesisSchema.parse(params) as {
                    table: string;
                    column: string;
                    testType: string;
                    hypothesizedMean: number;
                    populationStdDev?: number;
                    groupBy?: string;
                    schema?: string;
                    where?: string;
                };

            const schemaPrefix = schema ? `"${schema}".` : '';
            const whereClause = where ? `WHERE ${where}` : '';

            // Helper to calculate test results from row stats
            const calculateTestResults = (n: number, sampleMean: number, sampleStdDev: number): {
                sampleSize: number;
                sampleMean: number;
                sampleStdDev: number;
                populationStdDev: number | null;
                standardError: number;
                testStatistic: number;
                degreesOfFreedom: number | null;
                interpretation: string;
                note: string;
            } | { error: string; sampleSize: number } => {
                if (n < 2 || isNaN(sampleStdDev) || sampleStdDev === 0) {
                    return { error: 'Insufficient data or zero variance', sampleSize: n };
                }

                let stddevUsed: number;
                let stddevNote: string | undefined;

                if (testType === 'z_test') {
                    if (populationStdDev !== undefined) {
                        stddevUsed = populationStdDev;
                    } else {
                        stddevUsed = sampleStdDev;
                        stddevNote = 'No populationStdDev provided; using sample stddev (less accurate for z-test)';
                    }
                } else {
                    stddevUsed = sampleStdDev;
                }

                const standardError = stddevUsed / Math.sqrt(n);
                const testStatistic = (sampleMean - hypothesizedMean) / standardError;
                const degreesOfFreedom = n - 1;

                // Build note with warnings
                let noteText = stddevNote ?? 'For exact p-values, use external statistical software';
                if (n < 30) {
                    noteText = `Small sample size (n=${String(n)}): results may be less reliable. ` + noteText;
                }

                return {
                    sampleSize: n,
                    sampleMean,
                    sampleStdDev,
                    populationStdDev: testType === 'z_test' ? (populationStdDev ?? null) : null,
                    standardError,
                    testStatistic,
                    degreesOfFreedom: testType === 't_test' ? degreesOfFreedom : null,
                    interpretation: Math.abs(testStatistic) > 1.96
                        ? 'Test statistic suggests potential significance at α=0.05 level'
                        : 'Test statistic does not suggest significance at α=0.05 level',
                    note: noteText
                };
            };

            if (groupBy !== undefined) {
                // Grouped hypothesis tests
                const sql = `
                    SELECT 
                        "${groupBy}" as group_key,
                        COUNT("${column}") as n,
                        AVG("${column}")::numeric(20,6) as mean,
                        STDDEV_SAMP("${column}")::numeric(20,6) as stddev
                    FROM ${schemaPrefix}"${table}"
                    ${whereClause}
                    GROUP BY "${groupBy}"
                    ORDER BY "${groupBy}"
                `;

                const result = await adapter.executeQuery(sql);
                const rows = result.rows ?? [];

                const groups = rows.map(row => {
                    const n = Number(row['n']);
                    const sampleMean = Number(row['mean']);
                    const sampleStdDev = Number(row['stddev']);
                    return {
                        groupKey: row['group_key'],
                        results: calculateTestResults(n, sampleMean, sampleStdDev)
                    };
                });

                return {
                    table: `${schema ?? 'public'}.${table}`,
                    column,
                    testType,
                    hypothesizedMean,
                    groupBy,
                    groups,
                    count: groups.length
                };
            }

            // Ungrouped hypothesis test
            const sql = `
                SELECT 
                    COUNT("${column}") as n,
                    AVG("${column}")::numeric(20,6) as mean,
                    STDDEV_SAMP("${column}")::numeric(20,6) as stddev
                FROM ${schemaPrefix}"${table}"
                ${whereClause}
            `;

            const result = await adapter.executeQuery(sql);
            const row = result.rows?.[0] as { n: string | number; mean: string | number; stddev: string | number } | undefined;
            if (!row) return { error: 'No data found' };

            const n = Number(row.n);
            const sampleMean = Number(row.mean);
            const sampleStdDev = Number(row.stddev);

            const testResults = calculateTestResults(n, sampleMean, sampleStdDev);

            // If error, return at top level (not nested in results)
            if ('error' in testResults) {
                return testResults;
            }

            return {
                table: `${schema ?? 'public'}.${table}`,
                column,
                testType,
                hypothesizedMean,
                results: testResults
            };
        }
    };
}

/**
 * Random sampling
 */
export function createStatsSamplingTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_stats_sampling',
        description: 'Get a random sample of rows. Use sampleSize for exact row count (any method), or percentage for approximate sampling with bernoulli/system methods.',
        group: 'stats',
        inputSchema: StatsSamplingSchema,
        annotations: readOnly('Random Sampling'),
        icons: getToolIcons('stats', readOnly('Random Sampling')),
        handler: async (params: unknown, _context: RequestContext) => {
            const { table, method, sampleSize, percentage, schema, select, where } =
                StatsSamplingSchema.parse(params);

            const schemaPrefix = schema ? `"${schema}".` : '';
            const columns = select && select.length > 0 ? select.map(c => `"${c}"`).join(', ') : '*';
            const whereClause = where ? `WHERE ${where}` : '';
            const samplingMethod = method ?? 'random';

            let sql: string;
            let note: string | undefined;

            // If sampleSize is provided, always use ORDER BY RANDOM() LIMIT n for exact counts
            // TABLESAMPLE BERNOULLI/SYSTEM are percentage-based and cannot guarantee exact row counts
            if (sampleSize !== undefined) {
                const limit = sampleSize;
                sql = `
                    SELECT ${columns}
                    FROM ${schemaPrefix}"${table}"
                    ${whereClause}
                    ORDER BY RANDOM()
                    LIMIT ${String(limit)}
                `;
                if (percentage !== undefined) {
                    note = `sampleSize (${String(sampleSize)}) takes precedence over percentage (${String(percentage)}%). Using ORDER BY RANDOM() LIMIT for exact row count.`;
                } else if (samplingMethod !== 'random') {
                    note = `Using ORDER BY RANDOM() LIMIT for exact ${String(sampleSize)} row count. TABLESAMPLE ${samplingMethod.toUpperCase()} is percentage-based and cannot guarantee exact counts.`;
                }
            } else if (samplingMethod === 'random') {
                // Default random sampling with default limit
                const limit = 100;
                sql = `
                    SELECT ${columns}
                    FROM ${schemaPrefix}"${table}"
                    ${whereClause}
                    ORDER BY RANDOM()
                    LIMIT ${String(limit)}
                `;
                if (percentage !== undefined) {
                    note = `percentage (${String(percentage)}%) is ignored for random method. Use method:'bernoulli' or method:'system' for percentage-based sampling, or use sampleSize for exact row count.`;
                }
            } else {
                // TABLESAMPLE with percentage (approximate row count)
                const pct = percentage ?? 10;
                sql = `
                    SELECT ${columns}
                    FROM ${schemaPrefix}"${table}"
                    TABLESAMPLE ${samplingMethod.toUpperCase()}(${String(pct)})
                    ${whereClause}
                `;
                note = `TABLESAMPLE ${samplingMethod.toUpperCase()}(${String(pct)}%) returns approximately ${String(pct)}% of rows. Actual count varies based on table size and sampling algorithm.`;
            }

            const result = await adapter.executeQuery(sql);
            const rows = result.rows ?? [];

            const response: {
                table: string;
                method: string;
                sampleSize: number;
                rows: unknown[];
                note?: string;
            } = {
                table: `${schema ?? 'public'}.${table}`,
                method: samplingMethod,
                sampleSize: rows.length,
                rows
            };

            if (note !== undefined) {
                response.note = note;
            }

            // Add note if requested sampleSize exceeded available rows
            if (sampleSize !== undefined && rows.length < sampleSize) {
                const existingNote = response.note !== undefined ? response.note + ' ' : '';
                response.note = existingNote + `Requested ${String(sampleSize)} rows but only ${String(rows.length)} available.`;
            }

            return response;
        }
    };
}

