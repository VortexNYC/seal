import { defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Connected Apps Schema
 *
 * Stores OAuth connections to third-party applications.
 */
export const connectedAppsTable = defineTable({
	// User who connected the app
	userId: v.id("users"),

	// Name of the third-party application
	appName: v.string(),

	// Application identifier (e.g., "google", "slack", "zapier")
	appId: v.string(),

	// OAuth scopes granted to the app
	scopes: v.array(v.string()),

	// Whether the connection is active
	active: v.boolean(),

	// Timestamps
	connectedAt: v.number(),
	lastActivityAt: v.optional(v.number()),
})
	.index("by_user_id", ["userId"])
	.index("by_user_id_and_active", ["userId", "active"])
	.index("by_app_id", ["appId"]);

/**
 * Integration Activity Logs Schema
 *
 * Stores logs of API key and connected app activity.
 */
export const integrationActivityLogsTable = defineTable({
	// User who owns the integration
	userId: v.id("users"),

	// Type of integration activity
	type: v.union(v.literal("api_key"), v.literal("connected_app")),

	// Reference to the integration (API key ID or connected app ID)
	integrationId: v.string(),

	// Name of the integration for display
	integrationName: v.string(),

	// Action performed
	action: v.string(),

	// Additional details about the activity
	details: v.optional(v.string()),

	// IP address of the request (if applicable)
	ipAddress: v.optional(v.string()),

	// Timestamp
	createdAt: v.number(),
})
	.index("by_user_id", ["userId"])
	.index("by_user_id_and_created_at", ["userId", "createdAt"]);
