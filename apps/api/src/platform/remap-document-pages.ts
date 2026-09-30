import { and, eq, exists, inArray } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";

import { createD1 } from "../global/db.js";
import { documents, signatureFields } from "../global/schema.js";
import type { CropPdfPageOp } from "./pdf-ops.js";

type Db = ReturnType<typeof createD1>;

type SignatureFieldRect = Pick<
  typeof signatureFields.$inferInsert,
  "page" | "x" | "y" | "width" | "height"
>;

/** Field mutations planned from a pre-batch read of signatureFields. */
export interface FieldRemapPlan {
  removeIds: string[];
  updates: Array<{ id: string } & Partial<SignatureFieldRect>>;
}

/**
 * After organizePdfPages: drop fields on deleted pages and rewrite page
 * numbers for survivors (old 1-based → new 1-based). Read-only — apply the
 * plan via commitDocumentPdfRemap so field writes land atomically with the
 * document storageKey claim.
 */
export async function planOrganizeFieldRemap(
  db: Db,
  documentId: string,
  pageMap: Map<number, number>
): Promise<FieldRemapPlan> {
  const fields = await db
    .select({
      id: signatureFields.id,
      page: signatureFields.page,
    })
    .from(signatureFields)
    .where(eq(signatureFields.documentId, documentId));

  const plan: FieldRemapPlan = { removeIds: [], updates: [] };
  for (const field of fields) {
    const next = pageMap.get(field.page);
    if (next === undefined) {
      plan.removeIds.push(field.id);
    } else if (next !== field.page) {
      plan.updates.push({ id: field.id, page: next });
    }
  }
  return plan;
}

/**
 * Claim the document's storageKey and apply the field remap in one D1 batch.
 * The document update is guarded by the expected old storageKey, and every
 * field mutation is guarded by an EXISTS on the new key — a stale request
 * that loses the claim performs no field writes. Returns false when the
 * document no longer sits on expectedStorageKey (another writer won).
 */
export async function commitDocumentPdfRemap(
  db: Db,
  input: {
    documentId: string;
    expectedStorageKey: string;
    storageId: string;
    size: number;
    pageCount: number;
    plan: FieldRemapPlan;
  }
): Promise<boolean> {
  const now = new Date();
  const claimed = exists(
    db
      .select({ id: documents.id })
      .from(documents)
      .where(
        and(
          eq(documents.id, input.documentId),
          eq(documents.storageKey, input.storageId)
        )
      )
  );

  const items: BatchItem<"sqlite">[] = [
    db
      .update(documents)
      .set({
        storageKey: input.storageId,
        size: input.size,
        contentType: "application/pdf",
        pageCount: input.pageCount,
        updatedAt: now,
      })
      .where(
        and(
          eq(documents.id, input.documentId),
          eq(documents.storageKey, input.expectedStorageKey)
        )
      )
      .returning({ id: documents.id }),
  ];

  if (input.plan.removeIds.length > 0) {
    items.push(
      db
        .delete(signatureFields)
        .where(and(inArray(signatureFields.id, input.plan.removeIds), claimed))
    );
  }
  for (const row of input.plan.updates) {
    const { id, ...patch } = row;
    items.push(
      db
        .update(signatureFields)
        .set({ ...patch, updatedAt: now })
        .where(and(eq(signatureFields.id, id), claimed))
    );
  }

  const [head, ...rest] = items;
  if (!head) {
    return false;
  }
  const results = await db.batch([head, ...rest]);
  const claimRows = results[0] as Array<{ id: string }>;
  return claimRows.length > 0;
}

function fieldFullyInsideCrop(
  field: { x: number; y: number; width: number; height: number },
  crop: CropPdfPageOp
): boolean {
  const eps = 0.05;
  return (
    field.x + eps >= crop.x &&
    field.y + eps >= crop.y &&
    field.x + field.width <= crop.x + crop.width + eps &&
    field.y + field.height <= crop.y + crop.height + eps
  );
}

/**
 * After cropPdfPages: drop fields that fall outside the crop; remap survivors
 * into the new page percent space (0–100). Read-only — apply the plan via
 * commitDocumentPdfRemap so field writes land atomically with the document
 * storageKey claim.
 */
export async function planCropFieldRemap(
  db: Db,
  documentId: string,
  applied: Map<number, CropPdfPageOp>
): Promise<FieldRemapPlan> {
  const plan: FieldRemapPlan = { removeIds: [], updates: [] };
  if (applied.size === 0) {
    return plan;
  }

  const fields = await db
    .select({
      id: signatureFields.id,
      page: signatureFields.page,
      x: signatureFields.x,
      y: signatureFields.y,
      width: signatureFields.width,
      height: signatureFields.height,
    })
    .from(signatureFields)
    .where(eq(signatureFields.documentId, documentId));

  for (const field of fields) {
    const crop = applied.get(field.page);
    if (!crop) continue;
    if (!fieldFullyInsideCrop(field, crop)) {
      plan.removeIds.push(field.id);
      continue;
    }
    plan.updates.push({
      id: field.id,
      x: ((field.x - crop.x) / crop.width) * 100,
      y: ((field.y - crop.y) / crop.height) * 100,
      width: (field.width / crop.width) * 100,
      height: (field.height / crop.height) * 100,
    });
  }
  return plan;
}
