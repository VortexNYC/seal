import type {
  CustomerProfileId,
  Environment,
  MerchantAccountId,
  PaymentId,
  PaymentIntentId,
  PaymentMethodId,
} from "../../domain/common";
import type {
  CaptureMode,
  PaymentIntentNextStep,
  PaymentIntentStatus,
} from "../../domain/payments";
import type { MetadataCarrier } from "./common";

export interface CreatePaymentIntentRequest extends MetadataCarrier {
  readonly environment: Environment;
  readonly merchantAccountId: MerchantAccountId;
  readonly customerProfileId?: CustomerProfileId;
  readonly paymentMethodId?: PaymentMethodId;
  readonly externalPaymentRef?: string;
  readonly amount: number;
  readonly currency: "USD" | "CAD";
  readonly captureMode: CaptureMode;
  readonly returnUrl?: string;
  readonly fraudSessionId?: string;
  readonly idempotencyKey?: string;
}

export interface RetryPaymentIntentRequest {
  readonly environment: Environment;
  readonly merchantAccountId: MerchantAccountId;
  readonly paymentMethodId?: PaymentMethodId;
  readonly idempotencyKey?: string;
}

export interface ApiPaymentIntentSnapshot {
  readonly id: PaymentIntentId;
  readonly paymentId?: PaymentId;
  readonly merchantAccountId: MerchantAccountId;
  readonly customerProfileId?: CustomerProfileId;
  readonly paymentMethodId?: PaymentMethodId;
  readonly status: PaymentIntentStatus;
  readonly amount: number;
  readonly currency: "USD" | "CAD";
  readonly requiresAction: boolean;
  readonly canCapture: boolean;
  readonly canCancel: boolean;
  readonly canRetry: boolean;
  readonly nextStep: PaymentIntentNextStep;
  readonly nextActionType?: string;
  readonly hostedActionUrl?: string;
}
