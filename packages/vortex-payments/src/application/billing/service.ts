import type {
  BillingCustomerPaymentMethodSummary,
  BillingPaymentsPort,
  CollectInvoicePaymentCommand,
  CollectInvoicePaymentResult,
  GetCustomerPaymentMethodsQuery,
  GetMerchantReadinessQuery,
  MerchantReadinessSnapshot,
  ReconcileInvoicePaymentQuery,
  ReconcileInvoicePaymentResult,
  ReconcileInvoiceRefundQuery,
  ReconcileInvoiceRefundResult,
  RefundInvoicePaymentCommand,
  RefundInvoicePaymentResult,
} from "./contracts";

/**
 * Payments-side implementation seam for serving `vortex-billing`.
 * Concrete implementation can live behind HTTP handlers, workers, or in-process adapters.
 */
export interface BillingPaymentsService extends BillingPaymentsPort {
  collectInvoicePayment(command: CollectInvoicePaymentCommand): Promise<CollectInvoicePaymentResult>;
  refundInvoicePayment(command: RefundInvoicePaymentCommand): Promise<RefundInvoicePaymentResult>;
  reconcileInvoicePayment(query: ReconcileInvoicePaymentQuery): Promise<ReconcileInvoicePaymentResult | null>;
  reconcileInvoiceRefund(query: ReconcileInvoiceRefundQuery): Promise<ReconcileInvoiceRefundResult | null>;
  getMerchantReadiness(query: GetMerchantReadinessQuery): Promise<MerchantReadinessSnapshot | null>;
  listCustomerPaymentMethods(
    query: GetCustomerPaymentMethodsQuery,
  ): Promise<readonly BillingCustomerPaymentMethodSummary[]>;
}
