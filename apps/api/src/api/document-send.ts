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

type InvitationParty = {
  id: string;
  role: string;
  order: number;
  status: string;
};

const OPEN_RECIPIENT = new Set(["pending", "viewed"]);

/**
 * Who should receive an invitation now.
 * Parallel: everyone still open. Sequential: the earliest open signer group.
 */
export function recipientsDueInvitation(
  signingMode: string | null | undefined,
  rows: readonly InvitationParty[]
): string[] {
  const open = rows.filter((row) => OPEN_RECIPIENT.has(row.status));
  if (signingMode !== "sequential") return open.map((row) => row.id);
  const parties = open.filter(
    (row) => row.role === "signer" || row.role === "approver"
  );
  let current: number | null = null;
  for (const row of parties) {
    if (current === null || row.order < current) current = row.order;
  }
  if (current === null) return [];
  return parties.filter((row) => row.order === current).map((row) => row.id);
}

export type SigningParty = InvitationParty & {
  name: string | null;
  email: string;
};

const FINISHED_PARTY = new Set(["signed", "approved"]);
const SIGNING_ROLE = new Set(["signer", "approver"]);

function partyLabel(party: { name: string | null; email: string }): string {
  const name = party.name?.trim();
  return name && name.length > 0 ? name : party.email;
}

function joinWaiting(labels: readonly string[]): string | null {
  const first = labels[0];
  if (!first) return null;
  if (labels.length === 1) return first;
  const second = labels[1];
  if (labels.length === 2 && second) return `${first} and ${second}`;
  return `${first} and ${labels.length - 1} others`;
}

/** Who the row is about, and how many signers have finished. */
export function signingProgress(
  signingMode: string | null | undefined,
  rows: readonly SigningParty[]
): { signed: number; total: number; waitingOn: string | null } | null {
  const parties = rows.filter((row) => SIGNING_ROLE.has(row.role));
  if (parties.length === 0) return null;
  const declined = parties.find((row) => row.status === "declined");
  const due = new Set(recipientsDueInvitation(signingMode, parties));
  return {
    signed: parties.filter((row) => FINISHED_PARTY.has(row.status)).length,
    total: parties.length,
    waitingOn: declined
      ? partyLabel(declined)
      : joinWaiting(parties.filter((row) => due.has(row.id)).map(partyLabel)),
  };
}

/**
 * After someone finishes, the next sequential group is invited only once
 * nobody at or before that order is still open.
 */
export function nextSequentialInviteIds(
  signingMode: string | null | undefined,
  rows: readonly InvitationParty[],
  completedOrder: number
): string[] {
  if (signingMode !== "sequential") return [];
  const blocked = rows.some(
    (row) =>
      (row.role === "signer" || row.role === "approver") &&
      row.order <= completedOrder &&
      OPEN_RECIPIENT.has(row.status)
  );
  if (blocked) return [];
  return recipientsDueInvitation("sequential", rows);
}

/** Columns to write before invitations go out. Empty when the caller left order alone. */
export function documentSigningPatch(input: {
  signingMode?: "parallel" | "sequential";
  allowDictateNextSigner?: boolean;
}): {
  signingMode?: "parallel" | "sequential";
  allowDictateNextSigner?: boolean;
} | null {
  if (
    input.signingMode === undefined &&
    input.allowDictateNextSigner === undefined
  ) {
    return null;
  }
  return {
    ...(input.signingMode !== undefined
      ? { signingMode: input.signingMode }
      : {}),
    ...(input.allowDictateNextSigner !== undefined
      ? { allowDictateNextSigner: input.allowDictateNextSigner }
      : {}),
  };
}

/** OpenAPI calls the list `ids`. The live API and MCP call it `document_ids`. */
export function bulkSendDocumentIds(body: {
  document_ids?: readonly string[];
  ids?: readonly string[];
}): string[] | null {
  const ids = body.document_ids ?? body.ids;
  if (!ids || ids.length === 0 || ids.length > 50) return null;
  return [...ids];
}

/** A recipient's own note wins. Otherwise everyone gets the default note. */
export function invitationMessage(
  recipientPublicId: string,
  input: {
    recipientMessages?: Record<string, string>;
    defaultMessage?: string;
  }
): string | undefined {
  const specific = input.recipientMessages?.[recipientPublicId]?.trim();
  if (specific) return specific;
  const fallback = input.defaultMessage?.trim();
  return fallback ? fallback : undefined;
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
    defaultMessage,
    notify = true,
  }: {
    documentId: string;
    documentName: string;
    senderName: string;
    expirationMs?: number;
    recipientMessages?: Record<string, string>;
    defaultMessage?: string;
    notify?: boolean;
  }
): Promise<SendDocumentResult> {
  const sentAt = new Date();
  const deadline = new Date(sentAt.getTime() + expirationMs);

  const [docRow] = await db
    .select({ signingMode: documents.signingMode })
    .from(documents)
    .where(eq(documents.id, documentId))
    .limit(1);

  const recipientRows = await db
    .select()
    .from(recipients)
    .where(eq(recipients.documentId, documentId));
  const due = new Set(
    recipientsDueInvitation(docRow?.signingMode, recipientRows)
  );

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
      if (!due.has(result.id)) {
        return Promise.resolve<EmailSendResult>({ success: true });
      }
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
        customMessage: invitationMessage(result.publicId, {
          recipientMessages,
          defaultMessage,
        }),
        expiresAt: deadline.getTime(),
      });
    })
  );

  let failedEmails = 0;
  for (const [i, emailResult] of emailResults.entries()) {
    const result = results[i];
    if (!result) continue;
    result.emailSent = due.has(result.id) && emailResult.success;
    if (due.has(result.id) && !emailResult.success) failedEmails += 1;
  }
  if (failedEmails > 0) {
    console.error(
      "[documents/send] some invitation emails failed:",
      emailResults.filter((r) => !r.success)
    );
  }

  return { sentAt, deadline, recipients: results, failedEmails };
}

/** Email the next sequential group after an earlier group has finished. */
export async function inviteNextSequentialGroup(
  db: ReturnType<typeof createD1>,
  env: EmailEnv,
  {
    documentId,
    documentName,
    senderName,
    completedOrder,
  }: {
    documentId: string;
    documentName: string;
    senderName: string;
    completedOrder: number;
  }
): Promise<void> {
  const [doc] = await db
    .select({
      signingMode: documents.signingMode,
      deadline: documents.deadline,
    })
    .from(documents)
    .where(eq(documents.id, documentId))
    .limit(1);
  if (!doc || doc.signingMode !== "sequential") return;

  const rows = await db
    .select()
    .from(recipients)
    .where(eq(recipients.documentId, documentId));
  const due = new Set(
    nextSequentialInviteIds(doc.signingMode, rows, completedOrder)
  );
  const expiresAt = doc.deadline?.getTime();

  await Promise.all(
    rows.map((row) => {
      if (!due.has(row.id) || !row.email || !row.signingToken) {
        return Promise.resolve();
      }
      return sendDocumentInvitationEmail(env, {
        to: row.email,
        recipientName: row.name ?? row.email,
        senderName,
        documentName,
        signingToken: row.signingToken,
        expiresAt,
      });
    })
  );
}
