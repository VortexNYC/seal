import { describe, expect, test } from "vitest";

import { applyRedaction, maskEmail, maskPhone, type RedactionLevel } from "../redaction";

describe("maskEmail", () => {
  test("masks email to first-char + ***@***.com pattern", () => {
    expect(maskEmail("alice@example.com")).toBe("a***@***.com");
    expect(maskEmail("bob@gmail.com")).toBe("b***@***.com");
  });

  test("preserves TLD for non-.com domains", () => {
    expect(maskEmail("user@company.io")).toBe("u***@***.io");
    expect(maskEmail("admin@org.net")).toBe("a***@***.net");
  });

  test("returns original value for invalid emails", () => {
    expect(maskEmail("")).toBe("");
    expect(maskEmail("not-an-email")).toBe("not-an-email");
  });
});

describe("maskPhone", () => {
  test("shows only last 4 digits", () => {
    expect(maskPhone("+1-555-123-4567")).toBe("***-***-4567");
    expect(maskPhone("555-123-4567")).toBe("***-***-4567");
    expect(maskPhone("1234567890")).toBe("***-***-7890");
  });

  test("masks everything when fewer than 4 digits", () => {
    expect(maskPhone("123")).toBe("***-***-****");
    expect(maskPhone("")).toBe("");
  });
});

describe("applyRedaction", () => {
  const email = "alice@example.com";
  const phone = "+1-555-123-4567";

  test("none: no masking for email or phone", () => {
    const level: RedactionLevel = "none";
    expect(applyRedaction(email, "email", level)).toBe(email);
    expect(applyRedaction(phone, "phone", level)).toBe(phone);
  });

  test("standard: masks only phone numbers", () => {
    const level: RedactionLevel = "standard";
    expect(applyRedaction(email, "email", level)).toBe(email);
    expect(applyRedaction(phone, "phone", level)).toBe("***-***-4567");
  });

  test("strict: masks both emails and phone numbers", () => {
    const level: RedactionLevel = "strict";
    expect(applyRedaction(email, "email", level)).toBe("a***@***.com");
    expect(applyRedaction(phone, "phone", level)).toBe("***-***-4567");
  });

  test("treats undefined/missing level as none", () => {
    expect(applyRedaction(email, "email", undefined)).toBe(email);
    expect(applyRedaction(phone, "phone", undefined)).toBe(phone);
  });

  test("handles null/empty values gracefully", () => {
    expect(applyRedaction(null, "email", "strict")).toBe(null);
    expect(applyRedaction(undefined, "phone", "strict")).toBe(undefined);
    expect(applyRedaction("", "email", "strict")).toBe("");
  });
});
