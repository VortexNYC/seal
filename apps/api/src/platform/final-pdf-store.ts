/**
 * Persist flattened + platform-sealed final PDF on document.completed
 * (SEA-49 Level 1a flatten + Level 1b PAdES-B).
 */

import { eq } from "drizzle-orm";

import type { D1Client } from "../global/db.js";
import { documents, signatureFields, signatures } from "../global/schema.js";
import {
  finalPdfStorageKey,
  flattenFieldsIntoPdf,
  sha256PdfBytes,
  type FinalPdfField,
} from "./final-pdf.js";
import {
  readPdfSealCredentials,
  sealPdfBytes,
  type PdfSealEnv,
} from "./pdf-seal.js";

export type FinalPdfStoreResult = {
  storageKey: string;
  documentHash: string;
  burnedFields: number;
  byteLength: number;
  sealed: boolean;
};

export async function generateAndStoreFinalPdf(params: {
  db: D1Client;
  bucket: R2Bucket;
  documentId: string;
  /** Worker env — used for optional platform PAdES-B secrets. */
  env?: PdfSealEnv;
}): Promise<FinalPdfStoreResult | null> {
  const { db, bucket, documentId, env } = params;

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
  let finalBytes = flattened.bytes;
  let sealed = false;

  const credentials = env ? readPdfSealCredentials(env) : null;
  if (credentials) {
    // Fail closed when secrets are configured: do not store an unsealed
    // artifact as the final PDF. Callers catch and leave the original in place.
    const sealedResult = await sealPdfBytes(flattened.bytes, credentials);
    finalBytes = sealedResult.bytes;
    sealed = true;
  }

  const documentHash = await sha256PdfBytes(finalBytes);
  const storageKey = finalPdfStorageKey(doc.organizationId, doc.id);

  await bucket.put(storageKey, finalBytes, {
    httpMetadata: { contentType: "application/pdf" },
    customMetadata: {
      kind: "seal-final-pdf",
      documentHash,
      burnedFields: String(flattened.burnedFields),
      sealed: sealed ? "true" : "false",
    },
  });

  const originalKey = doc.originalStorageKey ?? doc.storageKey;
  await db
    .update(documents)
    .set({
      originalStorageKey: originalKey,
      storageKey,
      size: finalBytes.byteLength,
      documentHash,
      contentType: "application/pdf",
      updatedAt: new Date(),
    })
    .where(eq(documents.id, documentId));

  return {
    storageKey,
    documentHash,
    burnedFields: flattened.burnedFields,
    byteLength: finalBytes.byteLength,
    sealed,
  };
}
