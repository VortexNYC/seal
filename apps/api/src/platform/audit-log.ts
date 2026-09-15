import { createD1 } from "../global/db.js";
import { auditLogs } from "../global/schema.js";

export type AuditActor = {
  type: "user" | "agent" | "api_token";
  id: string;
};

export interface AuditLogInput {
  organizationId: string;
  actor: AuditActor;
  action: string;
  resourceType: string;
  resourceId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

export async function writeAuditLog(
  db: ReturnType<typeof createD1>,
  input: AuditLogInput
): Promise<void> {
  await db.insert(auditLogs).values({
    id: crypto.randomUUID(),
    organizationId: input.organizationId,
    actorId: input.actor.id,
    actorType: input.actor.type,
    action: input.action,
    resourceType: input.resourceType,
    resourceId: input.resourceId,
    metadata: input.metadata ? JSON.stringify(input.metadata) : undefined,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    createdAt: new Date(),
  });
}

export function getAuditRequestMeta(c: {
  req: { header(name: string): string | undefined };
}): { ipAddress: string | undefined; userAgent: string | undefined } {
  return {
    ipAddress: c.req.header("cf-connecting-ip") ?? c.req.header("x-forwarded-for"),
    userAgent: c.req.header("user-agent"),
  };
}

export function getAuditActor(values: {
  apiToken?: { id: string } | null;
  mcp?: { kind?: "mcp" | "api"; clientId: string; jti: string } | null;
  user?: { user: { id: string } } | null;
}): AuditActor | null {
  if (values.apiToken) {
    return { type: "api_token", id: values.apiToken.id };
  }
  if (values.mcp?.kind === "api") {
    return { type: "api_token", id: values.mcp.jti };
  }
  if (values.mcp) {
    return { type: "agent", id: values.mcp.clientId };
  }
  if (values.user) {
    return { type: "user", id: values.user.user.id };
  }
  return null;
}
