import { z } from "zod";
import { ActionHandler } from "../../types.js";
import { sanitizeIdentifier } from "@pg-mcp/shared/security/identifiers.js";

export const VacuumSchema = z.object({
    action: z.literal("vacuum"),
    target: z.string().optional(),
    options: z.object({
        full: z.boolean().optional(),
        verbose: z.boolean().optional(),
        analyze: z.boolean().optional(),
    }).optional(),
});

export const vacuumHandler: ActionHandler<typeof VacuumSchema> = {
    schema: VacuumSchema,
    handler: async (params, context) => {
        let sql = "VACUUM";
        const options = [];
        if (params.options?.full) options.push("FULL");
        if (params.options?.analyze) options.push("ANALYZE");
        if (params.options?.verbose) options.push("VERBOSE");

        if (options.length > 0) {
            sql += ` (${options.join(", ")})`;
        }

        if (params.target) {
            sql += ` ${sanitizeIdentifier(params.target)}`;
        }

        return await context.executor.execute(sql);
    },
};
