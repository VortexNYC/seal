import { describe, expect, test } from "vitest";

import { clampNumber } from "./utils";

describe("clampNumber", () => {
  test("returns the value when it is within the range", () => {
    expect(clampNumber(5, 0, 10)).toBe(5);
  });

  test("clamps to the minimum when value is below range", () => {
    expect(clampNumber(-3, 0, 10)).toBe(0);
  });

  test("clamps to the maximum when value is above range", () => {
    expect(clampNumber(15, 0, 10)).toBe(10);
  });

  test("returns the value when it equals the minimum", () => {
    expect(clampNumber(0, 0, 10)).toBe(0);
  });

  test("returns the value when it equals the maximum", () => {
    expect(clampNumber(10, 0, 10)).toBe(10);
  });

  test("handles negative ranges correctly", () => {
    expect(clampNumber(-5, -10, -1)).toBe(-5);
    expect(clampNumber(-20, -10, -1)).toBe(-10);
    expect(clampNumber(0, -10, -1)).toBe(-1);
  });
});
