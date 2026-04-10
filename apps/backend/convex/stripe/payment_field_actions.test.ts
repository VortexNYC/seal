import { describe, expect, test } from "vitest";

import {
  calculatePlatformFee,
  getDaysUntilDue,
  getDueDateParam,
  toStripePaymentMethodTypes,
} from "./payment_field_actions";

describe("calculatePlatformFee", () => {
  test("free tier: 4.5% + 30¢ of 10000 → 480", () => {
    // 10000 * 0.045 + 30 = 450 + 30 = 480
    expect(calculatePlatformFee(10000, false)).toBe(480);
  });

  test("pro tier: 4% + 30¢ of 10000 → 430", () => {
    // 10000 * 0.04 + 30 = 400 + 30 = 430
    expect(calculatePlatformFee(10000, true)).toBe(430);
  });

  test("free tier rounds correctly: 4.5% + 30¢ of 333 → 45", () => {
    // 333 * 0.045 + 30 = 14.985 + 30 = 44.985 → 45
    expect(calculatePlatformFee(333, false)).toBe(45);
  });

  test("zero amount → 30 (fixed fee still applies)", () => {
    // 0 * 0.045 + 30 = 30
    expect(calculatePlatformFee(0, false)).toBe(30);
    // 0 * 0.04 + 30 = 30
    expect(calculatePlatformFee(0, true)).toBe(30);
  });

  test("pro tier small amount: 4% + 30¢ of 100 → 34", () => {
    // 100 * 0.04 + 30 = 4 + 30 = 34
    expect(calculatePlatformFee(100, true)).toBe(34);
  });

  test("free tier $100 payment: 4.5% + 30¢ of 10000 → 480", () => {
    // $100 = 10000 cents. 10000 * 0.045 + 30 = 480
    expect(calculatePlatformFee(10000, false)).toBe(480);
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

describe("getDueDateParam", () => {
  test("calendar date → { due_date } with correct unix timestamp", () => {
    const result = getDueDateParam("custom", undefined, "2026-04-01");
    expect(result).toEqual({ due_date: Math.floor(new Date("2026-04-01").getTime() / 1000) });
  });

  test("calendar date takes priority over customDueDays", () => {
    const result = getDueDateParam("custom", 45, "2026-04-01");
    expect(result).toEqual({ due_date: Math.floor(new Date("2026-04-01").getTime() / 1000) });
    expect(result).not.toHaveProperty("days_until_due");
  });

  test("no calendar date → delegates to getDaysUntilDue", () => {
    expect(getDueDateParam("on_receipt")).toEqual({ days_until_due: 1 });
    expect(getDueDateParam("net_15")).toEqual({ days_until_due: 15 });
    expect(getDueDateParam("net_30")).toEqual({ days_until_due: 30 });
    expect(getDueDateParam("net_60")).toEqual({ days_until_due: 60 });
    expect(getDueDateParam("custom", 45)).toEqual({ days_until_due: 45 });
    expect(getDueDateParam("custom")).toEqual({ days_until_due: 30 });
  });

  test("different calendar dates produce different timestamps", () => {
    const apr1 = getDueDateParam("custom", undefined, "2026-04-01") as { due_date: number };
    const may1 = getDueDateParam("custom", undefined, "2026-05-01") as { due_date: number };
    expect(may1.due_date).toBeGreaterThan(apr1.due_date);
    // 30 days apart = 30 * 86400 seconds
    expect(may1.due_date - apr1.due_date).toBe(30 * 86400);
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
    const result = toStripePaymentMethodTypes([
      "card",
      "apple_pay",
      "ach_debit",
      "google_pay",
      "link",
    ]);
    expect(result).toEqual(["card", "us_bank_account", "link"]);
  });
});
