import { env } from "cloudflare:test";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";

import { createD1 } from "../global/db.js";
import { documents, organization, signatureFields } from "../global/schema.js";
import {
  commitDocumentPdfRemap,
  planOrganizeFieldRemap,
} from "./remap-document-pages.js";

async function seedDoc(storageKey = "uploads/original") {
  const db = createD1(env.D1);
  await db.insert(organization).values({
    id: "org_remap",
    name: "Remap Org",
    slug: "remap-org",
  });
  await db.insert(documents).values({
    id: "doc_remap",
    publicId: "doc_pub_remap",
    organizationId: "org_remap",
    name: "Remap Doc",
    status: "draft",
    documentStatus: "active",
    sharingMode: "private",
    storageKey,
    pageCount: 3,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

async function seedField(id: string, page: number) {
  const db = createD1(env.D1);
  await db.insert(signatureFields).values({
    id,
    publicId: `pub_${id}`,
    documentId: "doc_remap",
    fieldType: "signature",
    label: "Sign here",
    isRequired: true,
    isMainSignature: false,
    x: 10,
    y: 10,
    width: 20,
    height: 10,
    page,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

async function listFields() {
  const db = createD1(env.D1);
  return db
    .select({ id: signatureFields.id, page: signatureFields.page })
    .from(signatureFields)
    .where(eq(signatureFields.documentId, "doc_remap"));
}

describe("commitDocumentPdfRemap", () => {
  beforeEach(async () => {
    const db = createD1(env.D1);
    await db.delete(signatureFields);
    await db.delete(documents);
    await db.delete(organization);
  });

  it("claims the document and remaps fields in one batch", async () => {
    const db = createD1(env.D1);
    await seedDoc();
    await seedField("field_p1", 1);
    await seedField("field_p2", 2);
    await seedField("field_p3", 3);

    // Keep pages [3, 1] — page 2 deleted, page 3 becomes page 2.
    const pageMap = new Map([
      [1, 1],
      [3, 2],
    ]);
    const plan = await planOrganizeFieldRemap(db, "doc_remap", pageMap);
    expect(plan.removeIds).toEqual(["field_p2"]);
    expect(plan.updates).toEqual([{ id: "field_p3", page: 2 }]);

    const won = await commitDocumentPdfRemap(db, {
      documentId: "doc_remap",
      expectedStorageKey: "uploads/original",
      storageId: "uploads/organized",
      size: 1234,
      pageCount: 2,
      plan,
    });
    expect(won).toBe(true);

    const docs = await db
      .select({
        storageKey: documents.storageKey,
        pageCount: documents.pageCount,
      })
      .from(documents)
      .where(eq(documents.id, "doc_remap"));
    expect(docs[0]?.storageKey).toBe("uploads/organized");
    expect(docs[0]?.pageCount).toBe(2);

    const fields = await listFields();
    expect(fields).toHaveLength(2);
    expect(fields.find((f) => f.id === "field_p1")?.page).toBe(1);
    expect(fields.find((f) => f.id === "field_p3")?.page).toBe(2);
  });

  it("performs no field mutations when the claim is stale", async () => {
    const db = createD1(env.D1);
    await seedDoc("uploads/moved-elsewhere");
    await seedField("field_p1", 1);
    await seedField("field_p2", 2);

    const plan = await planOrganizeFieldRemap(
      db,
      "doc_remap",
      new Map([[1, 1]])
    );
    expect(plan.removeIds).toEqual(["field_p2"]);

    const won = await commitDocumentPdfRemap(db, {
      documentId: "doc_remap",
      expectedStorageKey: "uploads/original",
      storageId: "uploads/organized",
      size: 1234,
      pageCount: 1,
      plan,
    });
    expect(won).toBe(false);

    const docs = await db
      .select({ storageKey: documents.storageKey })
      .from(documents)
      .where(eq(documents.id, "doc_remap"));
    expect(docs[0]?.storageKey).toBe("uploads/moved-elsewhere");

    const fields = await listFields();
    expect(fields).toHaveLength(2);
  });
});
