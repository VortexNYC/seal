import { describe, expect, test } from "vitest";

import { capitalize } from "./string";

describe("capitalize", () => {
  test("capitalizes a lowercase word", () => {
    expect(capitalize("hello")).toBe("Hello");
  });

  test("capitalizes and lowercases an all-uppercase word", () => {
    expect(capitalize("HELLO")).toBe("Hello");
  });

  test("capitalizes a mixed-case word", () => {
    expect(capitalize("hELLO")).toBe("Hello");
  });

  test("returns an empty string for empty input", () => {
    expect(capitalize("")).toBe("");
  });

  test("handles a single lowercase character", () => {
    expect(capitalize("a")).toBe("A");
  });

  test("handles a single uppercase character", () => {
    expect(capitalize("A")).toBe("A");
  });

  test("handles a string with leading whitespace", () => {
    expect(capitalize(" hello")).toBe(" hello");
  });

  test("handles a numeric string", () => {
    expect(capitalize("123abc")).toBe("123abc");
  });

  test("handles a string that is already capitalized", () => {
    expect(capitalize("Hello")).toBe("Hello");
  });

  test("lowercases remaining characters in a multi-word string", () => {
    expect(capitalize("hello WORLD")).toBe("Hello world");
  });
});
