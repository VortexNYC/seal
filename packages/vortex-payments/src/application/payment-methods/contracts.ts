import type {
  CustomerProfileId,
  Environment,
  MerchantAccountId,
  PaymentMethodId,
} from "../../domain/common";
import type { PaymentMethod, PaymentMethodStatus } from "../../domain/payment-methods";
import type { CustomerPaymentState } from "../../domain/state";

export interface ListCustomerPaymentMethodsQuery {
  readonly environment: Environment;
  readonly merchantAccountId: MerchantAccountId;
  readonly customerProfileId: CustomerProfileId;
}

export interface GetCustomerPaymentMethodQuery extends ListCustomerPaymentMethodsQuery {
  readonly paymentMethodId: PaymentMethodId;
}

export interface SetDefaultCustomerPaymentMethodCommand {
  readonly environment: Environment;
  readonly merchantAccountId: MerchantAccountId;
  readonly customerProfileId: CustomerProfileId;
  readonly paymentMethodId: PaymentMethodId;
}

export interface ArchivePaymentMethodCommand {
  readonly environment: Environment;
  readonly merchantAccountId: MerchantAccountId;
  readonly customerProfileId: CustomerProfileId;
  readonly paymentMethodId: PaymentMethodId;
  readonly reason?: string;
}

export interface DisablePaymentMethodCommand {
  readonly environment: Environment;
  readonly merchantAccountId: MerchantAccountId;
  readonly customerProfileId: CustomerProfileId;
  readonly paymentMethodId: PaymentMethodId;
  readonly reason?: string;
}

export interface PaymentMethodSnapshot {
  readonly id: PaymentMethodId;
  readonly ownerType: PaymentMethod["ownerType"];
  readonly ownerId: string;
  readonly methodType: string;
  readonly status: PaymentMethodStatus;
  readonly isDefault: boolean;
  readonly brandSummary?: string;
  readonly last4?: string;
  readonly expiryMonth?: number;
  readonly expiryYear?: number;
}

export interface CustomerPaymentStateSnapshot extends CustomerPaymentState {
  readonly readinessReasons: readonly string[];
  readonly paymentMethods: readonly PaymentMethodSnapshot[];
  readonly defaultPaymentMethod?: PaymentMethodSnapshot;
  readonly requiresActionPaymentIntentCount: number;
}

export function getCustomerPaymentReadinessReasons(
  state: CustomerPaymentState,
  paymentMethods: readonly PaymentMethod[],
): readonly string[] {
  const reasons: string[] = [];

  if (state.requiresActionPaymentIntentIds.length > 0) {
    reasons.push("payment_intent_requires_action");
  }

  if (state.readiness === "blocked") {
    const disabledMethods = paymentMethods.filter(
      (paymentMethod) => paymentMethod.status === "disabled",
    );
    const archivedMethods = paymentMethods.filter(
      (paymentMethod) => paymentMethod.status === "archived",
    );
    if (disabledMethods.length > 0) {
      reasons.push("payment_methods_disabled");
    }
    if (archivedMethods.length > 0) {
      reasons.push("payment_methods_archived");
    }
    if (reasons.length === 0) {
      reasons.push("payment_methods_unusable");
    }
  }

  if (state.readiness === "unknown") {
    reasons.push("payment_methods_missing");
  }

  return reasons;
}
