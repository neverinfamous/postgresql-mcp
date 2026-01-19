import { z } from "zod";
import { ActionHandler, ActionContext } from "../../types.js";

export const ObservabilitySchema = z.object({
    action: z.enum(["connections", "locks", "size"]),
    options: z.object({
        database: z.string().optional(),
        schema: z.string().optional(),
        include_idle: z.boolean().optional(),
    }).optional(),
});

export const observabilityHandler: ActionHandler<typeof ObservabilitySchema> = {
    schema: ObservabilitySchema,
    handler: async (params, context) => {
        let sql = "";
        const args: any[] = [];

        switch (params.action) {
            case "connections":
                const filter = params.options?.include_idle ? "" : "WHERE state != 'idle'";
                sql = `
                    SELECT 
                        datname as database,
                        count(*) as count,
                        state
                    FROM pg_stat_activity
                    ${filter}
                    GROUP BY datname, state;
                `;
                break;
            case "locks":
                sql = `
                    SELECT 
                        t.relname,
                        l.locktype,
                        l.mode,
                        l.granted,
                        a.query,
                        a.query_start
                    FROM pg_locks l
                    JOIN pg_stat_activity a ON l.pid = a.pid
                    LEFT JOIN pg_class t ON l.relation = t.oid
                    WHERE a.datname = current_database()
                    ORDER BY a.query_start;
                `;
                break;
            case "size":
                if (params.options?.database) {
                    sql = `SELECT pg_size_pretty(pg_database_size($1)) as size`;
                    args.push(params.options.database);
                } else {
                    sql = `
                        SELECT 
                            relname as name,
                            pg_size_pretty(pg_total_relation_size(relid)) as size
                        FROM pg_catalog.pg_statio_user_tables
                        ORDER BY pg_total_relation_size(relid) DESC
                        LIMIT 20;
                    `;
                }
                break;
        }

        return await context.executor.execute(sql, args);
    },
};
