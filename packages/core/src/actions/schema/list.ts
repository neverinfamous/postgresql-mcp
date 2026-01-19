import { z } from "zod";
import { ActionHandler, ActionContext } from "../../types.js";

export const ListSchema = z.object({
    action: z.literal("list"),
    target: z.enum(["database", "schema", "table", "column", "index", "view", "function", "trigger", "sequence", "constraint"]),
    schema: z.string().optional(),
    table: z.string().optional(),
    options: z.object({
        include_sizes: z.boolean().optional(),
        include_materialized: z.boolean().optional(),
        limit: z.number().optional(),
        offset: z.number().optional(),
    }).optional(),
});

export const listHandler: ActionHandler<typeof ListSchema> = {
    schema: ListSchema,
    handler: async (params, context) => {
        let { sql, args } = await getListQuery(params);

        if (params.options?.limit) {
            sql += ` LIMIT ${params.options.limit}`;
        }
        if (params.options?.offset) {
            sql += ` OFFSET ${params.options.offset}`;
        }

        return await context.executor.execute(sql, args);
    },
};

async function getListQuery(params: z.infer<typeof ListSchema>): Promise<{ sql: string; args?: any[] }> {
    switch (params.target) {
        case "schema":
            return { sql: "SELECT nspname as name FROM pg_namespace WHERE nspname NOT LIKE 'pg_%' AND nspname != 'information_schema' ORDER BY nspname" };
        case "table":
            return getTableQuery(params);
        case "view":
            return getViewQuery(params);
        case "function":
            return getFunctionQuery(params);
        case "trigger":
            return getTriggerQuery(params);
        case "sequence":
            return getSequenceQuery(params);
        case "constraint":
            return getConstraintQuery(params);
        default:
            throw new Error(`List target "${params.target}" not implemented yet`);
    }
}

function getTableQuery(params: z.infer<typeof ListSchema>) {
    const schema = params.schema || "public";
    return {
        sql: `
        SELECT 
          schemaname as schema,
          tablename as name,
          tableowner as owner,
          hasindexes as has_indexes
        FROM pg_tables 
        WHERE schemaname = $1
        ORDER BY tablename;
      `,
        args: [schema]
    };
}

function getViewQuery(params: z.infer<typeof ListSchema>) {
    const schemaClause = params.schema ? `AND n.nspname = $1` : "AND n.nspname NOT IN ('pg_catalog', 'information_schema')";
    const kindClause = params.options?.include_materialized !== false ? "IN ('v', 'm')" : "= 'v'";

    const sql = `SELECT n.nspname as schema, c.relname as name,
                    CASE c.relkind WHEN 'v' THEN 'view' WHEN 'm' THEN 'materialized_view' END as type,
                    TRIM(pg_get_viewdef(c.oid, true)) as definition
                    FROM pg_class c
                    JOIN pg_namespace n ON n.oid = c.relnamespace
                    WHERE c.relkind ${kindClause}
                    ${schemaClause}
                    ORDER BY n.nspname, c.relname`;

    const args = params.schema ? [params.schema] : [];
    return { sql, args };
}

function getFunctionQuery(params: z.infer<typeof ListSchema>) {
    const schemaClause = params.schema ? `AND n.nspname = $1` : "AND n.nspname NOT IN ('pg_catalog', 'information_schema')";
    const sql = `SELECT n.nspname as schema, p.proname as name,
                    pg_get_function_arguments(p.oid) as arguments,
                    pg_get_function_result(p.oid) as returns,
                    l.lanname as language
                    FROM pg_proc p
                    JOIN pg_namespace n ON n.oid = p.pronamespace
                    JOIN pg_language l ON l.oid = p.prolang
                    WHERE ${schemaClause.substring(4)}
                    ORDER BY n.nspname, p.proname`;
    const args = params.schema ? [params.schema] : [];
    return { sql, args };
}

function getTriggerQuery(params: z.infer<typeof ListSchema>) {
    let whereClause = "n.nspname NOT IN ('pg_catalog', 'information_schema')";
    const args = [];
    if (params.schema) {
        args.push(params.schema);
        whereClause += ` AND n.nspname = $${args.length}`;
    }
    if (params.table) {
        args.push(params.table);
        whereClause += ` AND c.relname = $${args.length}`;
    }

    const sql = `SELECT n.nspname as schema, c.relname as table_name, t.tgname as name,
                    CASE t.tgtype::int & 2 WHEN 2 THEN 'BEFORE' ELSE 'AFTER' END as timing,
                    p.proname as function_name
                    FROM pg_trigger t
                    JOIN pg_class c ON c.oid = t.tgrelid
                    JOIN pg_namespace n ON n.oid = c.relnamespace
                    JOIN pg_proc p ON p.oid = t.tgfoid
                    WHERE NOT t.tgisinternal
                    AND ${whereClause}
                    ORDER BY n.nspname, c.relname, t.tgname`;

    return { sql, args };
}

function getSequenceQuery(params: z.infer<typeof ListSchema>) {
    const schemaClause = params.schema ? `AND n.nspname = $1` : "AND n.nspname NOT IN ('pg_catalog', 'information_schema')";
    const sql = `SELECT n.nspname as schema, c.relname as name
                    FROM pg_class c
                    JOIN pg_namespace n ON n.oid = c.relnamespace
                    WHERE c.relkind = 'S'
                    ${schemaClause}
                    ORDER BY n.nspname, c.relname`;
    const args = params.schema ? [params.schema] : [];
    return { sql, args };
}

function getConstraintQuery(params: z.infer<typeof ListSchema>) {
    let whereClause = "n.nspname NOT IN ('pg_catalog', 'information_schema') AND con.contype != 'n'";
    const args = [];
    if (params.schema) {
        args.push(params.schema);
        whereClause += ` AND n.nspname = $${args.length}`;
    }
    if (params.table) {
        args.push(params.table);
        whereClause += ` AND c.relname = $${args.length}`;
    }

    const sql = `SELECT n.nspname as schema, c.relname as table_name, con.conname as name,
                    CASE con.contype 
                        WHEN 'p' THEN 'primary_key'
                        WHEN 'f' THEN 'foreign_key'
                        WHEN 'u' THEN 'unique'
                        WHEN 'c' THEN 'check'
                        ELSE con.contype
                    END as type,
                    pg_get_constraintdef(con.oid) as definition
                    FROM pg_constraint con
                    JOIN pg_class c ON c.oid = con.conrelid
                    JOIN pg_namespace n ON n.oid = c.relnamespace
                    WHERE ${whereClause}
                    ORDER BY n.nspname, c.relname, con.conname`;

    return { sql, args };
}
