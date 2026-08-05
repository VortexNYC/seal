/**
 * Core-shaped webhook FunctionReferences for VortexWebhookSettingsSurface.
 * Adapts Seal's webhook_endpoints / webhook_deliveries tables to the CRM/Core
 * contract without rewriting delivery mechanics.
 */
import { ConvexError, v } from "convex/values";

import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { authMutation, authQuery } from "../auth";
import { ensureProFeature } from "../auth/subscription_guards";
import { WEBHOOK_EVENT_TYPES } from "../schemas/webhooks";

type SealEndpointStatus = Doc<"webhook_endpoints">["status"];
type SealDeliveryStatus = Doc<"webhook_deliveries">["status"];
type CoreEndpointStatus = "active" | "disabled" | "archived";
type CoreDeliveryStatus = "pending" | "processing" | "delivered" | "failed";

function requireIntegrationsPermission(ctx: {
  auth: { hasPermission: (permission: string) => boolean };
}): void {
  if (!ctx.auth.hasPermission("settings:integrations")) {
    throw new ConvexError({
      code: "FORBIDDEN",
      message: "Insufficient permissions: settings:integrations required",
      permission: "settings:integrations",
    });
  }
}

function generateSecret(length: number): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  const randomValues = new Uint8Array(length);
  crypto.getRandomValues(randomValues);
  for (let i = 0; i < length; i++) {
    const randomValue = randomValues[i];
    if (randomValue !== undefined) {
      result += chars[randomValue % chars.length];
    }
  }
  return result;
}

async function hashSecret(secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(secret);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function mapEndpointStatus(status: SealEndpointStatus): CoreEndpointStatus {
  if (status === "paused") {
    return "archived";
  }
  return status;
}

function mapDeliveryStatus(status: SealDeliveryStatus): CoreDeliveryStatus {
  if (status === "abandoned") {
    return "failed";
  }
  return status;
}

function deriveEndpointName(
  url: string,
  description: string | undefined
): string {
  if (description !== undefined && description.trim().length > 0) {
    return description.trim().slice(0, 100);
  }
  try {
    return new URL(url).hostname.slice(0, 100);
  } catch {
    return "Webhook endpoint";
  }
}

function validateHttpsUrl(urlValue: string): void {
  try {
    const url = new URL(urlValue);
    if (url.protocol !== "https:") {
      throw new ConvexError({
        code: "VALIDATION_ERROR",
        message: "Webhook URL must use HTTPS",
      });
    }
  } catch (error) {
    if (error instanceof ConvexError) {
      throw error;
    }
    throw new ConvexError({
      code: "VALIDATION_ERROR",
      message: "Invalid URL format",
    });
  }
}

function validateEvents(events: string[]): void {
  const validEvents = new Set<string>(WEBHOOK_EVENT_TYPES);
  for (const event of events) {
    if (!validEvents.has(event)) {
      throw new ConvexError({
        code: "VALIDATION_ERROR",
        message: `Invalid event type: ${event}`,
      });
    }
  }
}

async function requireOrgEndpoint(
  ctx: {
    db: {
      get: (
        id: Id<"webhook_endpoints">
      ) => Promise<Doc<"webhook_endpoints"> | null>;
    };
    auth: { organizationId: Id<"organizations"> };
  },
  endpointId: Id<"webhook_endpoints">
): Promise<Doc<"webhook_endpoints">> {
  const endpoint = await ctx.db.get(endpointId);
  if (!endpoint || endpoint.organizationId !== ctx.auth.organizationId) {
    throw new ConvexError({
      code: "NOT_FOUND",
      message: "Webhook endpoint not found",
    });
  }
  return endpoint;
}

function toEndpointListItem(endpoint: Doc<"webhook_endpoints">): {
  _id: Id<"webhook_endpoints">;
  url: string;
  description?: string;
  status: CoreEndpointStatus;
  events: readonly (typeof WEBHOOK_EVENT_TYPES)[number][];
  secretPreview: string;
  createdAt: number;
  updatedAt: number;
} {
  return {
    _id: endpoint._id,
    url: endpoint.url,
    description: endpoint.description ?? endpoint.name,
    status: mapEndpointStatus(endpoint.status),
    events: endpoint.events.filter(
      (event): event is (typeof WEBHOOK_EVENT_TYPES)[number] =>
        (WEBHOOK_EVENT_TYPES as readonly string[]).includes(event)
    ),
    secretPreview: `${endpoint.secretPrefix}...`,
    createdAt: endpoint.createdAt,
    updatedAt: endpoint.updatedAt,
  };
}

async function toDeliveryListItem(
  ctx: {
    db: {
      get: (
        id: Id<"webhook_endpoints">
      ) => Promise<Doc<"webhook_endpoints"> | null>;
    };
  },
  delivery: Doc<"webhook_deliveries">
) {
  const endpoint = await ctx.db.get(delivery.endpointId);
  return {
    _id: delivery._id,
    endpointId: delivery.endpointId,
    organizationId: delivery.organizationId,
    eventId: delivery.eventId,
    eventType: delivery.eventType,
    payload: delivery.payload,
    status: mapDeliveryStatus(delivery.status),
    attemptCount: delivery.attemptCount,
    nextAttemptAt: delivery.nextRetryAt,
    lastAttemptAt: undefined,
    deliveredAt: delivery.deliveredAt,
    exhaustedAt:
      delivery.status === "abandoned" ? delivery.createdAt : undefined,
    responseStatus: delivery.responseCode,
    responseBody: delivery.responseBody ?? delivery.errorMessage,
    failureKind:
      delivery.status === "abandoned" || delivery.status === "failed"
        ? ("unknown_error" as const)
        : undefined,
    createdAt: delivery.createdAt,
    updatedAt: delivery.deliveredAt ?? delivery.createdAt,
    endpointUrl: endpoint?.url,
    endpointDescription: endpoint?.description ?? endpoint?.name,
  };
}

/**
 * JSON webhook endpoints only (Slack Incoming Webhooks stay on the Seal Slack
 * section).
 */
export const listEndpoints = authQuery({
  args: {},
  handler: async (ctx) => {
    requireIntegrationsPermission(ctx);
    const endpoints: Doc<"webhook_endpoints">[] = [];
    for await (const endpoint of ctx.db
      .query("webhook_endpoints")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", ctx.auth.organizationId)
      )) {
      endpoints.push(endpoint);
    }

    return endpoints
      .filter((endpoint) => endpoint.format !== "slack")
      .map(toEndpointListItem);
  },
});

export const listRecentDeliveries = authQuery({
  args: {
    limit: v.optional(v.number()),
    offset: v.optional(v.number()),
    endpointId: v.optional(v.id("webhook_endpoints")),
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("processing"),
        v.literal("delivered"),
        v.literal("failed")
      )
    ),
    eventType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    requireIntegrationsPermission(ctx);
    const limit = Math.min(args.limit ?? 25, 100);
    const offset = args.offset ?? 0;
    const candidateTake = Math.min(Math.max(offset + limit + 50, 100), 500);

    const deliveries = await ctx.db
      .query("webhook_deliveries")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", ctx.auth.organizationId)
      )
      .order("desc")
      .take(candidateTake);

    const filtered = deliveries.filter((delivery) => {
      if (args.endpointId && delivery.endpointId !== args.endpointId) {
        return false;
      }
      if (args.eventType && delivery.eventType !== args.eventType) {
        return false;
      }
      if (args.status) {
        const mapped = mapDeliveryStatus(delivery.status);
        if (mapped !== args.status) {
          return false;
        }
      }
      return true;
    });

    const paged = filtered.slice(offset, offset + limit);
    const items = await Promise.all(
      paged.map((delivery) => toDeliveryListItem(ctx, delivery))
    );

    return {
      items,
      total: filtered.length,
      offset,
      limit,
      hasMore: offset + items.length < filtered.length,
    };
  },
});

export const listExhaustedDeliveries = authQuery({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    requireIntegrationsPermission(ctx);
    const limit = Math.min(args.limit ?? 10, 50);
    const deliveries = await ctx.db
      .query("webhook_deliveries")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", ctx.auth.organizationId)
      )
      .order("desc")
      .take(200);

    const exhausted = deliveries
      .filter((delivery) => delivery.status === "abandoned")
      .slice(0, limit);

    return await Promise.all(
      exhausted.map((delivery) => toDeliveryListItem(ctx, delivery))
    );
  },
});

export const createEndpoint = authMutation({
  args: {
    url: v.string(),
    description: v.optional(v.string()),
    events: v.array(v.string()),
    requestId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    requireIntegrationsPermission(ctx);
    validateHttpsUrl(args.url);
    validateEvents(args.events);
    await ensureProFeature(
      ctx.db,
      ctx.auth.organizationId,
      "Webhook endpoints"
    );

    const existingEndpoints = await ctx.db
      .query("webhook_endpoints")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", ctx.auth.organizationId)
      )
      .collect();

    if (existingEndpoints.length >= 10) {
      throw new ConvexError({
        code: "LIMIT_EXCEEDED",
        message: "Maximum of 10 webhook endpoints per organization",
      });
    }

    const secret = `whsec_${generateSecret(32)}`;
    const secretHash = await hashSecret(secret);
    const secretPrefix = secret.slice(0, 12);
    const now = Date.now();
    const name = deriveEndpointName(args.url, args.description);

    await ctx.db.insert("webhook_endpoints", {
      organizationId: ctx.auth.organizationId,
      name,
      url: args.url,
      secretHash,
      secret,
      secretPrefix,
      events: args.events,
      status: "active",
      description: args.description,
      failureCount: 0,
      createdBy: ctx.auth.userId,
      createdAt: now,
      updatedAt: now,
    });

    return { secret };
  },
});

export const updateEndpoint = authMutation({
  args: {
    endpointId: v.string(),
    url: v.string(),
    description: v.optional(v.string()),
    events: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    requireIntegrationsPermission(ctx);
    const endpointId = ctx.db.normalizeId("webhook_endpoints", args.endpointId);
    if (!endpointId) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Webhook endpoint not found",
      });
    }
    const endpoint = await requireOrgEndpoint(ctx, endpointId);
    validateHttpsUrl(args.url);
    validateEvents(args.events);

    await ctx.db.patch(endpointId, {
      url: args.url,
      events: args.events,
      description: args.description,
      name: deriveEndpointName(args.url, args.description ?? endpoint.name),
      updatedAt: Date.now(),
    });

    return { ok: true };
  },
});

export const rotateEndpointSecret = authMutation({
  args: {
    endpointId: v.string(),
  },
  handler: async (ctx, args) => {
    requireIntegrationsPermission(ctx);
    const endpointId = ctx.db.normalizeId("webhook_endpoints", args.endpointId);
    if (!endpointId) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Webhook endpoint not found",
      });
    }
    await requireOrgEndpoint(ctx, endpointId);

    const secret = `whsec_${generateSecret(32)}`;
    const secretHash = await hashSecret(secret);
    const secretPrefix = secret.slice(0, 12);

    await ctx.db.patch(endpointId, {
      secretHash,
      secret,
      secretPrefix,
      updatedAt: Date.now(),
    });

    return { secret };
  },
});

export const archiveEndpoint = authMutation({
  args: {
    endpointId: v.string(),
  },
  handler: async (ctx, args) => {
    requireIntegrationsPermission(ctx);
    const endpointId = ctx.db.normalizeId("webhook_endpoints", args.endpointId);
    if (!endpointId) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Webhook endpoint not found",
      });
    }
    const endpoint = await requireOrgEndpoint(ctx, endpointId);
    if (endpoint.status === "paused") {
      return { ok: true };
    }
    await ctx.db.patch(endpointId, {
      status: "paused",
      updatedAt: Date.now(),
    });
    return { ok: true };
  },
});

export const disableEndpoint = authMutation({
  args: {
    endpointId: v.string(),
  },
  handler: async (ctx, args) => {
    requireIntegrationsPermission(ctx);
    const endpointId = ctx.db.normalizeId("webhook_endpoints", args.endpointId);
    if (!endpointId) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Webhook endpoint not found",
      });
    }
    const endpoint = await requireOrgEndpoint(ctx, endpointId);
    if (endpoint.status === "disabled") {
      return { ok: true };
    }
    await ctx.db.patch(endpointId, {
      status: "disabled",
      updatedAt: Date.now(),
    });
    return { ok: true };
  },
});

export const removeEndpoint = authMutation({
  args: {
    endpointId: v.string(),
  },
  handler: async (ctx, args) => {
    requireIntegrationsPermission(ctx);
    const endpointId = ctx.db.normalizeId("webhook_endpoints", args.endpointId);
    if (!endpointId) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Webhook endpoint not found",
      });
    }
    const endpoint = await requireOrgEndpoint(ctx, endpointId);
    if (endpoint.status !== "paused") {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Webhook endpoint must be archived before deletion",
      });
    }

    const deliveries = await ctx.db
      .query("webhook_deliveries")
      .withIndex("by_endpoint", (q) => q.eq("endpointId", endpointId))
      .collect();

    for (const delivery of deliveries) {
      await ctx.db.delete(delivery._id);
    }
    await ctx.db.delete(endpointId);
    return { ok: true };
  },
});

export const sendTest = authMutation({
  args: {
    endpointId: v.string(),
    requestId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    requireIntegrationsPermission(ctx);
    const endpointId = ctx.db.normalizeId("webhook_endpoints", args.endpointId);
    if (!endpointId) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Webhook endpoint not found",
      });
    }
    const endpoint = await requireOrgEndpoint(ctx, endpointId);
    if (endpoint.status !== "active") {
      throw new ConvexError({
        code: "BAD_REQUEST",
        message: "Webhook endpoint must be active to send a test",
      });
    }

    const eventId = args.requestId
      ? `evt_test_${args.requestId}`
      : `evt_test_${Date.now()}_${generateSecret(8)}`;
    const payload = {
      id: eventId,
      type: "test.ping",
      api_version: "2025-01-01",
      created_at: new Date().toISOString(),
      organization_id: ctx.auth.organizationId,
      data: {
        message: "This is a test webhook from Seal",
        endpoint_id: endpointId,
        endpoint_name: endpoint.name,
      },
    };

    await ctx.db.insert("webhook_deliveries", {
      endpointId,
      organizationId: ctx.auth.organizationId,
      eventId,
      eventType: "test.ping",
      payload: JSON.stringify(payload),
      status: "pending",
      attemptCount: 0,
      createdAt: Date.now(),
    });

    await ctx.scheduler.runAfter(
      0,
      internal.webhooks.delivery.processWebhookDeliveries,
      {}
    );

    return { ok: true };
  },
});

export const retryDelivery = authMutation({
  args: {
    deliveryId: v.string(),
  },
  handler: async (ctx, args) => {
    requireIntegrationsPermission(ctx);
    const deliveryId = ctx.db.normalizeId(
      "webhook_deliveries",
      args.deliveryId
    );
    if (!deliveryId) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Delivery not found",
      });
    }
    const delivery = await ctx.db.get(deliveryId);
    if (!delivery || delivery.organizationId !== ctx.auth.organizationId) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Delivery not found",
      });
    }
    if (delivery.status === "delivered") {
      throw new ConvexError({
        code: "INVALID_STATE",
        message: "Cannot retry a delivered webhook",
      });
    }

    await ctx.db.patch(deliveryId, {
      status: "pending",
      nextRetryAt: Date.now(),
      errorMessage: undefined,
    });

    await ctx.scheduler.runAfter(
      0,
      internal.webhooks.delivery.processWebhookDeliveries,
      {}
    );

    return { ok: true };
  },
});

export const triggerProcessing = authMutation({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx) => {
    requireIntegrationsPermission(ctx);
    await ctx.scheduler.runAfter(
      0,
      internal.webhooks.delivery.processWebhookDeliveries,
      {}
    );
    return { ok: true };
  },
});
