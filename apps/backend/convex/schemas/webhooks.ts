/**
 * @fileoverview Database schemas for outbound webhook configuration.
 * Stores webhook endpoints, event subscriptions, and delivery tracking.
 *
 * @module schemas/webhooks
 */

import { defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * All available webhook event types.
 * Events follow the pattern: resource.action
 */
export const WEBHOOK_EVENT_TYPES = [
  // Document lifecycle events
  "document.created",
  "document.sent",
  "document.viewed",
  "document.completed",
  "document.voided",
  "document.expired",
  "document.declined",

  // Recipient events
  "recipient.added",
  "recipient.viewed",
  "recipient.signed",
  "recipient.approved",
  "recipient.declined",
  "recipient.reminded",

  // Template events
  "template.created",
  "template.updated",
  "template.used",
] as const;

export type WebhookEventType = (typeof WEBHOOK_EVENT_TYPES)[number];

/**
 * Webhook endpoint status values.
 */
export const WEBHOOK_ENDPOINT_STATUS = ["active", "paused", "disabled"] as const;

export type WebhookEndpointStatus = (typeof WEBHOOK_ENDPOINT_STATUS)[number];

/**
 * Webhook delivery status values.
 */
export const WEBHOOK_DELIVERY_STATUS = ["pending", "delivered", "failed", "abandoned"] as const;

export type WebhookDeliveryStatus = (typeof WEBHOOK_DELIVERY_STATUS)[number];

/**
 * Webhook endpoint configuration.
 * Each organization can have multiple webhook endpoints.
 *
 * @table webhook_endpoints
 * @index by_organization - Query endpoints by organization
 * @index by_status - Query active/paused endpoints
 */
export const webhookEndpoints = defineTable({
  /**
   * Organization that owns this webhook endpoint.
   */
  organizationId: v.id("organizations"),

  /**
   * User-friendly name for this endpoint.
   * @maxLength 100
   */
  name: v.string(),

  /**
   * HTTPS URL where webhook payloads will be delivered.
   * Must be HTTPS in production.
   */
  url: v.string(),

  /**
   * Secret key for HMAC-SHA256 signature generation.
   * Used by recipients to verify webhook authenticity.
   * Stored hashed, original provided once at creation.
   */
  secretHash: v.string(),

  /**
   * First 8 characters of the secret for identification.
   * Displayed in UI as "whsec_xxxx..."
   */
  secretPrefix: v.string(),

  /**
   * Event types this endpoint subscribes to.
   * Empty array means all events.
   */
  events: v.array(v.string()),

  /**
   * Endpoint status.
   * - active: Receiving webhooks
   * - paused: Temporarily disabled by user
   * - disabled: Disabled due to repeated failures
   */
  status: v.union(v.literal("active"), v.literal("paused"), v.literal("disabled")),

  /**
   * Optional description for this endpoint.
   */
  description: v.optional(v.string()),

  /**
   * Consecutive delivery failure count.
   * Endpoint is disabled after 10 consecutive failures.
   */
  failureCount: v.number(),

  /**
   * Timestamp of last successful delivery.
   */
  lastSuccessAt: v.optional(v.number()),

  /**
   * Timestamp of last delivery attempt.
   */
  lastAttemptAt: v.optional(v.number()),

  /**
   * User who created this endpoint.
   */
  createdBy: v.id("users"),

  /**
   * Creation timestamp.
   */
  createdAt: v.number(),

  /**
   * Last update timestamp.
   */
  updatedAt: v.number(),
})
  .index("by_organization", ["organizationId"])
  .index("by_organization_status", ["organizationId", "status"]);

/**
 * Individual webhook delivery record.
 * Tracks each delivery attempt for debugging and retry logic.
 *
 * @table webhook_deliveries
 * @index by_endpoint - Query deliveries by endpoint
 * @index by_event_id - Query by event ID for debugging
 * @index by_status_next_retry - Query pending deliveries for retry
 */
export const webhookDeliveries = defineTable({
  /**
   * The endpoint this delivery is for.
   */
  endpointId: v.id("webhook_endpoints"),

  /**
   * Organization for efficient querying.
   */
  organizationId: v.id("organizations"),

  /**
   * Unique event identifier (for deduplication).
   * Format: evt_{timestamp}_{random}
   */
  eventId: v.string(),

  /**
   * Event type (e.g., "document.sent", "recipient.signed").
   */
  eventType: v.string(),

  /**
   * Full webhook payload (JSON string).
   */
  payload: v.string(),

  /**
   * Delivery status.
   */
  status: v.union(
    v.literal("pending"),
    v.literal("delivered"),
    v.literal("failed"),
    v.literal("abandoned"),
  ),

  /**
   * Number of delivery attempts made.
   */
  attemptCount: v.number(),

  /**
   * Next scheduled retry time (if pending).
   */
  nextRetryAt: v.optional(v.number()),

  /**
   * HTTP response code from last attempt.
   */
  responseCode: v.optional(v.number()),

  /**
   * Response body from last attempt (truncated).
   */
  responseBody: v.optional(v.string()),

  /**
   * Error message from last failed attempt.
   */
  errorMessage: v.optional(v.string()),

  /**
   * Response time in milliseconds.
   */
  responseTimeMs: v.optional(v.number()),

  /**
   * Timestamp when event was created.
   */
  createdAt: v.number(),

  /**
   * Timestamp of successful delivery.
   */
  deliveredAt: v.optional(v.number()),
})
  .index("by_endpoint", ["endpointId"])
  .index("by_endpoint_created", ["endpointId", "createdAt"])
  .index("by_event_id", ["eventId"])
  .index("by_status_next_retry", ["status", "nextRetryAt"])
  .index("by_organization", ["organizationId"]);
