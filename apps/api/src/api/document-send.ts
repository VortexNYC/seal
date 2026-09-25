import { eq } from "drizzle-orm";

import type { createD1 } from "../global/db.js";
import { documents, recipients } from "../global/schema.js";
import {
  buildSigningUrl,
  sendDocumentInvitationEmail,
  type EmailEnv,
  type EmailSendResult,
} from "../platform/email.js";

const DEFAULT_EXPIRATION_MS = 30 * 24 * 60 * 60 * 1000;

export function generateSigningToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join(
    ""
  );
}

export interface SentRecipient {
  id: string;
  publicId: string;
  email: string | null;
  name: string | null;
  role: string;
  signingToken: string;
  signingUrl: string;
  emailSent: boolean;
}

export interface SendDocumentResult {
  sentAt: Date;
  deadline: Date;
  recipients: SentRecipient[];
  failedEmails: number;
}

export async function sendDocumentForSigning(
  db: ReturnType<typeof createD1>,
  env: EmailEnv,
  {
    documentId,
    documentName,
    senderName,
    expirationMs = DEFAULT_EXPIRATION_MS,
    recipientMessages,
    notify = true,
  }: {
    documentId: string;
    documentName: string;
    senderName: string;
    expirationMs?: number;
    recipientMessages?: Record<string, string>;
    notify?: boolean;
  }
): Promise<SendDocumentResult> {
  const sentAt = new Date();
  const deadline = new Date(sentAt.getTime() + expirationMs);

  const recipientRows = await db
    .select()
    .from(recipients)
    .where(eq(recipients.documentId, documentId));

  const updates: {
    id: string;
    signingToken: string;
    tokenExpiresAt: Date;
    updatedAt: Date;
  }[] = [];
  const results: SentRecipient[] = [];
  for (const recipient of recipientRows) {
    const signingToken = recipient.signingToken ?? generateSigningToken();
    updates.push({
      id: recipient.id,
      signingToken,
      tokenExpiresAt: deadline,
      updatedAt: sentAt,
    });
    results.push({
      id: recipient.id,
      publicId: recipient.publicId,
      email: recipient.email,
      name: recipient.name,
      role: recipient.role,
      signingToken,
      signingUrl: buildSigningUrl(env, signingToken),
      emailSent: false,
    });
  }

  await Promise.all(
    updates.map((update) =>
      db.update(recipients).set(update).where(eq(recipients.id, update.id))
    )
  );

  await db
    .update(documents)
    .set({ status: "sent", sentAt, deadline, updatedAt: sentAt })
    .where(eq(documents.id, documentId));

  if (!notify) {
    return { sentAt, deadline, recipients: results, failedEmails: 0 };
  }

  const emailResults = await Promise.all(
    results.map((result) => {
      if (!result.email) {
        return Promise.resolve<EmailSendResult>({
          success: false,
          error: "missing recipient email",
        });
      }
      return sendDocumentInvitationEmail(env, {
        to: result.email,
        recipientName: result.name ?? result.email,
        senderName,
        documentName,
        signingToken: result.signingToken,
        customMessage: recipientMessages?.[result.publicId],
        expiresAt: deadline.getTime(),
      });
    })
  );

  let failedEmails = 0;
  for (const [i, emailResult] of emailResults.entries()) {
    const result = results[i];
    if (!result) continue;
    result.emailSent = emailResult.success;
    if (!emailResult.success) failedEmails += 1;
  }
  if (failedEmails > 0) {
    console.error(
      "[documents/send] some invitation emails failed:",
      emailResults.filter((r) => !r.success)
    );
  }

  return { sentAt, deadline, recipients: results, failedEmails };
}
