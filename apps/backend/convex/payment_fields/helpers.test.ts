import { describe, expect, test } from "vitest";

import { computeTotalAmountCents, validatePaymentConfig } from "./helpers";

describe("computeTotalAmountCents", () => {
  test("computes total from single item", () => {
    const total = computeTotalAmountCents([{ quantity: 1, unitPrice: 5000 }]);
    expect(total).toBe(5000);
  });

  test("computes total from multiple items", () => {
    const total = computeTotalAmountCents([
      { quantity: 2, unitPrice: 1000 },
      { quantity: 1, unitPrice: 3000 },
    ]);
    expect(total).toBe(5000);
  });

  test("returns 0 for empty items", () => {
    const total = computeTotalAmountCents([]);
    expect(total).toBe(0);
  });

  test("handles large quantities", () => {
    const total = computeTotalAmountCents([{ quantity: 100, unitPrice: 999 }]);
    expect(total).toBe(99900);
  });
});

describe("validatePaymentConfig", () => {
  const validBaseConfig = {
    paymentType: "one_time" as const,
    items: [
      {
        id: "item-1",
        description: "Service fee",
        quantity: 1,
        unitPrice: 5000,
      },
    ],
    totalAmountCents: 5000,
    allowedPaymentMethods: ["card"],
  };

  test("returns null for valid one-time config", () => {
    expect(validatePaymentConfig(validBaseConfig)).toBeNull();
  });

  test("rejects empty items array", () => {
    const result = validatePaymentConfig({
      ...validBaseConfig,
      items: [],
    });
    expect(result).toBe("At least one line item is required");
  });

  test("rejects item with empty description", () => {
    const result = validatePaymentConfig({
      ...validBaseConfig,
      items: [
        { id: "item-1", description: "  ", quantity: 1, unitPrice: 5000 },
      ],
    });
    expect(result).toBe("Each line item must have a description");
  });

  test("rejects item with zero quantity", () => {
    const result = validatePaymentConfig({
      ...validBaseConfig,
      items: [
        { id: "item-1", description: "Fee", quantity: 0, unitPrice: 5000 },
      ],
    });
    expect(result).toBe("Quantity must be greater than zero");
  });

  test("rejects item with negative unit price", () => {
    const result = validatePaymentConfig({
      ...validBaseConfig,
      items: [
        { id: "item-1", description: "Fee", quantity: 1, unitPrice: -100 },
      ],
    });
    expect(result).toBe("Unit price cannot be negative");
  });

  test("rejects total below $0.50 minimum", () => {
    const result = validatePaymentConfig({
      ...validBaseConfig,
      items: [{ id: "item-1", description: "Fee", quantity: 1, unitPrice: 10 }],
      totalAmountCents: 10,
    });
    expect(result).toBe("Total amount must be at least $0.50");
  });

  test("rejects total above $999,999.99 maximum", () => {
    const result = validatePaymentConfig({
      ...validBaseConfig,
      items: [
        {
          id: "item-1",
          description: "Fee",
          quantity: 1,
          unitPrice: 100_000_000,
        },
      ],
      totalAmountCents: 100_000_000,
    });
    expect(result).toMatch(/Total amount cannot exceed/);
  });

  test("accepts total at exactly $0.50", () => {
    const result = validatePaymentConfig({
      ...validBaseConfig,
      items: [{ id: "item-1", description: "Fee", quantity: 1, unitPrice: 50 }],
      totalAmountCents: 50,
    });
    expect(result).toBeNull();
  });

  test("rejects empty payment methods", () => {
    const result = validatePaymentConfig({
      ...validBaseConfig,
      allowedPaymentMethods: [],
    });
    expect(result).toBe("At least one payment method must be selected");
  });

  // Recurring validation
  test("rejects recurring without recurringConfig", () => {
    const result = validatePaymentConfig({
      ...validBaseConfig,
      paymentType: "recurring",
    });
    expect(result).toBe(
      "Recurring configuration is required for recurring payments"
    );
  });

  test("rejects recurring with intervalCount < 1", () => {
    const result = validatePaymentConfig({
      ...validBaseConfig,
      paymentType: "recurring",
      recurringConfig: { intervalCount: 0, endCondition: "never" },
    });
    expect(result).toBe("Recurring interval count must be at least 1");
  });

  test("rejects recurring after_count with missing endAfterCount", () => {
    const result = validatePaymentConfig({
      ...validBaseConfig,
      paymentType: "recurring",
      recurringConfig: { intervalCount: 1, endCondition: "after_count" },
    });
    expect(result).toBe("End after count must be at least 1");
  });

  test("accepts valid recurring config", () => {
    const result = validatePaymentConfig({
      ...validBaseConfig,
      paymentType: "recurring",
      recurringConfig: { intervalCount: 1, endCondition: "never" },
    });
    expect(result).toBeNull();
  });

  // Installments validation
  test("rejects installments without installmentsConfig", () => {
    const result = validatePaymentConfig({
      ...validBaseConfig,
      paymentType: "installments",
    });
    expect(result).toBe(
      "Installments configuration is required for installment payments"
    );
  });

  test("rejects installments with count < 2", () => {
    const result = validatePaymentConfig({
      ...validBaseConfig,
      paymentType: "installments",
      installmentsConfig: { count: 1 },
    });
    expect(result).toBe("Number of installments must be at least 2");
  });

  test("accepts valid installments config", () => {
    const result = validatePaymentConfig({
      ...validBaseConfig,
      paymentType: "installments",
      installmentsConfig: { count: 3 },
    });
    expect(result).toBeNull();
  });

  // Deposit + Balance validation
  test("rejects deposit_balance without config", () => {
    const result = validatePaymentConfig({
      ...validBaseConfig,
      paymentType: "deposit_balance",
    });
    expect(result).toBe("Deposit/balance configuration is required");
  });

  test("rejects deposit percent of 0", () => {
    const result = validatePaymentConfig({
      ...validBaseConfig,
      paymentType: "deposit_balance",
      depositBalanceConfig: { depositPercent: 0, balanceDueDays: 30 },
    });
    expect(result).toBe("Deposit percentage must be between 1 and 99");
  });

  test("rejects deposit percent of 100", () => {
    const result = validatePaymentConfig({
      ...validBaseConfig,
      paymentType: "deposit_balance",
      depositBalanceConfig: { depositPercent: 100, balanceDueDays: 30 },
    });
    expect(result).toBe("Deposit percentage must be between 1 and 99");
  });

  test("rejects balance due days < 1", () => {
    const result = validatePaymentConfig({
      ...validBaseConfig,
      paymentType: "deposit_balance",
      depositBalanceConfig: { depositPercent: 50, balanceDueDays: 0 },
    });
    expect(result).toBe("Balance due days must be at least 1");
  });

  test("accepts valid deposit_balance config", () => {
    const result = validatePaymentConfig({
      ...validBaseConfig,
      paymentType: "deposit_balance",
      depositBalanceConfig: { depositPercent: 50, balanceDueDays: 30 },
    });
    expect(result).toBeNull();
  });
});
