/**
 * API Keys queries for Seal
 */

import { authQuery } from "../auth";

/**
 * Get all API keys for the current user
 */
export const listApiKeys = authQuery({
	args: {},
	handler: async (ctx) => {
		const userId = ctx.auth.user._id;

		const apiKeys = await ctx.db
			.query("api_keys")
			.withIndex("by_user_id", (q) => q.eq("userId", userId))
			.collect();

		// Return without the hash for security
		return apiKeys.map((key) => ({
			_id: key._id,
			name: key.name,
			keyPrefix: key.keyPrefix,
			scopes: key.scopes,
			expiresAt: key.expiresAt,
			lastUsedAt: key.lastUsedAt,
			revoked: key.revoked,
			createdAt: key.createdAt,
		}));
	},
});

/**
 * Get all connected apps for the current user
 */
export const listConnectedApps = authQuery({
	args: {},
	handler: async (ctx) => {
		const userId = ctx.auth.user._id;

		const apps = await ctx.db
			.query("connected_apps")
			.withIndex("by_user_id", (q) => q.eq("userId", userId))
			.collect();

		return apps;
	},
});

/**
 * Get integration activity logs for the current user
 */
export const listIntegrationActivity = authQuery({
	args: {},
	handler: async (ctx) => {
		const userId = ctx.auth.user._id;

		const logs = await ctx.db
			.query("integration_activity_logs")
			.withIndex("by_user_id_and_created_at", (q) => q.eq("userId", userId))
			.order("desc")
			.take(50); // Limit to last 50 activities

		return logs;
	},
});
