/**
 * @fileoverview Webhook event publisher.
 *
 * Provides `publishWebhookEvent` — a helper that creates delivery records
 * for all active endpoints subscribed to a given event type.
 *
 * Called from mutations when domain events occur (document.sent, recipient.signed, etc.).
 * The actual HTTP delivery is handled asynchronously by the `processWebhookDeliveries` cron.
 *
 * @module webhooks/publish
 */

import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import type { WebhookEventType } from "../schemas/webhooks";

/**
 * Generates a unique event ID in the format `evt_{timestamp}_{random}`.
 */
function generateEventId(): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).slice(2, 10);
  return `evt_${timestamp}_${random}`;
}

/**
 * Publish a webhook event to all active endpoints subscribed to the event type.
 *
 * Creates a `webhook_deliveries` record for each matching endpoint.
 * The cron-triggered delivery action will process these asynchronously.
 *
 * @param ctx - Mutation context (needs db access)
 * @param params.organizationId - Organization that owns the event
 * @param params.eventType - The event type (e.g., "document.sent")
 * @param params.data - Event-specific payload data
 * @returns Number of delivery records created
 *
 * @example
 * ```ts
 * await publishWebhookEvent(ctx, {
 *   organizationId: document.organizationId,
 *   eventType: "document.sent",
 *   data: {
 *     document_id: document._id,
 *     document_title: document.title,
 *     sent_at: new Date().toISOString(),
 *   },
 * });
 * ```
 */
export async function publishWebhookEvent(
  ctx: Pick<MutationCtx, "db">,
  params: {
    organizationId: Id<"organizations">;
    eventType: WebhookEventType;
    data: Record<string, unknown>;
  }
): Promise<number> {
  // Get all active endpoints for this organization
  const endpoints = await ctx.db
    .query("webhook_endpoints")
    .withIndex("by_organization_status", (q) =>
      q.eq("organizationId", params.organizationId).eq("status", "active")
    )
    .collect();

  if (endpoints.length === 0) return 0;

  const eventId = generateEventId();
  const now = Date.now();

  const payload = JSON.stringify({
    id: eventId,
    type: params.eventType,
    api_version: "2025-01-01",
    created_at: new Date(now).toISOString(),
    organization_id: params.organizationId,
    data: params.data,
  });

  let created = 0;

  for (const endpoint of endpoints) {
    // Check if endpoint subscribes to this event type
    // Empty events array means "all events"
    if (
      endpoint.events.length > 0 &&
      !endpoint.events.includes(params.eventType)
    ) {
      continue;
    }

    await ctx.db.insert("webhook_deliveries", {
      endpointId: endpoint._id,
      organizationId: params.organizationId,
      eventId,
      eventType: params.eventType,
      payload,
      status: "pending",
      attemptCount: 0,
      createdAt: now,
    });

    created++;
  }

  return created;
}
