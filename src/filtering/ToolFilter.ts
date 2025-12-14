/**
 * postgres-mcp - Tool Filtering System
 * 
 * Parses and applies tool filter rules from environment variables.
 * Compatible with db-mcp filtering syntax.
 * 
 * Syntax:
 *   -group    → Disable all tools in a group
 *   +group    → Enable all tools in a group (useful after exclusions)
 *   -tool     → Disable specific tool
 *   +tool     → Enable specific tool (overrides group exclusion)
 */

import type {
    ToolGroup,
    ToolFilterConfig,
    ToolDefinition
} from '../types/index.js';

/**
 * Default tool groups and their member tools.
 * This serves as the canonical mapping of tools to groups.
 */
export const TOOL_GROUPS: Record<ToolGroup, string[]> = {
    core: [
        'pg_read_query',
        'pg_write_query',
        'pg_list_tables',
        'pg_describe_table',
        'pg_create_table',
        'pg_drop_table',
        'pg_get_indexes',
        'pg_create_index',
        'pg_list_objects',
        'pg_object_details',
        'pg_analyze_db_health',
        'pg_analyze_workload_indexes',
        'pg_analyze_query_indexes'
    ],
    transactions: [
        'pg_transaction_begin',
        'pg_transaction_commit',
        'pg_transaction_rollback',
        'pg_transaction_savepoint',
        'pg_transaction_release',
        'pg_transaction_rollback_to',
        'pg_transaction_execute'
    ],
    jsonb: [
        'pg_jsonb_extract',
        'pg_jsonb_set',
        'pg_jsonb_insert',
        'pg_jsonb_delete',
        'pg_jsonb_contains',
        'pg_jsonb_path_query',
        'pg_jsonb_agg',
        'pg_jsonb_object',
        'pg_jsonb_array',
        'pg_jsonb_keys',
        'pg_jsonb_strip_nulls',
        'pg_jsonb_typeof',
        'pg_jsonb_validate_path',
        'pg_jsonb_stats',
        'pg_jsonb_merge',
        'pg_jsonb_normalize',
        'pg_jsonb_diff',
        'pg_jsonb_index_suggest',
        'pg_jsonb_security_scan'
    ],
    text: [
        'pg_text_search',
        'pg_text_rank',
        'pg_trigram_similarity',
        'pg_fuzzy_match',
        'pg_regexp_match',
        'pg_like_search',
        'pg_similarity_search',
        'pg_text_headline',
        'pg_create_fts_index',
        'pg_text_normalize',
        'pg_text_sentiment'
    ],
    performance: [
        'pg_explain',
        'pg_explain_analyze',
        'pg_explain_buffers',
        'pg_index_stats',
        'pg_table_stats',
        'pg_stat_statements',
        'pg_stat_activity',
        'pg_locks',
        'pg_bloat_check',
        'pg_cache_hit_ratio',
        'pg_seq_scan_tables',
        'pg_index_recommendations',
        'pg_query_plan_compare',
        'pg_performance_baseline',
        'pg_connection_pool_optimize',
        'pg_partition_strategy_suggest'
    ],
    admin: [
        'pg_vacuum',
        'pg_vacuum_analyze',
        'pg_analyze',
        'pg_reindex',
        'pg_terminate_backend',
        'pg_cancel_backend',
        'pg_reload_conf',
        'pg_set_config',
        'pg_reset_stats',
        'pg_cluster'
    ],
    monitoring: [
        'pg_database_size',
        'pg_table_sizes',
        'pg_connection_stats',
        'pg_replication_status',
        'pg_server_version',
        'pg_show_settings',
        'pg_uptime',
        'pg_recovery_status',
        'pg_capacity_planning',
        'pg_resource_usage_analyze',
        'pg_alert_threshold_set'
    ],
    backup: [
        'pg_dump_table',
        'pg_dump_schema',
        'pg_copy_export',
        'pg_copy_import',
        'pg_create_backup_plan',
        'pg_restore_command',
        'pg_backup_physical',
        'pg_restore_validate',
        'pg_backup_schedule_optimize'
    ],
    schema: [
        'pg_list_schemas',
        'pg_create_schema',
        'pg_drop_schema',
        'pg_list_sequences',
        'pg_create_sequence',
        'pg_list_views',
        'pg_create_view',
        'pg_list_functions',
        'pg_list_triggers',
        'pg_list_constraints'
    ],
    vector: [
        'pg_vector_create_extension',
        'pg_vector_add_column',
        'pg_vector_insert',
        'pg_vector_search',
        'pg_vector_create_index',
        'pg_vector_distance',
        'pg_vector_normalize',
        'pg_vector_aggregate',
        'pg_vector_cluster',
        'pg_vector_index_optimize',
        'pg_hybrid_search',
        'pg_vector_performance',
        'pg_vector_dimension_reduce',
        'pg_vector_embed'
    ],
    postgis: [
        'pg_postgis_create_extension',
        'pg_geometry_column',
        'pg_point_in_polygon',
        'pg_distance',
        'pg_buffer',
        'pg_intersection',
        'pg_bounding_box',
        'pg_spatial_index',
        'pg_geocode',
        'pg_geo_transform',
        'pg_geo_index_optimize',
        'pg_geo_cluster'
    ],
    partitioning: [
        'pg_list_partitions',
        'pg_create_partition',
        'pg_attach_partition',
        'pg_detach_partition',
        'pg_partition_info',
        'pg_create_partitioned_table'
    ],
    stats: [
        'pg_stats_descriptive',
        'pg_stats_percentiles',
        'pg_stats_correlation',
        'pg_stats_regression',
        'pg_stats_time_series',
        'pg_stats_distribution',
        'pg_stats_hypothesis',
        'pg_stats_sampling'
    ]
};

/**
 * Get all tool names from all groups
 */
export function getAllToolNames(): string[] {
    const tools: string[] = [];
    for (const group of Object.values(TOOL_GROUPS)) {
        tools.push(...group);
    }
    return tools;
}

/**
 * Get the group for a specific tool
 */
export function getToolGroup(toolName: string): ToolGroup | undefined {
    for (const [group, tools] of Object.entries(TOOL_GROUPS)) {
        if (tools.includes(toolName)) {
            return group as ToolGroup;
        }
    }
    return undefined;
}

/**
 * Check if a name is a valid tool group
 */
export function isToolGroup(name: string): name is ToolGroup {
    return name in TOOL_GROUPS;
}

/**
 * Parse a tool filter string into structured rules
 * 
 * @param filterString - The filter string (e.g., "-vector,-postgis,+pg_vector_search")
 * @returns Parsed filter configuration
 */
export function parseToolFilter(filterString: string | undefined): ToolFilterConfig {
    const allTools = getAllToolNames();
    const enabledTools = new Set<string>(allTools);

    if (!filterString || filterString.trim() === '') {
        return {
            raw: '',
            rules: [],
            enabledTools
        };
    }

    const rules: ToolFilterConfig['rules'] = [];
    const parts = filterString.split(',').map(p => p.trim()).filter(p => p);

    for (const part of parts) {
        if (!part) continue;

        const isInclude = part.startsWith('+');
        const isExclude = part.startsWith('-');

        if (!isInclude && !isExclude) {
            // Default to include if no prefix
            continue;
        }

        const target = part.substring(1);
        const isGroup = isToolGroup(target);

        rules.push({
            type: isInclude ? 'include' : 'exclude',
            target,
            isGroup
        });

        // Apply rule
        if (isGroup) {
            const groupTools = TOOL_GROUPS[target];
            if (isExclude) {
                for (const tool of groupTools) {
                    enabledTools.delete(tool);
                }
            } else {
                for (const tool of groupTools) {
                    enabledTools.add(tool);
                }
            }
        } else {
            // Individual tool
            if (isExclude) {
                enabledTools.delete(target);
            } else {
                enabledTools.add(target);
            }
        }
    }

    return {
        raw: filterString,
        rules,
        enabledTools
    };
}

/**
 * Check if a tool is enabled based on filter configuration
 */
export function isToolEnabled(toolName: string, config: ToolFilterConfig): boolean {
    return config.enabledTools.has(toolName);
}

/**
 * Filter a list of tool definitions based on filter configuration
 */
export function filterTools(
    tools: ToolDefinition[],
    config: ToolFilterConfig
): ToolDefinition[] {
    return tools.filter(tool => config.enabledTools.has(tool.name));
}

/**
 * Get the tool filter from environment variable
 */
export function getToolFilterFromEnv(): ToolFilterConfig {
    const filterString = process.env['POSTGRES_TOOL_FILTER'] ??
        process.env['MCP_TOOL_FILTER'] ??
        process.env['TOOL_FILTER'];
    return parseToolFilter(filterString);
}

/**
 * Calculate token savings from tool filtering
 * Assumes ~200 tokens per tool definition (description + parameters)
 */
export function calculateTokenSavings(
    totalTools: number,
    enabledTools: number,
    tokensPerTool = 200
): { tokensSaved: number; percentSaved: number } {
    const disabledTools = totalTools - enabledTools;
    const tokensSaved = disabledTools * tokensPerTool;
    const percentSaved = totalTools > 0
        ? Math.round((disabledTools / totalTools) * 100)
        : 0;

    return { tokensSaved, percentSaved };
}

/**
 * Generate a summary of the current filter configuration
 */
export function getFilterSummary(config: ToolFilterConfig): string {
    const allTools = getAllToolNames();
    const enabledCount = config.enabledTools.size;
    const disabledCount = allTools.length - enabledCount;

    const lines: string[] = [
        `Tool Filter Summary:`,
        `  Total tools: ${String(allTools.length)}`,
        `  Enabled: ${String(enabledCount)}`,
        `  Disabled: ${String(disabledCount)}`
    ];

    if (config.rules.length > 0) {
        lines.push(`  Rules applied:`);
        for (const rule of config.rules) {
            const prefix = rule.type === 'include' ? '+' : '-';
            const type = rule.isGroup ? 'group' : 'tool';
            lines.push(`    ${prefix}${rule.target} (${type})`);
        }
    }

    // Show per-group breakdown
    lines.push(`  By group:`);
    for (const [group, tools] of Object.entries(TOOL_GROUPS)) {
        const enabled = tools.filter(t => config.enabledTools.has(t)).length;
        lines.push(`    ${group}: ${String(enabled)}/${String(tools.length)}`);
    }

    return lines.join('\n');
}

/**
 * Get a list of all tool groups with their tool counts
 */
export function getToolGroupInfo(): { group: ToolGroup; count: number; tools: string[] }[] {
    return Object.entries(TOOL_GROUPS).map(([group, tools]) => ({
        group: group as ToolGroup,
        count: tools.length,
        tools
    }));
}
