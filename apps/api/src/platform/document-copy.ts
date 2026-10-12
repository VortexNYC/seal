import { and, eq } from "drizzle-orm";

import type { D1Client } from "../global/db.js";
import { documents, recipients, signatureFields } from "../global/schema.js";

function signingToken(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join(
    ""
  );
}

const TOKEN_MS = 30 * 24 * 60 * 60 * 1000;

/** One "Copy of" prefix, so copies of copies do not stack. */
export function copiedDocumentName(name: string): string {
  const trimmed = name.trim() || "Document";
  return trimmed.startsWith("Copy of ") ? trimmed : `Copy of ${trimmed}`;
}

function storageKeyFor(organizationId: string, publicId: string): string {
  return `${organizationId}/documents/${publicId}`;
}

export async function copyDocument(params: {
  db: D1Client;
  bucket: R2Bucket;
  organizationId: string;
  ownerId: string;
  sourcePublicId: string;
}): Promise<{ id: string; publicId: string } | null> {
  const rows = await params.db
    .select()
    .from(documents)
    .where(
      and(
        eq(documents.publicId, params.sourcePublicId),
        eq(documents.organizationId, params.organizationId),
        eq(documents.documentStatus, "active")
      )
    )
    .limit(1);
  const source = rows[0];
  if (!source) return null;

  const sourceKey = source.originalStorageKey ?? source.storageKey;
  if (!sourceKey) return null;
  const object = await params.bucket.get(sourceKey);
  if (!object) return null;

  const now = new Date();
  const id = crypto.randomUUID();
  const publicId = crypto.randomUUID();
  const key = storageKeyFor(params.organizationId, publicId);
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
    name: copiedDocumentName(source.name),
    description: source.description,
    status: "draft",
    documentStatus: "active",
    sharingMode: "private",
    storageKey: key,
    contentType: source.contentType,
    size: source.size,
    pageCount: source.pageCount,
    signingMode: source.signingMode,
    allowDictateNextSigner: source.allowDictateNextSigner,
    parentDocumentId: source.id,
    qrToken: crypto.randomUUID(),
    workflowStatus: "draft",
    createdAt: now,
    updatedAt: now,
  });

  const sourceRecipients = await params.db
    .select()
    .from(recipients)
    .where(eq(recipients.documentId, source.id));
  const recipientIdMap = new Map<string, string>();
  if (sourceRecipients.length > 0) {
    const copies = sourceRecipients.map((recipient) => {
      const nextId = crypto.randomUUID();
      recipientIdMap.set(recipient.id, nextId);
      return {
        id: nextId,
        publicId: crypto.randomUUID(),
        documentId: id,
        name: recipient.name,
        email: recipient.email,
        role: recipient.role,
        order: recipient.order,
        status: "pending" as const,
        signingToken: signingToken(),
        tokenExpiresAt: new Date(now.getTime() + TOKEN_MS),
        authMethod: recipient.authMethod,
        accessCodeHash: recipient.accessCodeHash,
        isPlaceholder: recipient.isPlaceholder,
        createdAt: now,
        updatedAt: now,
      };
    });
    await params.db.insert(recipients).values(copies);
  }

  const sourceFields = await params.db
    .select()
    .from(signatureFields)
    .where(eq(signatureFields.documentId, source.id));
  if (sourceFields.length > 0) {
    await params.db.insert(signatureFields).values(
      sourceFields.map((field) => ({
        id: crypto.randomUUID(),
        publicId: crypto.randomUUID(),
        documentId: id,
        recipientId: field.recipientId
          ? (recipientIdMap.get(field.recipientId) ?? null)
          : null,
        templateFieldId: field.templateFieldId,
        fieldType: field.fieldType,
        label: field.label,
        isRequired: field.isRequired,
        isMainSignature: field.isMainSignature,
        x: field.x,
        y: field.y,
        width: field.width,
        height: field.height,
        page: field.page,
        properties: field.properties,
        validationRules: field.validationRules,
        createdAt: now,
        updatedAt: now,
      }))
    );
  }

  return { id, publicId };
}
