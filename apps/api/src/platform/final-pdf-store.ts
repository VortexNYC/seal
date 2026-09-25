/**
 * Persist flattened final PDF on document.completed (SEA-49 Level 1a).
 */

import { eq } from "drizzle-orm";

import type { D1Client } from "../global/db.js";
import { documents, signatureFields, signatures } from "../global/schema.js";
import {
  finalPdfStorageKey,
  flattenFieldsIntoPdf,
  type FinalPdfField,
} from "./final-pdf.js";

export type FinalPdfStoreResult = {
  storageKey: string;
  documentHash: string;
  burnedFields: number;
  byteLength: number;
};

export async function generateAndStoreFinalPdf(params: {
  db: D1Client;
  bucket: R2Bucket;
  documentId: string;
}): Promise<FinalPdfStoreResult | null> {
  const { db, bucket, documentId } = params;

  const [doc] = await db
    .select()
    .from(documents)
    .where(eq(documents.id, documentId))
    .limit(1);
  if (!doc || doc.status !== "completed") {
    return null;
  }
  if (!doc.storageKey) {
    return null;
  }

  const sourceKey = doc.originalStorageKey ?? doc.storageKey;
  const object = await bucket.get(sourceKey);
  if (!object) {
    console.error("[final-pdf] source PDF missing:", sourceKey);
    return null;
  }
  const sourceBytes = new Uint8Array(await object.arrayBuffer());

  const fieldRows = await db
    .select()
    .from(signatureFields)
    .where(eq(signatureFields.documentId, documentId));

  const signatureRows = await db
    .select()
    .from(signatures)
    .where(eq(signatures.documentId, documentId));

  const sigByField = new Map(
    signatureRows
      .filter((s) => s.fieldId)
      .map((s) => [s.fieldId as string, s] as const)
  );

  const fields: FinalPdfField[] = fieldRows.map((field) => {
    const sig = sigByField.get(field.id);
    return {
      fieldType: field.fieldType,
      page: field.page,
      x: field.x,
      y: field.y,
      width: field.width,
      height: field.height,
      value: sig?.value ?? null,
      signatureImageUrl: sig?.signatureImageUrl ?? null,
    };
  });

  const flattened = await flattenFieldsIntoPdf(sourceBytes, fields);
  const storageKey = finalPdfStorageKey(doc.organizationId, doc.id);

  await bucket.put(storageKey, flattened.bytes, {
    httpMetadata: { contentType: "application/pdf" },
    customMetadata: {
      kind: "seal-final-pdf",
      documentHash: flattened.documentHash,
      burnedFields: String(flattened.burnedFields),
    },
  });

  const originalKey = doc.originalStorageKey ?? doc.storageKey;
  await db
    .update(documents)
    .set({
      originalStorageKey: originalKey,
      storageKey,
      size: flattened.bytes.byteLength,
      documentHash: flattened.documentHash,
      contentType: "application/pdf",
      updatedAt: new Date(),
    })
    .where(eq(documents.id, documentId));

  return {
    storageKey,
    documentHash: flattened.documentHash,
    burnedFields: flattened.burnedFields,
    byteLength: flattened.bytes.byteLength,
  };
}
