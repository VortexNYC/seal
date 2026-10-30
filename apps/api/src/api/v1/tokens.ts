import type { ApiKey } from "@better-auth/api-key";
import { OpenAPIHono } from "@hono/zod-openapi";
import { and, desc, eq } from "drizzle-orm";

import { createD1 } from "../../global/db.js";
import { apikey } from "../../global/schema.js";
import {
  apiTokenAuth,
  apiTokenMetadata,
  apiTokenScopes,
  hasApiTokenScope,
  parseApiTokenIpRanges,
} from "../../platform/api-token-auth.js";
import { getAuditActor, writeAuditLog } from "../../platform/audit-log.js";
import { organizationMiddleware } from "../../platform/organization-middleware.js";
import type { Variables } from "../../platform/types.js";

const ALLOWED_SCOPES = ["read", "write", "sign", "admin"] as const;
const PERMISSIONS_RESOURCE = "seal";

const app = new OpenAPIHono<{
  Bindings: CloudflareBindings;
  Variables: Variables;
}>();

app.use("/*", apiTokenAuth);
app.use("/*", organizationMiddleware);

function tokenDisplayId(): string {
  return `tk_${crypto.randomUUID().slice(0, 8)}`;
}

function canAdminister(c: {
  get: <K extends keyof Variables>(key: K) => Variables[K];
}): boolean {
  const membership = c.get("membership");
  const roleOk = membership?.role === "admin" || membership?.role === "owner";
  if (!roleOk) {
    return false;
  }
  const apiToken = c.get("apiToken");
  if (apiToken) {
    return hasApiTokenScope(apiToken, "admin");
  }
  return true;
}

function parseAllowedIpRanges(input: unknown): string[] | null {
  if (input === undefined) return [];
  if (!Array.isArray(input)) return null;
  const ranges: string[] = [];
  for (const item of input) {
    if (typeof item !== "string") return null;
    const trimmed = item.trim();
    if (trimmed.length === 0 || trimmed.length > 80) return null;
    ranges.push(trimmed);
  }
  if (ranges.length > 50) return null;
  return ranges;
}

function parseScopes(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input.filter(
    (s): s is string =>
      typeof s === "string" &&
      ALLOWED_SCOPES.includes(s as (typeof ALLOWED_SCOPES)[number])
  );
}

function toTokenResponse(row: typeof apikey.$inferSelect): {
  id: string;
  publicId: string | null;
  name: string | null;
  scopes: string[];
  allowedIpRanges: string[];
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
} {
  const metadata = apiTokenMetadata(row as ApiKey);
  const revokedAt =
    typeof metadata.revokedAt === "string"
      ? metadata.revokedAt
      : !row.enabled
        ? row.updatedAt.toISOString()
        : null;
  return {
    id: row.id,
    publicId:
      typeof metadata.publicId === "string" ? metadata.publicId : row.start,
    name: row.name,
    scopes: apiTokenScopes(row as ApiKey),
    allowedIpRanges: parseApiTokenIpRanges(metadata.allowedIpRanges),
    lastUsedAt: row.lastRequest?.toISOString() ?? null,
    revokedAt,
    createdAt: row.createdAt.toISOString(),
  };
}

app.post("/", async (c) => {
  if (!canAdminister(c)) {
    return c.json({ error: "forbidden" }, 403);
  }

  const body = await c.req.json().catch(() => ({}));
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const scopes = parseScopes(body.scopes);
  const allowedIpRanges = parseAllowedIpRanges(body.allowedIpRanges);
  if (!name || scopes.length === 0 || allowedIpRanges === null) {
    return c.json({ error: "invalid_input" }, 400);
  }

  const user = c.get("user");
  const organization = c.get("organization");
  if (!user || !organization) {
    return c.json({ error: "unauthorized" }, 401);
  }

  const organizationId = organization.id;
  const userId = user.user.id;
  const publicId = tokenDisplayId();

  const auth = c.get("auth");
  const created = await auth.api.createApiKey({
    body: {
      configId: "seal",
      organizationId,
      userId,
      name,
      permissions: { [PERMISSIONS_RESOURCE]: scopes },
      metadata: { publicId, allowedIpRanges, userId },
    },
  });

  const db = createD1(c.env.D1);
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
      resourceId: created.id,
      metadata: { publicId, scopes, allowedIpRanges },
      ipAddress:
        c.req.header("cf-connecting-ip") ?? c.req.header("x-forwarded-for"),
      userAgent: c.req.header("user-agent"),
    });
  }

  return c.json(
    {
      id: created.id,
      publicId,
      name,
      scopes,
      allowedIpRanges,
      token: created.key,
      lastUsedAt: null,
      revokedAt: null,
      createdAt: created.createdAt.toISOString(),
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
    .select()
    .from(apikey)
    .where(
      and(eq(apikey.referenceId, organizationId), eq(apikey.configId, "seal"))
    )
    .orderBy(desc(apikey.createdAt));

  return c.json(rows.map(toTokenResponse));
});

app.delete("/:tokenId", async (c) => {
  if (!canAdminister(c)) {
    return c.json({ error: "forbidden" }, 403);
  }

  const organizationId = c.get("organization").id;
  const tokenId = c.req.param("tokenId");
  const db = createD1(c.env.D1);

  const [existing] = await db
    .select({ id: apikey.id, metadata: apikey.metadata })
    .from(apikey)
    .where(
      and(
        eq(apikey.id, tokenId),
        eq(apikey.referenceId, organizationId),
        eq(apikey.enabled, true)
      )
    )
    .limit(1);

  if (!existing) {
    return c.json({ error: "not_found" }, 404);
  }

  const now = new Date();
  const metadata = apiTokenMetadata(existing as ApiKey);
  await db
    .update(apikey)
    .set({
      enabled: false,
      metadata: JSON.stringify({
        ...metadata,
        revokedAt: now.toISOString(),
      }),
    })
    .where(eq(apikey.id, tokenId));

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
