/**
 * Email sending utilities using Seal's direct Resend transport and @seal/email templates.
 *
 * Each function accepts an ActionCtx as first parameter to integrate with the
 * direct transport's `sendEmailManuallyFromAction` for idempotency and webhook
 * correlation.
 */

import {
  renderDocumentCompleted,
  renderDocumentExpirationAlert,
  renderDocumentExpired,
  renderDocumentInvitation,
  renderDocumentReminder,
  renderDocumentShared,
  renderDocumentViewed,
  renderSigningComplete,
  renderTeamInvitation,
  renderWelcome,
} from "@seal/transactional";

import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { ActionCtx } from "../_generated/server";
import { sendEmailManuallyFromAction, sendResendEmail } from "../emails/resend_component";
function sealAssertPresent<T>(
  value: T | null | undefined,
  message = "Expected value to be present.",
): NonNullable<T> {
  if (value === null || value === undefined) {
    throw new Error(message);
  }
  return value;
}

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "Seal <no-reply@seal.nyc>";

/**
 * Best-effort `email.queued` audit entry. Logged whenever a Resend send
 * succeeds — gives prod operators (and the recipient-signing E2E) a
 * trace from "queued" through "delivered"/"opened"/"bounced" entirely
 * via the audit log. Swallow errors so audit gaps never crash sending.
 */
async function logEmailQueuedSafe(
  ctx: ActionCtx,
  args: {
    organizationId: Id<"organizations">;
    messageId: string;
    to: string;
    subject: string;
    documentId?: Id<"documents">;
    recipientId?: Id<"document_recipients">;
  },
): Promise<void> {
  try {
    await ctx.runMutation(internal.emails.resend_component.logEmailQueued, args);
  } catch (error) {
    console.warn("[email] failed to write email.queued audit entry:", error);
  }
}

export interface EmailBrandingParams {
  emailFromName?: string;
  emailReplyTo?: string;
}

export interface SendDocumentInvitationParams {
  to: string;
  recipientName: string;
  documentName: string;
  senderName: string;
  signingUrl: string;
  customMessage?: string;
  expiresAt?: number;
  invoiceUrl?: string;
  invoiceAmount?: number;
  invoiceCurrency?: string;
  branding?: EmailBrandingParams;
  organizationId: Id<"organizations">;
  documentId: Id<"documents">;
  recipientId: Id<"document_recipients">;
}

/**
 * Send document invitation email to recipient
 */
export async function sendDocumentInvitation(
  ctx: ActionCtx,
  params: SendDocumentInvitationParams,
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const {
      to,
      recipientName,
      documentName,
      senderName,
      signingUrl,
      customMessage,
      expiresAt,
      invoiceUrl,
      invoiceAmount,
      invoiceCurrency,
      branding,
    } = params;

    const html = await renderDocumentInvitation({
      recipientName,
      senderName,
      documentName,
      signingUrl,
      customMessage,
      expiresAt,
      invoiceUrl,
      invoiceAmount,
      invoiceCurrency,
    });

    const fromEmail = branding?.emailFromName
      ? `${branding.emailFromName} <no-reply@seal.nyc>`
      : FROM_EMAIL;

    const subject = `${senderName} sent you a document to sign: ${documentName}`;

    const emailId = await sendEmailManuallyFromAction(
      ctx,
      {
        from: fromEmail,
        to: [to],
        subject,
        ...(branding?.emailReplyTo ? { replyTo: [branding.emailReplyTo] } : {}),
      },
      async (idempotencyKey: string) => {
        const { data, error } = await sendResendEmail({
          from: fromEmail,
          to: [to],
          subject,
          html,
          ...(branding?.emailReplyTo ? { replyTo: branding.emailReplyTo } : {}),
          headers: { "Idempotency-Key": idempotencyKey },
        });
        if (error) throw new Error(error.message ?? "Resend request failed");
        return sealAssertPresent(data).id;
      },
    );

    await logEmailQueuedSafe(ctx, {
      organizationId: params.organizationId,
      messageId: emailId,
      to,
      subject,
      documentId: params.documentId,
      recipientId: params.recipientId,
    });

    return { success: true, messageId: emailId };
  } catch (error) {
    console.error("Error sending document invitation email:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export interface SendSigningCompleteParams {
  to: string;
  recipientName: string;
  documentName: string;
  signedAt: number;
  role: "signer" | "approver" | "viewer";
  downloadUrl?: string;
  organizationId: Id<"organizations">;
  documentId: Id<"documents">;
  recipientId: Id<"document_recipients">;
}

/**
 * Send signing complete confirmation email to recipient
 */
export async function sendSigningComplete(
  ctx: ActionCtx,
  params: SendSigningCompleteParams,
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const { to, recipientName, documentName, signedAt, role, downloadUrl } = params;
    const actionText = role === "signer" ? "signed" : role === "approver" ? "approved" : "viewed";

    const html = await renderSigningComplete({
      recipientName,
      documentName,
      signedAt,
      role,
      downloadUrl,
    });

    const subject = `You have ${actionText} "${documentName}"`;

    const emailId = await sendEmailManuallyFromAction(
      ctx,
      { from: FROM_EMAIL, to: [to], subject },
      async (idempotencyKey: string) => {
        const { data, error } = await sendResendEmail({
          from: FROM_EMAIL,
          to: [to],
          subject,
          html,
          headers: { "Idempotency-Key": idempotencyKey },
        });
        if (error) throw new Error(error.message ?? "Resend request failed");
        return sealAssertPresent(data).id;
      },
    );

    await logEmailQueuedSafe(ctx, {
      organizationId: params.organizationId,
      messageId: emailId,
      to,
      subject,
      documentId: params.documentId,
      recipientId: params.recipientId,
    });

    return { success: true, messageId: emailId };
  } catch (error) {
    console.error("Error sending signing complete email:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export interface SendDocumentCompletedParams {
  to: string;
  senderName: string;
  documentName: string;
  documentUrl: string;
  downloadUrl?: string;
  completedAt: number;
  recipientsSummary: Array<{
    name: string;
    email: string;
    role: "signer" | "approver" | "viewer";
    completedAt: number;
  }>;
  organizationId: Id<"organizations">;
  documentId: Id<"documents">;
}

/**
 * Send document completion notification to sender
 */
export async function sendDocumentCompleted(
  ctx: ActionCtx,
  params: SendDocumentCompletedParams,
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const { to, senderName, documentName, documentUrl, completedAt, recipientsSummary } = params;

    const html = await renderDocumentCompleted({
      senderName,
      documentName,
      documentUrl,
      completedAt,
      recipientsSummary,
    });

    const subject = `✓ Document Complete: ${documentName}`;

    const emailId = await sendEmailManuallyFromAction(
      ctx,
      { from: FROM_EMAIL, to: [to], subject },
      async (idempotencyKey: string) => {
        const { data, error } = await sendResendEmail({
          from: FROM_EMAIL,
          to: [to],
          subject,
          html,
          headers: { "Idempotency-Key": idempotencyKey },
        });
        if (error) throw new Error(error.message ?? "Resend request failed");
        return sealAssertPresent(data).id;
      },
    );

    await logEmailQueuedSafe(ctx, {
      organizationId: params.organizationId,
      messageId: emailId,
      to,
      subject,
      documentId: params.documentId,
    });

    return { success: true, messageId: emailId };
  } catch (error) {
    console.error("Error sending completion email:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export interface SendReminderParams {
  to: string;
  recipientName: string;
  documentName: string;
  senderName: string;
  signingUrl: string;
  customMessage?: string;
  expiresAt?: number;
  reminderCount?: number;
  branding?: EmailBrandingParams;
}

/**
 * Send reminder email to recipient
 */
export async function sendReminder(
  ctx: ActionCtx,
  params: SendReminderParams,
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const {
      to,
      recipientName,
      documentName,
      senderName,
      signingUrl,
      customMessage,
      expiresAt,
      reminderCount,
      branding,
    } = params;

    const html = await renderDocumentReminder({
      recipientName,
      senderName,
      documentName,
      signingUrl,
      customMessage,
      expiresAt,
      reminderCount,
    });

    const fromEmail = branding?.emailFromName
      ? `${branding.emailFromName} <no-reply@seal.nyc>`
      : FROM_EMAIL;

    const subject = `Reminder: "${documentName}" is waiting for your signature`;

    const emailId = await sendEmailManuallyFromAction(
      ctx,
      {
        from: fromEmail,
        to: [to],
        subject,
        ...(branding?.emailReplyTo ? { replyTo: [branding.emailReplyTo] } : {}),
      },
      async (idempotencyKey: string) => {
        const { data, error } = await sendResendEmail({
          from: fromEmail,
          to: [to],
          subject,
          html,
          ...(branding?.emailReplyTo ? { replyTo: branding.emailReplyTo } : {}),
          headers: { "Idempotency-Key": idempotencyKey },
        });
        if (error) throw new Error(error.message ?? "Resend request failed");
        return sealAssertPresent(data).id;
      },
    );

    return { success: true, messageId: emailId };
  } catch (error) {
    console.error("Error sending reminder email:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export interface SendWelcomeParams {
  to: string;
  userName: string;
  dashboardUrl?: string;
}

/**
 * Send welcome email to new user
 */
export async function sendWelcome(
  ctx: ActionCtx,
  params: SendWelcomeParams,
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const { to, userName, dashboardUrl } = params;

    const html = await renderWelcome({
      userName,
      userEmail: to,
      dashboardUrl,
    });

    const subject = "Welcome to Seal - Your document signing journey starts here";

    const emailId = await sendEmailManuallyFromAction(
      ctx,
      { from: FROM_EMAIL, to: [to], subject },
      async (idempotencyKey: string) => {
        const { data, error } = await sendResendEmail({
          from: FROM_EMAIL,
          to: [to],
          subject,
          html,
          headers: { "Idempotency-Key": idempotencyKey },
        });
        if (error) throw new Error(error.message ?? "Resend request failed");
        return sealAssertPresent(data).id;
      },
    );

    return { success: true, messageId: emailId };
  } catch (error) {
    console.error("Error sending welcome email:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export interface SendTeamInvitationParams {
  to: string;
  inviterName: string;
  inviterEmail: string;
  organizationName: string;
  role: string;
  inviteUrl: string;
  expiresAt?: number;
}

/**
 * Send team invitation email
 */
export async function sendTeamInvitation(
  ctx: ActionCtx,
  params: SendTeamInvitationParams,
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const { to, inviterName, inviterEmail, organizationName, role, inviteUrl, expiresAt } = params;

    const html = await renderTeamInvitation({
      inviteeEmail: to,
      inviterName,
      inviterEmail,
      organizationName,
      role,
      inviteUrl,
      expiresAt,
    });

    const subject = `${inviterName} invited you to join ${organizationName} on Seal`;

    const emailId = await sendEmailManuallyFromAction(
      ctx,
      { from: FROM_EMAIL, to: [to], subject },
      async (idempotencyKey: string) => {
        const { data, error } = await sendResendEmail({
          from: FROM_EMAIL,
          to: [to],
          subject,
          html,
          headers: { "Idempotency-Key": idempotencyKey },
        });
        if (error) throw new Error(error.message ?? "Resend request failed");
        return sealAssertPresent(data).id;
      },
    );

    return { success: true, messageId: emailId };
  } catch (error) {
    console.error("Error sending team invitation email:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export interface SendCancellationNotificationParams {
  to: string;
  recipientName: string;
  documentName: string;
  senderName: string;
  reason?: string;
}

/**
 * Send cancellation notification email to recipient
 */
export async function sendCancellationNotification(
  ctx: ActionCtx,
  params: SendCancellationNotificationParams,
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const { to, recipientName, documentName, senderName, reason } = params;

    const reasonText = reason ? `\n\nReason: ${reason}` : "";
    const html = `
      <p>Hi ${recipientName},</p>
      <p>${senderName} has cancelled the document <strong>"${documentName}"</strong>. No further action is required from you.${reasonText}</p>
      <p>If you have questions, please contact the sender directly.</p>
      <br/>
      <p style="color: #6b7280; font-size: 14px;">— Seal</p>
    `;

    const subject = `Document cancelled: ${documentName}`;

    const emailId = await sendEmailManuallyFromAction(
      ctx,
      { from: FROM_EMAIL, to: [to], subject },
      async (idempotencyKey: string) => {
        const { data, error } = await sendResendEmail({
          from: FROM_EMAIL,
          to: [to],
          subject,
          html,
          headers: { "Idempotency-Key": idempotencyKey },
        });
        if (error) throw new Error(error.message ?? "Resend request failed");
        return sealAssertPresent(data).id;
      },
    );

    return { success: true, messageId: emailId };
  } catch (error) {
    console.error("Error sending cancellation email:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export interface SendExpirationAlertParams {
  to: string;
  ownerName: string;
  documentName: string;
  documentUrl: string;
  expiresAt: number;
  daysRemaining: number;
  pendingRecipients: Array<{ name: string; email: string }>;
}

/**
 * Send expiration alert email to document owner
 */
export async function sendExpirationAlert(
  ctx: ActionCtx,
  params: SendExpirationAlertParams,
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const {
      to,
      ownerName,
      documentName,
      documentUrl,
      expiresAt,
      daysRemaining,
      pendingRecipients,
    } = params;

    const html = await renderDocumentExpirationAlert({
      ownerName,
      documentName,
      documentUrl,
      expiresAt,
      daysRemaining,
      pendingRecipients,
    });

    const subject = `⏰ "${documentName}" expires in ${daysRemaining} day${daysRemaining === 1 ? "" : "s"}`;

    const emailId = await sendEmailManuallyFromAction(
      ctx,
      { from: FROM_EMAIL, to: [to], subject },
      async (idempotencyKey: string) => {
        const { data, error } = await sendResendEmail({
          from: FROM_EMAIL,
          to: [to],
          subject,
          html,
          headers: { "Idempotency-Key": idempotencyKey },
        });
        if (error) throw new Error(error.message ?? "Resend request failed");
        return sealAssertPresent(data).id;
      },
    );

    return { success: true, messageId: emailId };
  } catch (error) {
    console.error("Error sending expiration alert email:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export interface SendDocumentViewedParams {
  to: string;
  ownerName: string;
  documentName: string;
  documentUrl: string;
  recipientName: string;
  recipientEmail: string;
  viewedAt: number;
}

/**
 * Send viewed notification email to document owner
 */
export async function sendDocumentViewed(
  ctx: ActionCtx,
  params: SendDocumentViewedParams,
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const { to, ownerName, documentName, documentUrl, recipientName, recipientEmail, viewedAt } =
      params;

    const html = await renderDocumentViewed({
      ownerName,
      documentName,
      documentUrl,
      recipientName,
      recipientEmail,
      viewedAt,
    });

    const subject = `${recipientName} viewed "${documentName}"`;

    const emailId = await sendEmailManuallyFromAction(
      ctx,
      { from: FROM_EMAIL, to: [to], subject },
      async (idempotencyKey: string) => {
        const { data, error } = await sendResendEmail({
          from: FROM_EMAIL,
          to: [to],
          subject,
          html,
          headers: { "Idempotency-Key": idempotencyKey },
        });
        if (error) throw new Error(error.message ?? "Resend request failed");
        return sealAssertPresent(data).id;
      },
    );

    return { success: true, messageId: emailId };
  } catch (error) {
    console.error("Error sending document viewed email:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export interface SendDocumentSharedParams {
  to: string;
  recipientName: string;
  sharerName: string;
  sharerEmail: string;
  documentName: string;
  permissionLevel: "view" | "edit" | "manage";
  documentUrl: string;
}

/**
 * Send document shared notification email
 */
export async function sendDocumentShared(
  ctx: ActionCtx,
  params: SendDocumentSharedParams,
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const {
      to,
      recipientName,
      sharerName,
      sharerEmail,
      documentName,
      permissionLevel,
      documentUrl,
    } = params;

    const html = await renderDocumentShared({
      recipientEmail: to,
      recipientName,
      sharerName,
      sharerEmail,
      documentName,
      permissionLevel,
      documentUrl,
    });

    const subject = `${sharerName} shared "${documentName}" with you`;

    const emailId = await sendEmailManuallyFromAction(
      ctx,
      { from: FROM_EMAIL, to: [to], subject },
      async (idempotencyKey: string) => {
        const { data, error } = await sendResendEmail({
          from: FROM_EMAIL,
          to: [to],
          subject,
          html,
          headers: { "Idempotency-Key": idempotencyKey },
        });
        if (error) throw new Error(error.message ?? "Resend request failed");
        return sealAssertPresent(data).id;
      },
    );

    return { success: true, messageId: emailId };
  } catch (error) {
    console.error("Error sending document shared email:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export interface SendDocumentExpiredNotificationParams {
  to: string;
  ownerName: string;
  documentName: string;
  expiredAt: number;
}

/**
 * Send document expired notification email to document owner
 */
export async function sendDocumentExpiredNotification(
  ctx: ActionCtx,
  params: SendDocumentExpiredNotificationParams,
): Promise<{ success: boolean; error?: string }> {
  try {
    const html = await renderDocumentExpired({
      ownerName: params.ownerName,
      documentName: params.documentName,
      expiredAt: new Date(params.expiredAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
    });

    const subject = `Your document "${params.documentName}" has expired`;

    await sendEmailManuallyFromAction(
      ctx,
      { from: FROM_EMAIL, to: [params.to], subject },
      async (idempotencyKey: string) => {
        const { data, error } = await sendResendEmail({
          from: FROM_EMAIL,
          to: [params.to],
          subject,
          html,
          headers: { "Idempotency-Key": idempotencyKey },
        });
        if (error) throw new Error(error.message ?? "Resend request failed");
        return sealAssertPresent(data).id;
      },
    );

    return { success: true };
  } catch (error) {
    console.error("Failed to send document expired notification:", error);
    return { success: false, error: String(error) };
  }
}
