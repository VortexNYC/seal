import { OpenAPIHono } from "@hono/zod-openapi";
import { and, desc, eq, isNull } from "drizzle-orm";

import { createD1 } from "../../global/db.js";
import { apiTokens } from "../../global/schema.js";
import {
  apiTokenAuth,
  hashToken,
  parseApiTokenScopes,
} from "../../platform/api-token-auth.js";
import { getAuditActor, writeAuditLog } from "../../platform/audit-log.js";
import { organizationMiddleware } from "../../platform/organization-middleware.js";
import type { Variables } from "../../platform/types.js";

const ALLOWED_SCOPES = ["read", "write", "sign", "admin"] as const;

const app = new OpenAPIHono<{
  Bindings: CloudflareBindings;
  Variables: Variables;
}>();

app.use("/*", apiTokenAuth);
app.use("/*", organizationMiddleware);

function generateSecret(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function tokenDisplayId(): string {
  return `tk_${crypto.randomUUID().slice(0, 8)}`;
}

function canAdminister(c: {
  get: <K extends keyof Variables>(key: K) => Variables[K];
}): boolean {
  const apiToken = c.get("apiToken");
  if (apiToken) {
    return parseApiTokenScopes(apiToken.scopes).includes("admin");
  }
  const membership = c.get("membership");
  return membership?.role === "admin" || membership?.role === "owner";
}

function parseScopes(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input.filter(
    (s): s is string =>
      typeof s === "string" &&
      ALLOWED_SCOPES.includes(s as (typeof ALLOWED_SCOPES)[number])
  );
}

app.post("/", async (c) => {
  if (!canAdminister(c)) {
    return c.json({ error: "forbidden" }, 403);
  }

  const body = await c.req.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const scopes = parseScopes(body.scopes);
  if (!name || scopes.length === 0) {
    return c.json({ error: "invalid_input" }, 400);
  }

  const user = c.get("user");
  const organization = c.get("organization");
  if (!user || !organization) {
    return c.json({ error: "unauthorized" }, 401);
  }

  const organizationId = organization.id;
  const userId = user.user.id;
  const id = crypto.randomUUID();
  const publicId = tokenDisplayId();
  const secret = generateSecret();
  const token = `seal_${publicId}_${secret}`;
  const tokenHash = await hashToken(token);

  const db = createD1(c.env.D1);
  await db.insert(apiTokens).values({
    id,
    publicId,
    organizationId,
    userId,
    name,
    tokenHash,
    scopes: JSON.stringify(scopes),
  });

  const actor = getAuditActor({
    apiToken: c.get("apiToken"),
    mcp: c.get("mcp"),
    user: c.get("user"),
  });
  if (actor) {
    await writeAuditLog(db, {
      organizationId,
      actor,
      action: "api_token.create",
      resourceType: "api_token",
      resourceId: id,
      metadata: { publicId, scopes },
      ipAddress:
        c.req.header("cf-connecting-ip") ?? c.req.header("x-forwarded-for"),
      userAgent: c.req.header("user-agent"),
    });
  }

  return c.json(
    {
      id,
      publicId,
      name,
      scopes,
      token,
      createdAt: new Date().toISOString(),
    },
    201
  );
});

app.get("/", async (c) => {
  if (!canAdminister(c)) {
    return c.json({ error: "forbidden" }, 403);
  }

  const organizationId = c.get("organization").id;
  const db = createD1(c.env.D1);
  const rows = await db
    .select({
      id: apiTokens.id,
      publicId: apiTokens.publicId,
      name: apiTokens.name,
      scopes: apiTokens.scopes,
      lastUsedAt: apiTokens.lastUsedAt,
      revokedAt: apiTokens.revokedAt,
      createdAt: apiTokens.createdAt,
    })
    .from(apiTokens)
    .where(eq(apiTokens.organizationId, organizationId))
    .orderBy(desc(apiTokens.createdAt));

  return c.json(
    rows.map((row) => ({
      id: row.id,
      publicId: row.publicId,
      name: row.name,
      scopes: parseApiTokenScopes(row.scopes),
      lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
      revokedAt: row.revokedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    }))
  );
});

app.delete("/:tokenId", async (c) => {
  if (!canAdminister(c)) {
    return c.json({ error: "forbidden" }, 403);
  }

  const organizationId = c.get("organization").id;
  const tokenId = c.req.param("tokenId");
  const db = createD1(c.env.D1);

  const [existing] = await db
    .select({ id: apiTokens.id })
    .from(apiTokens)
    .where(
      and(
        eq(apiTokens.id, tokenId),
        eq(apiTokens.organizationId, organizationId),
        isNull(apiTokens.revokedAt)
      )
    )
    .limit(1);

  if (!existing) {
    return c.json({ error: "not_found" }, 404);
  }

  const now = new Date();
  await db
    .update(apiTokens)
    .set({ revokedAt: now })
    .where(eq(apiTokens.id, tokenId));

  const actor = getAuditActor({
    apiToken: c.get("apiToken"),
    mcp: c.get("mcp"),
    user: c.get("user"),
  });
  if (actor) {
    await writeAuditLog(db, {
      organizationId,
      actor,
      action: "api_token.revoke",
      resourceType: "api_token",
      resourceId: tokenId,
      metadata: {},
      ipAddress:
        c.req.header("cf-connecting-ip") ?? c.req.header("x-forwarded-for"),
      userAgent: c.req.header("user-agent"),
    });
  }

  return c.json({ revoked: true });
});

export default app;
