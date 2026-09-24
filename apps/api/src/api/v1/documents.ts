import { OpenAPIHono } from "@hono/zod-openapi";
import {
  and,
  desc,
  eq,
  gt,
  gte,
  inArray,
  isNull,
  like,
  lt,
  ne,
  or,
  type SQL,
} from "drizzle-orm";
import type { Context } from "hono";
import { z } from "zod";

import { createD1 } from "../../global/db.js";
import {
  aiFieldSuggestions,
  documents,
  folders,
  organization,
  recipients,
  signatureFields,
} from "../../global/schema.js";
import {
  fieldCandidateSchema,
  parseDocumentFromStorage,
} from "../../platform/anydoc.js";
import {
  getAuditActor,
  getAuditRequestMeta,
  writeAuditLog,
} from "../../platform/audit-log.js";
import { validateFieldGeometry } from "../../platform/field-geometry.js";
import {
  mergeFieldProperties,
  parseFieldProperties,
  readBindingKey,
} from "../../platform/field-properties.js";
import {
  applySuggestionItems,
  candidatesToSuggestionItems,
  createDocumentField,
  materializeSuggestionsFromCandidates,
  suggestionItemSchema,
} from "../../platform/field-suggestions.js";
import { mcpHasScope, type McpAccessToken } from "../../platform/mcp-auth.js";
import { buildSigningUrl } from "../../platform/email.js";
import { buildSigningInteraction } from "../../platform/interaction-session.js";
import { recordUsageEvent } from "../../platform/usage-events.js";
import { emitWebhookEvent } from "../../platform/webhook-events.js";
import { sendDocumentForSigning } from "../document-send.js";
import documentAgentRoutes from "./document-agent.js";
import { materializeAnnotationsFromParsedText } from "./document-agent.js";
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
  folder_id?: string | null;
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

async function folderPublicIdMap(
  db: ReturnType<typeof createD1>,
  organizationId: string,
  folderIds: (string | null | undefined)[]
): Promise<Map<string, string>> {
  const ids = [
    ...new Set(
      folderIds.filter((id): id is string => typeof id === "string" && id.length > 0)
    ),
  ];
  const map = new Map<string, string>();
  if (ids.length === 0) return map;
  const rows = await db
    .select({ id: folders.id, publicId: folders.publicId })
    .from(folders)
    .where(
      and(eq(folders.organizationId, organizationId), inArray(folders.id, ids))
    );
  for (const row of rows) {
    map.set(row.id, row.publicId);
  }
  return map;
}

async function resolveFolderInternalId(
  db: ReturnType<typeof createD1>,
  organizationId: string,
  folderPublicId: string
): Promise<string | null> {
  const rows = await db
    .select({ id: folders.id })
    .from(folders)
    .where(
      and(
        eq(folders.publicId, folderPublicId),
        eq(folders.organizationId, organizationId),
        eq(folders.type, "document")
      )
    )
    .limit(1);
  return rows[0]?.id ?? null;
}

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
  counts: { total: number; signed: number },
  folderPublicId?: string | null
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
    ...(folderPublicId !== undefined ? { folder_id: folderPublicId } : {}),
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
  const folderPublicId = query.folder_id;

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
  if (folderPublicId === "null" || folderPublicId === "") {
    conditions.push(isNull(documents.folderId));
  } else if (folderPublicId) {
    const folderInternalId = await resolveFolderInternalId(
      db,
      organizationId,
      folderPublicId
    );
    if (!folderInternalId) {
      return c.json({ documents: [], has_more: false });
    }
    conditions.push(eq(documents.folderId, folderInternalId));
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
      folderId: documents.folderId,
    })
    .from(documents)
    .where(and(...conditions))
    .orderBy(desc(documents.createdAt), desc(documents.id))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const resultRows = hasMore ? rows.slice(0, limit) : rows;

  const folderMap = await folderPublicIdMap(
    db,
    organizationId,
    resultRows.map((row) => row.folderId)
  );

  const apiDocuments: ApiDocument[] = await Promise.all(
    resultRows.map(async (row) => {
      const counts = await recipientCountsForDocument(db, row.id);
      return toApiDocument(
        row,
        counts,
        row.folderId ? (folderMap.get(row.folderId) ?? null) : null
      );
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
      folderId: documents.folderId,
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
  const folderMap = await folderPublicIdMap(db, organizationId, [row.folderId]);
  const response = toApiDocument(
    row,
    counts,
    row.folderId ? (folderMap.get(row.folderId) ?? null) : null
  );

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

/**
 * InteractionSession for document signing (ADR-004 / SEA-61).
 * Agents open `url` (or show it) and poll this endpoint until status is terminal.
 */
app.get("/interaction", async (c) => {
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
      status: documents.status,
      deadline: documents.deadline,
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

  let signingUrl: string | null = null;
  if (mcpHasScope(mcp, "documents:write")) {
    const recipientRows = await db
      .select({
        signingToken: recipients.signingToken,
        status: recipients.status,
        order: recipients.order,
      })
      .from(recipients)
      .where(eq(recipients.documentId, row.id));

    const openRecipient = recipientRows.find(
      (r) =>
        r.signingToken &&
        r.status !== "signed" &&
        r.status !== "approved" &&
        r.status !== "declined"
    );
    const anyWithToken = recipientRows.find((r) => r.signingToken);
    const token = openRecipient?.signingToken ?? anyWithToken?.signingToken;
    if (token) {
      signingUrl = buildSigningUrl(c.env, token);
    }
  }

  const session = buildSigningInteraction({
    documentId: row.id,
    documentStatus: row.status,
    title: row.name,
    signingUrl,
    expiresAt: row.deadline ? row.deadline.toISOString() : null,
  });

  return c.json(session);
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
  folder_id: z.string().nullable().optional(),
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
    folder_id,
  } = parsed.data;

  const object = await c.env.DOCUMENTS_BUCKET.get(storage_id);
  if (!object) {
    return c.json({ error: "storage_id_not_found" }, 400);
  }

  const parsedDocument = await parseDocumentFromStorage(c.env, storage_id);
  const originalStorageKey =
    object.customMetadata?.originalKey ?? null;
  const originalContentType =
    object.customMetadata?.originalContentType ?? null;
  const db = createD1(c.env.D1);

  let folderInternalId: string | null = null;
  let folderPublicId: string | null = null;
  if (folder_id) {
    folderInternalId = await resolveFolderInternalId(
      db,
      organizationId,
      folder_id
    );
    if (!folderInternalId) {
      return c.json({ error: "folder_not_found" }, 404);
    }
    folderPublicId = folder_id;
  }

  const docId = crypto.randomUUID();
  const inserted = await db
    .insert(documents)
    .values({
      id: docId,
      publicId: crypto.randomUUID(),
      organizationId,
      ownerId: mcp.sub,
      folderId: folderInternalId,
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
      originalStorageKey,
      originalContentType,
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

  if (parsedDocument?.fieldCandidates.length) {
    await materializeSuggestionsFromCandidates(db, {
      documentId: docId,
      organizationId,
      candidatesJson: JSON.stringify(parsedDocument.fieldCandidates),
    });
  }
  if (parsedDocument?.markdown) {
    await materializeAnnotationsFromParsedText(db, {
      documentId: docId,
      organizationId,
      parsedText: parsedDocument.markdown,
    });
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
      ...getAuditRequestMeta(c),
    });
  }

  return c.json(toApiDocument(row, { total: 0, signed: 0 }, folderPublicId));
});

const updateDocumentSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().optional(),
  deadline: deadlineSchema.optional(),
  folder_id: z.string().nullable().optional(),
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

  const { title, description, deadline, folder_id } = parsed.data;

  const db = createD1(c.env.D1);
  const updateValues: {
    name?: string;
    description?: string | null;
    deadline?: Date | null;
    folderId?: string | null;
  } = {};
  if (title !== undefined) updateValues.name = title;
  if (description !== undefined) updateValues.description = description ?? null;
  if (deadline !== undefined) updateValues.deadline = parseDeadline(deadline);
  let folderPublicId: string | null | undefined;
  if (folder_id === null) {
    updateValues.folderId = null;
    folderPublicId = null;
  } else if (folder_id !== undefined) {
    const folderInternalId = await resolveFolderInternalId(
      db,
      organizationId,
      folder_id
    );
    if (!folderInternalId) {
      return c.json({ error: "folder_not_found" }, 404);
    }
    updateValues.folderId = folderInternalId;
    folderPublicId = folder_id;
  }

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
      folderId: documents.folderId,
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

  const actor = getAuditActor({ mcp: c.get("mcp") });
  if (actor) {
    await writeAuditLog(db, {
      organizationId,
      actor,
      action: "document.update",
      resourceType: "document",
      resourceId: id,
      metadata: {
        publicId: row.publicId,
        fields: Object.keys(updateValues),
      },
      ...getAuditRequestMeta(c),
    });
  }

  const counts = await recipientCountsForDocument(db, row.id);
  if (folderPublicId === undefined) {
    const folderMap = await folderPublicIdMap(db, organizationId, [
      row.folderId,
    ]);
    folderPublicId = row.folderId
      ? (folderMap.get(row.folderId) ?? null)
      : null;
  }
  return c.json(toApiDocument(row, counts, folderPublicId));
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
    .select({
      id: documents.id,
      publicId: documents.publicId,
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
    return c.json({ error: "only_draft_documents_can_be_deleted" }, 400);
  }

  await db
    .update(documents)
    .set({ documentStatus: "deleted" })
    .where(
      and(eq(documents.id, id), eq(documents.organizationId, organizationId))
    );

  const actor = getAuditActor({ mcp: c.get("mcp") });
  if (actor) {
    await writeAuditLog(db, {
      organizationId,
      actor,
      action: "document.delete",
      resourceType: "document",
      resourceId: row.id,
      metadata: { publicId: row.publicId, previousStatus: row.status },
      ...getAuditRequestMeta(c),
    });
  }

  return c.json({ success: true });
}

app.post("/delete", async (c) => handleDeleteDocument(c));
app.delete("/delete", async (c) => handleDeleteDocument(c));

const sendDocumentBodySchema = z.object({
  notify: z.boolean().optional(),
  expires_in_days: z.number().int().positive().max(365).optional(),
});

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
  if (row.status !== "draft" && row.status !== "expired") {
    return c.json({ error: "document_not_in_draft_status" }, 400);
  }

  const recipientRows = await db
    .select({ id: recipients.id })
    .from(recipients)
    .where(eq(recipients.documentId, id));
  if (recipientRows.length === 0) {
    return c.json({ error: "document_has_no_recipients" }, 400);
  }

  const rawBody: unknown = await c.req.json().catch(() => undefined);
  const parsedBody = sendDocumentBodySchema.safeParse(rawBody ?? {});
  if (!parsedBody.success) {
    return c.json({ error: "validation_error" }, 400);
  }
  const notify = parsedBody.data.notify ?? true;
  const expirationMs = parsedBody.data.expires_in_days
    ? parsedBody.data.expires_in_days * 24 * 60 * 60 * 1000
    : undefined;

  const orgRows = await db
    .select({ name: organization.name })
    .from(organization)
    .where(eq(organization.id, organizationId))
    .limit(1);
  const senderName = orgRows[0]?.name ?? "your team";

  const {
    sentAt,
    deadline,
    recipients: sentRecipients,
  } = await sendDocumentForSigning(db, c.env, {
    documentId: id,
    documentName: row.name,
    senderName,
    expirationMs,
    notify,
  });

  await recordUsageEvent(db, {
    organizationId,
    eventType: "document.sent",
    metadata: { documentId: row.id, publicId: row.publicId },
  });

  const actor = getAuditActor({ mcp: c.get("mcp") });
  if (actor) {
    await writeAuditLog(db, {
      organizationId,
      actor,
      action: "document.sent",
      resourceType: "document",
      resourceId: row.id,
      metadata: {
        publicId: row.publicId,
        recipientCount: sentRecipients.length,
      },
      ...getAuditRequestMeta(c),
    });
  }

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

  return c.json({
    success: true,
    sent_at: sentAt.getTime(),
    deadline: deadline.getTime(),
    recipients: sentRecipients.map((r) => ({
      id: r.id,
      email: r.email,
      name: r.name,
      signing_url: r.signingUrl,
      expires_at: deadline.getTime(),
      ...(notify ? { email_sent: r.emailSent } : {}),
    })),
  });
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
    .select({
      id: documents.id,
      publicId: documents.publicId,
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
  if (row.status === "completed" || row.status === "voided") {
    return c.json({ error: "document_cannot_be_voided" }, 400);
  }

  await db
    .update(documents)
    .set({ status: "voided" })
    .where(
      and(eq(documents.id, id), eq(documents.organizationId, organizationId))
    );

  const actor = getAuditActor({ mcp: c.get("mcp") });
  if (actor) {
    await writeAuditLog(db, {
      organizationId,
      actor,
      action: "document.voided",
      resourceType: "document",
      resourceId: row.id,
      metadata: { publicId: row.publicId, previousStatus: row.status },
      ...getAuditRequestMeta(c),
    });
  }

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
  const rows = await db
    .select({
      id: documents.id,
      publicId: documents.publicId,
      sharingMode: documents.sharingMode,
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

  const actor = getAuditActor({ mcp: c.get("mcp") });
  if (actor) {
    await writeAuditLog(db, {
      organizationId,
      actor,
      action: "document.sharing_updated",
      resourceType: "document",
      resourceId: row.id,
      metadata: {
        publicId: row.publicId,
        previous: row.sharingMode ?? "private",
        sharingMode: parsed.data.sharing_mode,
      },
      ...getAuditRequestMeta(c),
    });
  }

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

  const actor = getAuditActor({ mcp: c.get("mcp") });

  const results = await Promise.all(
    document_ids.map(async (id) => {
      const rows = await db
        .select({
          id: documents.id,
          publicId: documents.publicId,
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

      if (actor) {
        await writeAuditLog(db, {
          organizationId,
          actor,
          action: "document.voided",
          resourceType: "document",
          resourceId: row.id,
          metadata: { publicId: row.publicId, previousStatus: row.status },
          ...getAuditRequestMeta(c),
        });
      }

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

  const actor = getAuditActor({ mcp: c.get("mcp") });

  const results = await Promise.all(
    document_ids.map(async (id) => {
      const rows = await db
        .select({
          id: documents.id,
          publicId: documents.publicId,
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

      if (actor) {
        await writeAuditLog(db, {
          organizationId,
          actor,
          action: "document.sent",
          resourceType: "document",
          resourceId: row.id,
          metadata: {
            publicId: row.publicId,
            recipientCount: recipientRows.length,
          },
          ...getAuditRequestMeta(c),
        });
      }

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

const applyBindingsSchema = z.object({
  id: z.string().min(1),
  bindings: z.record(z.string(), z.string()),
});

/**
 * Apply structured values onto document fields by `properties.binding_key`.
 * Sets `default_value` so the deal writes the document (GitHub #604) without OCR.
 */
app.post("/apply-bindings", async (c) => {
  const mcp = c.get("mcp");
  if (!mcpHasScope(mcp, "documents:write")) {
    return c.json({ error: "insufficient_scope" }, 403);
  }

  const organizationId = mcp.organizationId;
  if (!organizationId) {
    return c.json({ error: "organization_required" }, 403);
  }

  const rawBody: unknown = await c.req.json();
  const parsed = applyBindingsSchema.safeParse(rawBody);
  if (!parsed.success) {
    return c.json({ error: "validation_error" }, 400);
  }

  const { id, bindings } = parsed.data;
  const db = createD1(c.env.D1);

  const docRows = await db
    .select({ id: documents.id, status: documents.status })
    .from(documents)
    .where(
      and(
        eq(documents.id, id),
        eq(documents.organizationId, organizationId),
        ne(documents.documentStatus, "deleted")
      )
    )
    .limit(1);
  const doc = docRows[0];
  if (!doc) {
    return c.json({ error: "not_found" }, 404);
  }
  if (doc.status !== "draft") {
    return c.json({ error: "document_not_editable" }, 400);
  }

  const fields = await db
    .select({
      id: signatureFields.id,
      properties: signatureFields.properties,
    })
    .from(signatureFields)
    .where(eq(signatureFields.documentId, id));

  let updated = 0;
  const unmatched = new Set(Object.keys(bindings));

  for (const field of fields) {
    const key = readBindingKey(field.properties);
    if (!key || !(key in bindings)) continue;
    unmatched.delete(key);
    const next = mergeFieldProperties(field.properties, {
      default_value: bindings[key],
    });
    await db
      .update(signatureFields)
      .set({ properties: next })
      .where(eq(signatureFields.id, field.id));
    updated += 1;
  }

  return c.json({
    updated,
    unmatched_keys: Array.from(unmatched),
  });
});

app.get("/fields", async (c) => {
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
  const docRows = await db
    .select({ id: documents.id })
    .from(documents)
    .where(
      and(
        eq(documents.id, id),
        eq(documents.organizationId, organizationId),
        ne(documents.documentStatus, "deleted")
      )
    )
    .limit(1);
  if (!docRows[0]) {
    return c.json({ error: "not_found" }, 404);
  }

  const fields = await db
    .select({
      id: signatureFields.id,
      fieldType: signatureFields.fieldType,
      label: signatureFields.label,
      isRequired: signatureFields.isRequired,
      page: signatureFields.page,
      x: signatureFields.x,
      y: signatureFields.y,
      width: signatureFields.width,
      height: signatureFields.height,
      properties: signatureFields.properties,
    })
    .from(signatureFields)
    .where(eq(signatureFields.documentId, id));

  return c.json({
    fields: fields.map((field) => {
      const properties = parseFieldProperties(field.properties) ?? {};
      return {
        id: field.id,
        field_type: field.fieldType,
        label: field.label,
        is_required: field.isRequired,
        page: field.page,
        x: field.x,
        y: field.y,
        width: field.width,
        height: field.height,
        properties,
        binding_key: properties.binding_key ?? null,
      };
    }),
  });
});


const placeableFieldTypeSchema = z.enum([
  "signature",
  "text",
  "number",
  "date",
  "checkbox",
  "dropdown",
  "radio",
  "attachment",
  "payment",
]);

const createFieldSchema = z.object({
  id: z.string().min(1),
  field_type: placeableFieldTypeSchema,
  label: z.string().min(1),
  is_required: z.boolean().optional().default(true),
  page: z.number().int().min(1),
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number(),
  recipient_id: z.string().optional(),
  binding_key: z.string().optional(),
  properties: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Create a signature/data field on a draft document (agent placement).
 * Coordinates are percent-of-page (0–100), same as the web editor.
 */
app.post("/fields", async (c) => {
  const mcp = c.get("mcp");
  if (!mcpHasScope(mcp, "documents:write")) {
    return c.json({ error: "insufficient_scope" }, 403);
  }
  const organizationId = mcp.organizationId;
  if (!organizationId) {
    return c.json({ error: "organization_required" }, 403);
  }

  const rawBody: unknown = await c.req.json();
  const parsed = createFieldSchema.safeParse(rawBody);
  if (!parsed.success) {
    return c.json({ error: "validation_error" }, 400);
  }

  const input = parsed.data;
  const db = createD1(c.env.D1);
  const docRows = await db
    .select({
      id: documents.id,
      status: documents.status,
      pageCount: documents.pageCount,
    })
    .from(documents)
    .where(
      and(
        eq(documents.id, input.id),
        eq(documents.organizationId, organizationId),
        ne(documents.documentStatus, "deleted")
      )
    )
    .limit(1);
  const doc = docRows[0];
  if (!doc) {
    return c.json({ error: "not_found" }, 404);
  }
  if (doc.status !== "draft") {
    return c.json({ error: "document_not_editable" }, 400);
  }

  let recipientId: string | null = null;
  if (input.recipient_id) {
    const recipientRows = await db
      .select({ id: recipients.id })
      .from(recipients)
      .where(
        and(
          eq(recipients.id, input.recipient_id),
          eq(recipients.documentId, doc.id)
        )
      )
      .limit(1);
    if (!recipientRows[0]) {
      return c.json({ error: "recipient_not_found" }, 404);
    }
    recipientId = recipientRows[0].id;
  }

  const properties: Record<string, unknown> = {
    ...(input.properties ?? {}),
  };
  if (input.binding_key) {
    properties.binding_key = input.binding_key;
  }
  const propertiesJson =
    Object.keys(properties).length > 0 ? JSON.stringify(properties) : null;

  const created = await createDocumentField(db, {
    documentId: doc.id,
    pageCount: doc.pageCount,
    fieldType: input.field_type,
    label: input.label,
    isRequired: input.is_required,
    page: input.page,
    x: input.x,
    y: input.y,
    width: input.width,
    height: input.height,
    recipientId,
    propertiesJson,
  });
  if ("error" in created) {
    return c.json({ error: created.error }, created.status);
  }

  return c.json(
    {
      id: created.id,
      public_id: created.publicId,
      field_type: input.field_type,
      label: input.label,
      is_required: input.is_required,
      page: input.page,
      x: input.x,
      y: input.y,
      width: input.width,
      height: input.height,
      binding_key: input.binding_key ?? null,
    },
    201
  );
});

const updateFieldSchema = z.object({
  id: z.string().min(1),
  field_id: z.string().min(1),
  label: z.string().min(1).optional(),
  is_required: z.boolean().optional(),
  page: z.number().int().min(1).optional(),
  x: z.number().optional(),
  y: z.number().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  recipient_id: z.string().nullable().optional(),
  binding_key: z.string().nullable().optional(),
  properties: z.record(z.string(), z.unknown()).optional(),
});

app.put("/fields/update", async (c) => {
  const mcp = c.get("mcp");
  if (!mcpHasScope(mcp, "documents:write")) {
    return c.json({ error: "insufficient_scope" }, 403);
  }
  const organizationId = mcp.organizationId;
  if (!organizationId) {
    return c.json({ error: "organization_required" }, 403);
  }

  const rawBody: unknown = await c.req.json();
  const parsed = updateFieldSchema.safeParse(rawBody);
  if (!parsed.success) {
    return c.json({ error: "validation_error" }, 400);
  }
  const input = parsed.data;
  const db = createD1(c.env.D1);

  const docRows = await db
    .select({ id: documents.id, status: documents.status })
    .from(documents)
    .where(
      and(
        eq(documents.id, input.id),
        eq(documents.organizationId, organizationId),
        ne(documents.documentStatus, "deleted")
      )
    )
    .limit(1);
  const doc = docRows[0];
  if (!doc) {
    return c.json({ error: "not_found" }, 404);
  }
  if (doc.status !== "draft") {
    return c.json({ error: "document_not_editable" }, 400);
  }

  const fieldRows = await db
    .select()
    .from(signatureFields)
    .where(
      and(
        eq(signatureFields.id, input.field_id),
        eq(signatureFields.documentId, doc.id)
      )
    )
    .limit(1);
  const field = fieldRows[0];
  if (!field) {
    return c.json({ error: "field_not_found" }, 404);
  }

  const nextX = input.x ?? field.x;
  const nextY = input.y ?? field.y;
  const nextW = input.width ?? field.width;
  const nextH = input.height ?? field.height;
  const geo = {
    x: nextX,
    y: nextY,
    width: nextW,
    height: nextH,
  };
  // reuse createDocumentField geometry check via candidates helper
  const check = validateFieldGeometry(geo);
  if (!check.valid) {
    return c.json({ error: check.error }, 400);
  }

  let properties = field.properties;
  if (input.properties || input.binding_key !== undefined) {
    const base = parseFieldProperties(field.properties) ?? {};
    const merged = {
      ...base,
      ...(input.properties ?? {}),
    };
    if (input.binding_key === null) {
      delete merged.binding_key;
    } else if (typeof input.binding_key === "string") {
      merged.binding_key = input.binding_key;
    }
    properties = JSON.stringify(merged);
  }

  let recipientId = field.recipientId;
  if (input.recipient_id === null) {
    recipientId = null;
  } else if (typeof input.recipient_id === "string") {
    const recipientRows = await db
      .select({ id: recipients.id })
      .from(recipients)
      .where(
        and(
          eq(recipients.id, input.recipient_id),
          eq(recipients.documentId, doc.id)
        )
      )
      .limit(1);
    if (!recipientRows[0]) {
      return c.json({ error: "recipient_not_found" }, 404);
    }
    recipientId = recipientRows[0].id;
  }

  await db
    .update(signatureFields)
    .set({
      label: input.label ?? field.label,
      isRequired: input.is_required ?? field.isRequired,
      page: input.page ?? field.page,
      x: nextX,
      y: nextY,
      width: nextW,
      height: nextH,
      recipientId,
      properties,
      updatedAt: new Date(),
    })
    .where(eq(signatureFields.id, field.id));

  return c.json({ success: true });
});

const deleteFieldSchema = z.object({
  id: z.string().min(1),
  field_id: z.string().min(1),
});

app.post("/fields/delete", async (c) => {
  const mcp = c.get("mcp");
  if (!mcpHasScope(mcp, "documents:write")) {
    return c.json({ error: "insufficient_scope" }, 403);
  }
  const organizationId = mcp.organizationId;
  if (!organizationId) {
    return c.json({ error: "organization_required" }, 403);
  }

  const rawBody: unknown = await c.req.json();
  const parsed = deleteFieldSchema.safeParse(rawBody);
  if (!parsed.success) {
    return c.json({ error: "validation_error" }, 400);
  }

  const db = createD1(c.env.D1);
  const docRows = await db
    .select({ id: documents.id, status: documents.status })
    .from(documents)
    .where(
      and(
        eq(documents.id, parsed.data.id),
        eq(documents.organizationId, organizationId),
        ne(documents.documentStatus, "deleted")
      )
    )
    .limit(1);
  const doc = docRows[0];
  if (!doc) {
    return c.json({ error: "not_found" }, 404);
  }
  if (doc.status !== "draft") {
    return c.json({ error: "document_not_editable" }, 400);
  }

  await db
    .delete(signatureFields)
    .where(
      and(
        eq(signatureFields.id, parsed.data.field_id),
        eq(signatureFields.documentId, doc.id)
      )
    );

  return c.json({ success: true });
});

const placeCandidatesSchema = z.object({
  id: z.string().min(1),
  indices: z.array(z.number().int()).optional(),
  recipient_id: z.string().optional(),
});

/**
 * Place fields from stored `field_candidates` (anydoc heuristics with bbox).
 * Extend-inspired: agents apply detected zones without a UI click loop.
 */
app.post("/place-candidates", async (c) => {
  const mcp = c.get("mcp");
  if (!mcpHasScope(mcp, "documents:write")) {
    return c.json({ error: "insufficient_scope" }, 403);
  }
  const organizationId = mcp.organizationId;
  if (!organizationId) {
    return c.json({ error: "organization_required" }, 403);
  }

  const rawBody: unknown = await c.req.json();
  const parsed = placeCandidatesSchema.safeParse(rawBody);
  if (!parsed.success) {
    return c.json({ error: "validation_error" }, 400);
  }

  const db = createD1(c.env.D1);
  const docRows = await db
    .select({
      id: documents.id,
      status: documents.status,
      pageCount: documents.pageCount,
      fieldCandidates: documents.fieldCandidates,
    })
    .from(documents)
    .where(
      and(
        eq(documents.id, parsed.data.id),
        eq(documents.organizationId, organizationId),
        ne(documents.documentStatus, "deleted")
      )
    )
    .limit(1);
  const doc = docRows[0];
  if (!doc) {
    return c.json({ error: "not_found" }, 404);
  }
  if (doc.status !== "draft") {
    return c.json({ error: "document_not_editable" }, 400);
  }
  if (!doc.fieldCandidates) {
    return c.json({ error: "no_candidates" }, 400);
  }

  let raw: unknown;
  try {
    raw = JSON.parse(doc.fieldCandidates) as unknown;
  } catch {
    return c.json({ error: "invalid_candidates" }, 400);
  }
  if (!Array.isArray(raw)) {
    return c.json({ error: "invalid_candidates" }, 400);
  }

  const items = candidatesToSuggestionItems(
    raw as Parameters<typeof candidatesToSuggestionItems>[0]
  );
  const result = await applySuggestionItems(db, {
    documentId: doc.id,
    pageCount: doc.pageCount,
    items,
    selectedFieldIndices: parsed.data.indices,
  });

  if (parsed.data.recipient_id && result.fieldIds.length > 0) {
    const recipientRows = await db
      .select({ id: recipients.id })
      .from(recipients)
      .where(
        and(
          eq(recipients.id, parsed.data.recipient_id),
          eq(recipients.documentId, doc.id)
        )
      )
      .limit(1);
    if (recipientRows[0]) {
      for (const fieldId of result.fieldIds) {
        await db
          .update(signatureFields)
          .set({ recipientId: recipientRows[0].id, updatedAt: new Date() })
          .where(eq(signatureFields.id, fieldId));
      }
    }
  }

  return c.json(result);
});

app.get("/field-suggestions", async (c) => {
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
  const docRows = await db
    .select({
      id: documents.id,
      fieldCandidates: documents.fieldCandidates,
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
  const doc = docRows[0];
  if (!doc) {
    return c.json({ error: "not_found" }, 404);
  }

  const rows = await db
    .select()
    .from(aiFieldSuggestions)
    .where(
      and(
        eq(aiFieldSuggestions.documentId, doc.id),
        eq(aiFieldSuggestions.status, "pending")
      )
    )
    .orderBy(desc(aiFieldSuggestions.createdAt))
    .limit(1);

  let row = rows[0];
  if (!row) {
    const materialized = await materializeSuggestionsFromCandidates(db, {
      documentId: doc.id,
      organizationId,
      candidatesJson: doc.fieldCandidates,
    });
    if (!materialized) {
      return c.json({ suggestions: null });
    }
    return c.json({
      suggestions: {
        id: materialized.id,
        public_id: materialized.publicId,
        fields: materialized.fields,
        model_used: materialized.modelUsed,
        status: materialized.status,
      },
    });
  }

  let fields: unknown;
  try {
    fields = JSON.parse(row.fields) as unknown;
  } catch {
    fields = [];
  }

  return c.json({
    suggestions: {
      id: row.id,
      public_id: row.publicId,
      fields,
      model_used: row.modelUsed,
      status: row.status,
    },
  });
});

const applySuggestionsSchema = z.object({
  id: z.string().min(1),
  suggestion_id: z.string().min(1),
  selected_indices: z.array(z.number().int()).optional(),
});

app.post("/field-suggestions/apply", async (c) => {
  const mcp = c.get("mcp");
  if (!mcpHasScope(mcp, "documents:write")) {
    return c.json({ error: "insufficient_scope" }, 403);
  }
  const organizationId = mcp.organizationId;
  if (!organizationId) {
    return c.json({ error: "organization_required" }, 403);
  }

  const rawBody: unknown = await c.req.json();
  const parsed = applySuggestionsSchema.safeParse(rawBody);
  if (!parsed.success) {
    return c.json({ error: "validation_error" }, 400);
  }

  const db = createD1(c.env.D1);
  const docRows = await db
    .select({
      id: documents.id,
      status: documents.status,
      pageCount: documents.pageCount,
    })
    .from(documents)
    .where(
      and(
        eq(documents.id, parsed.data.id),
        eq(documents.organizationId, organizationId),
        ne(documents.documentStatus, "deleted")
      )
    )
    .limit(1);
  const doc = docRows[0];
  if (!doc) {
    return c.json({ error: "not_found" }, 404);
  }
  if (doc.status !== "draft") {
    return c.json({ error: "document_not_editable" }, 400);
  }

  const suggestionRows = await db
    .select()
    .from(aiFieldSuggestions)
    .where(
      and(
        eq(aiFieldSuggestions.publicId, parsed.data.suggestion_id),
        eq(aiFieldSuggestions.documentId, doc.id),
        eq(aiFieldSuggestions.status, "pending")
      )
    )
    .limit(1);
  const suggestion = suggestionRows[0];
  if (!suggestion) {
    return c.json({ error: "suggestion_not_found" }, 404);
  }

  let rawFields: unknown;
  try {
    rawFields = JSON.parse(suggestion.fields) as unknown;
  } catch {
    return c.json({ error: "invalid_suggestion" }, 400);
  }
  const fieldsParsed = suggestionItemSchema.array().safeParse(rawFields);
  if (!fieldsParsed.success) {
    return c.json({ error: "invalid_suggestion" }, 400);
  }

  const result = await applySuggestionItems(db, {
    documentId: doc.id,
    pageCount: doc.pageCount,
    items: fieldsParsed.data,
    selectedFieldIndices: parsed.data.selected_indices,
  });

  await db
    .update(aiFieldSuggestions)
    .set({ status: "applied", updatedAt: new Date() })
    .where(eq(aiFieldSuggestions.id, suggestion.id));

  return c.json(result);
});


app.route("/", documentAgentRoutes);

export default app;
