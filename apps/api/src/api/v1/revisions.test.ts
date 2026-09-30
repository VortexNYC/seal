import { env } from "cloudflare:test";
import { eq } from "drizzle-orm";
import { exportJWK, generateKeyPair, importJWK, SignJWT, type JWK } from "jose";
import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";

import { createD1 } from "../../global/db.js";
import {
  documents,
  member,
  organization,
  revisionSuggestions,
  user,
} from "../../global/schema.js";
import indexApp from "../../index.js";

const revisionSchema = z.object({
  id: z.string(),
  document_id: z.string(),
  kind: z.enum(["insert", "delete", "replace"]),
  status: z.string(),
  anchor_quote: z.string(),
  anchor_page: z.number().nullable(),
  anchor_bbox: z
    .object({
      x: z.number(),
      y: z.number(),
      width: z.number(),
      height: z.number(),
    })
    .nullable(),
  proposed_text: z.string().nullable(),
  derived_document_id: z.string().nullable(),
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
    name: "Rev User",
    email: "rev@example.com",
    emailVerified: true,
  });
  await db.insert(organization).values({
    id: orgId,
    name: "Rev Org",
    slug: "rev-org",
  });
  await db.insert(member).values({
    id: crypto.randomUUID(),
    organizationId: orgId,
    userId,
    role: "admin",
  });

  const storageKey = `uploads/${crypto.randomUUID()}`;
  await env.DOCUMENTS_BUCKET.put(storageKey, "%PDF-1.4 fake");
  const docPublicId = `doc_${crypto.randomUUID().slice(0, 8)}`;
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

  const token = await signAccessToken(await configureSigningKey(), {
    sub: userId,
    organizationId: orgId,
    scope: "documents:read documents:write",
    clientId: "test-client",
    jti: crypto.randomUUID(),
  });
  return { userId, orgId, db, docPublicId, token };
}

function authedPost(path: string, token: string, body: unknown = {}) {
  return new Request(`http://localhost/api/v1${path}`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

describe("revisions API", () => {
  beforeEach(async () => {
    env.MCP_SIGNING_KEY = undefined;
    env.MCP_SIGNING_KEY_ID = undefined;
    const db = createD1(env.D1);
    await db.delete(revisionSuggestions);
    await db.delete(documents);
    await db.delete(member);
    await db.delete(organization);
    await db.delete(user);
  });

  it("proposes an anchored revision (quote → page/bbox)", async () => {
    const { docPublicId, token } = await seed();
    const res = await indexApp.request(
      "/api/v1/revisions",
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          document_id: docPublicId,
          kind: "replace",
          anchor_quote: "thirty days written notice",
          proposed_text: "sixty days written notice",
          rationale: "Standard notice period",
        }),
      },
      env
    );
    expect(res.status).toBe(201);
    const rev = revisionSchema.parse(await res.json());
    expect(rev.status).toBe("pending");
    expect(rev.anchor_page).toBe(1);
    expect(rev.anchor_bbox).not.toBeNull();
  });

  it("rejects a quote absent from the document", async () => {
    const { docPublicId, token } = await seed();
    const res = await indexApp.request(
      "/api/v1/revisions",
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          document_id: docPublicId,
          kind: "delete",
          anchor_quote: "this clause does not exist",
        }),
      },
      env
    );
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toBe("anchor_not_found");
  });

  it("accept applies the edit into a derived document", async () => {
    const { docPublicId, token, db, orgId } = await seed();
    const createRes = await indexApp.request(
      "/api/v1/revisions",
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          document_id: docPublicId,
          kind: "replace",
          anchor_quote: "thirty days written notice",
          proposed_text: "sixty days written notice",
        }),
      },
      env
    );
    const created = revisionSchema.parse(await createRes.json());

    const acceptRes = await indexApp.request(
      `/api/v1/revisions/${created.id}/accept`,
      { method: "POST", headers: { authorization: `Bearer ${token}` } },
      env
    );
    expect(acceptRes.status).toBe(200);
    const accepted = revisionSchema.parse(await acceptRes.json());
    expect(accepted.status).toBe("accepted");
    expect(accepted.derived_document_id).not.toBeNull();

    // Derived doc exists as a draft, linked to the source, re-parsed.
    const derived = await db
      .select()
      .from(documents)
      .where(eq(documents.publicId, accepted.derived_document_id!));
    expect(derived[0]?.status).toBe("draft");
    expect(derived[0]?.parentDocumentId).not.toBeNull();
    expect(derived[0]?.storageKey).toBeTruthy();
    const derivedObj = await env.DOCUMENTS_BUCKET.get(derived[0]!.storageKey!);
    expect(derivedObj).not.toBeNull();

    // Second accept → 409.
    const again = await indexApp.request(
      `/api/v1/revisions/${created.id}/accept`,
      { method: "POST", headers: { authorization: `Bearer ${token}` } },
      env
    );
    expect(again.status).toBe(409);
  });

  it("reject closes the suggestion without a derived doc", async () => {
    const { docPublicId, token } = await seed();
    const createRes = await indexApp.request(
      "/api/v1/revisions",
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          document_id: docPublicId,
          kind: "insert",
          anchor_quote: "written notice.",
          proposed_text: "This Agreement is governed by New York law.",
        }),
      },
      env
    );
    const created = revisionSchema.parse(await createRes.json());

    const res = await indexApp.request(
      `/api/v1/revisions/${created.id}/reject`,
      { method: "POST", headers: { authorization: `Bearer ${token}` } },
      env
    );
    expect(res.status).toBe(200);
    const rejected = revisionSchema.parse(await res.json());
    expect(rejected.status).toBe("rejected");
    expect(rejected.derived_document_id).toBeNull();
  });

  it("lists revisions by document", async () => {
    const { docPublicId, token } = await seed();
    await indexApp.request(
      "/api/v1/revisions",
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          document_id: docPublicId,
          kind: "delete",
          anchor_quote: "thirty days",
        }),
      },
      env
    );
    const res = await indexApp.request(
      `/api/v1/revisions?document_id=${docPublicId}`,
      { headers: { authorization: `Bearer ${token}` } },
      env
    );
    expect(res.status).toBe(200);
    const body = z
      .object({ revisions: z.array(revisionSchema) })
      .parse(await res.json());
    expect(body.revisions).toHaveLength(1);
    expect(body.revisions[0]?.document_id).toBe(docPublicId);
  });
});
