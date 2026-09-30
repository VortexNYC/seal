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
