import { describe, expect, test } from "vitest";

import { capitalize } from "./string";

describe("capitalize", () => {
  test("capitalizes the first letter of a lowercase string", () => {
    expect(capitalize("hello")).toBe("Hello");
    expect(capitalize("world")).toBe("World");
  });

  test("returns an empty string unchanged", () => {
    expect(capitalize("")).toBe("");
  });

  test("handles a single character", () => {
    expect(capitalize("a")).toBe("A");
    expect(capitalize("z")).toBe("Z");
  });

  test("returns an already-capitalized string unchanged", () => {
    expect(capitalize("Hello")).toBe("Hello");
    expect(capitalize("World")).toBe("World");
  });

  test("capitalizes only the first letter of mixed-case input", () => {
    expect(capitalize("hELLO")).toBe("HELLO");
    expect(capitalize("camelCase")).toBe("CamelCase");
  });

  test("handles strings starting with non-alphabetic characters", () => {
    expect(capitalize("123abc")).toBe("123abc");
    expect(capitalize(" hello")).toBe(" hello");
    expect(capitalize("!bang")).toBe("!bang");
  });

  test("handles a single uppercase character", () => {
    expect(capitalize("A")).toBe("A");
  });
});
