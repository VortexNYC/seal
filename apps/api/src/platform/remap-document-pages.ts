import { eq, inArray } from "drizzle-orm";

import { createD1 } from "../global/db.js";
import { signatureFields } from "../global/schema.js";
import type { CropPdfPageOp } from "./pdf-ops.js";

type Db = ReturnType<typeof createD1>;

/**
 * After organizePdfPages: drop fields on deleted pages and rewrite page
 * numbers for survivors (old 1-based → new 1-based).
 */
export async function remapDocumentPagesAfterOrganize(
  db: Db,
  documentId: string,
  pageMap: Map<number, number>
): Promise<{ fieldsRemoved: number; fieldsRemapped: number }> {
  const fields = await db
    .select({
      id: signatureFields.id,
      page: signatureFields.page,
    })
    .from(signatureFields)
    .where(eq(signatureFields.documentId, documentId));

  const removeIds: string[] = [];
  const remap: Array<{ id: string; page: number }> = [];
  for (const field of fields) {
    const next = pageMap.get(field.page);
    if (next === undefined) {
      removeIds.push(field.id);
    } else if (next !== field.page) {
      remap.push({ id: field.id, page: next });
    }
  }

  if (removeIds.length > 0) {
    await db
      .delete(signatureFields)
      .where(inArray(signatureFields.id, removeIds));
  }
  const now = new Date();
  for (const row of remap) {
    await db
      .update(signatureFields)
      .set({ page: row.page, updatedAt: now })
      .where(eq(signatureFields.id, row.id));
  }

  return {
    fieldsRemoved: removeIds.length,
    fieldsRemapped: remap.length,
  };
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
 * into the new page percent space (0–100).
 */
export async function remapDocumentFieldsAfterCrop(
  db: Db,
  documentId: string,
  applied: Map<number, CropPdfPageOp>
): Promise<{ fieldsRemoved: number; fieldsRemapped: number }> {
  if (applied.size === 0) {
    return { fieldsRemoved: 0, fieldsRemapped: 0 };
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

  const removeIds: string[] = [];
  const remap: Array<{
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
  }> = [];

  for (const field of fields) {
    const crop = applied.get(field.page);
    if (!crop) continue;
    if (!fieldFullyInsideCrop(field, crop)) {
      removeIds.push(field.id);
      continue;
    }
    remap.push({
      id: field.id,
      x: ((field.x - crop.x) / crop.width) * 100,
      y: ((field.y - crop.y) / crop.height) * 100,
      width: (field.width / crop.width) * 100,
      height: (field.height / crop.height) * 100,
    });
  }

  if (removeIds.length > 0) {
    await db
      .delete(signatureFields)
      .where(inArray(signatureFields.id, removeIds));
  }
  const now = new Date();
  for (const row of remap) {
    await db
      .update(signatureFields)
      .set({
        x: row.x,
        y: row.y,
        width: row.width,
        height: row.height,
        updatedAt: now,
      })
      .where(eq(signatureFields.id, row.id));
  }

  return {
    fieldsRemoved: removeIds.length,
    fieldsRemapped: remap.length,
  };
}
