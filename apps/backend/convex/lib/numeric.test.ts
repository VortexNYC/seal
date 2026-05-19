import { describe, expect, test } from "vitest";

import { clamp } from "./numeric";

describe("clamp", () => {
  test("returns NaN when n is NaN", () => {
    expect(Number.isNaN(clamp(NaN, 0, 1))).toBe(true);
  });

  test("returns NaN when lo is NaN", () => {
    expect(Number.isNaN(clamp(0, NaN, 1))).toBe(true);
  });

  test("returns NaN when hi is NaN", () => {
    expect(Number.isNaN(clamp(0, 0, NaN))).toBe(true);
  });

  test("returns NaN when multiple args are NaN", () => {
    expect(Number.isNaN(clamp(NaN, NaN, NaN))).toBe(true);
  });

  test("clamps below lower bound", () => {
    expect(clamp(-10, 0, 5)).toBe(0);
  });

  test("clamps above upper bound", () => {
    expect(clamp(10, 0, 5)).toBe(5);
  });

  test("returns n when within bounds", () => {
    expect(clamp(3, 0, 5)).toBe(3);
  });

  test("returns n when equal to lower bound", () => {
    expect(clamp(0, 0, 5)).toBe(0);
  });

  test("returns n when equal to upper bound", () => {
    expect(clamp(5, 0, 5)).toBe(5);
  });

  test("swaps bounds when lo > hi and clamps below swapped lower", () => {
    expect(clamp(-10, 5, 0)).toBe(0);
  });

  test("swaps bounds when lo > hi and clamps above swapped upper", () => {
    expect(clamp(10, 5, 0)).toBe(5);
  });

  test("swaps bounds when lo > hi and returns n when within swapped range", () => {
    expect(clamp(3, 5, 0)).toBe(3);
  });

  test("handles negative bounds", () => {
    expect(clamp(-7, -10, -5)).toBe(-7);
  });

  test("handles negative bounds clamping below", () => {
    expect(clamp(-15, -10, -5)).toBe(-10);
  });

  test("handles negative bounds clamping above", () => {
    expect(clamp(0, -10, -5)).toBe(-5);
  });

  test("handles Infinity bounds", () => {
    expect(clamp(100, -Infinity, Infinity)).toBe(100);
    expect(clamp(-Infinity, -10, 10)).toBe(-10);
    expect(clamp(Infinity, -10, 10)).toBe(10);
  });

  test("handles equal bounds", () => {
    expect(clamp(42, 5, 5)).toBe(5);
    expect(clamp(3, 5, 5)).toBe(5);
  });
});
