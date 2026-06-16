import type {
  CurrencyCode,
  CustomerProfileId,
  Environment,
  MerchantAccountId,
  Metadata,
  PaymentIntentId,
  PaymentMethodId,
} from "../../domain/common";
import type { CaptureMode, PaymentIntentNextStep, PaymentIntentStatus } from "../../domain/payments";

export interface CreatePaymentIntentCommand {
  readonly environment: Environment;
  readonly merchantAccountId: MerchantAccountId;
  readonly customerProfileId?: CustomerProfileId;
  readonly amount: number;
  readonly currency: CurrencyCode;
  readonly captureMode: CaptureMode;
  readonly paymentMethodId?: PaymentMethodId;
  readonly externalPaymentRef?: string;
  readonly returnUrl?: string;
  readonly fraudSessionId?: string;
  readonly metadata?: Metadata;
  readonly idempotencyKey?: string;
}

export interface PaymentIntentSnapshot {
  readonly id: PaymentIntentId;
  readonly paymentId?: string;
  readonly merchantAccountId: MerchantAccountId;
  readonly customerProfileId?: CustomerProfileId;
  readonly paymentMethodId?: PaymentMethodId;
  readonly status: PaymentIntentStatus;
  readonly amount: number;
  readonly currency: CurrencyCode;
  readonly requiresAction: boolean;
  readonly canCapture: boolean;
  readonly canCancel: boolean;
  readonly canRetry: boolean;
  readonly nextStep: PaymentIntentNextStep;
  readonly nextActionType?: string;
  readonly hostedActionUrl?: string;
}

export interface GetPaymentIntentQuery {
  readonly environment: Environment;
  readonly paymentIntentId: PaymentIntentId;
}

export interface ListPaymentIntentsQuery {
  readonly environment: Environment;
  readonly merchantAccountId: MerchantAccountId;
  readonly customerProfileId?: CustomerProfileId;
  readonly status?: PaymentIntentStatus;
  readonly externalPaymentRef?: string;
  readonly limit?: number;
}

export interface CapturePaymentIntentCommand {
  readonly environment: Environment;
  readonly merchantAccountId: MerchantAccountId;
  readonly paymentIntentId: PaymentIntentId;
}

export interface CancelPaymentIntentCommand {
  readonly environment: Environment;
  readonly merchantAccountId: MerchantAccountId;
  readonly paymentIntentId: PaymentIntentId;
}

export interface RetryPaymentIntentCommand {
  readonly environment: Environment;
  readonly merchantAccountId: MerchantAccountId;
  readonly paymentIntentId: PaymentIntentId;
  readonly paymentMethodId?: PaymentMethodId;
  readonly idempotencyKey?: string;
}
