/**
 * PostgreSQL Statistics Tools - Advanced Statistics
 *
 * Advanced statistical analysis tools: time series, distribution, hypothesis testing, sampling.
 */

import type { PostgresAdapter } from "../../PostgresAdapter.js";
import type {
  ToolDefinition,
  RequestContext,
} from "../../../../types/index.js";
import { z } from "zod";
import { readOnly } from "../../../../utils/annotations.js";
import { getToolIcons } from "../../../../utils/icons.js";

// =============================================================================
// P-Value Calculation Utilities
// =============================================================================

/**
 * Log gamma function using Lanczos approximation.
 * Used for computing the incomplete beta function.
 */
function logGamma(x: number): number {
  // Lanczos coefficients (truncated to 14 significant digits for JS precision)
  const c0 = 76.18009172947;
  const c1 = -86.50532032942;
  const c2 = 24.01409824083;
  const c3 = -1.2317395724502;
  const c4 = 0.0012086509738662;
  const c5 = -0.000005395239385;

  let y = x;
  let tmp = x + 5.5;
  tmp -= (x + 0.5) * Math.log(tmp);
  let ser = 1.000000000190015;

  y += 1;
  ser += c0 / y;
  y += 1;
  ser += c1 / y;
  y += 1;
  ser += c2 / y;
  y += 1;
  ser += c3 / y;
  y += 1;
  ser += c4 / y;
  y += 1;
  ser += c5 / y;

  return -tmp + Math.log((2.506628274631 * ser) / x);
}

/**
 * Regularized incomplete beta function using continued fraction expansion.
 * I_x(a,b) = B_x(a,b) / B(a,b)
 *
 * This is used to compute the CDF of the t-distribution.
 */
function incompleteBeta(a: number, b: number, x: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;

  // Use symmetry relation if x > (a+1)/(a+b+2)
  if (x > (a + 1) / (a + b + 2)) {
    return 1 - incompleteBeta(b, a, 1 - x);
  }

  // Compute the prefactor
  const lnBeta = logGamma(a) + logGamma(b) - logGamma(a + b);
  const front = Math.exp(
    Math.log(x) * a + Math.log(1 - x) * b - lnBeta - Math.log(a),
  );

  // Lentz's algorithm for continued fraction
  const maxIterations = 200;
  const epsilon = 1e-14;
  const tiny = 1e-30;

  let c = 1;
  let d = 1 - ((a + b) * x) / (a + 1);
  if (Math.abs(d) < tiny) d = tiny;
  d = 1 / d;
  let h = d;

  for (let m = 1; m <= maxIterations; m++) {
    const m2 = 2 * m;

    // Even step
    let aa = (m * (b - m) * x) / ((a + m2 - 1) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < tiny) d = tiny;
    c = 1 + aa / c;
    if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d;
    h *= d * c;

    // Odd step
    aa = -((a + m) * (a + b + m) * x) / ((a + m2) * (a + m2 + 1));
    d = 1 + aa * d;
    if (Math.abs(d) < tiny) d = tiny;
    c = 1 + aa / c;
    if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d;
    const delta = d * c;
    h *= delta;

    if (Math.abs(delta - 1) < epsilon) break;
  }

  return front * h;
}

/**
 * Cumulative distribution function for the t-distribution.
 * Uses the relationship between t-distribution and incomplete beta function.
 *
 * @param t - The t-statistic
 * @param df - Degrees of freedom
 * @returns Probability P(T <= t) for a t-distributed random variable
 */
function tDistributionCDF(t: number, df: number): number {
  const x = df / (df + t * t);
  const beta = incompleteBeta(df / 2, 0.5, x);

  if (t >= 0) {
    return 1 - 0.5 * beta;
  } else {
    return 0.5 * beta;
  }
}

/**
 * Calculate two-tailed p-value for a t-test.
 *
 * @param t - The t-statistic
 * @param df - Degrees of freedom
 * @returns Two-tailed p-value
 */
function calculateTTestPValue(t: number, df: number): number {
  // Two-tailed: P(|T| > |t|) = 2 * P(T > |t|) = 2 * (1 - CDF(|t|))
  const absT = Math.abs(t);
  return 2 * (1 - tDistributionCDF(absT, df));
}

/**
 * Cumulative distribution function for the standard normal distribution.
 * Uses the error function approximation.
 *
 * @param z - The z-statistic
 * @returns Probability P(Z <= z) for a standard normal random variable
 */
function normalCDF(z: number): number {
  // Approximation using the error function
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = z < 0 ? -1 : 1;
  const x = Math.abs(z) / Math.sqrt(2);

  const t = 1 / (1 + p * x);
  const y =
    1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

  return 0.5 * (1 + sign * y);
}

/**
 * Calculate two-tailed p-value for a z-test.
 *
 * @param z - The z-statistic
 * @returns Two-tailed p-value
 */
function calculateZTestPValue(z: number): number {
  // Two-tailed: P(|Z| > |z|) = 2 * P(Z > |z|) = 2 * (1 - CDF(|z|))
  const absZ = Math.abs(z);
  return 2 * (1 - normalCDF(absZ));
}

// =============================================================================
// Schema.Table Parsing
// =============================================================================

/**
 * Parse schema.table format from table name.
 * Returns { table, schema } with schema extracted from prefix if present.
 * Embedded schema takes priority over explicit schema parameter.
 */
function parseSchemaTable(
  table: string,
  explicitSchema?: string,
): { table: string; schema: string } {
  if (table.includes(".")) {
    const parts = table.split(".");
    if (parts.length === 2 && parts[0] && parts[1]) {
      return {
        schema: parts[0],
        table: parts[1],
      };
    }
  }
  return { table, schema: explicitSchema ?? "public" };
}

/**
 * Validate that a table exists and a column is numeric.
 * Throws user-friendly error messages for missing table/column.
 */
async function validateNumericColumn(
  adapter: PostgresAdapter,
  table: string,
  column: string,
  schema: string,
): Promise<void> {
  const numericTypes = [
    "integer",
    "bigint",
    "smallint",
    "numeric",
    "decimal",
    "real",
    "double precision",
    "money",
  ];

  const typeCheckQuery = `
    SELECT data_type 
    FROM information_schema.columns 
    WHERE table_schema = '${schema}' 
    AND table_name = '${table}'
    AND column_name = '${column}'
  `;
  const typeResult = await adapter.executeQuery(typeCheckQuery);
  const typeRow = typeResult.rows?.[0] as { data_type: string } | undefined;

  if (!typeRow) {
    // Check if table exists
    const tableCheckQuery = `
      SELECT 1 FROM information_schema.tables 
      WHERE table_schema = '${schema}' AND table_name = '${table}'
    `;
    const tableResult = await adapter.executeQuery(tableCheckQuery);
    if (tableResult.rows?.length === 0) {
      throw new Error(`Table "${schema}.${table}" not found`);
    }
    throw new Error(
      `Column "${column}" not found in table "${schema}.${table}"`,
    );
  }

  if (!numericTypes.includes(typeRow.data_type)) {
    throw new Error(
      `Column "${column}" is type "${typeRow.data_type}" but must be a numeric type for statistical analysis`,
    );
  }
}

/**
 * Validate that a table exists (for tools that don't require a specific column).
 * Throws user-friendly error message for missing table.
 */
async function validateTableExists(
  adapter: PostgresAdapter,
  table: string,
  schema: string,
): Promise<void> {
  const tableCheckQuery = `
    SELECT 1 FROM information_schema.tables 
    WHERE table_schema = '${schema}' AND table_name = '${table}'
  `;
  const tableResult = await adapter.executeQuery(tableCheckQuery);
  if (tableResult.rows?.length === 0) {
    throw new Error(`Table "${schema}.${table}" not found`);
  }
}

// =============================================================================
// Parameter Preprocessing
// =============================================================================

/**
 * Valid interval units for time series analysis
 */
const VALID_INTERVALS = [
  "second",
  "minute",
  "hour",
  "day",
  "week",
  "month",
  "year",
] as const;

/**
 * Interval shorthand mappings
 */
const INTERVAL_SHORTHANDS: Record<string, string> = {
  daily: "day",
  hourly: "hour",
  weekly: "week",
  monthly: "month",
  yearly: "year",
  minutely: "minute",
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
  if (typeof input !== "object" || input === null) {
    return input;
  }

  const result = { ...(input as Record<string, unknown>) };

  // Alias: tableName → table
  if (result["tableName"] !== undefined && result["table"] === undefined) {
    result["table"] = result["tableName"];
  }

  // Alias: column → valueColumn
  if (result["column"] !== undefined && result["valueColumn"] === undefined) {
    result["valueColumn"] = result["column"];
  }

  // Alias: value → valueColumn
  if (result["value"] !== undefined && result["valueColumn"] === undefined) {
    result["valueColumn"] = result["value"];
  }

  // Alias: time → timeColumn
  if (result["time"] !== undefined && result["timeColumn"] === undefined) {
    result["timeColumn"] = result["time"];
  }

  // Alias: bucket → interval
  if (result["bucket"] !== undefined && result["interval"] === undefined) {
    result["interval"] = result["bucket"];
  }

  if (typeof result["interval"] === "string") {
    let interval = result["interval"].toLowerCase().trim();

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
    if (
      interval.endsWith("s") &&
      VALID_INTERVALS.includes(
        interval.slice(0, -1) as (typeof VALID_INTERVALS)[number],
      )
    ) {
      interval = interval.slice(0, -1);
    }

    result["interval"] = interval;
  } else if (result["interval"] === undefined) {
    // Default interval to 'day' if not provided
    result["interval"] = "day";
  }

  // Alias: filter → where
  if (result["filter"] !== undefined && result["where"] === undefined) {
    result["where"] = result["filter"];
  }

  // Parse schema.table format (embedded schema takes priority)
  if (typeof result["table"] === "string" && result["table"].includes(".")) {
    const parsed = parseSchemaTable(
      result["table"],
      result["schema"] as string | undefined,
    );
    result["table"] = parsed.table;
    result["schema"] = parsed.schema;
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
  if (typeof input !== "object" || input === null) {
    return input;
  }

  const result = { ...(input as Record<string, unknown>) };

  // Alias: tableName → table
  if (result["tableName"] !== undefined && result["table"] === undefined) {
    result["table"] = result["tableName"];
  }

  // Alias: col → column
  if (result["col"] !== undefined && result["column"] === undefined) {
    result["column"] = result["col"];
  }

  if (typeof result["testType"] === "string") {
    const normalized = result["testType"].toLowerCase().trim();

    // t_test variants: t, ttest, t-test, t_test, T_TEST
    if (normalized === "t" || /^t[-_]?test$/.test(normalized)) {
      result["testType"] = "t_test";
    }
    // z_test variants: z, ztest, z-test, z_test, Z_TEST
    else if (normalized === "z" || /^z[-_]?test$/.test(normalized)) {
      result["testType"] = "z_test";
    }
  } else if (result["testType"] === undefined) {
    // Auto-detect: if populationStdDev or sigma provided, default to z_test
    if (
      result["populationStdDev"] !== undefined ||
      result["sigma"] !== undefined
    ) {
      result["testType"] = "z_test";
    } else {
      // Default testType to 't_test' if not provided
      result["testType"] = "t_test";
    }
  }

  // Alias: filter → where
  if (result["filter"] !== undefined && result["where"] === undefined) {
    result["where"] = result["filter"];
  }

  // Parse schema.table format (embedded schema takes priority)
  if (typeof result["table"] === "string" && result["table"].includes(".")) {
    const parsed = parseSchemaTable(
      result["table"],
      result["schema"] as string | undefined,
    );
    result["table"] = parsed.table;
    result["schema"] = parsed.schema;
  }

  return result;
}

/**
 * Preprocess distribution parameters:
 * - Alias: tableName → table, col → column
 */
function preprocessDistributionParams(input: unknown): unknown {
  if (typeof input !== "object" || input === null) {
    return input;
  }
  const result = { ...(input as Record<string, unknown>) };
  // Alias: tableName → table
  if (result["tableName"] !== undefined && result["table"] === undefined) {
    result["table"] = result["tableName"];
  }
  // Alias: col → column
  if (result["col"] !== undefined && result["column"] === undefined) {
    result["column"] = result["col"];
  }
  // Alias: filter → where
  if (result["filter"] !== undefined && result["where"] === undefined) {
    result["where"] = result["filter"];
  }
  // Parse schema.table format (embedded schema takes priority)
  if (typeof result["table"] === "string" && result["table"].includes(".")) {
    const parsed = parseSchemaTable(
      result["table"],
      result["schema"] as string | undefined,
    );
    result["table"] = parsed.table;
    result["schema"] = parsed.schema;
  }
  return result;
}

/**
 * Preprocess sampling parameters:
 * - Alias: tableName → table, columns → select
 */
function preprocessSamplingParams(input: unknown): unknown {
  if (typeof input !== "object" || input === null) {
    return input;
  }
  const result = { ...(input as Record<string, unknown>) };
  // Alias: tableName → table
  if (result["tableName"] !== undefined && result["table"] === undefined) {
    result["table"] = result["tableName"];
  }
  // Alias: columns → select
  if (result["columns"] !== undefined && result["select"] === undefined) {
    result["select"] = result["columns"];
  }
  // Alias: filter → where
  if (result["filter"] !== undefined && result["where"] === undefined) {
    result["where"] = result["filter"];
  }
  // Parse schema.table format (embedded schema takes priority)
  if (typeof result["table"] === "string" && result["table"].includes(".")) {
    const parsed = parseSchemaTable(
      result["table"],
      result["schema"] as string | undefined,
    );
    result["table"] = parsed.table;
    result["schema"] = parsed.schema;
  }
  return result;
}

// =============================================================================
// Advanced Statistics Schemas
// =============================================================================

export const StatsTimeSeriesSchema = z.preprocess(
  preprocessTimeSeriesParams,
  z.object({
    table: z.string().describe("Table name"),
    valueColumn: z.string().describe("Numeric column to aggregate"),
    timeColumn: z.string().describe("Timestamp column"),
    interval: z
      .enum(["second", "minute", "hour", "day", "week", "month", "year"])
      .describe("Time bucket size (default: day)"),
    aggregation: z
      .enum(["sum", "avg", "min", "max", "count"])
      .optional()
      .describe("Aggregation function (default: avg)"),
    schema: z.string().optional().describe("Schema name"),
    where: z.string().optional().describe("Filter condition"),
    limit: z.number().optional().describe("Max time buckets to return"),
    groupBy: z.string().optional().describe("Column to group time series by"),
  }),
);

export const StatsDistributionSchema = z.preprocess(
  preprocessDistributionParams,
  z
    .object({
      table: z.string().describe("Table name"),
      column: z.string().describe("Numeric column"),
      buckets: z
        .number()
        .optional()
        .describe("Number of histogram buckets (default: 10)"),
      schema: z.string().optional().describe("Schema name"),
      where: z.string().optional().describe("Filter condition"),
      groupBy: z
        .string()
        .optional()
        .describe("Column to group distribution by"),
    })
    .refine((data) => data.buckets === undefined || data.buckets > 0, {
      message: "buckets must be greater than 0",
      path: ["buckets"],
    }),
);

export const StatsHypothesisSchema = z.preprocess(
  preprocessHypothesisParams,
  z
    .object({
      table: z.string().describe("Table name"),
      column: z.string().describe("Numeric column"),
      testType: z
        .enum(["t_test", "z_test"])
        .describe(
          "Type of hypothesis test: t_test or z_test (accepts shorthand: t, z, ttest, ztest)",
        ),
      hypothesizedMean: z
        .number()
        .optional()
        .describe("Hypothesized population mean"),
      mean: z.number().optional().describe("Alias for hypothesizedMean"),
      expected: z.number().optional().describe("Alias for hypothesizedMean"),
      populationStdDev: z
        .number()
        .optional()
        .describe("Known population standard deviation (required for z-test)"),
      sigma: z.number().optional().describe("Alias for populationStdDev"),
      schema: z.string().optional().describe("Schema name"),
      where: z.string().optional().describe("Filter condition"),
      groupBy: z
        .string()
        .optional()
        .describe("Column to group hypothesis test by"),
    })
    .transform((data) => ({
      table: data.table,
      column: data.column,
      testType: data.testType,
      hypothesizedMean:
        data.hypothesizedMean ?? data.mean ?? data.expected ?? 0,
      populationStdDev: data.populationStdDev ?? data.sigma,
      schema: data.schema,
      where: data.where,
      groupBy: data.groupBy,
    }))
    .refine(
      (data) => data.hypothesizedMean !== 0 || data.hypothesizedMean === 0,
      {
        // This allows 0 as a valid hypothesized mean - refinement always passes
        message: "hypothesizedMean (or mean/expected alias) is required",
      },
    ),
);

export const StatsSamplingSchema = z.preprocess(
  preprocessSamplingParams,
  z
    .object({
      table: z.string().describe("Table name"),
      method: z
        .enum(["random", "bernoulli", "system"])
        .optional()
        .describe(
          "Sampling method (default: random). Note: system uses page-level sampling and may return 0 rows on small tables",
        ),
      sampleSize: z
        .number()
        .optional()
        .describe("Number of rows for random sampling (must be > 0)"),
      percentage: z
        .number()
        .optional()
        .describe("Percentage for bernoulli/system sampling (0-100)"),
      schema: z.string().optional().describe("Schema name"),
      select: z.array(z.string()).optional().describe("Columns to select"),
      where: z.string().optional().describe("Filter condition"),
    })
    .refine((data) => data.sampleSize === undefined || data.sampleSize > 0, {
      message: "sampleSize must be greater than 0",
      path: ["sampleSize"],
    })
    .refine(
      (data) =>
        data.percentage === undefined ||
        (data.percentage >= 0 && data.percentage <= 100),
      {
        message: "percentage must be between 0 and 100",
        path: ["percentage"],
      },
    ),
);

// =============================================================================
// Tool Implementations
// =============================================================================

/**
 * Time series analysis
 */
export function createStatsTimeSeriesTool(
  adapter: PostgresAdapter,
): ToolDefinition {
  return {
    name: "pg_stats_time_series",
    description:
      "Aggregate data into time buckets for time series analysis. Use groupBy to get separate time series per category.",
    group: "stats",
    inputSchema: StatsTimeSeriesSchema,
    annotations: readOnly("Time Series Analysis"),
    icons: getToolIcons("stats", readOnly("Time Series Analysis")),
    handler: async (params: unknown, _context: RequestContext) => {
      const {
        table,
        valueColumn,
        timeColumn,
        interval,
        aggregation,
        schema,
        where,
        limit,
        groupBy,
      } = StatsTimeSeriesSchema.parse(params) as {
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

      const schemaPrefix = schema ? `"${schema}".` : "";
      const whereClause = where ? `WHERE ${where}` : "";
      const agg = aggregation ?? "avg";
      const lim = limit ?? 100;

      // Validate timeColumn is a timestamp/date type
      const typeCheckQuery = `
                SELECT data_type 
                FROM information_schema.columns 
                WHERE table_schema = '${schema ?? "public"}' 
                AND table_name = '${table}'
                AND column_name = '${timeColumn}'
            `;
      const typeResult = await adapter.executeQuery(typeCheckQuery);
      const typeRow = typeResult.rows?.[0] as { data_type: string } | undefined;

      if (!typeRow) {
        throw new Error(
          `Column "${timeColumn}" not found in table "${schema ?? "public"}.${table}"`,
        );
      }

      const validTypes = [
        "timestamp without time zone",
        "timestamp with time zone",
        "date",
        "time",
        "time without time zone",
        "time with time zone",
      ];
      if (!validTypes.includes(typeRow.data_type)) {
        throw new Error(
          `Column "${timeColumn}" is type "${typeRow.data_type}" but must be a timestamp or date type for time series analysis`,
        );
      }

      // Validate valueColumn exists and is numeric
      const numericTypes = [
        "integer",
        "bigint",
        "smallint",
        "numeric",
        "decimal",
        "real",
        "double precision",
        "money",
      ];
      const valueTypeQuery = `
        SELECT data_type 
        FROM information_schema.columns 
        WHERE table_schema = '${schema ?? "public"}' 
        AND table_name = '${table}'
        AND column_name = '${valueColumn}'
      `;
      const valueTypeResult = await adapter.executeQuery(valueTypeQuery);
      const valueTypeRow = valueTypeResult.rows?.[0] as
        | { data_type: string }
        | undefined;

      if (!valueTypeRow) {
        throw new Error(
          `Column "${valueColumn}" not found in table "${schema ?? "public"}.${table}"`,
        );
      }

      if (!numericTypes.includes(valueTypeRow.data_type)) {
        throw new Error(
          `Column "${valueColumn}" is type "${valueTypeRow.data_type}" but must be a numeric type for time series aggregation`,
        );
      }

      // Helper to map bucket row
      const mapBucket = (
        row: Record<string, unknown>,
      ): { timeBucket: Date; value: number; count: number } => ({
        timeBucket: row["time_bucket"] as Date,
        value: Number(row["value"]),
        count: Number(row["count"]),
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
        const groupsMap = new Map<
          unknown,
          { timeBucket: Date; value: number; count: number }[]
        >();
        for (const row of rows) {
          const key = row["group_key"];
          if (!groupsMap.has(key)) {
            groupsMap.set(key, []);
          }
          const bucketList = groupsMap.get(key);
          if (bucketList !== undefined && bucketList.length < lim) {
            bucketList.push(mapBucket(row));
          }
        }

        const groups = Array.from(groupsMap.entries()).map(
          ([key, buckets]) => ({
            groupKey: key,
            buckets,
          }),
        );

        return {
          table: `${schema ?? "public"}.${table}`,
          valueColumn,
          timeColumn,
          interval,
          aggregation: agg,
          groupBy,
          groups,
          count: groups.length,
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

      const buckets = (result.rows ?? []).map((row) => mapBucket(row));

      return {
        table: `${schema ?? "public"}.${table}`,
        valueColumn,
        timeColumn,
        interval,
        aggregation: agg,
        buckets,
      };
    },
  };
}

/**
 * Distribution analysis with histogram
 */
export function createStatsDistributionTool(
  adapter: PostgresAdapter,
): ToolDefinition {
  return {
    name: "pg_stats_distribution",
    description:
      "Analyze data distribution with histogram buckets, skewness, and kurtosis. Use groupBy to get distribution per category.",
    group: "stats",
    inputSchema: StatsDistributionSchema,
    annotations: readOnly("Distribution Analysis"),
    icons: getToolIcons("stats", readOnly("Distribution Analysis")),
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

      const schemaName = schema ?? "public";
      const schemaPrefix = schema ? `"${schema}".` : "";
      const whereClause = where ? `WHERE ${where}` : "";
      const numBuckets = buckets ?? 10;

      // Validate column exists and is numeric
      await validateNumericColumn(adapter, table, column, schemaName);

      // Helper to compute skewness and kurtosis for a given group
      const computeMoments = async (
        groupFilter?: string,
      ): Promise<{
        minVal: number;
        maxVal: number;
        skewness: number | null;
        kurtosis: number | null;
      } | null> => {
        const filterClause = groupFilter
          ? whereClause
            ? `${whereClause} AND ${groupFilter}`
            : `WHERE ${groupFilter}`
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

        if (row?.["min_val"] == null || row["max_val"] == null) {
          return null;
        }

        return {
          minVal: Number(row["min_val"]),
          maxVal: Number(row["max_val"]),
          skewness: row["skewness"] !== null ? Number(row["skewness"]) : null,
          kurtosis: row["kurtosis"] !== null ? Number(row["kurtosis"]) : null,
        };
      };

      // Helper to generate histogram for given min/max
      const generateHistogram = async (
        minVal: number,
        maxVal: number,
        groupFilter?: string,
      ): Promise<
        {
          bucket: number;
          frequency: number;
          rangeMin: number;
          rangeMax: number;
        }[]
      > => {
        const filterClause = groupFilter
          ? whereClause
            ? `${whereClause} AND ${groupFilter}`
            : `WHERE ${groupFilter}`
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
        return (result.rows ?? []).map((row) => ({
          bucket: Number(row["bucket"]),
          frequency: Number(row["frequency"]),
          rangeMin: Number(row["bucket_min"]),
          rangeMax: Number(row["bucket_max"]),
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
        const groupKeys = (groupsResult.rows ?? []).map((r) => r["group_key"]);

        // Process each group
        const groups: {
          groupKey: unknown;
          range: { min: number; max: number };
          bucketWidth: number;
          skewness: number | null;
          kurtosis: number | null;
          histogram: {
            bucket: number;
            frequency: number;
            rangeMin: number;
            rangeMax: number;
          }[];
        }[] = [];

        for (const groupKey of groupKeys) {
          const groupFilter =
            typeof groupKey === "string"
              ? `"${groupBy}" = '${groupKey.replace(/'/g, "''")}'`
              : `"${groupBy}" = ${String(groupKey)}`;

          const moments = await computeMoments(groupFilter);
          if (moments === null) continue;

          const { minVal, maxVal, skewness, kurtosis } = moments;
          const bucketWidth =
            Math.round(((maxVal - minVal) / numBuckets) * 1e6) / 1e6;
          const histogram = await generateHistogram(
            minVal,
            maxVal,
            groupFilter,
          );

          groups.push({
            groupKey,
            range: { min: minVal, max: maxVal },
            bucketWidth,
            skewness,
            kurtosis,
            histogram,
          });
        }

        return {
          table: `${schema ?? "public"}.${table}`,
          column,
          groupBy,
          groups,
          count: groups.length,
        };
      }

      // Ungrouped distribution (existing logic)
      const moments = await computeMoments();
      if (moments === null) {
        return { error: "No data or all nulls in column" };
      }

      const { minVal, maxVal, skewness, kurtosis } = moments;
      const bucketWidth =
        Math.round(((maxVal - minVal) / numBuckets) * 1e6) / 1e6;
      const histogram = await generateHistogram(minVal, maxVal);

      return {
        table: `${schema ?? "public"}.${table}`,
        column,
        range: { min: minVal, max: maxVal },
        bucketWidth,
        skewness,
        kurtosis,
        histogram,
      };
    },
  };
}

/**
 * Hypothesis testing (t-test or z-test)
 */
export function createStatsHypothesisTool(
  adapter: PostgresAdapter,
): ToolDefinition {
  return {
    name: "pg_stats_hypothesis",
    description:
      "Perform one-sample t-test or z-test against a hypothesized mean. For z-test, provide populationStdDev (sigma) for accurate results. Use groupBy to test each group separately.",
    group: "stats",
    inputSchema: StatsHypothesisSchema,
    annotations: readOnly("Hypothesis Testing"),
    icons: getToolIcons("stats", readOnly("Hypothesis Testing")),
    handler: async (params: unknown, _context: RequestContext) => {
      const {
        table,
        column,
        testType,
        hypothesizedMean,
        populationStdDev,
        schema,
        where,
        groupBy,
      } = StatsHypothesisSchema.parse(params) as {
        table: string;
        column: string;
        testType: string;
        hypothesizedMean: number;
        populationStdDev?: number;
        groupBy?: string;
        schema?: string;
        where?: string;
      };

      const schemaName = schema ?? "public";
      const schemaPrefix = schema ? `"${schema}".` : "";
      const whereClause = where ? `WHERE ${where}` : "";

      // Validate column exists and is numeric
      await validateNumericColumn(adapter, table, column, schemaName);

      // Helper to calculate test results from row stats
      const calculateTestResults = (
        n: number,
        sampleMean: number,
        sampleStdDev: number,
      ):
        | {
            sampleSize: number;
            sampleMean: number;
            sampleStdDev: number;
            populationStdDev: number | null;
            standardError: number;
            testStatistic: number;
            pValue: number;
            degreesOfFreedom: number | null;
            interpretation: string;
            note: string;
          }
        | { error: string; sampleSize: number } => {
        if (n < 2 || isNaN(sampleStdDev) || sampleStdDev === 0) {
          return { error: "Insufficient data or zero variance", sampleSize: n };
        }

        let stddevUsed: number;
        let stddevNote: string | undefined;

        if (testType === "z_test") {
          if (populationStdDev !== undefined) {
            stddevUsed = populationStdDev;
          } else {
            stddevUsed = sampleStdDev;
            stddevNote =
              "No populationStdDev provided; using sample stddev (less accurate for z-test)";
          }
        } else {
          stddevUsed = sampleStdDev;
        }

        const standardError = stddevUsed / Math.sqrt(n);
        const testStatistic = (sampleMean - hypothesizedMean) / standardError;
        const degreesOfFreedom = n - 1;

        // Calculate p-value based on test type
        const pValue =
          testType === "z_test"
            ? calculateZTestPValue(testStatistic)
            : calculateTTestPValue(testStatistic, degreesOfFreedom);

        // Round p-value to 6 decimal places for cleaner output
        const pValueRounded = Math.round(pValue * 1e6) / 1e6;

        // Determine significance based on p-value
        let interpretation: string;
        if (pValueRounded < 0.001) {
          interpretation =
            "Highly significant (p < 0.001): Strong evidence against the null hypothesis";
        } else if (pValueRounded < 0.01) {
          interpretation =
            "Very significant (p < 0.01): Strong evidence against the null hypothesis";
        } else if (pValueRounded < 0.05) {
          interpretation =
            "Significant (p < 0.05): Evidence against the null hypothesis at α=0.05 level";
        } else if (pValueRounded < 0.1) {
          interpretation =
            "Marginally significant (p < 0.1): Weak evidence against the null hypothesis";
        } else {
          interpretation =
            "Not significant (p ≥ 0.1): Insufficient evidence to reject the null hypothesis";
        }

        // Build note with warnings
        let noteText =
          stddevNote ??
          "Two-tailed p-value calculated using numerical approximation";
        if (n < 30) {
          noteText =
            `Small sample size (n=${String(n)}): results may be less reliable. ` +
            noteText;
        }

        return {
          sampleSize: n,
          sampleMean,
          sampleStdDev,
          populationStdDev:
            testType === "z_test" ? (populationStdDev ?? null) : null,
          standardError,
          testStatistic,
          pValue: pValueRounded,
          degreesOfFreedom: testType === "t_test" ? degreesOfFreedom : null,
          interpretation,
          note: noteText,
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

        const groups = rows.map((row) => {
          const n = Number(row["n"]);
          const sampleMean = Number(row["mean"]);
          const sampleStdDev = Number(row["stddev"]);
          return {
            groupKey: row["group_key"],
            results: calculateTestResults(n, sampleMean, sampleStdDev),
          };
        });

        return {
          table: `${schema ?? "public"}.${table}`,
          column,
          testType,
          hypothesizedMean,
          groupBy,
          groups,
          count: groups.length,
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
      const row = result.rows?.[0] as
        | { n: string | number; mean: string | number; stddev: string | number }
        | undefined;
      if (!row) return { error: "No data found" };

      const n = Number(row.n);
      const sampleMean = Number(row.mean);
      const sampleStdDev = Number(row.stddev);

      const testResults = calculateTestResults(n, sampleMean, sampleStdDev);

      // If error, return at top level (not nested in results)
      if ("error" in testResults) {
        return testResults;
      }

      return {
        table: `${schema ?? "public"}.${table}`,
        column,
        testType,
        hypothesizedMean,
        results: testResults,
      };
    },
  };
}

/**
 * Random sampling
 */
export function createStatsSamplingTool(
  adapter: PostgresAdapter,
): ToolDefinition {
  return {
    name: "pg_stats_sampling",
    description:
      "Get a random sample of rows. Use sampleSize for exact row count (any method), or percentage for approximate sampling with bernoulli/system methods.",
    group: "stats",
    inputSchema: StatsSamplingSchema,
    annotations: readOnly("Random Sampling"),
    icons: getToolIcons("stats", readOnly("Random Sampling")),
    handler: async (params: unknown, _context: RequestContext) => {
      const { table, method, sampleSize, percentage, schema, select, where } =
        StatsSamplingSchema.parse(params);

      const schemaName = schema ?? "public";

      // Validate table exists
      await validateTableExists(adapter, table, schemaName);

      const schemaPrefix = schema ? `"${schema}".` : "";
      const columns =
        select && select.length > 0
          ? select.map((c) => `"${c}"`).join(", ")
          : "*";
      const whereClause = where ? `WHERE ${where}` : "";
      const samplingMethod = method ?? "random";

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
        } else if (samplingMethod !== "random") {
          note = `Using ORDER BY RANDOM() LIMIT for exact ${String(sampleSize)} row count. TABLESAMPLE ${samplingMethod.toUpperCase()} is percentage-based and cannot guarantee exact counts.`;
        }
      } else if (samplingMethod === "random") {
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
        table: `${schema ?? "public"}.${table}`,
        method: samplingMethod,
        sampleSize: rows.length,
        rows,
      };

      if (note !== undefined) {
        response.note = note;
      }

      // Add note if requested sampleSize exceeded available rows
      if (sampleSize !== undefined && rows.length < sampleSize) {
        const existingNote =
          response.note !== undefined ? response.note + " " : "";
        response.note =
          existingNote +
          `Requested ${String(sampleSize)} rows but only ${String(rows.length)} available.`;
      }

      return response;
    },
  };
}
