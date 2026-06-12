export type Environment = "sandbox" | "production";

export type IsoTimestamp = string;

export type CurrencyCode = "USD" | "CAD";

export type Metadata = Record<string, string>;

export type MerchantAccountId = string;
export type PlatformTenantId = string;
export type MerchantOnboardingSessionId = string;
export type MerchantRequirementId = string;
export type MerchantCapabilityId = string;
export type CustomerProfileId = string;
export type PaymentMethodId = string;
export type PaymentMethodSetupSessionId = string;
export type PayoutAccountId = string;
export type PaymentIntentId = string;
export type PaymentId = string;
export type RefundId = string;
export type SettlementId = string;
export type PayoutId = string;
export type DisputeId = string;
export type TerminalSessionId = string;
export type TerminalLocationId = string;
export type TerminalReaderId = string;
export type TerminalConnectionSessionId = string;
export type CardPresentPaymentIntentId = string;
export type PaymentHardwareSkuId = string;
export type PaymentHardwareOrderId = string;
export type PaymentHardwareReturnId = string;
export type CaseId = string;
export type AuditEventId = string;
export type CanonicalDomainEventId = string;
export type ProcessorEventId = string;
export type RawProcessorWebhookId = string;
export type IdempotencyRecordId = string;
export type MerchantAccountStateId = string;

export interface Address {
  readonly line1: string;
  readonly line2?: string;
  readonly city: string;
  readonly region?: string;
  readonly postalCode: string;
  readonly country: string;
}

export interface Money {
  readonly amount: number;
  readonly currency: CurrencyCode;
}

export interface ProcessorRef {
  readonly provider: string;
  readonly objectType: string;
  readonly objectId: string;
  readonly relationship: string;
  readonly recordedAt: IsoTimestamp;
}
