/**
 * Advanced Analytics Queries
 *
 * Per-document analytics, email engagement, recipient timing,
 * template performance, and bottleneck detection.
 */

import { v } from "convex/values";

import type { Doc, Id } from "../_generated/dataModel";
import { permissionQuery } from "../auth";

// ─── Helpers ────────────────────────────────────

export function msToHumanReadable(ms: number): string {
  if (ms < 0) return "—";
  const hours = ms / (1000 * 60 * 60);
  if (hours < 1) return `${Math.round(ms / (1000 * 60))}m`;
  if (hours < 24) return `${Math.round(hours)}h`;
  const days = hours / 24;
  return `${days.toFixed(1)}d`;
}

export type TimingBucket = "<1h" | "1-6h" | "6-24h" | "1-3d" | "3-7d" | "7d+";

export function getBucket(ms: number): TimingBucket {
  const hours = ms / (1000 * 60 * 60);
  if (hours < 1) return "<1h";
  if (hours < 6) return "1-6h";
  if (hours < 24) return "6-24h";
  if (hours < 72) return "1-3d";
  if (hours < 168) return "3-7d";
  return "7d+";
}

// ─── Per-Document Analytics ─────────────────────

export const getDocumentAnalytics = permissionQuery("documents:view")({
  args: {
    documentId: v.id("documents"),
  },
  handler: async (ctx, args) => {
    const organizationId = ctx.auth.organization._id;

    // Verify document belongs to org
    const document = await ctx.db.get(args.documentId);
    if (!document || document.organizationId !== organizationId || document.status === "deleted") {
      return null;
    }

    // Get recipients
    const recipients = await ctx.db
      .query("document_recipients")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .collect();

    // Get email logs for this document
    const emailLogs = await ctx.db
      .query("email_logs")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .collect();

    // Recipient funnel
    const funnel = {
      sent: recipients.length,
      viewed: recipients.filter((r) => r.viewedAt).length,
      signed: recipients.filter((r) => r.signedAt || r.approvedAt).length,
      declined: recipients.filter((r) => r.status === "declined").length,
      pending: recipients.filter((r) => r.status === "pending").length,
    };

    // Per-recipient timing
    const recipientTimings = recipients.map((r) => {
      const sentAt = document.sentAt ?? document.createdAt;
      const timeToView = r.viewedAt ? r.viewedAt - sentAt : null;
      const timeToSign = r.signedAt && r.viewedAt ? r.signedAt - r.viewedAt : null;
      const totalTime = r.signedAt ? r.signedAt - sentAt : null;

      return {
        recipientId: r._id,
        name: r.name || r.email,
        email: r.email,
        role: r.role,
        status: r.status,
        timeToView: timeToView !== null ? msToHumanReadable(timeToView) : null,
        timeToSign: timeToSign !== null ? msToHumanReadable(timeToSign) : null,
        totalTime: totalTime !== null ? msToHumanReadable(totalTime) : null,
        daysPending:
          r.status === "pending" ? Math.floor((Date.now() - sentAt) / (1000 * 60 * 60 * 24)) : null,
      };
    });

    // Per-recipient email engagement
    const emailsByRecipient = new Map<string, Doc<"email_logs">[]>();
    for (const log of emailLogs) {
      if (!log.recipientId) continue;
      const key = log.recipientId;
      const existing = emailsByRecipient.get(key) ?? [];
      existing.push(log);
      emailsByRecipient.set(key, existing);
    }

    const emailEngagement = recipients.map((r) => {
      const emails = emailsByRecipient.get(r._id) ?? [];
      return {
        recipientId: r._id,
        name: r.name || r.email,
        emails: emails.map((e) => ({
          type: e.type,
          status: e.status,
          sentAt: e.sentAt,
          deliveredAt: e.deliveredAt,
          openedAt: e.openedAt,
          clickedAt: e.clickedAt,
          bouncedAt: e.bouncedAt,
        })),
      };
    });

    return { funnel, recipientTimings, emailEngagement, documentName: document.name };
  },
});

// ─── Email Engagement Stats (Org-wide) ──────────

export const getEmailEngagementStats = permissionQuery("documents:view")({
  args: {
    days: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const organizationId = ctx.auth.organization._id;
    const days = args.days ?? 30;
    const since = Date.now() - days * 24 * 60 * 60 * 1000;

    const emails = await ctx.db
      .query("email_logs")
      .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
      .filter((q) => q.gte(q.field("createdAt"), since))
      .collect();

    const total = emails.length;
    if (total === 0) {
      return {
        total: 0,
        deliveryRate: 0,
        openRate: 0,
        clickRate: 0,
        bounceRate: 0,
        avgTimeToOpenMs: null,
        avgTimeToOpen: null,
      };
    }

    let delivered = 0;
    let opened = 0;
    let clicked = 0;
    let bounced = 0;
    let openTimeSum = 0;
    let openTimeCount = 0;

    for (const email of emails) {
      if (email.deliveredAt) delivered++;
      if (email.openedAt) opened++;
      if (email.clickedAt) clicked++;
      if (email.bouncedAt) bounced++;
      if (email.openedAt && email.sentAt) {
        openTimeSum += email.openedAt - email.sentAt;
        openTimeCount++;
      }
    }

    const avgTimeToOpenMs = openTimeCount > 0 ? Math.round(openTimeSum / openTimeCount) : null;

    return {
      total,
      deliveryRate: Math.round((delivered / total) * 100),
      openRate: delivered > 0 ? Math.round((opened / delivered) * 100) : 0,
      clickRate: opened > 0 ? Math.round((clicked / opened) * 100) : 0,
      bounceRate: Math.round((bounced / total) * 100),
      avgTimeToOpenMs,
      avgTimeToOpen: avgTimeToOpenMs !== null ? msToHumanReadable(avgTimeToOpenMs) : null,
    };
  },
});

// ─── Recipient Timing Stats (Org-wide) ──────────

export const getRecipientTimingStats = permissionQuery("documents:view")({
  args: {
    days: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const organizationId = ctx.auth.organization._id;
    const days = args.days ?? 30;
    const since = Date.now() - days * 24 * 60 * 60 * 1000;

    // Get documents sent in the date range
    const documents = await ctx.db
      .query("documents")
      .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
      .filter((q) => q.and(q.neq(q.field("status"), "deleted"), q.gte(q.field("createdAt"), since)))
      .collect();

    const sentDocs = documents.filter((d) => d.sentAt);
    if (sentDocs.length === 0) {
      return {
        avgTimeToView: null,
        avgTimeToSign: null,
        avgTotalTurnaround: null,
        distribution: [],
        sampleSize: 0,
      };
    }

    // Get recipients for those documents
    const docSentAtMap = new Map(sentDocs.map((d) => [d._id, d.sentAt!]));

    const allRecipients: Doc<"document_recipients">[] = [];
    for (const doc of sentDocs) {
      const recipients = await ctx.db
        .query("document_recipients")
        .withIndex("by_document", (q) => q.eq("documentId", doc._id))
        .collect();
      allRecipients.push(...recipients);
    }

    let viewTimeSum = 0;
    let viewTimeCount = 0;
    let signTimeSum = 0;
    let signTimeCount = 0;
    let totalTimeSum = 0;
    let totalTimeCount = 0;

    const buckets: Record<TimingBucket, number> = {
      "<1h": 0,
      "1-6h": 0,
      "6-24h": 0,
      "1-3d": 0,
      "3-7d": 0,
      "7d+": 0,
    };

    for (const r of allRecipients) {
      const sentAt = docSentAtMap.get(r.documentId);
      if (!sentAt) continue;

      if (r.viewedAt) {
        const viewTime = r.viewedAt - sentAt;
        viewTimeSum += viewTime;
        viewTimeCount++;
      }

      if (r.signedAt && r.viewedAt) {
        const signTime = r.signedAt - r.viewedAt;
        signTimeSum += signTime;
        signTimeCount++;
      }

      if (r.signedAt) {
        const totalTime = r.signedAt - sentAt;
        totalTimeSum += totalTime;
        totalTimeCount++;
        buckets[getBucket(totalTime)]++;
      }
    }

    return {
      avgTimeToView:
        viewTimeCount > 0 ? msToHumanReadable(Math.round(viewTimeSum / viewTimeCount)) : null,
      avgTimeToSign:
        signTimeCount > 0 ? msToHumanReadable(Math.round(signTimeSum / signTimeCount)) : null,
      avgTotalTurnaround:
        totalTimeCount > 0 ? msToHumanReadable(Math.round(totalTimeSum / totalTimeCount)) : null,
      distribution: Object.entries(buckets).map(([bucket, count]) => ({ bucket, count })),
      sampleSize: allRecipients.length,
    };
  },
});

// ─── Template Performance ───────────────────────

export const getTemplatePerformance = permissionQuery("documents:view")({
  args: {
    days: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const organizationId = ctx.auth.organization._id;
    const days = args.days ?? 90;
    const since = Date.now() - days * 24 * 60 * 60 * 1000;

    const documents = await ctx.db
      .query("documents")
      .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
      .filter((q) =>
        q.and(
          q.neq(q.field("status"), "deleted"),
          q.gte(q.field("createdAt"), since),
          q.neq(q.field("sourceTemplateId"), undefined),
        ),
      )
      .collect();

    // Group by template
    const byTemplate = new Map<string, { docs: Doc<"documents">[]; templateId: string }>();
    for (const doc of documents) {
      if (!doc.sourceTemplateId) continue;
      const key = doc.sourceTemplateId;
      const existing = byTemplate.get(key) ?? { docs: [], templateId: key };
      existing.docs.push(doc);
      byTemplate.set(key, existing);
    }

    const results = [];
    for (const [templateId, { docs }] of byTemplate) {
      // Get template name
      const template = await ctx.db.get(templateId as Id<"templates">);

      const sentDocs = docs.filter((d) => d.sentAt);
      const completedDocs = docs.filter((d) => d.workflowStatus === "completed");
      const declinedDocs = docs.filter((d) => d.workflowStatus === "declined");

      // Avg turnaround for completed
      let turnaroundSum = 0;
      let turnaroundCount = 0;
      for (const doc of completedDocs) {
        if (doc.sentAt && doc.completedAt) {
          turnaroundSum += doc.completedAt - doc.sentAt;
          turnaroundCount++;
        }
      }

      results.push({
        templateId,
        templateName: (template as { name?: string } | null)?.name ?? "Unknown Template",
        docsSent: sentDocs.length,
        completionRate:
          sentDocs.length > 0 ? Math.round((completedDocs.length / sentDocs.length) * 100) : 0,
        avgTurnaround:
          turnaroundCount > 0
            ? msToHumanReadable(Math.round(turnaroundSum / turnaroundCount))
            : null,
        declineRate:
          sentDocs.length > 0 ? Math.round((declinedDocs.length / sentDocs.length) * 100) : 0,
      });
    }

    return results.sort((a, b) => b.docsSent - a.docsSent);
  },
});

// ─── Bottleneck Detection ───────────────────────

export const getDocumentsNeedingAttention = permissionQuery("documents:view")({
  args: {},
  handler: async (ctx) => {
    const organizationId = ctx.auth.organization._id;
    const now = Date.now();
    const threeDaysMs = 3 * 24 * 60 * 60 * 1000;

    // Get active documents (sent or in_progress)
    const documents = await ctx.db
      .query("documents")
      .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
      .filter((q) =>
        q.and(
          q.neq(q.field("status"), "deleted"),
          q.or(
            q.eq(q.field("workflowStatus"), "sent"),
            q.eq(q.field("workflowStatus"), "in_progress"),
          ),
        ),
      )
      .collect();

    const staleRecipients: {
      documentId: string;
      documentName: string;
      recipientName: string;
      recipientEmail: string;
      daysPending: number;
    }[] = [];

    const approachingDeadline: {
      documentId: string;
      documentName: string;
      deadline: number;
      daysRemaining: number;
      unsignedCount: number;
    }[] = [];

    const bouncedEmails: {
      documentId: string;
      documentName: string;
      recipientEmail: string;
    }[] = [];

    for (const doc of documents) {
      const recipients = await ctx.db
        .query("document_recipients")
        .withIndex("by_document", (q) => q.eq("documentId", doc._id))
        .collect();

      const sentAt = doc.sentAt ?? doc.createdAt;

      // Stale recipients (pending 3+ days without viewing)
      for (const r of recipients) {
        if (r.status === "pending" && !r.viewedAt && now - sentAt > threeDaysMs) {
          staleRecipients.push({
            documentId: doc._id,
            documentName: doc.name,
            recipientName: r.name || r.email,
            recipientEmail: r.email,
            daysPending: Math.floor((now - sentAt) / (1000 * 60 * 60 * 24)),
          });
        }
      }

      // Approaching deadline
      if (doc.deadline) {
        const daysRemaining = Math.ceil((doc.deadline - now) / (1000 * 60 * 60 * 24));
        const unsignedCount = recipients.filter(
          (r) => r.status === "pending" || r.status === "viewed",
        ).length;
        if (daysRemaining <= 3 && daysRemaining > 0 && unsignedCount > 0) {
          approachingDeadline.push({
            documentId: doc._id,
            documentName: doc.name,
            deadline: doc.deadline,
            daysRemaining,
            unsignedCount,
          });
        }
      }

      // Bounced emails
      const docEmails = await ctx.db
        .query("email_logs")
        .withIndex("by_document", (q) => q.eq("documentId", doc._id))
        .filter((q) => q.neq(q.field("bouncedAt"), undefined))
        .collect();

      for (const email of docEmails) {
        bouncedEmails.push({
          documentId: doc._id,
          documentName: doc.name,
          recipientEmail: email.toEmail,
        });
      }
    }

    return {
      staleRecipients: staleRecipients.slice(0, 10),
      approachingDeadline: approachingDeadline
        .sort((a, b) => a.daysRemaining - b.daysRemaining)
        .slice(0, 10),
      bouncedEmails: bouncedEmails.slice(0, 10),
      totalIssues: staleRecipients.length + approachingDeadline.length + bouncedEmails.length,
    };
  },
});
