import { and, eq } from "drizzle-orm";

import type { D1Client } from "../global/db.js";
import { documents } from "../global/schema.js";
import { sendForwardedDocumentEmail, type EmailEnv } from "./email.js";

/** One "Forward of" prefix, so a forward of a forward does not stack. */
export function forwardedEnvelopeName(name: string): string {
  const trimmed = name.trim() || "Document";
  return trimmed.startsWith("Forward of ") ? trimmed : `Forward of ${trimmed}`;
}

export async function forwardCompletedDocument(params: {
  db: D1Client;
  bucket: R2Bucket;
  env: EmailEnv;
  organizationId: string;
  sourcePublicId: string;
  to: string;
  senderName: string;
}): Promise<
  "sent" | "not_found" | "not_completed" | "no_file" | "email_failed"
> {
  const rows = await params.db
    .select({
      name: documents.name,
      status: documents.status,
      storageKey: documents.storageKey,
      documentStatus: documents.documentStatus,
    })
    .from(documents)
    .where(
      and(
        eq(documents.publicId, params.sourcePublicId),
        eq(documents.organizationId, params.organizationId)
      )
    )
    .limit(1);
  const doc = rows[0];
  if (!doc || doc.documentStatus === "deleted") return "not_found";
  if (doc.status !== "completed" || !doc.storageKey) {
    return doc.status === "completed" ? "no_file" : "not_completed";
  }
  const object = await params.bucket.get(doc.storageKey);
  if (!object) return "no_file";
  const result = await sendForwardedDocumentEmail(params.env, {
    to: params.to,
    senderName: params.senderName,
    documentName: doc.name,
    pdf: {
      filename: doc.name.toLowerCase().endsWith(".pdf")
        ? doc.name
        : `${doc.name}.pdf`,
      content: new Uint8Array(await object.arrayBuffer()),
    },
  });
  return result.success ? "sent" : "email_failed";
}

export async function startEnvelopeFromCompleted(params: {
  db: D1Client;
  bucket: R2Bucket;
  organizationId: string;
  ownerId: string;
  sourcePublicId: string;
}): Promise<
  { id: string; publicId: string } | "not_found" | "not_completed" | "no_file"
> {
  const rows = await params.db
    .select()
    .from(documents)
    .where(
      and(
        eq(documents.publicId, params.sourcePublicId),
        eq(documents.organizationId, params.organizationId)
      )
    )
    .limit(1);
  const source = rows[0];
  if (!source || source.documentStatus === "deleted") return "not_found";
  if (source.status !== "completed") return "not_completed";
  if (!source.storageKey) return "no_file";

  const object = await params.bucket.get(source.storageKey);
  if (!object) return "no_file";

  const now = new Date();
  const id = crypto.randomUUID();
  const publicId = crypto.randomUUID();
  const key = `${params.organizationId}/documents/${publicId}`;
  await params.bucket.put(key, await object.arrayBuffer(), {
    httpMetadata: {
      contentType: object.httpMetadata?.contentType ?? "application/pdf",
    },
  });

  await params.db.insert(documents).values({
    id,
    publicId,
    organizationId: params.organizationId,
    ownerId: params.ownerId,
    folderId: source.folderId,
    name: forwardedEnvelopeName(source.name),
    description: source.description,
    status: "draft",
    documentStatus: "active",
    sharingMode: "private",
    storageKey: key,
    contentType: source.contentType ?? "application/pdf",
    size: source.size,
    pageCount: source.pageCount,
    signingMode: "parallel",
    allowDictateNextSigner: false,
    parentDocumentId: source.id,
    qrToken: crypto.randomUUID(),
    workflowStatus: "draft",
    createdAt: now,
    updatedAt: now,
  });

  return { id, publicId };
}
