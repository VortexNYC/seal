import { describe, expect, test } from "vitest";

import { clampPage } from "./pagination";

describe("clampPage", () => {
  test("happy path — page 1 of 3", () => {
    const result = clampPage(1, 10, 25);
    expect(result).toEqual({ page: 1, offset: 0, pages: 3 });
  });

  test("middle page", () => {
    const result = clampPage(2, 10, 25);
    expect(result).toEqual({ page: 2, offset: 10, pages: 3 });
  });

  test("last page", () => {
    const result = clampPage(3, 10, 25);
    expect(result).toEqual({ page: 3, offset: 20, pages: 3 });
  });

  test("page < 1 clamps to 1", () => {
    const result = clampPage(0, 10, 25);
    expect(result).toEqual({ page: 1, offset: 0, pages: 3 });
  });

  test("negative page clamps to 1", () => {
    const result = clampPage(-5, 10, 25);
    expect(result).toEqual({ page: 1, offset: 0, pages: 3 });
  });

  test("page > max clamps to last page", () => {
    const result = clampPage(99, 10, 25);
    expect(result).toEqual({ page: 3, offset: 20, pages: 3 });
  });

  test("total = 0 returns page 1 with zero offset and one page", () => {
    const result = clampPage(1, 10, 0);
    expect(result).toEqual({ page: 1, offset: 0, pages: 1 });
  });

  test("total = 0 with high requested page still clamps to 1", () => {
    const result = clampPage(42, 10, 0);
    expect(result).toEqual({ page: 1, offset: 0, pages: 1 });
  });

  test("exact boundary — total equals pageSize yields one page", () => {
    const result = clampPage(1, 10, 10);
    expect(result).toEqual({ page: 1, offset: 0, pages: 1 });
  });

  test("boundary — total just over pageSize yields two pages", () => {
    const result = clampPage(1, 10, 11);
    expect(result).toEqual({ page: 1, offset: 0, pages: 2 });
  });

  test("pageSize = 0 throws", () => {
    expect(() => clampPage(1, 0, 25)).toThrow("pageSize must be a positive finite number");
  });

  test("negative pageSize throws", () => {
    expect(() => clampPage(1, -5, 25)).toThrow("pageSize must be a positive finite number");
  });

  test("page NaN is treated as 1", () => {
    const result = clampPage(NaN, 10, 25);
    expect(result).toEqual({ page: 1, offset: 0, pages: 3 });
  });

  test("page Infinity is treated as 1", () => {
    const result = clampPage(Infinity, 10, 25);
    expect(result).toEqual({ page: 1, offset: 0, pages: 3 });
  });

  test("page -Infinity is treated as 1", () => {
    const result = clampPage(-Infinity, 10, 25);
    expect(result).toEqual({ page: 1, offset: 0, pages: 3 });
  });

  test("total NaN is treated as 0", () => {
    const result = clampPage(1, 10, NaN);
    expect(result).toEqual({ page: 1, offset: 0, pages: 1 });
  });

  test("total Infinity is treated as 0", () => {
    const result = clampPage(1, 10, Infinity);
    expect(result).toEqual({ page: 1, offset: 0, pages: 1 });
  });

  test("total -Infinity is treated as 0", () => {
    const result = clampPage(1, 10, -Infinity);
    expect(result).toEqual({ page: 1, offset: 0, pages: 1 });
  });

  test("pageSize NaN throws", () => {
    expect(() => clampPage(1, NaN, 25)).toThrow("pageSize must be a positive finite number");
  });

  test("pageSize Infinity throws", () => {
    expect(() => clampPage(1, Infinity, 25)).toThrow("pageSize must be a positive finite number");
  });

  test("pageSize -Infinity throws", () => {
    expect(() => clampPage(1, -Infinity, 25)).toThrow("pageSize must be a positive finite number");
  });

  test("fractional page is truncated before clamping", () => {
    const result = clampPage(2.9, 10, 25);
    expect(result).toEqual({ page: 2, offset: 10, pages: 3 });
  });

  test("fractional pageSize is truncated", () => {
    const result = clampPage(1, 10.9, 25);
    expect(result).toEqual({ page: 1, offset: 0, pages: 3 });
  });

  test("negative total is clamped to 0", () => {
    const result = clampPage(1, 10, -5);
    expect(result).toEqual({ page: 1, offset: 0, pages: 1 });
  });

  test("large total with large pageSize", () => {
    const result = clampPage(1, 1000, 500_000);
    expect(result).toEqual({ page: 1, offset: 0, pages: 500 });
  });

  test("page 1 with single item", () => {
    const result = clampPage(1, 10, 1);
    expect(result).toEqual({ page: 1, offset: 0, pages: 1 });
  });
});
