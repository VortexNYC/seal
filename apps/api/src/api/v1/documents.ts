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
import type { Context } from "hono";
import { z } from "zod";

import { createD1 } from "../../global/db.js";
import { documents, recipients } from "../../global/schema.js";
import {
  fieldCandidateSchema,
  parseDocumentFromStorage,
} from "../../platform/anydoc.js";
import { getAuditActor, writeAuditLog } from "../../platform/audit-log.js";
import { mcpHasScope, type McpAccessToken } from "../../platform/mcp-auth.js";
import { emitWebhookEvent } from "../../platform/webhook-events.js";
import { createDownloadToken, verifyDownloadToken } from "./download-token.js";

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
  page_count?: number;
  ocr_required?: boolean;
  pages_needing_ocr?: number[];
  parsed_format?: string;
  pdf_type?: string;
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

function parseNumberArray(
  value: string | null | undefined
): number[] | undefined {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(value) as unknown;
    if (Array.isArray(parsed)) {
      const numbers: number[] = [];
      for (const item of parsed) {
        if (typeof item === "number") numbers.push(item);
      }
      return numbers;
    }
  } catch {
    // ignore malformed JSON
  }
  return undefined;
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
    pageCount?: number | null;
    ocrRequired?: boolean;
    pagesNeedingOcr?: string | null;
    parsedFormat?: string | null;
    pdfType?: string | null;
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
    ...(row.pageCount !== null && row.pageCount !== undefined
      ? { page_count: row.pageCount }
      : {}),
    ...(row.ocrRequired !== undefined ? { ocr_required: row.ocrRequired } : {}),
    ...(row.pagesNeedingOcr
      ? { pages_needing_ocr: parseNumberArray(row.pagesNeedingOcr) }
      : {}),
    ...(row.parsedFormat ? { parsed_format: row.parsedFormat } : {}),
    ...(row.pdfType ? { pdf_type: row.pdfType } : {}),
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

app.get("/parsed", async (c) => {
  const mcp = c.get("mcp");
  if (!mcpHasScope(mcp, "documents:read")) {
    return c.json({ error: "insufficient_scope" }, 403);
  }

  const organizationId = mcp.organizationId;
  if (!organizationId) {
    return c.json({ error: "organization_required" }, 403);
  }

  const id = c.req.query("id");
  if (!id) {
    return c.json({ error: "missing_document_id" }, 400);
  }

  const db = createD1(c.env.D1);
  const rows = await db
    .select({
      parsedText: documents.parsedText,
      parsedTitle: documents.parsedTitle,
      parsedFormat: documents.parsedFormat,
      pdfType: documents.pdfType,
      pageCount: documents.pageCount,
      ocrRequired: documents.ocrRequired,
      pagesNeedingOcr: documents.pagesNeedingOcr,
      fieldCandidates: documents.fieldCandidates,
    })
    .from(documents)
    .where(
      and(eq(documents.id, id), eq(documents.organizationId, organizationId))
    )
    .limit(1);

  const row = rows[0];
  if (!row) {
    return c.json({ error: "not_found" }, 404);
  }

  const fieldCandidates = (() => {
    if (!row.fieldCandidates) return [];
    const parsed = z
      .array(fieldCandidateSchema)
      .safeParse(JSON.parse(row.fieldCandidates) as unknown);
    return parsed.success ? parsed.data : [];
  })();

  const pagesNeedingOcr = parseNumberArray(row.pagesNeedingOcr);

  return c.json({
    id,
    parsed_text: row.parsedText,
    parsed_title: row.parsedTitle,
    parsed_format: row.parsedFormat,
    pdf_type: row.pdfType,
    page_count: row.pageCount,
    ocr_required: row.ocrRequired,
    pages_needing_ocr: pagesNeedingOcr,
    field_candidates: fieldCandidates,
  });
});

const deadlineSchema = z.union([
  z.string().datetime(),
  z.number().int().nonnegative(),
]);

function parseDeadline(value: string | number | undefined): Date | undefined {
  if (value === undefined) return undefined;
  if (typeof value === "number") return new Date(value);
  return new Date(value);
}

const createDocumentSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  storage_id: z.string().min(1),
  file_size: z.number().int().nonnegative().optional(),
  file_type: z.string().optional(),
  page_count: z.number().int().nonnegative().optional(),
  deadline: deadlineSchema.optional(),
});

app.post("/", async (c) => {
  const mcp = c.get("mcp");
  if (!mcpHasScope(mcp, "documents:write")) {
    return c.json({ error: "insufficient_scope" }, 403);
  }

  const organizationId = mcp.organizationId;
  if (!organizationId) {
    return c.json({ error: "organization_required" }, 403);
  }

  const rawBody: unknown = await c.req.json();
  const parsed = createDocumentSchema.safeParse(rawBody);
  if (!parsed.success) {
    return c.json({ error: "validation_error" }, 400);
  }

  const {
    title,
    description,
    storage_id,
    file_size,
    file_type,
    page_count,
    deadline,
  } = parsed.data;

  const object = await c.env.DOCUMENTS_BUCKET.get(storage_id);
  if (!object) {
    return c.json({ error: "storage_id_not_found" }, 400);
  }

  const parsedDocument = await parseDocumentFromStorage(c.env, storage_id);
  const db = createD1(c.env.D1);
  const docId = crypto.randomUUID();
  const inserted = await db
    .insert(documents)
    .values({
      id: docId,
      publicId: crypto.randomUUID(),
      organizationId,
      ownerId: mcp.sub,
      name: title,
      description,
      status: "draft",
      documentStatus: "active",
      sharingMode: "private",
      storageKey: storage_id,
      contentType:
        object.httpMetadata?.contentType ??
        file_type ??
        "application/octet-stream",
      size: object.size ?? file_size ?? 0,
      pageCount: page_count ?? parsedDocument?.pageCount,
      parsedText: parsedDocument?.markdown ?? null,
      parsedTitle: parsedDocument?.title ?? null,
      parsedFormat: parsedDocument?.format ?? null,
      pdfType: parsedDocument?.pdfType ?? null,
      ocrRequired: parsedDocument
        ? parsedDocument.pagesNeedingOcr.length > 0
        : false,
      pagesNeedingOcr: parsedDocument?.pagesNeedingOcr.length
        ? JSON.stringify(parsedDocument.pagesNeedingOcr)
        : null,
      fieldCandidates: parsedDocument?.fieldCandidates.length
        ? JSON.stringify(parsedDocument.fieldCandidates)
        : null,
      deadline: parseDeadline(deadline),
    })
    .returning({
      id: documents.id,
      publicId: documents.publicId,
      name: documents.name,
      description: documents.description,
      status: documents.status,
      createdAt: documents.createdAt,
      updatedAt: documents.updatedAt,
      deadline: documents.deadline,
      storageKey: documents.storageKey,
      documentStatus: documents.documentStatus,
      pageCount: documents.pageCount,
      ocrRequired: documents.ocrRequired,
      pagesNeedingOcr: documents.pagesNeedingOcr,
      parsedFormat: documents.parsedFormat,
      pdfType: documents.pdfType,
    });

  const row = inserted[0];
  if (!row) {
    return c.json({ error: "server_error" }, 500);
  }

  const actor = getAuditActor({ mcp: c.get("mcp") });
  if (actor) {
    await writeAuditLog(db, {
      organizationId,
      actor,
      action: "document.create",
      resourceType: "document",
      resourceId: docId,
      metadata: { publicId: row.publicId },
      ipAddress:
        c.req.header("cf-connecting-ip") ?? c.req.header("x-forwarded-for"),
      userAgent: c.req.header("user-agent"),
    });
  }

  return c.json(toApiDocument(row, { total: 0, signed: 0 }));
});

const updateDocumentSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  deadline: deadlineSchema.optional(),
});

async function handleUpdateDocument(
  c: Context<{
    Bindings: CloudflareBindings;
    Variables: { mcp: McpAccessToken };
  }>
) {
  const mcp = c.get("mcp");
  if (!mcpHasScope(mcp, "documents:write")) {
    return c.json({ error: "insufficient_scope" }, 403);
  }

  const organizationId = mcp.organizationId;
  if (!organizationId) {
    return c.json({ error: "organization_required" }, 403);
  }

  const query = c.req.query();
  const rawBody: unknown = await c.req.json();

  const id =
    (typeof query.id === "string" && query.id.length > 0
      ? query.id
      : undefined) ??
    (isRecord(rawBody) && typeof rawBody.id === "string"
      ? rawBody.id
      : undefined);
  if (!id) {
    return c.json({ error: "missing_document_id" }, 400);
  }

  const parsed = updateDocumentSchema.safeParse(rawBody);
  if (!parsed.success) {
    return c.json({ error: "validation_error" }, 400);
  }

  const { title, description, deadline } = parsed.data;

  const db = createD1(c.env.D1);
  const updateValues: {
    name?: string;
    description?: string | null;
    deadline?: Date | null;
  } = {};
  if (title !== undefined) updateValues.name = title;
  if (description !== undefined) updateValues.description = description ?? null;
  if (deadline !== undefined) updateValues.deadline = parseDeadline(deadline);

  await db
    .update(documents)
    .set(updateValues)
    .where(
      and(
        eq(documents.id, id),
        eq(documents.organizationId, organizationId),
        ne(documents.documentStatus, "deleted")
      )
    );

  const rows = await db
    .select({
      id: documents.id,
      publicId: documents.publicId,
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
  return c.json(toApiDocument(row, counts));
}

app.post("/update", async (c) => handleUpdateDocument(c));
app.put("/update", async (c) => handleUpdateDocument(c));

async function resolveDocumentId(
  c: Context<{
    Bindings: CloudflareBindings;
    Variables: { mcp: McpAccessToken };
  }>
): Promise<string | null> {
  const query = c.req.query();
  if (typeof query.id === "string" && query.id.length > 0) {
    return query.id;
  }
  if (c.req.method !== "GET" && c.req.method !== "DELETE") {
    try {
      const rawBody: unknown = await c.req.json();
      if (isRecord(rawBody) && typeof rawBody.id === "string") {
        return rawBody.id;
      }
    } catch {
      // ignore empty body
    }
  }
  return null;
}

async function handleDeleteDocument(
  c: Context<{
    Bindings: CloudflareBindings;
    Variables: { mcp: McpAccessToken };
  }>
) {
  const mcp = c.get("mcp");
  if (!mcpHasScope(mcp, "documents:write")) {
    return c.json({ error: "insufficient_scope" }, 403);
  }

  const organizationId = mcp.organizationId;
  if (!organizationId) {
    return c.json({ error: "organization_required" }, 403);
  }

  const id = await resolveDocumentId(c);
  if (!id) {
    return c.json({ error: "missing_document_id" }, 400);
  }

  const db = createD1(c.env.D1);
  const rows = await db
    .select({ status: documents.status })
    .from(documents)
    .where(
      and(
        eq(documents.id, id),
        eq(documents.organizationId, organizationId),
        ne(documents.documentStatus, "deleted")
      )
    )
    .limit(1);

  const row = rows[0];
  if (!row) {
    return c.json({ error: "not_found" }, 404);
  }
  if (row.status !== "draft") {
    return c.json({ error: "only_draft_documents_can_be_deleted" }, 400);
  }

  await db
    .update(documents)
    .set({ documentStatus: "deleted" })
    .where(
      and(eq(documents.id, id), eq(documents.organizationId, organizationId))
    );

  return c.json({ success: true });
}

app.post("/delete", async (c) => handleDeleteDocument(c));
app.delete("/delete", async (c) => handleDeleteDocument(c));

async function handleSendDocument(
  c: Context<{
    Bindings: CloudflareBindings;
    Variables: { mcp: McpAccessToken };
  }>
) {
  const mcp = c.get("mcp");
  if (!mcpHasScope(mcp, "documents:write")) {
    return c.json({ error: "insufficient_scope" }, 403);
  }

  const organizationId = mcp.organizationId;
  if (!organizationId) {
    return c.json({ error: "organization_required" }, 403);
  }

  const id = await resolveDocumentId(c);
  if (!id) {
    return c.json({ error: "missing_document_id" }, 400);
  }

  const db = createD1(c.env.D1);
  const rows = await db
    .select({
      id: documents.id,
      publicId: documents.publicId,
      name: documents.name,
      status: documents.status,
    })
    .from(documents)
    .where(
      and(
        eq(documents.id, id),
        eq(documents.organizationId, organizationId),
        ne(documents.documentStatus, "deleted")
      )
    )
    .limit(1);

  const row = rows[0];
  if (!row) {
    return c.json({ error: "not_found" }, 404);
  }
  if (row.status !== "draft") {
    return c.json({ error: "document_not_in_draft_status" }, 400);
  }

  const recipientRows = await db
    .select({ id: recipients.id })
    .from(recipients)
    .where(eq(recipients.documentId, id));
  if (recipientRows.length === 0) {
    return c.json({ error: "document_has_no_recipients" }, 400);
  }

  const sentAt = new Date();
  await db
    .update(documents)
    .set({ status: "sent", sentAt })
    .where(
      and(eq(documents.id, id), eq(documents.organizationId, organizationId))
    );

  const emitPromise = emitWebhookEvent(c.env, {
    organizationId,
    eventType: "document.sent",
    payload: {
      documentId: row.id,
      publicId: row.publicId,
      name: row.name,
      sentAt: sentAt.getTime(),
    },
  }).catch((err) => {
    console.error("[webhooks] document.sent emit failed:", err);
  });
  try {
    if (c.executionCtx?.waitUntil) {
      c.executionCtx.waitUntil(emitPromise);
    } else {
      await emitPromise;
    }
  } catch {
    await emitPromise;
  }

  return c.json({ success: true });
}

app.post("/send", async (c) => handleSendDocument(c));

async function handleVoidDocument(
  c: Context<{
    Bindings: CloudflareBindings;
    Variables: { mcp: McpAccessToken };
  }>
) {
  const mcp = c.get("mcp");
  if (!mcpHasScope(mcp, "documents:write")) {
    return c.json({ error: "insufficient_scope" }, 403);
  }

  const organizationId = mcp.organizationId;
  if (!organizationId) {
    return c.json({ error: "organization_required" }, 403);
  }

  const id = await resolveDocumentId(c);
  if (!id) {
    return c.json({ error: "missing_document_id" }, 400);
  }

  const db = createD1(c.env.D1);
  const rows = await db
    .select({ status: documents.status })
    .from(documents)
    .where(
      and(
        eq(documents.id, id),
        eq(documents.organizationId, organizationId),
        ne(documents.documentStatus, "deleted")
      )
    )
    .limit(1);

  const row = rows[0];
  if (!row) {
    return c.json({ error: "not_found" }, 404);
  }
  if (row.status === "completed" || row.status === "voided") {
    return c.json({ error: "document_cannot_be_voided" }, 400);
  }

  await db
    .update(documents)
    .set({ status: "voided" })
    .where(
      and(eq(documents.id, id), eq(documents.organizationId, organizationId))
    );

  return c.json({ success: true });
}

app.post("/void", async (c) => handleVoidDocument(c));

const sharingModeSchema = z.enum(["private", "workspace", "specific"]);

app.get("/access", async (c) => {
  const mcp = c.get("mcp");
  if (!mcpHasScope(mcp, "documents:read")) {
    return c.json({ error: "insufficient_scope" }, 403);
  }

  const organizationId = mcp.organizationId;
  if (!organizationId) {
    return c.json({ error: "organization_required" }, 403);
  }

  const id = c.req.query("id");
  if (!id) {
    return c.json({ error: "missing_document_id" }, 400);
  }

  const db = createD1(c.env.D1);
  const rows = await db
    .select({ sharingMode: documents.sharingMode })
    .from(documents)
    .where(
      and(
        eq(documents.id, id),
        eq(documents.organizationId, organizationId),
        ne(documents.documentStatus, "deleted")
      )
    )
    .limit(1);

  const row = rows[0];
  if (!row) {
    return c.json({ error: "not_found" }, 404);
  }

  return c.json({ sharing_mode: row.sharingMode ?? "private" });
});

app.put("/access", async (c) => {
  const mcp = c.get("mcp");
  if (!mcpHasScope(mcp, "documents:write")) {
    return c.json({ error: "insufficient_scope" }, 403);
  }

  const organizationId = mcp.organizationId;
  if (!organizationId) {
    return c.json({ error: "organization_required" }, 403);
  }

  const id = c.req.query("id");
  if (!id) {
    return c.json({ error: "missing_document_id" }, 400);
  }

  const rawBody: unknown = await c.req.json();
  const parsed = z
    .object({ sharing_mode: sharingModeSchema })
    .safeParse(rawBody);
  if (!parsed.success) {
    return c.json({ error: "validation_error" }, 400);
  }

  const db = createD1(c.env.D1);
  await db
    .update(documents)
    .set({ sharingMode: parsed.data.sharing_mode })
    .where(
      and(
        eq(documents.id, id),
        eq(documents.organizationId, organizationId),
        ne(documents.documentStatus, "deleted")
      )
    );

  return c.json({ success: true });
});

const bulkDocumentIdsSchema = z.object({
  document_ids: z.array(z.string()).max(50),
  reason: z.string().min(1),
});

app.post("/bulk-void", async (c) => {
  const mcp = c.get("mcp");
  if (!mcpHasScope(mcp, "documents:write")) {
    return c.json({ error: "insufficient_scope" }, 403);
  }

  const organizationId = mcp.organizationId;
  if (!organizationId) {
    return c.json({ error: "organization_required" }, 403);
  }

  const rawBody: unknown = await c.req.json();
  const parsed = bulkDocumentIdsSchema.safeParse(rawBody);
  if (!parsed.success) {
    return c.json({ error: "validation_error" }, 400);
  }

  const { document_ids } = parsed.data;
  const db = createD1(c.env.D1);

  const results = await Promise.all(
    document_ids.map(async (id) => {
      const rows = await db
        .select({ status: documents.status })
        .from(documents)
        .where(
          and(
            eq(documents.id, id),
            eq(documents.organizationId, organizationId),
            ne(documents.documentStatus, "deleted")
          )
        )
        .limit(1);

      const row = rows[0];
      if (!row) {
        return { id, success: false, error: "Document not found" };
      }
      if (row.status === "completed" || row.status === "voided") {
        return {
          id,
          success: false,
          error: `Cannot void document with status: ${row.status}`,
        };
      }

      await db
        .update(documents)
        .set({ status: "voided" })
        .where(
          and(
            eq(documents.id, id),
            eq(documents.organizationId, organizationId)
          )
        );

      return { id, success: true };
    })
  );

  const succeeded = results.filter((r) => r.success).length;
  return c.json({
    succeeded,
    failed: results.length - succeeded,
    total_requested: results.length,
    results,
  });
});

const bulkSendSchema = z.object({
  document_ids: z.array(z.string()).max(50),
  message: z.string().optional(),
});

app.post("/bulk-send", async (c) => {
  const mcp = c.get("mcp");
  if (!mcpHasScope(mcp, "documents:write")) {
    return c.json({ error: "insufficient_scope" }, 403);
  }

  const organizationId = mcp.organizationId;
  if (!organizationId) {
    return c.json({ error: "organization_required" }, 403);
  }

  const rawBody: unknown = await c.req.json();
  const parsed = bulkSendSchema.safeParse(rawBody);
  if (!parsed.success) {
    return c.json({ error: "validation_error" }, 400);
  }

  const { document_ids } = parsed.data;
  const db = createD1(c.env.D1);

  const results = await Promise.all(
    document_ids.map(async (id) => {
      const rows = await db
        .select({ status: documents.status })
        .from(documents)
        .where(
          and(
            eq(documents.id, id),
            eq(documents.organizationId, organizationId),
            ne(documents.documentStatus, "deleted")
          )
        )
        .limit(1);

      const row = rows[0];
      if (!row) {
        return { id, success: false, error: "Document not found" };
      }
      if (row.status !== "draft") {
        return {
          id,
          success: false,
          error: `Document is not in draft status (current: ${row.status})`,
        };
      }

      const recipientRows = await db
        .select({ id: recipients.id })
        .from(recipients)
        .where(eq(recipients.documentId, id));
      if (recipientRows.length === 0) {
        return { id, success: false, error: "Document has no recipients" };
      }

      await db
        .update(documents)
        .set({ status: "sent", sentAt: new Date() })
        .where(
          and(
            eq(documents.id, id),
            eq(documents.organizationId, organizationId)
          )
        );

      return { id, success: true };
    })
  );

  const succeeded = results.filter((r) => r.success).length;
  return c.json({
    succeeded,
    failed: results.length - succeeded,
    total_requested: results.length,
    results,
  });
});

app.get("/download", async (c) => {
  const mcp = c.get("mcp");
  if (!mcpHasScope(mcp, "documents:read")) {
    return c.json({ error: "insufficient_scope" }, 403);
  }

  const organizationId = mcp.organizationId;
  if (!organizationId) {
    return c.json({ error: "organization_required" }, 403);
  }

  const id = c.req.query("id");
  if (!id) {
    return c.json({ error: "missing_document_id" }, 400);
  }

  const db = createD1(c.env.D1);
  const rows = await db
    .select({
      id: documents.id,
      name: documents.name,
      storageKey: documents.storageKey,
      status: documents.status,
      documentStatus: documents.documentStatus,
    })
    .from(documents)
    .where(
      and(
        eq(documents.id, id),
        eq(documents.organizationId, organizationId),
        ne(documents.documentStatus, "deleted")
      )
    )
    .limit(1);

  const row = rows[0];
  if (!row || !row.storageKey) {
    return c.json({ error: "not_found" }, 404);
  }

  const token = await createDownloadToken(c.env, {
    userId: mcp.sub,
    organizationId,
    storageKey: row.storageKey,
    documentName: row.name ?? "document.pdf",
  });

  if (!token) {
    return c.json({ error: "token_generation_failed" }, 500);
  }

  const origin = new URL(c.req.url).origin;
  const url = `${origin}/api/v1/documents/download-file?token=${encodeURIComponent(token)}`;

  return c.json({ url });
});

app.get("/download-file", async (c) => {
  const token = c.req.query("token");
  if (!token) {
    return c.json({ error: "missing_token" }, 400);
  }

  const payload = await verifyDownloadToken(c.env, token);
  if (!payload) {
    return c.json({ error: "invalid_token" }, 401);
  }

  const object = await c.env.DOCUMENTS_BUCKET.get(payload.storageKey);
  if (!object) {
    return c.json({ error: "not_found" }, 404);
  }

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set(
    "content-type",
    object.httpMetadata?.contentType ?? "application/pdf"
  );
  const safeName = payload.documentName.replace(/"/g, "'");
  headers.set("content-disposition", `attachment; filename="${safeName}"`);

  return c.body(object.body, { headers });
});

export default app;
