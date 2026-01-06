import { defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Rate Limit Buckets Schema
 *
 * Tracks API request counts per API key per time window.
 * Uses a sliding window approach with buckets for minute and hour windows.
 *
 * Note: apiKeyId is the Clerk API key ID (string like "ak_xxx"),
 * not the internal Convex api_keys table ID.
 */
export const rateLimitBucketsTable = defineTable({
	// The Clerk API key ID being rate limited (e.g., "ak_xxx")
	apiKeyId: v.string(),

	// Window type: "minute" or "hour"
	windowType: v.union(v.literal("minute"), v.literal("hour")),

	// Window start timestamp (epoch ms, aligned to window boundary)
	windowStart: v.number(),

	// Number of requests in this window
	requestCount: v.number(),

	// When this bucket expires and can be cleaned up
	expiresAt: v.number(),
})
	.index("by_api_key_and_window", ["apiKeyId", "windowType", "windowStart"])
	.index("by_expires_at", ["expiresAt"]);

export type WindowType = "minute" | "hour";
