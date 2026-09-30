import { describe, expect, it } from "vitest";

import { locateQuoteInWords, type PdfWord } from "./quote-anchor.js";

function word(
  page: number,
  t: string,
  x = 0.1,
  y = 0.1,
  w = 0.05,
  h = 0.02
): PdfWord {
  return { page, x, y, w, h, t };
}

describe("locateQuoteInWords", () => {
  const words = [
    word(1, "Either"),
    word(1, "party", 0.16),
    word(1, "may", 0.22),
    word(1, "terminate", 0.27),
    word(2, "indemnify", 0.1, 0.2),
    word(2, "against", 0.2, 0.2),
    word(2, "claims", 0.3, 0.2),
  ];

  it("anchors a full quote to a union bbox on the right page", () => {
    const anchor = locateQuoteInWords(words, "either party may terminate");
    expect(anchor?.page).toBe(1);
    expect(anchor?.bbox.x).toBeCloseTo(0.1);
    expect(anchor?.bbox.width).toBeCloseTo(0.22); // 0.1 → 0.32
  });

  it("matches across pages when tokens align", () => {
    const anchor = locateQuoteInWords(words, "indemnify against claims");
    expect(anchor?.page).toBe(2);
  });

  it("normalizes case and punctuation edges", () => {
    const anchor = locateQuoteInWords(words, "Either Party, may terminate!");
    expect(anchor?.page).toBe(1);
  });

  it("prefix-anchors when the quote is longer than the span", () => {
    const anchor = locateQuoteInWords(
      words,
      "either party may terminate on thirty days written notice"
    );
    expect(anchor?.page).toBe(1);
    expect(anchor?.bbox.x).toBeCloseTo(0.1);
  });

  it("returns null for a quote absent from the document", () => {
    expect(locateQuoteInWords(words, "never found anywhere")).toBeNull();
    expect(locateQuoteInWords([], "anything")).toBeNull();
  });
});
