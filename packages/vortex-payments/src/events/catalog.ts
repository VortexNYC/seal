import type { CanonicalEventType } from "./types";

export interface CanonicalEventDefinition {
  readonly type: CanonicalEventType;
  readonly aggregateType: string;
  readonly description: string;
}

export const canonicalEventCatalog: readonly CanonicalEventDefinition[] = [
  {
    type: "merchant_account.created",
    aggregateType: "merchant_account",
    description: "A merchant account was created inside Vortex Payments.",
  },
  {
    type: "merchant_account.updated",
    aggregateType: "merchant_account",
    description: "A merchant account shell was updated inside Vortex Payments.",
  },
  {
    type: "customer.created",
    aggregateType: "customer",
    description: "A customer profile was created inside Vortex Payments.",
  },
  {
    type: "customer.updated",
    aggregateType: "customer",
    description: "A customer profile was updated inside Vortex Payments.",
  },
  {
    type: "merchant_account.submitted",
    aggregateType: "merchant_account",
    description: "Merchant onboarding was submitted for provider review.",
  },
  {
    type: "merchant_account.approved",
    aggregateType: "merchant_account",
    description: "Merchant account can accept payments.",
  },
  {
    type: "merchant_account.rejected",
    aggregateType: "merchant_account",
    description: "Merchant onboarding was rejected.",
  },
  {
    type: "merchant_account.action_required",
    aggregateType: "merchant_account",
    description: "Merchant onboarding requires more information or documents.",
  },
  {
    type: "merchant_account.restricted",
    aggregateType: "merchant_account",
    description: "Merchant account was restricted by provider or operator policy.",
  },
  {
    type: "merchant_state.updated",
    aggregateType: "merchant_account_state",
    description: "Derived merchant readiness state was recalculated.",
  },
  {
    type: "merchant_capability.updated",
    aggregateType: "merchant_capability",
    description: "A merchant capability changed state.",
  },
  {
    type: "merchant_requirement.submitted",
    aggregateType: "merchant_requirement",
    description: "A merchant onboarding requirement response was submitted.",
  },
  {
    type: "merchant_requirement.refreshed",
    aggregateType: "merchant_requirement",
    description: "A merchant onboarding requirement was refreshed from provider state.",
  },
  {
    type: "merchant_requirement_document.upload_link_created",
    aggregateType: "merchant_requirement_document",
    description: "A merchant onboarding requirement document upload link was created.",
  },
  {
    type: "payment_method.created",
    aggregateType: "payment_method",
    description: "A payment method was created.",
  },
  {
    type: "payment_method.updated",
    aggregateType: "payment_method",
    description: "A payment method was updated.",
  },
  {
    type: "payment.created",
    aggregateType: "payment",
    description: "A payment was created inside Vortex Payments.",
  },
  {
    type: "payment.authorized",
    aggregateType: "payment",
    description: "A payment was authorized.",
  },
  {
    type: "payment.captured",
    aggregateType: "payment",
    description: "A payment was captured successfully.",
  },
  {
    type: "payment.failed",
    aggregateType: "payment",
    description: "A payment failed.",
  },
  {
    type: "payment.canceled",
    aggregateType: "payment",
    description: "A payment authorization or execution was canceled.",
  },
  {
    type: "refund.created",
    aggregateType: "refund",
    description: "A refund was created.",
  },
  {
    type: "refund.succeeded",
    aggregateType: "refund",
    description: "A refund succeeded.",
  },
  {
    type: "refund.failed",
    aggregateType: "refund",
    description: "A refund failed.",
  },
  {
    type: "settlement.accruing_started",
    aggregateType: "settlement",
    description: "A settlement window began accruing funds.",
  },
  {
    type: "settlement.closed",
    aggregateType: "settlement",
    description: "A settlement window closed.",
  },
  {
    type: "settlement.reconciled",
    aggregateType: "settlement",
    description: "A settlement was refreshed from provider state by local reconciliation.",
  },
  {
    type: "payout.created",
    aggregateType: "payout",
    description: "A payout was created.",
  },
  {
    type: "payout.failed",
    aggregateType: "payout",
    description: "A payout failed.",
  },
  {
    type: "payout.succeeded",
    aggregateType: "payout",
    description: "A payout succeeded.",
  },
  {
    type: "payout.returned",
    aggregateType: "payout",
    description: "A payout was returned after submission.",
  },
  {
    type: "payout.reconciled",
    aggregateType: "payout",
    description: "A payout was refreshed from provider state by local reconciliation.",
  },
  {
    type: "dispute.opened",
    aggregateType: "dispute",
    description: "A dispute was opened.",
  },
  {
    type: "dispute.action_required",
    aggregateType: "dispute",
    description: "A dispute requires action before deadline.",
  },
  {
    type: "dispute.won",
    aggregateType: "dispute",
    description: "A dispute was won.",
  },
  {
    type: "dispute.lost",
    aggregateType: "dispute",
    description: "A dispute was lost.",
  },
  {
    type: "dispute.reconciled",
    aggregateType: "dispute",
    description: "A dispute was refreshed from provider state by local reconciliation.",
  },
] as const;
