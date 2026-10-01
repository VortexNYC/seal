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
          columns: [{ index: 0, name: "X", prompt: "Y" }],
          documentIds: ["doc_missing"],
        }),
      },
      env
    );
    expect(res.status).toBe(404);
  });

  it("GET /reviews lists matrices", async () => {
    const privateJwk = await configureSigningKey();
    const { userId, orgId, db } = await seedOrgAndUser();
    const token = await signAccessToken(privateJwk, {
      sub: userId,
      organizationId: orgId,
      scope: "documents:read documents:write",
      clientId: "test-client",
      jti: crypto.randomUUID(),
    });
    const docPublicId = `doc_${crypto.randomUUID().slice(0, 8)}`;
    await db.insert(documents).values({
      id: crypto.randomUUID(),
      publicId: docPublicId,
      organizationId: orgId,
      ownerId: userId,
      name: "NDA",
      status: "draft",
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
          title: "Listed matrix",
          columns: [{ index: 0, name: "Q", prompt: "P" }],
          documentIds: [docPublicId],
        }),
      },
      env
    );
    expect(createRes.status).toBe(201);

    const res = await indexApp.request(
      "http://localhost/api/v1/reviews",
      { headers: { authorization: `Bearer ${token}` } },
      env
    );
    expect(res.status).toBe(200);
    const body = z
      .object({
        matrices: z.array(
          z.object({
            id: z.string(),
            title: z.string(),
            row_count: z.number(),
            column_count: z.number(),
          })
        ),
      })
      .parse(await res.json());
    expect(body.matrices.some((m) => m.title === "Listed matrix")).toBe(true);
    expect(body.matrices[0]?.row_count).toBe(1);
    expect(body.matrices[0]?.column_count).toBe(1);
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

    const job_id = `job_${crypto.randomUUID().slice(0, 16)}`;
    const now = new Date();
    await db.insert(jobsTable).values({
      id: crypto.randomUUID(),
      publicId: job_id,
      organizationId: orgId,
      type: "test-job",
      status: "done",
      payload: "{}",
      result: "{}",
      createdAt: now,
      finishedAt: now,
      updatedAt: now,
    });

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

  it("accepts agent-authored cell writes and grounds quotes", async () => {
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
          title: "Agent pass",
          columns: [
            { index: 0, name: "Termination", prompt: "Find the clause." },
          ],
          documentIds: [docPublicId],
        }),
      },
      env
    );
    expect(createRes.status).toBe(201);
    const created = matrixSchema.parse(await createRes.json());
    const cell = created.rows[0]?.cells[0];
    expect(cell?.status).toBe("pending");

    // Grounded quote — agent reasoned externally, Seal verifies the anchor.
    const writeRes = await indexApp.request(
      `http://localhost/api/v1/reviews/${created.id}/cells`,
      {
        method: "PATCH",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model_used: "agent/claude-opus-4-6",
          cells: [
            {
              row_id: created.rows[0]?.id,
              column_index: 0,
              summary: "Termination on thirty days written notice.",
              flag: "green",
              reasoning: "Plain-language clause present.",
              quote: "Either party may terminate this Agreement",
            },
          ],
        }),
      },
      env
    );
    expect(writeRes.status).toBe(200);
    const writeResult = (await writeRes.json()) as {
      updated: number;
      matrixStatus: string;
    };
    expect(writeResult.updated).toBe(1);
    expect(writeResult.matrixStatus).toBe("ready");

    const getRes = await indexApp.request(
      `http://localhost/api/v1/reviews/${created.id}`,
      {
        headers: { authorization: `Bearer ${token}` },
      },
      env
    );
    const done = matrixSchema.parse(await getRes.json());
    expect(done.status).toBe("ready");
    const doneCell = done.rows[0]?.cells[0];
    expect(doneCell?.status).toBe("done");
    expect(doneCell?.summary).toBe(
      "Termination on thirty days written notice."
    );
    expect(doneCell?.citations[0]?.quote).toBe(
      "Either party may terminate this Agreement"
    );
  });

  it("rejects an ungrounded agent quote to not_found", async () => {
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
      parsedText: "This agreement is governed by New York law.",
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
          title: "Agent pass",
          columns: [{ index: 0, name: "Governing law", prompt: "Find it." }],
          documentIds: [docPublicId],
        }),
      },
      env
    );
    const created = matrixSchema.parse(await createRes.json());

    const writeRes = await indexApp.request(
      `http://localhost/api/v1/reviews/${created.id}/cells`,
      {
        method: "PATCH",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          cells: [
            {
              row_id: created.rows[0]?.id,
              column_index: 0,
              summary: "Governed by Delaware law.",
              flag: "green",
              quote: "governed by Delaware law",
            },
          ],
        }),
      },
      env
    );
    expect(writeRes.status).toBe(200);

    const getRes = await indexApp.request(
      `http://localhost/api/v1/reviews/${created.id}`,
      {
        headers: { authorization: `Bearer ${token}` },
      },
      env
    );
    const done = matrixSchema.parse(await getRes.json());
    const cell = done.rows[0]?.cells[0];
    expect(cell?.citations[0]?.quote).toBe("not_found");
    expect(cell?.summary).toBe("not found");
  });
});
