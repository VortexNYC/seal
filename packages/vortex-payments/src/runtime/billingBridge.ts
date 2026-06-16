import type {
  BillingCollectInvoicePaymentCommand,
  BillingCollectInvoicePaymentResult,
  BillingCustomerPaymentMethodSummary,
  BillingGetCustomerPaymentMethodsQuery,
  BillingGetMerchantReadinessQuery,
  BillingMerchantReadinessSnapshot,
  BillingReconcileInvoicePaymentQuery,
  BillingReconcileInvoicePaymentResult,
  BillingReconcileInvoiceRefundQuery,
  BillingReconcileInvoiceRefundResult,
  BillingRefundInvoicePaymentCommand,
  BillingRefundInvoicePaymentResult,
} from "@vortex/contracts/payments/billing";

export interface BillingPaymentsEmbeddedBridge {
  collectInvoicePayment(
    command: BillingCollectInvoicePaymentCommand,
  ): Promise<BillingCollectInvoicePaymentResult>;
  refundInvoicePayment(
    command: BillingRefundInvoicePaymentCommand,
  ): Promise<BillingRefundInvoicePaymentResult>;
  reconcileInvoicePayment(
    query: BillingReconcileInvoicePaymentQuery,
  ): Promise<BillingReconcileInvoicePaymentResult | null>;
  reconcileInvoiceRefund(
    query: BillingReconcileInvoiceRefundQuery,
  ): Promise<BillingReconcileInvoiceRefundResult | null>;
  getMerchantReadiness(
    query: BillingGetMerchantReadinessQuery,
  ): Promise<BillingMerchantReadinessSnapshot | null>;
  listCustomerPaymentMethods(
    query: BillingGetCustomerPaymentMethodsQuery,
  ): Promise<readonly BillingCustomerPaymentMethodSummary[]>;
}

let embeddedBridge: BillingPaymentsEmbeddedBridge | null = null;

export function registerBillingPaymentsEmbeddedBridge(
  bridge: BillingPaymentsEmbeddedBridge,
): void {
  embeddedBridge = bridge;
}

export function clearBillingPaymentsEmbeddedBridge(): void {
  embeddedBridge = null;
}

export function getBillingPaymentsEmbeddedBridge(): BillingPaymentsEmbeddedBridge | null {
  return embeddedBridge;
}
