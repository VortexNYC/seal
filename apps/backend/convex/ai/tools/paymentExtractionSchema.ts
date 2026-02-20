/**
 * Zod schema for AI-extracted payment data.
 *
 * Extracted to its own module so tests can import it without
 * pulling in side-effect-heavy deps (@convex-dev/agent, etc.).
 */

import { z } from "zod";

export const PaymentExtractionSchema = z.object({
  lineItems: z
    .array(
      z.object({
        description: z
          .string()
          .describe("Description of the line item, e.g. 'Monthly consulting fee'"),
        quantity: z.number().positive().describe("Quantity (default 1 if not specified)"),
        unitPriceCents: z
          .number()
          .int()
          .positive()
          .describe("Unit price in cents, e.g. 500000 for $5,000.00"),
      }),
    )
    .nonempty()
    .describe("Extracted line items from the document"),
  currency: z
    .string()
    .length(3)
    .describe(
      "ISO 4217 currency code, e.g. 'usd', 'eur', 'gbp'. Infer from $ → usd, € → eur, £ → gbp",
    ),
  paymentType: z
    .enum(["one_time", "recurring", "installments", "deposit_balance"])
    .describe(
      "Payment structure: one_time for single payments, recurring for subscriptions, installments for split payments, deposit_balance for upfront deposit + later balance",
    ),
  dueDateTerms: z
    .enum(["on_receipt", "net_15", "net_30", "net_60", "custom"])
    .describe("Payment due terms. Infer from 'due upon receipt', 'net 30', etc."),
  customDueDays: z
    .number()
    .int()
    .positive()
    .optional()
    .describe("Custom due days if dueDateTerms is 'custom'"),
  lateFee: z
    .object({
      type: z.enum(["percentage", "fixed"]),
      amount: z
        .number()
        .positive()
        .describe("Late fee amount — percentage (e.g. 2 for 2%) or fixed cents"),
      gracePeriodDays: z
        .number()
        .int()
        .nonnegative()
        .describe("Grace period in days before late fee applies"),
    })
    .optional()
    .describe("Late fee terms if mentioned in the document"),
  recurringConfig: z
    .object({
      interval: z.enum(["week", "month", "year"]),
      intervalCount: z.number().int().positive().describe("e.g. 1 for monthly, 2 for bi-monthly"),
    })
    .optional()
    .describe("Recurring/subscription config if paymentType is 'recurring'"),
  installmentsConfig: z
    .object({
      count: z.number().int().min(2).describe("Number of installment payments"),
      interval: z.enum(["week", "month"]),
    })
    .optional()
    .describe("Installment config if paymentType is 'installments'"),
  depositBalanceConfig: z
    .object({
      depositPercent: z.number().min(1).max(99).describe("Deposit percentage, e.g. 50 for 50%"),
      balanceDueDays: z
        .number()
        .int()
        .positive()
        .describe("Days after signing when balance is due"),
    })
    .optional()
    .describe("Deposit/balance config if paymentType is 'deposit_balance'"),
  notes: z
    .string()
    .optional()
    .describe("Any additional payment context from the document that doesn't fit above fields"),
});

export type PaymentExtractionResult = z.infer<typeof PaymentExtractionSchema>;
