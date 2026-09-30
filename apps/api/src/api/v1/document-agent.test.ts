import { OpenAPIHono } from "@hono/zod-openapi";
import { env } from "cloudflare:test";
import { eq } from "drizzle-orm";
import { PDFDocument, rgb } from "pdf-lib";
import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";

import { createD1 } from "../../global/db.js";
import {
  documents,
  organization,
  signatureFields,
  user,
} from "../../global/schema.js";
import type { McpAccessToken } from "../../platform/mcp-auth.js";
import { getPdfPageCount } from "../../platform/pdf-ops.js";
import documentAgentRoutes from "./document-agent.js";

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

function createApp(mcp: McpAccessToken) {
  const app = new OpenAPIHono<{
    Bindings: CloudflareBindings;
    Variables: { mcp: McpAccessToken };
  }>();

  app.use("/api/v1/documents/*", async (c, next) => {
    c.set("mcp", mcp);
    await next();
  });

  app.route("/api/v1/documents", documentAgentRoutes);
  return app;
}

const DOC_ID = "doc_agent";
const STORAGE_KEY = "uploads/agent-original";

async function seedFixture() {
  const db = createD1(env.D1);
  await db.insert(organization).values({
    id: "org_agent",
    name: "Agent Org",
    slug: "agent-org",
  });
  await db.insert(user).values({
    id: "user_1",
    name: "Test User",
    email: "test@example.com",
    emailVerified: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  await env.DOCUMENTS_BUCKET.put(STORAGE_KEY, await makePdf(3), {
    httpMetadata: { contentType: "application/pdf" },
  });
  await db.insert(documents).values({
    id: DOC_ID,
    publicId: "doc_agent_pub",
    organizationId: "org_agent",
    ownerId: "user_1",
    name: "Agent Doc",
    status: "draft",
    documentStatus: "active",
    sharingMode: "private",
    storageKey: STORAGE_KEY,
    contentType: "application/pdf",
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
    documentId: DOC_ID,
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

function agentPost(op: string, body: unknown) {
  return new Request(`http://localhost:8787/api/v1/documents/pdf/${op}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const writeMcp: McpAccessToken = {
  sub: "user_1",
  organizationId: "org_agent",
  scope: "documents:read documents:write",
  clientId: "test-client",
  jti: "test-jti",
};

const readMcp: McpAccessToken = { ...writeMcp, scope: "documents:read" };

const organizeResponseSchema = z.object({
  success: z.boolean(),
  storage_id: z.string(),
  page_count: z.number(),
  fields_removed: z.number(),
  fields_remapped: z.number(),
});

const errorSchema = z.object({ error: z.string() });

describe("document agent pdf routes", () => {
  beforeEach(async () => {
    const db = createD1(env.D1);
    await db.delete(signatureFields);
    await db.delete(documents);
    await db.delete(organization);
    await db.delete(user);
  });

  it("organizes a draft and remaps fields for an agent", async () => {
    await seedFixture();
    const app = createApp(writeMcp);
    const db = createD1(env.D1);
    await seedField("field_p2", 2);

    const res = await app.fetch(
      agentPost("organize", { id: DOC_ID, pages: [3, 1] }),
      env
    );
    expect(res.status).toBe(200);
    const json = organizeResponseSchema.parse(await res.json());
    expect(json.success).toBe(true);
    expect(json.page_count).toBe(2);
    expect(json.fields_removed).toBe(1);

    const docs = await db
      .select({ storageKey: documents.storageKey })
      .from(documents)
      .where(eq(documents.id, DOC_ID));
    expect(docs[0]?.storageKey).toBe(json.storage_id);

    const object = await env.DOCUMENTS_BUCKET.get(json.storage_id);
    if (!object) throw new Error("organized pdf missing from R2");
    expect(await getPdfPageCount(await object.arrayBuffer())).toBe(2);
  });

  it("enforces documents:write scope", async () => {
    await seedFixture();
    const app = createApp(readMcp);
    const res = await app.fetch(
      agentPost("organize", { id: DOC_ID, pages: [1, 2, 3] }),
      env
    );
    expect(res.status).toBe(403);
    expect(errorSchema.parse(await res.json()).error).toBe(
      "insufficient_scope"
    );
  });

  it("redacts a draft via the agent surface", async () => {
    await seedFixture();
    const app = createApp(writeMcp);
    const res = await app.fetch(
      agentPost("redact", {
        id: DOC_ID,
        regions: [{ page: 1, x: 0, y: 0, width: 50, height: 50 }],
      }),
      env
    );
    expect(res.status).toBe(200);
    const json = z
      .object({
        success: z.boolean(),
        storage_id: z.string(),
        regions_applied: z.number(),
        ops_scrubbed: z.number(),
        fields_removed: z.number(),
        scrubbed_text: z.string(),
      })
      .parse(await res.json());
    expect(json.success).toBe(true);
    expect(json.regions_applied).toBe(1);
  });

  it("protects a draft via the agent surface", async () => {
    await seedFixture();
    const app = createApp(writeMcp);
    const res = await app.fetch(
      agentPost("protect", { id: DOC_ID, user_password: "s3cret" }),
      env
    );
    expect(res.status).toBe(200);
    const json = z
      .object({
        success: z.boolean(),
        storage_id: z.string(),
        download_url: z.string().nullable(),
      })
      .parse(await res.json());
    expect(json.success).toBe(true);
  });

  it("unlock rejects an unencrypted doc via the agent surface", async () => {
    await seedFixture();
    const app = createApp(writeMcp);
    const res = await app.fetch(
      agentPost("unlock", { id: DOC_ID, password: "x" }),
      env
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "not_encrypted" });
  });

  it("compresses a draft via the agent surface", async () => {
    await seedFixture();
    const app = createApp(writeMcp);
    const res = await app.fetch(agentPost("compress", { id: DOC_ID }), env);
    expect(res.status).toBe(200);
    const json = z
      .object({
        success: z.boolean(),
        storage_id: z.string(),
        size_before: z.number(),
        size_after: z.number(),
      })
      .parse(await res.json());
    expect(json.success).toBe(true);
    expect(json.size_before).toBeGreaterThan(0);
  });

  it("crops a draft via the agent surface", async () => {
    await seedFixture();
    const app = createApp(writeMcp);
    const res = await app.fetch(
      agentPost("crop", {
        id: DOC_ID,
        crops: [{ page: 1, x: 0, y: 0, width: 50, height: 50 }],
      }),
      env
    );
    expect(res.status).toBe(200);
    const json = organizeResponseSchema.parse(await res.json());
    expect(json.success).toBe(true);
  });
});
