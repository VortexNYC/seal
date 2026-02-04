/**
 * Email sending utilities using Resend and @seal/email templates
 */

import { Resend } from "resend";

import {
  renderDocumentCompleted,
  renderDocumentInvitation,
  renderDocumentReminder,
  renderDocumentShared,
  renderSigningComplete,
  renderTeamInvitation,
  renderWelcome,
} from "@seal/transactional";

// Initialize Resend client
const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "Seal <no-reply@seal.nyc>";

export interface SendDocumentInvitationParams {
  to: string;
  recipientName: string;
  documentName: string;
  senderName: string;
  signingUrl: string;
  customMessage?: string;
  expiresAt?: number;
}

/**
 * Send document invitation email to recipient
 */
export async function sendDocumentInvitation(
  params: SendDocumentInvitationParams,
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const { to, recipientName, documentName, senderName, signingUrl, customMessage, expiresAt } =
      params;

    const html = await renderDocumentInvitation({
      recipientName,
      senderName,
      documentName,
      signingUrl,
      customMessage,
      expiresAt,
    });

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [to],
      subject: `${senderName} sent you a document to sign: ${documentName}`,
      html,
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

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: [to],
      subject: `Reminder: "${documentName}" is waiting for your signature`,
      html,
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
