/**
 * Retired Resend document email transport.
 *
 * All document lifecycle emails are now sent from the Cloudflare Worker
 * via apps/api/src/platform/email.ts. This file remains as a temporary
 * type-compatible stub so downstream actions can be retired incrementally
 * without breaking Convex type generation.
 */

type EmailResult = { success: boolean; messageId?: string; error?: string };

const RETIRED: EmailResult = {
  success: true,
  messageId: undefined,
  error: undefined,
};

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
  organizationId: unknown;
  documentId: unknown;
  recipientId: unknown;
}

export async function sendDocumentInvitation(
  _ctx: unknown,
  _params: SendDocumentInvitationParams
): Promise<EmailResult> {
  return RETIRED;
}

export interface SendSigningCompleteParams {
  to: string;
  recipientName: string;
  documentName: string;
  signedAt: number;
  role: string;
  organizationId: unknown;
  documentId: unknown;
  recipientId: unknown;
}

export async function sendSigningComplete(
  _ctx: unknown,
  _params: SendSigningCompleteParams
): Promise<EmailResult> {
  return RETIRED;
}

export interface SendDocumentCompletedParams {
  to: string;
  senderName: string;
  documentName: string;
  documentUrl: string;
  downloadUrl: string;
  completedAt: number;
  recipientsSummary: Array<{
    name: string;
    email: string;
    role: string;
    completedAt: number;
  }>;
  organizationId: unknown;
  documentId: unknown;
}

export async function sendDocumentCompleted(
  _ctx: unknown,
  _params: SendDocumentCompletedParams
): Promise<EmailResult> {
  return RETIRED;
}

export interface SendReminderParams {
  to: string;
  recipientName: string;
  senderName: string;
  documentName: string;
  signingUrl: string;
  reminderCount: number;
  expiresAt?: number;
  branding?: EmailBrandingParams;
  organizationId: unknown;
  documentId: unknown;
  recipientId: unknown;
}

export async function sendReminder(
  _ctx: unknown,
  _params: SendReminderParams
): Promise<EmailResult> {
  return RETIRED;
}

export interface SendCancellationNotificationParams {
  to: string;
  recipientName: string;
  documentName: string;
  senderName: string;
  documentUrl: string;
  organizationId: unknown;
  documentId: unknown;
  recipientId: unknown;
}

export async function sendCancellationNotification(
  _ctx: unknown,
  _params: SendCancellationNotificationParams
): Promise<EmailResult> {
  return RETIRED;
}

export interface SendExpirationAlertParams {
  to: string;
  ownerName: string;
  documentName: string;
  documentUrl: string;
  expiresAt: number;
  daysRemaining: number;
  pendingRecipients: Array<{ name: string; email: string }>;
  organizationId: unknown;
  documentId: unknown;
}

export async function sendExpirationAlert(
  _ctx: unknown,
  _params: SendExpirationAlertParams
): Promise<EmailResult> {
  return RETIRED;
}

export interface SendDocumentViewedParams {
  to: string;
  ownerName: string;
  documentName: string;
  documentUrl: string;
  viewedBy: string;
  viewedAt: number;
  organizationId: unknown;
  documentId: unknown;
  recipientId: unknown;
}

export async function sendDocumentViewed(
  _ctx: unknown,
  _params: SendDocumentViewedParams
): Promise<EmailResult> {
  return RETIRED;
}

export interface SendDocumentSharedParams {
  to: string;
  recipientName: string;
  documentName: string;
  documentUrl: string;
  sharedBy: string;
  permissionLevel: string;
  organizationId: unknown;
  documentId: unknown;
}

export async function sendDocumentShared(
  _ctx: unknown,
  _params: SendDocumentSharedParams
): Promise<EmailResult> {
  return RETIRED;
}

export interface SendDocumentExpiredNotificationParams {
  to: string;
  ownerName: string;
  documentName: string;
  documentUrl: string;
  expiredAt: number;
  pendingRecipients: Array<{ name: string; email: string }>;
  organizationId: unknown;
  documentId: unknown;
}

export async function sendDocumentExpiredNotification(
  _ctx: unknown,
  _params: SendDocumentExpiredNotificationParams
): Promise<EmailResult> {
  return RETIRED;
}
