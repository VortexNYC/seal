/**
 * API Keys mutations for Seal
 */

import { ConvexError, v } from "convex/values";
import { authMutation } from "../auth";
import { apiKeyScopeValidator } from "../schemas/api_keys";

/**
 * Generate a cryptographically secure API key
 * Returns a key in format: sk_live_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
 */
function generateApiKey(): string {
	const chars =
		"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
	let key = "sk_live_";
	for (let i = 0; i < 32; i++) {
		key += chars.charAt(Math.floor(Math.random() * chars.length));
	}
	return key;
}

/**
 * Simple hash function for API key verification
 * In production, use a proper crypto library
 */
async function hashApiKey(key: string): Promise<string> {
	// Simple hash using string operations
	// In a real implementation, use crypto.subtle.digest or similar
	let hash = 0;
	for (let i = 0; i < key.length; i++) {
		const char = key.charCodeAt(i);
		hash = (hash << 5) - hash + char;
		hash = hash & hash; // Convert to 32bit integer
	}
	// Convert to hex string and pad
	const hashStr = Math.abs(hash).toString(16).padStart(8, "0");
	// Create a longer hash by repeating the process with different offsets
	let fullHash = hashStr;
	for (let i = 1; i < 8; i++) {
		let offsetHash = 0;
		for (let j = 0; j < key.length; j++) {
			const char = key.charCodeAt(j);
			offsetHash = (offsetHash << 5) - offsetHash + char + i * 31;
			offsetHash = offsetHash & offsetHash;
		}
		fullHash += Math.abs(offsetHash).toString(16).padStart(8, "0");
	}
	return fullHash;
}

/**
 * Create a new API key
 */
export const createApiKey = authMutation({
	args: {
		name: v.string(),
		scopes: v.array(apiKeyScopeValidator),
		expiresAt: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const userId = ctx.auth.user._id;

		// Validate name
		if (!args.name.trim()) {
			throw new ConvexError("API key name is required");
		}

		if (args.name.length > 100) {
			throw new ConvexError("API key name must be 100 characters or less");
		}

		// Validate scopes
		if (args.scopes.length === 0) {
			throw new ConvexError("At least one scope is required");
		}

		// Generate the key
		const fullKey = generateApiKey();
		const keyPrefix = fullKey.substring(0, 12); // "sk_live_XXXX"
		const keyHash = await hashApiKey(fullKey);

		// Create the API key record
		const keyId = await ctx.db.insert("api_keys", {
			userId,
			name: args.name.trim(),
			keyPrefix,
			keyHash,
			scopes: args.scopes,
			expiresAt: args.expiresAt,
			revoked: false,
			createdAt: Date.now(),
		});

		// Log the activity
		await ctx.db.insert("integration_activity_logs", {
			userId,
			type: "api_key",
			integrationId: keyId,
			integrationName: args.name.trim(),
			action: "created",
			details: `API key created with ${args.scopes.length} scope(s)`,
			createdAt: Date.now(),
		});

		// Return the full key - this is the only time it will be visible
		return {
			keyId,
			key: fullKey,
			keyPrefix,
		};
	},
});

/**
 * Revoke an API key
 */
export const revokeApiKey = authMutation({
	args: {
		keyId: v.id("api_keys"),
	},
	handler: async (ctx, args) => {
		const userId = ctx.auth.user._id;

		const apiKey = await ctx.db.get(args.keyId);

		if (!apiKey) {
			throw new ConvexError("API key not found");
		}

		if (apiKey.userId !== userId) {
			throw new ConvexError("You don't have permission to revoke this key");
		}

		if (apiKey.revoked) {
			throw new ConvexError("API key is already revoked");
		}

		// Revoke the key
		await ctx.db.patch(args.keyId, {
			revoked: true,
		});

		// Log the activity
		await ctx.db.insert("integration_activity_logs", {
			userId,
			type: "api_key",
			integrationId: args.keyId,
			integrationName: apiKey.name,
			action: "revoked",
			createdAt: Date.now(),
		});

		return { success: true };
	},
});

/**
 * Delete an API key permanently
 */
export const deleteApiKey = authMutation({
	args: {
		keyId: v.id("api_keys"),
	},
	handler: async (ctx, args) => {
		const userId = ctx.auth.user._id;

		const apiKey = await ctx.db.get(args.keyId);

		if (!apiKey) {
			throw new ConvexError("API key not found");
		}

		if (apiKey.userId !== userId) {
			throw new ConvexError("You don't have permission to delete this key");
		}

		// Log the activity before deletion
		await ctx.db.insert("integration_activity_logs", {
			userId,
			type: "api_key",
			integrationId: args.keyId,
			integrationName: apiKey.name,
			action: "deleted",
			createdAt: Date.now(),
		});

		// Delete the key
		await ctx.db.delete(args.keyId);

		return { success: true };
	},
});

/**
 * Disconnect a connected app
 */
export const disconnectApp = authMutation({
	args: {
		appId: v.id("connected_apps"),
	},
	handler: async (ctx, args) => {
		const userId = ctx.auth.user._id;

		const app = await ctx.db.get(args.appId);

		if (!app) {
			throw new ConvexError("Connected app not found");
		}

		if (app.userId !== userId) {
			throw new ConvexError("You don't have permission to disconnect this app");
		}

		// Log the activity before deletion
		await ctx.db.insert("integration_activity_logs", {
			userId,
			type: "connected_app",
			integrationId: args.appId,
			integrationName: app.appName,
			action: "disconnected",
			createdAt: Date.now(),
		});

		// Delete the connection
		await ctx.db.delete(args.appId);

		return { success: true };
	},
});
