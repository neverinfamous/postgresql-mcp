import { z } from "zod";
import { ActionHandler } from "../../types.js";

export const ReadSchema = z.object({
    action: z.literal("read"),
    sql: z.string(),
    params: z.array(z.unknown()).optional(),
    options: z.object({
        timeout_ms: z.number().optional(),
    }).optional(),
});

export const readHandler: ActionHandler<typeof ReadSchema> = {
    schema: ReadSchema,
    handler: async (params, context) => {
        return await context.executor.execute(params.sql, params.params, {
            timeout_ms: params.options?.timeout_ms,
        });
    },
};
