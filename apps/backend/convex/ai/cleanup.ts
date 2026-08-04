/**
 * AI data cleanup — removes old usage logs and dismissed suggestions.
 *
 * Registered as crons in crons.ts.
 */

import { internalMutation } from "../_generated/server";

/** Retention period for usage log entries (90 days). */
const USAGE_LOG_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;

/** Retention period for dismissed suggestions (30 days). */
const DISMISSED_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

/** Max rows to delete per cron run (avoid long mutations). */
const BATCH_SIZE = 200;

/**
 * Delete ai_usage_log entries older than 90 days.
 */
export const cleanupOldUsageLogs = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - USAGE_LOG_RETENTION_MS;
    const old = await ctx.db
      .query("ai_usage_log")
      .filter((q) => q.lt(q.field("createdAt"), cutoff))
      .take(BATCH_SIZE);

    for (const row of old) {
      await ctx.db.delete(row._id);
    }

    if (old.length > 0) {
      console.info(`[AI Cleanup] Deleted ${old.length} old usage log entries`);
    }
  },
});

/**
 * Delete dismissed ai_field_suggestions older than 30 days.
 */
export const cleanupDismissedSuggestions = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - DISMISSED_RETENTION_MS;
    const old = await ctx.db
      .query("ai_field_suggestions")
      .filter((q) =>
        q.and(
          q.eq(q.field("status"), "dismissed"),
          q.lt(q.field("_creationTime"), cutoff)
        )
      )
      .take(BATCH_SIZE);

    for (const row of old) {
      await ctx.db.delete(row._id);
    }

    if (old.length > 0) {
      console.info(
        `[AI Cleanup] Deleted ${old.length} old dismissed suggestions`
      );
    }
  },
});

/**
 * Delete dismissed ai_document_annotations older than 30 days.
 */
export const cleanupDismissedAnnotations = internalMutation({
  args: {},
  handler: async (ctx) => {
    const cutoff = Date.now() - DISMISSED_RETENTION_MS;
    const old = await ctx.db
      .query("ai_document_annotations")
      .filter((q) =>
        q.and(
          q.eq(q.field("status"), "dismissed"),
          q.lt(q.field("createdAt"), cutoff)
        )
      )
      .take(BATCH_SIZE);

    for (const row of old) {
      await ctx.db.delete(row._id);
    }

    if (old.length > 0) {
      console.info(
        `[AI Cleanup] Deleted ${old.length} old dismissed annotations`
      );
    }
  },
});
