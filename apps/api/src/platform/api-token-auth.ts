import type { ApiKey } from "@better-auth/api-key";
import { and, eq, isNull, or } from "drizzle-orm";
import type { Context } from "hono";
import { createMiddleware } from "hono/factory";

import { createD1 } from "../global/db.js";
import { member, organization, user } from "../global/schema.js";
import { writeAuditLog } from "./audit-log.js";
import { ipMatchesAllowlist, requestClientIp } from "./ip-allowlist.js";
import type { McpAccessToken } from "./mcp-auth.js";
import { workspaceApiAccessAllows } from "./org-settings.js";
import type { Variables } from "./types.js";

const TOKEN_PREFIX = "seal_";
const PERMISSIONS_RESOURCE = "seal";

export function isApiTokenFormat(value: string): boolean {
  return value.startsWith(TOKEN_PREFIX) && value.length > TOKEN_PREFIX.length;
}

// Hex SHA-256 — used by signer access-code hashing (signer-auth.ts). API key
// verification itself is delegated to @better-auth/api-key (base64url digest).
export async function hashToken(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const buffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function parseApiTokenPermissions(
  raw: unknown
): Record<string, string[]> {
  let parsed: unknown = raw;
  if (typeof raw === "string") {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return {};
    }
  }
  if (
    parsed &&
    typeof parsed === "object" &&
    !Array.isArray(parsed) &&
    Object.values(parsed).every(
      (v) => Array.isArray(v) && v.every((s) => typeof s === "string")
    )
  ) {
    return parsed as Record<string, string[]>;
  }
  return {};
}

export function apiTokenScopes(apiKey: ApiKey): string[] {
  return (
    parseApiTokenPermissions(apiKey.permissions)[PERMISSIONS_RESOURCE] ?? []
  );
}

export function apiTokenMetadata(apiKey: ApiKey): Record<string, unknown> {
  let raw: unknown = apiKey.metadata;
  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      return {};
    }
  }
  return raw && typeof raw === "object" && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : {};
}

export function parseApiTokenIpRanges(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((s): s is string => typeof s === "string");
}

export function hasApiTokenScope(apiKey: ApiKey, scope: string): boolean {
  return apiTokenScopes(apiKey).includes(scope);
}

export async function loadApiTokenContext<E extends CloudflareBindings>(
  c: Context<{ Bindings: E; Variables: Variables }>,
  raw: string
): Promise<boolean> {
  if (!isApiTokenFormat(raw)) {
    return false;
  }

  const auth = c.get("auth");
  if (!auth) {
    return false;
  }

  const verification = (await auth.api
    .verifyApiKey({ body: { key: raw, configId: "seal" } })
    .catch(() => null)) as {
    valid: boolean;
    key: ApiKey | null;
  } | null;
  const apiKey = verification?.valid ? verification.key : null;
  if (!apiKey || apiKey.configId !== "seal" || !apiKey.enabled) {
    return false;
  }

  const metadata = apiTokenMetadata(apiKey);
  const clientIp = requestClientIp(c.req.raw.headers);
  if (
    !ipMatchesAllowlist(
      clientIp,
      parseApiTokenIpRanges(metadata.allowedIpRanges)
    )
  ) {
    return false;
  }

  const db = createD1(c.env.D1);
  const orgRecord = (
    await db
      .select()
      .from(organization)
      .where(eq(organization.id, apiKey.referenceId))
      .limit(1)
  )[0];
  if (!orgRecord) {
    return false;
  }

  const ownerId = typeof metadata.userId === "string" ? metadata.userId : null;
  if (ownerId) {
    // Keys minted for a specific user must not outlive their membership —
    // a user removed from the org (or pruned from Vortex sync) loses key access.
    const membership = (
      await db
        .select({ id: member.id })
        .from(member)
        .where(
          and(
            eq(member.organizationId, orgRecord.id),
            eq(member.userId, ownerId)
          )
        )
        .limit(1)
    )[0];
    if (!membership) {
      return false;
    }
  }
  const userRecord = ownerId
    ? (
        await db
          .select()
          .from(user)
          .where(
            and(
              eq(user.id, ownerId),
              or(isNull(user.banned), eq(user.banned, false))
            )
          )
          .limit(1)
      )[0]
    : (
        await db
          .select({ user })
          .from(member)
          .innerJoin(user, eq(member.userId, user.id))
          .where(
            and(
              eq(member.organizationId, orgRecord.id),
              eq(member.role, "owner"),
              or(isNull(user.banned), eq(user.banned, false))
            )
          )
          .limit(1)
      )[0]?.user;
  if (!userRecord) {
    return false;
  }

  if (!workspaceApiAccessAllows(orgRecord.metadata, clientIp)) {
    return false;
  }

  c.set("user", {
    user: { id: userRecord.id, name: userRecord.name, email: userRecord.email },
  });
  c.set("apiToken", apiKey);
  c.set("organization", orgRecord);

  const mcp: McpAccessToken = {
    sub: userRecord.id,
    organizationId: orgRecord.id,
    organizationSlug: orgRecord.slug,
    scope: apiTokenScopes(apiKey).join(" "),
    clientId: "seal",
    jti: apiKey.id,
    kind: "api",
  };
  c.set("mcp", mcp);

  const metadataPublicId =
    typeof metadata.publicId === "string" ? metadata.publicId : null;
  await writeAuditLog(db, {
    organizationId: orgRecord.id,
    actor: { type: "api_token", id: apiKey.id },
    action: "api_token.authenticated",
    resourceType: "api_token",
    resourceId: apiKey.id,
    metadata: {
      method: c.req.method,
      path: c.req.path,
      publicId: metadataPublicId ?? apiKey.start,
    },
    ipAddress:
      c.req.header("cf-connecting-ip") ?? c.req.header("x-forwarded-for"),
    userAgent: c.req.header("user-agent"),
  });

  return true;
}

export const apiTokenAuth = createMiddleware<{
  Bindings: CloudflareBindings;
  Variables: Variables;
}>(async (c, next) => {
  const header = c.req.header("authorization");
  if (header?.startsWith("Bearer ")) {
    const raw = header.slice("Bearer ".length).trim();
    await loadApiTokenContext(c, raw);
  }
  return next();
});
