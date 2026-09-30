import { OpenAPIHono } from "@hono/zod-openapi";
import { env } from "cloudflare:test";
import { eq } from "drizzle-orm";
import { PDFDocument, rgb } from "pdf-lib";
import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";

import { createD1 } from "../global/db.js";
import {
  documents,
  organization,
  signatureFields,
  user,
} from "../global/schema.js";
import { getPdfPageCount } from "../platform/pdf-ops.js";
import type { Variables } from "../platform/types.js";
import documentPower from "./document-power.js";

/**
 * Minimal hand-built PDF whose trailer carries an /Encrypt dict — pdf-lib's
 * EncryptedPDFError path without needing a real encryption tool.
 */
function makeEncryptedFakePdf(): Uint8Array {
  let body = "%PDF-1.4\n";
  const offs: number[] = [0];
  const objs = [
    "<</Type/Catalog/Pages 2 0 R>>",
    "<</Type/Pages/Kids[3 0 R]/Count 1>>",
    "<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]>>",
  ];
  objs.forEach((s, i) => {
    offs.push(body.length);
    body += `${i + 1} 0 obj\n${s}\nendobj\n`;
  });
  const xrefPos = body.length;
  let xref = "xref\n0 4\n0000000000 65535 f \n";
  for (let n = 1; n <= 3; n++) {
    xref += `${String(offs[n]).padStart(10, "0")} 00000 n \n`;
  }
  const trailer =
    "trailer\n" +
    "<</Size 4/Root 1 0 R/Encrypt<</Filter/Standard/V 2/R 3/O()/U()/P -4>>>>\n" +
    `startxref\n${xrefPos}\n%%EOF`;
  return new TextEncoder().encode(body + xref + trailer);
}

async function makePdf(pages = 3): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (let i = 0; i < pages; i++) {
    const page = doc.addPage([612, 792]);
    page.drawText(`Page ${i + 1}`, {
      x: 50,
      y: 700,
      size: 12,
      color: rgb(0, 0, 0),
    });
  }
  return doc.save();
}

type OrgRow = typeof organization.$inferSelect;

function createApp(org: OrgRow, userId = "user_1") {
  const app = new OpenAPIHono<{
    Bindings: CloudflareBindings;
    Variables: Variables;
  }>();

  app.use("/api/documents/*", async (c, next) => {
    c.set("user", {
      user: { id: userId, name: "Test User", email: "test@example.com" },
      session: { activeOrganizationId: org.id },
    });
    c.set("organization", org);
    await next();
  });

  app.route("/api/documents/:slug/:publicId/power", documentPower);
  return app;
}

const DOC_ID = "doc_power";
const DOC_PUBLIC_ID = "doc_power_pub";
const STORAGE_KEY = "uploads/power-original";

async function seedFixture(opts: { status?: string; pages?: number } = {}) {
  const db = createD1(env.D1);
  await db.insert(organization).values({
    id: "org_power",
    name: "Power Org",
    slug: "power-org",
  });
  await db.insert(user).values({
    id: "user_1",
    name: "Test User",
    email: "test@example.com",
    emailVerified: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const pageCount = opts.pages ?? 3;
  await env.DOCUMENTS_BUCKET.put(STORAGE_KEY, await makePdf(pageCount), {
    httpMetadata: { contentType: "application/pdf" },
  });

  await db.insert(documents).values({
    id: DOC_ID,
    publicId: DOC_PUBLIC_ID,
    organizationId: "org_power",
    ownerId: "user_1",
    name: "Power Doc",
    status: opts.status ?? "draft",
    documentStatus: "active",
    sharingMode: "private",
    storageKey: STORAGE_KEY,
    contentType: "application/pdf",
    pageCount,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const orgRows = await db
    .select()
    .from(organization)
    .where(eq(organization.id, "org_power"));
  const org = orgRows[0];
  if (!org) throw new Error("seed org missing");
  return createApp(org);
}

async function seedField(
  id: string,
  page: number,
  rect = { x: 10, y: 10, width: 20, height: 10 }
) {
  const db = createD1(env.D1);
  await db.insert(signatureFields).values({
    id,
    publicId: `pub_${id}`,
    documentId: DOC_ID,
    fieldType: "signature",
    label: "Sign here",
    isRequired: true,
    isMainSignature: false,
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    page,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
}

function powerPost(publicId: string, op: string, body: unknown) {
  return new Request(
    `http://localhost:8787/api/documents/power-org/${publicId}/power/${op}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }
  );
}

const organizeResponseSchema = z.object({
  success: z.boolean(),
  storageId: z.string(),
  pageCount: z.number(),
  fieldsRemoved: z.number(),
  fieldsRemapped: z.number(),
});

const stampResponseSchema = z.object({
  success: z.boolean(),
  storageId: z.string(),
  pageCount: z.number(),
});

const compressResponseSchema = z.object({
  success: z.boolean(),
  storageId: z.string(),
  pageCount: z.number(),
  sizeBefore: z.number(),
  sizeAfter: z.number(),
});

const errorSchema = z.object({ error: z.string() });

describe("document power routes", () => {
  beforeEach(async () => {
    const db = createD1(env.D1);
    await db.delete(signatureFields);
    await db.delete(documents);
    await db.delete(organization);
    await db.delete(user);
  });

  it("organize-pdf reorders/deletes pages and remaps fields atomically", async () => {
    const app = await seedFixture();
    const db = createD1(env.D1);
    await seedField("field_p1", 1);
    await seedField("field_p2", 2);
    await seedField("field_p3", 3);

    const res = await app.fetch(
      powerPost(DOC_PUBLIC_ID, "organize-pdf", { pages: [3, 1] }),
      env
    );
    expect(res.status).toBe(200);
    const json = organizeResponseSchema.parse(await res.json());
    expect(json.success).toBe(true);
    expect(json.pageCount).toBe(2);
    expect(json.fieldsRemoved).toBe(1);
    expect(json.fieldsRemapped).toBe(2);

    const docs = await db
      .select()
      .from(documents)
      .where(eq(documents.id, DOC_ID));
    expect(docs[0]?.storageKey).toBe(json.storageId);
    expect(docs[0]?.pageCount).toBe(2);

    const object = await env.DOCUMENTS_BUCKET.get(json.storageId);
    if (!object) throw new Error("organized pdf missing from R2");
    expect(await getPdfPageCount(await object.arrayBuffer())).toBe(2);

    const fields = await db
      .select({ id: signatureFields.id, page: signatureFields.page })
      .from(signatureFields)
      .where(eq(signatureFields.documentId, DOC_ID));
    expect(fields).toHaveLength(2);
    expect(fields.find((f) => f.id === "field_p1")?.page).toBe(2);
    expect(fields.find((f) => f.id === "field_p3")?.page).toBe(1);
    expect(fields.some((f) => f.id === "field_p2")).toBe(false);
  });

  it("organize-pdf rejects duplicate pages", async () => {
    const app = await seedFixture();
    const res = await app.fetch(
      powerPost(DOC_PUBLIC_ID, "organize-pdf", { pages: [1, 1, 2] }),
      env
    );
    expect(res.status).toBe(400);
    expect(errorSchema.parse(await res.json()).error).toBe("duplicate_pages");
  });

  it("watermark-pdf and number-pdf-pages restamp the draft", async () => {
    const app = await seedFixture();
    const db = createD1(env.D1);

    const res = await app.fetch(
      powerPost(DOC_PUBLIC_ID, "watermark-pdf", { text: "DRAFT" }),
      env
    );
    expect(res.status).toBe(200);
    const json = stampResponseSchema.parse(await res.json());
    expect(json.pageCount).toBe(3);

    const docs = await db
      .select({ storageKey: documents.storageKey })
      .from(documents)
      .where(eq(documents.id, DOC_ID));
    expect(docs[0]?.storageKey).toBe(json.storageId);

    const res2 = await app.fetch(
      powerPost(DOC_PUBLIC_ID, "number-pdf-pages", { format: "n_of_m" }),
      env
    );
    expect(res2.status).toBe(200);
    const json2 = stampResponseSchema.parse(await res2.json());
    expect(json2.storageId).not.toBe(json.storageId);
  });

  it("crop-pdf remaps inside fields and drops outside ones", async () => {
    const app = await seedFixture();
    const db = createD1(env.D1);
    await seedField("field_inside", 1, {
      x: 10,
      y: 10,
      width: 20,
      height: 10,
    });
    await seedField("field_outside", 1, {
      x: 80,
      y: 80,
      width: 10,
      height: 10,
    });

    const res = await app.fetch(
      powerPost(DOC_PUBLIC_ID, "crop-pdf", {
        crops: [{ page: 1, x: 10, y: 10, width: 50, height: 50 }],
      }),
      env
    );
    expect(res.status).toBe(200);
    const json = organizeResponseSchema.parse(await res.json());
    expect(json.fieldsRemoved).toBe(1);
    expect(json.fieldsRemapped).toBe(1);

    const fields = await db
      .select()
      .from(signatureFields)
      .where(eq(signatureFields.documentId, DOC_ID));
    const inside = fields.find((f) => f.id === "field_inside");
    expect(inside?.x).toBe(0);
    expect(inside?.width).toBe(40);
    expect(fields.some((f) => f.id === "field_outside")).toBe(false);

    const object = await env.DOCUMENTS_BUCKET.get(json.storageId);
    expect(object).not.toBeNull();
  });

  it("compress-pdf swaps the draft bytes and reports sizes", async () => {
    const app = await seedFixture();
    const db = createD1(env.D1);
    await seedField("field_p1", 1);

    const res = await app.fetch(
      powerPost(DOC_PUBLIC_ID, "compress-pdf", { imageQuality: 70 }),
      env
    );
    expect(res.status).toBe(200);
    const json = compressResponseSchema.parse(await res.json());
    expect(json.success).toBe(true);
    // Convert-worker mock returns its fixture PDF (1 page).
    expect(json.pageCount).toBe(1);
    expect(json.sizeBefore).toBeGreaterThan(0);
    expect(json.sizeAfter).toBeGreaterThan(0);

    const docs = await db
      .select({ storageKey: documents.storageKey, size: documents.size })
      .from(documents)
      .where(eq(documents.id, DOC_ID));
    expect(docs[0]?.storageKey).toBe(json.storageId);
    expect(docs[0]?.size).toBe(json.sizeAfter);

    const object = await env.DOCUMENTS_BUCKET.get(json.storageId);
    expect(object).not.toBeNull();

    // Compression does not touch field geometry.
    const fields = await db
      .select({ id: signatureFields.id, page: signatureFields.page })
      .from(signatureFields)
      .where(eq(signatureFields.documentId, DOC_ID));
    expect(fields).toHaveLength(1);
  });

  it("redact-pdf scrubs the region and removes intersecting fields", async () => {
    const app = await seedFixture();
    const db = createD1(env.D1);
    // Field entirely inside the region → must be dropped.
    await seedField("field_in", 1, { x: 10, y: 10, width: 20, height: 5 });
    // Field outside → survives.
    await seedField("field_out", 1, { x: 60, y: 60, width: 20, height: 5 });

    const res = await app.fetch(
      powerPost(DOC_PUBLIC_ID, "redact-pdf", {
        regions: [{ page: 1, x: 0, y: 0, width: 50, height: 30 }],
      }),
      env
    );
    expect(res.status).toBe(200);
    const json = z
      .object({
        success: z.boolean(),
        storageId: z.string(),
        regionsApplied: z.number(),
        opsScrubbed: z.number(),
        fieldsRemoved: z.number(),
        scrubbedText: z.string(),
        warnings: z.array(z.string()),
      })
      .parse(await res.json());
    expect(json.success).toBe(true);
    expect(json.regionsApplied).toBe(1);
    expect(json.fieldsRemoved).toBe(1);

    const fields = await db
      .select({ id: signatureFields.id })
      .from(signatureFields)
      .where(eq(signatureFields.documentId, DOC_ID));
    expect(fields.map((f) => f.id)).toEqual(["field_out"]);

    const object = await env.DOCUMENTS_BUCKET.get(json.storageId);
    expect(object).not.toBeNull();
  });

  it("protect-pdf creates an encrypted artifact without touching the draft", async () => {
    const app = await seedFixture();
    const res = await app.fetch(
      powerPost(DOC_PUBLIC_ID, "protect-pdf", { userPassword: "s3cret" }),
      env
    );
    expect(res.status).toBe(200);
    const json = z
      .object({
        success: z.boolean(),
        storageId: z.string(),
        downloadUrl: z.string().nullable(),
      })
      .parse(await res.json());
    const object = await env.DOCUMENTS_BUCKET.get(json.storageId);
    expect(object).not.toBeNull();
    // Working draft keeps its original storageKey.
    const db = createD1(env.D1);
    const docs = await db
      .select({ storageKey: documents.storageKey })
      .from(documents)
      .where(eq(documents.id, DOC_ID));
    expect(docs[0]?.storageKey).toBe(STORAGE_KEY);
  });

  it("protect-pdf rejects when no password is given", async () => {
    const app = await seedFixture();
    const res = await app.fetch(
      powerPost(DOC_PUBLIC_ID, "protect-pdf", {}),
      env
    );
    expect(res.status).toBe(400);
  });

  it("unlock-pdf rejects an unencrypted doc", async () => {
    const app = await seedFixture();
    const res = await app.fetch(
      powerPost(DOC_PUBLIC_ID, "unlock-pdf", { password: "x" }),
      env
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "not_encrypted" });
  });

  it("unlock-pdf decrypts and claims the doc's storageKey", async () => {
    const app = await seedFixture();
    // Plant encrypted-looking bytes (trailer /Encrypt dict) at storageKey.
    const encBytes = makeEncryptedFakePdf();
    await env.DOCUMENTS_BUCKET.put(STORAGE_KEY, encBytes, {
      httpMetadata: { contentType: "application/pdf" },
    });
    const res = await app.fetch(
      powerPost(DOC_PUBLIC_ID, "unlock-pdf", { password: "s3cret" }),
      env
    );
    expect(res.status).toBe(200);
    const json = z
      .object({
        success: z.boolean(),
        storageId: z.string(),
        pageCount: z.number(),
        warnings: z.array(z.string()),
      })
      .parse(await res.json());
    expect(json.warnings).toContain("libreoffice_roundtrip");
    const db = createD1(env.D1);
    const docs = await db
      .select({ storageKey: documents.storageKey })
      .from(documents)
      .where(eq(documents.id, DOC_ID));
    expect(docs[0]?.storageKey).toBe(json.storageId);
  });

  it("flatten-pdf swaps storageKey via the guarded claim", async () => {
    const app = await seedFixture();
    const res = await app.fetch(
      powerPost(DOC_PUBLIC_ID, "flatten-pdf", {}),
      env
    );
    expect(res.status).toBe(200);
    const json = z
      .object({
        success: z.boolean(),
        storageId: z.string(),
        pageCount: z.number(),
      })
      .parse(await res.json());
    const db = createD1(env.D1);
    const docs = await db
      .select({ storageKey: documents.storageKey })
      .from(documents)
      .where(eq(documents.id, DOC_ID));
    expect(docs[0]?.storageKey).toBe(json.storageId);
    const object = await env.DOCUMENTS_BUCKET.get(json.storageId);
    expect(object).not.toBeNull();
  });

  it("export-pdf-images produces a ZIP artifact", async () => {
    const app = await seedFixture();
    const res = await app.fetch(
      powerPost(DOC_PUBLIC_ID, "export-pdf-images", {
        format: "png",
        dpi: 150,
      }),
      env
    );
    expect(res.status).toBe(200);
    const json = z
      .object({
        success: z.boolean(),
        storageId: z.string(),
        format: z.string(),
        downloadUrl: z.string().nullable(),
      })
      .parse(await res.json());
    const object = await env.DOCUMENTS_BUCKET.get(json.storageId);
    expect(object).not.toBeNull();
  });

  it("ocr-pdf claims the searchable PDF onto the doc", async () => {
    const app = await seedFixture();
    const res = await app.fetch(
      powerPost(DOC_PUBLIC_ID, "ocr-pdf", { lang: "eng" }),
      env
    );
    expect(res.status).toBe(200);
    const json = z
      .object({
        success: z.boolean(),
        storageId: z.string(),
        pageCount: z.number(),
        lang: z.string(),
      })
      .parse(await res.json());
    const db = createD1(env.D1);
    const docs = await db
      .select({ storageKey: documents.storageKey })
      .from(documents)
      .where(eq(documents.id, DOC_ID));
    expect(docs[0]?.storageKey).toBe(json.storageId);
  });

  it("ocr-pdf rejects a bad lang", async () => {
    const app = await seedFixture();
    const res = await app.fetch(
      powerPost(DOC_PUBLIC_ID, "ocr-pdf", { lang: "english" }),
      env
    );
    expect(res.status).toBe(400);
  });

  it("compress-pdf honours the org convert egress gate", async () => {
    const app = await seedFixture();
    const db = createD1(env.D1);
    await db
      .update(organization)
      .set({
        metadata: JSON.stringify({
          seal_settings: { egress: { allow_convert: false } },
        }),
      })
      .where(eq(organization.id, "org_power"));

    const res = await app.fetch(
      powerPost(DOC_PUBLIC_ID, "compress-pdf", {}),
      env
    );
    expect(res.status).toBe(403);
    expect(errorSchema.parse(await res.json()).error).toBe("convert_disabled");
  });

  it("rejects mutations on a non-draft document", async () => {
    const app = await seedFixture({ status: "sent" });
    const res = await app.fetch(
      powerPost(DOC_PUBLIC_ID, "organize-pdf", { pages: [2, 1, 3] }),
      env
    );
    expect(res.status).toBe(400);
    expect(errorSchema.parse(await res.json()).error).toBe(
      "document_not_editable"
    );
  });
});
