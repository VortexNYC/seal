import { env } from "cloudflare:test";
import { exportJWK, generateKeyPair, importJWK, SignJWT, type JWK } from "jose";
import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";

import { createD1 } from "../../global/db.js";
import { member, organization, user } from "../../global/schema.js";
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
    name: "Test User",
    email: "test@example.com",
    emailVerified: true,
  });

  await db.insert(organization).values({
    id: orgId,
    name: "Test Org",
    slug: "test-org",
  });

  await db.insert(member).values({
    id: crypto.randomUUID(),
    organizationId: orgId,
    userId,
    role: "admin",
  });

  return { userId, orgId, db };
}

function createPdfBytes(): Uint8Array {
  return new TextEncoder().encode("%PDF-1.4 test");
}

function createDocxBytes(): Uint8Array {
  // The conversion worker is mocked, so any non-empty bytes are fine.
  return new TextEncoder().encode("docx content");
}

describe("POST /api/v1/uploads", () => {
  beforeEach(async () => {
    env.MCP_SIGNING_KEY = undefined;
    env.MCP_SIGNING_KEY_ID = undefined;

    const db = createD1(env.D1);
    await db.delete(member);
    await db.delete(organization);
    await db.delete(user);
  });

  it("generates a signed upload URL and accepts an unauthenticated upload", async () => {
    const privateJwk = await configureSigningKey();
    const { userId, orgId } = await seedOrgAndUser();

    const token = await signAccessToken(privateJwk, {
      sub: userId,
      organizationId: orgId,
      scope: "mcp documents:write",
      clientId: crypto.randomUUID(),
      jti: crypto.randomUUID(),
    });

    const generateResponse = await indexApp.fetch(
      new Request("http://localhost:8787/api/v1/uploads/generate-url", {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
      }),
      env
    );

    expect(generateResponse.status).toBe(200);
    const generateBody = z
      .object({ upload_url: z.string() })
      .parse(await generateResponse.json());
    expect(generateBody.upload_url).toContain("/api/v1/uploads?token=");

    const uploadUrl = new URL(generateBody.upload_url);
    const uploadToken = uploadUrl.searchParams.get("token");
    expect(uploadToken).toBeTruthy();

    const uploadResponse = await indexApp.fetch(
      new Request(
        `http://localhost:8787/api/v1/uploads?token=${encodeURIComponent(uploadToken!)}`,
        {
          method: "POST",
          body: createPdfBytes(),
          headers: { "content-type": "application/pdf" },
        }
      ),
      env
    );

    expect(uploadResponse.status).toBe(200);
    const uploadBody = z
      .object({ storageId: z.string() })
      .parse(await uploadResponse.json());
    expect(uploadBody.storageId).toContain("uploads/");

    const object = await env.DOCUMENTS_BUCKET.get(uploadBody.storageId);
    expect(object).not.toBeNull();
    expect(object?.httpMetadata?.contentType).toBe("application/pdf");
    expect(object?.customMetadata?.organizationId).toBe(orgId);
  });

  it("converts a DOCX upload to PDF and stores the original", async () => {
    const privateJwk = await configureSigningKey();
    const { userId, orgId } = await seedOrgAndUser();

    const token = await signAccessToken(privateJwk, {
      sub: userId,
      organizationId: orgId,
      scope: "mcp documents:write",
      clientId: crypto.randomUUID(),
      jti: crypto.randomUUID(),
    });

    const generateResponse = await indexApp.fetch(
      new Request("http://localhost:8787/api/v1/uploads/generate-url", {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
      }),
      env
    );

    expect(generateResponse.status).toBe(200);
    const generateBody = z
      .object({ upload_url: z.string() })
      .parse(await generateResponse.json());

    const uploadUrl = new URL(generateBody.upload_url);
    const uploadToken = uploadUrl.searchParams.get("token");
    expect(uploadToken).toBeTruthy();

    const uploadResponse = await indexApp.fetch(
      new Request(
        `http://localhost:8787/api/v1/uploads?token=${encodeURIComponent(uploadToken!)}`,
        {
          method: "POST",
          body: createDocxBytes(),
          headers: {
            "content-type":
              "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          },
        }
      ),
      env
    );

    expect(uploadResponse.status).toBe(200);
    const uploadBody = z
      .object({ storageId: z.string() })
      .parse(await uploadResponse.json());
    expect(uploadBody.storageId).toContain("uploads/");

    const converted = await env.DOCUMENTS_BUCKET.get(uploadBody.storageId);
    expect(converted).not.toBeNull();
    expect(converted?.httpMetadata?.contentType).toBe("application/pdf");
    expect(converted?.customMetadata?.originalContentType).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
    expect(converted?.customMetadata?.organizationId).toBe(orgId);

    const originalKey = converted?.customMetadata?.originalKey;
    expect(originalKey).toBeTruthy();
    const original = await env.DOCUMENTS_BUCKET.get(originalKey as string);
    expect(original).not.toBeNull();
    expect(original?.httpMetadata?.contentType).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );
  });
});
