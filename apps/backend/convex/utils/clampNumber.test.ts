import { describe, expect, it } from "vitest";

import { clampNumber } from "./clampNumber";

describe("clampNumber", () => {
  it("returns values within range unchanged", () => {
    expect(clampNumber(5, 0, 10)).toBe(5);
    expect(clampNumber(0, 0, 10)).toBe(0);
    expect(clampNumber(10, 0, 10)).toBe(10);
    expect(clampNumber(3.5, 1, 4)).toBe(3.5);
  });

  it("clamps values below min to min", () => {
    expect(clampNumber(-5, 0, 10)).toBe(0);
    expect(clampNumber(-100, -50, 50)).toBe(-50);
    expect(clampNumber(0.5, 1, 5)).toBe(1);
  });

  it("clamps values above max to max", () => {
    expect(clampNumber(15, 0, 10)).toBe(10);
    expect(clampNumber(100, -50, 50)).toBe(50);
    expect(clampNumber(5.1, 1, 5)).toBe(5);
  });

  it("handles exact min and max boundaries", () => {
    expect(clampNumber(0, 0, 10)).toBe(0);
    expect(clampNumber(10, 0, 10)).toBe(10);
    expect(clampNumber(-20, -20, 20)).toBe(-20);
    expect(clampNumber(20, -20, 20)).toBe(20);
  });

  it("handles the min > max edge case gracefully", () => {
    // When min > max, Math.min(Math.max(n, min), max) always returns max.
    expect(clampNumber(5, 10, 0)).toBe(0);
    expect(clampNumber(15, 10, 0)).toBe(0);
    expect(clampNumber(-5, 10, 0)).toBe(0);
  });
});
