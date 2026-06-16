import type {
  Environment,
  MerchantAccountId,
  PaymentMethodId,
  PaymentMethodSetupSessionId,
} from "../../domain/common";
import type {
  PaymentMethod,
  PaymentMethodSetupSession,
  PaymentMethodSetupSessionStatus,
} from "../../domain/payment-methods";

export interface CreatePaymentMethodSetupSessionCommand {
  readonly environment: Environment;
  readonly merchantAccountId: MerchantAccountId;
  readonly ownerType: PaymentMethod["ownerType"];
  readonly ownerId: string;
  readonly methodType: string;
  readonly setAsDefault?: boolean;
}

export interface CreatePaymentMethodFromSetupCommand {
  readonly environment: Environment;
  readonly paymentMethodSetupSessionId: PaymentMethodSetupSessionId;
  readonly setupToken: string;
  readonly idempotencyKey?: string;
}

export interface PaymentMethodSetupSessionSnapshot {
  readonly id: PaymentMethodSetupSessionId;
  readonly environment: Environment;
  readonly merchantAccountId: MerchantAccountId;
  readonly ownerType: PaymentMethodSetupSession["ownerType"];
  readonly ownerId: string;
  readonly methodType: string;
  readonly status: PaymentMethodSetupSessionStatus;
  readonly clientSecret: string;
  readonly setAsDefault: boolean;
  readonly expiresAt: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreatedPaymentMethodSnapshot {
  readonly id: PaymentMethodId;
  readonly merchantAccountId?: MerchantAccountId;
  readonly ownerType: PaymentMethod["ownerType"];
  readonly ownerId: string;
  readonly methodType: string;
  readonly status: PaymentMethod["status"];
  readonly isDefault: boolean;
  readonly brandSummary?: string;
  readonly last4?: string;
  readonly expiryMonth?: number;
  readonly expiryYear?: number;
}
