import { describe, expect, it } from "vitest";

import { candidatesToSuggestionItems } from "./field-suggestions.js";

describe("candidatesToSuggestionItems", () => {
  it("adds geometry when candidates only have line/page", () => {
    const items = candidatesToSuggestionItems([
      { type: "signature", label: "Sign here", page: 1, line: 20 },
      { type: "date", label: "Date", page: 1, line: 22 },
    ]);
    expect(items).toHaveLength(2);
    expect(items[0]?.fieldType).toBe("signature");
    expect(items[0]?.width).toBeGreaterThan(0);
    expect(items[0]?.x).toBe(10);
    expect(items[1]?.fieldType).toBe("date");
  });

  it("preserves explicit bbox from anydoc", () => {
    const items = candidatesToSuggestionItems([
      {
        type: "text",
        label: "Name",
        page: 2,
        line: 5,
        x: 20,
        y: 40,
        width: 25,
        height: 4,
        confidence: 0.9,
      },
    ]);
    expect(items[0]).toMatchObject({
      page: 2,
      x: 20,
      y: 40,
      width: 25,
      height: 4,
      confidence: 0.9,
    });
  });
});
