/**
 * ADR-006 Phase 2 — review matrix contract (tabular legal extraction).
 *
 * Persistence + agent cell writes: `review-matrix-store.ts` + `POST/GET/PATCH /api/v1/reviews`.
 */

import { z } from "zod";

export const REVIEW_CELL_STATUSES = [
  "pending",
  "generating",
  "done",
  "error",
] as const;
export type ReviewCellStatus = (typeof REVIEW_CELL_STATUSES)[number];

export const REVIEW_FLAGS = ["green", "amber", "red", "grey"] as const;
export type ReviewFlag = (typeof REVIEW_FLAGS)[number];

export const ZReviewCitation = z.object({
  documentId: z.string().min(1),
  page: z.number().int().positive().optional(),
  /** Normalized 0–1 page geometry of the quoted span (best-effort). */
  bbox: z
    .object({
      x: z.number(),
      y: z.number(),
      width: z.number(),
      height: z.number(),
    })
    .optional(),
  quote: z.string().min(1),
});
export type ReviewCitation = z.infer<typeof ZReviewCitation>;

export const ZReviewColumn = z.object({
  index: z.number().int().nonnegative(),
  name: z.string().min(1).max(120),
  prompt: z.string().min(1).max(4000),
});
export type ReviewColumn = z.infer<typeof ZReviewColumn>;

export const ZReviewMatrixCreate = z.object({
  title: z.string().min(1).max(200),
  /** Provenance label — which agent/model filled cells. Never executed by Seal. */
  model: z.string().min(1).max(120).optional(),
  /** Optional when pack_id supplies columns. Explicit values win. */
  columns: z.array(ZReviewColumn).min(1).max(32).optional(),
  /** Review pack to expand into columns/model (builtin/* or pack_*). */
  pack_id: z.string().min(1).max(64).optional(),
  documentIds: z.array(z.string().min(1)).min(1).max(100),
});
export type ReviewMatrixCreate = z.infer<typeof ZReviewMatrixCreate>;

export const ZReviewCell = z.object({
  id: z.string(),
  rowId: z.string(),
  columnIndex: z.number().int().nonnegative(),
  status: z.enum(REVIEW_CELL_STATUSES),
  summary: z.string().nullable(),
  flag: z.enum(REVIEW_FLAGS).nullable(),
  reasoning: z.string().nullable(),
  citations: z.array(ZReviewCitation),
});
export type ReviewCell = z.infer<typeof ZReviewCell>;

/**
 * A done cell must carry ≥1 citation (legal-primitives-spec §2.2).
 * Generating/pending/error may be empty.
 */
export function assertCellCitations(cell: ReviewCell): void {
  if (cell.status !== "done") return;
  if (cell.citations.length < 1) {
    throw new Error("done review cell requires ≥1 citation");
  }
}

export function matrixCellCount(
  documentCount: number,
  columnCount: number
): number {
  return documentCount * columnCount;
}

/**
 * Agent-authored cell write — the model doing the review is the caller's,
 * not Seal's. Seal grounds `quote` against the row document's parsed text;
 * ungrounded quotes collapse to not_found, never invent an anchor.
 */
export const ZReviewCellWrite = z.object({
  /** Cell public id — or row_id + column_index. */
  cell_id: z.string().min(1).optional(),
  row_id: z.string().min(1).optional(),
  column_index: z.number().int().nonnegative().optional(),
  summary: z.string().max(500),
  flag: z.enum(REVIEW_FLAGS).optional(),
  reasoning: z.string().max(1000).optional(),
  /** Verbatim excerpt — grounded server-side against the row document. */
  quote: z.string().max(500),
});
export type ReviewCellWrite = z.infer<typeof ZReviewCellWrite>;

export const ZReviewCellsWrite = z.object({
  cells: z.array(ZReviewCellWrite).min(1).max(256),
  /** Caller's model label, e.g. "claude-opus-4-6" — recorded, not billed. */
  model_used: z.string().min(1).max(120).optional(),
});
export type ReviewCellsWrite = z.infer<typeof ZReviewCellsWrite>;
