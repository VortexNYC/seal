/**
 * Shared internal-auth for Seal workers.
 *
 * Rules:
 * - Internet-facing hosts (api.seal.nyc, *.workers.dev) never serve /internal/*
 *   — even with a valid key. Callers must use a service binding to the
 *   `InternalApi` entrypoint (or hit a non-public hostname in local/dev).
 * - Off those hosts, require `x-internal-api-key` matched in constant time
 *   against a configured secret of at least MIN_INTERNAL_API_KEY_LENGTH chars.
 */

export const MIN_INTERNAL_API_KEY_LENGTH = 32;

export interface InternalAuthContext {
  env: { INTERNAL_API_KEY?: string | undefined };
  req: {
    header(name: string): string | undefined;
    url?: string;
  };
}

export type InternalAuthDecision =
  | { ok: true }
  | { ok: false; status: 401 | 404; error: "unauthorized" | "not found" };

function constantTimeEq(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  const ae = new TextEncoder().encode(a);
  const be = new TextEncoder().encode(b);
  let diff = 0;
  for (let i = 0; i < ae.length; i++) {
    diff |= (ae[i] || 0) ^ (be[i] || 0);
  }
  return diff === 0;
}

/** True when the request hostname is reachable from the public internet. */
export function isInternetFacingHostname(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host === "api.seal.nyc") return true;
  if (host.endsWith(".workers.dev")) return true;
  return false;
}

export function verifyInternalApiKey(c: InternalAuthContext): boolean {
  const configured = c.env.INTERNAL_API_KEY;
  if (
    configured == null ||
    configured.length < MIN_INTERNAL_API_KEY_LENGTH
  ) {
    return false;
  }
  const provided = c.req.header("x-internal-api-key");
  if (provided == null || provided.length === 0) {
    return false;
  }
  return constantTimeEq(provided, configured);
}

/**
 * Authorize an `/internal/*` request.
 * Public hostnames are rejected with 404 (hide the surface).
 * Otherwise require a valid internal API key.
 */
export function authorizeInternalRequest(
  c: InternalAuthContext,
  requestUrl: string
): InternalAuthDecision {
  let hostname: string;
  try {
    hostname = new URL(requestUrl).hostname;
  } catch {
    return { ok: false, status: 404, error: "not found" };
  }

  if (isInternetFacingHostname(hostname)) {
    return { ok: false, status: 404, error: "not found" };
  }

  if (!verifyInternalApiKey(c)) {
    return { ok: false, status: 401, error: "unauthorized" };
  }

  return { ok: true };
}
