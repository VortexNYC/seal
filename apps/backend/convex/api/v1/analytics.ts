/**
 * @fileoverview Analytics and reporting for the public API.
 * Returns document completion rates, signing metrics, and activity trends.
 *
 * @module api/v1/analytics
 * @requires seal:documents:read scope
 */
import { v } from "convex/values";

import { internalQuery } from "../../_generated/server";
function sealAssertPresent<T>(
  value: T | null | undefined,
  message = "Expected value to be present."
): NonNullable<T> {
  if (value === null || value === undefined) {
    throw new Error(message);
  }
  return value;
}

/** API analytics summary */
export interface ApiAnalytics {
  /** Date range covered by this report */
  period: {
    /** ISO 8601 start of range */
    from: string;
    /** ISO 8601 end of range */
    to: string;
  };
  /** Document-level metrics */
  documents: {
    /** Total documents created in the period */
    total_created: number;
    /** Total documents sent for signing in the period */
    total_sent: number;
    /** Total documents completed in the period */
    total_completed: number;
    /** Total documents voided/cancelled in the period */
    total_cancelled: number;
    /** Total documents declined in the period */
    total_declined: number;
    /** Completion rate = completed / (completed + cancelled + declined), as a percentage 0–100 */
    completion_rate: number;
    /** Median signing time in hours (null if fewer than 2 completed docs) */
    median_signing_hours: number | null;
  };
  /** Current workspace snapshot (point-in-time, not date-filtered) */
  workspace_snapshot: {
    draft: number;
    sent: number;
    in_progress: number;
    completed: number;
    cancelled: number;
    declined: number;
  };
}

/**
 * Internal query to generate analytics for a date range.
 *
 * @internal
 */
export const getAnalytics = internalQuery({
  args: {
    userId: v.id("users"),
    organizationId: v.id("organizations"),
    from: v.optional(v.number()),
    to: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<ApiAnalytics> => {
    const now = Date.now();
    const toMs = args.to ?? now;
    const fromMs = args.from ?? toMs - 30 * 24 * 60 * 60 * 1000; // last 30 days default

    // All org documents. Analytics uses complete workspace history for exact snapshots and caller-specified period metrics.
    // convex-cost-guard-allow: convex-broad-organization-collect — scoped to one organization and required for exact analytics snapshots; no date cutoff is imposed bound=per-tenant
    // convex-cost-guard-allow: convex-indexed-collect-unbounded-range — scoped to one organization and required for exact analytics snapshots; no date cutoff is imposed bound=per-tenant
    const allDocs: Array<{
      workflowStatus?: string;
      createdAt: number;
      sentAt?: number;
      completedAt?: number;
      cancelledAt?: number;
      declinedAt?: number;
    }> = [];
    for await (const doc of ctx.db
      .query("documents")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", args.organizationId)
      )) {
      allDocs.push(doc);
    }

    // Workspace snapshot (all-time counts)
    const snapshot = {
      draft: 0,
      sent: 0,
      in_progress: 0,
      completed: 0,
      cancelled: 0,
      declined: 0,
    };
    for (const doc of allDocs) {
      const status = doc.workflowStatus ?? "draft";
      switch (status) {
        case "draft":
        case "sent":
        case "in_progress":
        case "completed":
        case "cancelled":
        case "declined":
          snapshot[status]++;
          break;
        default:
          break;
      }
    }

    // Period-filtered documents (by creation date)
    const periodDocs = allDocs.filter(
      (doc) => doc.createdAt >= fromMs && doc.createdAt <= toMs
    );

    const total_created = periodDocs.length;
    const total_sent = periodDocs.filter(
      (d) => d.sentAt !== undefined && d.sentAt >= fromMs && d.sentAt <= toMs
    ).length;
    const completedInPeriod = periodDocs.filter(
      (d) =>
        d.completedAt !== undefined &&
        d.completedAt >= fromMs &&
        d.completedAt <= toMs
    );
    const total_completed = completedInPeriod.length;
    const total_cancelled = periodDocs.filter(
      (d) =>
        d.cancelledAt !== undefined &&
        d.cancelledAt >= fromMs &&
        d.cancelledAt <= toMs
    ).length;
    const total_declined = periodDocs.filter(
      (d) =>
        d.declinedAt !== undefined &&
        d.declinedAt >= fromMs &&
        d.declinedAt <= toMs
    ).length;

    const resolved = total_completed + total_cancelled + total_declined;
    const completion_rate =
      resolved === 0 ? 0 : Math.round((total_completed / resolved) * 100);

    // Median signing time for completed docs that have both sentAt and completedAt
    let median_signing_hours: number | null = null;
    const signingTimes = completedInPeriod
      .filter((d) => d.sentAt !== undefined && d.completedAt !== undefined)
      .map(
        (d) =>
          (sealAssertPresent(d.completedAt) - sealAssertPresent(d.sentAt)) /
          (1000 * 60 * 60)
      );

    if (signingTimes.length >= 2) {
      signingTimes.sort((a, b) => a - b);
      const mid = Math.floor(signingTimes.length / 2);
      median_signing_hours =
        signingTimes.length % 2 === 0
          ? Math.round(
              ((sealAssertPresent(signingTimes[mid - 1]) +
                sealAssertPresent(signingTimes[mid])) /
                2) *
                10
            ) / 10
          : Math.round(sealAssertPresent(signingTimes[mid]) * 10) / 10;
    }

    return {
      period: {
        from: new Date(fromMs).toISOString(),
        to: new Date(toMs).toISOString(),
      },
      documents: {
        total_created,
        total_sent,
        total_completed,
        total_cancelled,
        total_declined,
        completion_rate,
        median_signing_hours,
      },
      workspace_snapshot: snapshot,
    };
  },
});
