import { describe, expect, test } from "vitest";

import {
  autoValueForField,
  initialsFromName,
  isAutoSignableFieldType,
  stampDateSigned,
} from "./auto-sign-fields.js";

describe("auto-sign-fields (Documenso-class)", () => {
  test("recognizes auto-signable types", () => {
    expect(isAutoSignableFieldType("date_signed")).toBe(true);
    expect(isAutoSignableFieldType("name")).toBe(true);
    expect(isAutoSignableFieldType("email")).toBe(true);
    expect(isAutoSignableFieldType("initials")).toBe(true);
    expect(isAutoSignableFieldType("date")).toBe(false);
    expect(isAutoSignableFieldType("signature")).toBe(false);
  });

  test("stamps date_signed as YYYY-MM-DD", () => {
    expect(stampDateSigned(new Date("2026-09-28T20:00:00.000Z"))).toBe(
      "2026-09-28"
    );
  });

  test("initialsFromName", () => {
    expect(initialsFromName("Mark Greenberg")).toBe("MG");
    expect(initialsFromName("Lenore")).toBe("LE");
    expect(initialsFromName("")).toBe("");
  });

  test("autoValueForField uses recipient identity", () => {
    const recipient = {
      name: "Mark Greenberg",
      email: "mark@example.com",
    };
    expect(autoValueForField("name", recipient)).toBe("Mark Greenberg");
    expect(autoValueForField("email", recipient)).toBe("mark@example.com");
    expect(autoValueForField("initials", recipient)).toBe("MG");
    expect(
      autoValueForField("date_signed", recipient, new Date("2026-01-02T00:00:00Z"))
    ).toBe("2026-01-02");
  });
});
