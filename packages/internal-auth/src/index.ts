export interface InternalAuthContext {
  env: { INTERNAL_API_KEY?: string | undefined };
  req: { header(name: string): string | undefined };
}

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

export function verifyInternalApiKey(c: InternalAuthContext): boolean {
  const configured = c.env.INTERNAL_API_KEY;
  if (configured == null || configured.length === 0) {
    return false;
  }
  const provided = c.req.header("x-internal-api-key");
  if (provided == null || provided.length === 0) {
    return false;
  }
  return constantTimeEq(provided, configured);
}
