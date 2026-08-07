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
    let deletedCount = 0;

    for await (const row of ctx.db.query("ai_usage_log")) {
      if (row.createdAt >= cutoff) {
        continue;
      }
      await ctx.db.delete("ai_usage_log", row._id);
      deletedCount += 1;
      if (deletedCount >= BATCH_SIZE) {
        break;
      }
    }

    if (deletedCount > 0) {
      console.info(
        `[AI Cleanup] Deleted ${deletedCount} old usage log entries`
      );
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
    let deletedCount = 0;

    for await (const row of ctx.db.query("ai_field_suggestions")) {
      if (row.status !== "dismissed" || row._creationTime >= cutoff) {
        continue;
      }
      await ctx.db.delete("ai_field_suggestions", row._id);
      deletedCount += 1;
      if (deletedCount >= BATCH_SIZE) {
        break;
      }
    }

    if (deletedCount > 0) {
      console.info(
        `[AI Cleanup] Deleted ${deletedCount} old dismissed suggestions`
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
    let deletedCount = 0;

    for await (const row of ctx.db.query("ai_document_annotations")) {
      if (row.status !== "dismissed" || row.createdAt >= cutoff) {
        continue;
      }
      await ctx.db.delete("ai_document_annotations", row._id);
      deletedCount += 1;
      if (deletedCount >= BATCH_SIZE) {
        break;
      }
    }

    if (deletedCount > 0) {
      console.info(
        `[AI Cleanup] Deleted ${deletedCount} old dismissed annotations`
      );
    }
  },
});
