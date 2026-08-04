import { describe, expect, test } from "vitest";

import { computeTotalAmountCents, validatePaymentConfig } from "../helpers";

// ─── Helper to build a valid base config ─────────────────────────────────────

interface PaymentConfigInput {
  paymentType: "one_time" | "recurring" | "installments" | "deposit_balance";
  items: Array<{
    id: string;
    description: string;
    quantity: number;
    unitPrice: number;
  }>;
  totalAmountCents: number;
  allowedPaymentMethods: string[];
  recurringConfig?: {
    intervalCount: number;
    endCondition: string;
    endAfterCount?: number;
  };
  installmentsConfig?: { count: number };
  depositBalanceConfig?: { depositPercent: number; balanceDueDays: number };
}

function validOneTimeConfig(
  overrides: Partial<PaymentConfigInput> = {}
): PaymentConfigInput {
  return {
    paymentType: "one_time",
    items: [
      { id: "item-1", description: "Widget", quantity: 1, unitPrice: 1000 },
    ],
    totalAmountCents: 1000,
    allowedPaymentMethods: ["card"],
    ...overrides,
  };
}

// ─── computeTotalAmountCents ─────────────────────────────────────────────────

describe("computeTotalAmountCents", () => {
  test("returns 0 for empty array", () => {
    expect(computeTotalAmountCents([])).toBe(0);
  });

  test("computes total for a single item", () => {
    expect(computeTotalAmountCents([{ quantity: 2, unitPrice: 500 }])).toBe(
      1000
    );
  });

  test("computes total for multiple items", () => {
    const items = [
      { quantity: 1, unitPrice: 1000 },
      { quantity: 3, unitPrice: 250 },
      { quantity: 2, unitPrice: 100 },
    ];
    // 1000 + 750 + 200 = 1950
    expect(computeTotalAmountCents(items)).toBe(1950);
  });

  test("handles zero quantity (contributes 0)", () => {
    const items = [
      { quantity: 0, unitPrice: 500 },
      { quantity: 1, unitPrice: 200 },
    ];
    expect(computeTotalAmountCents(items)).toBe(200);
  });

  test("handles zero unit price", () => {
    expect(computeTotalAmountCents([{ quantity: 5, unitPrice: 0 }])).toBe(0);
  });

  test("handles large quantities and prices", () => {
    expect(computeTotalAmountCents([{ quantity: 9999, unitPrice: 9999 }])).toBe(
      9999 * 9999
    );
  });
});

// ─── validatePaymentConfig ──────────────────────────────────────────────────

describe("validatePaymentConfig", () => {
  // ── Valid configs ──────────────────────────────────────────────────────────

  test("accepts a valid one_time config", () => {
    expect(validatePaymentConfig(validOneTimeConfig())).toBeNull();
  });

  test("accepts a valid recurring config", () => {
    const config = validOneTimeConfig({
      paymentType: "recurring",
      recurringConfig: { intervalCount: 1, endCondition: "never" },
    });
    expect(validatePaymentConfig(config)).toBeNull();
  });

  test("accepts a valid recurring config with after_count end condition", () => {
    const config = validOneTimeConfig({
      paymentType: "recurring",
      recurringConfig: {
        intervalCount: 1,
        endCondition: "after_count",
        endAfterCount: 12,
      },
    });
    expect(validatePaymentConfig(config)).toBeNull();
  });

  test("accepts a valid installments config", () => {
    const config = validOneTimeConfig({
      paymentType: "installments",
      installmentsConfig: { count: 4 },
    });
    expect(validatePaymentConfig(config)).toBeNull();
  });

  test("accepts a valid deposit_balance config", () => {
    const config = validOneTimeConfig({
      paymentType: "deposit_balance",
      depositBalanceConfig: { depositPercent: 50, balanceDueDays: 30 },
    });
    expect(validatePaymentConfig(config)).toBeNull();
  });

  test("accepts multiple allowed payment methods", () => {
    const config = validOneTimeConfig({
      allowedPaymentMethods: ["card", "us_bank_account"],
    });
    expect(validatePaymentConfig(config)).toBeNull();
  });

  // ── Line item validation ──────────────────────────────────────────────────

  test("rejects empty items array", () => {
    const result = validatePaymentConfig(validOneTimeConfig({ items: [] }));
    expect(result).toBe("At least one line item is required");
  });

  test("rejects item with empty description", () => {
    const result = validatePaymentConfig(
      validOneTimeConfig({
        items: [{ id: "1", description: "", quantity: 1, unitPrice: 100 }],
      })
    );
    expect(result).toBe("Each line item must have a description");
  });

  test("rejects item with whitespace-only description", () => {
    const result = validatePaymentConfig(
      validOneTimeConfig({
        items: [{ id: "1", description: "   ", quantity: 1, unitPrice: 100 }],
      })
    );
    expect(result).toBe("Each line item must have a description");
  });

  test("rejects item with quantity zero", () => {
    const result = validatePaymentConfig(
      validOneTimeConfig({
        items: [
          { id: "1", description: "Widget", quantity: 0, unitPrice: 100 },
        ],
      })
    );
    expect(result).toBe("Quantity must be greater than zero");
  });

  test("rejects item with negative quantity", () => {
    const result = validatePaymentConfig(
      validOneTimeConfig({
        items: [
          { id: "1", description: "Widget", quantity: -1, unitPrice: 100 },
        ],
      })
    );
    expect(result).toBe("Quantity must be greater than zero");
  });

  test("rejects item with negative unit price", () => {
    const result = validatePaymentConfig(
      validOneTimeConfig({
        items: [
          { id: "1", description: "Widget", quantity: 1, unitPrice: -50 },
        ],
      })
    );
    expect(result).toBe("Unit price cannot be negative");
  });

  test("accepts item with zero unit price", () => {
    const config = validOneTimeConfig({
      items: [
        { id: "1", description: "Free add-on", quantity: 1, unitPrice: 0 },
        { id: "2", description: "Widget", quantity: 1, unitPrice: 1000 },
      ],
      totalAmountCents: 1000,
    });
    expect(validatePaymentConfig(config)).toBeNull();
  });

  // ── Amount boundaries ─────────────────────────────────────────────────────

  test("rejects total amount below minimum (50 cents)", () => {
    const result = validatePaymentConfig(
      validOneTimeConfig({
        items: [{ id: "1", description: "Cheap", quantity: 1, unitPrice: 49 }],
        totalAmountCents: 49,
      })
    );
    expect(result).toContain("Total amount must be at least");
  });

  test("accepts total amount at exact minimum (50 cents)", () => {
    const config = validOneTimeConfig({
      items: [{ id: "1", description: "Minimum", quantity: 1, unitPrice: 50 }],
      totalAmountCents: 50,
    });
    expect(validatePaymentConfig(config)).toBeNull();
  });

  test("rejects total amount above maximum (99_999_999)", () => {
    const result = validatePaymentConfig(
      validOneTimeConfig({
        items: [
          {
            id: "1",
            description: "Expensive",
            quantity: 1,
            unitPrice: 100_000_000,
          },
        ],
        totalAmountCents: 100_000_000,
      })
    );
    expect(result).toContain("Total amount cannot exceed");
  });

  test("accepts total amount at exact maximum (99_999_999)", () => {
    const config = validOneTimeConfig({
      items: [
        { id: "1", description: "Max", quantity: 1, unitPrice: 99_999_999 },
      ],
      totalAmountCents: 99_999_999,
    });
    expect(validatePaymentConfig(config)).toBeNull();
  });

  // ── Payment methods ───────────────────────────────────────────────────────

  test("rejects empty allowed payment methods", () => {
    const result = validatePaymentConfig(
      validOneTimeConfig({ allowedPaymentMethods: [] })
    );
    expect(result).toBe("At least one payment method must be selected");
  });

  // ── Recurring validation ──────────────────────────────────────────────────

  test("rejects recurring without recurringConfig", () => {
    const result = validatePaymentConfig(
      validOneTimeConfig({
        paymentType: "recurring",
        recurringConfig: undefined,
      })
    );
    expect(result).toBe(
      "Recurring configuration is required for recurring payments"
    );
  });

  test("rejects recurring with intervalCount < 1", () => {
    const result = validatePaymentConfig(
      validOneTimeConfig({
        paymentType: "recurring",
        recurringConfig: { intervalCount: 0, endCondition: "never" },
      })
    );
    expect(result).toBe("Recurring interval count must be at least 1");
  });

  test("rejects recurring after_count with missing endAfterCount", () => {
    const result = validatePaymentConfig(
      validOneTimeConfig({
        paymentType: "recurring",
        recurringConfig: { intervalCount: 1, endCondition: "after_count" },
      })
    );
    expect(result).toBe("End after count must be at least 1");
  });

  test("rejects recurring after_count with endAfterCount < 1", () => {
    const result = validatePaymentConfig(
      validOneTimeConfig({
        paymentType: "recurring",
        recurringConfig: {
          intervalCount: 1,
          endCondition: "after_count",
          endAfterCount: 0,
        },
      })
    );
    expect(result).toBe("End after count must be at least 1");
  });

  // ── Installments validation ───────────────────────────────────────────────

  test("rejects installments without installmentsConfig", () => {
    const result = validatePaymentConfig(
      validOneTimeConfig({
        paymentType: "installments",
        installmentsConfig: undefined,
      })
    );
    expect(result).toBe(
      "Installments configuration is required for installment payments"
    );
  });

  test("rejects installments with count < 2", () => {
    const result = validatePaymentConfig(
      validOneTimeConfig({
        paymentType: "installments",
        installmentsConfig: { count: 1 },
      })
    );
    expect(result).toBe("Number of installments must be at least 2");
  });

  test("accepts installments with count = 2 (minimum)", () => {
    const config = validOneTimeConfig({
      paymentType: "installments",
      installmentsConfig: { count: 2 },
    });
    expect(validatePaymentConfig(config)).toBeNull();
  });

  // ── Deposit/balance validation ────────────────────────────────────────────

  test("rejects deposit_balance without depositBalanceConfig", () => {
    const result = validatePaymentConfig(
      validOneTimeConfig({
        paymentType: "deposit_balance",
        depositBalanceConfig: undefined,
      })
    );
    expect(result).toBe("Deposit/balance configuration is required");
  });

  test("rejects deposit percentage of 0", () => {
    const result = validatePaymentConfig(
      validOneTimeConfig({
        paymentType: "deposit_balance",
        depositBalanceConfig: { depositPercent: 0, balanceDueDays: 30 },
      })
    );
    expect(result).toBe("Deposit percentage must be between 1 and 99");
  });

  test("rejects deposit percentage of 100", () => {
    const result = validatePaymentConfig(
      validOneTimeConfig({
        paymentType: "deposit_balance",
        depositBalanceConfig: { depositPercent: 100, balanceDueDays: 30 },
      })
    );
    expect(result).toBe("Deposit percentage must be between 1 and 99");
  });

  test("accepts deposit percentage of 1 (minimum)", () => {
    const config = validOneTimeConfig({
      paymentType: "deposit_balance",
      depositBalanceConfig: { depositPercent: 1, balanceDueDays: 1 },
    });
    expect(validatePaymentConfig(config)).toBeNull();
  });

  test("accepts deposit percentage of 99 (maximum)", () => {
    const config = validOneTimeConfig({
      paymentType: "deposit_balance",
      depositBalanceConfig: { depositPercent: 99, balanceDueDays: 1 },
    });
    expect(validatePaymentConfig(config)).toBeNull();
  });

  test("rejects balanceDueDays < 1", () => {
    const result = validatePaymentConfig(
      validOneTimeConfig({
        paymentType: "deposit_balance",
        depositBalanceConfig: { depositPercent: 50, balanceDueDays: 0 },
      })
    );
    expect(result).toBe("Balance due days must be at least 1");
  });

  // ── Cross-cutting: type-specific config ignored for other types ───────────

  test("ignores recurringConfig when paymentType is one_time", () => {
    const config = validOneTimeConfig({
      paymentType: "one_time",
      recurringConfig: { intervalCount: 0, endCondition: "never" },
    });
    expect(validatePaymentConfig(config)).toBeNull();
  });

  test("ignores installmentsConfig when paymentType is one_time", () => {
    const config = validOneTimeConfig({
      paymentType: "one_time",
      installmentsConfig: { count: 0 },
    });
    expect(validatePaymentConfig(config)).toBeNull();
  });

  // ── Multiple items validation ─────────────────────────────────────────────

  test("returns first error when multiple items have issues", () => {
    const result = validatePaymentConfig(
      validOneTimeConfig({
        items: [
          { id: "1", description: "Good", quantity: 1, unitPrice: 100 },
          { id: "2", description: "", quantity: 1, unitPrice: 100 },
        ],
        totalAmountCents: 200,
      })
    );
    expect(result).toBe("Each line item must have a description");
  });
});
