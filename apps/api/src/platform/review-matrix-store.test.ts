import { describe, expect, test } from "vitest";

import { groundCitation } from "./review-matrix-store.js";

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
    // An absent quote must never be silently anchored — agents can't
    // invent citations; the contract collapses to the literal not_found.
    expect(groundCitation("doc_1", text, "hallucinated clause").quote).toBe(
      "not_found"
    );
  });
});
