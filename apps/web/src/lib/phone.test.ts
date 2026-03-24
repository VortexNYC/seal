import { describe, expect, test } from "vitest";

import { formatPhoneNumber } from "./phone";

describe("formatPhoneNumber", () => {
  test("formats a standard 10-digit number", () => {
    expect(formatPhoneNumber("1234567890")).toBe("(123) 456-7890");
  });

  test("formats a number with all zeros", () => {
    expect(formatPhoneNumber("0000000000")).toBe("(000) 000-0000");
  });

  test("formats a number with all nines", () => {
    expect(formatPhoneNumber("9999999999")).toBe("(999) 999-9999");
  });

  test("formats a typical US phone number", () => {
    expect(formatPhoneNumber("5551234567")).toBe("(555) 123-4567");
  });

  test("throws for an empty string", () => {
    expect(() => formatPhoneNumber("")).toThrow("Invalid phone number");
  });

  test("throws for a string with fewer than 10 digits", () => {
    expect(() => formatPhoneNumber("123456789")).toThrow("Invalid phone number");
  });

  test("throws for a string with more than 10 digits", () => {
    expect(() => formatPhoneNumber("12345678901")).toThrow(
      "Invalid phone number",
    );
  });

  test("throws for a string containing non-digit characters", () => {
    expect(() => formatPhoneNumber("123-456-7890")).toThrow(
      "Invalid phone number",
    );
    expect(() => formatPhoneNumber("(123) 456-7890")).toThrow(
      "Invalid phone number",
    );
    expect(() => formatPhoneNumber("123456789a")).toThrow(
      "Invalid phone number",
    );
  });

  test("throws for a string with spaces", () => {
    expect(() => formatPhoneNumber("123 456 7890")).toThrow(
      "Invalid phone number",
    );
  });

  test("throws for a string with leading/trailing whitespace", () => {
    expect(() => formatPhoneNumber(" 1234567890")).toThrow(
      "Invalid phone number",
    );
    expect(() => formatPhoneNumber("1234567890 ")).toThrow(
      "Invalid phone number",
    );
  });
});
