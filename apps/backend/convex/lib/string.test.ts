import { describe, expect, test } from "vitest";

import { truncateMiddle } from "./string";

describe("truncateMiddle", () => {
  // Example from spec
  test("'abcdefghij', 7 → 'abc…hij'", () => {
    expect(truncateMiddle("abcdefghij", 7)).toBe("abc…hij");
    expect(truncateMiddle("abcdefghij", 7)).toHaveLength(7);
  });

  // Example from spec — no truncation needed
  test("'short', 10 → 'short' (unchanged)", () => {
    expect(truncateMiddle("short", 10)).toBe("short");
  });

  // Example from spec
  test("'abcdef', 5 → 'ab…ef'", () => {
    expect(truncateMiddle("abcdef", 5)).toBe("ab…ef");
    expect(truncateMiddle("abcdef", 5)).toHaveLength(5);
  });

  // Edge case — empty string
  test("empty string is returned unchanged for any max", () => {
    expect(truncateMiddle("", 5)).toBe("");
    expect(truncateMiddle("", 1)).toBe("");
    expect(truncateMiddle("", 0)).toBe("");
  });

  // Edge case — max === 0
  test("max 0 returns empty string", () => {
    expect(truncateMiddle("hello", 0)).toBe("");
    expect(truncateMiddle("", 0)).toBe("");
  });

  // Edge case — max < 0
  test("negative max returns empty string", () => {
    expect(truncateMiddle("hello", -1)).toBe("");
  });

  // Edge case — max === 1
  test("max 1 with non-empty string returns '…'", () => {
    expect(truncateMiddle("hello", 1)).toBe("…");
    expect(truncateMiddle("hello", 1)).toHaveLength(1);
  });

  test("max 1 with single-char string returns that char", () => {
    expect(truncateMiddle("x", 1)).toBe("x");
  });

  // Edge case — max === 2
  test("max 2 returns prefix + '…'", () => {
    expect(truncateMiddle("hello", 2)).toBe("h…");
    expect(truncateMiddle("hello", 2)).toHaveLength(2);
  });

  // Edge case — max >= length
  test("max equal to length returns string unchanged", () => {
    expect(truncateMiddle("hello", 5)).toBe("hello");
  });

  test("max greater than length returns string unchanged", () => {
    expect(truncateMiddle("hello", 100)).toBe("hello");
  });

  // Odd removal — favors prefix
  test("6-char string at max 3: prefix 1, suffix 1", () => {
    expect(truncateMiddle("abcdef", 3)).toBe("a…f");
    expect(truncateMiddle("abcdef", 3)).toHaveLength(3);
  });

  test("10-char string at max 6 favors prefix (3 + 1 + 2)", () => {
    expect(truncateMiddle("abcdefghij", 6)).toBe("abc…ij");
    expect(truncateMiddle("abcdefghij", 6)).toHaveLength(6);
  });

  // Unicode sanity check
  test("handles multi-byte characters correctly", () => {
    const s = "abcdefghij";
    expect(truncateMiddle(s, 4)).toBe("ab…j");
    expect(truncateMiddle(s, 4)).toHaveLength(4);
  });
});
