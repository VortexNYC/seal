/**
 * AI workpool — priority queues for background AI processing.
 *
 * Pro orgs get a pool with higher parallelism (processed first).
 * Free orgs get a pool with lower parallelism (processed after Pro).
 */

import { Workpool } from "@convex-dev/workpool";

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

/** Ctx shape needed by workpool — just runMutation + runQuery. */
type WorkpoolCtx = {
  runMutation: Parameters<typeof aiPoolPro.enqueueAction>[0]["runMutation"];
  runQuery: Parameters<typeof aiPoolPro.enqueueAction>[0]["runQuery"];
};

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
) {
  const isPro = await isProOrganization(db, organizationId);
  const pool = isPro ? aiPoolPro : aiPoolFree;

  await pool.enqueueAction(ctx, internal.ai.pipeline.processDocument, {
    documentId,
    organizationId,
    userId,
  });
}

/**
 * Check if an organization has an active Pro subscription.
 */
async function isProOrganization(
  db: DatabaseReader,
  organizationId: Id<"organizations">,
): Promise<boolean> {
  const subscription = await db
    .query("subscriptions")
    .withIndex("by_organization_id", (q) => q.eq("organizationId", organizationId))
    .order("desc")
    .first();

  return subscription?.status === "active" || subscription?.status === "trialing";
}
