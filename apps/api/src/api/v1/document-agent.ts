/**
 * Agent-power document routes: annotations (bbox citations), preview,
 * PDF split, and PDF annotate/redraw.
 */
import { OpenAPIHono } from "@hono/zod-openapi";
import { and, desc, eq, ne } from "drizzle-orm";
import { z } from "zod";

import { createD1 } from "../../global/db.js";
import {
  aiDocumentAnnotations,
  documents,
} from "../../global/schema.js";
import {
  extractAnnotationsFromMarkdown,
  annotationItemSchema,
} from "../../platform/document-annotations.js";
import { mcpHasScope, type McpAccessToken } from "../../platform/mcp-auth.js";
import {
  annotatePdf,
  pdfAnnotateOpSchema,
  splitPdfPages,
} from "../../platform/pdf-ops.js";
import { createDownloadToken } from "./download-token.js";

const app = new OpenAPIHono<{
  Bindings: CloudflareBindings;
  Variables: { mcp: McpAccessToken };
}>();

async function loadOrgDocument(
  db: ReturnType<typeof createD1>,
  organizationId: string,
  id: string
) {
  const rows = await db
    .select()
    .from(documents)
    .where(
      and(
        eq(documents.id, id),
        eq(documents.organizationId, organizationId),
        ne(documents.documentStatus, "deleted")
      )
    )
    .limit(1);
  return rows[0] ?? null;
}

export async function materializeAnnotationsFromParsedText(
  db: ReturnType<typeof createD1>,
  args: {
    documentId: string;
    organizationId: string;
    parsedText: string | null;
  }
): Promise<{
  id: string;
  publicId: string;
  annotations: z.infer<typeof annotationItemSchema>[];
} | null> {
  if (!args.parsedText) return null;
  const annotations = extractAnnotationsFromMarkdown(args.parsedText);
  if (annotations.length === 0) return null;

  const id = crypto.randomUUID();
  const publicId = crypto.randomUUID();
  const now = new Date();
  await db.insert(aiDocumentAnnotations).values({
    id,
    publicId,
    documentId: args.documentId,
    organizationId: args.organizationId,
    annotations: JSON.stringify(annotations),
    modelUsed: "anydoc-heuristics",
    tokensUsed: 0,
    processingTimeMs: 0,
    status: "active",
    createdAt: now,
    updatedAt: now,
  });
  return { id, publicId, annotations };
}

async function resolveOriginalKey(
  env: CloudflareBindings,
  doc: {
    storageKey: string | null;
    originalStorageKey: string | null;
    originalContentType: string | null;
  }
): Promise<{ key: string; contentType: string } | null> {
  if (doc.originalStorageKey) {
    return {
      key: doc.originalStorageKey,
      contentType: doc.originalContentType ?? "application/octet-stream",
    };
  }
  if (!doc.storageKey) return null;
  const head = await env.DOCUMENTS_BUCKET.head(doc.storageKey);
  const originalKey = head?.customMetadata?.originalKey;
  const originalContentType = head?.customMetadata?.originalContentType;
  if (!originalKey) return null;
  return {
    key: originalKey,
    contentType: originalContentType ?? "application/octet-stream",
  };
}

app.get("/annotations", async (c) => {
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
  const doc = await loadOrgDocument(db, organizationId, id);
  if (!doc) {
    return c.json({ error: "not_found" }, 404);
  }

  const rows = await db
    .select()
    .from(aiDocumentAnnotations)
    .where(
      and(
        eq(aiDocumentAnnotations.documentId, doc.id),
        eq(aiDocumentAnnotations.status, "active")
      )
    )
    .orderBy(desc(aiDocumentAnnotations.createdAt))
    .limit(1);

  let row = rows[0];
  if (!row) {
    const materialized = await materializeAnnotationsFromParsedText(db, {
      documentId: doc.id,
      organizationId,
      parsedText: doc.parsedText,
    });
    if (!materialized) {
      return c.json({ annotations: null });
    }
    return c.json({
      annotations: {
        id: materialized.id,
        public_id: materialized.publicId,
        items: materialized.annotations,
        model_used: "anydoc-heuristics",
        status: "active",
      },
    });
  }

  let items: unknown;
  try {
    items = JSON.parse(row.annotations) as unknown;
  } catch {
    items = [];
  }

  return c.json({
    annotations: {
      id: row.id,
      public_id: row.publicId,
      items,
      model_used: row.modelUsed,
      status: row.status,
    },
  });
});

app.post("/annotations/generate", async (c) => {
  const mcp = c.get("mcp");
  if (!mcpHasScope(mcp, "documents:write")) {
    return c.json({ error: "insufficient_scope" }, 403);
  }
  const organizationId = mcp.organizationId;
  if (!organizationId) {
    return c.json({ error: "organization_required" }, 403);
  }

  const body = z.object({ id: z.string().min(1) }).safeParse(await c.req.json());
  if (!body.success) {
    return c.json({ error: "validation_error" }, 400);
  }

  const db = createD1(c.env.D1);
  const doc = await loadOrgDocument(db, organizationId, body.data.id);
  if (!doc) {
    return c.json({ error: "not_found" }, 404);
  }

  await db
    .update(aiDocumentAnnotations)
    .set({ status: "dismissed", updatedAt: new Date() })
    .where(
      and(
        eq(aiDocumentAnnotations.documentId, doc.id),
        eq(aiDocumentAnnotations.status, "active")
      )
    );

  const materialized = await materializeAnnotationsFromParsedText(db, {
    documentId: doc.id,
    organizationId,
    parsedText: doc.parsedText,
  });
  if (!materialized) {
    return c.json({ annotations: null, count: 0 });
  }
  return c.json({
    annotations: {
      id: materialized.id,
      public_id: materialized.publicId,
      items: materialized.annotations,
      model_used: "anydoc-heuristics",
      status: "active",
    },
    count: materialized.annotations.length,
  });
});

app.post("/annotations/dismiss", async (c) => {
  const mcp = c.get("mcp");
  if (!mcpHasScope(mcp, "documents:write")) {
    return c.json({ error: "insufficient_scope" }, 403);
  }
  const organizationId = mcp.organizationId;
  if (!organizationId) {
    return c.json({ error: "organization_required" }, 403);
  }
  const body = z.object({ id: z.string().min(1) }).safeParse(await c.req.json());
  if (!body.success) {
    return c.json({ error: "validation_error" }, 400);
  }
  const db = createD1(c.env.D1);
  const doc = await loadOrgDocument(db, organizationId, body.data.id);
  if (!doc) {
    return c.json({ error: "not_found" }, 404);
  }
  await db
    .update(aiDocumentAnnotations)
    .set({ status: "dismissed", updatedAt: new Date() })
    .where(
      and(
        eq(aiDocumentAnnotations.documentId, doc.id),
        eq(aiDocumentAnnotations.status, "active")
      )
    );
  return c.json({ success: true });
});

app.get("/preview", async (c) => {
  const mcp = c.get("mcp");
  if (!mcpHasScope(mcp, "documents:read")) {
    return c.json({ error: "insufficient_scope" }, 403);
  }
  const organizationId = mcp.organizationId;
  if (!organizationId) {
    return c.json({ error: "organization_required" }, 403);
  }

  const id = c.req.query("id");
  const format = c.req.query("format") ?? "markdown";
  if (!id) {
    return c.json({ error: "missing_document_id" }, 400);
  }
  if (!["pdf", "markdown", "original", "structured"].includes(format)) {
    return c.json({ error: "invalid_format" }, 400);
  }

  const db = createD1(c.env.D1);
  const doc = await loadOrgDocument(db, organizationId, id);
  if (!doc) {
    return c.json({ error: "not_found" }, 404);
  }

  const origin = new URL(c.req.url).origin;

  if (format === "markdown") {
    return c.json({
      format: "markdown",
      content_type: "text/markdown",
      markdown: doc.parsedText ?? null,
      title: doc.parsedTitle ?? doc.name,
      page_count: doc.pageCount,
      field_candidates: doc.fieldCandidates
        ? (JSON.parse(doc.fieldCandidates) as unknown)
        : [],
    });
  }

  if (format === "structured") {
    let csv_rows: string[][] | null = null;
    const original = await resolveOriginalKey(c.env, doc);
    if (original?.contentType === "text/csv") {
      const obj = await c.env.DOCUMENTS_BUCKET.get(original.key);
      if (obj) {
        const text = await obj.text();
        csv_rows = text
          .split(/\r?\n/)
          .filter((line) => line.length > 0)
          .slice(0, 500)
          .map((line) => line.split(","));
      }
    }
    return c.json({
      format: "structured",
      markdown: doc.parsedText ?? null,
      title: doc.parsedTitle ?? doc.name,
      page_count: doc.pageCount,
      parsed_format: doc.parsedFormat,
      original_content_type:
        doc.originalContentType ?? original?.contentType ?? null,
      field_candidates: doc.fieldCandidates
        ? (JSON.parse(doc.fieldCandidates) as unknown)
        : [],
      csv_rows,
    });
  }

  const storageKey =
    format === "original"
      ? (await resolveOriginalKey(c.env, doc))?.key
      : doc.storageKey;
  const contentType =
    format === "original"
      ? ((await resolveOriginalKey(c.env, doc))?.contentType ?? null)
      : (doc.contentType ?? "application/pdf");

  if (!storageKey) {
    return c.json({ error: format === "original" ? "no_original" : "no_pdf" }, 404);
  }

  const token = await createDownloadToken(c.env, {
    userId: mcp.sub,
    organizationId,
    storageKey,
    documentName: doc.name,
  });
  if (!token) {
    return c.json({ error: "server_error" }, 503);
  }

  return c.json({
    format,
    content_type: contentType,
    download_url: `${origin}/api/v1/documents/download-file?token=${encodeURIComponent(token)}`,
    page_count: doc.pageCount,
  });
});

const splitSchema = z.object({
  id: z.string().min(1),
  splits: z
    .array(
      z.object({
        title: z.string().min(1),
        pages: z.array(z.number().int().min(1)).min(1),
      })
    )
    .min(1)
    .max(20),
});

app.post("/split", async (c) => {
  const mcp = c.get("mcp");
  if (!mcpHasScope(mcp, "documents:write")) {
    return c.json({ error: "insufficient_scope" }, 403);
  }
  const organizationId = mcp.organizationId;
  if (!organizationId) {
    return c.json({ error: "organization_required" }, 403);
  }

  const parsed = splitSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: "validation_error" }, 400);
  }

  const db = createD1(c.env.D1);
  const doc = await loadOrgDocument(db, organizationId, parsed.data.id);
  if (!doc) {
    return c.json({ error: "not_found" }, 404);
  }
  if (doc.status !== "draft") {
    return c.json({ error: "document_not_editable" }, 400);
  }
  if (!doc.storageKey) {
    return c.json({ error: "no_pdf" }, 400);
  }

  const object = await c.env.DOCUMENTS_BUCKET.get(doc.storageKey);
  if (!object) {
    return c.json({ error: "storage_missing" }, 404);
  }
  const srcBytes = await object.arrayBuffer();

  const created: Array<{ id: string; title: string; page_count: number }> = [];

  for (const split of parsed.data.splits) {
    let result: { bytes: Uint8Array; pageCount: number };
    try {
      result = await splitPdfPages(srcBytes, split.pages);
    } catch {
      return c.json({ error: "invalid_pages", title: split.title }, 400);
    }

    const storageId = `uploads/${crypto.randomUUID()}`;
    await c.env.DOCUMENTS_BUCKET.put(storageId, result.bytes, {
      httpMetadata: { contentType: "application/pdf" },
      customMetadata: {
        organizationId,
        uploadedBy: mcp.sub,
        parentDocumentId: doc.id,
      },
    });

    const childId = crypto.randomUUID();
    await db.insert(documents).values({
      id: childId,
      publicId: crypto.randomUUID(),
      organizationId,
      ownerId: mcp.sub,
      name: split.title,
      description: `Split from ${doc.name}`,
      status: "draft",
      documentStatus: "active",
      sharingMode: "private",
      storageKey: storageId,
      contentType: "application/pdf",
      size: result.bytes.byteLength,
      pageCount: result.pageCount,
      parentDocumentId: doc.id,
      originalStorageKey: doc.originalStorageKey,
      originalContentType: doc.originalContentType,
    });

    created.push({
      id: childId,
      title: split.title,
      page_count: result.pageCount,
    });
  }

  return c.json({ parent_id: doc.id, documents: created }, 201);
});

const annotateSchema = z.object({
  id: z.string().min(1),
  operations: z.array(pdfAnnotateOpSchema).min(1).max(100),
});

app.post("/pdf/annotate", async (c) => {
  const mcp = c.get("mcp");
  if (!mcpHasScope(mcp, "documents:write")) {
    return c.json({ error: "insufficient_scope" }, 403);
  }
  const organizationId = mcp.organizationId;
  if (!organizationId) {
    return c.json({ error: "organization_required" }, 403);
  }

  const parsed = annotateSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: "validation_error" }, 400);
  }

  const db = createD1(c.env.D1);
  const doc = await loadOrgDocument(db, organizationId, parsed.data.id);
  if (!doc) {
    return c.json({ error: "not_found" }, 404);
  }
  if (doc.status !== "draft") {
    return c.json({ error: "document_not_editable" }, 400);
  }
  if (!doc.storageKey) {
    return c.json({ error: "no_pdf" }, 400);
  }

  const object = await c.env.DOCUMENTS_BUCKET.get(doc.storageKey);
  if (!object) {
    return c.json({ error: "storage_missing" }, 404);
  }

  const annotated = await annotatePdf(
    await object.arrayBuffer(),
    parsed.data.operations
  );

  const storageId = `uploads/${crypto.randomUUID()}`;
  await c.env.DOCUMENTS_BUCKET.put(storageId, annotated, {
    httpMetadata: { contentType: "application/pdf" },
    customMetadata: {
      organizationId,
      uploadedBy: mcp.sub,
      annotatedFrom: doc.storageKey,
    },
  });

  await db
    .update(documents)
    .set({
      storageKey: storageId,
      size: annotated.byteLength,
      contentType: "application/pdf",
      updatedAt: new Date(),
    })
    .where(eq(documents.id, doc.id));

  return c.json({
    success: true,
    storage_id: storageId,
    operations_applied: parsed.data.operations.length,
  });
});

export default app;
