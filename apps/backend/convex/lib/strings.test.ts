import { describe, expect, test } from "vitest";

import { ellipsize, slugify, titleCase } from "./strings";

describe("titleCase", () => {
  test("returns empty string for empty input", () => {
    expect(titleCase("")).toBe("");
  });

  test("capitalizes a single word", () => {
    expect(titleCase("hello")).toBe("Hello");
  });

  test("capitalizes each word", () => {
    expect(titleCase("hello world")).toBe("Hello World");
  });

  test("handles mixed casing", () => {
    expect(titleCase("hELLo wORld")).toBe("Hello World");
  });

  test("trims leading and trailing whitespace", () => {
    expect(titleCase("  hello world  ")).toBe("Hello World");
  });

  test("handles multiple spaces between words", () => {
    expect(titleCase("hello   world")).toBe("Hello World");
  });

  test("handles unicode characters safely", () => {
    expect(titleCase("über café")).toBe("Über Café");
    expect(titleCase("日本語")).toBe("日本語");
  });
});

describe("slugify", () => {
  test("returns empty string for empty input", () => {
    expect(slugify("")).toBe("");
  });

  test("lowercases and replaces spaces with hyphens", () => {
    expect(slugify("Hello World")).toBe("hello-world");
  });

  test("strips non-alphanumeric characters", () => {
    expect(slugify("Hello, World!!!")).toBe("hello-world");
  });

  test("collapses multiple non-alphanumeric chars into one hyphen", () => {
    expect(slugify("Hello   World")).toBe("hello-world");
    expect(slugify("a---b")).toBe("a-b");
  });

  test("trims leading and trailing non-alphanumeric chars", () => {
    expect(slugify("!!!hello world!!!")).toBe("hello-world");
    expect(slugify("-hello-world-")).toBe("hello-world");
  });

  test("returns empty string when input is only non-alphanumeric", () => {
    expect(slugify("!!!")).toBe("");
    expect(slugify("   ")).toBe("");
  });

  test("preserves numbers", () => {
    expect(slugify("Test 123")).toBe("test-123");
  });

  test("handles unicode by stripping non-ascii letters", () => {
    expect(slugify("über")).toBe("ber");
    expect(slugify("日本語")).toBe("");
    expect(slugify("café")).toBe("caf");
  });
});

describe("ellipsize", () => {
  test("returns empty string for empty input", () => {
    expect(ellipsize("", 5)).toBe("");
  });

  test("returns string unchanged if within max", () => {
    expect(ellipsize("hello", 10)).toBe("hello");
    expect(ellipsize("hello", 5)).toBe("hello");
  });

  test("truncates with default suffix", () => {
    expect(ellipsize("hello world", 8)).toBe("hello w…");
  });

  test("truncates with custom suffix", () => {
    expect(ellipsize("hello world", 8, "...")).toBe("hello...");
  });

  test("returns only suffix when max equals suffix length", () => {
    expect(ellipsize("abcdef", 1)).toBe("…");
  });

  test("returns empty string when max is zero", () => {
    expect(ellipsize("abcdef", 0)).toBe("");
  });

  test("handles negative max gracefully", () => {
    expect(ellipsize("abcdef", -1)).toBe("");
  });

  test("handles strings that are exactly max + 1", () => {
    expect(ellipsize("abcdef", 5)).toBe("abcd…");
  });

  test("handles strings shorter than suffix length", () => {
    expect(ellipsize("ab", 1)).toBe("…");
  });

  test("handles unicode safely", () => {
    expect(ellipsize("日本語テスト", 3)).toBe("日本…");
  });
});
