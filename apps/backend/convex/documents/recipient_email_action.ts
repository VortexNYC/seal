/**
 * Recipient Email Actions
 *
 * Handles sending emails after recipient actions (signing, approving, viewing).
 * These are actions (not mutations) because they call external email service.
 */

import { ConvexError, v } from "convex/values";
import { nanoid } from "nanoid";

import { internal } from "../_generated/api";
import type { Doc } from "../_generated/dataModel";
import {
  type ActionCtx,
  internalAction,
  internalMutation,
} from "../_generated/server";
import { logActionRequired } from "../audit_logs/helpers";
import {
  isRecipientComplete,
  isRecipientTerminal,
} from "../schemas/document_recipients";
import {
  sendDocumentCompleted,
  sendDocumentInvitation,
  sendSigningComplete,
} from "./email";
import { groupRecipientsByOrder } from "./recipient_helpers";

/**
 * Internal mutation to mark document as completed
 */
export const markDocumentAsCompleted = internalMutation({
  args: {
    documentId: v.id("documents"),
  },
  handler: async (ctx, args) => {
    const document = await ctx.db.get(args.documentId);
    if (!document || document.status === "deleted") {
      throw new ConvexError("Document not found");
    }

    // Only update if not already completed
    if (document.workflowStatus !== "completed") {
      const now = Date.now();
      const SEVEN_YEARS_MS = 7 * 365.25 * 24 * 60 * 60 * 1000;
      await ctx.db.patch(args.documentId, {
        workflowStatus: "completed",
        completedAt: now,
        updatedAt: now,
        retainUntil: now + SEVEN_YEARS_MS,
        qrToken: nanoid(24),
        qrTokenGeneratedAt: now,
      });

      // Audit trail: record completion as a system action so the transition is
      // observable in the audit log. The workflow runs without a user context,
      // so the actor is "system" rather than an authenticated user.
      await logActionRequired(ctx, {
        organizationId: document.organizationId,
        actorType: "system",
        actorId: "workflow:document_completion",
        action: "document.completed",
        resourceType: "document",
        resourceId: args.documentId,
        documentId: args.documentId,
        oldValues: { workflowStatus: document.workflowStatus },
        newValues: { workflowStatus: "completed", completedAt: now },
        metadata: { source: "documentCompletionWorkflow" },
        ipAddress: "system",
      });
    }

    return { success: true };
  },
});

/**
 * Internal query to get recipient by ID
 */
import { internalQuery } from "../_generated/server";

async function getSenderEmailContext(
  ctx: ActionCtx,
  ownerId: Doc<"documents">["ownerId"],
  organizationId: Doc<"documents">["organizationId"]
) {
  const senderUser = await ctx.runQuery(
    internal.organizations.helpers.getUserById,
    {
      userId: ownerId,
    }
  );
  const brandingSettings = await ctx.runQuery(
    internal.organizations.queries.getBrandingSettingsInternal,
    { organizationId }
  );

  return {
    senderName: senderUser?.name ?? senderUser?.email ?? "Seal User",
    emailBranding: brandingSettings.enabled
      ? {
          emailFromName: brandingSettings.emailFromName,
          emailReplyTo: brandingSettings.emailReplyTo,
        }
      : undefined,
  };
}

async function sendRecipientConfirmationEmail(
  ctx: ActionCtx,
  recipient: Doc<"document_recipients">,
  documentName: string,
  document: Doc<"documents">
) {
  const completedAt =
    recipient.signedAt || recipient.approvedAt || recipient.viewedAt;

  if (!completedAt || !isRecipientComplete(recipient.role, recipient.status)) {
    return false;
  }

  const confirmationResult = await sendSigningComplete(ctx, {
    to: recipient.email,
    recipientName: recipient.name || recipient.email,
    documentName,
    signedAt: completedAt,
    role: recipient.role,
    organizationId: document.organizationId,
    documentId: document._id,
    recipientId: recipient._id,
  });

  if (!confirmationResult.success) {
    console.error(
      "Failed to send confirmation email:",
      confirmationResult.error
    );
  }

  return confirmationResult.success;
}

async function notifyNextSequentialGroup(
  ctx: ActionCtx,
  document: Doc<"documents">,
  recipient: Doc<"document_recipients">,
  allRecipients: Doc<"document_recipients">[]
) {
  if (document.signingMode !== "sequential") {
    return;
  }

  const myOrder = recipient.order ?? 0;
  const groups = groupRecipientsByOrder(allRecipients);
  const myGroup = groups.get(myOrder);

  if (
    !myGroup ||
    !myGroup.every((groupRecipient) =>
      isRecipientTerminal(groupRecipient.status)
    )
  ) {
    return;
  }

  const nextGroup = [...groups.entries()]
    .sort(([firstOrder], [secondOrder]) => firstOrder - secondOrder)
    .find(
      ([order, group]) =>
        order > myOrder &&
        group.some((groupRecipient) => groupRecipient.status === "pending")
    )?.[1];

  if (!nextGroup) {
    return;
  }

  const { senderName, emailBranding } = await getSenderEmailContext(
    ctx,
    document.ownerId,
    document.organizationId
  );
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:5173";

  for (const nextRecipient of nextGroup.filter(
    (groupRecipient) => groupRecipient.status === "pending"
  )) {
    if (nextRecipient.isPlaceholder && document.allowDictateNextSigner) {
      const dictatingRecipient = allRecipients.find(
        (groupRecipient) =>
          groupRecipient.order === myOrder &&
          isRecipientComplete(groupRecipient.role, groupRecipient.status)
      );

      if (dictatingRecipient) {
        await ctx.runMutation(
          internal.documents.recipients_mutations.setAwaitingDictation,
          {
            recipientId: dictatingRecipient._id,
            placeholderRecipientId: nextRecipient._id,
          }
        );
      }
      return;
    }

    await sendDocumentInvitation(ctx, {
      to: nextRecipient.email,
      recipientName: nextRecipient.name || nextRecipient.email,
      documentName: document.name,
      senderName,
      signingUrl: `${baseUrl}/sign/${nextRecipient.signingToken}`,
      expiresAt: nextRecipient.tokenExpiresAt,
      branding: emailBranding,
      organizationId: document.organizationId,
      documentId: document._id,
      recipientId: nextRecipient._id,
    });
  }
}

async function sendCompletionEmailToOwner(
  ctx: ActionCtx,
  document: Doc<"documents">,
  allRecipients: Doc<"document_recipients">[]
) {
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
    {
      userId: document.ownerId,
    }
  );

  if (!owner?.email || notificationSettings?.sendCompletionEmail === false) {
    return false;
  }

  const recipientsSummary = allRecipients
    .filter((currentRecipient) =>
      isRecipientComplete(currentRecipient.role, currentRecipient.status)
    )
    .map((currentRecipient) => ({
      name: currentRecipient.name || currentRecipient.email,
      email: currentRecipient.email,
      role: currentRecipient.role,
      completedAt:
        currentRecipient.signedAt ||
        currentRecipient.approvedAt ||
        currentRecipient.viewedAt ||
        Date.now(),
    }));

  const downloadToken = await ctx.runMutation(
    internal.documents.download_tokens.generateTokenInternal,
    { documentId: document._id, issuedTo: owner.email }
  );
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:5173";
  const convexSiteUrl = process.env.CONVEX_SITE_URL || baseUrl;
  const completionResult = await sendDocumentCompleted(ctx, {
    to: owner.email,
    senderName: owner.name || owner.email,
    documentName: document.name,
    documentUrl: `${baseUrl}/documents/${document._id}`,
    downloadUrl: `${convexSiteUrl}/download?token=${downloadToken}`,
    completedAt: Date.now(),
    recipientsSummary,
    organizationId: document.organizationId,
    documentId: document._id,
  });

  if (!completionResult.success) {
    console.error(
      "Failed to send completion email to owner:",
      completionResult.error
    );
  }

  return completionResult.success;
}

export const getRecipientById = internalQuery({
  args: { recipientId: v.id("document_recipients") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.recipientId);
  },
});

/**
 * Send post-signature emails after a recipient completes their action
 *
 * This action is called after a recipient signs/approves/views a document.
 * It sends:
 * 1. Confirmation email to the recipient
 * 2. If all recipients are complete, notification email to the document owner
 */
export const sendPostSignatureEmails = internalAction({
  args: {
    recipientId: v.id("document_recipients"),
    documentId: v.id("documents"),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    confirmationSent: boolean;
    completionEmailSent: boolean;
    documentCompleted: boolean;
    error?: string;
  }> => {
    const recipient: Doc<"document_recipients"> | null = await ctx.runQuery(
      internal.documents.recipient_email_action.getRecipientById,
      { recipientId: args.recipientId }
    );

    if (!recipient) {
      return {
        confirmationSent: false,
        completionEmailSent: false,
        documentCompleted: false,
        error: "Recipient not found",
      };
    }

    const document: Doc<"documents"> | null = await ctx.runQuery(
      internal.documents.queries.getDocumentInternal,
      { documentId: args.documentId }
    );

    if (!document) {
      return {
        confirmationSent: false,
        completionEmailSent: false,
        documentCompleted: false,
        error: "Document not found",
      };
    }

    const confirmationSent = await sendRecipientConfirmationEmail(
      ctx,
      recipient,
      document.name,
      document
    );
    const allRecipients: Doc<"document_recipients">[] = await ctx.runQuery(
      internal.documents.recipients_queries.getDocumentRecipientsInternal,
      { documentId: args.documentId }
    );
    const allComplete = allRecipients.every((r) =>
      isRecipientComplete(r.role, r.status)
    );

    if (!allComplete) {
      await notifyNextSequentialGroup(ctx, document, recipient, allRecipients);
    }

    let completionEmailSent = false;

    if (allComplete) {
      await ctx.runMutation(
        internal.documents.recipient_email_action.markDocumentAsCompleted,
        {
          documentId: args.documentId,
        }
      );

      await ctx.scheduler.runAfter(
        0,
        internal.documents.certificate_of_completion.generateCertificate,
        { documentId: args.documentId }
      );
      completionEmailSent = await sendCompletionEmailToOwner(
        ctx,
        document,
        allRecipients
      );
    }

    return {
      confirmationSent,
      completionEmailSent,
      documentCompleted: allComplete,
    };
  },
});

/**
 * Internal action: send signing invitation to a newly-dictated recipient.
 * Called after dictateNextRecipient sets the placeholder's real name/email/token.
 */
export const sendNextRecipientInvitation = internalAction({
  args: {
    documentId: v.id("documents"),
    recipientId: v.id("document_recipients"),
  },
  handler: async (ctx, args) => {
    const document = await ctx.runQuery(
      internal.documents.queries.getDocumentInternal,
      {
        documentId: args.documentId,
      }
    );
    if (!document) return;

    const recipient = await ctx.runQuery(
      internal.documents.recipients_queries.getRecipientInternal,
      { recipientId: args.recipientId }
    );
    if (!recipient || recipient.isPlaceholder) return;

    const { senderName, emailBranding } = await getSenderEmailContext(
      ctx,
      document.ownerId,
      document.organizationId
    );
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:5173";

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
  },
});
