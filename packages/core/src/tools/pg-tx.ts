import { z } from "zod";
import { ActionRegistry, ActionContext } from "../types.js";
import { txHandler } from "../actions/tx/tx.js";

const txRegistry: ActionRegistry = {
    begin: txHandler,
    commit: txHandler,
    rollback: txHandler,
    savepoint: txHandler,
    release: txHandler,
};

export const PgTxToolSchema = txHandler.schema;

export async function pgTxHandler(params: any, context: ActionContext) {
    const handler = txRegistry[params.action];
    if (!handler) {
        throw new Error(`Unknown action: ${params.action}`);
    }
    return await handler.handler(params, context);
}
