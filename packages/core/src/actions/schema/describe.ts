import { z } from "zod";
import { ActionHandler, ActionContext } from "../../types.js";

export const DescribeSchema = z.object({
    action: z.literal("describe"),
    target: z.enum(["table", "view", "function", "trigger", "sequence"]),
    name: z.string(),
    schema: z.string().optional(),
});

export const describeHandler: ActionHandler<typeof DescribeSchema> = {
    schema: DescribeSchema,
    handler: async (params, context) => {
        switch (params.target) {
            case "table":
                return await describeTable(params, context);
            default:
                throw new Error(`Describe target "${params.target}" not implemented yet`);
        }
    },
};

async function describeTable(params: z.infer<typeof DescribeSchema>, context: ActionContext) {
    const schema = params.schema || "public";

    // Get columns
    const columnsSql = `
        SELECT 
            column_name as name,
            data_type as type,
            is_nullable as nullable,
            column_default as default_value
        FROM information_schema.columns
        WHERE table_schema = $1 AND table_name = $2
        ORDER BY ordinal_position;
    `;
    const columns = await context.executor.execute(columnsSql, [schema, params.name]);

    // Get indexes
    const indexesSql = `
        SELECT indexname as name, indexdef as definition
        FROM pg_indexes
        WHERE schemaname = $1 AND tablename = $2;
    `;
    const indexes = await context.executor.execute(indexesSql, [schema, params.name]);

    return {
        name: params.name,
        schema,
        columns: columns.rows,
        indexes: indexes.rows,
    };
}
