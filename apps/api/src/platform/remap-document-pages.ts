import { eq, inArray } from "drizzle-orm";

import { createD1 } from "../global/db.js";
import { signatureFields } from "../global/schema.js";

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
