import { v } from "convex/values";

import { authMutation } from "../auth/wrappers";
import { feedbackTypeTuple } from "../schemas/feedback";

export const submit = authMutation({
  args: {
    type: feedbackTypeTuple,
    message: v.string(),
    route: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const feedbackId = await ctx.db.insert("feedback", {
      userId: ctx.auth.userId,
      organizationId: ctx.auth.organizationId,
      type: args.type,
      message: args.message,
      route: args.route,
      createdAt: Date.now(),
    });
    return feedbackId;
  },
});
