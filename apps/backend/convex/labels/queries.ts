import { ConvexError, v } from "convex/values";

import { authQuery } from "../auth";

export const getLabel = authQuery({
  args: {
    labelId: v.id("labels"),
  },
  handler: async (ctx, args) => {
    const label = await ctx.db.get(args.labelId);
    if (!label || label.organizationId !== ctx.auth.organization._id) {
      throw new ConvexError("Label not found");
    }
    return label;
  },
});

export const listLabels = authQuery({
  args: {
    organizationId: v.id("organizations"),
  },
  handler: async (ctx, args) => {
    // Ensure user is a member of the requested organization
    const member = await ctx.db
      .query("organization_members")
      .withIndex("by_user_organization", (q) =>
        q.eq("userId", ctx.auth.user._id).eq("organizationId", args.organizationId),
      )
      .first();

    if (!member) {
      throw new ConvexError("No access to this organization");
    }

    const labels = await ctx.db
      .query("labels")
      .withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId))
      .collect();

    return labels.sort((a, b) => a.name.localeCompare(b.name));
  },
});
