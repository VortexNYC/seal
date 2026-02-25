import { describe, expect, test } from "vitest";

import { PaymentExtractionSchema } from "./paymentExtractionSchema";

describe("PaymentExtractionSchema", () => {
  const validExtraction = {
    lineItems: [
      { description: "Consulting fee", quantity: 1, unitPriceCents: 500000 },
    ],
    currency: "usd",
    paymentType: "one_time" as const,
    dueDateTerms: "net_30" as const,
  };

  // ─── Valid inputs ──────────────────────────────────────

  test("accepts minimal valid extraction", () => {
    const result = PaymentExtractionSchema.safeParse(validExtraction);
    expect(result.success).toBe(true);
  });

  test("accepts multiple line items", () => {
    const result = PaymentExtractionSchema.safeParse({
      ...validExtraction,
      lineItems: [
        { description: "Design work", quantity: 10, unitPriceCents: 15000 },
        { description: "Development", quantity: 20, unitPriceCents: 20000 },
        { description: "Project management", quantity: 5, unitPriceCents: 10000 },
      ],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.lineItems).toHaveLength(3);
    }
  });

  test("accepts all payment types", () => {
    const types = ["one_time", "recurring", "installments", "deposit_balance"] as const;
    for (const paymentType of types) {
      const result = PaymentExtractionSchema.safeParse({
        ...validExtraction,
        paymentType,
      });
      expect(result.success).toBe(true);
    }
  });

  test("accepts all due date terms", () => {
    const terms = ["on_receipt", "net_15", "net_30", "net_60", "custom"] as const;
    for (const dueDateTerms of terms) {
      const result = PaymentExtractionSchema.safeParse({
        ...validExtraction,
        dueDateTerms,
      });
      expect(result.success).toBe(true);
    }
  });

  test("accepts with recurring config", () => {
    const result = PaymentExtractionSchema.safeParse({
      ...validExtraction,
      paymentType: "recurring",
      recurringConfig: { interval: "month", intervalCount: 1 },
    });
    expect(result.success).toBe(true);
  });

  test("accepts with installments config", () => {
    const result = PaymentExtractionSchema.safeParse({
      ...validExtraction,
      paymentType: "installments",
      installmentsConfig: { count: 4, interval: "month" },
    });
    expect(result.success).toBe(true);
  });

  test("accepts with deposit balance config", () => {
    const result = PaymentExtractionSchema.safeParse({
      ...validExtraction,
      paymentType: "deposit_balance",
      depositBalanceConfig: { depositPercent: 50, balanceDueDays: 30 },
    });
    expect(result.success).toBe(true);
  });

  test("accepts with late fee", () => {
    const result = PaymentExtractionSchema.safeParse({
      ...validExtraction,
      lateFee: { type: "percentage", amount: 1.5, gracePeriodDays: 10 },
    });
    expect(result.success).toBe(true);
  });

  test("accepts with custom due days", () => {
    const result = PaymentExtractionSchema.safeParse({
      ...validExtraction,
      dueDateTerms: "custom",
      customDueDays: 45,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.customDueDays).toBe(45);
    }
  });

  test("accepts with notes", () => {
    const result = PaymentExtractionSchema.safeParse({
      ...validExtraction,
      notes: "Payment due upon project completion",
    });
    expect(result.success).toBe(true);
  });

  test("accepts all currency codes", () => {
    for (const currency of ["usd", "eur", "gbp"]) {
      const result = PaymentExtractionSchema.safeParse({
        ...validExtraction,
        currency,
      });
      expect(result.success).toBe(true);
    }
  });

  // ─── Invalid inputs ──────────────────────────────────────

  test("rejects empty line items", () => {
    const result = PaymentExtractionSchema.safeParse({
      ...validExtraction,
      lineItems: [],
    });
    expect(result.success).toBe(false);
  });

  test("rejects zero quantity", () => {
    const result = PaymentExtractionSchema.safeParse({
      ...validExtraction,
      lineItems: [{ description: "Fee", quantity: 0, unitPriceCents: 1000 }],
    });
    expect(result.success).toBe(false);
  });

  test("rejects negative quantity", () => {
    const result = PaymentExtractionSchema.safeParse({
      ...validExtraction,
      lineItems: [{ description: "Fee", quantity: -1, unitPriceCents: 1000 }],
    });
    expect(result.success).toBe(false);
  });

  test("rejects zero unit price", () => {
    const result = PaymentExtractionSchema.safeParse({
      ...validExtraction,
      lineItems: [{ description: "Fee", quantity: 1, unitPriceCents: 0 }],
    });
    expect(result.success).toBe(false);
  });

  test("rejects negative unit price", () => {
    const result = PaymentExtractionSchema.safeParse({
      ...validExtraction,
      lineItems: [{ description: "Fee", quantity: 1, unitPriceCents: -500 }],
    });
    expect(result.success).toBe(false);
  });

  test("rejects invalid currency length", () => {
    const result = PaymentExtractionSchema.safeParse({
      ...validExtraction,
      currency: "us", // too short
    });
    expect(result.success).toBe(false);
  });

  test("rejects invalid payment type", () => {
    const result = PaymentExtractionSchema.safeParse({
      ...validExtraction,
      paymentType: "invalid_type",
    });
    expect(result.success).toBe(false);
  });

  test("rejects invalid due date terms", () => {
    const result = PaymentExtractionSchema.safeParse({
      ...validExtraction,
      dueDateTerms: "net_90",
    });
    expect(result.success).toBe(false);
  });

  test("rejects installments count below 2", () => {
    const result = PaymentExtractionSchema.safeParse({
      ...validExtraction,
      installmentsConfig: { count: 1, interval: "month" },
    });
    expect(result.success).toBe(false);
  });

  test("rejects deposit percent of 0", () => {
    const result = PaymentExtractionSchema.safeParse({
      ...validExtraction,
      depositBalanceConfig: { depositPercent: 0, balanceDueDays: 30 },
    });
    expect(result.success).toBe(false);
  });

  test("rejects deposit percent of 100", () => {
    const result = PaymentExtractionSchema.safeParse({
      ...validExtraction,
      depositBalanceConfig: { depositPercent: 100, balanceDueDays: 30 },
    });
    expect(result.success).toBe(false);
  });

  test("rejects missing required fields", () => {
    const result = PaymentExtractionSchema.safeParse({
      lineItems: [{ description: "Fee", quantity: 1, unitPriceCents: 1000 }],
      // missing currency, paymentType, dueDateTerms
    });
    expect(result.success).toBe(false);
  });

  // ─── Total calculation ──────────────────────────────────────

  test("correctly parsed data can compute total", () => {
    const result = PaymentExtractionSchema.safeParse({
      ...validExtraction,
      lineItems: [
        { description: "Design", quantity: 2, unitPriceCents: 150000 },
        { description: "Dev", quantity: 3, unitPriceCents: 200000 },
      ],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      const total = result.data.lineItems.reduce(
        (sum, item) => sum + item.quantity * item.unitPriceCents,
        0,
      );
      expect(total).toBe(900000); // $9,000
    }
  });
});
