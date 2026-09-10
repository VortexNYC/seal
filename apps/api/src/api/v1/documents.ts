import { OpenAPIHono } from "@hono/zod-openapi";
import {
  and,
  desc,
  eq,
  gt,
  gte,
  like,
  lt,
  ne,
  or,
  type SQL,
} from "drizzle-orm";

import { createD1 } from "../../global/db.js";
import { documents, recipients } from "../../global/schema.js";
import { mcpHasScope, type McpAccessToken } from "../../platform/mcp-auth.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const app = new OpenAPIHono<{
  Bindings: CloudflareBindings;
  Variables: { mcp: McpAccessToken };
}>();

const DEFAULT_PAGE_LIMIT = 20;
const MAX_PAGE_LIMIT = 100;

type ApiDocument = {
  id: string;
  title: string;
  description?: string;
  status: string;
  created_at: string;
  updated_at: string;
  recipients_count: number;
  signed_count: number;
  deadline?: string;
  download_url?: string;
  recipients?: ApiRecipient[];
};

type ApiRecipient = {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
  order?: number;
  signed_at?: string;
  viewed_at?: string;
  declined_at?: string;
  decline_reason?: string;
};

function formatDate(value: Date | null | undefined): string | undefined {
  return value ? value.toISOString() : undefined;
}

function parseDeclineReason(signatureData: string | null): string | undefined {
  if (!signatureData) return undefined;
  try {
    const parsed = JSON.parse(signatureData) as unknown;
    if (isRecord(parsed) && typeof parsed.declineReason === "string") {
      return parsed.declineReason;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

function toApiRecipient(row: {
  id: string;
  email: string;
  name: string | null;
  role: string;
  order: number | null;
  status: string;
  viewedAt: Date | null;
  signedAt: Date | null;
  approvedAt: Date | null;
  declinedAt: Date | null;
  signatureData: string | null;
}): ApiRecipient {
  const declineReason = parseDeclineReason(row.signatureData);
  const signedAt = row.signedAt ?? row.approvedAt ?? undefined;
  return {
    id: row.id,
    email: row.email,
    name: row.name ?? "",
    role: row.role,
    status: row.status,
    ...(row.order !== null && row.order !== undefined
      ? { order: row.order }
      : {}),
    ...(row.viewedAt ? { viewed_at: formatDate(row.viewedAt) } : {}),
    ...(signedAt ? { signed_at: formatDate(signedAt) } : {}),
    ...(row.declinedAt ? { declined_at: formatDate(row.declinedAt) } : {}),
    ...(declineReason ? { decline_reason: declineReason } : {}),
  };
}

async function recipientCountsForDocument(
  db: ReturnType<typeof createD1>,
  documentId: string
): Promise<{ total: number; signed: number }> {
  const rows = await db
    .select({ status: recipients.status })
    .from(recipients)
    .where(eq(recipients.documentId, documentId));
  let total = 0;
  let signed = 0;
  for (const row of rows) {
    total++;
    if (row.status === "signed" || row.status === "approved") {
      signed++;
    }
  }
  return { total, signed };
}

function toApiDocument(
  row: {
    id: string;
    name: string;
    description: string | null;
    status: string;
    createdAt: Date;
    updatedAt: Date;
    deadline: Date | null;
    storageKey: string | null;
  },
  counts: { total: number; signed: number }
): ApiDocument {
  return {
    id: row.id,
    title: row.name,
    ...(row.description ? { description: row.description } : {}),
    status: row.status,
    created_at: row.createdAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
    recipients_count: counts.total,
    signed_count: counts.signed,
    ...(row.deadline ? { deadline: row.deadline.toISOString() } : {}),
    ...(row.storageKey
      ? { download_url: `/api/v1/documents/download?id=${row.id}` }
      : {}),
  };
}

app.get("/", async (c) => {
  const mcp = c.get("mcp");
  if (!mcpHasScope(mcp, "documents:read")) {
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
  const titleSearch = query.title_search;
  const createdAfter = query.created_after;
  const createdBefore = query.created_before;

  const db = createD1(c.env.D1);

  const conditions: SQL[] = [
    eq(documents.organizationId, organizationId),
    ne(documents.documentStatus, "deleted"),
  ];

  if (status) {
    conditions.push(eq(documents.status, status));
  }
  if (titleSearch) {
    conditions.push(like(documents.name, `%${titleSearch}%`));
  }
  if (createdAfter) {
    const after = new Date(createdAfter);
    if (!Number.isNaN(after.getTime())) {
      conditions.push(gte(documents.createdAt, after));
    }
  }
  if (createdBefore) {
    const before = new Date(createdBefore);
    if (!Number.isNaN(before.getTime())) {
      conditions.push(lt(documents.createdAt, before));
    }
  }

  if (cursor) {
    const cursorRows = await db
      .select({ createdAt: documents.createdAt, id: documents.id })
      .from(documents)
      .where(eq(documents.id, cursor))
      .limit(1);
    const cursorDoc = cursorRows[0];
    if (cursorDoc && cursorDoc.createdAt) {
      const cursorCondition = or(
        lt(documents.createdAt, cursorDoc.createdAt),
        and(
          eq(documents.createdAt, cursorDoc.createdAt),
          gt(documents.id, cursorDoc.id)
        )
      );
      if (cursorCondition) {
        conditions.push(cursorCondition);
      }
    }
  }

  const rows = await db
    .select({
      id: documents.id,
      name: documents.name,
      description: documents.description,
      status: documents.status,
      createdAt: documents.createdAt,
      updatedAt: documents.updatedAt,
      deadline: documents.deadline,
      storageKey: documents.storageKey,
    })
    .from(documents)
    .where(and(...conditions))
    .orderBy(desc(documents.createdAt), desc(documents.id))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const resultRows = hasMore ? rows.slice(0, limit) : rows;

  const apiDocuments: ApiDocument[] = await Promise.all(
    resultRows.map(async (row) => {
      const counts = await recipientCountsForDocument(db, row.id);
      return toApiDocument(row, counts);
    })
  );

  const nextCursor = hasMore
    ? resultRows[resultRows.length - 1]?.id
    : undefined;

  return c.json({
    documents: apiDocuments,
    has_more: hasMore,
    ...(nextCursor ? { next_cursor: nextCursor } : {}),
  });
});

app.get("/get", async (c) => {
  const mcp = c.get("mcp");
  if (!mcpHasScope(mcp, "documents:read")) {
    return c.json({ error: "insufficient_scope" }, 403);
  }

  const organizationId = mcp.organizationId;
  if (!organizationId) {
    return c.json({ error: "organization_required" }, 403);
  }

  const query = c.req.query();
  const id = query.id;
  if (!id) {
    return c.json({ error: "missing_document_id" }, 400);
  }

  const includeRecipients = query.include_recipients === "true";

  const db = createD1(c.env.D1);
  const rows = await db
    .select({
      id: documents.id,
      name: documents.name,
      description: documents.description,
      status: documents.status,
      createdAt: documents.createdAt,
      updatedAt: documents.updatedAt,
      deadline: documents.deadline,
      storageKey: documents.storageKey,
      documentStatus: documents.documentStatus,
    })
    .from(documents)
    .where(
      and(eq(documents.id, id), eq(documents.organizationId, organizationId))
    )
    .limit(1);

  const row = rows[0];
  if (!row || row.documentStatus === "deleted") {
    return c.json({ error: "not_found" }, 404);
  }

  const counts = await recipientCountsForDocument(db, row.id);
  const response = toApiDocument(row, counts);

  if (includeRecipients) {
    const recipientRows = await db
      .select({
        id: recipients.id,
        email: recipients.email,
        name: recipients.name,
        role: recipients.role,
        order: recipients.order,
        status: recipients.status,
        viewedAt: recipients.viewedAt,
        signedAt: recipients.signedAt,
        approvedAt: recipients.approvedAt,
        declinedAt: recipients.declinedAt,
        signatureData: recipients.signatureData,
      })
      .from(recipients)
      .where(eq(recipients.documentId, row.id));

    response.recipients = recipientRows.map(toApiRecipient);
  }

  return c.json(response);
});

export default app;
