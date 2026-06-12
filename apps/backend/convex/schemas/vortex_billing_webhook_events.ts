import { defineTable } from "convex/server";
import { v } from "convex/values";

export const vortexBillingWebhookEventsTable = defineTable({
  eventId: v.string(),
  eventType: v.string(),
  processedAt: v.number(),
})
  .index("by_event_id", ["eventId"])
  .index("by_processed_at", ["processedAt"]);
