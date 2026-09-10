import {
  renderDocumentCompleted,
  renderDocumentExpired,
  renderDocumentExpirationAlert,
  renderDocumentInvitation,
  renderDocumentReminder,
  renderDocumentViewed,
  renderOwnershipTransferred,
  renderSigningComplete,
} from "@seal/transactional";

export interface EmailSendResult {
  success: boolean;
  error?: string;
}

export interface EmailEnv {
  EMAIL: SendEmail | undefined;
  EMAIL_FROM: string;
  APP_URL: string;
}

function normalizeUrl(base: string, path: string): string {
  const trimmed = base.replace(/\/$/, "");
  const safePath = path.startsWith("/") ? path : `/${path}`;
  return `${trimmed}${safePath}`;
}

export function buildSigningUrl(
  env: Pick<EmailEnv, "APP_URL">,
  token: string
): string {
  return normalizeUrl(env.APP_URL, `/sign/${encodeURIComponent(token)}`);
}

export function buildDocumentUrl(
  env: Pick<EmailEnv, "APP_URL">,
  slug: string,
  publicId: string
): string {
  return normalizeUrl(
    env.APP_URL,
    `/${encodeURIComponent(slug)}/documents/${encodeURIComponent(publicId)}`
  );
}

export async function sendEmail(
  env: EmailEnv,
  {
    to,
    subject,
    html,
    text,
    from,
  }: {
    to: string | string[];
    subject: string;
    html: string;
    text?: string;
    from?: string;
  }
): Promise<EmailSendResult> {
  if (!env.EMAIL) {
    return { success: false, error: "email binding not configured" };
  }
  try {
    await env.EMAIL.send({
      from: from ?? env.EMAIL_FROM,
      to,
      subject,
      html,
      ...(text ? { text } : {}),
    });
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[email] failed to send:", { to, subject, error: message });
    return { success: false, error: message };
  }
}

export async function sendDocumentInvitationEmail(
  env: EmailEnv,
  params: {
    to: string;
    recipientName: string;
    senderName: string;
    documentName: string;
    signingToken: string;
    customMessage?: string;
    expiresAt?: number;
  }
): Promise<EmailSendResult> {
  const html = await renderDocumentInvitation({
    recipientName: params.recipientName,
    senderName: params.senderName,
    documentName: params.documentName,
    signingUrl: buildSigningUrl(env, params.signingToken),
    customMessage: params.customMessage,
    expiresAt: params.expiresAt,
  });
  return sendEmail(env, {
    to: params.to,
    subject: `${params.senderName} sent you "${params.documentName}" to sign`,
    html,
  });
}

export async function sendDocumentReminderEmail(
  env: EmailEnv,
  params: {
    to: string;
    recipientName: string;
    senderName: string;
    documentName: string;
    signingToken: string;
    customMessage?: string;
    expiresAt?: number;
    reminderCount?: number;
  }
): Promise<EmailSendResult> {
  const html = await renderDocumentReminder({
    recipientName: params.recipientName,
    senderName: params.senderName,
    documentName: params.documentName,
    signingUrl: buildSigningUrl(env, params.signingToken),
    customMessage: params.customMessage,
    expiresAt: params.expiresAt,
    reminderCount: params.reminderCount ?? 1,
  });
  return sendEmail(env, {
    to: params.to,
    subject: `Reminder: "${params.documentName}" is waiting for your signature`,
    html,
  });
}

export async function sendSigningCompleteEmail(
  env: EmailEnv,
  params: {
    to: string;
    recipientName: string;
    documentName: string;
    signedAt: number;
    role: "signer" | "approver" | "viewer";
  }
): Promise<EmailSendResult> {
  const html = await renderSigningComplete({
    recipientName: params.recipientName,
    documentName: params.documentName,
    signedAt: params.signedAt,
    role: params.role,
  });
  return sendEmail(env, {
    to: params.to,
    subject: `You have signed "${params.documentName}"`,
    html,
  });
}

export async function sendDocumentCompletedEmail(
  env: EmailEnv,
  params: {
    to: string;
    senderName: string;
    documentName: string;
    documentSlug: string;
    documentPublicId: string;
    completedAt: number;
    recipientsSummary: Array<{
      name: string;
      email: string;
      role: "signer" | "approver" | "viewer";
      completedAt: number;
    }>;
  }
): Promise<EmailSendResult> {
  const html = await renderDocumentCompleted({
    senderName: params.senderName,
    documentName: params.documentName,
    documentUrl: buildDocumentUrl(
      env,
      params.documentSlug,
      params.documentPublicId
    ),
    completedAt: params.completedAt,
    recipientsSummary: params.recipientsSummary,
  });
  return sendEmail(env, {
    to: params.to,
    subject: `All signatures collected for "${params.documentName}"`,
    html,
  });
}

export async function sendDocumentViewedEmail(
  env: EmailEnv,
  params: {
    to: string;
    ownerName: string;
    documentName: string;
    documentSlug: string;
    documentPublicId: string;
    recipientName: string;
    recipientEmail: string;
    viewedAt: number;
  }
): Promise<EmailSendResult> {
  const html = await renderDocumentViewed({
    ownerName: params.ownerName,
    documentName: params.documentName,
    documentUrl: buildDocumentUrl(
      env,
      params.documentSlug,
      params.documentPublicId
    ),
    recipientName: params.recipientName,
    recipientEmail: params.recipientEmail,
    viewedAt: params.viewedAt,
  });
  return sendEmail(env, {
    to: params.to,
    subject: `${params.recipientName} viewed "${params.documentName}"`,
    html,
  });
}

export async function sendDocumentExpiredEmail(
  env: EmailEnv,
  params: {
    to: string;
    ownerName: string;
    documentName: string;
    expiredAt: string;
  }
): Promise<EmailSendResult> {
  const html = await renderDocumentExpired({
    ownerName: params.ownerName,
    documentName: params.documentName,
    expiredAt: params.expiredAt,
  });
  return sendEmail(env, {
    to: params.to,
    subject: `Your document "${params.documentName}" has expired`,
    html,
  });
}

export async function sendDocumentExpirationAlertEmail(
  env: EmailEnv,
  params: {
    to: string;
    ownerName: string;
    documentName: string;
    documentSlug: string;
    documentPublicId: string;
    expiresAt: number;
    daysRemaining: number;
    pendingRecipients: Array<{ name: string; email: string }>;
  }
): Promise<EmailSendResult> {
  const html = await renderDocumentExpirationAlert({
    ownerName: params.ownerName,
    documentName: params.documentName,
    documentUrl: buildDocumentUrl(
      env,
      params.documentSlug,
      params.documentPublicId
    ),
    expiresAt: params.expiresAt,
    daysRemaining: params.daysRemaining,
    pendingRecipients: params.pendingRecipients,
  });
  return sendEmail(env, {
    to: params.to,
    subject: `"${params.documentName}" expires in ${params.daysRemaining} day${params.daysRemaining === 1 ? "" : "s"}`,
    html,
  });
}

export async function sendOwnershipTransferredEmail(
  env: EmailEnv,
  params: {
    to: string;
    newOwnerName: string;
    documentName: string;
    documentSlug: string;
    documentPublicId: string;
    transferredAt: number;
  }
): Promise<EmailSendResult> {
  const html = await renderOwnershipTransferred({
    newOwnerName: params.newOwnerName,
    documentName: params.documentName,
    documentUrl: buildDocumentUrl(
      env,
      params.documentSlug,
      params.documentPublicId
    ),
    transferredAt: params.transferredAt,
  });
  return sendEmail(env, {
    to: params.to,
    subject: `You are now the owner of "${params.documentName}"`,
    html,
  });
}
