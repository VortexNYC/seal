import { defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Stripe Webhook Events Table
 *
 * Tracks processed webhook event IDs for idempotency.
 * Prevents duplicate processing when Stripe retries webhooks.
 *
 * SEA-170: Stripe Connect Implementation
 */
export const stripeWebhookEventsTable = defineTable({
  // Stripe event ID (e.g., "evt_1234...")
  eventId: v.string(),
  // Event type for debugging/analytics (e.g., "account.updated")
  eventType: v.string(),
  // When the event was processed
  processedAt: v.number(),
  // Which webhook endpoint received it ("connect" or "main")
  source: v.union(v.literal("connect"), v.literal("main")),
})
  .index("by_event_id", ["eventId"])
  .index("by_processed_at", ["processedAt"]);
