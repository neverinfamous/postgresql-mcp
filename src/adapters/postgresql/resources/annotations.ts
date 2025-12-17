/**
 * Tool Annotations Resource
 * 
 * Provides a summary of all tools categorized by their annotation hints.
 * Enables MCP clients to efficiently filter and display tools by behavior.
 */

import type { PostgresAdapter } from '../PostgresAdapter.js';
import type { ResourceDefinition, RequestContext } from '../../../types/index.js';

interface ToolAnnotationInfo {
    name: string;
    title: string;
    group: string;
}

interface AnnotationsSummary {
    totalTools: number;
    byCategory: {
        readOnly: ToolAnnotationInfo[];
        write: ToolAnnotationInfo[];
        destructive: ToolAnnotationInfo[];
        idempotent: ToolAnnotationInfo[];
        admin: ToolAnnotationInfo[];
    };
    counts: {
        readOnly: number;
        write: number;
        destructive: number;
        idempotent: number;
        admin: number;
    };
    clientHints: {
        safeToAutoApprove: string[];
        requiresConfirmation: string[];
        safeToRetry: string[];
    };
}

/**
 * Create the annotations resource
 */
export function createAnnotationsResource(adapter: PostgresAdapter): ResourceDefinition {
    return {
        uri: 'postgres://annotations',
        name: 'Tool Annotations',
        description: 'Summary of all tools categorized by behavior hints (read-only, write, destructive, idempotent)',
        mimeType: 'application/json',
        // eslint-disable-next-line @typescript-eslint/require-await
        handler: async (_uri: string, _context: RequestContext) => {
            const tools = adapter.getToolDefinitions();

            const summary: AnnotationsSummary = {
                totalTools: tools.length,
                byCategory: {
                    readOnly: [],
                    write: [],
                    destructive: [],
                    idempotent: [],
                    admin: []
                },
                counts: {
                    readOnly: 0,
                    write: 0,
                    destructive: 0,
                    idempotent: 0,
                    admin: 0
                },
                clientHints: {
                    safeToAutoApprove: [],
                    requiresConfirmation: [],
                    safeToRetry: []
                }
            };

            for (const tool of tools) {
                const annotations = tool.annotations;
                const info: ToolAnnotationInfo = {
                    name: tool.name,
                    title: annotations?.title ?? tool.name,
                    group: tool.group
                };

                // Categorize by primary behavior
                if (annotations?.destructiveHint === true) {
                    summary.byCategory.destructive.push(info);
                    summary.counts.destructive++;
                    summary.clientHints.requiresConfirmation.push(tool.name);
                } else if (annotations?.idempotentHint === true) {
                    summary.byCategory.idempotent.push(info);
                    summary.counts.idempotent++;
                    summary.clientHints.safeToRetry.push(tool.name);
                } else if (annotations?.readOnlyHint === true) {
                    summary.byCategory.readOnly.push(info);
                    summary.counts.readOnly++;
                    summary.clientHints.safeToAutoApprove.push(tool.name);
                } else {
                    // Write or admin tools
                    const title = annotations?.title ?? '';
                    if (title.includes('Vacuum') || title.includes('Analyze') || title.includes('Reindex')) {
                        summary.byCategory.admin.push(info);
                        summary.counts.admin++;
                    } else {
                        summary.byCategory.write.push(info);
                        summary.counts.write++;
                    }
                }
            }

            return summary;
        }
    };
}
