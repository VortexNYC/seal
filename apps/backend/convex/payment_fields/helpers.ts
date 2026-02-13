import type { Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import type { PaymentType } from "../schemas/payment_field_configs";

/**
 * Payment Field Helper Functions
 *
 * Validation and computation utilities for payment field configurations.
 */

/** Minimum payment amount: $0.50 (Stripe minimum) */
const MIN_AMOUNT_CENTS = 50;
/** Maximum payment amount: $999,999.99 */
const MAX_AMOUNT_CENTS = 99_999_999;

/**
 * Compute the total amount in cents from line items.
 */
export function computeTotalAmountCents(
  items: Array<{ quantity: number; unitPrice: number }>,
): number {
  return items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
}

/**
 * Validate a payment configuration before persisting.
 * Returns an error string if invalid, or null if valid.
 */
export function validatePaymentConfig(config: {
  paymentType: PaymentType;
  items: Array<{ id: string; description: string; quantity: number; unitPrice: number }>;
  totalAmountCents: number;
  allowedPaymentMethods: string[];
  recurringConfig?: { intervalCount: number; endCondition: string; endAfterCount?: number };
  installmentsConfig?: { count: number };
  depositBalanceConfig?: { depositPercent: number; balanceDueDays: number };
}): string | null {
  // Must have at least one line item
  if (config.items.length === 0) {
    return "At least one line item is required";
  }

  // Validate each line item
  for (const item of config.items) {
    if (!item.description.trim()) {
      return "Each line item must have a description";
    }
    if (item.quantity <= 0) {
      return "Quantity must be greater than zero";
    }
    if (item.unitPrice < 0) {
      return "Unit price cannot be negative";
    }
  }

  // Validate total amount
  if (config.totalAmountCents < MIN_AMOUNT_CENTS) {
    return `Total amount must be at least $${(MIN_AMOUNT_CENTS / 100).toFixed(2)}`;
  }
  if (config.totalAmountCents > MAX_AMOUNT_CENTS) {
    return `Total amount cannot exceed $${(MAX_AMOUNT_CENTS / 100).toLocaleString()}`;
  }

  // Must have at least one payment method
  if (config.allowedPaymentMethods.length === 0) {
    return "At least one payment method must be selected";
  }

  // Validate type-specific configs
  if (config.paymentType === "recurring") {
    if (!config.recurringConfig) {
      return "Recurring configuration is required for recurring payments";
    }
    if (config.recurringConfig.intervalCount < 1) {
      return "Recurring interval count must be at least 1";
    }
    if (
      config.recurringConfig.endCondition === "after_count" &&
      (!config.recurringConfig.endAfterCount || config.recurringConfig.endAfterCount < 1)
    ) {
      return "End after count must be at least 1";
    }
  }

  if (config.paymentType === "installments") {
    if (!config.installmentsConfig) {
      return "Installments configuration is required for installment payments";
    }
    if (config.installmentsConfig.count < 2) {
      return "Number of installments must be at least 2";
    }
  }

  if (config.paymentType === "deposit_balance") {
    if (!config.depositBalanceConfig) {
      return "Deposit/balance configuration is required";
    }
    if (
      config.depositBalanceConfig.depositPercent <= 0 ||
      config.depositBalanceConfig.depositPercent >= 100
    ) {
      return "Deposit percentage must be between 1 and 99";
    }
    if (config.depositBalanceConfig.balanceDueDays < 1) {
      return "Balance due days must be at least 1";
    }
  }

  return null;
}

/**
 * Guard: Ensure only one payment field per recipient per document.
 * Returns the existing payment field if one exists, or null.
 */
export async function findExistingPaymentFieldForRecipient(
  ctx: QueryCtx,
  documentId: Id<"documents">,
  recipientId: Id<"document_recipients">,
  excludeFieldId?: Id<"signature_fields">,
): Promise<Id<"signature_fields"> | null> {
  const fields = await ctx.db
    .query("signature_fields")
    .withIndex("by_document_recipient", (q) =>
      q.eq("documentId", documentId).eq("recipientId", recipientId),
    )
    .filter((q) => q.eq(q.field("fieldType"), "payment"))
    .collect();

  const existing = excludeFieldId ? fields.find((f) => f._id !== excludeFieldId) : fields[0];

  return existing?._id ?? null;
}
