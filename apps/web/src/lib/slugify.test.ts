import { describe, expect, test } from "vitest";

import { slugify } from "./slugify";

describe("slugify", () => {
  test("lowercases input", () => {
    expect(slugify("Hello World")).toBe("hello-world");
  });

  test("replaces spaces with hyphens", () => {
    expect(slugify("foo bar baz")).toBe("foo-bar-baz");
  });

  test("replaces special characters with hyphens", () => {
    expect(slugify("a@b#c$d")).toBe("a-b-c-d");
    expect(slugify("file_name.txt")).toBe("file-name-txt");
    expect(slugify("100% complete")).toBe("100-complete");
  });

  test("collapses consecutive hyphens", () => {
    expect(slugify("hello---world")).toBe("hello-world");
    expect(slugify("a   b")).toBe("a-b");
  });

  test("trims leading and trailing hyphens", () => {
    expect(slugify("-hello-")).toBe("hello");
    expect(slugify("---world---")).toBe("world");
  });

  test("handles empty string", () => {
    expect(slugify("")).toBe("");
  });

  test("handles strings with only special characters", () => {
    expect(slugify("!!!")).toBe("");
    expect(slugify("---")).toBe("");
  });

  test("preserves numbers", () => {
    expect(slugify("version 2.0")).toBe("version-2-0");
    expect(slugify("123abc")).toBe("123abc");
  });

  test("handles unicode letters", () => {
    expect(slugify("café")).toBe("caf");
    expect(slugify("naïve")).toBe("na-ve");
  });
});
