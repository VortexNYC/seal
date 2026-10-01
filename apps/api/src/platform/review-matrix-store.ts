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
import { anchorQuote, type PdfWord } from "./quote-anchor.js";
import {
  assertCellCitations,
  ZReviewColumn,
  type ReviewCell,
  type ReviewCitation,
  type ReviewCellWrite,
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
  if (!columns || columns.length === 0) {
    throw new ReviewMatrixError("invalid_input", 400, {
      columns: "required",
    });
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

/** Lightweight list for the UI index — no row/cell fan-out. */
export async function listReviewMatrices(
  db: Db,
  organizationId: string
): Promise<
  {
    id: string;
    title: string;
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

/**
 * Agent-authored cell results — the caller's model did the reasoning; Seal
 * grounds each submitted quote against the row's parsed text so agents can
 * never anchor on invented text, then flips the matrix to ready when all
 * cells resolve.
 */
export async function writeReviewCells(
  env: CloudflareBindings,
  organizationId: string,
  matrixPublicId: string,
  writes: ReviewCellWrite[],
  modelUsed?: string
): Promise<{ updated: number; matrixStatus: string }> {
  const db = createD1(env.D1);
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
      rowId: reviewRows.id,
      rowPublicId: reviewRows.publicId,
      documentPublicId: documents.publicId,
      parsedText: documents.parsedText,
    })
    .from(reviewRows)
    .innerJoin(documents, eq(documents.id, reviewRows.documentId))
    .where(eq(reviewRows.matrixId, matrix.id));
  const rowById = new Map(rows.map((r) => [r.rowId, r]));
  const rowByPublicId = new Map(rows.map((r) => [r.rowPublicId, r]));

  const cells = await db
    .select()
    .from(reviewCells)
    .innerJoin(reviewRows, eq(reviewRows.id, reviewCells.rowId))
    .where(eq(reviewRows.matrixId, matrix.id));
  const cellByPublicId = new Map(
    cells.map((c) => [c.review_cells.publicId, c.review_cells])
  );
  const cellByRowCol = new Map(
    cells.map((c) => [
      `${c.review_cells.rowId}:${c.review_cells.columnIndex}`,
      c.review_cells,
    ])
  );

  let updated = 0;
  for (const write of writes) {
    let cell = write.cell_id ? cellByPublicId.get(write.cell_id) : undefined;
    if (
      !cell &&
      write.row_id !== undefined &&
      write.column_index !== undefined
    ) {
      const row = rowByPublicId.get(write.row_id);
      if (row) cell = cellByRowCol.get(`${row.rowId}:${write.column_index}`);
    }
    if (!cell) {
      throw new ReviewMatrixError("cell_not_found", 400, {
        cell_id: write.cell_id ?? write.row_id ?? null,
      });
    }
    const row = rowById.get(cell.rowId);
    if (!row) continue;

    const citation = groundCitation(
      row.documentPublicId,
      row.parsedText,
      write.quote
    );
    const grounded = citation.quote !== NOT_FOUND_QUOTE;

    const done: ReviewCell = {
      id: cell.publicId,
      rowId: row.rowPublicId,
      columnIndex: cell.columnIndex,
      status: "done",
      summary: grounded ? write.summary : "not found",
      flag: write.flag ?? (grounded ? "grey" : "grey"),
      reasoning: write.reasoning ?? null,
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
        modelUsed: modelUsed ?? "agent",
        updatedAt: new Date(),
      })
      .where(eq(reviewCells.id, cell.id));
    updated += 1;
  }

  // All cells resolved → matrix is ready.
  const unresolved = await db
    .select({ n: count() })
    .from(reviewCells)
    .innerJoin(reviewRows, eq(reviewRows.id, reviewCells.rowId))
    .where(
      and(
        eq(reviewRows.matrixId, matrix.id),
        or(
          eq(reviewCells.status, "pending"),
          eq(reviewCells.status, "generating")
        )
      )
    );
  const remaining = unresolved[0]?.n ?? 0;
  if (remaining === 0 && matrix.status !== "ready") {
    await db
      .update(reviewMatrices)
      .set({ status: "ready", updatedAt: new Date() })
      .where(eq(reviewMatrices.id, matrix.id));
  }

  return { updated, matrixStatus: remaining === 0 ? "ready" : matrix.status };
}
