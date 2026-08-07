/**
 * Eval helpers — internal queries for the eval pipeline.
 * Used by eval.ts to resolve test data without auth.
 */

import { v } from "convex/values";

import type { Id } from "../_generated/dataModel";
import { internalQuery } from "../_generated/server";
import { listComponentMembersByOrganization } from "../lib/componentOrgReads";

/**
 * Get the first organization and its owner for eval testing.
 * Returns null if no org exists (empty dev database).
 */
export const getTestOrganization = internalQuery({
  args: {},
  handler: async (
    ctx
  ): Promise<{
    organizationId: Id<"organizations">;
    userId: string;
  } | null> => {
    const org = await ctx.db.query("organizations").first();
    if (!org) return null;

    const members = await listComponentMembersByOrganization(ctx, org);
    const member = members.find((m) => m.userId !== null);

    return {
      organizationId: org._id,
      userId: member?.userId?.toString() ?? "eval-test-user",
    };
  },
});

/** Normalize a raw document id string for eval callers (HTTP body, etc.). */
export const resolveDocumentId = internalQuery({
  args: { documentId: v.string() },
  returns: v.union(v.id("documents"), v.null()),
  handler: async (ctx, args): Promise<Id<"documents"> | null> => {
    return ctx.db.normalizeId("documents", args.documentId);
  },
});
