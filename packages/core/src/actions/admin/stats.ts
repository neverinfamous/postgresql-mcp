import { z } from "zod";
import { ActionHandler, ActionContext } from "../../types.js";

export const StatsSchema = z.object({
    action: z.literal("stats"),
    target: z.string().optional(),
});

export const statsHandler: ActionHandler<typeof StatsSchema> = {
    schema: StatsSchema,
    handler: async (params, context) => {
        let sql = "";
        const args: any[] = [];

        if (params.target) {
            sql = `
                SELECT * FROM pg_stat_user_tables 
                WHERE relname = $1;
            `;
            args.push(params.target);
        } else {
            sql = `
                SELECT 
                    schemaname, relname, 
                    seq_scan, seq_tup_read, 
                    idx_scan, idx_tup_fetch,
                    n_tup_ins, n_tup_upd, n_tup_del
                FROM pg_stat_user_tables
                ORDER BY n_tup_ins + n_tup_upd + n_tup_del DESC
                LIMIT 20;
            `;
        }

        return await context.executor.execute(sql, args);
    },
};
