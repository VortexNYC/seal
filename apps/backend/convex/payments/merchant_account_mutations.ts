import { ConvexError, v } from "convex/values";

import { adminMutation } from "../auth";
import { feeHandlingValidator } from "./merchant_account_validators";

export const updateFeeHandling = adminMutation({
  args: {
    feeHandling: feeHandlingValidator,
  },
  returns: v.object({
    success: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const account = await ctx.db
      .query("stripe_accounts")
      .withIndex("by_organization", (q) => q.eq("organizationId", ctx.auth.organization._id))
      .first();

    if (!account) {
      throw new ConvexError("Merchant account not connected");
    }

    await ctx.db.patch(account._id, {
      feeHandling: args.feeHandling,
      updatedAt: Date.now(),
    });

    return { success: true };
  },
});
