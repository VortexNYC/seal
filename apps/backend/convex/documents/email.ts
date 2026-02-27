/**
 * Email sending utilities using Resend and @seal/email templates
 */

import { Resend } from "resend";

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

// Initialize Resend client
const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "Seal <no-reply@seal.nyc>";

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
  // Stripe invoice details (optional, included only for the invoice recipient)
  invoiceUrl?: string;
  invoiceAmount?: number;
  invoiceCurrency?: string;
  // Branding overrides
  branding?: EmailBrandingParams;
}

/**
 * Send document invitation email to recipient
 */
export async function sendDocumentInvitation(
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

    // Use branded from name if configured
    const fromEmail = branding?.emailFromName
      ? `${branding.emailFromName} <no-reply@seal.nyc>`
      : FROM_EMAIL;

    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: [to],
      subject: `${senderName} sent you a document to sign: ${documentName}`,
      html,
      ...(branding?.emailReplyTo ? { replyTo: branding.emailReplyTo } : {}),
    });

    if (error) {
      console.error("Error sending email:", error);
      return { success: false, error: error.message };
    }

    return { success: true, messageId: data?.id };
  } catch (error) {
    console.error("Unexpected error sending email:", error);
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
}

/**
 * Send signing complete confirmation email to recipient
 */
export async function sendSigningComplete(
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

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [to],
      subject: `You have ${actionText} "${documentName}"`,
      html,
    });

    if (error) {
      console.error("Error sending signing complete email:", error);
      return { success: false, error: error.message };
    }

    return { success: true, messageId: data?.id };
  } catch (error) {
    console.error("Unexpected error sending signing complete email:", error);
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
}

/**
 * Send document completion notification to sender (when all recipients have signed)
 */
export async function sendDocumentCompleted(
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

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [to],
      subject: `✓ Document Complete: ${documentName}`,
      html,
    });

    if (error) {
      console.error("Error sending completion email:", error);
      return { success: false, error: error.message };
    }

    return { success: true, messageId: data?.id };
  } catch (error) {
    console.error("Unexpected error sending completion email:", error);
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
  // Branding overrides
  branding?: EmailBrandingParams;
}

/**
 * Send reminder email to recipient
 */
export async function sendReminder(
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

    // Use branded from name if configured
    const fromEmail = branding?.emailFromName
      ? `${branding.emailFromName} <no-reply@seal.nyc>`
      : FROM_EMAIL;

    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: [to],
      subject: `Reminder: "${documentName}" is waiting for your signature`,
      html,
      ...(branding?.emailReplyTo ? { replyTo: branding.emailReplyTo } : {}),
    });

    if (error) {
      console.error("Error sending reminder email:", error);
      return { success: false, error: error.message };
    }

    return { success: true, messageId: data?.id };
  } catch (error) {
    console.error("Unexpected error sending reminder email:", error);
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
  params: SendWelcomeParams,
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const { to, userName, dashboardUrl } = params;

    const html = await renderWelcome({
      userName,
      userEmail: to,
      dashboardUrl,
    });

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [to],
      subject: "Welcome to Seal - Your document signing journey starts here",
      html,
    });

    if (error) {
      console.error("Error sending welcome email:", error);
      return { success: false, error: error.message };
    }

    return { success: true, messageId: data?.id };
  } catch (error) {
    console.error("Unexpected error sending welcome email:", error);
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

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [to],
      subject: `${inviterName} invited you to join ${organizationName} on Seal`,
      html,
    });

    if (error) {
      console.error("Error sending team invitation email:", error);
      return { success: false, error: error.message };
    }

    return { success: true, messageId: data?.id };
  } catch (error) {
    console.error("Unexpected error sending team invitation email:", error);
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
  params: SendCancellationNotificationParams,
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const { to, recipientName, documentName, senderName, reason } = params;

    const reasonText = reason ? `\n\nReason: ${reason}` : "";

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [to],
      subject: `Document cancelled: ${documentName}`,
      html: `
        <p>Hi ${recipientName},</p>
        <p>${senderName} has cancelled the document <strong>"${documentName}"</strong>. No further action is required from you.${reasonText}</p>
        <p>If you have questions, please contact the sender directly.</p>
        <br/>
        <p style="color: #6b7280; font-size: 14px;">— Seal</p>
      `,
    });

    if (error) {
      console.error("Error sending cancellation email:", error);
      return { success: false, error: error.message };
    }

    return { success: true, messageId: data?.id };
  } catch (error) {
    console.error("Unexpected error sending cancellation email:", error);
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

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [to],
      subject: `⏰ "${documentName}" expires in ${daysRemaining} day${daysRemaining === 1 ? "" : "s"}`,
      html,
    });

    if (error) {
      console.error("Error sending expiration alert email:", error);
      return { success: false, error: error.message };
    }

    return { success: true, messageId: data?.id };
  } catch (error) {
    console.error("Unexpected error sending expiration alert email:", error);
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

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [to],
      subject: `${recipientName} viewed "${documentName}"`,
      html,
    });

    if (error) {
      console.error("Error sending document viewed email:", error);
      return { success: false, error: error.message };
    }

    return { success: true, messageId: data?.id };
  } catch (error) {
    console.error("Unexpected error sending document viewed email:", error);
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

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [to],
      subject: `${sharerName} shared "${documentName}" with you`,
      html,
    });

    if (error) {
      console.error("Error sending document shared email:", error);
      return { success: false, error: error.message };
    }

    return { success: true, messageId: data?.id };
  } catch (error) {
    console.error("Unexpected error sending document shared email:", error);
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

    await resend.emails.send({
      from: FROM_EMAIL,
      to: params.to,
      subject: `Your document "${params.documentName}" has expired`,
      html,
    });

    return { success: true };
  } catch (error) {
    console.error("Failed to send document expired notification:", error);
    return { success: false, error: String(error) };
  }
}
