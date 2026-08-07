import type { ActionCache } from "@convex-dev/action-cache";
import type { FunctionReference, FunctionVisibility } from "convex/server";

import type { ActionCtx } from "../_generated/server";

type ActionCacheCtx<
  Action extends FunctionReference<"action", FunctionVisibility>,
> = Parameters<ActionCache<Action>["fetch"]>[0];

type AnyAction = FunctionReference<"action", FunctionVisibility>;

export function toActionCacheCtx(
  ctx: Pick<ActionCtx, "runQuery" | "runMutation" | "runAction">
): ActionCacheCtx<AnyAction> {
  return {
    runQuery: ctx.runQuery,
    runMutation: ctx.runMutation,
    runAction: ctx.runAction,
  };
}
