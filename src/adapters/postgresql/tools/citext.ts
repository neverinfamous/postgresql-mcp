/**
 * PostgreSQL citext Extension Tools
 * 
 * Case-insensitive text type for preventing subtle bugs in auth systems,
 * emails, and usernames. 6 tools total.
 * 
 * citext provides a case-insensitive character string type at the type level:
 * - Comparisons are case-insensitive (e.g., 'HELLO' = 'hello')
 * - Sorting is case-insensitive
 * - Ideal for email, username, and other identifier columns
 */

import type { PostgresAdapter } from '../PostgresAdapter.js';
import type { ToolDefinition, RequestContext } from '../../../types/index.js';
import { z } from 'zod';
import {
    CitextConvertColumnSchema,
    CitextListColumnsSchema,
    CitextAnalyzeCandidatesSchema,
    CitextSchemaAdvisorSchema
} from '../types.js';

/**
 * Get all citext tools
 */
export function getCitextTools(adapter: PostgresAdapter): ToolDefinition[] {
    return [
        createCitextExtensionTool(adapter),
        createCitextConvertColumnTool(adapter),
        createCitextListColumnsTool(adapter),
        createCitextAnalyzeCandidatesTool(adapter),
        createCitextCompareTool(adapter),
        createCitextSchemaAdvisorTool(adapter)
    ];
}

/**
 * Enable the citext extension
 */
function createCitextExtensionTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_citext_create_extension',
        description: `Enable the citext extension for case-insensitive text columns.
citext is ideal for emails, usernames, and other identifiers where case shouldn't matter.`,
        group: 'citext',
        inputSchema: z.object({}),
        handler: async (_params: unknown, _context: RequestContext) => {
            await adapter.executeQuery('CREATE EXTENSION IF NOT EXISTS citext');
            return {
                success: true,
                message: 'citext extension enabled',
                usage: 'Create columns with type CITEXT instead of TEXT for case-insensitive comparisons'
            };
        }
    };
}

/**
 * Convert an existing text column to citext
 */
function createCitextConvertColumnTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_citext_convert_column',
        description: `Convert an existing TEXT column to CITEXT for case-insensitive comparisons.
This is useful for retrofitting case-insensitivity to existing columns like email or username.`,
        group: 'citext',
        inputSchema: CitextConvertColumnSchema,
        handler: async (params: unknown, _context: RequestContext) => {
            const { table, column, schema } = CitextConvertColumnSchema.parse(params);
            const schemaName = schema ?? 'public';
            const qualifiedTable = `"${schemaName}"."${table}"`;

            // Check if citext extension is installed
            const extCheck = await adapter.executeQuery(`
                SELECT EXISTS(
                    SELECT 1 FROM pg_extension WHERE extname = 'citext'
                ) as installed
            `);

            const hasExt = extCheck.rows?.[0]?.['installed'] as boolean ?? false;
            if (!hasExt) {
                return {
                    success: false,
                    error: 'citext extension is not installed',
                    hint: 'Run pg_citext_create_extension first'
                };
            }

            // Get current column type
            const colCheck = await adapter.executeQuery(`
                SELECT data_type 
                FROM information_schema.columns 
                WHERE table_schema = $1 
                  AND table_name = $2 
                  AND column_name = $3
            `, [schemaName, table, column]);

            if (!colCheck.rows || colCheck.rows.length === 0) {
                return {
                    success: false,
                    error: `Column ${column} not found in ${qualifiedTable}`
                };
            }

            const currentType = colCheck.rows[0]?.['data_type'] as string;
            if (currentType === 'citext') {
                return {
                    success: true,
                    message: `Column ${column} is already citext`,
                    wasAlreadyCitext: true
                };
            }

            // Convert the column
            await adapter.executeQuery(`
                ALTER TABLE ${qualifiedTable}
                ALTER COLUMN "${column}" TYPE citext
            `);

            return {
                success: true,
                message: `Column ${column} converted from ${currentType} to citext`,
                table: qualifiedTable,
                previousType: currentType
            };
        }
    };
}

/**
 * List all citext columns in the database
 */
function createCitextListColumnsTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_citext_list_columns',
        description: `List all columns using the citext type in the database.
Useful for auditing case-insensitive columns.`,
        group: 'citext',
        inputSchema: CitextListColumnsSchema,
        handler: async (params: unknown, _context: RequestContext) => {
            const { schema } = CitextListColumnsSchema.parse(params);

            const conditions: string[] = [
                "udt_name = 'citext'",
                "table_schema NOT IN ('pg_catalog', 'information_schema')"
            ];
            const queryParams: unknown[] = [];

            if (schema !== undefined) {
                conditions.push(`table_schema = $1`);
                queryParams.push(schema);
            }

            const sql = `
                SELECT 
                    table_schema,
                    table_name,
                    column_name,
                    is_nullable,
                    column_default
                FROM information_schema.columns
                WHERE ${conditions.join(' AND ')}
                ORDER BY table_schema, table_name, ordinal_position
            `;

            const result = await adapter.executeQuery(sql, queryParams);

            return {
                columns: result.rows ?? [],
                count: result.rows?.length ?? 0
            };
        }
    };
}

/**
 * Analyze text columns that could benefit from citext
 */
function createCitextAnalyzeCandidatesTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_citext_analyze_candidates',
        description: `Find TEXT columns that may benefit from case-insensitive comparisons.
Looks for common patterns like email, username, name, slug, etc.`,
        group: 'citext',
        inputSchema: CitextAnalyzeCandidatesSchema,
        handler: async (params: unknown, _context: RequestContext) => {
            const { patterns, schema } = CitextAnalyzeCandidatesSchema.parse(params);

            // Default patterns for case-insensitive candidates
            const searchPatterns = patterns ?? [
                'email', 'e_mail', 'mail',
                'username', 'user_name', 'login',
                'name', 'first_name', 'last_name', 'full_name',
                'slug', 'handle', 'nickname',
                'code', 'sku', 'identifier'
            ];

            const conditions: string[] = [
                "data_type IN ('text', 'character varying')",
                "table_schema NOT IN ('pg_catalog', 'information_schema')"
            ];
            const queryParams: unknown[] = [];
            let paramIndex = 1;

            if (schema !== undefined) {
                conditions.push(`table_schema = $${String(paramIndex++)}`);
                queryParams.push(schema);
            }

            // Build pattern matching condition
            const patternConditions = searchPatterns.map(p => {
                const idx = paramIndex++;
                queryParams.push(`%${p}%`);
                return `LOWER(column_name) LIKE $${String(idx)}`;
            });
            conditions.push(`(${patternConditions.join(' OR ')})`);

            const sql = `
                SELECT 
                    table_schema,
                    table_name,
                    column_name,
                    data_type,
                    character_maximum_length,
                    is_nullable
                FROM information_schema.columns
                WHERE ${conditions.join(' AND ')}
                ORDER BY table_schema, table_name, ordinal_position
            `;

            const result = await adapter.executeQuery(sql, queryParams);
            const candidates = result.rows ?? [];

            // Categorize candidates by confidence
            const highConfidence: Record<string, unknown>[] = [];
            const mediumConfidence: Record<string, unknown>[] = [];

            for (const row of candidates) {
                const colName = (row['column_name'] as string).toLowerCase();
                if (colName.includes('email') || colName.includes('username') || colName === 'login') {
                    highConfidence.push(row);
                } else {
                    mediumConfidence.push(row);
                }
            }

            return {
                candidates,
                count: candidates.length,
                summary: {
                    highConfidence: highConfidence.length,
                    mediumConfidence: mediumConfidence.length
                },
                highConfidenceCandidates: highConfidence,
                mediumConfidenceCandidates: mediumConfidence,
                recommendation: candidates.length > 0
                    ? 'Consider converting these columns to citext for case-insensitive comparisons'
                    : 'No obvious candidates found. Use custom patterns if needed.'
            };
        }
    };
}

/**
 * Compare values case-insensitively
 */
function createCitextCompareTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_citext_compare',
        description: `Compare two values using case-insensitive semantics.
Useful for testing citext behavior before converting columns.`,
        group: 'citext',
        inputSchema: z.object({
            value1: z.string().describe('First value to compare'),
            value2: z.string().describe('Second value to compare')
        }),
        handler: async (params: unknown, _context: RequestContext) => {
            const { value1, value2 } = (params as { value1: string; value2: string });

            // Check if citext extension is installed
            const extCheck = await adapter.executeQuery(`
                SELECT EXISTS(
                    SELECT 1 FROM pg_extension WHERE extname = 'citext'
                ) as installed
            `);

            const hasExt = extCheck.rows?.[0]?.['installed'] as boolean ?? false;

            if (hasExt) {
                // Use citext comparison
                const result = await adapter.executeQuery(`
                    SELECT 
                        $1::citext = $2::citext as citext_equal,
                        $1::text = $2::text as text_equal,
                        LOWER($1) = LOWER($2) as lower_equal
                `, [value1, value2]);

                const row = result.rows?.[0];
                return {
                    value1,
                    value2,
                    citextEqual: row?.['citext_equal'] as boolean,
                    textEqual: row?.['text_equal'] as boolean,
                    lowerEqual: row?.['lower_equal'] as boolean,
                    extensionInstalled: true
                };
            } else {
                // Fallback without citext
                const result = await adapter.executeQuery(`
                    SELECT 
                        $1::text = $2::text as text_equal,
                        LOWER($1) = LOWER($2) as lower_equal
                `, [value1, value2]);

                const row = result.rows?.[0];
                return {
                    value1,
                    value2,
                    textEqual: row?.['text_equal'] as boolean,
                    lowerEqual: row?.['lower_equal'] as boolean,
                    extensionInstalled: false,
                    hint: 'Install citext extension for native case-insensitive comparisons'
                };
            }
        }
    };
}

/**
 * Schema advisor for citext columns
 */
function createCitextSchemaAdvisorTool(adapter: PostgresAdapter): ToolDefinition {
    return {
        name: 'pg_citext_schema_advisor',
        description: `Analyze a table and recommend which columns should use citext.
Provides schema design recommendations based on column names and existing data patterns.`,
        group: 'citext',
        inputSchema: CitextSchemaAdvisorSchema,
        handler: async (params: unknown, _context: RequestContext) => {
            const { table, schema } = CitextSchemaAdvisorSchema.parse(params);
            const schemaName = schema ?? 'public';

            // Get all text columns
            const colResult = await adapter.executeQuery(`
                SELECT 
                    column_name,
                    data_type,
                    udt_name,
                    is_nullable,
                    character_maximum_length
                FROM information_schema.columns
                WHERE table_schema = $1 
                  AND table_name = $2
                  AND data_type IN ('text', 'character varying', 'USER-DEFINED')
                ORDER BY ordinal_position
            `, [schemaName, table]);

            const columns = colResult.rows ?? [];
            const recommendations: {
                column: string;
                currentType: string;
                recommendation: 'convert' | 'keep' | 'already_citext';
                confidence: 'high' | 'medium' | 'low';
                reason: string;
            }[] = [];

            // Keywords that suggest case-insensitivity
            const highConfidencePatterns = ['email', 'username', 'login', 'user_name'];
            const mediumConfidencePatterns = ['name', 'slug', 'handle', 'code', 'sku', 'identifier', 'nickname'];

            for (const col of columns) {
                const colName = (col['column_name'] as string).toLowerCase();
                const dataType = col['data_type'] as string;
                const udtName = col['udt_name'] as string;

                if (udtName === 'citext') {
                    recommendations.push({
                        column: col['column_name'] as string,
                        currentType: 'citext',
                        recommendation: 'already_citext',
                        confidence: 'high',
                        reason: 'Column is already using citext'
                    });
                    continue;
                }

                // Check patterns
                const isHighConfidence = highConfidencePatterns.some(p => colName.includes(p));
                const isMediumConfidence = mediumConfidencePatterns.some(p => colName.includes(p));

                if (isHighConfidence) {
                    recommendations.push({
                        column: col['column_name'] as string,
                        currentType: dataType,
                        recommendation: 'convert',
                        confidence: 'high',
                        reason: `Column name suggests case-insensitive data (${colName} matches common identifier patterns)`
                    });
                } else if (isMediumConfidence) {
                    recommendations.push({
                        column: col['column_name'] as string,
                        currentType: dataType,
                        recommendation: 'convert',
                        confidence: 'medium',
                        reason: `Column name may benefit from case-insensitivity (${colName})`
                    });
                } else {
                    recommendations.push({
                        column: col['column_name'] as string,
                        currentType: dataType,
                        recommendation: 'keep',
                        confidence: 'low',
                        reason: 'No obvious case-insensitivity pattern detected'
                    });
                }
            }

            const convertCount = recommendations.filter(r => r.recommendation === 'convert').length;
            const highCount = recommendations.filter(r => r.recommendation === 'convert' && r.confidence === 'high').length;

            return {
                table: `${schemaName}.${table}`,
                recommendations,
                summary: {
                    totalTextColumns: columns.length,
                    recommendConvert: convertCount,
                    highConfidence: highCount,
                    alreadyCitext: recommendations.filter(r => r.recommendation === 'already_citext').length
                },
                nextSteps: convertCount > 0
                    ? [
                        'Review recommendations above',
                        `Use pg_citext_convert_column to convert recommended columns`,
                        'Update application queries if they rely on case-sensitive comparisons'
                    ]
                    : ['No columns require conversion']
            };
        }
    };
}
