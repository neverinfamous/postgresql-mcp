/**
 * postgres-mcp - Code Mode API
 * 
 * Exposes all 194 PostgreSQL tools organized by their 19 groups
 * for use within the sandboxed execution environment.
 */

import type { PostgresAdapter } from '../adapters/postgresql/PostgresAdapter.js';
import type { ToolDefinition } from '../types/index.js';

/**
 * Dynamic API generator for tool groups
 * Creates methods for each tool in the group
 */
function createGroupApi(
    adapter: PostgresAdapter,
    groupName: string,
    tools: ToolDefinition[]
): Record<string, (params: unknown) => Promise<unknown>> {
    const api: Record<string, (params: unknown) => Promise<unknown>> = {};

    for (const tool of tools) {
        // Convert tool name to method name
        // e.g., pg_read_query -> readQuery, pg_jsonb_extract -> extract
        const methodName = toolNameToMethodName(tool.name, groupName);

        api[methodName] = async (params: unknown) => {
            const context = adapter.createContext();
            return tool.handler(params, context);
        };
    }

    return api;
}

/**
 * Convert tool name to camelCase method name
 * Examples:
 *   pg_read_query (core) -> readQuery
 *   pg_jsonb_extract (jsonb) -> extract
 *   pg_vector_search (vector) -> search
 */
function toolNameToMethodName(toolName: string, groupName: string): string {
    // Remove pg_ prefix
    let name = toolName.replace(/^pg_/, '');

    // Remove group prefix if present
    const groupPrefix = groupName.replace(/-/g, '_') + '_';
    if (name.startsWith(groupPrefix)) {
        name = name.substring(groupPrefix.length);
    }

    // Convert snake_case to camelCase
    return name.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

/**
 * Main API class exposing all tool groups
 */
export class PgApi {
    readonly core: Record<string, (params: unknown) => Promise<unknown>>;
    readonly transactions: Record<string, (params: unknown) => Promise<unknown>>;
    readonly jsonb: Record<string, (params: unknown) => Promise<unknown>>;
    readonly text: Record<string, (params: unknown) => Promise<unknown>>;
    readonly performance: Record<string, (params: unknown) => Promise<unknown>>;
    readonly admin: Record<string, (params: unknown) => Promise<unknown>>;
    readonly monitoring: Record<string, (params: unknown) => Promise<unknown>>;
    readonly backup: Record<string, (params: unknown) => Promise<unknown>>;
    readonly schema: Record<string, (params: unknown) => Promise<unknown>>;
    readonly vector: Record<string, (params: unknown) => Promise<unknown>>;
    readonly postgis: Record<string, (params: unknown) => Promise<unknown>>;
    readonly partitioning: Record<string, (params: unknown) => Promise<unknown>>;
    readonly stats: Record<string, (params: unknown) => Promise<unknown>>;
    readonly cron: Record<string, (params: unknown) => Promise<unknown>>;
    readonly partman: Record<string, (params: unknown) => Promise<unknown>>;
    readonly kcache: Record<string, (params: unknown) => Promise<unknown>>;
    readonly citext: Record<string, (params: unknown) => Promise<unknown>>;
    readonly ltree: Record<string, (params: unknown) => Promise<unknown>>;
    readonly pgcrypto: Record<string, (params: unknown) => Promise<unknown>>;

    private readonly toolsByGroup: Map<string, ToolDefinition[]>;

    constructor(adapter: PostgresAdapter) {
        // Get all tool definitions and group them
        const allTools = adapter.getToolDefinitions();
        this.toolsByGroup = this.groupTools(allTools);

        // Create group-specific APIs
        this.core = createGroupApi(adapter, 'core', this.toolsByGroup.get('core') ?? []);
        this.transactions = createGroupApi(adapter, 'transactions', this.toolsByGroup.get('transactions') ?? []);
        this.jsonb = createGroupApi(adapter, 'jsonb', this.toolsByGroup.get('jsonb') ?? []);
        this.text = createGroupApi(adapter, 'text', this.toolsByGroup.get('text') ?? []);
        this.performance = createGroupApi(adapter, 'performance', this.toolsByGroup.get('performance') ?? []);
        this.admin = createGroupApi(adapter, 'admin', this.toolsByGroup.get('admin') ?? []);
        this.monitoring = createGroupApi(adapter, 'monitoring', this.toolsByGroup.get('monitoring') ?? []);
        this.backup = createGroupApi(adapter, 'backup', this.toolsByGroup.get('backup') ?? []);
        this.schema = createGroupApi(adapter, 'schema', this.toolsByGroup.get('schema') ?? []);
        this.vector = createGroupApi(adapter, 'vector', this.toolsByGroup.get('vector') ?? []);
        this.postgis = createGroupApi(adapter, 'postgis', this.toolsByGroup.get('postgis') ?? []);
        this.partitioning = createGroupApi(adapter, 'partitioning', this.toolsByGroup.get('partitioning') ?? []);
        this.stats = createGroupApi(adapter, 'stats', this.toolsByGroup.get('stats') ?? []);
        this.cron = createGroupApi(adapter, 'cron', this.toolsByGroup.get('cron') ?? []);
        this.partman = createGroupApi(adapter, 'partman', this.toolsByGroup.get('partman') ?? []);
        this.kcache = createGroupApi(adapter, 'kcache', this.toolsByGroup.get('kcache') ?? []);
        this.citext = createGroupApi(adapter, 'citext', this.toolsByGroup.get('citext') ?? []);
        this.ltree = createGroupApi(adapter, 'ltree', this.toolsByGroup.get('ltree') ?? []);
        this.pgcrypto = createGroupApi(adapter, 'pgcrypto', this.toolsByGroup.get('pgcrypto') ?? []);
    }

    /**
     * Group tools by their tool group
     */
    private groupTools(tools: ToolDefinition[]): Map<string, ToolDefinition[]> {
        const grouped = new Map<string, ToolDefinition[]>();

        for (const tool of tools) {
            const group = tool.group;
            const existing = grouped.get(group);
            if (existing) {
                existing.push(tool);
            } else {
                grouped.set(group, [tool]);
            }
        }

        return grouped;
    }

    /**
     * Get list of available groups and their method counts
     */
    getAvailableGroups(): Record<string, number> {
        const groups: Record<string, number> = {};
        for (const [group, tools] of this.toolsByGroup) {
            groups[group] = tools.length;
        }
        return groups;
    }

    /**
     * Get list of methods available in a group
     */
    getGroupMethods(groupName: string): string[] {
        const groupApi = this[groupName as keyof PgApi];
        if (typeof groupApi === 'object' && groupApi !== null) {
            return Object.keys(groupApi as Record<string, unknown>);
        }
        return [];
    }

    /**
     * Create a serializable API binding for the sandbox
     * This creates references that can be called from isolated-vm
     */
    createSandboxBindings(): Record<string, Record<string, unknown>> {
        const bindings: Record<string, Record<string, unknown>> = {};

        const groupNames = [
            'core', 'transactions', 'jsonb', 'text', 'performance',
            'admin', 'monitoring', 'backup', 'schema', 'vector',
            'postgis', 'partitioning', 'stats', 'cron', 'partman',
            'kcache', 'citext', 'ltree', 'pgcrypto'
        ] as const;

        for (const groupName of groupNames) {
            const groupApi = this[groupName];
            bindings[groupName] = { ...groupApi };
        }

        return bindings;
    }
}

/**
 * Create a PgApi instance for an adapter
 */
export function createPgApi(adapter: PostgresAdapter): PgApi {
    return new PgApi(adapter);
}
