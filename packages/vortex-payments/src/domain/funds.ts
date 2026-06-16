import type {
  CurrencyCode,
  Environment,
  IsoTimestamp,
  MerchantAccountId,
  PayoutAccountId,
  PayoutId,
  ProcessorRef,
  SettlementId,
} from "./common";

export type SettlementStatus =
  | "accruing"
  | "closed"
  | "approved"
  | "paid_out"
  | "failed"
  | "reversed";

export interface Settlement {
  readonly id: SettlementId;
  readonly environment: Environment;
  readonly merchantAccountId: MerchantAccountId;
  readonly currency: CurrencyCode;
  readonly status: SettlementStatus;
  readonly grossAmount: number;
  readonly feeAmount: number;
  readonly refundAmount: number;
  readonly adjustmentAmount: number;
  readonly netAmount: number;
  readonly direction: "credit" | "debit";
  readonly accrualStartAt?: IsoTimestamp;
  readonly accrualEndAt?: IsoTimestamp;
  readonly autoCloseAt?: IsoTimestamp;
  readonly openedAt?: IsoTimestamp;
  readonly closedAt?: IsoTimestamp;
  readonly approvedAt?: IsoTimestamp;
  readonly processorRefs: readonly ProcessorRef[];
  readonly createdAt: IsoTimestamp;
  readonly updatedAt: IsoTimestamp;
}

export type PayoutStatus =
  | "pending"
  | "submitted"
  | "in_transit"
  | "succeeded"
  | "failed"
  | "returned"
  | "held";

export interface Payout {
  readonly id: PayoutId;
  readonly environment: Environment;
  readonly merchantAccountId: MerchantAccountId;
  readonly payoutAccountId?: PayoutAccountId;
  readonly settlementId?: SettlementId;
  readonly amount: number;
  readonly currency: CurrencyCode;
  readonly direction: "credit" | "debit";
  readonly status: PayoutStatus;
  readonly expectedArrivalAt?: IsoTimestamp;
  readonly failureCode?: string;
  readonly failureMessage?: string;
  readonly processorRefs: readonly ProcessorRef[];
  readonly createdAt: IsoTimestamp;
  readonly updatedAt: IsoTimestamp;
}

export type SellerPayoutRail = "next_day_ach" | "same_day_ach" | "instant_card" | "unknown";
export type SellerPayoutSchedule = "daily" | "monthly" | "manual" | "unknown";
export type SellerPayoutMode = "net" | "gross" | "unknown";
export type SellerPayoutCapabilityKey =
  | "standard_next_day_ach"
  | "same_day_ach"
  | "instant_card_push"
  | "gross_payout"
  | "sub_merchant_payee_payment";
export type SellerPayoutCapabilityStatus = "enabled" | "disabled" | "unknown";

export interface SellerPayoutCapability {
  readonly key: SellerPayoutCapabilityKey;
  readonly status: SellerPayoutCapabilityStatus;
  readonly reason: string;
  readonly source: "payout_profile" | "agreement_guardrail" | "operator_policy";
}

export interface SellerPayoutProfileSnapshot {
  readonly environment: Environment;
  readonly merchantAccountId: MerchantAccountId;
  readonly provider: string;
  readonly profileRef?: ProcessorRef;
  readonly merchantRef?: ProcessorRef;
  readonly mode: SellerPayoutMode;
  readonly payoutRail: SellerPayoutRail;
  readonly payoutSchedule: SellerPayoutSchedule;
  readonly currency?: CurrencyCode;
  readonly settlementDelayDays?: number;
  readonly submissionDelayDays?: number;
  readonly fundingRequirement?: string;
  readonly paymentInstrumentRef?: ProcessorRef;
  readonly sameDayAchEligible?: boolean;
  readonly instantPayoutEligible?: boolean;
  readonly grossPayoutEnabled?: boolean;
  readonly processorRawSchedule?: string;
  readonly processorRawRail?: string;
  readonly processorRawType?: string;
  readonly capabilities: readonly SellerPayoutCapability[];
  readonly fetchedAt: IsoTimestamp;
}

export type SettlementPayoutReadinessStatus = "ready" | "waiting" | "blocked" | "paid" | "unknown";

export interface SettlementPayoutReadiness {
  readonly environment: Environment;
  readonly merchantAccountId: MerchantAccountId;
  readonly settlementId: SettlementId;
  readonly status: SettlementPayoutReadinessStatus;
  readonly blockers: readonly string[];
  readonly nextAction: string;
  readonly settlementStatus: SettlementStatus;
  readonly merchantPayoutReadiness?: string;
  readonly payoutIds: readonly PayoutId[];
  readonly generatedAt: IsoTimestamp;
}

export interface FundingTransferTimelineItem {
  readonly id: string;
  readonly kind: "settlement" | "funding_transfer";
  readonly status: SettlementStatus | PayoutStatus;
  readonly amount: number;
  readonly currency: CurrencyCode;
  readonly direction: "credit" | "debit";
  readonly occurredAt: IsoTimestamp;
  readonly expectedArrivalAt?: IsoTimestamp;
  readonly processorRefs: readonly ProcessorRef[];
}

export interface SettlementFundingTimeline {
  readonly environment: Environment;
  readonly merchantAccountId: MerchantAccountId;
  readonly settlementId: SettlementId;
  readonly items: readonly FundingTransferTimelineItem[];
  readonly generatedAt: IsoTimestamp;
}

export type SettlementLineageSourceKind =
  | "payment"
  | "refund"
  | "fee"
  | "adjustment"
  | "unknown_transfer"
  | "unknown_entry";

export type SettlementLineageEvidenceSource =
  | "provider_settlement_transfer"
  | "provider_settlement_entry";

export interface SettlementLineageEntry {
  readonly id: string;
  readonly environment: Environment;
  readonly merchantAccountId: MerchantAccountId;
  readonly settlementId: SettlementId;
  readonly sourceKind: SettlementLineageSourceKind;
  readonly paymentId?: string;
  readonly refundId?: string;
  readonly settlementRef: ProcessorRef;
  readonly providerRowRef: ProcessorRef;
  readonly linkedToProcessorRef?: ProcessorRef;
  readonly amount: number;
  readonly currency?: CurrencyCode;
  readonly rawState?: string;
  readonly evidenceSource: SettlementLineageEvidenceSource;
  readonly occurredAt: IsoTimestamp;
  readonly createdAt: IsoTimestamp;
  readonly updatedAt: IsoTimestamp;
}
