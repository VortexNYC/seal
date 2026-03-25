import { describe, expect, test } from "vitest";

import { capitalize } from "./string";

describe("capitalize", () => {
  test("returns an empty string when given an empty string", () => {
    expect(capitalize("")).toBe("");
  });

  test("capitalizes a single lowercase character", () => {
    expect(capitalize("a")).toBe("A");
  });

  test("returns a single uppercase character unchanged", () => {
    expect(capitalize("A")).toBe("A");
  });

  test("capitalizes the first letter of a lowercase word", () => {
    expect(capitalize("hello")).toBe("Hello");
  });

  test("leaves an already-capitalized word unchanged", () => {
    expect(capitalize("Hello")).toBe("Hello");
  });

  test("capitalizes only the first character of a multi-word string", () => {
    expect(capitalize("hello world")).toBe("Hello world");
  });

  test("preserves interior casing", () => {
    expect(capitalize("javaScript")).toBe("JavaScript");
  });

  test("handles strings with leading whitespace", () => {
    expect(capitalize(" hello")).toBe(" hello");
  });

  test("handles a string that is entirely whitespace", () => {
    expect(capitalize("   ")).toBe("   ");
  });

  test("handles strings starting with a number", () => {
    expect(capitalize("123abc")).toBe("123abc");
  });

  test("handles strings with special characters", () => {
    expect(capitalize("!hello")).toBe("!hello");
  });

  test("handles uppercase input", () => {
    expect(capitalize("HELLO")).toBe("HELLO");
  });
});
