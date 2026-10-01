/**
 * ADR-006 / SEA-80 — review matrix persistence + cell generation.
 *
 * Echo/provider sync generate is intentional for the poll-first MVP.
 * Minutes-long real-model runs move to a Durable Object / Workflow later;
 * do not hang the Hono request lifecycle on those.
 */

import { and, count, desc, eq, inArray, or } from "drizzle-orm";

import { createD1 } from "../global/db.js";
import {
  documents,
  reviewCells,
  reviewMatrices,
  reviewRows,
} from "../global/schema.js";
import {
  getProvider,
  resolveAvailableModel,
  streamKeyedModel,
} from "./llm/index.js";
import { ensureProvidersRegistered } from "./llm/providers.js";
import { anchorQuote, type PdfWord } from "./quote-anchor.js";
import {
  assertCellCitations,
  ZReviewColumn,
  type ReviewCell,
  type ReviewCitation,
  type ReviewColumn,
  type ReviewFlag,
  type ReviewMatrixCreate,
} from "./review-matrix.js";

type Db = ReturnType<typeof createD1>;

const NOT_FOUND_QUOTE = "not_found";
const MAX_ECHO_QUOTE = 240;

export type ApiReviewCell = {
  id: string;
  row_id: string;
  column_index: number;
  status: ReviewCell["status"];
  summary: string | null;
  flag: ReviewFlag | null;
  reasoning: string | null;
  citations: ReviewCitation[];
};

export type ApiReviewRow = {
  id: string;
  document_id: string;
  cells: ApiReviewCell[];
};

export type ApiReviewMatrix = {
  id: string;
  title: string;
  model: string;
  status: string;
  columns: ReviewColumn[];
  rows: ApiReviewRow[];
  created_at: string;
  updated_at: string;
};

function newPublicId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
}

function parseColumns(raw: string): ReviewColumn[] {
  const parsed: unknown = JSON.parse(raw);
  return ZReviewColumn.array().parse(parsed);
}

function parseCitations(raw: string): ReviewCitation[] {
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) return [];
  return parsed.filter(
    (c): c is ReviewCitation =>
      typeof c === "object" &&
      c !== null &&
      typeof (c as ReviewCitation).documentId === "string" &&
      typeof (c as ReviewCitation).quote === "string"
  );
}

function toApiCell(row: {
  publicId: string;
  rowPublicId: string;
  columnIndex: number;
  status: string;
  summary: string | null;
  flag: string | null;
  reasoning: string | null;
  citations: string;
}): ApiReviewCell {
  const status = row.status as ReviewCell["status"];
  const flag =
    row.flag === "green" ||
    row.flag === "amber" ||
    row.flag === "red" ||
    row.flag === "grey"
      ? row.flag
      : null;
  return {
    id: row.publicId,
    row_id: row.rowPublicId,
    column_index: row.columnIndex,
    status,
    summary: row.summary,
    flag,
    reasoning: row.reasoning,
    citations: parseCitations(row.citations),
  };
}

/**
 * Pick a grounded quote from document text, or the literal not_found.
 * A model's explicit "not_found" or a quote absent from the text must NOT
 * be silently grounded — the citation contract forbids invented anchors.
 */
export function groundCitation(
  documentPublicId: string,
  parsedText: string | null | undefined,
  candidate: string | null | undefined
): ReviewCitation {
  const text = (parsedText ?? "").trim();
  const needle = (candidate ?? "").trim();
  if (!text || needle === NOT_FOUND_QUOTE) {
    return { documentId: documentPublicId, quote: NOT_FOUND_QUOTE };
  }
  if (needle && text.includes(needle)) {
    return {
      documentId: documentPublicId,
      quote: needle.slice(0, MAX_ECHO_QUOTE),
    };
  }
  if (needle) {
    // Candidate quote not present in the document — reject as ungrounded.
    return { documentId: documentPublicId, quote: NOT_FOUND_QUOTE };
  }
  // No candidate supplied: fall back to the first contiguous chunk (echo).
  const chunk = text.slice(0, MAX_ECHO_QUOTE);
  return { documentId: documentPublicId, quote: chunk || NOT_FOUND_QUOTE };
}

const REVIEW_FLAGS: readonly ReviewFlag[] = ["green", "amber", "red", "grey"];

function parseFlag(value: unknown): ReviewFlag | null {
  return REVIEW_FLAGS.includes(value as ReviewFlag)
    ? (value as ReviewFlag)
    : null;
}

/**
 * Pull the first JSON object out of a model reply (code-fence tolerant).
 * Providers that ignore the schema still surface raw text as the summary.
 */
function extractJsonObject(raw: string): Record<string, unknown> | null {
  const trimmed = raw.trim();
  const start = trimmed.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < trimmed.length; i++) {
    const ch = trimmed[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === "\\") {
      escaped = true;
      continue;
    }
    if (ch === '"') inString = !inString;
    if (inString) continue;
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) {
        try {
          const parsed: unknown = JSON.parse(trimmed.slice(start, i + 1));
          if (
            parsed !== null &&
            typeof parsed === "object" &&
            !Array.isArray(parsed)
          ) {
            return parsed as Record<string, unknown>;
          }
          return null;
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

async function collectStreamResult(
  keyedModel: string,
  prompt: string
): Promise<{
  text: string;
  usage: { inputTokens?: number; outputTokens?: number } | undefined;
}> {
  let out = "";
  let usage: { inputTokens?: number; outputTokens?: number } | undefined;
  for await (const part of streamKeyedModel(keyedModel, {
    messages: [{ role: "user", content: prompt }],
  })) {
    if (part.type === "text") out += part.text;
    if (part.type === "finish" && part.usage) usage = part.usage;
  }
  return { text: out, usage };
}

export async function createReviewMatrix(
  db: Db,
  args: {
    organizationId: string;
    ownerId: string;
    input: ReviewMatrixCreate;
  }
): Promise<ApiReviewMatrix> {
  const { organizationId, ownerId, input } = args;

  const docRows = await db
    .select({
      id: documents.id,
      publicId: documents.publicId,
    })
    .from(documents)
    .where(
      and(
        eq(documents.organizationId, organizationId),
        or(
          inArray(documents.publicId, input.documentIds),
          inArray(documents.id, input.documentIds)
        )
      )
    );

  if (docRows.length !== input.documentIds.length) {
    const found = new Set(docRows.map((d) => d.publicId));
    const missing = input.documentIds.filter((id) => !found.has(id));
    throw new ReviewMatrixError("documents_not_found", 404, {
      missing,
    });
  }

  // pack_id expansion happens at the route layer; by the time the store is
  // called, columns + model must be resolved values.
  const columns = input.columns;
  const model = input.model;
  if (!columns || columns.length === 0) {
    throw new ReviewMatrixError("invalid_input", 400, {
      columns: "required",
    });
  }
  if (!model) {
    throw new ReviewMatrixError("invalid_input", 400, { model: "required" });
  }

  const matrixId = crypto.randomUUID();
  const matrixPublicId = newPublicId("rm");
  const now = new Date();
  const columnsJson = JSON.stringify(columns);

  await db.insert(reviewMatrices).values({
    id: matrixId,
    publicId: matrixPublicId,
    organizationId,
    ownerId,
    title: input.title,
    model,
    status: "draft",
    columnsConfig: columnsJson,
    createdAt: now,
    updatedAt: now,
  });

  const rowInserts: {
    id: string;
    publicId: string;
    matrixId: string;
    documentId: string;
    createdAt: Date;
    documentPublicId: string;
  }[] = [];
  const cellInserts: {
    id: string;
    publicId: string;
    rowId: string;
    columnIndex: number;
    status: string;
    citations: string;
    createdAt: Date;
    updatedAt: Date;
  }[] = [];

  for (const doc of docRows) {
    const rowId = crypto.randomUUID();
    const rowPublicId = newPublicId("rr");
    rowInserts.push({
      id: rowId,
      publicId: rowPublicId,
      matrixId,
      documentId: doc.id,
      createdAt: now,
      documentPublicId: doc.publicId,
    });
    for (const col of columns) {
      cellInserts.push({
        id: crypto.randomUUID(),
        publicId: newPublicId("rc"),
        rowId,
        columnIndex: col.index,
        status: "pending",
        citations: "[]",
        createdAt: now,
        updatedAt: now,
      });
    }
  }

  if (rowInserts.length > 0) {
    await db
      .insert(reviewRows)
      .values(rowInserts.map(({ documentPublicId: _d, ...row }) => row));
  }
  if (cellInserts.length > 0) {
    await db.insert(reviewCells).values(cellInserts);
  }

  return getReviewMatrix(db, organizationId, matrixPublicId);
}

export async function getReviewMatrix(
  db: Db,
  organizationId: string,
  matrixPublicId: string
): Promise<ApiReviewMatrix> {
  const matrixRows = await db
    .select()
    .from(reviewMatrices)
    .where(
      and(
        eq(reviewMatrices.publicId, matrixPublicId),
        eq(reviewMatrices.organizationId, organizationId)
      )
    )
    .limit(1);
  const matrix = matrixRows[0];
  if (!matrix) {
    throw new ReviewMatrixError("not_found", 404);
  }

  const rows = await db
    .select({
      id: reviewRows.id,
      publicId: reviewRows.publicId,
      documentId: reviewRows.documentId,
      documentPublicId: documents.publicId,
    })
    .from(reviewRows)
    .innerJoin(documents, eq(documents.id, reviewRows.documentId))
    .where(eq(reviewRows.matrixId, matrix.id));

  const rowIds = rows.map((r) => r.id);
  const cells =
    rowIds.length === 0
      ? []
      : await db
          .select()
          .from(reviewCells)
          .where(inArray(reviewCells.rowId, rowIds));

  const rowPublicById = new Map(rows.map((r) => [r.id, r.publicId]));
  const cellsByRow = new Map<string, ApiReviewCell[]>();
  for (const cell of cells) {
    const rowPublicId = rowPublicById.get(cell.rowId);
    if (!rowPublicId) continue;
    const list = cellsByRow.get(cell.rowId) ?? [];
    list.push(
      toApiCell({
        publicId: cell.publicId,
        rowPublicId,
        columnIndex: cell.columnIndex,
        status: cell.status,
        summary: cell.summary,
        flag: cell.flag,
        reasoning: cell.reasoning,
        citations: cell.citations,
      })
    );
    cellsByRow.set(cell.rowId, list);
  }

  return {
    id: matrix.publicId,
    title: matrix.title,
    model: matrix.model,
    status: matrix.status,
    columns: parseColumns(matrix.columnsConfig),
    rows: rows.map((row) => ({
      id: row.publicId,
      document_id: row.documentPublicId,
      cells: (cellsByRow.get(row.id) ?? []).sort(
        (a, b) => a.column_index - b.column_index
      ),
    })),
    created_at: matrix.createdAt.toISOString(),
    updated_at: matrix.updatedAt.toISOString(),
  };
}

export async function generateReviewMatrix(
  db: Db,
  env: CloudflareBindings,
  organizationId: string,
  matrixPublicId: string
): Promise<ApiReviewMatrix> {
  ensureProvidersRegistered(env);

  const matrixRows = await db
    .select()
    .from(reviewMatrices)
    .where(
      and(
        eq(reviewMatrices.publicId, matrixPublicId),
        eq(reviewMatrices.organizationId, organizationId)
      )
    )
    .limit(1);
  const matrix = matrixRows[0];
  if (!matrix) {
    throw new ReviewMatrixError("not_found", 404);
  }

  const effectiveModel = resolveAvailableModel(matrix.model);
  const parsedModel = effectiveModel.includes("/") ? effectiveModel : null;
  if (!parsedModel) {
    throw new ReviewMatrixError("invalid_model", 400, {
      model: matrix.model,
    });
  }
  const providerId = parsedModel.slice(0, parsedModel.indexOf("/"));
  if (!getProvider(providerId)) {
    throw new ReviewMatrixError("unknown_provider", 400, {
      provider: providerId,
    });
  }

  const columns = parseColumns(matrix.columnsConfig);
  const columnByIndex = new Map(columns.map((c) => [c.index, c]));

  const rows = await db
    .select({
      rowId: reviewRows.id,
      rowPublicId: reviewRows.publicId,
      documentId: reviewRows.documentId,
      documentPublicId: documents.publicId,
      parsedText: documents.parsedText,
      storageKey: documents.storageKey,
    })
    .from(reviewRows)
    .innerJoin(documents, eq(documents.id, reviewRows.documentId))
    .where(eq(reviewRows.matrixId, matrix.id));

  const rowIds = rows.map((r) => r.rowId);
  const pendingCells =
    rowIds.length === 0
      ? []
      : await db
          .select()
          .from(reviewCells)
          .where(
            and(
              inArray(reviewCells.rowId, rowIds),
              inArray(reviewCells.status, ["pending", "error"])
            )
          );

  await db
    .update(reviewMatrices)
    .set({ status: "generating", updatedAt: new Date() })
    .where(eq(reviewMatrices.id, matrix.id));

  const rowById = new Map(rows.map((r) => [r.rowId, r]));

  // Words are fetched once per document — many cells quote the same row.
  const wordsCache = new Map<string, Promise<PdfWord[]>>();

  for (const cell of pendingCells) {
    const row = rowById.get(cell.rowId);
    if (!row) continue;
    const column = columnByIndex.get(cell.columnIndex);
    if (!column) continue;

    await db
      .update(reviewCells)
      .set({ status: "generating", updatedAt: new Date() })
      .where(eq(reviewCells.id, cell.id));

    const startedAt = Date.now();
    try {
      const prompt = [
        `Column: ${column.name}`,
        `Task: ${column.prompt}`,
        "",
        "Document text:",
        row.parsedText?.trim() || "(empty)",
        "",
        "Respond with a single JSON object and nothing else:",
        '{ "summary": string, "flag": "green"|"amber"|"red"|"grey", "reasoning": string, "quote": string }',
        '"quote" must be a verbatim contiguous excerpt from the document text,',
        `or the literal ${NOT_FOUND_QUOTE} when the column's question is not answered.`,
      ].join("\n");

      const result = await collectStreamResult(effectiveModel, prompt);
      const tokensUsed =
        result.usage?.inputTokens !== undefined ||
        result.usage?.outputTokens !== undefined
          ? (result.usage.inputTokens ?? 0) + (result.usage.outputTokens ?? 0)
          : null;

      const parsed = extractJsonObject(result.text);
      const rawSummary =
        typeof parsed?.summary === "string" && parsed.summary.trim()
          ? parsed.summary.trim().slice(0, 500)
          : result.text.trim().slice(0, 500) || column.name;
      const reasoning =
        typeof parsed?.reasoning === "string" && parsed.reasoning.trim()
          ? parsed.reasoning.trim().slice(0, 1000)
          : null;
      const candidateQuote =
        typeof parsed?.quote === "string" && parsed.quote.trim()
          ? parsed.quote.trim()
          : extractLikelyQuote(result.text, row.parsedText);
      const citation = groundCitation(
        row.documentPublicId,
        row.parsedText,
        candidateQuote
      );
      const grounded = citation.quote !== NOT_FOUND_QUOTE;
      if (grounded && row.storageKey) {
        // Best-effort page/bbox anchor — never fails the cell.
        try {
          const anchor = await anchorQuote(
            env,
            row.storageKey,
            citation.quote,
            wordsCache
          );
          if (anchor) {
            citation.page = anchor.page;
            citation.bbox = anchor.bbox;
          }
        } catch {
          // Anchoring is additive; a quote-only citation is still valid.
        }
      }
      const flag: ReviewFlag =
        parseFlag(parsed?.flag) ?? (grounded ? "green" : "grey");

      const done: ReviewCell = {
        id: cell.publicId,
        rowId: row.rowPublicId,
        columnIndex: cell.columnIndex,
        status: "done",
        summary: grounded ? rawSummary : "not found",
        flag,
        reasoning,
        citations: [citation],
      };
      assertCellCitations(done);

      await db
        .update(reviewCells)
        .set({
          status: "done",
          summary: done.summary,
          flag: done.flag,
          reasoning: done.reasoning,
          citations: JSON.stringify(done.citations),
          modelUsed: effectiveModel,
          tokensUsed,
          processingTimeMs: Date.now() - startedAt,
          updatedAt: new Date(),
        })
        .where(eq(reviewCells.id, cell.id));
    } catch (err) {
      const message =
        err instanceof Error ? err.message.slice(0, 500) : "generate_failed";
      await db
        .update(reviewCells)
        .set({
          status: "error",
          summary: null,
          flag: null,
          reasoning: message,
          citations: "[]",
          updatedAt: new Date(),
        })
        .where(eq(reviewCells.id, cell.id));
    }
  }

  await db
    .update(reviewMatrices)
    .set({ status: "ready", updatedAt: new Date() })
    .where(eq(reviewMatrices.id, matrix.id));

  return getReviewMatrix(db, organizationId, matrixPublicId);
}

/** Lightweight list for the UI index — no row/cell fan-out. */
export async function listReviewMatrices(
  db: Db,
  organizationId: string
): Promise<
  {
    id: string;
    title: string;
    model: string;
    status: string;
    row_count: number;
    column_count: number;
    created_at: string;
    updated_at: string;
  }[]
> {
  const rows = await db
    .select()
    .from(reviewMatrices)
    .where(eq(reviewMatrices.organizationId, organizationId))
    .orderBy(desc(reviewMatrices.createdAt));
  const rowCounts = new Map<string, number>();
  if (rows.length > 0) {
    const counts = await db
      .select({ matrixId: reviewRows.matrixId, n: count() })
      .from(reviewRows)
      .where(
        inArray(
          reviewRows.matrixId,
          rows.map((m) => m.id)
        )
      )
      .groupBy(reviewRows.matrixId);
    for (const r of counts) rowCounts.set(r.matrixId, r.n);
  }
  return rows.map((m) => {
    let columnCount = 0;
    try {
      columnCount = ZReviewColumn.array().parse(
        JSON.parse(m.columnsConfig)
      ).length;
    } catch {
      columnCount = 0;
    }
    return {
      id: m.publicId,
      title: m.title,
      model: m.model,
      status: m.status,
      row_count: rowCounts.get(m.id) ?? 0,
      column_count: columnCount,
      created_at: m.createdAt.toISOString(),
      updated_at: m.updatedAt.toISOString(),
    };
  });
}

/**
 * Find the longest substring of `raw` (≤ MAX_ECHO_QUOTE) that appears in
 * `parsedText`. Used so echo/provider noise can still ground a citation.
 */
export function extractLikelyQuote(
  raw: string,
  parsedText: string | null | undefined
): string | null {
  const text = (parsedText ?? "").trim();
  if (!text) return null;
  const cleaned = raw.trim();
  if (!cleaned) return null;
  if (text.includes(cleaned.slice(0, MAX_ECHO_QUOTE))) {
    return cleaned.slice(0, MAX_ECHO_QUOTE);
  }
  const minLen = Math.min(12, text.length);
  for (
    let len = Math.min(MAX_ECHO_QUOTE, text.length);
    len >= minLen;
    len -= 8
  ) {
    for (let i = 0; i + len <= text.length; i += 8) {
      const chunk = text.slice(i, i + len);
      if (cleaned.includes(chunk)) return chunk;
    }
  }
  return null;
}

export class ReviewMatrixError extends Error {
  readonly code: string;
  readonly status: 400 | 404;
  readonly details?: Record<string, unknown>;

  constructor(
    code: string,
    status: 400 | 404,
    details?: Record<string, unknown>
  ) {
    super(code);
    this.name = "ReviewMatrixError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}
