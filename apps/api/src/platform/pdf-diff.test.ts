import { describe, expect, it } from "vitest";

import { diffPageTexts, splitTextByPage } from "./pdf-diff.js";

describe("pdf-diff", () => {
  it("splits pdftotext output into pages on form feeds", () => {
    expect(splitTextByPage("a\nb\fc\nd")).toEqual([
      ["a", "b"],
      ["c", "d"],
    ]);
  });

  it("reports per-page line additions and removals", () => {
    const result = diffPageTexts(
      "same\nremoved line\nfpage two same\f",
      "same\nadded line\nfpage two same\f"
    );
    expect(result.pagesDifferent).toBe(1);
    expect(result.linesAdded).toBe(1);
    expect(result.linesRemoved).toBe(1);
    expect(result.pages[0]?.page).toBe(1);
    expect(result.pages[0]?.added).toEqual(["added line"]);
    expect(result.pages[0]?.removed).toEqual(["removed line"]);
  });

  it("reports zero diff for identical text and ignores blank lines", () => {
    const result = diffPageTexts("a\n\nb\f", "a\nb\f");
    expect(result.pagesDifferent).toBe(0);
    expect(result.pages).toEqual([]);
  });

  it("flags pages present on only one side", () => {
    const result = diffPageTexts("one\f", "one\fextra page\n");
    expect(result.pagesDifferent).toBe(1);
    expect(result.pages[0]?.page).toBe(2);
    expect(result.pages[0]?.added).toEqual(["extra page"]);
  });
});
