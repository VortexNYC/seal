/**
 * SEA-68 — document byte-access audit helpers.
 *
 * Signing lifecycle audits are strong; R2/PDF *reads* were uneven.
 * Use these helpers on every path that returns document bytes to a caller.
 */

import type { D1Client } from "../global/db.js";
import {
  getAuditRequestMeta,
  writeAuditLog,
  type AuditActor,
} from "./audit-log.js";

export type DocumentByteAccessVia =
  | "session-download"
  | "signing-pdf-preview"
  | "signing-signed-pdf"
  | "signing-certificate"
  | "v1-certificate"
  | "download-file"
  | "break-glass"
  | "agent-read";

export async function auditDocumentByteAccess(
  db: D1Client,
  input: {
    organizationId: string;
    actor: AuditActor;
    documentId: string;
    via: DocumentByteAccessVia;
    metadata?: Record<string, unknown>;
    ipAddress?: string;
    userAgent?: string;
  }
): Promise<void> {
  await writeAuditLog(db, {
    organizationId: input.organizationId,
    actor: input.actor,
    action: "document.downloaded",
    resourceType: "document",
    resourceId: input.documentId,
    metadata: {
      via: input.via,
      ...(input.metadata ?? {}),
    },
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
  });
}

/** Best-effort — never fail the download path on audit write errors. */
export async function tryAuditDocumentByteAccess(
  db: D1Client,
  input: Parameters<typeof auditDocumentByteAccess>[1],
  logLabel: string
): Promise<void> {
  try {
    await auditDocumentByteAccess(db, input);
  } catch (err) {
    console.error(`[audit] document.downloaded (${logLabel}) failed:`, err);
  }
}

export function auditMetaFromContext(c: {
  req: { header(name: string): string | undefined };
}): { ipAddress: string | undefined; userAgent: string | undefined } {
  return getAuditRequestMeta(c);
}
