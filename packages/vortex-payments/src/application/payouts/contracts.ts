import type {
  CurrencyCode,
  Environment,
  MerchantAccountId,
  Metadata,
  PayoutAccountId,
  PayoutId,
  SettlementId,
} from "../../domain/common";
import type {
  PayoutStatus,
  SellerPayoutCapability,
  SellerPayoutProfileSnapshot,
  SettlementFundingTimeline,
  SettlementPayoutReadiness,
  SettlementStatus,
} from "../../domain/funds";
import type { PayoutListResponse } from "../../api/contract/payouts";

export interface CreatePayoutCommand {
  readonly environment: Environment;
  readonly merchantAccountId: MerchantAccountId;
  readonly payoutAccountId?: PayoutAccountId;
  readonly settlementId?: SettlementId;
  readonly amount: number;
  readonly currency: CurrencyCode;
  readonly metadata?: Metadata;
  readonly requestedByType: "system" | "operator" | "merchant";
  readonly requestedByRef: string;
  readonly idempotencyKey?: string;
}

export interface PayoutSnapshot {
  readonly id: PayoutId;
  readonly environment: Environment;
  readonly merchantAccountId: MerchantAccountId;
  readonly payoutAccountId?: PayoutAccountId;
  readonly settlementId?: SettlementId;
  readonly status: PayoutStatus;
  readonly amount: number;
  readonly currency: CurrencyCode;
  readonly direction: "credit" | "debit";
  readonly expectedArrivalAt?: string;
  readonly failureCode?: string;
  readonly failureMessage?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface SettlementSnapshot {
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
  readonly accrualStartAt?: string;
  readonly accrualEndAt?: string;
  readonly autoCloseAt?: string;
  readonly openedAt?: string;
  readonly closedAt?: string;
  readonly approvedAt?: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface FundingTransferTimelineItemSnapshot {
  readonly id: string;
  readonly kind: "settlement" | "funding_transfer";
  readonly status: SettlementStatus | PayoutStatus;
  readonly amount: number;
  readonly currency: CurrencyCode;
  readonly direction: "credit" | "debit";
  readonly occurredAt: string;
  readonly expectedArrivalAt?: string;
}

export interface SettlementFundingTimelineSnapshot extends Omit<
  SettlementFundingTimeline,
  "items"
> {
  readonly items: readonly FundingTransferTimelineItemSnapshot[];
}

export interface MerchantSellerPayoutProfileSnapshot {
  readonly environment: Environment;
  readonly merchantAccountId: MerchantAccountId;
  readonly mode: SellerPayoutProfileSnapshot["mode"];
  readonly payoutRail: SellerPayoutProfileSnapshot["payoutRail"];
  readonly payoutSchedule: SellerPayoutProfileSnapshot["payoutSchedule"];
  readonly currency?: CurrencyCode;
  readonly settlementDelayDays?: number;
  readonly submissionDelayDays?: number;
  readonly fundingRequirement?: string;
  readonly sameDayAchEligible?: boolean;
  readonly instantPayoutEligible?: boolean;
  readonly grossPayoutEnabled?: boolean;
  readonly capabilities: readonly SellerPayoutCapability[];
  readonly fetchedAt: string;
}

export interface ListMerchantPayoutsQuery {
  readonly environment: Environment;
  readonly merchantAccountId: MerchantAccountId;
  readonly currency?: CurrencyCode;
}

export interface GetMerchantPayoutQuery {
  readonly environment: Environment;
  readonly merchantAccountId: MerchantAccountId;
  readonly payoutId: PayoutId;
}

export interface GetMerchantSellerPayoutProfileQuery {
  readonly environment: Environment;
  readonly merchantAccountId: MerchantAccountId;
}

export interface GetSettlementPayoutReadinessQuery {
  readonly environment: Environment;
  readonly merchantAccountId: MerchantAccountId;
  readonly settlementId: SettlementId;
}

export interface GetSettlementFundingTimelineQuery {
  readonly environment: Environment;
  readonly merchantAccountId: MerchantAccountId;
  readonly settlementId: SettlementId;
}

export type MerchantPayoutList = PayoutListResponse<PayoutSnapshot>;
export type MerchantPayoutDetail = PayoutSnapshot | null;
export type MerchantSellerPayoutProfileDetail = MerchantSellerPayoutProfileSnapshot | null;
export type SettlementPayoutReadinessDetail = SettlementPayoutReadiness | null;
export type SettlementFundingTimelineDetail = SettlementFundingTimelineSnapshot | null;
