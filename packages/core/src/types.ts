import { z } from "zod";
import { QueryExecutor } from "@pg-mcp/shared/executor/interface.js";

export const ToolActionSchema = z.object({
    action: z.string(),
});

export interface ActionContext {
    executor: QueryExecutor;
}

export interface ActionHandler<T extends z.ZodTypeAny, R = any> {
    schema: T;
    handler: (params: z.infer<T>, context: ActionContext) => Promise<R>;
}

export type ActionRegistry = Record<string, ActionHandler<any>>;
