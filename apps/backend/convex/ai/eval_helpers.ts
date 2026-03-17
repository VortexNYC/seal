/**
 * Eval helpers — internal queries for the eval pipeline.
 * Used by eval.ts to resolve test data without auth.
 */

import { internalQuery } from "../_generated/server";

/**
 * Get the first organization and its owner for eval testing.
 * Returns null if no org exists (empty dev database).
 */
export const getTestOrganization = internalQuery({
  handler: async (ctx) => {
    const org = await ctx.db.query("organizations").first();
    if (!org) return null;

    // Find the org owner (first member)
    const member = await ctx.db
      .query("organization_members")
      .withIndex("by_organization", (q) => q.eq("organizationId", org._id))
      .first();

    return {
      organizationId: org._id,
      userId: member?.userId?.toString() ?? "eval-test-user",
    };
  },
});
