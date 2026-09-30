import { env } from "cloudflare:test";
import { exportJWK, generateKeyPair, importJWK, SignJWT, type JWK } from "jose";
import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";

import { createD1 } from "../../global/db.js";
import {
  documents,
  jobs as jobsTable,
  member,
  organization,
  reviewCells,
  reviewMatrices,
  reviewRows,
  user,
} from "../../global/schema.js";
import indexApp from "../../index.js";
import { registerProvider } from "../../platform/llm/index.js";
import type { ModelProvider } from "../../platform/llm/index.js";

const jobSchema = z.object({
  job_id: z.string(),
  status: z.string(),
});

const apiJobSchema = z.object({
  id: z.string(),
  type: z.string(),
  status: z.string(),
  error: z.string().nullable(),
  result: z.unknown().nullable(),
  created_at: z.string(),
  started_at: z.string().nullable(),
  finished_at: z.string().nullable(),
});

/**
 * Run the org's queued jobs synchronously — in prod the JobRunner DO's
 * alarm does this; miniflare can't fire DO-storage alarms, so tests drive
 * the same drain function the alarm calls.
 */
async function drainJobs(organizationId: string) {
  const { drainJobs: drain } = await import("../../platform/jobs.js");
  await drain(env, organizationId);
}

const stubProvider: ModelProvider = {
  id: "stub-json",
  async *stream(req) {
    const userMessage = req.messages.find((m) => m.role === "user");
    const docText = userMessage?.content.includes("thirty days")
      ? "Either party may terminate this Agreement on thirty days written notice."
      : "not_found";
    yield {
      type: "text",
      text: JSON.stringify({
        summary: docText === "not_found" ? "not found" : "Termination clause",
        flag: docText === "not_found" ? "grey" : "amber",
        reasoning: "Parsed per contract terms.",
        quote: docText,
      }),
    };
    yield {
      type: "finish",
      finishReason: { unified: "stop", raw: "end_turn" },
      usage: { inputTokens: 120, outputTokens: 40 },
    };
  },
};

registerProvider(stubProvider);

async function configureSigningKey() {
  const { privateKey } = await generateKeyPair("ES256", { extractable: true });
  const privateJwk = await exportJWK(privateKey);
  privateJwk.alg = "ES256";
  privateJwk.kid = "test-key-id";
  env.MCP_SIGNING_KEY = JSON.stringify(privateJwk);
  env.MCP_SIGNING_KEY_ID = "test-key-id";
  return privateJwk;
}

async function signAccessToken(
  privateJwk: JWK,
  payload: {
    sub: string;
    organizationId?: string;
    scope: string;
    clientId: string;
    jti: string;
  }
): Promise<string> {
  const key = await importJWK(privateJwk, "ES256");
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({
    sub: payload.sub,
    ...(payload.organizationId
      ? { organizationId: payload.organizationId }
      : {}),
    scope: payload.scope,
    clientId: payload.clientId,
    jti: payload.jti,
  })
    .setProtectedHeader({ alg: "ES256", kid: "test-key-id", typ: "JWT" })
    .setIssuedAt(now)
    .setExpirationTime(now + 900)
    .setIssuer(`${env.BETTER_AUTH_URL}/oauth/seal-mcp`)
    .setAudience(env.BETTER_AUTH_URL)
    .sign(key);
}

async function seedOrgAndUser() {
  const db = createD1(env.D1);
  const userId = crypto.randomUUID();
  const orgId = crypto.randomUUID();

  await db.insert(user).values({
    id: userId,
    name: "Review User",
    email: "review@example.com",
    emailVerified: true,
  });

  await db.insert(organization).values({
    id: orgId,
    name: "Review Org",
    slug: "review-org",
  });

  await db.insert(member).values({
    id: crypto.randomUUID(),
    organizationId: orgId,
    userId,
    role: "admin",
  });

  return { userId, orgId, db };
}

const matrixSchema = z.object({
  id: z.string(),
  title: z.string(),
  model: z.string(),
  status: z.string(),
  columns: z.array(
    z.object({
      index: z.number(),
      name: z.string(),
      prompt: z.string(),
    })
  ),
  rows: z.array(
    z.object({
      id: z.string(),
      document_id: z.string(),
      cells: z.array(
        z.object({
          id: z.string(),
          row_id: z.string(),
          column_index: z.number(),
          status: z.string(),
          summary: z.string().nullable(),
          flag: z.string().nullable(),
          reasoning: z.string().nullable(),
          citations: z.array(
            z.object({
              documentId: z.string(),
              quote: z.string(),
              page: z.number().optional(),
              bbox: z
                .object({
                  x: z.number(),
                  y: z.number(),
                  width: z.number(),
                  height: z.number(),
                })
                .optional(),
            })
          ),
        })
      ),
    })
  ),
  created_at: z.string(),
  updated_at: z.string(),
});

describe("POST/GET /api/v1/reviews", () => {
  beforeEach(async () => {
    env.MCP_SIGNING_KEY = undefined;
    env.MCP_SIGNING_KEY_ID = undefined;

    const db = createD1(env.D1);
    await db.delete(reviewCells);
    await db.delete(reviewRows);
    await db.delete(reviewMatrices);
    await db.delete(documents);
    await db.delete(member);
    await db.delete(organization);
    await db.delete(user);
  });

  it("creates, generates, and returns citation-grounded cells", async () => {
    const privateJwk = await configureSigningKey();
    const { userId, orgId, db } = await seedOrgAndUser();

    const docPublicId = `doc_${crypto.randomUUID().slice(0, 8)}`;
    const storageKey = `uploads/${crypto.randomUUID()}`;
    await env.DOCUMENTS_BUCKET.put(storageKey, "%PDF-1.4 fake");
    await db.insert(documents).values({
      id: crypto.randomUUID(),
      publicId: docPublicId,
      organizationId: orgId,
      ownerId: userId,
      name: "NDA",
      status: "draft",
      storageKey,
      parsedText:
        "Either party may terminate this Agreement on thirty days written notice.",
    });

    const token = await signAccessToken(privateJwk, {
      sub: userId,
      organizationId: orgId,
      scope: "documents:read documents:write",
      clientId: "test-client",
      jti: crypto.randomUUID(),
    });

    const createRes = await indexApp.request(
      "http://localhost/api/v1/reviews",
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          title: "NDA red-flag pass",
          model: "echo/test",
          columns: [
            {
              index: 0,
              name: "Termination",
              prompt: "Find the termination clause.",
            },
          ],
          documentIds: [docPublicId],
        }),
      },
      env
    );
    expect(createRes.status).toBe(201);
    const created = matrixSchema.parse(await createRes.json());
    expect(created.rows).toHaveLength(1);
    expect(created.rows[0]?.cells[0]?.status).toBe("pending");

    const generateRes = await indexApp.request(
      `http://localhost/api/v1/reviews/${created.id}/generate`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: "{}",
      },
      env
    );
    expect(generateRes.status).toBe(202);
    const job = jobSchema.parse(await generateRes.json());
    expect(job.status).toBe("queued");

    await drainJobs(orgId);

    const jobRes = await indexApp.request(
      `http://localhost/api/v1/jobs/${job.job_id}`,
      { headers: { authorization: `Bearer ${token}` } },
      env
    );
    expect(jobRes.status).toBe(200);
    expect(apiJobSchema.parse(await jobRes.json()).status).toBe("done");

    const getRes0 = await indexApp.request(
      `http://localhost/api/v1/reviews/${created.id}`,
      {
        headers: { authorization: `Bearer ${token}` },
      },
      env
    );
    const generated = matrixSchema.parse(await getRes0.json());
    expect(generated.status).toBe("ready");
    const cell = generated.rows[0]?.cells[0];
    expect(cell?.status).toBe("done");
    expect(cell?.citations.length).toBeGreaterThanOrEqual(1);
    expect(cell?.citations[0]?.quote).not.toBe("");
    expect(
      cell?.citations[0]?.quote === "not_found" ||
        "Either party may terminate this Agreement on thirty days written notice.".includes(
          cell?.citations[0]?.quote ?? "___"
        )
    ).toBe(true);
    // Anchored citation carries page + normalized bbox when the quote lands.
    if (cell?.citations[0]?.quote !== "not_found") {
      expect(cell?.citations[0]?.page).toBe(1);
      expect(cell?.citations[0]?.bbox).toBeDefined();
    }

    const getRes = await indexApp.request(
      `http://localhost/api/v1/reviews/${created.id}`,
      {
        headers: { authorization: `Bearer ${token}` },
      },
      env
    );
    expect(getRes.status).toBe(200);
    const fetched = matrixSchema.parse(await getRes.json());
    expect(fetched.id).toBe(created.id);
    expect(fetched.rows[0]?.cells[0]?.status).toBe("done");
  });

  it("rejects unknown documents", async () => {
    const privateJwk = await configureSigningKey();
    const { userId, orgId } = await seedOrgAndUser();
    const token = await signAccessToken(privateJwk, {
      sub: userId,
      organizationId: orgId,
      scope: "documents:write",
      clientId: "test-client",
      jti: crypto.randomUUID(),
    });

    const res = await indexApp.request(
      "http://localhost/api/v1/reviews",
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          title: "Missing",
          model: "echo/test",
          columns: [{ index: 0, name: "X", prompt: "Y" }],
          documentIds: ["doc_missing"],
        }),
      },
      env
    );
    expect(res.status).toBe(404);
  });

  it("generates structured cells with audit columns via a real provider", async () => {
    const privateJwk = await configureSigningKey();
    const { userId, orgId, db } = await seedOrgAndUser();

    const docText =
      "Either party may terminate this Agreement on thirty days written notice.";
    const docPublicId = `doc_${crypto.randomUUID().slice(0, 8)}`;
    await db.insert(documents).values({
      id: crypto.randomUUID(),
      publicId: docPublicId,
      organizationId: orgId,
      ownerId: userId,
      name: "NDA",
      status: "draft",
      parsedText: docText,
    });

    const token = await signAccessToken(privateJwk, {
      sub: userId,
      organizationId: orgId,
      scope: "documents:read documents:write",
      clientId: "test-client",
      jti: crypto.randomUUID(),
    });

    const createRes = await indexApp.request(
      "http://localhost/api/v1/reviews",
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          title: "Structured",
          model: "stub-json/claude-stub",
          columns: [
            { index: 0, name: "Termination", prompt: "Find the clause." },
          ],
          documentIds: [docPublicId],
        }),
      },
      env
    );
    const created = matrixSchema.parse(await createRes.json());

    const generateRes = await indexApp.request(
      `http://localhost/api/v1/reviews/${created.id}/generate`,
      {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
      },
      env
    );
    expect(generateRes.status).toBe(202);
    await drainJobs(orgId);
    const genRes = await indexApp.request(
      `http://localhost/api/v1/reviews/${created.id}`,
      { headers: { authorization: `Bearer ${token}` } },
      env
    );
    const generated = matrixSchema.parse(await genRes.json());
    const cell = generated.rows[0]?.cells[0];

    expect(cell?.status).toBe("done");
    expect(cell?.flag).toBe("amber");
    expect(cell?.summary).toBe("Termination clause");
    expect(cell?.reasoning).toBe("Parsed per contract terms.");
    expect(cell?.citations[0]?.quote).toBe(docText);
    expect(docText.includes(cell?.citations[0]?.quote ?? "___")).toBe(true);

    // Audit columns persisted on the cell row.
    const stored = await db.select().from(reviewCells);
    expect(stored).toHaveLength(1);
    expect(stored[0]?.modelUsed).toBe("stub-json/claude-stub");
    expect(stored[0]?.tokensUsed).toBe(160);
    expect(stored[0]?.processingTimeMs).toBeGreaterThanOrEqual(0);
  });

  it("marks ungroundable cells as not_found per the citation contract", async () => {
    const privateJwk = await configureSigningKey();
    const { userId, orgId, db } = await seedOrgAndUser();

    const docPublicId = `doc_${crypto.randomUUID().slice(0, 8)}`;
    await db.insert(documents).values({
      id: crypto.randomUUID(),
      publicId: docPublicId,
      organizationId: orgId,
      ownerId: userId,
      name: "Blank",
      status: "draft",
      parsedText: "This document has no relevant clause at all.",
    });

    const token = await signAccessToken(privateJwk, {
      sub: userId,
      organizationId: orgId,
      scope: "documents:read documents:write",
      clientId: "test-client",
      jti: crypto.randomUUID(),
    });

    const createRes = await indexApp.request(
      "http://localhost/api/v1/reviews",
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          title: "No match",
          model: "stub-json/claude-stub",
          columns: [
            { index: 0, name: "Arbitration", prompt: "Find arbitration." },
          ],
          documentIds: [docPublicId],
        }),
      },
      env
    );
    const created = matrixSchema.parse(await createRes.json());
    const generateRes = await indexApp.request(
      `http://localhost/api/v1/reviews/${created.id}/generate`,
      {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
      },
      env
    );
    expect(generateRes.status).toBe(202);
    await drainJobs(orgId);
    const genRes = await indexApp.request(
      `http://localhost/api/v1/reviews/${created.id}`,
      { headers: { authorization: `Bearer ${token}` } },
      env
    );
    const generated = matrixSchema.parse(await genRes.json());
    const cell = generated.rows[0]?.cells[0];
    expect(cell?.status).toBe("done");
    expect(cell?.citations[0]?.quote).toBe("not_found");
    expect(cell?.summary).toBe("not found");
  });
});

describe("GET /api/v1/jobs/:id/stream", () => {
  beforeEach(async () => {
    env.MCP_SIGNING_KEY = undefined;
    env.MCP_SIGNING_KEY_ID = undefined;
    const db = createD1(env.D1);
    await db.delete(reviewCells);
    await db.delete(reviewRows);
    await db.delete(reviewMatrices);
    await db.delete(jobsTable);
    await db.delete(documents);
    await db.delete(member);
    await db.delete(organization);
    await db.delete(user);
  });

  it("streams job state and closes on done", async () => {
    const privateJwk = await configureSigningKey();
    const { userId, orgId, db } = await seedOrgAndUser();
    const token = await signAccessToken(privateJwk, {
      sub: userId,
      organizationId: orgId,
      scope: "documents:read documents:write",
      clientId: "test-client",
      jti: crypto.randomUUID(),
    });

    // Minimal pending cell so the job has something to drain.
    const docPublicId = `doc_${crypto.randomUUID().slice(0, 8)}`;
    const storageKey = `uploads/${crypto.randomUUID()}`;
    await env.DOCUMENTS_BUCKET.put(storageKey, "%PDF-1.4 fake");
    await db.insert(documents).values({
      id: crypto.randomUUID(),
      publicId: docPublicId,
      organizationId: orgId,
      ownerId: userId,
      name: "Contract",
      status: "draft",
      storageKey,
      parsedText:
        "Either party may terminate this Agreement on thirty days written notice.",
    });
    const createRes = await indexApp.request(
      "http://localhost/api/v1/reviews",
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          title: "Stream matrix",
          model: "echo/test",
          columns: [{ index: 0, name: "Term", prompt: "Termination?" }],
          documentIds: [docPublicId],
        }),
      },
      env
    );
    const matrix = matrixSchema.parse(await createRes.json());
    const genRes = await indexApp.request(
      `http://localhost/api/v1/reviews/${matrix.id}/generate`,
      {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
      },
      env
    );
    const { job_id } = (await genRes.json()) as { job_id: string };
    await drainJobs(orgId);

    const streamRes = await indexApp.request(
      `http://localhost/api/v1/jobs/${job_id}/stream`,
      { headers: { authorization: `Bearer ${token}` } },
      env
    );
    expect(streamRes.status).toBe(200);
    expect(streamRes.headers.get("content-type")).toBe("text/event-stream");
    const body = await streamRes.text();
    expect(body).toContain("event: state");
    expect(body).toContain('"status":"done"');

    // access_token query param works for EventSource-style clients.
    const viaQuery = await indexApp.request(
      `http://localhost/api/v1/jobs/${job_id}/stream?access_token=${token}`,
      {},
      env
    );
    expect(viaQuery.status).toBe(200);
    viaQuery.body?.cancel();
  });
});
