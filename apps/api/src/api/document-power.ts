/**
 * Session-auth document power routes (human UI for SEA-26).
 * Mirrors agent MCP surface in document-agent.ts — split, preview, annotate.
 */
import { OpenAPIHono, z } from "@hono/zod-openapi";
import { and, eq, ne } from "drizzle-orm";

import { createD1 } from "../global/db.js";
import { documents } from "../global/schema.js";
import {
  convertBytesToPdf,
  isConvertibleFileType,
} from "../platform/document-conversion.js";
import { buildDocumentLayoutBlocks } from "../platform/document-layout-blocks.js";
import {
  annotatePdf,
  mergePdfs,
  pdfAnnotateOpSchema,
  rotatePdfPages,
  splitPdfPages,
} from "../platform/pdf-ops.js";
import type { Variables } from "../platform/types.js";
import { createDownloadToken } from "./v1/download-token.js";

const app = new OpenAPIHono<{
  Bindings: CloudflareBindings;
  Variables: Variables;
}>();

function publicIdFromPath(pathname: string): string | null {
  // /api/documents/:slug/:publicId/power/...
  const segments = pathname.split("/").filter(Boolean);
  const powerIdx = segments.indexOf("power");
  if (powerIdx < 2) return null;
  return segments[powerIdx - 1] ?? null;
}

async function loadOrgDocByPublicId(
  db: ReturnType<typeof createD1>,
  organizationId: string,
  publicId: string
) {
  const rows = await db
    .select()
    .from(documents)
    .where(
      and(
        eq(documents.publicId, publicId),
        eq(documents.organizationId, organizationId),
        ne(documents.documentStatus, "deleted")
      )
    )
    .limit(1);
  return rows[0] ?? null;
}

const splitBodySchema = z.object({
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
  const user = c.get("user");
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  const organizationId = c.get("organization").id;
  const publicId = publicIdFromPath(new URL(c.req.url).pathname);
  if (!publicId) return c.json({ error: "not_found" }, 404);

  const parsed = splitBodySchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "validation_error" }, 400);

  const db = createD1(c.env.D1);
  const doc = await loadOrgDocByPublicId(db, organizationId, publicId);
  if (!doc) return c.json({ error: "not_found" }, 404);
  if (doc.status !== "draft") {
    return c.json({ error: "document_not_editable" }, 400);
  }
  if (!doc.storageKey) return c.json({ error: "no_pdf" }, 400);

  const object = await c.env.DOCUMENTS_BUCKET.get(doc.storageKey);
  if (!object) return c.json({ error: "storage_missing" }, 404);
  const srcBytes = await object.arrayBuffer();

  const created: Array<{
    publicId: string;
    title: string;
    pageCount: number;
  }> = [];

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
        uploadedBy: user.user.id,
        parentDocumentId: doc.id,
      },
    });

    const childPublicId = crypto.randomUUID();
    await db.insert(documents).values({
      id: crypto.randomUUID(),
      publicId: childPublicId,
      organizationId,
      ownerId: user.user.id,
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
      publicId: childPublicId,
      title: split.title,
      pageCount: result.pageCount,
    });
  }

  return c.json(
    { parentPublicId: doc.publicId, documents: created },
    201
  );
});

app.get("/preview", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  const organizationId = c.get("organization").id;
  const publicId = publicIdFromPath(new URL(c.req.url).pathname);
  if (!publicId) return c.json({ error: "not_found" }, 404);

  const db = createD1(c.env.D1);
  const doc = await loadOrgDocByPublicId(db, organizationId, publicId);
  if (!doc) return c.json({ error: "not_found" }, 404);

  const key = doc.originalStorageKey ?? doc.storageKey;
  const contentType =
    doc.originalContentType ?? doc.contentType ?? "application/octet-stream";
  if (!key) return c.json({ error: "no_file" }, 400);

  const object = await c.env.DOCUMENTS_BUCKET.get(key);
  if (!object) return c.json({ error: "storage_missing" }, 404);

  const lower = contentType.toLowerCase();
  let format:
    | "pdf"
    | "csv"
    | "text"
    | "html"
    | "docx"
    | "xlsx"
    | "pptx"
    | "unknown" = "unknown";
  if (lower.includes("pdf") || key.endsWith(".pdf")) format = "pdf";
  else if (lower.includes("csv") || key.endsWith(".csv")) format = "csv";
  else if (lower.includes("html")) format = "html";
  else if (
    lower.includes("wordprocessingml") ||
    lower.includes("msword") ||
    key.endsWith(".docx")
  )
    format = "docx";
  else if (
    lower.includes("spreadsheetml") ||
    lower.includes("ms-excel") ||
    key.endsWith(".xlsx") ||
    key.endsWith(".xls")
  )
    format = "xlsx";
  else if (
    lower.includes("presentationml") ||
    lower.includes("ms-powerpoint") ||
    key.endsWith(".pptx")
  )
    format = "pptx";
  else if (lower.includes("text") || lower.includes("json")) format = "text";

  const origin = new URL(c.req.url).origin;
  const token = await createDownloadToken(c.env, {
    userId: user.user.id,
    organizationId,
    storageKey: key,
    documentName: doc.name,
  });

  if (format === "csv" || format === "text") {
    const text = await object.text();
    return c.json({
      format,
      content_type: contentType,
      content: text.slice(0, 500_000),
      page_count: doc.pageCount,
      download_url: token
        ? `${origin}/api/v1/documents/download-file?token=${encodeURIComponent(token)}`
        : null,
    });
  }

  return c.json({
    format,
    content_type: contentType,
    content: null,
    page_count: doc.pageCount,
    download_url: token
      ? `${origin}/api/v1/documents/download-file?token=${encodeURIComponent(token)}`
      : null,
  });
});

const annotateBodySchema = z.object({
  operations: z.array(pdfAnnotateOpSchema).min(1).max(100),
});

app.post("/annotate", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  const organizationId = c.get("organization").id;
  const publicId = publicIdFromPath(new URL(c.req.url).pathname);
  if (!publicId) return c.json({ error: "not_found" }, 404);

  const parsed = annotateBodySchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "validation_error" }, 400);

  const db = createD1(c.env.D1);
  const doc = await loadOrgDocByPublicId(db, organizationId, publicId);
  if (!doc) return c.json({ error: "not_found" }, 404);
  if (doc.status !== "draft") {
    return c.json({ error: "document_not_editable" }, 400);
  }
  if (!doc.storageKey) return c.json({ error: "no_pdf" }, 400);

  const object = await c.env.DOCUMENTS_BUCKET.get(doc.storageKey);
  if (!object) return c.json({ error: "storage_missing" }, 404);

  const annotated = await annotatePdf(
    await object.arrayBuffer(),
    parsed.data.operations
  );

  const storageId = `uploads/${crypto.randomUUID()}`;
  await c.env.DOCUMENTS_BUCKET.put(storageId, annotated, {
    httpMetadata: { contentType: "application/pdf" },
    customMetadata: {
      organizationId,
      uploadedBy: user.user.id,
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
    storageId,
    operationsApplied: parsed.data.operations.length,
  });
});

function base64ToBytes(contentBase64: string): Uint8Array {
  const binary = atob(contentBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

const replacePdfBodySchema = z.object({
  contentBase64: z.string().min(1),
});

app.post("/replace-pdf", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  const organizationId = c.get("organization").id;
  const publicId = publicIdFromPath(new URL(c.req.url).pathname);
  if (!publicId) return c.json({ error: "not_found" }, 404);

  const parsed = replacePdfBodySchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "validation_error" }, 400);

  const db = createD1(c.env.D1);
  const doc = await loadOrgDocByPublicId(db, organizationId, publicId);
  if (!doc) return c.json({ error: "not_found" }, 404);
  if (doc.status !== "draft") {
    return c.json({ error: "document_not_editable" }, 400);
  }

  const bytes = base64ToBytes(parsed.data.contentBase64);
  const storageId = `uploads/${crypto.randomUUID()}`;
  await c.env.DOCUMENTS_BUCKET.put(storageId, bytes, {
    httpMetadata: { contentType: "application/pdf" },
    customMetadata: {
      organizationId,
      uploadedBy: user.user.id,
      replacedFrom: doc.storageKey ?? "",
    },
  });

  await db
    .update(documents)
    .set({
      storageKey: storageId,
      size: bytes.byteLength,
      contentType: "application/pdf",
      updatedAt: new Date(),
    })
    .where(eq(documents.id, doc.id));

  return c.json({
    success: true,
    storageId,
    size: bytes.byteLength,
  });
});

app.get("/layout-blocks", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  const organizationId = c.get("organization").id;
  const publicId = publicIdFromPath(new URL(c.req.url).pathname);
  if (!publicId) return c.json({ error: "not_found" }, 404);

  const db = createD1(c.env.D1);
  const doc = await loadOrgDocByPublicId(db, organizationId, publicId);
  if (!doc) return c.json({ error: "not_found" }, 404);

  const blocks = buildDocumentLayoutBlocks({
    parsedText: doc.parsedText,
    fieldCandidatesJson: doc.fieldCandidates,
  });

  return c.json({ blocks });
});

app.get("/extraction-schema", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  const organizationId = c.get("organization").id;
  const publicId = publicIdFromPath(new URL(c.req.url).pathname);
  if (!publicId) return c.json({ error: "not_found" }, 404);

  const db = createD1(c.env.D1);
  const doc = await loadOrgDocByPublicId(db, organizationId, publicId);
  if (!doc) return c.json({ error: "not_found" }, 404);

  let schema: Record<string, unknown> = { type: "object", properties: {} };
  if (doc.extractionSchema) {
    try {
      const parsed = JSON.parse(doc.extractionSchema) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        schema = parsed as Record<string, unknown>;
      }
    } catch {
      // keep empty schema
    }
  }
  return c.json({ schema });
});

const extractionSchemaBodySchema = z.object({
  schema: z.record(z.string(), z.unknown()),
});

app.put("/extraction-schema", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  const organizationId = c.get("organization").id;
  const publicId = publicIdFromPath(new URL(c.req.url).pathname);
  if (!publicId) return c.json({ error: "not_found" }, 404);

  const parsed = extractionSchemaBodySchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "validation_error" }, 400);

  const db = createD1(c.env.D1);
  const doc = await loadOrgDocByPublicId(db, organizationId, publicId);
  if (!doc) return c.json({ error: "not_found" }, 404);
  if (doc.status !== "draft") {
    return c.json({ error: "document_not_editable" }, 400);
  }

  await db
    .update(documents)
    .set({
      extractionSchema: JSON.stringify(parsed.data.schema),
      updatedAt: new Date(),
    })
    .where(eq(documents.id, doc.id));

  return c.json({ schema: parsed.data.schema });
});

const replaceOriginalBodySchema = z.object({
  contentBase64: z.string().min(1),
  contentType: z.string().min(1),
});

app.post("/replace-original", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  const organizationId = c.get("organization").id;
  const publicId = publicIdFromPath(new URL(c.req.url).pathname);
  if (!publicId) return c.json({ error: "not_found" }, 404);

  const parsed = replaceOriginalBodySchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "validation_error" }, 400);

  const db = createD1(c.env.D1);
  const doc = await loadOrgDocByPublicId(db, organizationId, publicId);
  if (!doc) return c.json({ error: "not_found" }, 404);
  if (doc.status !== "draft") {
    return c.json({ error: "document_not_editable" }, 400);
  }

  const bytes = base64ToBytes(parsed.data.contentBase64);
  const originalKey = `uploads/${crypto.randomUUID()}`;
  await c.env.DOCUMENTS_BUCKET.put(originalKey, bytes, {
    httpMetadata: { contentType: parsed.data.contentType },
    customMetadata: {
      organizationId,
      uploadedBy: user.user.id,
    },
  });

  let pdfStorageId: string | null = null;
  let pdfSize = bytes.byteLength;
  if (isConvertibleFileType(parsed.data.contentType)) {
    try {
      const pdf = await convertBytesToPdf(c.env, {
        contentType: parsed.data.contentType,
        bytes,
        name: doc.name,
      });
      pdfStorageId = `uploads/${crypto.randomUUID()}`;
      await c.env.DOCUMENTS_BUCKET.put(pdfStorageId, pdf, {
        httpMetadata: { contentType: "application/pdf" },
        customMetadata: {
          organizationId,
          uploadedBy: user.user.id,
          convertedFrom: originalKey,
        },
      });
      pdfSize = pdf.byteLength;
    } catch {
      return c.json({ error: "conversion_failed" }, 502);
    }
  } else if (parsed.data.contentType.includes("pdf")) {
    pdfStorageId = originalKey;
  }

  await db
    .update(documents)
    .set({
      originalStorageKey: originalKey,
      originalContentType: parsed.data.contentType,
      storageKey: pdfStorageId ?? doc.storageKey,
      contentType: pdfStorageId ? "application/pdf" : parsed.data.contentType,
      size: pdfSize,
      updatedAt: new Date(),
    })
    .where(eq(documents.id, doc.id));

  return c.json({
    success: true,
    originalStorageKey: originalKey,
    storageId: pdfStorageId,
    contentType: parsed.data.contentType,
  });
});

const rotateBodySchema = z.object({
  degrees: z.union([z.literal(90), z.literal(180), z.literal(270)]),
  pages: z.array(z.number().int().min(1)).optional(),
});

app.post("/rotate-pdf", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  const organizationId = c.get("organization").id;
  const publicId = publicIdFromPath(new URL(c.req.url).pathname);
  if (!publicId) return c.json({ error: "not_found" }, 404);

  const parsed = rotateBodySchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "validation_error" }, 400);

  const db = createD1(c.env.D1);
  const doc = await loadOrgDocByPublicId(db, organizationId, publicId);
  if (!doc) return c.json({ error: "not_found" }, 404);
  if (doc.status !== "draft") {
    return c.json({ error: "document_not_editable" }, 400);
  }
  if (!doc.storageKey) return c.json({ error: "no_pdf" }, 400);

  const object = await c.env.DOCUMENTS_BUCKET.get(doc.storageKey);
  if (!object) return c.json({ error: "storage_missing" }, 404);

  const rotated = await rotatePdfPages(
    await object.arrayBuffer(),
    parsed.data.degrees,
    parsed.data.pages
  );

  const storageId = `uploads/${crypto.randomUUID()}`;
  await c.env.DOCUMENTS_BUCKET.put(storageId, rotated.bytes, {
    httpMetadata: { contentType: "application/pdf" },
    customMetadata: {
      organizationId,
      uploadedBy: user.user.id,
      rotatedFrom: doc.storageKey,
    },
  });

  await db
    .update(documents)
    .set({
      storageKey: storageId,
      size: rotated.bytes.byteLength,
      contentType: "application/pdf",
      pageCount: rotated.pageCount,
      updatedAt: new Date(),
    })
    .where(eq(documents.id, doc.id));

  return c.json({
    success: true,
    storageId,
    pageCount: rotated.pageCount,
  });
});

const mergeBodySchema = z.object({
  sourcePublicIds: z.array(z.string().min(1)).min(1).max(19),
  title: z.string().min(1).max(200).optional(),
});

/** Merge this document with additional draft PDFs into a new draft. */
app.post("/merge-pdf", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: "Unauthorized" }, 401);
  const organizationId = c.get("organization").id;
  const publicId = publicIdFromPath(new URL(c.req.url).pathname);
  if (!publicId) return c.json({ error: "not_found" }, 404);

  const parsed = mergeBodySchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: "validation_error" }, 400);

  const db = createD1(c.env.D1);
  const primary = await loadOrgDocByPublicId(db, organizationId, publicId);
  if (!primary?.storageKey) return c.json({ error: "not_found" }, 404);

  const buffers: Uint8Array[] = [];
  const object = await c.env.DOCUMENTS_BUCKET.get(primary.storageKey);
  if (!object) return c.json({ error: "storage_missing" }, 404);
  buffers.push(new Uint8Array(await object.arrayBuffer()));

  for (const sid of parsed.data.sourcePublicIds) {
    const doc = await loadOrgDocByPublicId(db, organizationId, sid);
    if (!doc?.storageKey) return c.json({ error: "not_found", id: sid }, 404);
    const obj = await c.env.DOCUMENTS_BUCKET.get(doc.storageKey);
    if (!obj) return c.json({ error: "storage_missing", id: sid }, 404);
    buffers.push(new Uint8Array(await obj.arrayBuffer()));
  }

  const merged = await mergePdfs(buffers);
  const storageId = `uploads/${crypto.randomUUID()}`;
  await c.env.DOCUMENTS_BUCKET.put(storageId, merged.bytes, {
    httpMetadata: { contentType: "application/pdf" },
    customMetadata: {
      organizationId,
      uploadedBy: user.user.id,
      mergedFrom: [publicId, ...parsed.data.sourcePublicIds].join(","),
    },
  });

  const now = new Date();
  const id = crypto.randomUUID();
  const newPublicId = crypto.randomUUID();
  const title =
    parsed.data.title ?? `Merged (${buffers.length} docs)`;

  await db.insert(documents).values({
    id,
    publicId: newPublicId,
    organizationId,
    ownerId: user.user.id,
    name: title,
    description: `Merged from ${buffers.length} documents`,
    status: "draft",
    documentStatus: "active",
    sharingMode: "private",
    storageKey: storageId,
    contentType: "application/pdf",
    size: merged.bytes.byteLength,
    pageCount: merged.pageCount,
    createdAt: now,
    updatedAt: now,
  });

  return c.json({
    success: true,
    id,
    publicId: newPublicId,
    storageId,
    pageCount: merged.pageCount,
  });
});

export default app;
