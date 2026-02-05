import { ConvexError, v } from "convex/values";

import { memberQuery } from "../auth";
import { getConnectionStatus } from "./connect_helpers";

/**
 * Public query for the current org's Stripe Connect status.
 * Used by settings pages and gating logic in the UI.
 */
export const getConnectedAccount = memberQuery({
  args: {
    slug: v.string(),
  },
  handler: async (ctx, args) => {
    if (ctx.auth.organization.slug !== args.slug) {
      throw new ConvexError("Organization mismatch");
    }

    // Fetch the connected account record for the org.
    const account = await ctx.db
      .query("stripe_accounts")
      .withIndex("by_organization", (q) => q.eq("organizationId", ctx.auth.organization._id))
      .first();

    if (!account) {
      return {
        status: "not_connected" as const,
        account: null,
        canManage: ctx.auth.isAdmin(),
      };
    }

    const status = getConnectionStatus({
      chargesEnabled: account.chargesEnabled,
      payoutsEnabled: account.payoutsEnabled,
      detailsSubmitted: account.detailsSubmitted,
      requirements: account.requirements,
    });

    return {
      status,
      account,
      canManage: ctx.auth.isAdmin(),
    };
  },
});
