import { z } from "zod";
import { ActionHandler } from "../../types.js";

export const WriteSchema = z.object({
    action: z.literal("write"),
    sql: z.string(),
    params: z.array(z.unknown()).optional(),
    options: z.object({
        timeout_ms: z.number().optional(),
    }).optional(),
});

export const writeHandler: ActionHandler<typeof WriteSchema> = {
    schema: WriteSchema,
    handler: async (params, context) => {
        return await context.executor.execute(params.sql, params.params, {
            timeout_ms: params.options?.timeout_ms,
        });
    },
};
