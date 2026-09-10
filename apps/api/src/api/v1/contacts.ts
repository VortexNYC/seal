import { OpenAPIHono } from "@hono/zod-openapi";
import { and, desc, eq, gt, like, lt, or, type SQL } from "drizzle-orm";

import { createD1 } from "../../global/db.js";
import { contacts } from "../../global/schema.js";
import { mcpHasScope, type McpAccessToken } from "../../platform/mcp-auth.js";

const app = new OpenAPIHono<{
  Bindings: CloudflareBindings;
  Variables: { mcp: McpAccessToken };
}>();

const DEFAULT_PAGE_LIMIT = 20;
const MAX_PAGE_LIMIT = 100;

type ApiContact = {
  id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string;
  phone?: string;
  company?: string;
  title?: string;
  status: string;
  notes?: string;
  tags?: string[];
  last_contacted_at?: string;
  created_at: string;
  updated_at: string;
};

function formatDate(value: Date | null | undefined): string | undefined {
  return value ? value.toISOString() : undefined;
}

function parseTags(tags: string | null): string[] | undefined {
  if (!tags) return undefined;
  try {
    const parsed = JSON.parse(tags) as unknown;
    if (Array.isArray(parsed) && parsed.every((t) => typeof t === "string")) {
      return parsed;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

function toApiContact(row: {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phone: string | null;
  company: string | null;
  title: string | null;
  status: string;
  notes: string | null;
  tags: string | null;
  lastContactedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): ApiContact {
  const tags = parseTags(row.tags);
  return {
    id: row.id,
    first_name: row.firstName,
    last_name: row.lastName,
    full_name: row.fullName,
    email: row.email,
    ...(row.phone ? { phone: row.phone } : {}),
    ...(row.company ? { company: row.company } : {}),
    ...(row.title ? { title: row.title } : {}),
    status: row.status,
    ...(row.notes ? { notes: row.notes } : {}),
    ...(tags ? { tags } : {}),
    ...(row.lastContactedAt
      ? { last_contacted_at: formatDate(row.lastContactedAt) }
      : {}),
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
  };
}

app.get("/", async (c) => {
  const mcp = c.get("mcp");
  if (!mcpHasScope(mcp, "contacts:read")) {
    return c.json({ error: "insufficient_scope" }, 403);
  }

  const organizationId = mcp.organizationId;
  if (!organizationId) {
    return c.json({ error: "organization_required" }, 403);
  }

  const query = c.req.query();
  const rawLimit = Number.parseInt(query.limit ?? `${DEFAULT_PAGE_LIMIT}`, 10);
  const limit = Number.isNaN(rawLimit)
    ? DEFAULT_PAGE_LIMIT
    : Math.min(Math.max(rawLimit, 1), MAX_PAGE_LIMIT);

  const cursor = query.cursor;
  const status = query.status;
  const search = query.search;

  const db = createD1(c.env.D1);
  const conditions: SQL[] = [eq(contacts.organizationId, organizationId)];

  if (status) {
    conditions.push(eq(contacts.status, status));
  }
  if (search) {
    const pattern = `%${search}%`;
    const searchCondition = or(
      like(contacts.fullName, pattern),
      like(contacts.email, pattern)
    );
    if (searchCondition) {
      conditions.push(searchCondition);
    }
  }

  if (cursor) {
    const cursorRows = await db
      .select({ createdAt: contacts.createdAt, id: contacts.id })
      .from(contacts)
      .where(eq(contacts.id, cursor))
      .limit(1);
    const cursorDoc = cursorRows[0];
    if (cursorDoc && cursorDoc.createdAt) {
      const cursorCondition = or(
        lt(contacts.createdAt, cursorDoc.createdAt),
        and(
          eq(contacts.createdAt, cursorDoc.createdAt),
          gt(contacts.id, cursorDoc.id)
        )
      );
      if (cursorCondition) {
        conditions.push(cursorCondition);
      }
    }
  }

  const rows = await db
    .select({
      id: contacts.id,
      firstName: contacts.firstName,
      lastName: contacts.lastName,
      fullName: contacts.fullName,
      email: contacts.email,
      phone: contacts.phone,
      company: contacts.company,
      title: contacts.title,
      status: contacts.status,
      notes: contacts.notes,
      tags: contacts.tags,
      lastContactedAt: contacts.lastContactedAt,
      createdAt: contacts.createdAt,
      updatedAt: contacts.updatedAt,
    })
    .from(contacts)
    .where(and(...conditions))
    .orderBy(desc(contacts.createdAt), desc(contacts.id))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const resultRows = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore
    ? resultRows[resultRows.length - 1]?.id
    : undefined;

  return c.json({
    contacts: resultRows.map(toApiContact),
    has_more: hasMore,
    ...(nextCursor ? { next_cursor: nextCursor } : {}),
  });
});

app.get("/get", async (c) => {
  const mcp = c.get("mcp");
  if (!mcpHasScope(mcp, "contacts:read")) {
    return c.json({ error: "insufficient_scope" }, 403);
  }

  const organizationId = mcp.organizationId;
  if (!organizationId) {
    return c.json({ error: "organization_required" }, 403);
  }

  const id = c.req.query("id");
  if (!id) {
    return c.json({ error: "missing_contact_id" }, 400);
  }

  const db = createD1(c.env.D1);
  const rows = await db
    .select({
      id: contacts.id,
      firstName: contacts.firstName,
      lastName: contacts.lastName,
      fullName: contacts.fullName,
      email: contacts.email,
      phone: contacts.phone,
      company: contacts.company,
      title: contacts.title,
      status: contacts.status,
      notes: contacts.notes,
      tags: contacts.tags,
      lastContactedAt: contacts.lastContactedAt,
      createdAt: contacts.createdAt,
      updatedAt: contacts.updatedAt,
    })
    .from(contacts)
    .where(
      and(eq(contacts.id, id), eq(contacts.organizationId, organizationId))
    )
    .limit(1);

  const row = rows[0];
  if (!row) {
    return c.json({ error: "not_found" }, 404);
  }

  return c.json(toApiContact(row));
});

export default app;
