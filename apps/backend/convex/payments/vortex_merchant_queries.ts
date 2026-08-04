import { v } from "convex/values";

import { internalQuery } from "../_generated/server";

export const getVortexMerchantAccountIdForOrg = internalQuery({
  args: {
    organizationId: v.id("organizations"),
  },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, args): Promise<string | null> => {
    const account = await ctx.db
      .query("merchant_accounts")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId)
      )
      .first();

    if (account === null || !account.chargesEnabled) {
      return null;
    }

    return account.providerAccountId;
  },
});
