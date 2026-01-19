import { z } from "zod";
import { ActionHandler } from "../../types.js";

export const ExplainSchema = z.object({
    action: z.literal("explain"),
    sql: z.string(),
    params: z.array(z.unknown()).optional(),
    options: z.object({
        explain_analyze: z.boolean().optional(),
        explain_format: z.enum(["text", "json"]).optional(),
        timeout_ms: z.number().optional(),
    }).optional(),
});

export const explainHandler: ActionHandler<typeof ExplainSchema> = {
    schema: ExplainSchema,
    handler: async (params, context) => {
        let explainSql = "EXPLAIN ";
        if (params.options?.explain_analyze || params.options?.explain_format) {
            const options = [];
            if (params.options.explain_analyze) options.push("ANALYZE");
            if (params.options.explain_format) options.push(`FORMAT ${params.options.explain_format.toUpperCase()}`);
            explainSql += `(${options.join(", ")}) `;
        }
        explainSql += params.sql;

        return await context.executor.execute(explainSql, params.params, {
            timeout_ms: params.options?.timeout_ms,
        });
    },
};
