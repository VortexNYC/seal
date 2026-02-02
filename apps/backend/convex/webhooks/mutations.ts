/**
 * @fileoverview Webhook endpoint mutations.
 * Provides create, update, delete operations for webhook endpoints.
 *
 * @module webhooks/mutations
 */

import { ConvexError, v } from "convex/values";
import { ensureProFeature } from "../auth/subscription_guards";
import { permissionMutation } from "../auth/wrappers";
import { WEBHOOK_EVENT_TYPES } from "../schemas/webhooks";

/**
 * Generates a cryptographically secure random string.
 *
 * @param length - Length of the string to generate
 * @returns Random alphanumeric string
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
 *
 * @param secret - The secret to hash
 * @returns Hex-encoded hash
 */
async function hashSecret(secret: string): Promise<string> {
	const encoder = new TextEncoder();
	const data = encoder.encode(secret);
	const hashBuffer = await crypto.subtle.digest("SHA-256", data);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Creates a new webhook endpoint.
 *
 * @param name - User-friendly name for the endpoint
 * @param url - HTTPS URL where webhooks will be delivered
 * @param events - Event types to subscribe to (empty = all)
 * @param description - Optional description
 * @returns The created endpoint and the secret (shown only once)
 * @permission settings:integrations
 */
export const createEndpoint = permissionMutation("settings:integrations")({
	args: {
		name: v.string(),
		url: v.string(),
		events: v.array(v.string()),
		description: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		// Validate name
		if (args.name.trim().length === 0) {
			throw new ConvexError({
				code: "VALIDATION_ERROR",
				message: "Name is required",
			});
		}

		if (args.name.length > 100) {
			throw new ConvexError({
				code: "VALIDATION_ERROR",
				message: "Name must be 100 characters or less",
			});
		}

		// Validate URL
		try {
			const url = new URL(args.url);
			if (url.protocol !== "https:") {
				throw new ConvexError({
					code: "VALIDATION_ERROR",
					message: "Webhook URL must use HTTPS",
				});
			}
		} catch {
			throw new ConvexError({
				code: "VALIDATION_ERROR",
				message: "Invalid URL format",
			});
		}

		// Validate events
		const validEvents = new Set<string>(WEBHOOK_EVENT_TYPES);
		for (const event of args.events) {
			if (!validEvents.has(event)) {
				throw new ConvexError({
					code: "VALIDATION_ERROR",
					message: `Invalid event type: ${event}`,
				});
			}
		}

		// Check Pro plan requirement for webhooks
		await ensureProFeature(ctx.db, ctx.auth.userId, "Webhook endpoints");

		// Check endpoint limit (max 10 per organization)
		const existingEndpoints = await ctx.db
			.query("webhook_endpoints")
			.withIndex("by_organization", (q) =>
				q.eq("organizationId", ctx.auth.organizationId),
			)
			.collect();

		if (existingEndpoints.length >= 10) {
			throw new ConvexError({
				code: "LIMIT_EXCEEDED",
				message: "Maximum of 10 webhook endpoints per organization",
			});
		}

		// Generate secret
		const secret = `whsec_${generateSecret(32)}`;
		const secretHash = await hashSecret(secret);
		const secretPrefix = secret.slice(0, 12); // "whsec_xxxx"

		const now = Date.now();

		const endpointId = await ctx.db.insert("webhook_endpoints", {
			organizationId: ctx.auth.organizationId,
			name: args.name.trim(),
			url: args.url,
			secretHash,
			secretPrefix,
			events: args.events,
			status: "active",
			description: args.description,
			failureCount: 0,
			createdBy: ctx.auth.userId,
			createdAt: now,
			updatedAt: now,
		});

		const endpoint = await ctx.db.get(endpointId);

		return {
			endpoint,
			secret, // Only returned once at creation!
		};
	},
});

/**
 * Updates a webhook endpoint.
 *
 * @param endpointId - The endpoint to update
 * @param name - New name (optional)
 * @param url - New URL (optional)
 * @param events - New event subscriptions (optional)
 * @param description - New description (optional)
 * @param status - New status (optional)
 * @returns The updated endpoint
 * @permission settings:integrations
 */
export const updateEndpoint = permissionMutation("settings:integrations")({
	args: {
		endpointId: v.id("webhook_endpoints"),
		name: v.optional(v.string()),
		url: v.optional(v.string()),
		events: v.optional(v.array(v.string())),
		description: v.optional(v.string()),
		status: v.optional(
			v.union(v.literal("active"), v.literal("paused"), v.literal("disabled")),
		),
	},
	handler: async (ctx, args) => {
		const endpoint = await ctx.db.get(args.endpointId);

		if (!endpoint) {
			throw new ConvexError({
				code: "NOT_FOUND",
				message: "Webhook endpoint not found",
			});
		}

		if (endpoint.organizationId !== ctx.auth.organizationId) {
			throw new ConvexError({
				code: "FORBIDDEN",
				message: "You don't have access to this endpoint",
			});
		}

		const updates: Partial<typeof endpoint> = {
			updatedAt: Date.now(),
		};

		// Validate and apply name
		if (args.name !== undefined) {
			if (args.name.trim().length === 0) {
				throw new ConvexError({
					code: "VALIDATION_ERROR",
					message: "Name is required",
				});
			}
			if (args.name.length > 100) {
				throw new ConvexError({
					code: "VALIDATION_ERROR",
					message: "Name must be 100 characters or less",
				});
			}
			updates.name = args.name.trim();
		}

		// Validate and apply URL
		if (args.url !== undefined) {
			try {
				const url = new URL(args.url);
				if (url.protocol !== "https:") {
					throw new ConvexError({
						code: "VALIDATION_ERROR",
						message: "Webhook URL must use HTTPS",
					});
				}
			} catch {
				throw new ConvexError({
					code: "VALIDATION_ERROR",
					message: "Invalid URL format",
				});
			}
			updates.url = args.url;
		}

		// Validate and apply events
		if (args.events !== undefined) {
			const validEvents = new Set<string>(WEBHOOK_EVENT_TYPES);
			for (const event of args.events) {
				if (!validEvents.has(event)) {
					throw new ConvexError({
						code: "VALIDATION_ERROR",
						message: `Invalid event type: ${event}`,
					});
				}
			}
			updates.events = args.events;
		}

		// Apply description
		if (args.description !== undefined) {
			updates.description = args.description;
		}

		// Apply status
		if (args.status !== undefined) {
			updates.status = args.status;
			// Reset failure count when manually re-enabling
			if (args.status === "active" && endpoint.status === "disabled") {
				updates.failureCount = 0;
			}
		}

		await ctx.db.patch(args.endpointId, updates);

		return ctx.db.get(args.endpointId);
	},
});

/**
 * Rotates the secret for a webhook endpoint.
 *
 * @param endpointId - The endpoint to rotate the secret for
 * @returns The new secret (shown only once)
 * @permission settings:integrations
 */
export const rotateSecret = permissionMutation("settings:integrations")({
	args: {
		endpointId: v.id("webhook_endpoints"),
	},
	handler: async (ctx, args) => {
		const endpoint = await ctx.db.get(args.endpointId);

		if (!endpoint) {
			throw new ConvexError({
				code: "NOT_FOUND",
				message: "Webhook endpoint not found",
			});
		}

		if (endpoint.organizationId !== ctx.auth.organizationId) {
			throw new ConvexError({
				code: "FORBIDDEN",
				message: "You don't have access to this endpoint",
			});
		}

		// Generate new secret
		const secret = `whsec_${generateSecret(32)}`;
		const secretHash = await hashSecret(secret);
		const secretPrefix = secret.slice(0, 12);

		await ctx.db.patch(args.endpointId, {
			secretHash,
			secretPrefix,
			updatedAt: Date.now(),
		});

		return { secret };
	},
});

/**
 * Deletes a webhook endpoint.
 *
 * @param endpointId - The endpoint to delete
 * @permission settings:integrations
 */
export const deleteEndpoint = permissionMutation("settings:integrations")({
	args: {
		endpointId: v.id("webhook_endpoints"),
	},
	handler: async (ctx, args) => {
		const endpoint = await ctx.db.get(args.endpointId);

		if (!endpoint) {
			throw new ConvexError({
				code: "NOT_FOUND",
				message: "Webhook endpoint not found",
			});
		}

		if (endpoint.organizationId !== ctx.auth.organizationId) {
			throw new ConvexError({
				code: "FORBIDDEN",
				message: "You don't have access to this endpoint",
			});
		}

		// Delete all related deliveries first
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
 * Tests a webhook endpoint by sending a test event.
 *
 * @param endpointId - The endpoint to test
 * @returns Test delivery result
 * @permission settings:integrations
 */
export const testEndpoint = permissionMutation("settings:integrations")({
	args: {
		endpointId: v.id("webhook_endpoints"),
	},
	handler: async (ctx, args) => {
		const endpoint = await ctx.db.get(args.endpointId);

		if (!endpoint) {
			throw new ConvexError({
				code: "NOT_FOUND",
				message: "Webhook endpoint not found",
			});
		}

		if (endpoint.organizationId !== ctx.auth.organizationId) {
			throw new ConvexError({
				code: "FORBIDDEN",
				message: "You don't have access to this endpoint",
			});
		}

		// Create a test event payload
		const eventId = `evt_test_${Date.now()}_${generateSecret(8)}`;
		const payload = {
			id: eventId,
			type: "test.ping",
			api_version: "2025-01-01",
			created_at: new Date().toISOString(),
			organization_id: ctx.auth.organizationId,
			data: {
				message: "This is a test webhook from Seal",
				endpoint_id: args.endpointId,
				endpoint_name: endpoint.name,
			},
		};

		// Create delivery record
		const deliveryId = await ctx.db.insert("webhook_deliveries", {
			endpointId: args.endpointId,
			organizationId: ctx.auth.organizationId,
			eventId,
			eventType: "test.ping",
			payload: JSON.stringify(payload),
			status: "pending",
			attemptCount: 0,
			createdAt: Date.now(),
		});

		// Note: Actual delivery would be handled by a scheduled action
		// For now, we return the pending delivery
		return {
			deliveryId,
			eventId,
			status: "pending",
			message: "Test webhook queued for delivery",
		};
	},
});

/**
 * Retries a failed delivery.
 *
 * @param deliveryId - The delivery to retry
 * @returns Updated delivery status
 * @permission settings:integrations
 */
export const retryDelivery = permissionMutation("settings:integrations")({
	args: {
		deliveryId: v.id("webhook_deliveries"),
	},
	handler: async (ctx, args) => {
		const delivery = await ctx.db.get(args.deliveryId);

		if (!delivery) {
			throw new ConvexError({
				code: "NOT_FOUND",
				message: "Delivery not found",
			});
		}

		if (delivery.organizationId !== ctx.auth.organizationId) {
			throw new ConvexError({
				code: "FORBIDDEN",
				message: "You don't have access to this delivery",
			});
		}

		if (delivery.status === "delivered") {
			throw new ConvexError({
				code: "INVALID_STATE",
				message: "Cannot retry a delivered webhook",
			});
		}

		// Reset for retry
		await ctx.db.patch(args.deliveryId, {
			status: "pending",
			nextRetryAt: Date.now(),
			errorMessage: undefined,
		});

		return { success: true };
	},
});
