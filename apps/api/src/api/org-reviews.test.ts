import { OpenAPIHono } from "@hono/zod-openapi";
import { env, runDurableObjectAlarm } from "cloudflare:test";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";

import { createD1 } from "../global/db.js";
import {
  documents,
  member,
  organization,
  reviewCells,
  reviewMatrices,
  reviewRows,
  revisionSuggestions,
  user,
} from "../global/schema.js";
import type { Variables } from "../platform/types.js";
import orgReviews from "./org-reviews.js";

const ORG = "org_1";
const SLUG = "test-org";
const USER = "user_1";

function createApp() {
  const app = new OpenAPIHono<{
    Bindings: CloudflareBindings;
    Variables: Variables;
  }>();
  app.use("/api/reviews/*", async (c, next) => {
    c.set("user", {
      user: { id: USER, name: "Test User", email: "t@example.com" },
      session: { activeOrganizationId: ORG },
    });
    await next();
  });
  app.route("/api/reviews", orgReviews);
  return app;
}

async function seedDoc(db: ReturnType<typeof createD1>) {
  const publicId = `doc_${crypto.randomUUID().slice(0, 8)}`;
  await db.insert(documents).values({
    id: crypto.randomUUID(),
    publicId,
    organizationId: ORG,
    ownerId: USER,
    name: "NDA draft",
    status: "draft",
    storageKey: "test/doc.pdf",
    parsedText:
      "Either party may terminate this agreement with thirty days written notice.",
  });
  await env.DOCUMENTS_BUCKET.put("test/doc.pdf", new Uint8Array([1, 2, 3]));
  return publicId;
}

describe("org reviews API (session)", () => {
  beforeEach(async () => {
    const db = createD1(env.D1);
    await db.delete(reviewCells);
    await db.delete(reviewRows);
    await db.delete(reviewMatrices);
    await db.delete(revisionSuggestions);
    await db.delete(documents);
    await db.delete(member);
    await db.delete(organization);
    await db.delete(user);
    await db.insert(organization).values({
      id: ORG,
      name: "Test Org",
      slug: SLUG,
    });
    await db.insert(user).values({
      id: USER,
      name: "Test User",
      email: "t@example.com",
      emailVerified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    await db.insert(member).values({
      id: crypto.randomUUID(),
      organizationId: ORG,
      userId: USER,
      role: "owner",
      createdAt: new Date(),
    });
  });

  it("lists matrices + creates one with a pack expansion", async () => {
    const app = createApp();
    const db = createD1(env.D1);
    const docId = await seedDoc(db);

    const list = await app.request("/api/reviews/test-org", {}, env);
    expect(list.status).toBe(200);
    expect(
      z.object({ matrices: z.array(z.unknown()) }).parse(await list.json())
        .matrices
    ).toHaveLength(0);

    const create = await app.request(
      "/api/reviews/test-org",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: "NDA batch",
          pack_id: "builtin/nda",
          documentIds: [docId],
        }),
      },
      env
    );
    expect(create.status).toBe(201);
    const matrix = z
      .object({
        id: z.string(),
        columns: z.array(z.object({ name: z.string() })),
      })
      .parse(await create.json());
    expect(matrix.columns.length).toBeGreaterThan(2); // nda pack expands

    const detail = await app.request(
      `/api/reviews/test-org/${matrix.id}`,
      {},
      env
    );
    expect(detail.status).toBe(200);
    const detailBody = z
      .object({
        rows: z.array(
          z.object({ document_id: z.string(), cells: z.array(z.unknown()) })
        ),
      })
      .parse(await detail.json());
    expect(detailBody.rows[0]?.document_id).toBe(docId);
    expect(detailBody.rows[0]?.cells.length).toBe(matrix.columns.length);
  });

  it("PATCH cells writes agent-authored results and flips ready", async () => {
    const app = createApp();
    const db = createD1(env.D1);
    const docId = await seedDoc(db);

    const create = await app.request(
      "/api/reviews/test-org",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: "m",
          model: "agent",
          columns: [{ index: 0, name: "Q", prompt: "P" }],
          documentIds: [docId],
        }),
      },
      env
    );
    const created = z
      .object({
        id: z.string(),
        rows: z.array(
          z.object({
            id: z.string(),
            cells: z.array(z.object({ id: z.string() })),
          })
        ),
      })
      .parse(await create.json());

    const write = await app.request(
      `/api/reviews/test-org/${created.id}/cells`,
      {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model_used: "agent/test",
          cells: [
            {
              row_id: created.rows[0]?.id,
              column_index: 0,
              summary: "Termination on thirty days notice.",
              flag: "green",
              quote: "thirty days written notice",
            },
          ],
        }),
      },
      env
    );
    expect(write.status).toBe(200);
    const result = z
      .object({ updated: z.number(), matrixStatus: z.string() })
      .parse(await write.json());
    expect(result).toEqual({ updated: 1, matrixStatus: "ready" });
  });

  it("stream endpoint emits SSE state", async () => {
    const app = createApp();
    const db = createD1(env.D1);
    const docId = await seedDoc(db);
    const create = await app.request(
      "/api/reviews/test-org",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: "s",
          model: "agent/test",
          columns: [{ index: 0, name: "Q", prompt: "P" }],
          documentIds: [docId],
        }),
      },
      env
    );
    const { id } = z.object({ id: z.string() }).parse(await create.json());

    const res = await app.request(
      `/api/reviews/test-org/${id}/stream`,
      {},
      env
    );
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    const text = await res.text();
    expect(text).toContain("event: state");
  });

  it("lists packs (builtin + custom) and deletes a custom pack", async () => {
    const app = createApp();
    const list = await app.request("/api/reviews/test-org/packs", {}, env);
    expect(list.status).toBe(200);
    const packs = z
      .object({
        packs: z.array(z.object({ id: z.string(), builtin: z.boolean() })),
      })
      .parse(await list.json());
    expect(packs.packs.filter((p) => p.builtin).length).toBeGreaterThanOrEqual(
      3
    );

    const created = await app.request(
      "/api/reviews/test-org/packs",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: "Custom",
          columns: [{ index: 0, name: "X", prompt: "Y" }],
        }),
      },
      env
    );
    expect(created.status).toBe(201);
    const pack = z.object({ id: z.string() }).parse(await created.json());

    const del = await app.request(
      `/api/reviews/test-org/packs/${pack.id}`,
      { method: "DELETE" },
      env
    );
    expect(del.status).toBe(200);
  });

  it("revisions: propose → accept produces derived draft", async () => {
    const app = createApp();
    const db = createD1(env.D1);
    const docId = await seedDoc(db);

    const propose = await app.request(
      "/api/reviews/test-org/revisions",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          document_id: docId,
          kind: "replace",
          anchor_quote: "thirty days written notice",
          proposed_text: "sixty days written notice",
        }),
      },
      env
    );
    expect(propose.status).toBe(201);
    const rev = z
      .object({ id: z.string(), status: z.string() })
      .parse(await propose.json());
    expect(rev.status).toBe("pending");

    const list = await app.request(
      "/api/reviews/test-org/revisions?status=pending",
      {},
      env
    );
    const listed = z
      .object({ revisions: z.array(z.object({ id: z.string() })) })
      .parse(await list.json());
    expect(listed.revisions.some((r) => r.id === rev.id)).toBe(true);

    const accept = await app.request(
      `/api/reviews/test-org/revisions/${rev.id}/accept`,
      { method: "POST" },
      env
    );
    expect(accept.status).toBe(200);
    const accepted = z
      .object({
        status: z.string(),
        derived_document_id: z.string().nullable(),
      })
      .parse(await accept.json());
    expect(accepted.status).toBe("accepted");
    expect(accepted.derived_document_id).toBeTruthy();

    const derived = await db
      .select()
      .from(documents)
      .where(eq(documents.publicId, accepted.derived_document_id!));
    expect(derived[0]?.status).toBe("draft");
    expect(derived[0]?.parentDocumentId).toBeTruthy();
  });
});
