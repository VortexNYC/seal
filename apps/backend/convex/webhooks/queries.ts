/**
 * @fileoverview Webhook endpoint queries.
 * Provides read operations for webhook endpoints and delivery logs.
 *
 * @module webhooks/queries
 */

import { v } from "convex/values";
import { permissionQuery } from "../auth/wrappers";

/**
 * Lists all webhook endpoints for the current organization.
 *
 * @returns {WebhookEndpoint[]} List of webhook endpoints with delivery stats
 * @permission settings:integrations
 */
export const listEndpoints = permissionQuery("settings:integrations")({
	args: {},
	handler: async (ctx) => {
		const endpoints = await ctx.db
			.query("webhook_endpoints")
			.withIndex("by_organization", (q) =>
				q.eq("organizationId", ctx.auth.organizationId),
			)
			.collect();

		// Get recent delivery stats for each endpoint
		const endpointsWithStats = await Promise.all(
			endpoints.map(async (endpoint) => {
				const recentDeliveries = await ctx.db
					.query("webhook_deliveries")
					.withIndex("by_endpoint_created", (q) =>
						q.eq("endpointId", endpoint._id),
					)
					.order("desc")
					.take(100);

				const delivered = recentDeliveries.filter(
					(d) => d.status === "delivered",
				).length;
				const failed = recentDeliveries.filter(
					(d) => d.status === "failed" || d.status === "abandoned",
				).length;

				return {
					...endpoint,
					stats: {
						recentDeliveries: recentDeliveries.length,
						delivered,
						failed,
						successRate:
							recentDeliveries.length > 0
								? Math.round((delivered / recentDeliveries.length) * 100)
								: 100,
					},
				};
			}),
		);

		return endpointsWithStats;
	},
});

/**
 * Gets a single webhook endpoint by ID.
 *
 * @param endpointId - The webhook endpoint ID
 * @returns {WebhookEndpoint | null} The endpoint or null if not found
 * @permission settings:integrations
 */
export const getEndpoint = permissionQuery("settings:integrations")({
	args: {
		endpointId: v.id("webhook_endpoints"),
	},
	handler: async (ctx, args) => {
		const endpoint = await ctx.db.get(args.endpointId);

		if (!endpoint) {
			return null;
		}

		// Ensure the endpoint belongs to the user's organization
		if (endpoint.organizationId !== ctx.auth.organizationId) {
			return null;
		}

		return endpoint;
	},
});

/**
 * Lists recent deliveries for a webhook endpoint.
 *
 * @param endpointId - The webhook endpoint ID
 * @param limit - Maximum number of deliveries to return (default 50)
 * @returns {WebhookDelivery[]} List of recent deliveries
 * @permission settings:integrations
 */
export const listDeliveries = permissionQuery("settings:integrations")({
	args: {
		endpointId: v.id("webhook_endpoints"),
		limit: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const endpoint = await ctx.db.get(args.endpointId);

		if (!endpoint || endpoint.organizationId !== ctx.auth.organizationId) {
			return [];
		}

		const limit = args.limit ?? 50;

		const deliveries = await ctx.db
			.query("webhook_deliveries")
			.withIndex("by_endpoint_created", (q) =>
				q.eq("endpointId", args.endpointId),
			)
			.order("desc")
			.take(limit);

		return deliveries;
	},
});

/**
 * Gets a single delivery by ID.
 *
 * @param deliveryId - The delivery ID
 * @returns {WebhookDelivery | null} The delivery or null if not found
 * @permission settings:integrations
 */
export const getDelivery = permissionQuery("settings:integrations")({
	args: {
		deliveryId: v.id("webhook_deliveries"),
	},
	handler: async (ctx, args) => {
		const delivery = await ctx.db.get(args.deliveryId);

		if (!delivery) {
			return null;
		}

		// Verify organization access
		if (delivery.organizationId !== ctx.auth.organizationId) {
			return null;
		}

		return delivery;
	},
});

/**
 * Gets available webhook event types.
 *
 * @returns {WebhookEventType[]} List of available event types with descriptions
 */
export const getEventTypes = permissionQuery("settings:integrations")({
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
