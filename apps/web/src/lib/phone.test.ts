import { describe, expect, test } from "vitest";

import { formatPhoneNumber } from "./phone";

describe("formatPhoneNumber", () => {
  test("formats a standard 10-digit phone number", () => {
    expect(formatPhoneNumber("5551234567")).toBe("(555) 123-4567");
  });

  test("formats another valid phone number", () => {
    expect(formatPhoneNumber("2125551234")).toBe("(212) 555-1234");
  });

  test("formats all zeros", () => {
    expect(formatPhoneNumber("0000000000")).toBe("(000) 000-0000");
  });

  test("formats all nines", () => {
    expect(formatPhoneNumber("9999999999")).toBe("(999) 999-9999");
  });

  test("throws for fewer than 10 digits", () => {
    expect(() => formatPhoneNumber("555123456")).toThrow("Invalid phone number");
  });

  test("throws for more than 10 digits", () => {
    expect(() => formatPhoneNumber("55512345678")).toThrow("Invalid phone number");
  });

  test("throws for an empty string", () => {
    expect(() => formatPhoneNumber("")).toThrow("Invalid phone number");
  });

  test("throws for non-digit characters", () => {
    expect(() => formatPhoneNumber("555-123-45")).toThrow("Invalid phone number");
    expect(() => formatPhoneNumber("abcdefghij")).toThrow("Invalid phone number");
  });

  test("throws for string with spaces", () => {
    expect(() => formatPhoneNumber("555 123 45")).toThrow("Invalid phone number");
    expect(() => formatPhoneNumber(" 555123456")).toThrow("Invalid phone number");
  });

  test("throws for string with leading/trailing whitespace around valid digits", () => {
    expect(() => formatPhoneNumber(" 5551234567")).toThrow("Invalid phone number");
    expect(() => formatPhoneNumber("5551234567 ")).toThrow("Invalid phone number");
  });
});
