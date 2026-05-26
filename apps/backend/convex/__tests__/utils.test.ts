import { describe, expect, test } from "vitest";

import { clampPercent } from "../utils";

describe("clampPercent", () => {
  test("returns 0 when below range", () => {
    expect(clampPercent(-5)).toBe(0);
    expect(clampPercent(-0.1)).toBe(0);
  });

  test("returns the number when in range", () => {
    expect(clampPercent(0)).toBe(0);
    expect(clampPercent(50)).toBe(50);
    expect(clampPercent(100)).toBe(100);
    expect(clampPercent(33.33)).toBe(33.33);
  });

  test("returns 100 when above range", () => {
    expect(clampPercent(101)).toBe(100);
    expect(clampPercent(150)).toBe(100);
  });
});
