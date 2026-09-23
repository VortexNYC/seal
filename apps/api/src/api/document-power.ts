/**
 * Session-auth document power routes (human UI for SEA-26).
 * Mirrors agent MCP surface in document-agent.ts — split + original preview.
 */
import { OpenAPIHono, z } from "@hono/zod-openapi";
import { and, eq, ne } from "drizzle-orm";

import { createD1 } from "../global/db.js";
import { documents } from "../global/schema.js";
import { splitPdfPages } from "../platform/pdf-ops.js";
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

export default app;
