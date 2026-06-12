import type {
  CurrencyCode,
  CustomerProfileId,
  Environment,
  IsoTimestamp,
  MerchantAccountId,
  Metadata,
  PaymentId,
  PaymentIntentId,
  PaymentMethodId,
  ProcessorRef,
  RefundId,
} from "./common";

export type CaptureMode = "automatic" | "manual";

export type PaymentIntentStatus =
  | "pending"
  | "requires_action"
  | "authorized"
  | "captured"
  | "failed"
  | "canceled";

export type PaymentIntentNextStep =
  | "none"
  | "complete_required_action"
  | "capture"
  | "cancel"
  | "retry";

export interface PaymentIntent {
  readonly id: PaymentIntentId;
  readonly environment: Environment;
  readonly merchantAccountId: MerchantAccountId;
  readonly customerProfileId?: CustomerProfileId;
  readonly externalPaymentRef?: string;
  readonly amount: number;
  readonly currency: CurrencyCode;
  readonly captureMode: CaptureMode;
  readonly status: PaymentIntentStatus;
  readonly returnUrl?: string;
  readonly fraudSessionId?: string;
  readonly metadata?: Metadata;
  readonly nextActionType?: string;
  readonly hostedActionUrl?: string;
  readonly confirmedAt?: IsoTimestamp;
  readonly canceledAt?: IsoTimestamp;
  readonly processorIntentRefs: readonly ProcessorRef[];
  readonly createdAt: IsoTimestamp;
  readonly updatedAt: IsoTimestamp;
}

export type PaymentStatus =
  | "pending"
  | "requires_action"
  | "authorized"
  | "captured"
  | "failed"
  | "canceled"
  | "refunded_partial"
  | "refunded_full";

export interface Payment {
  readonly id: PaymentId;
  readonly environment: Environment;
  readonly merchantAccountId: MerchantAccountId;
  readonly paymentIntentId?: PaymentIntentId;
  readonly customerProfileId?: CustomerProfileId;
  readonly paymentMethodId?: PaymentMethodId;
  readonly amount: number;
  readonly currency: CurrencyCode;
  readonly status: PaymentStatus;
  readonly direction: "debit";
  readonly failureCode?: string;
  readonly failureMessage?: string;
  readonly authorizedAt?: IsoTimestamp;
  readonly capturedAt?: IsoTimestamp;
  readonly settlementEligibleAt?: IsoTimestamp;
  readonly processorPaymentRefs: readonly ProcessorRef[];
  readonly terminalSessionId?: string;
  readonly terminalReaderId?: string;
  readonly cardPresentPaymentIntentId?: string;
  readonly createdAt: IsoTimestamp;
  readonly updatedAt: IsoTimestamp;
}

export type RefundStatus = "pending" | "succeeded" | "failed";

export interface Refund {
  readonly id: RefundId;
  readonly environment: Environment;
  readonly merchantAccountId: MerchantAccountId;
  readonly paymentId: PaymentId;
  readonly amount: number;
  readonly currency: CurrencyCode;
  readonly status: RefundStatus;
  readonly reason: string;
  readonly requestedByType: "system" | "operator" | "merchant";
  readonly requestedByRef: string;
  readonly settlementImpactAmount?: number;
  readonly failureCode?: string;
  readonly failureMessage?: string;
  readonly correctedAt?: IsoTimestamp;
  readonly correctionReason?: string;
  readonly correctionEvidenceSource?: string;
  readonly correctionEvidenceRef?: string;
  readonly processorRefundRefs: readonly ProcessorRef[];
  readonly terminalSessionId?: string;
  readonly terminalReaderId?: string;
  readonly createdAt: IsoTimestamp;
  readonly updatedAt: IsoTimestamp;
}
