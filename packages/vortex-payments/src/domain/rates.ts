import type {
  Environment,
  IsoTimestamp,
  MerchantAccountId,
  Metadata,
  PlatformTenantId,
  ProcessorRef,
} from "./common";

export type PaymentRatePlanId = string;
export type MerchantRateAssignmentId = string;

export type PaymentRatePlanStatus = "draft" | "active" | "archived";
export type PaymentRatePricingStrategy =
  | "blended"
  | "interchange_plus"
  | "interchange_plus_dues_assessments";
export type MerchantRateAssignmentStatus =
  | "pending_provider_sync"
  | "active"
  | "failed"
  | "archived";

export interface PaymentRateAmounts {
  readonly achBasisPoints?: number;
  readonly achBasisPointsFeeLimit?: number | null;
  readonly achCreditReturnFixedFee?: number | null;
  readonly achDebitReturnFixedFee?: number | null;
  readonly achFixedFee?: number;
  readonly cardBasisPoints?: number;
  readonly cardCrossBorderBasisPoints?: number | null;
  readonly cardFixedFee?: number;
  readonly disputeFixedFee?: number | null;
}

export interface PaymentRatePlan {
  readonly id: PaymentRatePlanId;
  readonly environment: Environment;
  readonly tenantId: PlatformTenantId;
  readonly code: string;
  readonly version: number;
  readonly displayName: string;
  readonly status: PaymentRatePlanStatus;
  readonly pricingStrategy: PaymentRatePricingStrategy;
  readonly rates: PaymentRateAmounts;
  readonly provider: "finix";
  readonly providerFeeProfileRef?: ProcessorRef;
  readonly providerSyncStatus: "not_synced" | "synced" | "failed";
  readonly providerSyncError?: string;
  readonly effectiveAt?: IsoTimestamp;
  readonly archivedAt?: IsoTimestamp;
  readonly metadata?: Metadata;
  readonly createdAt: IsoTimestamp;
  readonly updatedAt: IsoTimestamp;
}

export interface MerchantRateAssignment {
  readonly id: MerchantRateAssignmentId;
  readonly environment: Environment;
  readonly tenantId: PlatformTenantId;
  readonly merchantAccountId: MerchantAccountId;
  readonly ratePlanId: PaymentRatePlanId;
  readonly status: MerchantRateAssignmentStatus;
  readonly provider: "finix";
  readonly providerMerchantRef: ProcessorRef;
  readonly providerMerchantProfileRef?: ProcessorRef;
  readonly providerFeeProfileRef?: ProcessorRef;
  readonly providerVerifiedTransferRef?: ProcessorRef;
  readonly providerLinkedFeeCount?: number;
  readonly assignedAt?: IsoTimestamp;
  readonly verifiedAt?: IsoTimestamp;
  readonly failureReason?: string;
  readonly supersededAt?: IsoTimestamp;
  readonly createdAt: IsoTimestamp;
  readonly updatedAt: IsoTimestamp;
}
