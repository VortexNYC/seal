import { SignJWT, jwtVerify } from "jose";

import {
  getMcpPublicKey,
  importMcpSigningKey,
  ISSUER_PATH,
} from "../mcp-oauth.js";

export interface DownloadTokenPayload {
  sub: string;
  organizationId: string;
  purpose: "download";
  storageKey: string;
  documentName: string;
  /** Document id when known — enables document.downloaded audit (SEA-46). */
  documentId?: string;
  actorType: "user" | "agent" | "api_token";
  jti: string;
}

const DOWNLOAD_TOKEN_LIFETIME_SECONDS = 600;

function getIssuerAndAudience(env: CloudflareBindings): {
  issuer: string;
  audience: string;
} {
  const base = (env.BETTER_AUTH_URL ?? "https://api.seal.nyc").replace(
    /\/$/,
    ""
  );
  return {
    issuer: `${base}${ISSUER_PATH}`,
    audience: base,
  };
}

export async function createDownloadToken(
  env: CloudflareBindings,
  {
    userId,
    organizationId,
    storageKey,
    documentName,
    documentId,
    actorType = "api_token",
  }: {
    userId: string;
    organizationId: string;
    storageKey: string;
    documentName: string;
    documentId?: string;
    actorType?: "user" | "agent" | "api_token";
  }
): Promise<string | null> {
  const signing = await importMcpSigningKey(env);
  if (!signing) return null;
  const { key, alg } = signing;

  const { issuer, audience } = getIssuerAndAudience(env);
  const now = Math.floor(Date.now() / 1000);
  const kid = env.MCP_SIGNING_KEY_ID ?? "mcp-key-1";

  return new SignJWT({
    sub: userId,
    organizationId,
    purpose: "download" as const,
    storageKey,
    documentName,
    actorType,
    ...(documentId ? { documentId } : {}),
    jti: crypto.randomUUID(),
  })
    .setProtectedHeader({ alg, kid, typ: "JWT" })
    .setIssuedAt(now)
    .setExpirationTime(now + DOWNLOAD_TOKEN_LIFETIME_SECONDS)
    .setIssuer(issuer)
    .setAudience(audience)
    .sign(key);
}

export async function verifyDownloadToken(
  env: CloudflareBindings,
  token: string
): Promise<DownloadTokenPayload | null> {
  const key = await getMcpPublicKey(env);
  if (!key) return null;

  try {
    const { issuer, audience } = getIssuerAndAudience(env);
    const { payload } = await jwtVerify(token, key, { issuer, audience });

    if (typeof payload.sub !== "string") return null;
    if (typeof payload.organizationId !== "string") return null;
    if (typeof payload.jti !== "string") return null;
    if (typeof payload.storageKey !== "string") return null;
    if (typeof payload.documentName !== "string") return null;
    if (payload.purpose !== "download") return null;
    const documentId =
      typeof payload.documentId === "string" ? payload.documentId : undefined;
    const actorTypeRaw = payload.actorType;
    const actorType =
      actorTypeRaw === "user" ||
      actorTypeRaw === "agent" ||
      actorTypeRaw === "api_token"
        ? actorTypeRaw
        : "api_token";

    return {
      sub: payload.sub,
      organizationId: payload.organizationId,
      purpose: "download",
      storageKey: payload.storageKey,
      documentName: payload.documentName,
      documentId,
      actorType,
      jti: payload.jti,
    };
  } catch {
    return null;
  }
}
