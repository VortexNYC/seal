import { describe, it, expect } from "vitest";
import { isPositive } from "../utils";

describe("isPositive", () => {
  it("returns true for positive numbers", () => {
    expect(isPositive(1)).toBe(true);
    expect(isPositive(0.5)).toBe(true);
    expect(isPositive(42)).toBe(true);
  });

  it("returns false for zero", () => {
    expect(isPositive(0)).toBe(false);
  });

  it("returns false for negative numbers", () => {
    expect(isPositive(-1)).toBe(false);
    expect(isPositive(-0.5)).toBe(false);
  });

  it("returns false for non-finite numbers", () => {
    expect(isPositive(Infinity)).toBe(false);
    expect(isPositive(-Infinity)).toBe(false);
    expect(isPositive(NaN)).toBe(false);
  });
});
