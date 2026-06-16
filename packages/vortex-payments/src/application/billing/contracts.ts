/**
 * Transitional re-export.
 * Canonical shared contract now lives in `packages/contracts/src/payments/billing.ts`.
 */
export type {
  BillingCollectInvoicePaymentCommand as CollectInvoicePaymentCommand,
  BillingCollectInvoicePaymentResult as CollectInvoicePaymentResult,
  BillingCustomerPaymentMethodSummary,
  BillingGetCustomerPaymentMethodsQuery as GetCustomerPaymentMethodsQuery,
  BillingGetMerchantReadinessQuery as GetMerchantReadinessQuery,
  BillingMerchantReadinessSnapshot as MerchantReadinessSnapshot,
  BillingPaymentsPort,
  BillingReconcileInvoicePaymentQuery as ReconcileInvoicePaymentQuery,
  BillingReconcileInvoicePaymentResult as ReconcileInvoicePaymentResult,
  BillingReconcileInvoiceRefundQuery as ReconcileInvoiceRefundQuery,
  BillingReconcileInvoiceRefundResult as ReconcileInvoiceRefundResult,
  BillingRefundInvoicePaymentCommand as RefundInvoicePaymentCommand,
  BillingRefundInvoicePaymentResult as RefundInvoicePaymentResult,
} from "@vortex/contracts/payments/billing";

export type BillingAccountId = string;
export type BillingInvoiceId = string;
