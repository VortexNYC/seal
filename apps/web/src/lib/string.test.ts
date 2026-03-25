import { describe, expect, test } from "vitest";

import { capitalize } from "./string";

describe("capitalize", () => {
  test("returns empty string for empty input", () => {
    expect(capitalize("")).toBe("");
  });

  test("capitalizes a single lowercase character", () => {
    expect(capitalize("a")).toBe("A");
  });

  test("capitalizes the first character of a lowercase word", () => {
    expect(capitalize("hello")).toBe("Hello");
  });

  test("leaves an already capitalized string unchanged", () => {
    expect(capitalize("Hello")).toBe("Hello");
  });

  test("leaves an all-uppercase string unchanged", () => {
    expect(capitalize("HELLO")).toBe("HELLO");
  });

  test("capitalizes only the first character of multiple words", () => {
    expect(capitalize("hello world")).toBe("Hello world");
  });

  test("leaves a string starting with a number unchanged", () => {
    expect(capitalize("123abc")).toBe("123abc");
  });

  test("leaves a string starting with a special character unchanged", () => {
    expect(capitalize("!hello")).toBe("!hello");
    expect(capitalize("@world")).toBe("@world");
    expect(capitalize("#test")).toBe("#test");
  });

  test("handles a string with leading whitespace", () => {
    expect(capitalize(" hello")).toBe(" hello");
  });

  test("handles a single space", () => {
    expect(capitalize(" ")).toBe(" ");
  });

  test("handles a string with mixed case", () => {
    expect(capitalize("hELLO")).toBe("HELLO");
  });

  test("handles unicode characters", () => {
    expect(capitalize("über")).toBe("Über");
  });
});
