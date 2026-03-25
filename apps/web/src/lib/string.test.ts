import { describe, expect, test } from "vitest";

import { capitalize } from "./string";

describe("capitalize", () => {
  test("capitalizes the first letter of a lowercase string", () => {
    expect(capitalize("hello")).toBe("Hello");
    expect(capitalize("world")).toBe("World");
  });

  test("returns empty string for empty input", () => {
    expect(capitalize("")).toBe("");
  });

  test("capitalizes a single character", () => {
    expect(capitalize("a")).toBe("A");
    expect(capitalize("z")).toBe("Z");
  });

  test("returns already capitalized string unchanged", () => {
    expect(capitalize("Hello")).toBe("Hello");
    expect(capitalize("A")).toBe("A");
  });

  test("only capitalizes the first letter, preserving the rest", () => {
    expect(capitalize("hELLO")).toBe("HELLO");
    expect(capitalize("helloWorld")).toBe("HelloWorld");
  });

  test("preserves leading whitespace", () => {
    expect(capitalize(" hello")).toBe(" hello");
    expect(capitalize("  test")).toBe("  test");
  });

  test("handles strings starting with numbers", () => {
    expect(capitalize("123abc")).toBe("123abc");
    expect(capitalize("1st")).toBe("1st");
  });

  test("handles strings with special characters", () => {
    expect(capitalize("!hello")).toBe("!hello");
    expect(capitalize("-test")).toBe("-test");
  });

  test("handles single uppercase character", () => {
    expect(capitalize("Z")).toBe("Z");
  });
});
