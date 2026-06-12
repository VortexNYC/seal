import { describe, expect, test } from "vitest";

import { parsePagination } from "../middleware";

describe("parsePagination", () => {
  test("uses defaults when limit is missing", () => {
    const result = parsePagination({}, { limit: 20, maxLimit: 100 });
    expect(result.limit).toBe(20);
    expect(result.cursor).toBeUndefined();
  });

  test("accepts in-range limit values", () => {
    const result = parsePagination({ limit: "50" }, { limit: 20, maxLimit: 100 });
    expect(result.limit).toBe(50);
    expect(result.cursor).toBeUndefined();
  });

  test("clamps limit to max when over max", () => {
    const result = parsePagination({ limit: "200" }, { limit: 20, maxLimit: 100 });
    expect(result.limit).toBe(100);
    expect(result.cursor).toBeUndefined();
  });
});
