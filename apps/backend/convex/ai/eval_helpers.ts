/**
 * Eval helpers — internal queries for the eval pipeline.
 * Used by eval.ts to resolve test data without auth.
 */

import { internalQuery } from "../_generated/server";
import { listComponentMembersByOrganization } from "../lib/componentOrgReads";

/**
 * Get the first organization and its owner for eval testing.
 * Returns null if no org exists (empty dev database).
 */
export const getTestOrganization = internalQuery({
  handler: async (ctx) => {
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
