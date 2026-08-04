/**
 * @fileoverview Webhooks Management REST API internal queries and handlers.
 * Manages webhook endpoints configuration via the public API.
 *
 * @module api/v1/webhooks
 * @requires seal:webhooks:manage scope for all operations
 */

import { v } from "convex/values";

import { internalMutation, internalQuery } from "../../_generated/server";
import { WEBHOOK_EVENT_TYPES } from "../../schemas/webhooks";

/**
 * API webhook endpoint response format.
 */
export interface ApiWebhookEndpoint {
  /** Unique endpoint identifier */
  id: string;
  /** User-friendly name */
  name: string;
  /** HTTPS URL for webhook delivery */
  url: string;
  /** Endpoint status */
  status: "active" | "paused" | "disabled";
  /** Event types subscribed to (empty = all) */
  events: string[];
  /** Optional description */
  description?: string;
  /** Secret prefix for identification */
  secret_prefix: string;
  /** ISO 8601 creation timestamp */
  created_at: string;
  /** ISO 8601 last update timestamp */
  updated_at: string;
  /** Delivery statistics */
  stats: {
    total_deliveries: number;
    successful: number;
    failed: number;
    success_rate: number;
  };
}

type UpdateEndpointArgs = {
  name?: string;
  url?: string;
  events?: string[];
  description?: string;
  status?: "active" | "paused" | "disabled";
};

type UpdateEndpointResult = { success: boolean; error?: string };

function applyEndpointNameUpdate(
  updates: Record<string, unknown>,
  name: string | undefined
): string | null {
  if (name === undefined) {
    return null;
  }
  if (name.trim().length === 0) {
    return "Name is required";
  }
  if (name.length > 100) {
    return "Name must be 100 characters or less";
  }
  updates.name = name.trim();
  return null;
}

function applyEndpointUrlUpdate(
  updates: Record<string, unknown>,
  urlValue: string | undefined
): string | null {
  if (urlValue === undefined) {
    return null;
  }

  try {
    const url = new URL(urlValue);
    if (url.protocol !== "https:") {
      return "Webhook URL must use HTTPS";
    }
  } catch {
    return "Invalid URL format";
  }

  updates.url = urlValue;
  return null;
}

function applyEndpointEventsUpdate(
  updates: Record<string, unknown>,
  events: string[] | undefined
): string | null {
  if (events === undefined) {
    return null;
  }

  const validEvents = new Set<string>(WEBHOOK_EVENT_TYPES);
  for (const event of events) {
    if (!validEvents.has(event)) {
      return `Invalid event type: ${event}`;
    }
  }

  updates.events = events;
  return null;
}

function applyEndpointOptionalUpdates(
  updates: Record<string, unknown>,
  endpointStatus: "active" | "paused" | "disabled",
  args: UpdateEndpointArgs
): void {
  if (args.description !== undefined) {
    updates.description = args.description;
  }

  if (args.status !== undefined) {
    updates.status = args.status;
    if (args.status === "active" && endpointStatus === "disabled") {
      updates.failureCount = 0;
    }
  }
}

function buildEndpointUpdates(
  endpointStatus: "active" | "paused" | "disabled",
  args: UpdateEndpointArgs
): { updates: Record<string, unknown>; error?: string } {
  const updates: Record<string, unknown> = {
    updatedAt: Date.now(),
  };

  const error =
    applyEndpointNameUpdate(updates, args.name) ??
    applyEndpointUrlUpdate(updates, args.url) ??
    applyEndpointEventsUpdate(updates, args.events);

  if (error) {
    return { updates, error };
  }

  applyEndpointOptionalUpdates(updates, endpointStatus, args);
  return { updates };
}

/**
 * Internal query to list webhook endpoints for API.
 *
 * @internal
 */
export const listEndpoints = internalQuery({
  args: {
    userId: v.id("users"),
    organizationId: v.id("organizations"),
  },
  handler: async (ctx, args): Promise<ApiWebhookEndpoint[]> => {
    const endpoints = await ctx.db
      .query("webhook_endpoints")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId)
      )
      .collect();

    // Get delivery stats for each endpoint
    const endpointsWithStats = await Promise.all(
      endpoints.map(async (endpoint) => {
        const recentDeliveries = await ctx.db
          .query("webhook_deliveries")
          .withIndex("by_endpoint_created", (q) =>
            q.eq("endpointId", endpoint._id)
          )
          .order("desc")
          .take(100);

        const delivered = recentDeliveries.filter(
          (d) => d.status === "delivered"
        ).length;
        const failed = recentDeliveries.filter(
          (d) => d.status === "failed" || d.status === "abandoned"
        ).length;

        return {
          id: endpoint._id,
          name: endpoint.name,
          url: endpoint.url,
          status: endpoint.status,
          events: endpoint.events,
          description: endpoint.description,
          secret_prefix: endpoint.secretPrefix,
          created_at: new Date(endpoint.createdAt).toISOString(),
          updated_at: new Date(endpoint.updatedAt).toISOString(),
          stats: {
            total_deliveries: recentDeliveries.length,
            successful: delivered,
            failed,
            success_rate:
              recentDeliveries.length > 0
                ? Math.round((delivered / recentDeliveries.length) * 100)
                : 100,
          },
        };
      })
    );

    return endpointsWithStats;
  },
});

/**
 * Internal query to get a single webhook endpoint.
 *
 * @internal
 */
export const getEndpoint = internalQuery({
  args: {
    userId: v.id("users"),
    organizationId: v.id("organizations"),
    endpointId: v.id("webhook_endpoints"),
  },
  handler: async (ctx, args): Promise<ApiWebhookEndpoint | null> => {
    const endpoint = await ctx.db.get(args.endpointId);

    if (!endpoint) {
      return null;
    }

    if (endpoint.organizationId !== args.organizationId) {
      return null;
    }

    // Get delivery stats
    const recentDeliveries = await ctx.db
      .query("webhook_deliveries")
      .withIndex("by_endpoint_created", (q) =>
        q.eq("endpointId", args.endpointId)
      )
      .order("desc")
      .take(100);

    const delivered = recentDeliveries.filter(
      (d) => d.status === "delivered"
    ).length;
    const failed = recentDeliveries.filter(
      (d) => d.status === "failed" || d.status === "abandoned"
    ).length;

    return {
      id: endpoint._id,
      name: endpoint.name,
      url: endpoint.url,
      status: endpoint.status,
      events: endpoint.events,
      description: endpoint.description,
      secret_prefix: endpoint.secretPrefix,
      created_at: new Date(endpoint.createdAt).toISOString(),
      updated_at: new Date(endpoint.updatedAt).toISOString(),
      stats: {
        total_deliveries: recentDeliveries.length,
        successful: delivered,
        failed,
        success_rate:
          recentDeliveries.length > 0
            ? Math.round((delivered / recentDeliveries.length) * 100)
            : 100,
      },
    };
  },
});

/**
 * Generates a cryptographically secure random string.
 */
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

/**
 * Hashes a secret using SHA-256.
 */
async function hashSecret(secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(secret);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Internal mutation to create a webhook endpoint via API.
 *
 * @internal
 */
export const createEndpoint = internalMutation({
  args: {
    userId: v.id("users"),
    organizationId: v.id("organizations"),
    name: v.string(),
    url: v.string(),
    events: v.array(v.string()),
    description: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    success: boolean;
    endpointId?: string;
    secret?: string;
    error?: string;
  }> => {
    // Validate name
    if (args.name.trim().length === 0) {
      return { success: false, error: "Name is required" };
    }
    if (args.name.length > 100) {
      return { success: false, error: "Name must be 100 characters or less" };
    }

    // Validate URL
    try {
      const url = new URL(args.url);
      if (url.protocol !== "https:") {
        return { success: false, error: "Webhook URL must use HTTPS" };
      }
    } catch {
      return { success: false, error: "Invalid URL format" };
    }

    // Validate events
    const validEvents = new Set<string>(WEBHOOK_EVENT_TYPES);
    for (const event of args.events) {
      if (!validEvents.has(event)) {
        return { success: false, error: `Invalid event type: ${event}` };
      }
    }

    // Check endpoint limit
    const existingEndpoints = await ctx.db
      .query("webhook_endpoints")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId)
      )
      .collect();

    if (existingEndpoints.length >= 10) {
      return {
        success: false,
        error: "Maximum of 10 webhook endpoints per organization",
      };
    }

    // Generate secret
    const secret = `whsec_${generateSecret(32)}`;
    const secretHash = await hashSecret(secret);
    const secretPrefix = secret.slice(0, 12);

    const now = Date.now();

    const endpointId = await ctx.db.insert("webhook_endpoints", {
      organizationId: args.organizationId,
      name: args.name.trim(),
      url: args.url,
      secretHash,
      secret,
      secretPrefix,
      events: args.events,
      status: "active",
      description: args.description,
      failureCount: 0,
      createdBy: args.userId,
      createdAt: now,
      updatedAt: now,
    });

    return { success: true, endpointId, secret };
  },
});

/**
 * Internal mutation to update a webhook endpoint via API.
 *
 * @internal
 */
export const updateEndpoint = internalMutation({
  args: {
    userId: v.id("users"),
    organizationId: v.id("organizations"),
    endpointId: v.id("webhook_endpoints"),
    name: v.optional(v.string()),
    url: v.optional(v.string()),
    events: v.optional(v.array(v.string())),
    description: v.optional(v.string()),
    status: v.optional(
      v.union(v.literal("active"), v.literal("paused"), v.literal("disabled"))
    ),
  },
  handler: async (ctx, args): Promise<UpdateEndpointResult> => {
    const endpoint = await ctx.db.get(args.endpointId);

    if (!endpoint) {
      return { success: false, error: "Webhook endpoint not found" };
    }

    if (endpoint.organizationId !== args.organizationId) {
      return { success: false, error: "Webhook endpoint not found" };
    }

    const { updates, error } = buildEndpointUpdates(endpoint.status, args);
    if (error) {
      return { success: false, error };
    }

    await ctx.db.patch(args.endpointId, updates);

    return { success: true };
  },
});

/**
 * Internal mutation to delete a webhook endpoint via API.
 *
 * @internal
 */
export const deleteEndpoint = internalMutation({
  args: {
    userId: v.id("users"),
    organizationId: v.id("organizations"),
    endpointId: v.id("webhook_endpoints"),
  },
  handler: async (ctx, args): Promise<{ success: boolean; error?: string }> => {
    const endpoint = await ctx.db.get(args.endpointId);

    if (!endpoint) {
      return { success: false, error: "Webhook endpoint not found" };
    }

    if (endpoint.organizationId !== args.organizationId) {
      return { success: false, error: "Webhook endpoint not found" };
    }

    // Delete all related deliveries
    const deliveries = await ctx.db
      .query("webhook_deliveries")
      .withIndex("by_endpoint", (q) => q.eq("endpointId", args.endpointId))
      .collect();

    for (const delivery of deliveries) {
      await ctx.db.delete(delivery._id);
    }

    // Delete the endpoint
    await ctx.db.delete(args.endpointId);

    return { success: true };
  },
});

/**
 * Internal mutation to rotate a webhook secret via API.
 *
 * @internal
 */
export const rotateSecret = internalMutation({
  args: {
    userId: v.id("users"),
    organizationId: v.id("organizations"),
    endpointId: v.id("webhook_endpoints"),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ success: boolean; secret?: string; error?: string }> => {
    const endpoint = await ctx.db.get(args.endpointId);

    if (!endpoint) {
      return { success: false, error: "Webhook endpoint not found" };
    }

    if (endpoint.organizationId !== args.organizationId) {
      return { success: false, error: "Webhook endpoint not found" };
    }

    // Generate new secret
    const secret = `whsec_${generateSecret(32)}`;
    const secretHash = await hashSecret(secret);
    const secretPrefix = secret.slice(0, 12);

    await ctx.db.patch(args.endpointId, {
      secretHash,
      secret,
      secretPrefix,
      updatedAt: Date.now(),
    });

    return { success: true, secret };
  },
});

/**
 * Internal query to get available event types.
 *
 * @internal
 */
export const getEventTypes = internalQuery({
  args: {},
  handler: async () => {
    return [
      // Document events
      {
        type: "document.created",
        category: "Documents",
        description: "A new document was created",
      },
      {
        type: "document.sent",
        category: "Documents",
        description: "A document was sent for signing",
      },
      {
        type: "document.viewed",
        category: "Documents",
        description: "A document was viewed by a recipient",
      },
      {
        type: "document.completed",
        category: "Documents",
        description: "All recipients have signed the document",
      },
      {
        type: "document.voided",
        category: "Documents",
        description: "A document was voided/cancelled",
      },
      {
        type: "document.expired",
        category: "Documents",
        description: "A document deadline has passed",
      },
      {
        type: "document.declined",
        category: "Documents",
        description: "A recipient declined to sign",
      },
      // Recipient events
      {
        type: "recipient.added",
        category: "Recipients",
        description: "A recipient was added to a document",
      },
      {
        type: "recipient.viewed",
        category: "Recipients",
        description: "A recipient viewed the document",
      },
      {
        type: "recipient.signed",
        category: "Recipients",
        description: "A recipient signed the document",
      },
      {
        type: "recipient.approved",
        category: "Recipients",
        description: "A recipient approved the document",
      },
      {
        type: "recipient.declined",
        category: "Recipients",
        description: "A recipient declined to sign",
      },
      {
        type: "recipient.reminded",
        category: "Recipients",
        description: "A reminder was sent to a recipient",
      },
      // Template events
      {
        type: "template.created",
        category: "Templates",
        description: "A new template was created",
      },
      {
        type: "template.updated",
        category: "Templates",
        description: "A template was modified",
      },
      {
        type: "template.used",
        category: "Templates",
        description: "A document was created from a template",
      },
    ];
  },
});
