import type { ActionCache } from "@convex-dev/action-cache";
import type { FunctionReference, FunctionVisibility } from "convex/server";

import type { ActionCtx } from "../_generated/server";

type ActionCacheCtx<Action extends FunctionReference<"action", FunctionVisibility>> = Parameters<
  ActionCache<Action>["fetch"]
>[0];

export function toActionCacheCtx<Action extends FunctionReference<"action", FunctionVisibility>>(
  ctx: Pick<ActionCtx, "runQuery" | "runMutation" | "runAction">,
): ActionCacheCtx<Action> {
  return {
    runQuery: ctx.runQuery,
    runMutation: ctx.runMutation,
    runAction: ctx.runAction,
  } as unknown as ActionCacheCtx<Action>;
}
