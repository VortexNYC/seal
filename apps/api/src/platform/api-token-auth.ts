import { and, eq, isNull } from "drizzle-orm";
import { createMiddleware } from "hono/factory";

import { createD1 } from "../global/db.js";
import { apiTokens, organization, user } from "../global/schema.js";
import type { Variables } from "./types.js";

const TOKEN_PREFIX = "seal_";

export function isApiTokenFormat(value: string): boolean {
  return value.startsWith(TOKEN_PREFIX) && value.length > TOKEN_PREFIX.length;
}

export async function hashToken(value: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(value);
  const buffer = await crypto.subtle.digest("SHA-256", data);
  let hex = "";
  for (const byte of new Uint8Array(buffer)) {
    hex += byte.toString(16).padStart(2, "0");
  }
  return hex;
}

export function parseApiTokenScopes(raw: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (Array.isArray(parsed) && parsed.every((s) => typeof s === "string")) {
      return parsed;
    }
  } catch {
    // fall through
  }
  return [];
}

export function hasApiTokenScope(
  token: typeof apiTokens.$inferSelect,
  scope: string
): boolean {
  const scopes = parseApiTokenScopes(token.scopes);
  return scopes.includes(scope);
}

export const apiTokenAuth = createMiddleware<{
  Bindings: CloudflareBindings;
  Variables: Variables;
}>(async (c, next) => {
  const sessionUser = c.get("user");
  if (sessionUser) {
    return next();
  }

  const header = c.req.header("authorization");
  if (!header?.startsWith("Bearer ")) {
    return next();
  }

  const raw = header.slice("Bearer ".length).trim();
  if (!isApiTokenFormat(raw)) {
    return next();
  }

  const hash = await hashToken(raw);
  const db = createD1(c.env.D1);

  const rows = await db
    .select()
    .from(apiTokens)
    .where(and(eq(apiTokens.tokenHash, hash), isNull(apiTokens.revokedAt)))
    .limit(1);

  const token = rows[0];
  if (!token) {
    return next();
  }

  const now = new Date();
  await db
    .update(apiTokens)
    .set({ lastUsedAt: now })
    .where(eq(apiTokens.id, token.id));

  const [userRow, orgRow] = await Promise.all([
    db.select().from(user).where(eq(user.id, token.userId)).limit(1),
    db
      .select()
      .from(organization)
      .where(eq(organization.id, token.organizationId))
      .limit(1),
  ]);

  const userRecord = userRow[0];
  const orgRecord = orgRow[0];
  if (!userRecord || !orgRecord) {
    return next();
  }

  c.set("user", {
    user: { id: userRecord.id, name: userRecord.name, email: userRecord.email },
  });
  c.set("apiToken", token);
  c.set("organization", orgRecord);
  return next();
});
