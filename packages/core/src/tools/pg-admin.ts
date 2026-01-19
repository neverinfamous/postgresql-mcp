import { z } from "zod";
import { ActionRegistry, ActionContext } from "../types.js";
import { maintenanceHandler } from "../actions/admin/maintenance.js";
import { statsHandler } from "../actions/admin/stats.js";

const adminRegistry: ActionRegistry = {
    vacuum: maintenanceHandler,
    analyze: maintenanceHandler,
    reindex: maintenanceHandler,
    stats: statsHandler,
};

export const PgAdminToolSchema = z.discriminatedUnion("action", [
    maintenanceHandler.schema,
    statsHandler.schema,
]);

export async function pgAdminHandler(params: any, context: ActionContext) {
    const handler = adminRegistry[params.action];
    if (!handler) {
        throw new Error(`Unknown action: ${params.action}`);
    }
    return await handler.handler(params, context);
}
