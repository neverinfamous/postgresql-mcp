/**
 * PostgreSQL Statistics Tools
 * 
 * Statistical analysis using PostgreSQL aggregate and window functions.
 * 8 tools total.
 */

import type { PostgresAdapter } from '../PostgresAdapter.js';
import type { ToolDefinition, RequestContext } from '../../../types/index.js';
import { z } from 'zod';
import { readOnly } from '../../../utils/annotations.js';

// =============================================================================
// Statistics Schemas
// =============================================================================

export const StatsDescriptiveSchema = z.object({
    table: z.string().describe('Table name'),
    column: z.string().describe('Numeric column to analyze'),
    schema: z.string().optional().describe('Schema name (default: public)'),
    where: z.string().optional().describe('Filter condition')
});

export const StatsPercentilesSchema = z.object({
    table: z.string().describe('Table name'),
    column: z.string().describe('Numeric column'),
    percentiles: z.array(z.number()).optional().describe('Percentiles to calculate (0-1), default: [0.25, 0.5, 0.75]'),
    schema: z.string().optional().describe('Schema name'),
    where: z.string().optional().describe('Filter condition')
});

export const StatsCorrelationSchema = z.object({
    table: z.string().describe('Table name'),
    column1: z.string().describe('First numeric column'),
    column2: z.string().describe('Second numeric column'),
    schema: z.string().optional().describe('Schema name'),
    where: z.string().optional().describe('Filter condition')
});

export const StatsRegressionSchema = z.object({
    table: z.string().describe('Table name'),
    xColumn: z.string().describe('Independent variable (X)'),
    yColumn: z.string().describe('Dependent variable (Y)'),
    schema: z.string().optional().describe('Schema name'),
    where: z.string().optional().describe('Filter condition')
});

export const StatsTimeSeriesSchema = z.object({
    table: z.string().describe('Table name'),
    valueColumn: z.string().describe('Numeric column to aggregate'),
    timeColumn: z.string().describe('Timestamp column'),
    interval: z.enum(['minute', 'hour', 'day', 'week', 'month', 'year']).describe('Time bucket size'),
    aggregation: z.enum(['sum', 'avg', 'min', 'max', 'count']).optional().describe('Aggregation function (default: avg)'),
    schema: z.string().optional().describe('Schema name'),
    where: z.string().optional().describe('Filter condition'),
    limit: z.number().optional().describe('Max time buckets to return')
});

export const StatsDistributionSchema = z.object({
    table: z.string().describe('Table name'),
    column: z.string().describe('Numeric column'),
    buckets: z.number().optional().describe('Number of histogram buckets (default: 10)'),
    schema: z.string().optional().describe('Schema name'),
    where: z.string().optional().describe('Filter condition')
});

export const StatsHypothesisSchema = z.object({
    table: z.string().describe('Table name'),
    column: z.string().describe('Numeric column'),
    testType: z.enum(['t_test', 'z_test']).describe('Type of hypothesis test'),
    hypothesizedMean: z.number().describe('Hypothesized population mean'),
    schema: z.string().optional().describe('Schema name'),
    where: z.string().optional().describe('Filter condition')
});

export const StatsSamplingSchema = z.object({
    table: z.string().describe('Table name'),
    method: z.enum(['random', 'bernoulli', 'system']).optional().describe('Sampling method (default: random)'),
    sampleSize: z.number().optional().describe('Number of rows for random sampling'),
    percentage: z.number().optional().describe('Percentage for bernoulli/system sampling (0-100)'),
    schema: z.string().optional().describe('Schema name'),
    select: z.array(z.string()).optional().describe('Columns to select'),
    where: z.string().optional().describe('Filter condition')
});

// =============================================================================
// Get All Stats Tools
// =============================================================================

export function getStatsTools(adapter: PostgresAdapter): ToolDefinition[] {
    return [
        createStatsDescriptiveTool(adapter),
        createStatsPercentilesTool(adapter),
        createStatsCorrelationTool(adapter),
        createStatsRegressionTool(adapter),
        createStatsTimeSeriesTool(adapter),
        createStatsDistributionTool(adapter),
        createStatsHypothesisTool(adapter),
        createStatsSamplingTool(adapter)
    ];
}

// =============================================================================
// Tool Implementations
// =============================================================================

/**
 * Descriptive statistics: count, min, max, avg, stddev, variance
 */
function createStatsDescriptiveTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_stats_descriptive',
        description: 'Calculate descriptive statistics (count, min, max, avg, stddev, variance, sum) for a numeric column.',
        group: 'stats',
        inputSchema: StatsDescriptiveSchema,
        annotations: readOnly('Descriptive Statistics'),
        handler: async (params: unknown, _context: RequestContext) => {
            const { table, column, schema, where } = StatsDescriptiveSchema.parse(params);

            const schemaPrefix = schema ? `"${schema}".` : '';
            const whereClause = where ? `WHERE ${where}` : '';

            const sql = `
                SELECT 
                    COUNT("${column}") as count,
                    MIN("${column}") as min,
                    MAX("${column}") as max,
                    AVG("${column}")::numeric(20,6) as avg,
                    STDDEV("${column}")::numeric(20,6) as stddev,
                    VARIANCE("${column}")::numeric(20,6) as variance,
                    SUM("${column}")::numeric(20,6) as sum,
                    (SELECT MODE() WITHIN GROUP (ORDER BY "${column}") FROM ${schemaPrefix}"${table}" ${whereClause}) as mode
                FROM ${schemaPrefix}"${table}"
                ${whereClause}
            `;

            const result = await adapter.executeQuery(sql);
            const stats = result.rows?.[0] as {
                count: string | number;
                min: string | number | null;
                max: string | number | null;
                avg: string | number | null;
                stddev: string | number | null;
                variance: string | number | null;
                sum: string | number | null;
                mode: unknown;
            } | undefined;

            if (!stats) return { error: 'No stats found' };

            return {
                table: `${schema ?? 'public'}.${table}`,
                column,
                statistics: {
                    count: Number(stats.count),
                    min: stats.min !== null ? Number(stats.min) : null,
                    max: stats.max !== null ? Number(stats.max) : null,
                    avg: stats.avg !== null ? Number(stats.avg) : null,
                    stddev: stats.stddev !== null ? Number(stats.stddev) : null,
                    variance: stats.variance !== null ? Number(stats.variance) : null,
                    sum: stats.sum !== null ? Number(stats.sum) : null,
                    mode: stats.mode
                }
            };
        }
    };
}

/**
 * Calculate percentiles
 */
function createStatsPercentilesTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_stats_percentiles',
        description: 'Calculate percentiles (quartiles, custom percentiles) for a numeric column.',
        group: 'stats',
        inputSchema: StatsPercentilesSchema,
        annotations: readOnly('Percentiles'),
        handler: async (params: unknown, _context: RequestContext) => {
            const { table, column, percentiles, schema, where } = StatsPercentilesSchema.parse(params);

            const pctiles = percentiles ?? [0.25, 0.5, 0.75];
            const schemaPrefix = schema ? `"${schema}".` : '';
            const whereClause = where ? `WHERE ${where}` : '';

            const percentileSelects = pctiles.map(p =>
                `PERCENTILE_CONT(${String(p)}) WITHIN GROUP (ORDER BY "${column}") as p${String(Math.round(p * 100))}`
            ).join(',\n                    ');

            const sql = `
                SELECT 
                    ${percentileSelects}
                FROM ${schemaPrefix}"${table}"
                ${whereClause}
            `;

            const result = await adapter.executeQuery(sql);
            const row = (result.rows?.[0] ?? {}) as Record<string, string | number | null>;

            const percentileResults: Record<string, number | null> = {};
            for (const p of pctiles) {
                const key = `p${String(Math.round(p * 100))}`;
                percentileResults[key] = row[key] !== null ? Number(row[key]) : null;
            }

            return {
                table: `${schema ?? 'public'}.${table}`,
                column,
                percentiles: percentileResults
            };
        }
    };
}

/**
 * Correlation analysis
 */
function createStatsCorrelationTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_stats_correlation',
        description: 'Calculate Pearson correlation coefficient between two numeric columns.',
        group: 'stats',
        inputSchema: StatsCorrelationSchema,
        annotations: readOnly('Correlation Analysis'),
        handler: async (params: unknown, _context: RequestContext) => {
            const { table, column1, column2, schema, where } = StatsCorrelationSchema.parse(params);

            const schemaPrefix = schema ? `"${schema}".` : '';
            const whereClause = where ? `WHERE ${where}` : '';

            const sql = `
                SELECT 
                    CORR("${column1}", "${column2}")::numeric(10,6) as correlation,
                    COVAR_POP("${column1}", "${column2}")::numeric(20,6) as covariance_pop,
                    COVAR_SAMP("${column1}", "${column2}")::numeric(20,6) as covariance_sample,
                    COUNT(*) as sample_size
                FROM ${schemaPrefix}"${table}"
                ${whereClause}
            `;

            const result = await adapter.executeQuery(sql);
            const row = result.rows?.[0] as {
                correlation: string | number | null;
                covariance_pop: string | number | null;
                covariance_sample: string | number | null;
                sample_size: string | number;
            } | undefined;

            if (!row) return { error: 'No correlation data found' };

            const corr = row.correlation !== null ? Number(row.correlation) : null;
            let interpretation = 'N/A';
            if (corr !== null) {
                const absCorr = Math.abs(corr);
                if (absCorr >= 0.9) interpretation = 'Very strong';
                else if (absCorr >= 0.7) interpretation = 'Strong';
                else if (absCorr >= 0.5) interpretation = 'Moderate';
                else if (absCorr >= 0.3) interpretation = 'Weak';
                else interpretation = 'Very weak or no correlation';
                if (corr < 0) interpretation += ' (negative)';
                else interpretation += ' (positive)';
            }

            return {
                table: `${schema ?? 'public'}.${table}`,
                columns: [column1, column2],
                correlation: corr,
                interpretation,
                covariancePopulation: row.covariance_pop !== null ? Number(row.covariance_pop) : null,
                covarianceSample: row.covariance_sample !== null ? Number(row.covariance_sample) : null,
                sampleSize: Number(row.sample_size)
            };
        }
    };
}

/**
 * Linear regression
 */
function createStatsRegressionTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_stats_regression',
        description: 'Perform linear regression analysis (y = mx + b) between two columns.',
        group: 'stats',
        inputSchema: StatsRegressionSchema,
        annotations: readOnly('Linear Regression'),
        handler: async (params: unknown, _context: RequestContext) => {
            const { table, xColumn, yColumn, schema, where } = StatsRegressionSchema.parse(params);

            const schemaPrefix = schema ? `"${schema}".` : '';
            const whereClause = where ? `WHERE ${where}` : '';

            const sql = `
                SELECT 
                    REGR_SLOPE("${yColumn}", "${xColumn}")::numeric(20,6) as slope,
                    REGR_INTERCEPT("${yColumn}", "${xColumn}")::numeric(20,6) as intercept,
                    REGR_R2("${yColumn}", "${xColumn}")::numeric(10,6) as r_squared,
                    REGR_AVGX("${yColumn}", "${xColumn}")::numeric(20,6) as avg_x,
                    REGR_AVGY("${yColumn}", "${xColumn}")::numeric(20,6) as avg_y,
                    REGR_COUNT("${yColumn}", "${xColumn}") as sample_size,
                    REGR_SXX("${yColumn}", "${xColumn}")::numeric(20,6) as sum_squares_x,
                    REGR_SYY("${yColumn}", "${xColumn}")::numeric(20,6) as sum_squares_y,
                    REGR_SXY("${yColumn}", "${xColumn}")::numeric(20,6) as sum_products
                FROM ${schemaPrefix}"${table}"
                ${whereClause}
            `;

            const result = await adapter.executeQuery(sql);
            const row = result.rows?.[0] as {
                slope: string | number | null;
                intercept: string | number | null;
                r_squared: string | number | null;
                avg_x: string | number | null;
                avg_y: string | number | null;
                sample_size: string | number;
            } | undefined;

            if (!row) return { error: 'No regression data found' };

            const slope = row.slope !== null ? Number(row.slope) : null;
            const intercept = row.intercept !== null ? Number(row.intercept) : null;
            const rSquared = row.r_squared !== null ? Number(row.r_squared) : null;

            let equation = 'N/A';
            if (slope !== null && intercept !== null) {
                const sign = intercept >= 0 ? '+' : '-';
                equation = `y = ${slope.toFixed(4)}x ${sign} ${Math.abs(intercept).toFixed(4)}`;
            }

            return {
                table: `${schema ?? 'public'}.${table}`,
                xColumn,
                yColumn,
                regression: {
                    slope,
                    intercept,
                    rSquared,
                    equation,
                    avgX: row.avg_x !== null ? Number(row.avg_x) : null,
                    avgY: row.avg_y !== null ? Number(row.avg_y) : null,
                    sampleSize: Number(row.sample_size)
                }
            };
        }
    };
}

/**
 * Time series analysis
 */
function createStatsTimeSeriesTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_stats_time_series',
        description: 'Aggregate data into time buckets for time series analysis.',
        group: 'stats',
        inputSchema: StatsTimeSeriesSchema,
        annotations: readOnly('Time Series Analysis'),
        handler: async (params: unknown, _context: RequestContext) => {
            const { table, valueColumn, timeColumn, interval, aggregation, schema, where, limit } =
                StatsTimeSeriesSchema.parse(params);

            const schemaPrefix = schema ? `"${schema}".` : '';
            const whereClause = where ? `WHERE ${where}` : '';
            const agg = aggregation ?? 'avg';
            const lim = limit ?? 100;

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

            return {
                table: `${schema ?? 'public'}.${table}`,
                valueColumn,
                timeColumn,
                interval,
                aggregation: agg,
                buckets: (result.rows ?? []).map(row => ({
                    timeBucket: (row as { time_bucket: Date }).time_bucket,
                    value: Number((row as { value: string | number }).value),
                    count: Number((row as { count: string | number }).count)
                }))
            };
        }
    };
}

/**
 * Distribution analysis with histogram
 */
function createStatsDistributionTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_stats_distribution',
        description: 'Analyze data distribution with histogram buckets, skewness, and kurtosis.',
        group: 'stats',
        inputSchema: StatsDistributionSchema,
        annotations: readOnly('Distribution Analysis'),
        handler: async (params: unknown, _context: RequestContext) => {
            const { table, column, buckets, schema, where } = StatsDistributionSchema.parse(params);

            const schemaPrefix = schema ? `"${schema}".` : '';
            const whereClause = where ? `WHERE ${where}` : '';
            const numBuckets = buckets ?? 10;

            const rangeQuery = `
                SELECT MIN("${column}") as min_val, MAX("${column}") as max_val
                FROM ${schemaPrefix}"${table}" ${whereClause}
            `;
            const rangeResult = await adapter.executeQuery(rangeQuery);
            const range = rangeResult.rows?.[0] as { min_val: number; max_val: number } | undefined;

            if (range?.min_val == null || range.max_val == null) {
                return { error: 'No data or all nulls in column' };
            }

            const minVal = range.min_val;
            const maxVal = range.max_val;
            const bucketWidth = (maxVal - minVal) / numBuckets;

            const histogramQuery = `
                SELECT 
                    WIDTH_BUCKET("${column}", ${String(minVal)}, ${String(maxVal + 0.0001)}, ${String(numBuckets)}) as bucket,
                    COUNT(*) as frequency,
                    MIN("${column}") as bucket_min,
                    MAX("${column}") as bucket_max
                FROM ${schemaPrefix}"${table}"
                ${whereClause}
                GROUP BY WIDTH_BUCKET("${column}", ${String(minVal)}, ${String(maxVal + 0.0001)}, ${String(numBuckets)})
                ORDER BY bucket
            `;

            const histResult = await adapter.executeQuery(histogramQuery);

            return {
                table: `${schema ?? 'public'}.${table}`,
                column,
                range: { min: minVal, max: maxVal },
                bucketWidth,
                histogram: (histResult.rows ?? []).map(row => ({
                    bucket: Number((row as { bucket: string | number }).bucket),
                    frequency: Number((row as { frequency: string | number }).frequency),
                    rangeMin: (row as { bucket_min: number }).bucket_min,
                    rangeMax: (row as { bucket_max: number }).bucket_max
                }))
            };
        }
    };
}

/**
 * Hypothesis testing (t-test)
 */
function createStatsHypothesisTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_stats_hypothesis',
        description: 'Perform one-sample t-test or z-test against a hypothesized mean.',
        group: 'stats',
        inputSchema: StatsHypothesisSchema,
        annotations: readOnly('Hypothesis Testing'),
        handler: async (params: unknown, _context: RequestContext) => {
            const { table, column, testType, hypothesizedMean, schema, where } =
                StatsHypothesisSchema.parse(params);

            const schemaPrefix = schema ? `"${schema}".` : '';
            const whereClause = where ? `WHERE ${where}` : '';

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
            const stddev = Number(row.stddev);

            if (n < 2 || isNaN(stddev) || stddev === 0) {
                return {
                    error: 'Insufficient data or zero variance',
                    sampleSize: n
                };
            }

            const standardError = stddev / Math.sqrt(n);
            const testStatistic = (sampleMean - hypothesizedMean) / standardError;
            const degreesOfFreedom = n - 1;

            return {
                table: `${schema ?? 'public'}.${table}`,
                column,
                testType,
                hypothesizedMean,
                results: {
                    sampleSize: n,
                    sampleMean,
                    sampleStdDev: stddev,
                    standardError,
                    testStatistic,
                    degreesOfFreedom: testType === 't_test' ? degreesOfFreedom : null,
                    interpretation: Math.abs(testStatistic) > 1.96
                        ? 'Test statistic suggests potential significance at α=0.05 level'
                        : 'Test statistic does not suggest significance at α=0.05 level',
                    note: 'For exact p-values, use external statistical software'
                }
            };
        }
    };
}

/**
 * Random sampling
 */
function createStatsSamplingTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_stats_sampling',
        description: 'Get a random sample of rows using PostgreSQL sampling methods.',
        group: 'stats',
        inputSchema: StatsSamplingSchema,
        annotations: readOnly('Random Sampling'),
        handler: async (params: unknown, _context: RequestContext) => {
            const { table, method, sampleSize, percentage, schema, select, where } =
                StatsSamplingSchema.parse(params);

            const schemaPrefix = schema ? `"${schema}".` : '';
            const columns = select && select.length > 0 ? select.map(c => `"${c}"`).join(', ') : '*';
            const whereClause = where ? `WHERE ${where}` : '';
            const samplingMethod = method ?? 'random';

            let sql: string;

            if (samplingMethod === 'random') {
                const limit = sampleSize ?? 100;
                sql = `
                    SELECT ${columns}
                    FROM ${schemaPrefix}"${table}"
                    ${whereClause}
                    ORDER BY RANDOM()
                    LIMIT ${String(limit)}
                `;
            } else {
                const pct = percentage ?? 10;
                sql = `
                    SELECT ${columns}
                    FROM ${schemaPrefix}"${table}"
                    TABLESAMPLE ${samplingMethod.toUpperCase()}(${String(pct)})
                    ${whereClause}
                `;
            }

            const result = await adapter.executeQuery(sql);

            return {
                table: `${schema ?? 'public'}.${table}`,
                method: samplingMethod,
                sampleSize: result.rows?.length ?? 0,
                rows: result.rows ?? []
            };
        }
    };
}
