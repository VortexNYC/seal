/**
 * AI workpool — priority queues for background AI processing.
 *
 * Pro orgs get a pool with higher parallelism (processed first).
 * Free orgs get a pool with lower parallelism (processed after Pro).
 */

import { Workpool } from "@convex-dev/workpool";
import type { GenericDataModel, GenericMutationCtx } from "convex/server";

import { components, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { DatabaseReader } from "../_generated/server";

/** Pro pool: higher parallelism = more concurrent jobs. */
export const aiPoolPro = new Workpool(components.aiPoolPro, {
  maxParallelism: 8,
});

/** Free pool: lower parallelism = jobs wait longer under load. */
export const aiPoolFree = new Workpool(components.aiPoolFree, {
  maxParallelism: 2,
});

/**
 * Ctx shape needed by workpool enqueue — mutation wrappers omit parts of
 * MutationCtx/ActionCtx, so accept the structural run* surface the workpool
 * client actually requires (its MutationCtx is exactly this Pick).
 */
type WorkpoolCtx = Pick<
  GenericMutationCtx<GenericDataModel>,
  "runQuery" | "runMutation"
>;

/**
 * Enqueue a document for AI processing via the appropriate priority pool.
 *
 * Call this from document mutations instead of `ctx.scheduler.runAfter`.
 * Resolves the org's subscription plan to pick Pro vs Free pool.
 */
export async function enqueueAiPipeline(
  ctx: WorkpoolCtx,
  db: DatabaseReader,
  documentId: Id<"documents">,
  organizationId: Id<"organizations">,
  userId?: Id<"users">,
  betterAuthOrganizationId?: string,
  betterAuthUserId?: string
) {
  const isPro = await isProOrganization(db, organizationId);
  const pool = isPro ? aiPoolPro : aiPoolFree;

  await pool.enqueueAction(ctx, internal.ai.pipeline.processDocument, {
    documentId,
    betterAuthOrganizationId,
    betterAuthUserId,
    organizationId,
    userId,
  });
}

/**
 * Check if an organization has an active Pro subscription.
 */
async function isProOrganization(
  db: DatabaseReader,
  organizationId: Id<"organizations">
): Promise<boolean> {
  const subscription =
    (await db
      .query("subscriptions")
      .withIndex("by_organization_status", (q) =>
        q.eq("organizationId", organizationId).eq("status", "active")
      )
      .order("desc")
      .first()) ??
    (await db
      .query("subscriptions")
      .withIndex("by_organization_status", (q) =>
        q.eq("organizationId", organizationId).eq("status", "trialing")
      )
      .order("desc")
      .first());

  return !!subscription;
}
