import { OpenAPIHono } from "@hono/zod-openapi";
import { and, desc, eq, gt, lt, type SQL } from "drizzle-orm";
import { z } from "zod";

import { createD1 } from "../../global/db.js";
import { activity } from "../../global/schema.js";
import { mcpHasScope, type McpAccessToken } from "../../platform/mcp-auth.js";

const app = new OpenAPIHono<{
  Bindings: CloudflareBindings;
  Variables: { mcp: McpAccessToken };
}>();

const DEFAULT_PAGE_LIMIT = 20;
const MAX_PAGE_LIMIT = 100;

type ApiAuditEntry = {
  id: string;
  event_type: string;
  actor_email?: string;
  actor_name?: string;
  timestamp: string;
  ip_address?: string;
  user_agent?: string;
  details?: Record<string, unknown>;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseMetadata(
  value: string | null
): Record<string, unknown> | undefined {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(value) as unknown;
    return isRecord(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

function toApiAuditEntry(row: {
  id: string;
  action: string;
  actorName: string;
  targetName: string | null;
  metadata: string | null;
  createdAt: Date;
}): ApiAuditEntry {
  const metadata = parseMetadata(row.metadata);
  const result: ApiAuditEntry = {
    id: row.id,
    event_type: row.action,
    actor_name: row.actorName,
    timestamp: row.createdAt.toISOString(),
  };
  if (row.targetName) {
    result.actor_name = row.targetName;
  }
  if (metadata) {
    result.details = metadata;
  }
  return result;
}

const listAuditLogQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  cursor: z.string().optional(),
  document_id: z.string().optional(),
  action: z.string().optional(),
  created_after: z.string().datetime().optional(),
  created_before: z.string().datetime().optional(),
});

app.get("/", async (c) => {
  const mcp = c.get("mcp");
  if (
    !mcpHasScope(mcp, "account:read") &&
    !mcpHasScope(mcp, "analytics:read")
  ) {
    return c.json({ error: "insufficient_scope" }, 403);
  }

  const organizationId = mcp.organizationId;
  if (!organizationId) {
    return c.json({ error: "organization_required" }, 403);
  }

  const query = c.req.query();
  const parsed = listAuditLogQuerySchema.safeParse(query);
  if (!parsed.success) {
    return c.json({ error: "validation_error" }, 400);
  }

  const {
    limit: rawLimit,
    cursor,
    document_id,
    action,
    created_after,
    created_before,
  } = parsed.data;
  const limit = rawLimit ?? DEFAULT_PAGE_LIMIT;

  const db = createD1(c.env.D1);
  const conditions: SQL[] = [eq(activity.organizationId, organizationId)];

  if (action) {
    conditions.push(eq(activity.action, action));
  }
  if (created_after) {
    conditions.push(gt(activity.createdAt, new Date(created_after)));
  }
  if (created_before) {
    conditions.push(lt(activity.createdAt, new Date(created_before)));
  }

  const rows = await db
    .select({
      id: activity.id,
      action: activity.action,
      actorName: activity.actorName,
      targetName: activity.targetName,
      metadata: activity.metadata,
      createdAt: activity.createdAt,
    })
    .from(activity)
    .where(and(...conditions))
    .orderBy(desc(activity.createdAt), desc(activity.id))
    .limit(MAX_PAGE_LIMIT + 1);

  let filteredRows = rows;
  if (document_id) {
    filteredRows = rows.filter((row) => {
      const metadata = parseMetadata(row.metadata);
      if (!isRecord(metadata)) return false;
      return metadata.document_id === document_id;
    });
  }

  if (cursor) {
    const cursorIndex = filteredRows.findIndex((row) => row.id === cursor);
    if (cursorIndex !== -1) {
      filteredRows = filteredRows.slice(cursorIndex + 1);
    }
  }

  const hasMore = filteredRows.length > limit;
  const resultRows = hasMore ? filteredRows.slice(0, limit) : filteredRows;
  const nextCursor = hasMore
    ? resultRows[resultRows.length - 1]?.id
    : undefined;

  return c.json({
    entries: resultRows.map(toApiAuditEntry),
    has_more: hasMore,
    ...(nextCursor ? { next_cursor: nextCursor } : {}),
  });
});

export default app;
