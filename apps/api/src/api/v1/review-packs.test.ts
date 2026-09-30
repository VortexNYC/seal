import { env } from "cloudflare:test";
import { exportJWK, generateKeyPair, importJWK, SignJWT, type JWK } from "jose";
import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";

import { createD1 } from "../../global/db.js";
import {
  documents,
  member,
  organization,
  reviewPacks,
  user,
} from "../../global/schema.js";
import indexApp from "../../index.js";

const packSchema = z.object({
  id: z.string(),
  title: z.string(),
  columns: z.array(
    z.object({ index: z.number(), name: z.string(), prompt: z.string() })
  ),
  builtin: z.boolean(),
});

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

async function configureSigningKey() {
  const { privateKey } = await generateKeyPair("ES256", { extractable: true });
  const privateJwk = await exportJWK(privateKey);
  privateJwk.alg = "ES256";
  privateJwk.kid = "test-key-id";
  env.MCP_SIGNING_KEY = JSON.stringify(privateJwk);
  env.MCP_SIGNING_KEY_ID = "test-key-id";
  return privateJwk;
}

async function seed() {
  const db = createD1(env.D1);
  const userId = crypto.randomUUID();
  const orgId = crypto.randomUUID();
  await db.insert(user).values({
    id: userId,
    name: "Pack User",
    email: "pack@example.com",
    emailVerified: true,
  });
  await db.insert(organization).values({
    id: orgId,
    name: "Pack Org",
    slug: "pack-org",
  });
  await db.insert(member).values({
    id: crypto.randomUUID(),
    organizationId: orgId,
    userId,
    role: "admin",
  });
  const docPublicId = `doc_${crypto.randomUUID().slice(0, 8)}`;
  await db.insert(documents).values({
    id: crypto.randomUUID(),
    publicId: docPublicId,
    organizationId: orgId,
    ownerId: userId,
    name: "NDA draft",
    status: "draft",
    parsedText: "Confidentiality survives five years post-termination.",
  });
  const token = await signAccessToken(await configureSigningKey(), {
    sub: userId,
    organizationId: orgId,
    scope: "documents:read documents:write",
    clientId: "test-client",
    jti: crypto.randomUUID(),
  });
  return { userId, orgId, db, docPublicId, token };
}

describe("review packs API", () => {
  beforeEach(async () => {
    env.MCP_SIGNING_KEY = undefined;
    env.MCP_SIGNING_KEY_ID = undefined;
    const db = createD1(env.D1);
    await db.delete(reviewPacks);
    await db.delete(documents);
    await db.delete(member);
    await db.delete(organization);
    await db.delete(user);
  });

  it("lists builtin packs for every org", async () => {
    const { token } = await seed();
    const res = await indexApp.request(
      "/api/v1/review-packs",
      {
        headers: { authorization: `Bearer ${token}` },
      },
      env
    );
    expect(res.status).toBe(200);
    const body = z
      .object({ packs: z.array(packSchema) })
      .parse(await res.json());
    const ids = body.packs.map((p) => p.id);
    expect(ids).toContain("builtin/nda");
    expect(ids).toContain("builtin/msa");
    expect(ids).toContain("builtin/employment");
    expect(body.packs.every((p) => p.builtin)).toBe(true);
  });

  it("creates + gets + deletes an org pack", async () => {
    const { token } = await seed();
    const createRes = await indexApp.request(
      "/api/v1/review-packs",
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          title: "Lease review",
          columns: [
            { index: 0, name: "Rent", prompt: "Base rent + escalations?" },
          ],
        }),
      },
      env
    );
    expect(createRes.status).toBe(201);
    const pack = packSchema.parse(await createRes.json());
    expect(pack.id).toMatch(/^pack_/);

    const getRes = await indexApp.request(
      `/api/v1/review-packs/${pack.id}`,
      {
        headers: { authorization: `Bearer ${token}` },
      },
      env
    );
    expect(getRes.status).toBe(200);

    const delRes = await indexApp.request(
      `/api/v1/review-packs/${pack.id}`,
      {
        method: "DELETE",
        headers: { authorization: `Bearer ${token}` },
      },
      env
    );
    expect(delRes.status).toBe(200);

    // Builtins can't be deleted.
    const builtinDel = await indexApp.request(
      "/api/v1/review-packs/builtin%2Fnda",
      {
        method: "DELETE",
        headers: { authorization: `Bearer ${token}` },
      },
      env
    );
    expect(builtinDel.status).toBe(400);
  });

  it("POST /reviews expands a pack into columns", async () => {
    const { docPublicId, token } = await seed();
    const res = await indexApp.request(
      "/api/v1/reviews",
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          title: "NDA matrix",
          pack_id: "builtin/nda",
          documentIds: [docPublicId],
        }),
      },
      env
    );
    expect(res.status).toBe(201);
    const matrix = z
      .object({
        id: z.string(),
        model: z.string(),
        columns: z.array(z.object({ name: z.string() })),
      })
      .parse(await res.json());
    expect(matrix.model).toContain("anthropic/");
    expect(matrix.columns.map((c) => c.name)).toContain("Term & survival");
  });

  it("pack expansion respects explicit overrides", async () => {
    const { docPublicId, token } = await seed();
    const res = await indexApp.request(
      "/api/v1/reviews",
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          title: "Override matrix",
          pack_id: "builtin/nda",
          model: "echo/test",
          columns: [{ index: 0, name: "Custom", prompt: "Custom prompt" }],
          documentIds: [docPublicId],
        }),
      },
      env
    );
    expect(res.status).toBe(201);
    const matrix = z
      .object({
        model: z.string(),
        columns: z.array(z.object({ name: z.string() })),
      })
      .parse(await res.json());
    expect(matrix.model).toBe("echo/test");
    expect(matrix.columns).toHaveLength(1);
    expect(matrix.columns[0]?.name).toBe("Custom");
  });

  it("unknown pack_id → 404", async () => {
    const { docPublicId, token } = await seed();
    const res = await indexApp.request(
      "/api/v1/reviews",
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          title: "X",
          pack_id: "pack_doesnotexist",
          documentIds: [docPublicId],
        }),
      },
      env
    );
    expect(res.status).toBe(404);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("pack_not_found");
  });
});
