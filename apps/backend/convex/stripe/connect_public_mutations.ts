import { ConvexError, v } from "convex/values";

import { adminMutation } from "../auth";

export const updateFeeHandling = adminMutation({
  args: {
    feeHandling: v.union(v.literal("absorb"), v.literal("pass_to_recipient")),
  },
  handler: async (ctx, args) => {
    const account = await ctx.db
      .query("stripe_accounts")
      .withIndex("by_organization", (q) => q.eq("organizationId", ctx.auth.organization._id))
      .first();

    if (!account) {
      throw new ConvexError("Stripe account not connected");
    }

    await ctx.db.patch(account._id, {
      feeHandling: args.feeHandling,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});
