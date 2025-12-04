import { defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * API Key Scopes - defines what the API key can access
 */
export const apiKeyScopeValidator = v.union(
	v.literal("documents:read"),
	v.literal("documents:write"),
	v.literal("templates:read"),
	v.literal("templates:write"),
	v.literal("recipients:read"),
	v.literal("recipients:write"),
	v.literal("signatures:read"),
);

export type ApiKeyScope =
	| "documents:read"
	| "documents:write"
	| "templates:read"
	| "templates:write"
	| "recipients:read"
	| "recipients:write"
	| "signatures:read";

/**
 * API Keys Schema
 *
 * Stores user-generated API keys for programmatic access.
 * Keys are hashed after creation - only the prefix is stored for identification.
 */
export const apiKeysTable = defineTable({
	// Owner of the API key
	userId: v.id("users"),

	// Human-readable name for the key
	name: v.string(),

	// First 8 characters of the key for identification (e.g., "sk_live_abc")
	keyPrefix: v.string(),

	// SHA-256 hash of the full key for verification
	keyHash: v.string(),

	// Scopes/permissions for this key
	scopes: v.array(apiKeyScopeValidator),

	// Optional expiration date
	expiresAt: v.optional(v.number()),

	// Last time this key was used
	lastUsedAt: v.optional(v.number()),

	// Whether the key has been revoked
	revoked: v.boolean(),

	// Timestamps
	createdAt: v.number(),
})
	.index("by_user_id", ["userId"])
	.index("by_user_id_and_active", ["userId", "revoked"])
	.index("by_key_prefix", ["keyPrefix"]);

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
