import { describe, expect, test } from "vitest";

import { roundTo } from "../roundTo";

describe("roundTo", () => {
  test("rounds to 0 decimals by default", () => {
    expect(roundTo(1.5)).toBe(2);
    expect(roundTo(1.4)).toBe(1);
  });

  test("rounds to specified decimal places", () => {
    expect(roundTo(1.234, 2)).toBe(1.23);
    expect(roundTo(1.235, 2)).toBe(1.24);
  });

  test("handles negative decimals", () => {
    expect(roundTo(123.4, -1)).toBe(120);
    expect(roundTo(123.4, -2)).toBe(100);
  });

  test("returns the same value when decimals are large enough", () => {
    expect(roundTo(1.2, 5)).toBe(1.2);
  });

  test("handles exact halves correctly", () => {
    expect(roundTo(2.5, 0)).toBe(3);
    expect(roundTo(2.05, 1)).toBe(2.1);
  });

  test("handles zero", () => {
    expect(roundTo(0, 2)).toBe(0);
  });

  test("handles negative numbers", () => {
    expect(roundTo(-1.234, 2)).toBe(-1.23);
    expect(roundTo(-1.235, 2)).toBe(-1.24);
  });
});
