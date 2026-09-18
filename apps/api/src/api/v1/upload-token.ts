import { SignJWT, jwtVerify } from "jose";

import {
  getMcpPublicKey,
  importMcpSigningKey,
  ISSUER_PATH,
} from "../mcp-oauth.js";

export interface UploadTokenPayload {
  sub: string;
  organizationId: string;
  purpose: "upload";
  jti: string;
}

const UPLOAD_TOKEN_LIFETIME_SECONDS = 600;

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

export async function createUploadToken(
  env: CloudflareBindings,
  { userId, organizationId }: { userId: string; organizationId: string }
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
    purpose: "upload" as const,
    jti: crypto.randomUUID(),
  })
    .setProtectedHeader({ alg, kid, typ: "JWT" })
    .setIssuedAt(now)
    .setExpirationTime(now + UPLOAD_TOKEN_LIFETIME_SECONDS)
    .setIssuer(issuer)
    .setAudience(audience)
    .sign(key);
}

export async function verifyUploadToken(
  env: CloudflareBindings,
  token: string
): Promise<UploadTokenPayload | null> {
  const key = await getMcpPublicKey(env);
  if (!key) return null;

  try {
    const { issuer, audience } = getIssuerAndAudience(env);
    const { payload } = await jwtVerify(token, key, { issuer, audience });

    if (typeof payload.sub !== "string") return null;
    if (typeof payload.organizationId !== "string") return null;
    if (typeof payload.jti !== "string") return null;
    if (payload.purpose !== "upload") return null;

    return {
      sub: payload.sub,
      organizationId: payload.organizationId,
      purpose: "upload",
      jti: payload.jti,
    };
  } catch {
    return null;
  }
}
