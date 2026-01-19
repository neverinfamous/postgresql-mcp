import { z } from "zod";
import { ActionRegistry, ActionContext } from "../types.js";
import { readHandler } from "../actions/query/read.js";
import { writeHandler } from "../actions/query/write.js";
import { explainHandler } from "../actions/query/explain.js";

const queryRegistry: ActionRegistry = {
    read: readHandler,
    write: writeHandler,
    explain: explainHandler,
};

export const PgQuerySchema = z.discriminatedUnion("action", [
    readHandler.schema,
    writeHandler.schema,
    explainHandler.schema,
]);

export async function pgQueryHandler(params: z.infer<typeof PgQuerySchema>, context: ActionContext) {
    const handler = queryRegistry[params.action];
    if (!handler) {
        throw new Error(`Unknown action: ${params.action}`);
    }
    return await handler.handler(params, context);
}
