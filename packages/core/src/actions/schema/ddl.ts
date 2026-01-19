import { z } from "zod";
import { ActionHandler, ActionContext } from "../../types.js";

export const DDLSchema = z.object({
    action: z.enum(["create", "alter", "drop"]),
    target: z.enum(["table", "index", "view", "function", "trigger", "schema"]),
    name: z.string(),
    schema: z.string().optional(),
    definition: z.string().optional(),
    options: z.object({
        cascade: z.boolean().optional(),
        if_exists: z.boolean().optional(),
        if_not_exists: z.boolean().optional(),
    }).optional(),
});

export const ddlHandler: ActionHandler<typeof DDLSchema> = {
    schema: DDLSchema,
    handler: async (params, context) => {
        switch (params.action) {
            case "create":
                return await handleCreate(params, context);
            case "alter":
                return await handleAlter(params, context);
            case "drop":
                return await handleDrop(params, context);
            default:
                throw new Error(`DDL action "${params.action}" not implemented yet`);
        }
    },
};

async function handleCreate(params: z.infer<typeof DDLSchema>, context: ActionContext) {
    const schemaPrefix = params.schema ? `${params.schema}.` : "";
    let sql = "";

    switch (params.target) {
        case "table":
            const ifNotExists = params.options?.if_not_exists ? "IF NOT EXISTS " : "";
            sql = `CREATE TABLE ${ifNotExists}${schemaPrefix}${params.name} (${params.definition})`;
            break;
        case "index":
            sql = `CREATE INDEX ${params.name} ON ${schemaPrefix}${params.definition}`;
            break;
        case "view":
            sql = `CREATE VIEW ${schemaPrefix}${params.name} AS ${params.definition}`;
            break;
        default:
            throw new Error(`Create target "${params.target}" not implemented yet`);
    }

    return await context.executor.execute(sql);
}

async function handleAlter(params: z.infer<typeof DDLSchema>, context: ActionContext) {
    const schemaPrefix = params.schema ? `${params.schema}.` : "";
    let sql = "";

    switch (params.target) {
        case "table":
            sql = `ALTER TABLE ${schemaPrefix}${params.name} ${params.definition}`;
            break;
        default:
            throw new Error(`Alter target "${params.target}" not implemented yet`);
    }

    return await context.executor.execute(sql);
}

async function handleDrop(params: z.infer<typeof DDLSchema>, context: ActionContext) {
    const schemaPrefix = params.schema ? `${params.schema}.` : "";
    const ifExists = params.options?.if_exists ? "IF EXISTS " : "";
    const cascade = params.options?.cascade ? " CASCADE" : "";

    let sql = "";
    switch (params.target) {
        case "table":
            sql = `DROP TABLE ${ifExists}${schemaPrefix}${params.name}${cascade}`;
            break;
        case "view":
            sql = `DROP VIEW ${ifExists}${schemaPrefix}${params.name}${cascade}`;
            break;
        case "index":
            sql = `DROP INDEX ${ifExists}${schemaPrefix}${params.name}${cascade}`;
            break;
        case "schema":
            sql = `DROP SCHEMA ${ifExists}${params.name}${cascade}`;
            break;
        default:
            throw new Error(`Drop target "${params.target}" not implemented yet`);
    }

    return await context.executor.execute(sql);
}
