import type { Environment, MerchantAccountId } from "../../domain/common";
import type { PaymentMethod, PayoutAccount } from "../../domain/payment-methods";
import type { CustomerPaymentReadiness } from "../../domain/state";
import type { CursorPage } from "./common";

export type ApiPaymentMethodSetupSessionStatus =
  | "pending_tokenization"
  | "tokenized"
  | "consuming"
  | "consumed"
  | "expired"
  | "canceled"
  | "failed";

export interface CreatePaymentMethodSetupSessionRequest {
  readonly environment: Environment;
  readonly merchantAccountId: MerchantAccountId;
  readonly ownerType: PaymentMethod["ownerType"];
  readonly ownerId: string;
  readonly methodType: string;
  readonly setAsDefault?: boolean;
}

export interface ApiPaymentMethodSetupSession {
  readonly id: string;
  readonly environment: Environment;
  readonly merchantAccountId: MerchantAccountId;
  readonly ownerType: PaymentMethod["ownerType"];
  readonly ownerId: string;
  readonly methodType: string;
  readonly status: ApiPaymentMethodSetupSessionStatus;
  readonly clientSecret: string;
  readonly setAsDefault: boolean;
  readonly expiresAt: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreatePaymentMethodRequest {
  readonly paymentMethodSetupSessionId: string;
  readonly setupToken: string;
  readonly idempotencyKey?: string;
}

export interface UpdatePaymentMethodRequest {
  readonly setAsDefault?: boolean;
}

export interface ApiPaymentMethodSummary {
  readonly id: string;
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

export interface ApiCustomerPaymentState {
  readonly customerProfileId: string;
  readonly merchantAccountId: MerchantAccountId;
  readonly environment: Environment;
  readonly defaultPaymentMethodId?: string;
  readonly defaultPaymentMethod?: ApiPaymentMethodSummary;
  readonly paymentMethods: readonly ApiPaymentMethodSummary[];
  readonly activePaymentMethodIds: readonly string[];
  readonly requiresActionPaymentIntentIds: readonly string[];
  readonly requiresActionPaymentIntentCount: number;
  readonly latestPaymentIntentStatus?: string;
  readonly readiness: CustomerPaymentReadiness;
  readonly readinessReasons: readonly string[];
  readonly generatedAt: string;
}

export interface PaymentMethodListResponse extends CursorPage<ApiPaymentMethodSummary> {}

export interface CreatePayoutAccountRequest {
  readonly merchantAccountId: MerchantAccountId;
  readonly methodType: string;
  readonly setupToken?: string;
  readonly setAsDefault?: boolean;
}

export interface UpdatePayoutAccountRequest {
  readonly setAsDefault?: boolean;
}

export interface PayoutAccountListResponse extends CursorPage<PayoutAccount> {}
