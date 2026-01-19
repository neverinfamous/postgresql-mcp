import { z } from "zod";
import { ActionRegistry, ActionContext } from "../types.js";
import { listHandler } from "../actions/schema/list.js";
import { describeHandler } from "../actions/schema/describe.js";
import { ddlHandler } from "../actions/schema/ddl.js";

const schemaRegistry: ActionRegistry = {
    list: listHandler,
    describe: describeHandler,
    create: ddlHandler,
    alter: ddlHandler,
    drop: ddlHandler,
};

export const PgSchemaToolSchema = z.discriminatedUnion("action", [
    listHandler.schema,
    describeHandler.schema,
    ddlHandler.schema,
]);

export async function pgSchemaHandler(params: any, context: ActionContext) {
    const handler = schemaRegistry[params.action];
    if (!handler) {
        throw new Error(`Unknown action: ${params.action}`);
    }
    return await handler.handler(params, context);
}
