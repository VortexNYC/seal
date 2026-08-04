/**
 * Step functions for the document completion workflow.
 *
 * Each function is an independently retryable unit extracted from the
 * monolithic `sendPostSignatureEmails` action. They are called via
 * `step.runAction` / `step.runMutation` / `step.runQuery` from the
 * workflow definitions in `document_completion.ts`.
 */

import { v } from "convex/values";

import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import {
  type ActionCtx,
  internalAction,
  internalMutation,
  internalQuery,
} from "../_generated/server";
import {
  sendDocumentCompleted,
  sendDocumentInvitation,
  sendSigningComplete,
} from "../documents/email";
import { groupRecipientsByOrder } from "../documents/recipient_helpers";
import {
  isRecipientComplete,
  isRecipientTerminal,
} from "../schemas/document_recipients";

function getNextPendingSequentialGroup(
  groups: Map<number, Doc<"document_recipients">[]>,
  currentOrder: number
): Doc<"document_recipients">[] | null {
  const sortedOrders = [...groups.keys()];

  for (const order of sortedOrders) {
    if (order <= currentOrder) {
      continue;
    }

    const nextGroup = groups.get(order);
    if (!nextGroup) {
      continue;
    }

    const pendingRecipients = nextGroup.filter(
      (recipient) => recipient.status === "pending"
    );
    if (pendingRecipients.length > 0) {
      return pendingRecipients;
    }
  }

  return null;
}

async function notifySequentialRecipients(
  ctx: ActionCtx,
  document: Doc<"documents">,
  recipients: Doc<"document_recipients">[]
): Promise<number> {
  const senderUser = await ctx.runQuery(
    internal.organizations.helpers.getUserById,
    {
      userId: document.ownerId,
    }
  );
  const senderName = senderUser?.name ?? senderUser?.email ?? "Seal User";
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:5173";

  const brandingSettings = await ctx.runQuery(
    internal.organizations.queries.getBrandingSettingsInternal,
    { organizationId: document.organizationId }
  );
  const emailBranding = brandingSettings.enabled
    ? {
        emailFromName: brandingSettings.emailFromName,
        emailReplyTo: brandingSettings.emailReplyTo,
      }
    : undefined;

  let notifiedCount = 0;
  for (const recipient of recipients) {
    const signingUrl = `${baseUrl}/sign/${recipient.signingToken}`;
    await sendDocumentInvitation(ctx, {
      to: recipient.email,
      recipientName: recipient.name || recipient.email,
      documentName: document.name,
      senderName,
      signingUrl,
      expiresAt: recipient.tokenExpiresAt,
      branding: emailBranding,
      organizationId: document.organizationId,
      documentId: document._id,
      recipientId: recipient._id,
    });
    notifiedCount++;
  }

  return notifiedCount;
}

/**
 * Step 1: Send confirmation email to the signer/approver who just completed.
 */
export const sendSignerConfirmation = internalAction({
  args: {
    recipientId: v.id("document_recipients"),
    documentId: v.id("documents"),
  },
  handler: async (ctx, args): Promise<{ sent: boolean }> => {
    const recipient: Doc<"document_recipients"> | null = await ctx.runQuery(
      internal.documents.recipient_email_action.getRecipientById,
      { recipientId: args.recipientId }
    );
    if (!recipient) return { sent: false };

    const document: Doc<"documents"> | null = await ctx.runQuery(
      internal.documents.queries.getDocumentInternal,
      { documentId: args.documentId }
    );
    if (!document) return { sent: false };

    const completedAt =
      recipient.signedAt || recipient.approvedAt || recipient.viewedAt;
    if (
      !completedAt ||
      !isRecipientComplete(recipient.role, recipient.status)
    ) {
      return { sent: false };
    }

    const result = await sendSigningComplete(ctx, {
      to: recipient.email,
      recipientName: recipient.name || recipient.email,
      documentName: document.name,
      signedAt: completedAt,
      role: recipient.role,
      organizationId: document.organizationId,
      documentId: document._id,
      recipientId: recipient._id,
    });

    if (!result.success) {
      console.error("Failed to send confirmation email:", result.error);
    }

    return { sent: result.success };
  },
});

/**
 * Step 2: If sequential mode, notify the next group of recipients.
 */
export const notifyNextSequentialGroup = internalAction({
  args: {
    recipientId: v.id("document_recipients"),
    documentId: v.id("documents"),
  },
  handler: async (ctx, args): Promise<{ notified: number }> => {
    const recipient: Doc<"document_recipients"> | null = await ctx.runQuery(
      internal.documents.recipient_email_action.getRecipientById,
      { recipientId: args.recipientId }
    );
    if (!recipient) return { notified: 0 };

    const document: Doc<"documents"> | null = await ctx.runQuery(
      internal.documents.queries.getDocumentInternal,
      { documentId: args.documentId }
    );
    if (!document || document.signingMode !== "sequential")
      return { notified: 0 };

    const allRecipients: Doc<"document_recipients">[] = await ctx.runQuery(
      internal.documents.recipients_queries.getDocumentRecipientsInternal,
      { documentId: args.documentId }
    );

    const allComplete = allRecipients.every((r) =>
      isRecipientComplete(r.role, r.status)
    );
    if (allComplete) return { notified: 0 };

    const myOrder = recipient.order ?? 0;
    const groups = groupRecipientsByOrder(allRecipients);
    const myGroup = groups.get(myOrder);

    if (!myGroup || !myGroup.every((r) => isRecipientTerminal(r.status))) {
      return { notified: 0 };
    }

    const nextGroup = getNextPendingSequentialGroup(groups, myOrder);
    if (!nextGroup) {
      return { notified: 0 };
    }

    const notified = await notifySequentialRecipients(ctx, document, nextGroup);
    return { notified };
  },
});

/**
 * Step 3: Check if all recipients have completed their action.
 */
export const checkAllRecipientsComplete = internalQuery({
  args: {
    documentId: v.id("documents"),
  },
  handler: async (ctx, args): Promise<{ allComplete: boolean }> => {
    const allRecipients = await ctx.db
      .query("document_recipients")
      .withIndex("by_document", (q) => q.eq("documentId", args.documentId))
      .collect();

    const allComplete = allRecipients.every((r) =>
      isRecipientComplete(r.role, r.status)
    );
    return { allComplete };
  },
});

/**
 * Step 4: Guard mutation that starts the completion workflow exactly once.
 * Uses the document's `completionWorkflowStarted` flag to prevent duplicates
 * when two recipients sign simultaneously.
 */
export const triggerDocumentCompletion = internalMutation({
  args: {
    documentId: v.id("documents"),
  },
  handler: async (ctx, args): Promise<{ shouldComplete: boolean }> => {
    const document = await ctx.db.get(args.documentId);
    if (!document || document.status === "deleted") {
      return { shouldComplete: false };
    }

    // Already completed or completion already triggered
    if (document.workflowStatus === "completed") {
      return { shouldComplete: false };
    }

    return { shouldComplete: true };
  },
});

/**
 * Step 5: Send completion emails to the document owner.
 */
export const sendCompletionEmails = internalAction({
  args: {
    documentId: v.id("documents"),
  },
  handler: async (ctx, args): Promise<{ sent: boolean }> => {
    const document: Doc<"documents"> | null = await ctx.runQuery(
      internal.documents.queries.getDocumentInternal,
      { documentId: args.documentId }
    );
    if (!document) return { sent: false };

    // Check org notification settings
    const notificationSettings = document.organizationId
      ? await ctx.runQuery(
          internal.organizations.queries.getNotificationSettingsInternal,
          {
            organizationId: document.organizationId,
          }
        )
      : null;

    const owner: Doc<"users"> | null = await ctx.runQuery(
      internal.organizations.helpers.getUserById,
      { userId: document.ownerId }
    );

    if (!owner?.email || notificationSettings?.sendCompletionEmail === false) {
      return { sent: false };
    }

    // Build recipients summary
    const allRecipients: Doc<"document_recipients">[] = await ctx.runQuery(
      internal.documents.recipients_queries.getDocumentRecipientsInternal,
      { documentId: args.documentId }
    );

    const recipientsSummary = allRecipients
      .filter((r) => isRecipientComplete(r.role, r.status))
      .map((r) => ({
        name: r.name || r.email,
        email: r.email,
        role: r.role,
        completedAt: r.signedAt || r.approvedAt || r.viewedAt || Date.now(),
      }));

    // Generate download token
    const downloadToken = await ctx.runMutation(
      internal.documents.download_tokens.generateTokenInternal,
      { documentId: document._id, issuedTo: owner.email }
    );

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:5180";
    const convexSiteUrl = process.env.CONVEX_SITE_URL || baseUrl;
    const documentUrl = `${baseUrl}/documents/${document._id}`;
    const downloadUrl = `${convexSiteUrl}/download?token=${downloadToken}`;

    const result = await sendDocumentCompleted(ctx, {
      to: owner.email,
      senderName: owner.name || owner.email,
      documentName: document.name,
      documentUrl,
      downloadUrl,
      completedAt: Date.now(),
      recipientsSummary,
      organizationId: document.organizationId,
      documentId: document._id,
    });

    if (!result.success) {
      console.error("Failed to send completion email to owner:", result.error);
    }

    return { sent: result.success };
  },
});
