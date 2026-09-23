import { describe, expect, it } from "vitest";

import { extractAnnotationsFromMarkdown } from "./document-annotations.js";

describe("extractAnnotationsFromMarkdown", () => {
  it("finds payment and risk clauses with page geometry", () => {
    const md = `<!-- Page 1 -->
The parties shall pay the fee of $500 within 30 days.
Indemnification and liability for damages apply.
<!-- Page 2 -->
Governing law is New York. Effective date January 1, 2026.
`;
    const items = extractAnnotationsFromMarkdown(md);
    const cats = new Set(items.map((i) => i.category));
    expect(cats.has("payment") || cats.has("obligation")).toBe(true);
    expect(cats.has("risk") || cats.has("terms") || cats.has("dates")).toBe(
      true
    );
    expect(items.every((i) => i.page >= 1 && i.width > 0)).toBe(true);
  });
});
