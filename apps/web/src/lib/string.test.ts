import { describe, test, expect } from "vitest";

import { capitalize } from "./string";

describe("capitalize", () => {
  test("capitalizes a lowercase string", () => {
    expect(capitalize("hello")).toBe("Hello");
  });

  test("capitalizes and lowercases an all-uppercase string", () => {
    expect(capitalize("HELLO")).toBe("Hello");
  });

  test("handles a mixed-case string", () => {
    expect(capitalize("hELLO wORLD")).toBe("Hello world");
  });

  test("returns empty string for empty input", () => {
    expect(capitalize("")).toBe("");
  });

  test("handles a single character", () => {
    expect(capitalize("a")).toBe("A");
    expect(capitalize("A")).toBe("A");
  });

  test("handles a string that is already capitalized", () => {
    expect(capitalize("Hello")).toBe("Hello");
  });

  test("handles strings with leading whitespace", () => {
    expect(capitalize(" hello")).toBe(" hello");
  });

  test("handles strings with numbers", () => {
    expect(capitalize("123abc")).toBe("123abc");
  });
});
