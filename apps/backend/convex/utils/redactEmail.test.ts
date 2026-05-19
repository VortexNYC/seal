import { describe, expect, it } from "vitest";

import { redactEmail } from "./redactEmail";

describe("redactEmail", () => {
  it("redacts a typical email address", () => {
    expect(redactEmail("john.doe@example.com")).toBe("j******e@example.com");
  });

  it("redacts a two-character local-part", () => {
    expect(redactEmail("ab@x.io")).toBe("a*b@x.io");
  });

  it("leaves a single-character local-part unchanged", () => {
    expect(redactEmail("a@x.io")).toBe("a@x.io");
  });

  it("returns the input unchanged when there is no @ symbol", () => {
    expect(redactEmail("not-an-email")).toBe("not-an-email");
  });

  it("handles an empty local-part", () => {
    expect(redactEmail("@example.com")).toBe("@example.com");
  });

  it("handles an empty string", () => {
    expect(redactEmail("")).toBe("");
  });

  it("redacts a three-character local-part", () => {
    expect(redactEmail("abc@example.com")).toBe("a*c@example.com");
  });

  it("redacts a longer local-part with dots", () => {
    expect(redactEmail("a.b.c@example.com")).toBe("a***c@example.com");
  });

  it("preserves the domain exactly", () => {
    expect(redactEmail("user@sub.domain.co.uk")).toBe("u**r@sub.domain.co.uk");
  });
});
