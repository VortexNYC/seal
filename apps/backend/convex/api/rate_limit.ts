/**
 * @fileoverview Rate limiting implementation for API endpoints.
 * Uses sliding window counters stored in the database.
 *
 * @module api/rate_limit
 */

import type { GenericActionCtx } from "convex/server";
import { internal } from "../_generated/api";
import type { DataModel } from "../_generated/dataModel";
import { ApiError } from "./errors";

/**
 * Rate limit configuration for an endpoint.
 */
export interface RateLimitConfig {
	/** Max requests per minute (default: 60) */
	requestsPerMinute: number;
	/** Max requests per hour (default: 1000) */
	requestsPerHour: number;
}

/**
 * Rate limit check result.
 */
export interface RateLimitResult {
	/** Whether the request is allowed */
	allowed: boolean;
	/** Remaining requests in current minute window */
	remainingMinute: number;
	/** Remaining requests in current hour window */
	remainingHour: number;
	/** When the minute limit resets (Unix timestamp in seconds) */
	resetMinute: number;
	/** When the hour limit resets (Unix timestamp in seconds) */
	resetHour: number;
	/** Which limit was exceeded (if not allowed) */
	exceededLimit?: "minute" | "hour";
}

/**
 * Default rate limits for API endpoints.
 */
export const DEFAULT_RATE_LIMITS: RateLimitConfig = {
	requestsPerMinute: 60,
	requestsPerHour: 1000,
};

/**
 * Aligns a timestamp to the start of a time window.
 */
function alignToWindow(timestamp: number, windowMs: number): number {
	return Math.floor(timestamp / windowMs) * windowMs;
}

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

/**
 * Checks and updates rate limits for an API key.
 * Uses internal mutations to update the rate limit buckets.
 *
 * @param ctx - Convex action context
 * @param apiKeyId - The Clerk API key ID (e.g., "ak_xxx")
 * @param config - Rate limit configuration
 * @returns Rate limit result
 */
export async function checkRateLimit(
	ctx: GenericActionCtx<DataModel>,
	apiKeyId: string,
	config: RateLimitConfig = DEFAULT_RATE_LIMITS,
): Promise<RateLimitResult> {
	const now = Date.now();
	const minuteWindowStart = alignToWindow(now, MINUTE_MS);
	const hourWindowStart = alignToWindow(now, HOUR_MS);

	// Get current counts and increment in a single mutation
	const result = await ctx.runMutation(
		internal.api.rate_limit_mutations.checkAndIncrement,
		{
			apiKeyId,
			now,
			minuteWindowStart,
			hourWindowStart,
			minuteLimit: config.requestsPerMinute,
			hourLimit: config.requestsPerHour,
		},
	);

	return {
		allowed: result.allowed,
		remainingMinute: Math.max(0, config.requestsPerMinute - result.minuteCount),
		remainingHour: Math.max(0, config.requestsPerHour - result.hourCount),
		resetMinute: Math.floor((minuteWindowStart + MINUTE_MS) / 1000),
		resetHour: Math.floor((hourWindowStart + HOUR_MS) / 1000),
		exceededLimit: result.exceededLimit,
	};
}

/**
 * Builds rate limit headers for a response.
 */
export function buildRateLimitHeaders(result: RateLimitResult): Headers {
	const headers = new Headers();

	// Use the more restrictive limit for the main headers
	const remaining = Math.min(result.remainingMinute, result.remainingHour);
	const reset =
		result.remainingMinute < result.remainingHour
			? result.resetMinute
			: result.resetHour;

	headers.set(
		"X-RateLimit-Limit",
		String(DEFAULT_RATE_LIMITS.requestsPerMinute),
	);
	headers.set("X-RateLimit-Remaining", String(remaining));
	headers.set("X-RateLimit-Reset", String(reset));

	// Additional detailed headers
	headers.set(
		"X-RateLimit-Limit-Minute",
		String(DEFAULT_RATE_LIMITS.requestsPerMinute),
	);
	headers.set("X-RateLimit-Remaining-Minute", String(result.remainingMinute));
	headers.set(
		"X-RateLimit-Limit-Hour",
		String(DEFAULT_RATE_LIMITS.requestsPerHour),
	);
	headers.set("X-RateLimit-Remaining-Hour", String(result.remainingHour));

	return headers;
}

/**
 * Throws an ApiError for rate limit exceeded.
 */
export function throwRateLimitExceeded(result: RateLimitResult): never {
	const retryAfter =
		result.exceededLimit === "minute"
			? result.resetMinute - Math.floor(Date.now() / 1000)
			: result.resetHour - Math.floor(Date.now() / 1000);

	const limitType =
		result.exceededLimit === "minute" ? "per-minute" : "per-hour";

	throw new ApiError(
		429,
		`Rate limit exceeded (${limitType}). Try again in ${retryAfter} seconds.`,
		"RATE_LIMIT_EXCEEDED",
	);
}
