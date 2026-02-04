/**
 * @fileoverview Internal mutations for rate limiting.
 * These are called by the rate_limit module from HTTP actions.
 *
 * @module api/rate_limit_mutations
 */

import { v } from "convex/values";

import { internalMutation } from "../_generated/server";

const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

/**
 * Check current rate limit counts and increment them atomically.
 * Returns whether the request should be allowed.
 */
export const checkAndIncrement = internalMutation({
  args: {
    apiKeyId: v.string(),
    now: v.number(),
    minuteWindowStart: v.number(),
    hourWindowStart: v.number(),
    minuteLimit: v.number(),
    hourLimit: v.number(),
  },
  handler: async (ctx, args) => {
    // Get or create minute bucket
    const minuteBucket = await ctx.db
      .query("rate_limit_buckets")
      .withIndex("by_api_key_and_window", (q) =>
        q
          .eq("apiKeyId", args.apiKeyId)
          .eq("windowType", "minute")
          .eq("windowStart", args.minuteWindowStart),
      )
      .first();

    // Get or create hour bucket
    const hourBucket = await ctx.db
      .query("rate_limit_buckets")
      .withIndex("by_api_key_and_window", (q) =>
        q
          .eq("apiKeyId", args.apiKeyId)
          .eq("windowType", "hour")
          .eq("windowStart", args.hourWindowStart),
      )
      .first();

    const minuteCount = minuteBucket?.requestCount ?? 0;
    const hourCount = hourBucket?.requestCount ?? 0;

    // Check if limits are exceeded
    if (minuteCount >= args.minuteLimit) {
      return {
        allowed: false,
        minuteCount: minuteCount,
        hourCount: hourCount,
        exceededLimit: "minute" as const,
      };
    }

    if (hourCount >= args.hourLimit) {
      return {
        allowed: false,
        minuteCount: minuteCount,
        hourCount: hourCount,
        exceededLimit: "hour" as const,
      };
    }

    // Increment minute bucket
    if (minuteBucket) {
      await ctx.db.patch(minuteBucket._id, {
        requestCount: minuteBucket.requestCount + 1,
      });
    } else {
      await ctx.db.insert("rate_limit_buckets", {
        apiKeyId: args.apiKeyId,
        windowType: "minute",
        windowStart: args.minuteWindowStart,
        requestCount: 1,
        expiresAt: args.minuteWindowStart + MINUTE_MS * 2, // Keep for 2 minutes
      });
    }

    // Increment hour bucket
    if (hourBucket) {
      await ctx.db.patch(hourBucket._id, {
        requestCount: hourBucket.requestCount + 1,
      });
    } else {
      await ctx.db.insert("rate_limit_buckets", {
        apiKeyId: args.apiKeyId,
        windowType: "hour",
        windowStart: args.hourWindowStart,
        requestCount: 1,
        expiresAt: args.hourWindowStart + HOUR_MS * 2, // Keep for 2 hours
      });
    }

    return {
      allowed: true,
      minuteCount: minuteCount + 1,
      hourCount: hourCount + 1,
      exceededLimit: undefined,
    };
  },
});

/**
 * Clean up expired rate limit buckets.
 * Should be called periodically via cron job.
 */
export const cleanupExpiredBuckets = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    // Find expired buckets
    const expiredBuckets = await ctx.db
      .query("rate_limit_buckets")
      .withIndex("by_expires_at")
      .filter((q) => q.lt(q.field("expiresAt"), now))
      .take(100); // Process in batches

    // Delete expired buckets
    for (const bucket of expiredBuckets) {
      await ctx.db.delete(bucket._id);
    }

    return { deleted: expiredBuckets.length };
  },
});
