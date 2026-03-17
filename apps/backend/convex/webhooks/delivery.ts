/**
 * @fileoverview Webhook HTTP delivery action with HMAC-SHA256 signing and retry logic.
 *
 * Architecture:
 * - `processWebhookDeliveries` (internalAction): Cron-triggered, fetches pending deliveries,
 *   makes HTTP requests with HMAC-SHA256 signatures, updates delivery status.
 * - `getPendingDeliveries` (internalQuery): Fetches deliveries ready for processing.
 * - `updateDeliveryResult` (internalMutation): Records delivery outcome.
 * - `updateEndpointStatus` (internalMutation): Tracks endpoint success/failure counts.
 *
 * Retry strategy: Exponential backoff — 30s, 2m, 10m, 30m, 2h (5 attempts max).
 * After 5 failures, delivery is marked "abandoned".
 * After 10 consecutive endpoint failures, endpoint is auto-disabled.
 *
 * @module webhooks/delivery
 */

import { v } from "convex/values";

import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import {
  type ActionCtx,
  internalAction,
  internalMutation,
  internalQuery,
} from "../_generated/server";
import { getSubscriptionPlan } from "../auth/subscription_guards";
import { formatSlackMessage } from "./slack_formatter";

/** Maximum delivery attempts before abandoning */
const MAX_ATTEMPTS = 5;

/** Consecutive endpoint failures before auto-disabling */
const MAX_ENDPOINT_FAILURES = 10;

/** HTTP request timeout in milliseconds */
const REQUEST_TIMEOUT_MS = 15_000;

/** Retry backoff intervals in milliseconds: 30s, 2m, 10m, 30m, 2h */
const RETRY_INTERVALS = [
  30 * 1000,
  2 * 60 * 1000,
  10 * 60 * 1000,
  30 * 60 * 1000,
  2 * 60 * 60 * 1000,
];

type DeliveryProcessingResult = {
  delivered: boolean;
};

/**
 * Generate HMAC-SHA256 signature for a webhook payload.
 *
 * Signature format matches industry standard (Stripe, Svix):
 * `v1=<hex-encoded-hmac>`
 *
 * The signed content is: `{eventId}.{timestamp}.{payload}`
 */
async function signPayload(
  secret: string,
  eventId: string,
  timestamp: number,
  payload: string,
): Promise<string> {
  const encoder = new TextEncoder();
  const signedContent = `${eventId}.${timestamp}.${payload}`;

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(signedContent));
  const hexSignature = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return `v1=${hexSignature}`;
}

function getNextRetryAt(attemptCount: number): number | undefined {
  if (attemptCount >= MAX_ATTEMPTS) {
    return undefined;
  }

  return (
    Date.now() + (RETRY_INTERVALS[attemptCount - 1] ?? RETRY_INTERVALS[RETRY_INTERVALS.length - 1]!)
  );
}

async function getResponseBody(response: Response): Promise<string | undefined> {
  try {
    const text = await response.text();
    return text.slice(0, 1024);
  } catch {
    return undefined;
  }
}

async function markDeliveryInactiveEndpoint(
  ctx: ActionCtx,
  delivery: Doc<"webhook_deliveries">,
  endpoint: Doc<"webhook_endpoints"> | null,
  attemptCount: number,
): Promise<DeliveryProcessingResult> {
  await ctx.runMutation(internal.webhooks.delivery.updateDeliveryResult, {
    deliveryId: delivery._id,
    status: "abandoned",
    attemptCount,
    errorMessage: endpoint ? "Endpoint is not active" : "Endpoint was deleted",
  });

  return { delivered: false };
}

async function markSignatureFailure(
  ctx: ActionCtx,
  delivery: Doc<"webhook_deliveries">,
  attemptCount: number,
): Promise<DeliveryProcessingResult> {
  await ctx.runMutation(internal.webhooks.delivery.updateDeliveryResult, {
    deliveryId: delivery._id,
    status: "failed",
    attemptCount,
    errorMessage: "Failed to generate HMAC signature",
  });

  return { delivered: false };
}

async function markHttpDeliveryResult(
  ctx: ActionCtx,
  delivery: Doc<"webhook_deliveries">,
  endpoint: Doc<"webhook_endpoints">,
  attemptCount: number,
  response: Response,
  responseBody: string | undefined,
  responseTimeMs: number,
): Promise<DeliveryProcessingResult> {
  if (response.ok) {
    await ctx.runMutation(internal.webhooks.delivery.updateDeliveryResult, {
      deliveryId: delivery._id,
      status: "delivered",
      attemptCount,
      responseCode: response.status,
      responseBody,
      responseTimeMs,
      deliveredAt: Date.now(),
    });
    await ctx.runMutation(internal.webhooks.delivery.updateEndpointStatus, {
      endpointId: endpoint._id,
      success: true,
    });

    return { delivered: true };
  }

  const nextRetryAt = getNextRetryAt(attemptCount);
  await ctx.runMutation(internal.webhooks.delivery.updateDeliveryResult, {
    deliveryId: delivery._id,
    status: nextRetryAt ? "pending" : "abandoned",
    attemptCount,
    responseCode: response.status,
    responseBody,
    responseTimeMs,
    errorMessage: `HTTP ${response.status}: ${response.statusText}`,
    nextRetryAt,
  });
  await ctx.runMutation(internal.webhooks.delivery.updateEndpointStatus, {
    endpointId: endpoint._id,
    success: false,
  });

  return { delivered: false };
}

async function markNetworkFailure(
  ctx: ActionCtx,
  delivery: Doc<"webhook_deliveries">,
  endpoint: Doc<"webhook_endpoints">,
  attemptCount: number,
  responseTimeMs: number,
  error: unknown,
): Promise<DeliveryProcessingResult> {
  const nextRetryAt = getNextRetryAt(attemptCount);
  const errorMessage =
    error instanceof Error
      ? error.name === "AbortError"
        ? `Request timed out after ${REQUEST_TIMEOUT_MS}ms`
        : error.message
      : "Unknown network error";

  await ctx.runMutation(internal.webhooks.delivery.updateDeliveryResult, {
    deliveryId: delivery._id,
    status: nextRetryAt ? "pending" : "abandoned",
    attemptCount,
    responseTimeMs,
    errorMessage,
    nextRetryAt,
  });
  await ctx.runMutation(internal.webhooks.delivery.updateEndpointStatus, {
    endpointId: endpoint._id,
    success: false,
  });

  return { delivered: false };
}

async function deliverJsonWebhook(
  ctx: ActionCtx,
  delivery: Doc<"webhook_deliveries">,
  endpoint: Doc<"webhook_endpoints">,
  attemptCount: number,
): Promise<DeliveryProcessingResult> {
  const timestamp = Math.floor(Date.now() / 1000);
  let signature: string;

  try {
    signature = await signPayload(endpoint.secret, delivery.eventId, timestamp, delivery.payload);
  } catch {
    return markSignatureFailure(ctx, delivery, attemptCount);
  }

  const startTime = Date.now();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    const response = await fetch(endpoint.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Seal-Webhooks/1.0",
        "X-Seal-Event": delivery.eventType,
        "X-Seal-Event-Id": delivery.eventId,
        "X-Seal-Timestamp": String(timestamp),
        "X-Seal-Signature": signature,
      },
      body: delivery.payload,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const responseTimeMs = Date.now() - startTime;
    const responseBody = await getResponseBody(response);

    return markHttpDeliveryResult(
      ctx,
      delivery,
      endpoint,
      attemptCount,
      response,
      responseBody,
      responseTimeMs,
    );
  } catch (error) {
    return markNetworkFailure(ctx, delivery, endpoint, attemptCount, Date.now() - startTime, error);
  }
}

async function deliverSlackWebhook(
  ctx: ActionCtx,
  delivery: Doc<"webhook_deliveries">,
  endpoint: Doc<"webhook_endpoints">,
  attemptCount: number,
): Promise<DeliveryProcessingResult> {
  const parsed = JSON.parse(delivery.payload) as {
    id: string;
    type: string;
    api_version: string;
    created_at: string;
    organization_id: string;
    data: Record<string, unknown>;
  };
  const slackBody = JSON.stringify(formatSlackMessage(parsed));

  const startTime = Date.now();

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    const response = await fetch(endpoint.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Seal-Webhooks/1.0",
      },
      body: slackBody,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const responseTimeMs = Date.now() - startTime;
    const responseBody = await getResponseBody(response);

    return markHttpDeliveryResult(
      ctx,
      delivery,
      endpoint,
      attemptCount,
      response,
      responseBody,
      responseTimeMs,
    );
  } catch (error) {
    return markNetworkFailure(ctx, delivery, endpoint, attemptCount, Date.now() - startTime, error);
  }
}

async function deliverWebhook(
  ctx: ActionCtx,
  delivery: Doc<"webhook_deliveries">,
  endpoint: Doc<"webhook_endpoints">,
  attemptCount: number,
): Promise<DeliveryProcessingResult> {
  if (endpoint.format === "slack") {
    return deliverSlackWebhook(ctx, delivery, endpoint, attemptCount);
  }
  return deliverJsonWebhook(ctx, delivery, endpoint, attemptCount);
}

async function markDeliverySuspended(
  ctx: ActionCtx,
  delivery: Doc<"webhook_deliveries">,
  attemptCount: number,
): Promise<DeliveryProcessingResult> {
  await ctx.runMutation(internal.webhooks.delivery.updateDeliveryResult, {
    deliveryId: delivery._id,
    status: "abandoned",
    attemptCount,
    errorMessage: "Webhooks suspended — organization on Free tier",
  });

  console.warn(
    JSON.stringify({
      topic: "webhook_delivery",
      event: "delivery_suspended_free_tier",
      deliveryId: delivery._id,
      organizationId: delivery.organizationId,
      eventType: delivery.eventType,
      timestamp: Date.now(),
    }),
  );

  return { delivered: false };
}

async function processPendingDelivery(
  ctx: ActionCtx,
  delivery: Doc<"webhook_deliveries">,
): Promise<DeliveryProcessingResult> {
  const attemptCount = delivery.attemptCount + 1;
  const endpoint = await ctx.runQuery(internal.webhooks.delivery.getEndpointById, {
    endpointId: delivery.endpointId,
  });

  if (!endpoint || endpoint.status !== "active") {
    return markDeliveryInactiveEndpoint(ctx, delivery, endpoint, attemptCount);
  }

  // Check org tier — Free tier orgs have webhooks suspended
  const orgTier = await ctx.runQuery(internal.webhooks.delivery.getOrgTier, {
    organizationId: delivery.organizationId,
  });
  if (orgTier === "free") {
    return markDeliverySuspended(ctx, delivery, attemptCount);
  }

  return deliverWebhook(ctx, delivery, endpoint, attemptCount);
}

/**
 * Fetch pending webhook deliveries that are ready for processing.
 * Returns deliveries where status is "pending" and nextRetryAt <= now (or null for first attempt).
 */
export const getPendingDeliveries = internalQuery({
  args: {},
  handler: async (ctx): Promise<Doc<"webhook_deliveries">[]> => {
    const now = Date.now();

    // Get pending deliveries that are ready (first attempt or retry time reached)
    const deliveries = await ctx.db
      .query("webhook_deliveries")
      .withIndex("by_status_next_retry", (q) => q.eq("status", "pending"))
      .collect();

    // Filter to deliveries that are ready to be processed
    return deliveries.filter((d) => !d.nextRetryAt || d.nextRetryAt <= now).slice(0, 50);
  },
});

/**
 * Update a delivery record with the result of a delivery attempt.
 */
export const updateDeliveryResult = internalMutation({
  args: {
    deliveryId: v.id("webhook_deliveries"),
    status: v.union(
      v.literal("pending"),
      v.literal("delivered"),
      v.literal("failed"),
      v.literal("abandoned"),
    ),
    attemptCount: v.number(),
    responseCode: v.optional(v.number()),
    responseBody: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
    responseTimeMs: v.optional(v.number()),
    nextRetryAt: v.optional(v.number()),
    deliveredAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { deliveryId, ...updates } = args;
    await ctx.db.patch(deliveryId, updates);
  },
});

/**
 * Update an endpoint's status based on delivery results.
 * Increments failure count on failure, resets on success.
 * Auto-disables endpoint after MAX_ENDPOINT_FAILURES consecutive failures.
 */
export const updateEndpointStatus = internalMutation({
  args: {
    endpointId: v.id("webhook_endpoints"),
    success: v.boolean(),
  },
  handler: async (ctx, args) => {
    const endpoint = await ctx.db.get(args.endpointId);
    if (!endpoint) return;

    const now = Date.now();

    if (args.success) {
      await ctx.db.patch(args.endpointId, {
        failureCount: 0,
        lastSuccessAt: now,
        lastAttemptAt: now,
        updatedAt: now,
      });
    } else {
      const newFailureCount = endpoint.failureCount + 1;
      const shouldDisable = newFailureCount >= MAX_ENDPOINT_FAILURES;

      await ctx.db.patch(args.endpointId, {
        failureCount: newFailureCount,
        lastAttemptAt: now,
        updatedAt: now,
        ...(shouldDisable ? { status: "disabled" as const } : {}),
      });
    }
  },
});

/**
 * Process pending webhook deliveries.
 * Called by cron every minute. Fetches pending deliveries, sends HTTP requests
 * with HMAC-SHA256 signatures, and updates delivery/endpoint status.
 */
export const processWebhookDeliveries = internalAction({
  args: {},
  handler: async (ctx): Promise<{ processed: number; delivered: number; failed: number }> => {
    const pendingDeliveries: Doc<"webhook_deliveries">[] = await ctx.runQuery(
      internal.webhooks.delivery.getPendingDeliveries,
      {},
    );

    let processed = 0;
    let delivered = 0;
    let failed = 0;

    for (const delivery of pendingDeliveries) {
      processed++;
      const result = await processPendingDelivery(ctx, delivery);
      if (result.delivered) {
        delivered++;
      } else {
        failed++;
      }
    }

    return { processed, delivered, failed };
  },
});

/**
 * Get a webhook endpoint by ID (internal query for the delivery action).
 */
export const getEndpointById = internalQuery({
  args: {
    endpointId: v.id("webhook_endpoints"),
  },
  handler: async (ctx, args): Promise<Doc<"webhook_endpoints"> | null> => {
    return await ctx.db.get(args.endpointId);
  },
});

/**
 * Get an organization's subscription tier (internal query for the delivery action).
 * Returns "free" | "pro" | "enterprise".
 */
export const getOrgTier = internalQuery({
  args: {
    organizationId: v.id("organizations"),
  },
  handler: async (ctx, args): Promise<string> => {
    const { plan } = await getSubscriptionPlan(ctx.db, args.organizationId);
    return plan;
  },
});
