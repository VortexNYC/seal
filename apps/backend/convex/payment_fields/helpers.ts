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

type PaymentConfig = {
  paymentType: PaymentType;
  items: Array<{ id: string; description: string; quantity: number; unitPrice: number }>;
  totalAmountCents: number;
  allowedPaymentMethods: string[];
  recurringConfig?: { intervalCount: number; endCondition: string; endAfterCount?: number };
  installmentsConfig?: { count: number };
  depositBalanceConfig?: { depositPercent: number; balanceDueDays: number };
};

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
export function validatePaymentConfig(config: PaymentConfig): string | null {
  return (
    validateLineItems(config.items) ??
    validateTotalAmount(config.totalAmountCents) ??
    validatePaymentMethods(config.allowedPaymentMethods) ??
    validateTypeSpecificConfig(config)
  );
}

function validateLineItems(items: PaymentConfig["items"]): string | null {
  if (items.length === 0) {
    return "At least one line item is required";
  }

  for (const item of items) {
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

  return null;
}

function validateTotalAmount(totalAmountCents: number): string | null {
  if (totalAmountCents < MIN_AMOUNT_CENTS) {
    return `Total amount must be at least $${(MIN_AMOUNT_CENTS / 100).toFixed(2)}`;
  }
  if (totalAmountCents > MAX_AMOUNT_CENTS) {
    return `Total amount cannot exceed $${(MAX_AMOUNT_CENTS / 100).toLocaleString()}`;
  }
  return null;
}

function validatePaymentMethods(allowedPaymentMethods: string[]): string | null {
  if (allowedPaymentMethods.length === 0) {
    return "At least one payment method must be selected";
  }
  return null;
}

function validateTypeSpecificConfig(config: PaymentConfig): string | null {
  switch (config.paymentType) {
    case "recurring":
      return validateRecurringConfig(config.recurringConfig);
    case "installments":
      return validateInstallmentsConfig(config.installmentsConfig);
    case "deposit_balance":
      return validateDepositBalanceConfig(config.depositBalanceConfig);
    default:
      return null;
  }
}

function validateRecurringConfig(config: PaymentConfig["recurringConfig"]): string | null {
  if (!config) {
    return "Recurring configuration is required for recurring payments";
  }
  if (config.intervalCount < 1) {
    return "Recurring interval count must be at least 1";
  }
  if (
    config.endCondition === "after_count" &&
    (!config.endAfterCount || config.endAfterCount < 1)
  ) {
    return "End after count must be at least 1";
  }
  return null;
}

function validateInstallmentsConfig(config: PaymentConfig["installmentsConfig"]): string | null {
  if (!config) {
    return "Installments configuration is required for installment payments";
  }
  if (config.count < 2) {
    return "Number of installments must be at least 2";
  }
  return null;
}

function validateDepositBalanceConfig(
  config: PaymentConfig["depositBalanceConfig"],
): string | null {
  if (!config) {
    return "Deposit/balance configuration is required";
  }
  if (config.depositPercent <= 0 || config.depositPercent >= 100) {
    return "Deposit percentage must be between 1 and 99";
  }
  if (config.balanceDueDays < 1) {
    return "Balance due days must be at least 1";
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
