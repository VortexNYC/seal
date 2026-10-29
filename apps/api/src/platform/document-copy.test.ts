import { describe, expect, it } from "vitest";

import { copiedDocumentName } from "./document-copy.js";

describe("copiedDocumentName", () => {
  it("prefixes a document once", () => {
    expect(copiedDocumentName("GOF-TERM.pdf")).toBe("Copy of GOF-TERM.pdf");
    expect(copiedDocumentName("Copy of GOF-TERM.pdf")).toBe(
      "Copy of GOF-TERM.pdf"
    );
    expect(copiedDocumentName("  ")).toBe("Copy of Document");
  });
});
