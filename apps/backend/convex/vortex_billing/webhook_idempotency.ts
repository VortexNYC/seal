import { v } from "convex/values";

import { internalMutation, internalQuery } from "../_generated/server";

export const isEventProcessed = internalQuery({
  args: {
    eventId: v.string(),
  },
  handler: async (ctx, args): Promise<boolean> => {
    const existing = await ctx.db
      .query("vortex_billing_webhook_events")
      .withIndex("by_event_id", (q) => q.eq("eventId", args.eventId))
      .first();

    return existing !== null;
  },
});

export const markEventProcessed = internalMutation({
  args: {
    eventId: v.string(),
    eventType: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("vortex_billing_webhook_events")
      .withIndex("by_event_id", (q) => q.eq("eventId", args.eventId))
      .first();

    if (existing !== null) {
      return existing._id;
    }

    return await ctx.db.insert("vortex_billing_webhook_events", {
      eventId: args.eventId,
      eventType: args.eventType,
      processedAt: Date.now(),
    });
  },
});

export const cleanupOldEvents = internalMutation({
  args: {},
  handler: async (ctx): Promise<{ deleted: number }> => {
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const oldEvents = await ctx.db
      .query("vortex_billing_webhook_events")
      .withIndex("by_processed_at", (q) => q.lt("processedAt", sevenDaysAgo))
      .take(100);

    for (const event of oldEvents) {
      await ctx.db.delete(event._id);
    }

    return { deleted: oldEvents.length };
  },
});
