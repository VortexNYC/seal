/**
 * Dashboard queries
 *
 * SEA-129: Sender Dashboard
 *
 * Queries for dashboard statistics, recent activity, and analytics
 */

import { v } from "convex/values";

import type { Doc } from "../_generated/dataModel";
import { adminQuery, permissionQuery } from "../auth";
import { listComponentMembersByOrganization } from "../lib/componentOrgReads";
import { documentWorkflowStatusTuple } from "../schemas/document_workflow_status";

// Convex tsconfig lib is ES2021; Node runtime has Array#toSorted (ES2023).
declare global {
  interface Array<T> {
    toSorted(compareFn?: (a: T, b: T) => number): T[];
  }
}

function averageSigningTimeMs(
  documents: Array<{
    workflowStatus?: string;
    sentAt?: number;
    completedAt?: number;
  }>
): number | null {
  let totalMs = 0;
  let count = 0;
  for (const d of documents) {
    if (d.workflowStatus !== "completed") continue;
    const sentAt = d.sentAt;
    const completedAt = d.completedAt;
    if (sentAt === undefined || completedAt === undefined) continue;
    totalMs += completedAt - sentAt;
    count++;
  }
  if (count === 0) return null;
  return Math.round(totalMs / count);
}

/**
 * Get document statistics for the dashboard
 * Returns counts by workflow status
 */
export const getDocumentStats = permissionQuery("documents:view")({
  args: {
    scope: v.optional(v.union(v.literal("personal"), v.literal("team"))),
  },
  handler: async (ctx, args) => {
    const organizationId = ctx.auth.organization._id;
    const isAdmin = ctx.auth.isAdmin();
    // Non-admins are forced to personal scope regardless of what they request
    const scope = isAdmin ? (args.scope ?? "team") : "personal";

    let documents: Doc<"documents">[] = [];
    for await (const doc of ctx.db
      .query("documents")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", organizationId)
      )) {
      if (doc.status !== "deleted") {
        documents.push(doc);
      }
    }

    if (scope === "personal") {
      documents = documents.filter((d) => d.ownerId === ctx.auth.user._id);
    }

    // Calculate stats
    const stats = {
      total: documents.length,
      draft: 0,
      sent: 0,
      inProgress: 0,
      completed: 0,
      cancelled: 0,
      declined: 0,
      expired: 0,
    };

    for (const doc of documents) {
      const status = doc.workflowStatus ?? "draft";
      switch (status) {
        case "draft":
          stats.draft++;
          break;
        case "sent":
          stats.sent++;
          break;
        case "in_progress":
          stats.inProgress++;
          break;
        case "completed":
          stats.completed++;
          break;
        case "cancelled":
          stats.cancelled++;
          break;
        case "declined":
          stats.declined++;
          break;
        case "expired":
          stats.expired++;
          break;
      }
    }

    // Calculate pending (sent + in_progress)
    const pending = stats.sent + stats.inProgress;

    // Calculate completion rate (completed / (completed + cancelled + declined))
    const finishedDocs = stats.completed + stats.cancelled + stats.declined;
    const completionRate =
      finishedDocs > 0 ? Math.round((stats.completed / finishedDocs) * 100) : 0;

    const avgSigningTimeMs = averageSigningTimeMs(documents);

    return {
      ...stats,
      pending,
      completionRate,
      avgSigningTimeMs,
      isAdmin,
    };
  },
});

/**
 * Get recent documents for the dashboard
 * Returns the 10 most recently updated documents
 */
export const getRecentDocuments = permissionQuery("documents:view")({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const organizationId = ctx.auth.organization._id;
    const limit = args.limit ?? 10;

    const documents: Doc<"documents">[] = [];
    for await (const doc of ctx.db
      .query("documents")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", organizationId)
      )
      .order("desc")) {
      if (doc.status === "deleted") continue;
      documents.push(doc);
      if (documents.length >= limit) break;
    }

    // Enrich with recipient count
    const enrichedDocs = await Promise.all(
      documents.map(async (doc) => {
        const recipients: Doc<"document_recipients">[] = [];
        for await (const recipient of ctx.db
          .query("document_recipients")
          .withIndex("by_document", (q) => q.eq("documentId", doc._id))) {
          recipients.push(recipient);
        }

        const signedCount = recipients.filter(
          (r) => r.status === "signed"
        ).length;

        return {
          _id: doc._id,
          name: doc.name,
          workflowStatus: doc.workflowStatus ?? "draft",
          createdAt: doc.createdAt,
          updatedAt: doc.updatedAt,
          thumbnailDataUrl: doc.thumbnailDataUrl,
          recipientCount: recipients.length,
          signedCount,
        };
      })
    );

    return enrichedDocs;
  },
});

/**
 * Get document volume trends for charts
 * Returns document counts grouped by day for the last 30 days
 */
export const getDocumentTrends = permissionQuery("documents:view")({
  args: {
    days: v.optional(v.number()),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
    scope: v.optional(v.union(v.literal("personal"), v.literal("team"))),
  },
  handler: async (ctx, args) => {
    const organizationId = ctx.auth.organization._id;
    const scope = ctx.auth.isAdmin() ? (args.scope ?? "team") : "personal";
    const { startDate, endDate } = getTrendRange(args);

    let documents: Doc<"documents">[] = [];
    for await (const doc of ctx.db
      .query("documents")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", organizationId)
      )) {
      if (doc.status === "deleted") continue;
      if (doc.createdAt < startDate || doc.createdAt > endDate) continue;
      documents.push(doc);
    }

    if (scope === "personal") {
      documents = documents.filter((d) => d.ownerId === ctx.auth.user._id);
    }

    // Get completed documents in the time range (by updatedAt)
    const completedDocs = documents.filter(
      (d) =>
        d.workflowStatus === "completed" &&
        d.updatedAt &&
        d.updatedAt >= startDate
    );

    const dailyStats = buildDailyTrendStats(
      startDate,
      endDate,
      documents,
      completedDocs
    );

    // Convert to array and sort by date
    const trend = Array.from(dailyStats.entries())
      .map(([date, stats]) => ({
        date,
        created: stats.created,
        completed: stats.completed,
      }))
      .toSorted((a, b) => a.date.localeCompare(b.date));

    return trend;
  },
});

function getTrendRange(args: {
  days?: number;
  startDate?: number;
  endDate?: number;
}): {
  startDate: number;
  endDate: number;
} {
  const now = Date.now();
  const endDate = args.endDate ?? now;
  const days = args.days ?? 30;
  const startDate = args.startDate ?? endDate - days * 24 * 60 * 60 * 1000;
  return { startDate, endDate };
}

function getDateKey(timestamp: number): string {
  return new Date(timestamp).toISOString().split("T")[0] ?? "";
}

function buildDailyTrendStats(
  startDate: number,
  endDate: number,
  documents: Array<{ createdAt: number }>,
  completedDocs: Array<{ updatedAt?: number }>
): Map<string, { created: number; completed: number }> {
  const dailyStats = new Map<string, { created: number; completed: number }>();
  const rangeDays = Math.ceil((endDate - startDate) / (24 * 60 * 60 * 1000));

  for (let i = 0; i <= rangeDays; i++) {
    const dateKey = getDateKey(startDate + i * 24 * 60 * 60 * 1000);
    if (dateKey) {
      dailyStats.set(dateKey, { created: 0, completed: 0 });
    }
  }

  for (const doc of documents) {
    const existing = dailyStats.get(getDateKey(doc.createdAt));
    if (existing) {
      existing.created++;
    }
  }

  for (const doc of completedDocs) {
    if (!doc.updatedAt) {
      continue;
    }

    const existing = dailyStats.get(getDateKey(doc.updatedAt));
    if (existing) {
      existing.completed++;
    }
  }

  return dailyStats;
}

/**
 * Get recent activity/audit logs for the dashboard
 * Returns recent actions in the workspace
 */
export const getRecentActivity = permissionQuery("documents:view")({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    if (
      !ctx.auth.hasPermission("audit:view") &&
      !ctx.auth.hasPermission("audit:read")
    ) {
      return [];
    }

    const organizationId = ctx.auth.organization._id;
    const limit = args.limit ?? 20;

    const logs = await ctx.db
      .query("audit_logs")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", organizationId)
      )
      .order("desc")
      .take(limit);

    // Enrich with user info
    const enrichedLogs = await Promise.all(
      logs.map(async (log) => {
        let actorName = "System";
        let actorEmail = "";

        // actorId stores auth subject as string, need to look up by authSubject
        const actorId = log.actorId;
        if (actorId && log.actorType === "user") {
          const user = await ctx.db
            .query("users")
            .withIndex("by_auth_subject", (q) => q.eq("authSubject", actorId))
            .first();
          if (user) {
            actorName = user.name ?? user.email.split("@")[0] ?? "Unknown";
            actorEmail = user.email;
          }
        } else if (log.actorType === "recipient" && log.recipientId) {
          const recipient = await ctx.db.get(
            "document_recipients",
            log.recipientId
          );
          if (recipient) {
            actorName =
              recipient.name ?? recipient.email.split("@")[0] ?? "Unknown";
            actorEmail = recipient.email;
          }
        }

        return {
          _id: log._id,
          action: log.action,
          resourceType: log.resourceType,
          resourceId: log.resourceId,
          metadata: log.metadata,
          timestamp: log.createdAt,
          actorName,
          actorEmail,
        };
      })
    );

    return enrichedLogs;
  },
});

/**
 * Get summary stats for a specific time period
 * Used for "this week", "this month" comparisons
 */
export const getPeriodStats = permissionQuery("documents:view")({
  args: {
    period: v.union(
      v.literal("today"),
      v.literal("week"),
      v.literal("month"),
      v.literal("year")
    ),
    scope: v.optional(v.union(v.literal("personal"), v.literal("team"))),
  },
  handler: async (ctx, args) => {
    const organizationId = ctx.auth.organization._id;
    const now = Date.now();
    const scope = ctx.auth.isAdmin() ? (args.scope ?? "team") : "personal";

    // Calculate start date based on period
    let startDate: number;
    switch (args.period) {
      case "today":
        startDate = new Date().setHours(0, 0, 0, 0);
        break;
      case "week":
        startDate = now - 7 * 24 * 60 * 60 * 1000;
        break;
      case "month":
        startDate = now - 30 * 24 * 60 * 60 * 1000;
        break;
      case "year":
        startDate = now - 365 * 24 * 60 * 60 * 1000;
        break;
    }

    let allDocs: Doc<"documents">[] = [];
    for await (const doc of ctx.db
      .query("documents")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", organizationId)
      )) {
      if (doc.status !== "deleted") {
        allDocs.push(doc);
      }
    }

    if (scope === "personal") {
      allDocs = allDocs.filter((d) => d.ownerId === ctx.auth.user._id);
    }

    const documents = allDocs.filter((d) => d.createdAt >= startDate);

    const completed = allDocs.filter(
      (d) =>
        d.workflowStatus === "completed" &&
        d.updatedAt &&
        d.updatedAt >= startDate
    ).length;

    return {
      created: documents.length,
      completed,
      period: args.period,
    };
  },
});

/**
 * SEA-132: Get documents data for export (CSV/PDF)
 * Returns detailed document data with recipients for reporting
 */
export const getDocumentsForExport = permissionQuery("documents:view")({
  args: {
    workflowStatus: v.optional(documentWorkflowStatusTuple),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const organizationId = ctx.auth.organization._id;

    // Get all non-deleted documents
    let documents: Doc<"documents">[] = [];
    for await (const doc of ctx.db
      .query("documents")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", organizationId)
      )) {
      if (doc.status !== "deleted") {
        documents.push(doc);
      }
    }

    // Apply filters
    if (args.workflowStatus) {
      documents = documents.filter(
        (d) => (d.workflowStatus ?? "draft") === args.workflowStatus
      );
    }

    if (args.startDate !== undefined) {
      const startDate = args.startDate;
      documents = documents.filter((d) => d.createdAt >= startDate);
    }

    if (args.endDate !== undefined) {
      const endDate = args.endDate;
      documents = documents.filter((d) => d.createdAt <= endDate);
    }

    // Enrich with recipient data
    const enrichedDocs = await Promise.all(
      documents.map(async (doc) => {
        const recipients: Doc<"document_recipients">[] = [];
        for await (const recipient of ctx.db
          .query("document_recipients")
          .withIndex("by_document", (q) => q.eq("documentId", doc._id))) {
          recipients.push(recipient);
        }

        const owner = await ctx.db.get("users", doc.ownerId);

        return {
          id: doc._id,
          name: doc.name,
          status: doc.workflowStatus ?? "draft",
          createdAt: doc.createdAt,
          sentAt: doc.sentAt,
          completedAt: doc.completedAt,
          deadline: doc.deadline,
          ownerName: owner?.name ?? owner?.email ?? "Unknown",
          ownerEmail: owner?.email ?? "",
          recipientCount: recipients.length,
          signedCount: recipients.filter((r) => r.status === "signed").length,
          pendingCount: recipients.filter((r) => r.status === "pending").length,
          recipients: recipients.map((r) => ({
            email: r.email,
            name: r.name ?? "",
            role: r.role,
            status: r.status,
            signedAt: r.signedAt,
            viewedAt: r.viewedAt,
          })),
        };
      })
    );

    // Sort by createdAt descending
    return enrichedDocs.toSorted((a, b) => b.createdAt - a.createdAt);
  },
});

/**
 * Get per-member document activity breakdown (admin only)
 * Returns document created/completed counts per workspace member
 */
export const getMemberActivity = adminQuery({
  args: {},
  handler: async (ctx) => {
    const organizationId = ctx.auth.organization._id;

    const members = await listComponentMembersByOrganization(
      ctx,
      ctx.auth.organization,
      {
        status: "active",
      }
    );

    // Get all non-deleted documents
    const documents: Doc<"documents">[] = [];
    for await (const doc of ctx.db
      .query("documents")
      .withIndex("by_organization", (q) =>
        q.eq("organizationId", organizationId)
      )) {
      if (doc.status !== "deleted") {
        documents.push(doc);
      }
    }

    // Build per-member stats
    const memberStats = await Promise.all(
      members.map(async (member) => {
        if (!member.userId) {
          return null;
        }
        const user = await ctx.db.get("users", member.userId);
        const memberDocs = documents.filter((d) => d.ownerId === member.userId);

        const created = memberDocs.length;
        const completed = memberDocs.filter(
          (d) => d.workflowStatus === "completed"
        ).length;
        const pending = memberDocs.filter(
          (d) =>
            d.workflowStatus === "sent" || d.workflowStatus === "in_progress"
        ).length;

        const avgSigningTimeMs = averageSigningTimeMs(memberDocs);

        return {
          userId: member.userId,
          name: user?.name ?? user?.email?.split("@")[0] ?? "Unknown",
          email: user?.email ?? "",
          avatar: user?.avatar ?? null,
          role: member.role,
          created,
          completed,
          pending,
          completionRate:
            created > 0 ? Math.round((completed / created) * 100) : 0,
          avgSigningTimeMs,
        };
      })
    );

    // Sort by created count descending
    const resolvedMemberStats = memberStats.filter((stat) => stat !== null);
    return resolvedMemberStats.toSorted((a, b) => b.created - a.created);
  },
});
