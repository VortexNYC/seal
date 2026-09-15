import { env } from "cloudflare:test";
import { eq } from "drizzle-orm";
import { exportJWK, generateKeyPair, importJWK, SignJWT, type JWK } from "jose";
import { beforeEach, describe, expect, it } from "vitest";
import { z } from "zod";

import { createD1 } from "../../global/db.js";
import {
  documents,
  importJobs,
  member,
  organization,
  user,
} from "../../global/schema.js";
import indexApp from "../../index.js";

async function configureSigningKey() {
  const { privateKey } = await generateKeyPair("ES256", { extractable: true });
  const privateJwk = await exportJWK(privateKey);
  privateJwk.alg = "ES256";
  privateJwk.kid = "test-key-id";
  env.SEAL_MCP_SIGNING_KEY = JSON.stringify(privateJwk);
  env.SEAL_MCP_SIGNING_KEY_ID = "test-key-id";
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

async function setupToken(
  privateJwk: JWK,
  userId: string,
  orgId: string,
  scope: string
) {
  return signAccessToken(privateJwk, {
    sub: userId,
    organizationId: orgId,
    scope,
    clientId: crypto.randomUUID(),
    jti: crypto.randomUUID(),
  });
}

async function createImportJob(
  token: string,
  payload: { adapter: string; payload?: Record<string, unknown> }
) {
  const response = await indexApp.fetch(
    new Request("http://localhost:8787/api/v1/imports", {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    }),
    env
  );
  return response;
}

const jobResponseSchema = z.object({
  data: z.object({
    id: z.string(),
    adapter: z.string(),
    status: z.string(),
    payload: z.unknown(),
    processed_count: z.number(),
    total_count: z.number().nullable(),
    cursor: z.string().nullable(),
    error: z.string().nullable(),
    approved_by: z.string().nullable(),
    approved_at: z.string().nullable(),
    created_by: z.string(),
    created_at: z.string(),
    updated_at: z.string(),
  }),
});

describe("POST /api/v1/imports", () => {
  beforeEach(async () => {
    env.SEAL_MCP_SIGNING_KEY = undefined;
    env.SEAL_MCP_SIGNING_KEY_ID = undefined;

    const db = createD1(env.D1);
    await db.delete(documents);
    await db.delete(importJobs);
    await db.delete(member);
    await db.delete(organization);
    await db.delete(user);
  });

  it("creates a pdf import job pending approval", async () => {
    const privateJwk = await configureSigningKey();
    const { userId, orgId } = await seedOrgAndUser();
    const token = await setupToken(
      privateJwk,
      userId,
      orgId,
      "mcp documents:write"
    );

    const response = await createImportJob(token, {
      adapter: "pdf",
      payload: { files: [{ fileName: "contract.pdf" }] },
    });

    expect(response.status).toBe(201);
    const body = jobResponseSchema.parse(await response.json());
    expect(body.data.adapter).toBe("pdf");
    expect(body.data.status).toBe("pending_approval");
  });

  it("rejects an unknown adapter", async () => {
    const privateJwk = await configureSigningKey();
    const { userId, orgId } = await seedOrgAndUser();
    const token = await setupToken(
      privateJwk,
      userId,
      orgId,
      "mcp documents:write"
    );

    const response = await createImportJob(token, {
      adapter: "unknown",
      payload: {},
    });

    expect(response.status).toBe(400);
  });

  it("rejects without write scope", async () => {
    const privateJwk = await configureSigningKey();
    const { userId, orgId } = await seedOrgAndUser();
    const token = await setupToken(
      privateJwk,
      userId,
      orgId,
      "mcp documents:read"
    );

    const response = await createImportJob(token, {
      adapter: "pdf",
      payload: {},
    });

    expect(response.status).toBe(403);
  });
});

describe("GET /api/v1/imports", () => {
  beforeEach(async () => {
    env.SEAL_MCP_SIGNING_KEY = undefined;
    env.SEAL_MCP_SIGNING_KEY_ID = undefined;

    const db = createD1(env.D1);
    await db.delete(documents);
    await db.delete(importJobs);
    await db.delete(member);
    await db.delete(organization);
    await db.delete(user);
  });

  it("lists import jobs for the organization", async () => {
    const privateJwk = await configureSigningKey();
    const { userId, orgId } = await seedOrgAndUser();
    const token = await setupToken(
      privateJwk,
      userId,
      orgId,
      "mcp documents:read"
    );

    const createToken = await setupToken(
      privateJwk,
      userId,
      orgId,
      "mcp documents:write"
    );
    await createImportJob(createToken, { adapter: "pdf", payload: {} });

    const response = await indexApp.fetch(
      new Request("http://localhost:8787/api/v1/imports", {
        headers: { authorization: `Bearer ${token}` },
      }),
      env
    );

    expect(response.status).toBe(200);
    const body = z
      .object({ data: z.array(jobResponseSchema.shape.data) })
      .parse(await response.json());
    expect(body.data).toHaveLength(1);
  });
});

describe("POST /api/v1/imports/:publicId/approve", () => {
  beforeEach(async () => {
    env.SEAL_MCP_SIGNING_KEY = undefined;
    env.SEAL_MCP_SIGNING_KEY_ID = undefined;

    const db = createD1(env.D1);
    await db.delete(documents);
    await db.delete(importJobs);
    await db.delete(member);
    await db.delete(organization);
    await db.delete(user);
  });

  it("approves and runs the first batch, returning a resume cursor", async () => {
    const privateJwk = await configureSigningKey();
    const { userId, orgId } = await seedOrgAndUser();
    const token = await setupToken(
      privateJwk,
      userId,
      orgId,
      "mcp documents:write"
    );

    const createResponse = await createImportJob(token, {
      adapter: "pdf",
      payload: {
        files: [
          { fileName: "one.pdf" },
          { fileName: "two.pdf" },
          { fileName: "three.pdf" },
        ],
      },
    });

    const createBody = jobResponseSchema.parse(await createResponse.json());
    const publicId = createBody.data.id;

    const response = await indexApp.fetch(
      new Request(`http://localhost:8787/api/v1/imports/${publicId}/approve`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
      }),
      env
    );

    expect(response.status).toBe(200);
    const body = z
      .object({
        data: z.object({
          publicId: z.string(),
          status: z.string(),
          processed_count: z.number(),
          total_count: z.number(),
          cursor: z.string().nullable(),
          error: z.string().nullable(),
        }),
      })
      .parse(await response.json());

    expect(body.data.status).toBe("running");
    expect(body.data.processed_count).toBe(2);
    expect(body.data.total_count).toBe(3);
    expect(body.data.cursor).not.toBeNull();
  });

  it("fails when the adapter is not implemented", async () => {
    const privateJwk = await configureSigningKey();
    const { userId, orgId } = await seedOrgAndUser();
    const token = await setupToken(
      privateJwk,
      userId,
      orgId,
      "mcp documents:write"
    );

    const createResponse = await createImportJob(token, {
      adapter: "docusign",
      payload: { credentials: {} },
    });

    const createBody = jobResponseSchema.parse(await createResponse.json());
    const publicId = createBody.data.id;

    const response = await indexApp.fetch(
      new Request(`http://localhost:8787/api/v1/imports/${publicId}/approve`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
      }),
      env
    );

    expect(response.status).toBe(500);
  });
});

describe("POST /api/v1/imports/:publicId/resume", () => {
  beforeEach(async () => {
    env.SEAL_MCP_SIGNING_KEY = undefined;
    env.SEAL_MCP_SIGNING_KEY_ID = undefined;

    const db = createD1(env.D1);
    await db.delete(documents);
    await db.delete(importJobs);
    await db.delete(member);
    await db.delete(organization);
    await db.delete(user);
  });

  it("resumes and completes a multi-batch import", async () => {
    const privateJwk = await configureSigningKey();
    const { userId, orgId, db } = await seedOrgAndUser();
    const token = await setupToken(
      privateJwk,
      userId,
      orgId,
      "mcp documents:write"
    );

    const createResponse = await createImportJob(token, {
      adapter: "pdf",
      payload: {
        files: [
          { fileName: "one.pdf" },
          { fileName: "two.pdf" },
          { fileName: "three.pdf" },
        ],
      },
    });

    const createBody = jobResponseSchema.parse(await createResponse.json());
    const publicId = createBody.data.id;

    await indexApp.fetch(
      new Request(`http://localhost:8787/api/v1/imports/${publicId}/approve`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
      }),
      env
    );

    const response = await indexApp.fetch(
      new Request(`http://localhost:8787/api/v1/imports/${publicId}/resume`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
      }),
      env
    );

    expect(response.status).toBe(200);
    const body = z
      .object({
        data: z.object({
          publicId: z.string(),
          status: z.string(),
          processed_count: z.number(),
          total_count: z.number(),
          cursor: z.string().nullable(),
          error: z.string().nullable(),
        }),
      })
      .parse(await response.json());

    expect(body.data.status).toBe("completed");
    expect(body.data.processed_count).toBe(3);
    expect(body.data.total_count).toBe(3);
    expect(body.data.cursor).toBeNull();

    const docs = await db
      .select()
      .from(documents)
      .where(eq(documents.organizationId, orgId));
    expect(docs).toHaveLength(3);
  });
});
