/**
 * Persist Certificate of Completion for a completed document (SEA-50).
 */

import { and, asc, eq, inArray, or } from "drizzle-orm";

import type { D1Client } from "../global/db.js";
import {
  activity,
  auditLogs,
  documents,
  organization,
  recipients,
  signatures,
} from "../global/schema.js";
import {
  buildCertificateOfCompletionPdf,
  certificateStorageKey,
  type CertificateParty,
} from "./certificate-of-completion.js";

function formatTs(value: Date | null | undefined): string | null {
  if (!value) {
    return null;
  }
  return value.toISOString();
}

export async function generateAndStoreCertificateOfCompletion(params: {
  db: D1Client;
  bucket: R2Bucket;
  documentId: string;
  appUrl: string;
}): Promise<{ storageKey: string } | null> {
  const { db, bucket, documentId, appUrl } = params;

  const [doc] = await db
    .select()
    .from(documents)
    .where(eq(documents.id, documentId))
    .limit(1);
  if (!doc || doc.status !== "completed") {
    return null;
  }
  if (!doc.qrToken) {
    const qrToken = crypto.randomUUID();
    await db
      .update(documents)
      .set({ qrToken, updatedAt: new Date() })
      .where(eq(documents.id, documentId));
    doc.qrToken = qrToken;
  }

  const [org] = await db
    .select({ name: organization.name })
    .from(organization)
    .where(eq(organization.id, doc.organizationId))
    .limit(1);

  const recipientRows = await db
    .select()
    .from(recipients)
    .where(eq(recipients.documentId, documentId))
    .orderBy(asc(recipients.order));

  const signatureRows = await db
    .select()
    .from(signatures)
    .where(eq(signatures.documentId, documentId));
  const sigByRecipient = new Map(
    signatureRows.map((s) => [s.recipientId, s] as const)
  );

  const parties: CertificateParty[] = recipientRows.map((r) => {
    const sig = sigByRecipient.get(r.id);
    return {
      name: r.name ?? r.email,
      email: r.email,
      role: r.role,
      status: r.status,
      completedAt:
        formatTs(r.signedAt) ??
        formatTs(r.approvedAt) ??
        formatTs(r.declinedAt) ??
        formatTs(r.viewedAt),
      ipAddress: sig?.ipAddress ?? r.esignConsentIp ?? null,
      authMethod: r.authMethod ?? "none",
      consentAt: formatTs(r.esignConsentAt),
      consentTextHash: r.esignConsentTextHash ?? null,
      privacyNoticeAt: formatTs(r.privacyNoticeAt),
      privacyNoticeTextHash: r.privacyNoticeTextHash ?? null,
    };
  });

  const recipientIds = recipientRows.map((r) => r.id);
  const auditWhere =
    recipientIds.length > 0
      ? or(
          and(
            eq(auditLogs.resourceType, "document"),
            eq(auditLogs.resourceId, documentId)
          ),
          and(
            eq(auditLogs.resourceType, "recipient"),
            inArray(auditLogs.resourceId, recipientIds)
          )
        )
      : and(
          eq(auditLogs.resourceType, "document"),
          eq(auditLogs.resourceId, documentId)
        );

  const relevantAudit = await db
    .select()
    .from(auditLogs)
    .where(and(eq(auditLogs.organizationId, doc.organizationId), auditWhere))
    .orderBy(asc(auditLogs.createdAt));

  const activityRows = await db
    .select()
    .from(activity)
    .where(eq(activity.organizationId, doc.organizationId))
    .orderBy(asc(activity.createdAt))
    .limit(500);
  const relevantActivity = activityRows.filter((row) => {
    const meta = row.metadata ?? "";
    return meta.includes(documentId) || meta.includes(doc.publicId);
  });

  const events = [
    ...relevantAudit.map((row) => ({
      action: row.action,
      at: formatTs(row.createdAt) ?? "",
      actor: `${row.actorType}:${row.actorId}`,
      detail: row.ipAddress ? `IP ${row.ipAddress}` : undefined,
    })),
    ...relevantActivity.map((row) => ({
      action: row.action,
      at: formatTs(row.createdAt) ?? "",
      actor: row.actorName,
      detail: row.targetName ?? undefined,
    })),
  ]
    .filter((e) => e.at)
    .toSorted((a, b) => a.at.localeCompare(b.at));

  const base = appUrl.replace(/\/$/, "");
  const verificationUrl = `${base}/verify/${encodeURIComponent(doc.qrToken)}`;

  const pdf = await buildCertificateOfCompletionPdf({
    documentName: doc.name,
    documentPublicId: doc.publicId,
    documentId: doc.id,
    organizationName: org?.name ?? "Organization",
    completedAt: formatTs(doc.completedAt) ?? formatTs(doc.updatedAt) ?? "",
    documentHash: doc.documentHash,
    verificationUrl,
    parties,
    events,
  });

  const storageKey = certificateStorageKey(doc.organizationId, doc.id);
  await bucket.put(storageKey, pdf, {
    httpMetadata: { contentType: "application/pdf" },
  });

  return { storageKey };
}
