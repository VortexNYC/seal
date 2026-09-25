import { OpenAPIHono } from "@hono/zod-openapi";
import { and, desc, eq, gte, lte, type SQL } from "drizzle-orm";
import { z } from "zod";

import { createD1 } from "../../global/db.js";
import { auditLogs } from "../../global/schema.js";
import {
  apiTokenAuth,
  parseApiTokenScopes,
} from "../../platform/api-token-auth.js";
import { verifyAuditChain } from "../../platform/audit-chain.js";
import { listAuditEntriesForExport, flushAuditSiemStream } from "../../platform/audit-siem.js";
import { organizationMiddleware } from "../../platform/organization-middleware.js";
import type { Variables } from "../../platform/types.js";

const DEFAULT_PAGE_LIMIT = 20;
const MAX_PAGE_LIMIT = 100;
const MAX_EXPORT_LIMIT = 500;

const listQuerySchema = z.object({
  actor: z.string().optional(),
  action: z.string().optional(),
  resourceType: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_LIMIT).optional(),
  cursor: z.coerce.number().int().min(0).optional(),
});

const exportQuerySchema = z.object({
  after_sequence: z.coerce.number().int().min(0).optional(),
  limit: z.coerce.number().int().min(1).max(MAX_EXPORT_LIMIT).optional(),
});

const app = new OpenAPIHono<{
  Bindings: CloudflareBindings;
  Variables: Variables;
}>();

app.use("/*", apiTokenAuth);
app.use("/*", organizationMiddleware);

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

function parseMetadata(
  value: string | null
): Record<string, unknown> | undefined {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(value) as unknown;
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      !Array.isArray(parsed)
    ) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // fall through
  }
  return undefined;
}

app.get("/", async (c) => {
  if (!canAdminister(c)) {
    return c.json({ error: "forbidden" }, 403);
  }

  const organization = c.get("organization");
  if (!organization) {
    return c.json({ error: "unauthorized" }, 401);
  }

  const parsed = listQuerySchema.safeParse(c.req.query());
  if (!parsed.success) {
    return c.json({ error: "validation_error" }, 400);
  }

  const {
    actor,
    action,
    resourceType,
    from,
    to,
    limit: rawLimit,
    cursor,
  } = parsed.data;
  const limit = rawLimit ?? DEFAULT_PAGE_LIMIT;
  const offset = cursor ?? 0;

  const db = createD1(c.env.D1);
  const conditions: SQL[] = [eq(auditLogs.organizationId, organization.id)];

  if (actor) {
    conditions.push(eq(auditLogs.actorId, actor));
  }
  if (action) {
    conditions.push(eq(auditLogs.action, action));
  }
  if (resourceType) {
    conditions.push(eq(auditLogs.resourceType, resourceType));
  }
  if (from) {
    conditions.push(gte(auditLogs.createdAt, new Date(from)));
  }
  if (to) {
    conditions.push(lte(auditLogs.createdAt, new Date(to)));
  }

  const rows = await db
    .select()
    .from(auditLogs)
    .where(and(...conditions))
    .orderBy(desc(auditLogs.createdAt), desc(auditLogs.id))
    .limit(limit + 1)
    .offset(offset);

  const hasMore = rows.length > limit;
  const resultRows = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? offset + limit : undefined;

  return c.json({
    entries: resultRows.map((row) => ({
      id: row.id,
      organizationId: row.organizationId,
      actorId: row.actorId,
      actorType: row.actorType,
      action: row.action,
      resourceType: row.resourceType,
      resourceId: row.resourceId,
      metadata: parseMetadata(row.metadata),
      ipAddress: row.ipAddress,
      userAgent: row.userAgent,
      prevHash: row.prevHash,
      entryHash: row.entryHash,
      sequence: row.sequence,
      createdAt: row.createdAt.toISOString(),
    })),
    has_more: hasMore,
    ...(nextCursor !== undefined ? { next_cursor: String(nextCursor) } : {}),
  });
});

/**
 * SEA-67 — NDJSON pull export for SIEM backfill.
 * Cursor is sealed sequence (after_sequence), ascending.
 */
app.get("/export", async (c) => {
  if (!canAdminister(c)) {
    return c.json({ error: "forbidden" }, 403);
  }

  const organization = c.get("organization");
  if (!organization) {
    return c.json({ error: "unauthorized" }, 401);
  }

  const parsed = exportQuerySchema.safeParse(c.req.query());
  if (!parsed.success) {
    return c.json({ error: "validation_error" }, 400);
  }

  const limit = parsed.data.limit ?? 100;
  const afterSequence = parsed.data.after_sequence ?? 0;
  const db = createD1(c.env.D1);
  const entries = await listAuditEntriesForExport(db, organization.id, {
    afterSequence,
    limit,
  });

  const body = entries.map((entry) => JSON.stringify(entry)).join("\n");
  const last = entries[entries.length - 1];
  const nextSequence =
    last?.sequence !== null && last?.sequence !== undefined
      ? String(last.sequence)
      : undefined;

  return new Response(body.length > 0 ? `${body}\n` : "", {
    status: 200,
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      ...(nextSequence
        ? {
            "x-seal-next-sequence": nextSequence,
            "x-seal-has-more": entries.length >= limit ? "1" : "0",
          }
        : { "x-seal-has-more": "0" }),
    },
  });
});

/**
 * SEA-67 — enqueue sealed audit rows past the SIEM cursor to subscribed
 * webhooks (audit.entry.created / audit.* / *), then drain deliveries.
 */
app.post("/siem/flush", async (c) => {
  if (!canAdminister(c)) {
    return c.json({ error: "forbidden" }, 403);
  }

  const organization = c.get("organization");
  if (!organization) {
    return c.json({ error: "unauthorized" }, 401);
  }

  const limit = Math.min(
    Math.max(parseInt(c.req.query("limit") ?? "100", 10) || 100, 1),
    200
  );

  const result = await flushAuditSiemStream(c.env, {
    organizationId: organization.id,
    limitPerOrg: limit,
    flushImmediately: true,
  });

  return c.json({ success: true, ...result });
});

/** SEA-44 — verify the org's tamper-evident audit hash chain. */
app.get("/verify", async (c) => {
  if (!canAdminister(c)) {
    return c.json({ error: "forbidden" }, 403);
  }

  const organization = c.get("organization");
  if (!organization) {
    return c.json({ error: "unauthorized" }, 401);
  }

  const db = createD1(c.env.D1);
  const result = await verifyAuditChain(db, organization.id);
  return c.json(result, result.ok ? 200 : 409);
});

export default app;
