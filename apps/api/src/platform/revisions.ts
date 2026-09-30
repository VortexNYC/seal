/**
 * Revision suggestions (redlines) — legal-primitives phase 4.
 *
 * A suggestion proposes a textual edit anchored to a verbatim quote in the
 * document's parsedText (auto-anchored to {page,bbox} via the words
 * substrate). Accepting materializes a NEW derived draft — the source
 * document is never mutated in place, keeping signature/audit chains clean.
 * Re-derived docs go through the normal parse → field-candidate pipeline.
 */

import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";

import { createD1 } from "../global/db.js";
import { documents, revisionSuggestions } from "../global/schema.js";
import { parseDocumentFromStorage } from "./anydoc.js";
import { convertBytesToPdf, trackedDocxBytes } from "./document-conversion.js";
import { anchorQuote } from "./quote-anchor.js";

type Db = ReturnType<typeof createD1>;

export const REVISION_KINDS = ["insert", "delete", "replace"] as const;
export type RevisionKind = (typeof REVISION_KINDS)[number];

export const ZRevisionCreate = z.object({
  document_id: z.string().min(1),
  kind: z.enum(REVISION_KINDS),
  anchor_quote: z.string().min(1).max(4000),
  proposed_text: z.string().max(8000).optional(),
  rationale: z.string().max(2000).optional(),
  review_cell_id: z.string().optional(),
});
export type RevisionCreate = z.infer<typeof ZRevisionCreate>;

export class RevisionError extends Error {
  readonly code: string;
  readonly status: 400 | 403 | 404 | 409;

  constructor(code: string, status: 400 | 403 | 404 | 409) {
    super(code);
    this.name = "RevisionError";
    this.code = code;
    this.status = status;
  }
}

export type ApiRevision = {
  id: string;
  document_id: string;
  review_cell_id: string | null;
  kind: RevisionKind;
  status: "pending" | "accepted" | "rejected";
  anchor_quote: string;
  anchor_page: number | null;
  anchor_bbox: { x: number; y: number; width: number; height: number } | null;
  proposed_text: string | null;
  rationale: string | null;
  derived_document_id: string | null;
  created_by: string;
  created_at: string;
  resolved_at: string | null;
};

function toApiRevision(
  row: typeof revisionSuggestions.$inferSelect,
  documentPublicId?: string
): ApiRevision {
  let bbox: ApiRevision["anchor_bbox"] = null;
  if (row.anchorBbox) {
    try {
      bbox = JSON.parse(row.anchorBbox) as ApiRevision["anchor_bbox"];
    } catch {
      bbox = null;
    }
  }
  return {
    id: row.publicId,
    document_id: documentPublicId ?? row.documentId,
    review_cell_id: row.reviewCellId,
    kind: row.kind as RevisionKind,
    status: row.status as ApiRevision["status"],
    anchor_quote: row.anchorQuote,
    anchor_page: row.anchorPage,
    anchor_bbox: bbox,
    proposed_text: row.proposedText,
    rationale: row.rationale,
    derived_document_id: row.derivedDocumentId,
    created_by: row.createdBy,
    created_at: row.createdAt.toISOString(),
    resolved_at: row.resolvedAt?.toISOString() ?? null,
  };
}

async function loadOrgDoc(db: Db, organizationId: string, publicId: string) {
  const rows = await db
    .select()
    .from(documents)
    .where(
      and(
        eq(documents.organizationId, organizationId),
        eq(documents.publicId, publicId)
      )
    )
    .limit(1);
  return rows[0] ?? null;
}

/** Create a pending suggestion — the quote must exist in parsedText. */
export async function createRevision(
  env: CloudflareBindings,
  db: Db,
  args: {
    organizationId: string;
    input: RevisionCreate;
    createdBy: "agent" | "user";
    createdById?: string;
  }
): Promise<ApiRevision> {
  const { input, organizationId } = args;
  const doc = await loadOrgDoc(db, organizationId, input.document_id);
  if (!doc) throw new RevisionError("not_found", 404);
  if (doc.status !== "draft") {
    throw new RevisionError("document_not_editable", 400);
  }
  if (input.kind !== "delete" && !input.proposed_text?.trim()) {
    throw new RevisionError("proposed_text_required", 400);
  }
  const parsedText = doc.parsedText ?? "";
  if (!parsedText.includes(input.anchor_quote)) {
    throw new RevisionError("anchor_not_found", 400);
  }

  // Best-effort anchor to page/bbox — quote was validated, geometry is a bonus.
  let anchorPage: number | null = null;
  let anchorBbox: string | null = null;
  if (doc.storageKey) {
    try {
      const anchor = await anchorQuote(env, doc.storageKey, input.anchor_quote);
      if (anchor) {
        anchorPage = anchor.page;
        anchorBbox = JSON.stringify(anchor.bbox);
      }
    } catch {
      // Anchoring is additive.
    }
  }

  const rows = await db
    .insert(revisionSuggestions)
    .values({
      id: crypto.randomUUID(),
      publicId: `rev_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`,
      organizationId,
      documentId: doc.id,
      reviewCellId: input.review_cell_id ?? null,
      kind: input.kind,
      status: "pending",
      anchorQuote: input.anchor_quote,
      anchorPage,
      anchorBbox,
      proposedText: input.proposed_text ?? null,
      rationale: input.rationale ?? null,
      createdBy: args.createdBy,
      createdById: args.createdById ?? null,
      createdAt: new Date(),
    })
    .returning();
  const row = rows[0];
  if (!row) throw new RevisionError("create_failed", 400);
  return toApiRevision(row, doc.publicId);
}

/** Apply the suggestion's text edit to a document body. */
export function applyRevisionText(
  source: string,
  s: {
    kind: RevisionKind;
    anchorQuote: string;
    proposedText: string | null;
  }
): string {
  const idx = source.indexOf(s.anchorQuote);
  if (idx === -1) throw new RevisionError("anchor_not_found", 400);
  const before = source.slice(0, idx);
  const after = source.slice(idx + s.anchorQuote.length);
  if (s.kind === "delete") return before + after;
  if (s.kind === "replace") return before + (s.proposedText ?? "") + after;
  return before + s.anchorQuote + "\n\n" + (s.proposedText ?? "") + after;
}

/**
 * Apply many edits against the ORIGINAL text positionally — anchors must
 * not overlap (overlapping edits are skipped). Edits that anchor inside
 * earlier proposals are impossible by construction: anchor offsets are
 * resolved on the untouched source.
 */
export function applyAllRevisionsText(
  source: string,
  edits: {
    kind: RevisionKind;
    anchorQuote: string;
    proposedText: string | null;
  }[]
): { text: string; applied: number; skipped: number } {
  type Span = { start: number; end: number; edit: (typeof edits)[number] };
  const spans: Span[] = [];
  let skipped = 0;
  for (const e of edits) {
    const idx = source.indexOf(e.anchorQuote);
    if (idx === -1) {
      skipped++;
      continue;
    }
    const end = idx + e.anchorQuote.length;
    if (spans.some((s) => idx < s.end && end > s.start)) {
      skipped++;
      continue;
    }
    spans.push({ start: idx, end, edit: e });
  }
  spans.sort((a, b) => a.start - b.start);
  let out = "";
  let cursor = 0;
  for (const span of spans) {
    out += source.slice(cursor, span.start);
    const e = span.edit;
    if (e.kind === "delete") {
      // drop the anchor text
    } else if (e.kind === "replace") {
      out += e.proposedText ?? "";
    } else {
      out += e.anchorQuote + "\n\n" + (e.proposedText ?? "");
    }
    cursor = span.end;
  }
  out += source.slice(cursor);
  return { text: out, applied: spans.length, skipped };
}

/** Escape + paragraph-wrap revised markdown into print-ready HTML. */
function revisedTextToHtml(title: string, text: string): string {
  const paras = text
    .split(/\n\s*\n/)
    .map(
      (p) =>
        `<p>${p.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>")}</p>`
    )
    .join("\n");
  return `<!doctype html><html><head><meta charset="utf-8"><title>${title
    .replace(/&/g, "&amp;")
    .replace(
      /</g,
      "&lt;"
    )}</title><style>body{font-family:Georgia,serif;font-size:11pt;line-height:1.6;margin:1in}p{margin:0 0 .75em}</style></head><body>${paras}</body></html>`;
}

/**
 * Accept a pending suggestion: apply its text edit to the source doc's
 * parsedText, convert to PDF (HTML → Gotenberg Chromium), and materialize a
 * derived draft that re-parses + re-extracts fields. The source stays
 * untouched; the suggestion records derivedDocumentId.
 */
const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/** Original docx bytes for surgical grafting, when the doc came in as .docx. */
async function originalDocxBytes(
  env: CloudflareBindings,
  doc: { originalStorageKey: string | null; originalContentType: string | null }
): Promise<ArrayBuffer | undefined> {
  if (!doc.originalStorageKey || doc.originalContentType !== DOCX_MIME) {
    return undefined;
  }
  const obj = await env.DOCUMENTS_BUCKET.get(doc.originalStorageKey);
  return obj ? obj.arrayBuffer() : undefined;
}

export async function acceptRevision(
  env: CloudflareBindings,
  db: Db,
  organizationId: string,
  publicId: string,
  opts?: { output?: "pdf" | "docx" }
): Promise<ApiRevision> {
  const rows = await db
    .select()
    .from(revisionSuggestions)
    .where(
      and(
        eq(revisionSuggestions.publicId, publicId),
        eq(revisionSuggestions.organizationId, organizationId)
      )
    )
    .limit(1);
  const s = rows[0];
  if (!s) throw new RevisionError("not_found", 404);
  if (s.status !== "pending") throw new RevisionError("already_resolved", 409);

  const docRows = await db
    .select()
    .from(documents)
    .where(eq(documents.id, s.documentId))
    .limit(1);
  const doc = docRows[0];
  if (!doc || doc.status !== "draft") {
    throw new RevisionError("document_not_editable", 400);
  }

  const revised = applyRevisionText(doc.parsedText ?? "", {
    kind: s.kind as RevisionKind,
    anchorQuote: s.anchorQuote,
    proposedText: s.proposedText,
  });

  // output=docx → real tracked-changes OOXML (w:ins/w:del) + a converted
  // PDF preview as the working storageKey. output=pdf → revised text via
  // HTML → PDF. The docx is the round-trip artifact; the PDF is ours.
  let pdfBytes: ArrayBuffer;
  let originalKey: string | null = null;
  let originalContentType: string | null = null;
  if (opts?.output === "docx") {
    const docx = await trackedDocxBytes(env, {
      title: `${doc.name} — redline`,
      text: doc.parsedText ?? "",
      edits: [
        {
          kind: s.kind as RevisionKind,
          anchor_quote: s.anchorQuote,
          proposed_text: s.proposedText,
        },
      ],
      author: "Seal revision",
      docxBytes: await originalDocxBytes(env, doc),
    });
    const docxKey = `uploads/${crypto.randomUUID()}`;
    const docxBytes = new Uint8Array(docx.bytes);
    await env.DOCUMENTS_BUCKET.put(docxKey, docxBytes, {
      httpMetadata: {
        contentType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      },
      customMetadata: {
        organizationId,
        derivedFrom: doc.id,
        revision: s.publicId,
        tracked: "true",
      },
    });
    pdfBytes = await convertBytesToPdf(env, {
      bytes: docx.bytes,
      contentType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      name: `${doc.name} — revised`,
    });
    originalKey = docxKey;
    originalContentType =
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  } else {
    const html = revisedTextToHtml(doc.name, revised);
    pdfBytes = await convertBytesToPdf(env, {
      bytes: new TextEncoder().encode(html),
      contentType: "text/html",
      name: `${doc.name} — revised`,
    });
  }

  const storageId = `uploads/${crypto.randomUUID()}`;
  await env.DOCUMENTS_BUCKET.put(storageId, pdfBytes, {
    httpMetadata: { contentType: "application/pdf" },
    customMetadata: {
      organizationId,
      derivedFrom: doc.id,
      revision: s.publicId,
    },
  });

  const parsed = await parseDocumentFromStorage(env, storageId, {
    organizationId,
  });

  const derivedId = crypto.randomUUID();
  const derivedPublicId = crypto.randomUUID();
  await db.insert(documents).values({
    id: derivedId,
    publicId: derivedPublicId,
    organizationId,
    ownerId: doc.ownerId,
    name: `${doc.name} — revised`,
    status: "draft",
    documentStatus: "active",
    sharingMode: "private",
    storageKey: storageId,
    contentType: "application/pdf",
    size: pdfBytes.byteLength,
    pageCount: parsed?.pageCount ?? null,
    parsedText: parsed?.markdown ?? revised,
    parsedTitle: parsed?.title ?? doc.name,
    parsedFormat: parsed?.format ?? "pdf",
    pdfType: parsed?.pdfType ?? null,
    parentDocumentId: doc.id,
    originalStorageKey: originalKey,
    originalContentType,
    fieldCandidates: parsed?.fieldCandidates.length
      ? JSON.stringify(parsed.fieldCandidates)
      : null,
  });

  const updated = await db
    .update(revisionSuggestions)
    .set({
      status: "accepted",
      derivedDocumentId: derivedId,
      resolvedAt: new Date(),
    })
    .where(eq(revisionSuggestions.id, s.id))
    .returning();
  const row = updated[0];
  if (!row) throw new RevisionError("resolve_failed", 409);
  const api = toApiRevision(row, doc.publicId);
  return { ...api, derived_document_id: derivedPublicId };
}

/**
 * Accept every pending revision on a document in one shot — the derived
 * doc carries all edits (one redline docx for output=docx, one revised
 * PDF otherwise). All accepted revisions point at the same derived doc.
 */
export async function acceptAllPendingForDocument(
  env: CloudflareBindings,
  db: Db,
  organizationId: string,
  documentPublicId: string,
  opts?: { output?: "pdf" | "docx" }
): Promise<{ derived_document_id: string; accepted: number }> {
  const docRows = await db
    .select()
    .from(documents)
    .where(
      and(
        eq(documents.publicId, documentPublicId),
        eq(documents.organizationId, organizationId)
      )
    )
    .limit(1);
  const doc = docRows[0];
  if (!doc) throw new RevisionError("not_found", 404);
  if (doc.status !== "draft") {
    throw new RevisionError("document_not_editable", 400);
  }

  const pending = await db
    .select()
    .from(revisionSuggestions)
    .where(
      and(
        eq(revisionSuggestions.documentId, doc.id),
        eq(revisionSuggestions.organizationId, organizationId),
        eq(revisionSuggestions.status, "pending")
      )
    );
  if (pending.length === 0) {
    throw new RevisionError("nothing_pending", 409);
  }

  const sourceText = doc.parsedText ?? "";
  const edits = pending.map((s) => ({
    kind: s.kind as RevisionKind,
    anchorQuote: s.anchorQuote,
    proposedText: s.proposedText,
  }));

  let pdfBytes: ArrayBuffer;
  let originalKey: string | null = null;
  let originalContentType: string | null = null;
  if (opts?.output === "docx") {
    const docx = await trackedDocxBytes(env, {
      title: `${doc.name} — redline`,
      text: sourceText,
      edits: edits.map((e) => ({
        kind: e.kind,
        anchor_quote: e.anchorQuote,
        proposed_text: e.proposedText,
      })),
      author: "Seal revision",
      docxBytes: await originalDocxBytes(env, doc),
    });
    const docxKey = `uploads/${crypto.randomUUID()}`;
    await env.DOCUMENTS_BUCKET.put(docxKey, new Uint8Array(docx.bytes), {
      httpMetadata: {
        contentType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      },
      customMetadata: {
        organizationId,
        derivedFrom: doc.id,
        tracked: "true",
        bulk: "true",
      },
    });
    pdfBytes = await convertBytesToPdf(env, {
      bytes: docx.bytes,
      contentType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      name: `${doc.name} — revised`,
    });
    originalKey = docxKey;
    originalContentType =
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  } else {
    const { text: revised } = applyAllRevisionsText(sourceText, edits);
    const html = revisedTextToHtml(doc.name, revised);
    pdfBytes = await convertBytesToPdf(env, {
      bytes: new TextEncoder().encode(html),
      contentType: "text/html",
      name: `${doc.name} — revised`,
    });
  }

  const storageId = `uploads/${crypto.randomUUID()}`;
  await env.DOCUMENTS_BUCKET.put(storageId, pdfBytes, {
    httpMetadata: { contentType: "application/pdf" },
    customMetadata: { organizationId, derivedFrom: doc.id, bulk: "true" },
  });

  const parsed = await parseDocumentFromStorage(env, storageId, {
    organizationId,
  });

  const derivedId = crypto.randomUUID();
  const derivedPublicId = crypto.randomUUID();
  await db.insert(documents).values({
    id: derivedId,
    publicId: derivedPublicId,
    organizationId,
    ownerId: doc.ownerId,
    name: `${doc.name} — revised`,
    status: "draft",
    documentStatus: "active",
    sharingMode: "private",
    storageKey: storageId,
    contentType: "application/pdf",
    size: pdfBytes.byteLength,
    pageCount: parsed?.pageCount ?? null,
    parsedText: parsed?.markdown ?? sourceText,
    parsedTitle: parsed?.title ?? doc.name,
    parsedFormat: parsed?.format ?? "pdf",
    pdfType: parsed?.pdfType ?? null,
    parentDocumentId: doc.id,
    originalStorageKey: originalKey,
    originalContentType,
    fieldCandidates: parsed?.fieldCandidates.length
      ? JSON.stringify(parsed.fieldCandidates)
      : null,
  });

  const now = new Date();
  await db
    .update(revisionSuggestions)
    .set({ status: "accepted", derivedDocumentId: derivedId, resolvedAt: now })
    .where(
      and(
        eq(revisionSuggestions.documentId, doc.id),
        eq(revisionSuggestions.organizationId, organizationId),
        eq(revisionSuggestions.status, "pending")
      )
    );

  return { derived_document_id: derivedPublicId, accepted: pending.length };
}

export async function rejectRevision(
  db: Db,
  organizationId: string,
  publicId: string
): Promise<ApiRevision> {
  const updated = await db
    .update(revisionSuggestions)
    .set({ status: "rejected", resolvedAt: new Date() })
    .where(
      and(
        eq(revisionSuggestions.publicId, publicId),
        eq(revisionSuggestions.organizationId, organizationId),
        eq(revisionSuggestions.status, "pending")
      )
    )
    .returning();
  const row = updated[0];
  if (!row) {
    const rows = await db
      .select()
      .from(revisionSuggestions)
      .where(eq(revisionSuggestions.publicId, publicId))
      .limit(1);
    if (!rows[0] || rows[0].organizationId !== organizationId) {
      throw new RevisionError("not_found", 404);
    }
    throw new RevisionError("already_resolved", 409);
  }
  const docRows = await db
    .select({ publicId: documents.publicId })
    .from(documents)
    .where(eq(documents.id, row.documentId))
    .limit(1);
  return toApiRevision(row, docRows[0]?.publicId);
}

export async function listRevisions(
  db: Db,
  organizationId: string,
  documentPublicId?: string,
  status?: "pending" | "accepted" | "rejected"
): Promise<ApiRevision[]> {
  const conditions = [eq(revisionSuggestions.organizationId, organizationId)];
  if (status) conditions.push(eq(revisionSuggestions.status, status));
  if (documentPublicId) {
    const doc = await loadOrgDoc(db, organizationId, documentPublicId);
    if (!doc) return [];
    conditions.push(eq(revisionSuggestions.documentId, doc.id));
  }
  const rows = await db
    .select()
    .from(revisionSuggestions)
    .where(and(...conditions))
    .orderBy(revisionSuggestions.createdAt);
  const docIds = [...new Set(rows.map((r) => r.documentId))];
  const docMap = new Map<string, string>();
  if (docIds.length > 0) {
    const docRows = await db
      .select({ id: documents.id, publicId: documents.publicId })
      .from(documents)
      .where(inArray(documents.id, docIds));
    for (const d of docRows) docMap.set(d.id, d.publicId);
  }
  return rows.map((r) => toApiRevision(r, docMap.get(r.documentId)));
}
