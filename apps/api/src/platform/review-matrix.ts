/**
 * ADR-006 Phase 2 — review matrix contract (tabular legal extraction).
 *
 * Persistence + generate: `review-matrix-store.ts` + `POST/GET /api/v1/reviews`.
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
  /** Optional when pack_id supplies a default model. */
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
