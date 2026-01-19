import { z } from "zod";
import { ActionHandler } from "../../types.js";

export const HealthSchema = z.object({
    action: z.literal("health"),
});

export const healthHandler: ActionHandler<typeof HealthSchema> = {
    schema: HealthSchema,
    handler: async (params, context) => {
        const sql = "SELECT version(), current_database(), now()";
        const result = await context.executor.execute(sql);
        return {
            status: "healthy",
            database: result.rows[0].current_database,
            version: result.rows[0].version,
            server_time: result.rows[0].now,
        };
    },
};
