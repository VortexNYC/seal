import type { PaymentMethod } from "../../domain/payment-methods";
import type { PaymentIntentStatus } from "../../domain/payments";
import type { CustomerPaymentState, MerchantAccountState } from "../../domain/state";
import type {
  BillingCustomerPaymentMethodSummary,
  CollectInvoicePaymentCommand,
  CollectInvoicePaymentResult,
  MerchantReadinessSnapshot,
} from "./contracts";

export interface BillingCollectInvoiceExecutionResult {
  readonly paymentIntentId: string;
  readonly paymentId: string;
  readonly paymentStatus: PaymentIntentStatus;
  readonly requiresAction: boolean;
  readonly nextStep: "none" | "complete_required_action" | "capture" | "cancel" | "retry";
  readonly hostedActionUrl?: string;
  readonly nextActionType?: string;
}

export function mapCollectInvoiceExecutionResult(
  command: CollectInvoicePaymentCommand,
  result: BillingCollectInvoiceExecutionResult,
): CollectInvoicePaymentResult {
  return {
    invoiceId: command.invoiceId,
    paymentIntentId: result.paymentIntentId,
    paymentId: result.paymentId,
    paymentStatus: result.paymentStatus,
    requiresAction: result.requiresAction,
    nextStep: result.nextStep,
    hostedActionUrl: result.hostedActionUrl,
    nextActionType: result.nextActionType,
  };
}

export function mapMerchantAccountStateToReadinessSnapshot(
  state: MerchantAccountState,
): MerchantReadinessSnapshot {
  return {
    merchantAccountId: state.merchantAccountId,
    merchantStatus: state.merchantStatus,
    canAcceptPayments: state.canAcceptPayments,
    payoutReadiness: state.payoutReadiness,
    payoutBlockReason: state.payoutBlockReason,
  };
}

export function mapCustomerPaymentStateToDefaultPaymentMethodId(
  state: CustomerPaymentState,
): string | undefined {
  return state.defaultPaymentMethodId;
}

export function mapPaymentMethodsToBillingSummaries(
  paymentMethods: readonly PaymentMethod[],
): readonly BillingCustomerPaymentMethodSummary[] {
  return paymentMethods
    .filter(
      (paymentMethod) =>
        paymentMethod.ownerType === "customer" && paymentMethod.status === "active",
    )
    .map((paymentMethod) => ({
      paymentMethodId: paymentMethod.id,
      methodType: paymentMethod.methodType,
      brandSummary: paymentMethod.brandSummary,
      last4: paymentMethod.last4,
      expiryMonth: paymentMethod.expiryMonth,
      expiryYear: paymentMethod.expiryYear,
      isDefault: paymentMethod.isDefault,
    }));
}
