import { z } from "zod";
import { ActionHandler, ActionContext } from "../../types.js";

export const MaintenanceSchema = z.object({
    action: z.enum(["vacuum", "analyze", "reindex"]),
    target: z.string().optional(),
    options: z.object({
        full: z.boolean().optional(),
        verbose: z.boolean().optional(),
        analyze: z.boolean().optional(),
    }).optional(),
});

export const maintenanceHandler: ActionHandler<typeof MaintenanceSchema> = {
    schema: MaintenanceSchema,
    handler: async (params, context) => {
        let sql = "";
        const target = params.target ? `"${params.target}"` : "";

        switch (params.action) {
            case "vacuum":
                const vacuumOpts = [];
                if (params.options?.full) vacuumOpts.push("FULL");
                if (params.options?.verbose) vacuumOpts.push("VERBOSE");
                if (params.options?.analyze) vacuumOpts.push("ANALYZE");
                const vacuumOptStr = vacuumOpts.length > 0 ? `(${vacuumOpts.join(", ")})` : "";
                sql = `VACUUM ${vacuumOptStr} ${target}`.trim();
                break;
            case "analyze":
                const analyzeOpts = [];
                if (params.options?.verbose) analyzeOpts.push("VERBOSE");
                const analyzeOptStr = analyzeOpts.join(" ");
                sql = `ANALYZE ${analyzeOptStr} ${target}`.trim();
                break;
            case "reindex":
                sql = `REINDEX TABLE ${target}`.trim();
                break;
        }

        return await context.executor.execute(sql);
    },
};
