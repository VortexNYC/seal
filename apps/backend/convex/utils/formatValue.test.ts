import { describe, expect, test } from "vitest";

import { formatValue } from "./formatValue";

describe("formatValue", () => {
  test("formats integers with locale grouping", () => {
    expect(formatValue(1234)).toBe("1,234");
    expect(formatValue(1_000_000)).toBe("1,000,000");
  });

  test("formats decimals when specified", () => {
    expect(formatValue(1234.5, { decimals: 2 })).toBe("1,234.50");
    expect(formatValue(0.1, { decimals: 2 })).toBe("0.10");
  });

  test("rounds to specified decimal places", () => {
    expect(formatValue(1234.567, { decimals: 2 })).toBe("1,234.57");
    expect(formatValue(1234.564, { decimals: 2 })).toBe("1,234.56");
  });

  test("formats percentages", () => {
    expect(formatValue(0.12, { percentage: true })).toBe("12%");
    expect(formatValue(0.1234, { percentage: true, decimals: 2 })).toBe(
      "12.34%",
    );
  });

  test("formats currency", () => {
    expect(formatValue(99.9, { currency: true, decimals: 2 })).toBe("$99.90");
    expect(formatValue(1_000, { currency: true })).toBe("$1,000");
  });

  test("returns fallback for null, undefined, or NaN", () => {
    expect(formatValue(null)).toBe("—");
    expect(formatValue(undefined)).toBe("—");
    expect(formatValue(Number.NaN)).toBe("—");
  });

  test("allows custom fallback", () => {
    expect(formatValue(null, { fallback: "N/A" })).toBe("N/A");
    expect(formatValue(undefined, { fallback: "-" })).toBe("-");
  });

  test("respects custom locale", () => {
    expect(formatValue(1234.5, { decimals: 1, locale: "de-DE" })).toBe(
      "1.234,5",
    );
  });

  test("handles zero correctly", () => {
    expect(formatValue(0)).toBe("0");
    expect(formatValue(0, { decimals: 2 })).toBe("0.00");
    expect(formatValue(0, { percentage: true })).toBe("0%");
    expect(formatValue(0, { currency: true, decimals: 2 })).toBe("$0.00");
  });

  test("handles negative values", () => {
    expect(formatValue(-1234.5, { decimals: 2 })).toBe("-1,234.50");
    expect(formatValue(-0.05, { percentage: true, decimals: 0 })).toBe("-5%");
  });
});
