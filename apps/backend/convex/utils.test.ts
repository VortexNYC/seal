import { describe, expect, test } from "vitest";

import { slugify } from "./utils";

describe("slugify", () => {
  test("lowercases text", () => {
    expect(slugify("Hello World")).toBe("hello-world");
  });

  test("trims leading and trailing whitespace", () => {
    expect(slugify("  spaced out  ")).toBe("spaced-out");
  });

  test("collapses multiple whitespace runs to a single hyphen", () => {
    expect(slugify("a   b\t\tc")).toBe("a-b-c");
  });

  test("strips characters that are not alphanumeric or hyphen", () => {
    expect(slugify("It's 100% done!")).toBe("its-100-done");
  });

  test("returns empty string for empty input", () => {
    expect(slugify("")).toBe("");
  });

  test("returns empty string when all characters are stripped", () => {
    expect(slugify("!!!")).toBe("");
  });

  test("handles mixed unicode and ascii", () => {
    expect(slugify("Café & Cookies ☕")).toBe("caf--cookies-");
  });

  test("preserves existing hyphens", () => {
    expect(slugify("foo-bar")).toBe("foo-bar");
  });

  test("preserves leading and trailing hyphens", () => {
    expect(slugify("--hello!!--")).toBe("--hello--");
  });
});
