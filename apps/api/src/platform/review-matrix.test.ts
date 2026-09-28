import { describe, expect, test } from "vitest";

import {
  assertCellCitations,
  matrixCellCount,
  ZReviewMatrixCreate,
  type ReviewCell,
} from "./review-matrix.js";

describe("review-matrix contract", () => {
  test("create schema accepts a minimal matrix", () => {
    const parsed = ZReviewMatrixCreate.parse({
      title: "NDA red-flag pass",
      model: "echo/test",
      columns: [{ index: 0, name: "Termination", prompt: "Find termination." }],
      documentIds: ["doc_1"],
    });
    expect(parsed.columns).toHaveLength(1);
    expect(matrixCellCount(2, 3)).toBe(6);
  });

  test("done cells require citations", () => {
    const bad: ReviewCell = {
      id: "c1",
      rowId: "r1",
      columnIndex: 0,
      status: "done",
      summary: "ok",
      flag: "green",
      reasoning: null,
      citations: [],
    };
    expect(() => assertCellCitations(bad)).toThrow(/citation/);

    assertCellCitations({
      ...bad,
      citations: [{ documentId: "doc_1", quote: "either party may terminate" }],
    });
  });
});
