/**
 * PostgreSQL Statistics Tools - Basic Statistics
 * 
 * Core statistical analysis tools: descriptive statistics, percentiles, correlation, regression.
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
 * Preprocess basic stats parameters to normalize common input patterns:
 * - tableName → table
 * - col → column
 * - Auto-normalize percentiles from 0-100 to 0-1 format
 * - Replace empty percentiles array with defaults
 */
function preprocessBasicStatsParams(input: unknown): unknown {
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
    // Handle percentiles: normalize 0-100 to 0-1 and replace empty array
    if (Array.isArray(result['percentiles'])) {
        if (result['percentiles'].length === 0) {
            // Empty array → use defaults
            result['percentiles'] = [0.25, 0.5, 0.75];
        } else {
            // Determine format: if ALL values are in 0-1, treat as already normalized
            // If ANY value > 1 (but <= 100), treat as 0-100 format and divide all by 100
            // If ANY value > 100, it's an error (will be caught by refine validation after normalization)
            const pctiles = result['percentiles'] as number[];
            const hasValuesOver1 = pctiles.some(p => typeof p === 'number' && p > 1);
            const hasValuesOver100 = pctiles.some(p => typeof p === 'number' && p > 100);

            if (hasValuesOver100) {
                // Leave as-is - will fail validation with clear error
            } else if (hasValuesOver1) {
                // Normalize 0-100 format to 0-1
                result['percentiles'] = pctiles.map(p => typeof p === 'number' ? p / 100 : p);
            }
            // else: already in 0-1 format, no change needed
        }
    }
    return result;
}

/**
 * Preprocess correlation parameters:
 * - tableName → table
 * - col1/col2 → column1/column2
 */
function preprocessCorrelationParams(input: unknown): unknown {
    if (typeof input !== 'object' || input === null) {
        return input;
    }
    const result = { ...input as Record<string, unknown> };
    // Alias: tableName → table
    if (result['tableName'] !== undefined && result['table'] === undefined) {
        result['table'] = result['tableName'];
    }
    // Alias: col1 → column1
    if (result['col1'] !== undefined && result['column1'] === undefined) {
        result['column1'] = result['col1'];
    }
    // Alias: col2 → column2
    if (result['col2'] !== undefined && result['column2'] === undefined) {
        result['column2'] = result['col2'];
    }
    // Alias: filter → where
    if (result['filter'] !== undefined && result['where'] === undefined) {
        result['where'] = result['filter'];
    }
    return result;
}

/**
 * Preprocess regression parameters:
 * - tableName → table
 * - x → xColumn
 * - y → yColumn
 */
function preprocessRegressionParams(input: unknown): unknown {
    if (typeof input !== 'object' || input === null) {
        return input;
    }
    const result = { ...input as Record<string, unknown> };
    // Alias: tableName → table
    if (result['tableName'] !== undefined && result['table'] === undefined) {
        result['table'] = result['tableName'];
    }
    // Alias: x → xColumn
    if (result['x'] !== undefined && result['xColumn'] === undefined) {
        result['xColumn'] = result['x'];
    }
    // Alias: y → yColumn
    if (result['y'] !== undefined && result['yColumn'] === undefined) {
        result['yColumn'] = result['y'];
    }
    // Alias: filter → where
    if (result['filter'] !== undefined && result['where'] === undefined) {
        result['where'] = result['filter'];
    }
    return result;
}

// =============================================================================
// Statistics Schemas
// =============================================================================

export const StatsDescriptiveSchema = z.preprocess(
    preprocessBasicStatsParams,
    z.object({
        table: z.string().describe('Table name'),
        column: z.string().describe('Numeric column to analyze'),
        schema: z.string().optional().describe('Schema name (default: public)'),
        where: z.string().optional().describe('Filter condition'),
        groupBy: z.string().optional().describe('Column to group statistics by')
    })
);

export const StatsPercentilesSchema = z.preprocess(
    preprocessBasicStatsParams,
    z.object({
        table: z.string().describe('Table name'),
        column: z.string().describe('Numeric column'),
        percentiles: z.array(z.number()).optional().describe('Percentiles to calculate (0-1 range), default: [0.25, 0.5, 0.75]'),
        schema: z.string().optional().describe('Schema name'),
        where: z.string().optional().describe('Filter condition'),
        groupBy: z.string().optional().describe('Column to group percentiles by')
    }).refine((data) =>
        data.percentiles === undefined || data.percentiles.every(p => p >= 0 && p <= 1), {
        message: 'All percentiles must be between 0 and 1',
        path: ['percentiles']
    })
);

export const StatsCorrelationSchema = z.preprocess(
    preprocessCorrelationParams,
    z.object({
        table: z.string().describe('Table name'),
        column1: z.string().describe('First numeric column'),
        column2: z.string().describe('Second numeric column'),
        schema: z.string().optional().describe('Schema name'),
        where: z.string().optional().describe('Filter condition'),
        groupBy: z.string().optional().describe('Column to group correlation by')
    })
);

export const StatsRegressionSchema = z.preprocess(
    preprocessRegressionParams,
    z.object({
        table: z.string().describe('Table name'),
        xColumn: z.string().describe('Independent variable (X)'),
        yColumn: z.string().describe('Dependent variable (Y)'),
        schema: z.string().optional().describe('Schema name'),
        where: z.string().optional().describe('Filter condition'),
        groupBy: z.string().optional().describe('Column to group regression by')
    })
);

// =============================================================================
// Tool Implementations
// =============================================================================

/**
 * Descriptive statistics: count, min, max, avg, stddev, variance
 */
export function createStatsDescriptiveTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_stats_descriptive',
        description: 'Calculate descriptive statistics (count, min, max, avg, stddev, variance, sum) for a numeric column. Use groupBy to get statistics per category.',
        group: 'stats',
        inputSchema: StatsDescriptiveSchema,
        annotations: readOnly('Descriptive Statistics'),
        icons: getToolIcons('stats', readOnly('Descriptive Statistics')),
        handler: async (params: unknown, _context: RequestContext) => {
            const { table, column, schema, where, groupBy } = StatsDescriptiveSchema.parse(params);

            const schemaPrefix = schema ? `"${schema}".` : '';
            const whereClause = where ? `WHERE ${where}` : '';

            // Validate column is numeric type
            const typeCheckQuery = `
                SELECT data_type 
                FROM information_schema.columns 
                WHERE table_schema = '${schema ?? 'public'}' 
                AND table_name = '${table}'
                AND column_name = '${column}'
            `;
            const typeResult = await adapter.executeQuery(typeCheckQuery);
            const typeRow = typeResult.rows?.[0] as { data_type: string } | undefined;

            if (!typeRow) {
                // Check if table exists
                const tableCheckQuery = `
                    SELECT 1 FROM information_schema.tables 
                    WHERE table_schema = '${schema ?? 'public'}' AND table_name = '${table}'
                `;
                const tableResult = await adapter.executeQuery(tableCheckQuery);
                if (tableResult.rows?.length === 0) {
                    return { error: `Table "${schema ?? 'public'}.${table}" not found` };
                }
                return { error: `Column "${column}" not found in table "${schema ?? 'public'}.${table}"` };
            }

            const numericTypes = ['integer', 'bigint', 'smallint', 'numeric', 'decimal', 'real', 'double precision', 'money'];
            if (!numericTypes.includes(typeRow.data_type)) {
                return { error: `Column "${column}" is type "${typeRow.data_type}" but must be a numeric type for statistical analysis` };
            }

            // Helper to map stats row to numeric object
            const mapStats = (row: Record<string, unknown>): {
                count: number;
                min: number | null;
                max: number | null;
                avg: number | null;
                stddev: number | null;
                variance: number | null;
                sum: number | null;
                mode: number | null;
            } => ({
                count: Number(row['count']),
                min: row['min'] !== null ? Number(row['min']) : null,
                max: row['max'] !== null ? Number(row['max']) : null,
                avg: row['avg'] !== null ? Number(row['avg']) : null,
                stddev: row['stddev'] !== null ? Number(row['stddev']) : null,
                variance: row['variance'] !== null ? Number(row['variance']) : null,
                sum: row['sum'] !== null ? Number(row['sum']) : null,
                mode: row['mode'] !== null && row['mode'] !== undefined ? Number(row['mode']) : null
            });

            if (groupBy !== undefined) {
                // Grouped statistics
                const sql = `
                    SELECT 
                        "${groupBy}" as group_key,
                        COUNT("${column}") as count,
                        MIN("${column}") as min,
                        MAX("${column}") as max,
                        AVG("${column}")::numeric(20,6) as avg,
                        STDDEV("${column}")::numeric(20,6) as stddev,
                        VARIANCE("${column}")::numeric(20,6) as variance,
                        SUM("${column}")::numeric(20,6) as sum,
                        MODE() WITHIN GROUP (ORDER BY "${column}") as mode
                    FROM ${schemaPrefix}"${table}"
                    ${whereClause}
                    GROUP BY "${groupBy}"
                    ORDER BY "${groupBy}"
                `;

                const result = await adapter.executeQuery(sql);
                const rows = result.rows ?? [];

                const groups = rows.map(row => ({
                    groupKey: row['group_key'],
                    statistics: mapStats(row)
                }));

                return {
                    table: `${schema ?? 'public'}.${table}`,
                    column,
                    groupBy,
                    groups,
                    count: groups.length
                };
            }

            // Ungrouped statistics (original behavior)
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
            const stats = result.rows?.[0];

            if (!stats) return { error: 'No stats found' };

            return {
                table: `${schema ?? 'public'}.${table}`,
                column,
                statistics: mapStats(stats)
            };
        }
    };
}


/**
 * Calculate percentiles
 */
export function createStatsPercentilesTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_stats_percentiles',
        description: 'Calculate percentiles (quartiles, custom percentiles) for a numeric column. Use groupBy to get percentiles per category.',
        group: 'stats',
        inputSchema: StatsPercentilesSchema,
        annotations: readOnly('Percentiles'),
        icons: getToolIcons('stats', readOnly('Percentiles')),
        handler: async (params: unknown, _context: RequestContext) => {
            const parsed = StatsPercentilesSchema.parse(params) as {
                table: string;
                column: string;
                percentiles?: number[];
                schema?: string;
                where?: string;
                groupBy?: string;
            };
            const { table, column, percentiles, schema, where, groupBy } = parsed;

            const pctiles = percentiles ?? [0.25, 0.5, 0.75];
            const schemaPrefix = schema ? `"${schema}".` : '';
            const whereClause = where ? `WHERE ${where}` : '';

            const percentileSelects = pctiles.map(p =>
                `PERCENTILE_CONT(${String(p)}) WITHIN GROUP (ORDER BY "${column}") as p${String(Math.round(p * 100))}`
            ).join(',\n                    ');

            // Helper to map row to percentile results (round to 6 decimal places to avoid floating-point artifacts)
            const mapPercentiles = (row: Record<string, unknown>): Record<string, number | null> => {
                const result: Record<string, number | null> = {};
                for (const p of pctiles) {
                    const key = `p${String(Math.round(p * 100))}`;
                    const val = row[key] !== null && row[key] !== undefined ? Number(row[key]) : null;
                    result[key] = val !== null ? Math.round(val * 1e6) / 1e6 : null;
                }
                return result;
            };

            if (groupBy !== undefined) {
                // Grouped percentiles
                const sql = `
                    SELECT 
                        "${groupBy}" as group_key,
                        ${percentileSelects}
                    FROM ${schemaPrefix}"${table}"
                    ${whereClause}
                    GROUP BY "${groupBy}"
                    ORDER BY "${groupBy}"
                `;

                const result = await adapter.executeQuery(sql);
                const rows = result.rows ?? [];

                const groups = rows.map(row => ({
                    groupKey: row['group_key'],
                    percentiles: mapPercentiles(row)
                }));

                return {
                    table: `${schema ?? 'public'}.${table}`,
                    column,
                    groupBy,
                    groups,
                    count: groups.length
                };
            }

            // Ungrouped percentiles
            const sql = `
                SELECT 
                    ${percentileSelects}
                FROM ${schemaPrefix}"${table}"
                ${whereClause}
            `;

            const result = await adapter.executeQuery(sql);
            const row = result.rows?.[0] ?? {};

            return {
                table: `${schema ?? 'public'}.${table}`,
                column,
                percentiles: mapPercentiles(row)
            };
        }
    };
}

/**
 * Correlation analysis
 */
export function createStatsCorrelationTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_stats_correlation',
        description: 'Calculate Pearson correlation coefficient between two numeric columns. Use groupBy to get correlation per category.',
        group: 'stats',
        inputSchema: StatsCorrelationSchema,
        annotations: readOnly('Correlation Analysis'),
        icons: getToolIcons('stats', readOnly('Correlation Analysis')),
        handler: async (params: unknown, _context: RequestContext) => {
            const parsed = StatsCorrelationSchema.parse(params) as {
                table: string;
                column1: string;
                column2: string;
                schema?: string;
                where?: string;
                groupBy?: string;
            };
            const { table, column1, column2, schema, where, groupBy } = parsed;

            const schemaPrefix = schema ? `"${schema}".` : '';
            const whereClause = where ? `WHERE ${where}` : '';

            // Validate both columns are numeric types
            const numericTypes = ['integer', 'bigint', 'smallint', 'numeric', 'decimal', 'real', 'double precision', 'money'];
            for (const col of [column1, column2]) {
                const typeCheckQuery = `
                    SELECT data_type 
                    FROM information_schema.columns 
                    WHERE table_schema = '${schema ?? 'public'}' 
                    AND table_name = '${table}'
                    AND column_name = '${col}'
                `;
                const typeResult = await adapter.executeQuery(typeCheckQuery);
                const typeRow = typeResult.rows?.[0] as { data_type: string } | undefined;

                if (!typeRow) {
                    return { error: `Column "${col}" not found in table "${schema ?? 'public'}.${table}"` };
                }

                if (!numericTypes.includes(typeRow.data_type)) {
                    return { error: `Column "${col}" is type "${typeRow.data_type}" but must be numeric for correlation analysis` };
                }
            }

            // Helper to interpret correlation
            const interpretCorr = (corr: number | null): string => {
                if (corr === null) return 'N/A';
                const absCorr = Math.abs(corr);
                let interpretation: string;
                if (absCorr >= 0.9) interpretation = 'Very strong';
                else if (absCorr >= 0.7) interpretation = 'Strong';
                else if (absCorr >= 0.5) interpretation = 'Moderate';
                else if (absCorr >= 0.3) interpretation = 'Weak';
                else interpretation = 'Very weak or no correlation';
                interpretation += corr < 0 ? ' (negative)' : ' (positive)';
                return interpretation;
            };

            // Helper to map row to correlation result
            const mapCorrelation = (row: Record<string, unknown>): {
                correlation: number | null;
                interpretation: string;
                covariancePopulation: number | null;
                covarianceSample: number | null;
                sampleSize: number;
            } => {
                const corr = row['correlation'] !== null ? Number(row['correlation']) : null;
                return {
                    correlation: corr,
                    interpretation: interpretCorr(corr),
                    covariancePopulation: row['covariance_pop'] !== null ? Number(row['covariance_pop']) : null,
                    covarianceSample: row['covariance_sample'] !== null ? Number(row['covariance_sample']) : null,
                    sampleSize: Number(row['sample_size'])
                };
            };

            if (groupBy !== undefined) {
                // Grouped correlation
                const sql = `
                    SELECT 
                        "${groupBy}" as group_key,
                        CORR("${column1}", "${column2}")::numeric(10,6) as correlation,
                        COVAR_POP("${column1}", "${column2}")::numeric(20,6) as covariance_pop,
                        COVAR_SAMP("${column1}", "${column2}")::numeric(20,6) as covariance_sample,
                        COUNT(*) as sample_size
                    FROM ${schemaPrefix}"${table}"
                    ${whereClause}
                    GROUP BY "${groupBy}"
                    ORDER BY "${groupBy}"
                `;

                const result = await adapter.executeQuery(sql);
                const rows = result.rows ?? [];

                const groups = rows.map(row => ({
                    groupKey: row['group_key'],
                    ...mapCorrelation(row)
                }));

                return {
                    table: `${schema ?? 'public'}.${table}`,
                    columns: [column1, column2],
                    groupBy,
                    groups,
                    count: groups.length
                };
            }

            // Ungrouped correlation
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
            const row = result.rows?.[0];

            if (!row) return { error: 'No correlation data found' };

            const response: Record<string, unknown> = {
                table: `${schema ?? 'public'}.${table}`,
                columns: [column1, column2],
                ...mapCorrelation(row)
            };

            // Add note for self-correlation
            if (column1 === column2) {
                response['note'] = 'Self-correlation always equals 1.0';
            }

            return response;
        }
    };
}

/**
 * Linear regression
 */
export function createStatsRegressionTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_stats_regression',
        description: 'Perform linear regression analysis (y = mx + b) between two columns. Use groupBy to get regression per category.',
        group: 'stats',
        inputSchema: StatsRegressionSchema,
        annotations: readOnly('Linear Regression'),
        icons: getToolIcons('stats', readOnly('Linear Regression')),
        handler: async (params: unknown, _context: RequestContext) => {
            const parsed = StatsRegressionSchema.parse(params) as {
                table: string;
                xColumn: string;
                yColumn: string;
                schema?: string;
                where?: string;
                groupBy?: string;
            };
            const { table, xColumn, yColumn, schema, where, groupBy } = parsed;

            const schemaPrefix = schema ? `"${schema}".` : '';
            const whereClause = where ? `WHERE ${where}` : '';

            // Helper to map row to regression result
            const mapRegression = (row: Record<string, unknown>): {
                slope: number | null;
                intercept: number | null;
                rSquared: number | null;
                equation: string;
                avgX: number | null;
                avgY: number | null;
                sampleSize: number;
            } => {
                const slope = row['slope'] !== null ? Number(row['slope']) : null;
                const intercept = row['intercept'] !== null ? Number(row['intercept']) : null;
                const rSquared = row['r_squared'] !== null ? Number(row['r_squared']) : null;

                let equation = 'N/A';
                if (slope !== null && intercept !== null) {
                    const sign = intercept >= 0 ? '+' : '-';
                    equation = `y = ${slope.toFixed(4)}x ${sign} ${Math.abs(intercept).toFixed(4)}`;
                }

                return {
                    slope,
                    intercept,
                    rSquared,
                    equation,
                    avgX: row['avg_x'] !== null ? Number(row['avg_x']) : null,
                    avgY: row['avg_y'] !== null ? Number(row['avg_y']) : null,
                    sampleSize: Number(row['sample_size'])
                };
            };

            if (groupBy !== undefined) {
                // Grouped regression
                const sql = `
                    SELECT 
                        "${groupBy}" as group_key,
                        REGR_SLOPE("${yColumn}", "${xColumn}")::numeric(20,6) as slope,
                        REGR_INTERCEPT("${yColumn}", "${xColumn}")::numeric(20,6) as intercept,
                        REGR_R2("${yColumn}", "${xColumn}")::numeric(10,6) as r_squared,
                        REGR_AVGX("${yColumn}", "${xColumn}")::numeric(20,6) as avg_x,
                        REGR_AVGY("${yColumn}", "${xColumn}")::numeric(20,6) as avg_y,
                        REGR_COUNT("${yColumn}", "${xColumn}") as sample_size
                    FROM ${schemaPrefix}"${table}"
                    ${whereClause}
                    GROUP BY "${groupBy}"
                    ORDER BY "${groupBy}"
                `;

                const result = await adapter.executeQuery(sql);
                const rows = result.rows ?? [];

                const groups = rows.map(row => ({
                    groupKey: row['group_key'],
                    regression: mapRegression(row)
                }));

                return {
                    table: `${schema ?? 'public'}.${table}`,
                    xColumn,
                    yColumn,
                    groupBy,
                    groups,
                    count: groups.length
                };
            }

            // Ungrouped regression
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
            const row = result.rows?.[0];

            if (!row) return { error: 'No regression data found' };

            const response: Record<string, unknown> = {
                table: `${schema ?? 'public'}.${table}`,
                xColumn,
                yColumn,
                regression: mapRegression(row)
            };

            // Add note for self-regression
            if (xColumn === yColumn) {
                response['note'] = 'Self-regression always returns slope=1, r²=1';
            }

            return response;
        }
    };
}
