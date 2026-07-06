import { describe, expect, it } from "vitest";

import { titleCase } from "./titleCase";

describe("titleCase", () => {
  it("returns an empty string for empty input", () => {
    expect(titleCase("")).toBe("");
  });

  it("capitalizes a single word", () => {
    expect(titleCase("hello")).toBe("Hello");
    expect(titleCase("WORLD")).toBe("World");
  });

  it("capitalizes each word in a multi-word string", () => {
    expect(titleCase("hello world")).toBe("Hello World");
    expect(titleCase("the quick brown fox")).toBe("The Quick Brown Fox");
  });

  it("handles already title-cased strings", () => {
    expect(titleCase("Hello World")).toBe("Hello World");
  });

  it("handles extra whitespace", () => {
    expect(titleCase("  hello   world  ")).toBe("  Hello   World  ");
  });

  it("preserves punctuation and hyphens", () => {
    expect(titleCase("the quick-brown fox")).toBe("The Quick-Brown Fox");
    expect(titleCase("hello, world!")).toBe("Hello, World!");
  });

  it("handles all-caps strings", () => {
    expect(titleCase("HELLO WORLD")).toBe("Hello World");
  });
});
