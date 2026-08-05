import { authQuery } from "../auth";

export const listConnectedApps = authQuery({
  args: {},
  handler: async (ctx) => {
    const userId = ctx.auth.user._id;

    const apps = [];
    for await (const app of ctx.db
      .query("connected_apps")
      .withIndex("by_user_id", (q) => q.eq("userId", userId))) {
      apps.push(app);
    }

    return apps;
  },
});

export const listIntegrationActivity = authQuery({
  args: {},
  handler: async (ctx) => {
    const userId = ctx.auth.user._id;

    const logs = await ctx.db
      .query("integration_activity_logs")
      .withIndex("by_user_id_and_created_at", (q) => q.eq("userId", userId))
      .order("desc")
      .take(50);

    return logs;
  },
});
