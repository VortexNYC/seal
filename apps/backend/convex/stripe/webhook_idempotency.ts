import { v } from "convex/values";

import { internalMutation, internalQuery } from "../_generated/server";

/**
 * Webhook Idempotency Helpers
 *
 * Prevents duplicate processing of Stripe webhook events.
 * Stripe may retry webhooks, so we track event IDs to avoid processing twice.
 *
 * SEA-170: Stripe Connect Implementation
 */

/**
 * Check if a webhook event has already been processed
 */
export const isEventProcessed = internalQuery({
  args: {
    eventId: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("stripe_webhook_events")
      .withIndex("by_event_id", (q) => q.eq("eventId", args.eventId))
      .first();

    return !!existing;
  },
});

/**
 * Mark a webhook event as processed
 */
export const markEventProcessed = internalMutation({
  args: {
    eventId: v.string(),
    eventType: v.string(),
    source: v.union(v.literal("connect"), v.literal("main")),
  },
  handler: async (ctx, args) => {
    // Double-check to handle race conditions
    const existing = await ctx.db
      .query("stripe_webhook_events")
      .withIndex("by_event_id", (q) => q.eq("eventId", args.eventId))
      .first();

    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("stripe_webhook_events", {
      eventId: args.eventId,
      eventType: args.eventType,
      source: args.source,
      processedAt: Date.now(),
    });
  },
});

/**
 * Clean up old webhook events (older than 7 days)
 * Can be called from a cron job to prevent table bloat
 */
export const cleanupOldEvents = internalMutation({
  args: {},
  handler: async (ctx) => {
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    const oldEvents = await ctx.db
      .query("stripe_webhook_events")
      .withIndex("by_processed_at", (q) => q.lt("processedAt", sevenDaysAgo))
      .take(100); // Process in batches

    for (const event of oldEvents) {
      await ctx.db.delete(event._id);
    }

    return { deleted: oldEvents.length };
  },
});
