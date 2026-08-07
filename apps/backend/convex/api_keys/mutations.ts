import { ConvexError, v } from "convex/values";

import { authMutation } from "../auth";

export const disconnectApp = authMutation({
  args: {
    appId: v.id("connected_apps"),
  },
  handler: async (ctx, args) => {
    const userId = ctx.auth.user._id;

    const app = await ctx.db.get("connected_apps", args.appId);

    if (!app) {
      throw new ConvexError("Connected app not found");
    }

    if (app.userId !== userId) {
      throw new ConvexError("You don't have permission to disconnect this app");
    }

    await ctx.db.insert("integration_activity_logs", {
      userId,
      type: "connected_app",
      integrationId: args.appId,
      integrationName: app.appName,
      action: "disconnected",
      createdAt: Date.now(),
    });

    await ctx.db.delete("connected_apps", args.appId);

    return { success: true };
  },
});
