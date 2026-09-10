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
  }: {
    userId: string;
    organizationId: string;
    storageKey: string;
    documentName: string;
  }
): Promise<string | null> {
  const key = await importMcpSigningKey(env);
  if (!key) return null;

  const { issuer, audience } = getIssuerAndAudience(env);
  const now = Math.floor(Date.now() / 1000);
  const kid = env.SEAL_MCP_SIGNING_KEY_ID ?? "seal-mcp-key-1";

  return new SignJWT({
    sub: userId,
    organizationId,
    purpose: "download" as const,
    storageKey,
    documentName,
    jti: crypto.randomUUID(),
  })
    .setProtectedHeader({ alg: "ES256", kid, typ: "JWT" })
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

    return {
      sub: payload.sub,
      organizationId: payload.organizationId,
      purpose: "download",
      storageKey: payload.storageKey,
      documentName: payload.documentName,
      jti: payload.jti,
    };
  } catch {
    return null;
  }
}
