import { env } from "cloudflare:test";
import { exportJWK, generateKeyPair, importJWK, SignJWT, type JWK } from "jose";
import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";

import { createD1 } from "../../global/db.js";
import {
  documents,
  member,
  organization,
  reviewCells,
  reviewMatrices,
  reviewRows,
  user,
} from "../../global/schema.js";
import indexApp from "../../index.js";

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
    await db.insert(documents).values({
      id: crypto.randomUUID(),
      publicId: docPublicId,
      organizationId: orgId,
      ownerId: userId,
      name: "NDA",
      status: "draft",
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
    expect(generateRes.status).toBe(200);
    const generated = matrixSchema.parse(await generateRes.json());
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

    const res = await indexApp.request("http://localhost/api/v1/reviews", {
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
    }, env);
    expect(res.status).toBe(404);
  });
});
