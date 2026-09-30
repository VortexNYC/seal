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

import { chunkWords } from "./pdf-chunks.js";

describe("chunkWords", () => {
  it("groups words into anchored lines", () => {
    const words = [
      { page: 1, x: 0.1, y: 0.1, w: 0.05, h: 0.02, t: "Clause" },
      { page: 1, x: 0.16, y: 0.1, w: 0.05, h: 0.02, t: "one" },
      // New y → new line
      { page: 1, x: 0.1, y: 0.13, w: 0.05, h: 0.02, t: "Second" },
      { page: 1, x: 0.16, y: 0.13, w: 0.05, h: 0.02, t: "line" },
      // New page
      { page: 2, x: 0.1, y: 0.1, w: 0.05, h: 0.02, t: "Page" },
      { page: 2, x: 0.15, y: 0.1, w: 0.05, h: 0.02, t: "two" },
    ];
    const chunks = chunkWords(words);
    expect(chunks).toHaveLength(3);
    expect(chunks[0]?.text).toBe("Clause one");
    expect(chunks[0]?.page).toBe(1);
    expect(chunks[0]?.bbox.x).toBeCloseTo(0.1);
    expect(chunks[1]?.text).toBe("Second line");
    expect(chunks[2]?.page).toBe(2);
  });

  it("returns empty for no words", () => {
    expect(chunkWords([])).toEqual([]);
  });
});
