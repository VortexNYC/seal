import { describe, expect, test } from "vitest";

import {
  extractLikelyQuote,
  groundCitation,
} from "./review-matrix-store.js";

describe("review-matrix-store grounding", () => {
  test("empty document yields not_found", () => {
    expect(groundCitation("doc_1", "", "anything")).toEqual({
      documentId: "doc_1",
      quote: "not_found",
    });
  });

  test("candidate quote must appear in document text", () => {
    const text = "Either party may terminate on thirty days notice.";
    expect(groundCitation("doc_1", text, "terminate on thirty")).toEqual({
      documentId: "doc_1",
      quote: "terminate on thirty",
    });
    expect(groundCitation("doc_1", text, "hallucinated clause").quote).toBe(
      text.slice(0, 240)
    );
  });

  test("extractLikelyQuote finds overlapping chunk", () => {
    const text = "Alpha beta gamma delta epsilon zeta.";
    const quote = extractLikelyQuote(
      "noise Alpha beta gamma delta more",
      text
    );
    expect(quote).toBeTruthy();
    expect(text.includes(quote!)).toBe(true);
    expect("noise Alpha beta gamma delta more".includes(quote!)).toBe(true);
    expect(extractLikelyQuote("totally unrelated", text)).toBeNull();
  });
});
