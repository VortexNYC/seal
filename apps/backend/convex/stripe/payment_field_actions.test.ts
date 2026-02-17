import { describe, expect, test } from "vitest";

import {
  calculatePlatformFee,
  getDaysUntilDue,
  toStripePaymentMethodTypes,
} from "./payment_field_actions";

describe("calculatePlatformFee", () => {
  test("free tier: 1% of 10000 → 100", () => {
    expect(calculatePlatformFee(10000, false)).toBe(100);
  });

  test("pro tier: 0.25% of 10000 → 25", () => {
    expect(calculatePlatformFee(10000, true)).toBe(25);
  });

  test("rounds correctly: 1% of 333 → 3 (Math.round)", () => {
    expect(calculatePlatformFee(333, false)).toBe(3);
  });

  test("rounds up when fractional >= 0.5: 1% of 350 → 4", () => {
    // 350 * 0.01 = 3.5 → Math.round → 4
    expect(calculatePlatformFee(350, false)).toBe(4);
  });

  test("zero amount → 0", () => {
    expect(calculatePlatformFee(0, false)).toBe(0);
    expect(calculatePlatformFee(0, true)).toBe(0);
  });

  test("pro tier small amount: 0.25% of 100 → 0", () => {
    // 100 * 0.0025 = 0.25 → Math.round → 0
    expect(calculatePlatformFee(100, true)).toBe(0);
  });
});

describe("getDaysUntilDue", () => {
  test('"on_receipt" → 1', () => {
    expect(getDaysUntilDue("on_receipt")).toBe(1);
  });

  test('"net_15" → 15', () => {
    expect(getDaysUntilDue("net_15")).toBe(15);
  });

  test('"net_30" → 30', () => {
    expect(getDaysUntilDue("net_30")).toBe(30);
  });

  test('"net_60" → 60', () => {
    expect(getDaysUntilDue("net_60")).toBe(60);
  });

  test('"custom" with value 45 → 45', () => {
    expect(getDaysUntilDue("custom", 45)).toBe(45);
  });

  test('"custom" without value → 30 (default)', () => {
    expect(getDaysUntilDue("custom")).toBe(30);
    expect(getDaysUntilDue("custom", undefined)).toBe(30);
  });

  test("unknown term → 30 (default)", () => {
    expect(getDaysUntilDue("something_else")).toBe(30);
    expect(getDaysUntilDue("")).toBe(30);
  });
});

describe("toStripePaymentMethodTypes", () => {
  test("filters out apple_pay and google_pay (wallet methods)", () => {
    expect(toStripePaymentMethodTypes(["apple_pay"])).toEqual([]);
    expect(toStripePaymentMethodTypes(["google_pay"])).toEqual([]);
    expect(toStripePaymentMethodTypes(["apple_pay", "google_pay"])).toEqual([]);
  });

  test('maps "ach_debit" → "us_bank_account"', () => {
    expect(toStripePaymentMethodTypes(["ach_debit"])).toEqual(["us_bank_account"]);
  });

  test("passes through card and link unchanged", () => {
    expect(toStripePaymentMethodTypes(["card"])).toEqual(["card"]);
    expect(toStripePaymentMethodTypes(["link"])).toEqual(["link"]);
  });

  test("empty array → empty array", () => {
    expect(toStripePaymentMethodTypes([])).toEqual([]);
  });

  test("mixed methods: filters wallets, maps ach_debit, keeps card", () => {
    const result = toStripePaymentMethodTypes(["card", "apple_pay", "ach_debit", "google_pay", "link"]);
    expect(result).toEqual(["card", "us_bank_account", "link"]);
  });
});
