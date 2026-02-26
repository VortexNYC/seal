/**
 * Document Expiration Alert Processing
 *
 * Cron-driven function that checks documents approaching their deadline
 * and sends alert emails to the document owner based on org expirationAlertDays.
 */

import { v } from "convex/values";

import { internal } from "../_generated/api";
import { internalAction, internalMutation, internalQuery } from "../_generated/server";
import { sendExpirationAlert } from "./email";

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Query documents approaching their deadline.
 * Returns documents with deadlines within the alert window that haven't been alerted yet.
 */
export const getDocumentsApproachingDeadline = internalQuery({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();

    // Get all active documents with deadlines
    const sentDocs = await ctx.db
      .query("documents")
      .withIndex("by_workflow_status", (q) => q.eq("workflowStatus", "sent"))
      .collect();
    const inProgressDocs = await ctx.db
      .query("documents")
      .withIndex("by_workflow_status", (q) => q.eq("workflowStatus", "in_progress"))
      .collect();

    const activeDocs = [...sentDocs, ...inProgressDocs].filter(
      (doc) => doc.deadline && doc.organizationId && doc.status !== "deleted",
    );

    // Group by org for settings lookup
    const docsByOrg = new Map<string, typeof activeDocs>();
    for (const doc of activeDocs) {
      const orgId = doc.organizationId as string;
      if (!docsByOrg.has(orgId)) {
        docsByOrg.set(orgId, []);
      }
      docsByOrg.get(orgId)!.push(doc);
    }

    const alertCandidates: Array<{
      documentId: typeof activeDocs[0]["_id"];
      documentName: string;
      ownerId: typeof activeDocs[0]["ownerId"];
      organizationId: typeof activeDocs[0]["organizationId"];
      deadline: number;
      daysRemaining: number;
    }> = [];

    for (const [orgId, docs] of docsByOrg) {
      const org = await ctx.db.get(orgId as typeof docs[0]["organizationId"]);
      const expirationAlertDays = org?.notificationSettings?.expirationAlertDays ?? 3;

      for (const doc of docs) {
        const daysUntilDeadline = Math.ceil((doc.deadline! - now) / DAY_MS);

        // Alert if within the configured window, not already past, and not already alerted
        const alreadyAlerted = (doc.expirationAlertsSent ?? []).includes(daysUntilDeadline);
        if (daysUntilDeadline > 0 && daysUntilDeadline <= expirationAlertDays && !alreadyAlerted) {
          alertCandidates.push({
            documentId: doc._id,
            documentName: doc.name,
            ownerId: doc.ownerId,
            organizationId: doc.organizationId,
            deadline: doc.deadline!,
            daysRemaining: daysUntilDeadline,
          });
        }
      }
    }

    return alertCandidates;
  },
});

/**
 * Record that an expiration alert was sent to prevent duplicate alerts.
 */
export const recordExpirationAlert = internalMutation({
  args: {
    documentId: v.id("documents"),
    alertedAt: v.number(),
    daysRemaining: v.number(),
  },
  handler: async (ctx, args) => {
    const doc = await ctx.db.get(args.documentId);
    if (!doc) return;

    // Store alert timestamp on the document to prevent re-alerting
    const existingAlerts = (doc.expirationAlertsSent as number[] | undefined) ?? [];
    await ctx.db.patch(args.documentId, {
      expirationAlertsSent: [...existingAlerts, args.daysRemaining],
    });
  },
});

/**
 * Process expiration alerts — called by cron daily.
 * Finds documents approaching their deadline and sends owner notifications.
 */
export const processExpirationAlerts = internalAction({
  args: {},
  handler: async (ctx) => {
    const candidates = await ctx.runQuery(
      internal.documents.expiration_alerts.getDocumentsApproachingDeadline,
    );

    let alertsSent = 0;

    for (const candidate of candidates) {
      // Get owner info
      const owner = await ctx.runQuery(internal.organizations.helpers.getUserById, {
        userId: candidate.ownerId,
      });
      if (!owner?.email) continue;

      // Get pending recipients
      const recipients = await ctx.runQuery(
        internal.documents.recipients_queries.getDocumentRecipientsInternal,
        { documentId: candidate.documentId },
      );
      const pendingRecipients = recipients
        .filter((r) => r.status === "pending" || r.status === "viewed")
        .map((r) => ({ name: r.name || r.email, email: r.email }));

      if (pendingRecipients.length === 0) continue;

      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:5173";
      const documentUrl = `${baseUrl}/documents/${candidate.documentId}`;

      const result = await sendExpirationAlert({
        to: owner.email,
        ownerName: owner.name || owner.email,
        documentName: candidate.documentName,
        documentUrl,
        expiresAt: candidate.deadline,
        daysRemaining: candidate.daysRemaining,
        pendingRecipients,
      });

      if (result.success) {
        await ctx.runMutation(internal.documents.expiration_alerts.recordExpirationAlert, {
          documentId: candidate.documentId,
          alertedAt: Date.now(),
          daysRemaining: candidate.daysRemaining,
        });
        alertsSent++;
      } else {
        console.error(
          `Failed to send expiration alert for document ${candidate.documentId}:`,
          result.error,
        );
      }
    }

    return { alertsSent };
  },
});
