import type {
  Address,
  Environment,
  IsoTimestamp,
  MerchantAccountId,
  MerchantCapabilityId,
  MerchantOnboardingSessionId,
  MerchantRequirementId,
  Metadata,
  PlatformTenantId,
  ProcessorRef,
} from "./common";

export type PlatformTenantStatus = "active" | "disabled";

export interface PlatformTenant {
  readonly id: PlatformTenantId;
  readonly environment: Environment;
  readonly name: string;
  readonly status: PlatformTenantStatus;
  readonly createdAt: IsoTimestamp;
  readonly updatedAt: IsoTimestamp;
}

export type MerchantMode = "processing" | "payout_only" | "hybrid";

export type MerchantAccountStatus =
  | "draft"
  | "pending_review"
  | "active"
  | "restricted"
  | "rejected"
  | "disabled";

export interface MerchantProfileDate {
  readonly day: number;
  readonly month: number;
  readonly year: number;
}

export interface MerchantSettlementBankAccount {
  readonly accountNumber: string;
  readonly accountType: string;
  readonly bankCode: string;
  readonly name: string;
  readonly attemptValidationCheck?: boolean;
}

export interface MerchantCardVolumeDistribution {
  readonly cardPresentPercentage?: number;
  readonly mailOrderTelephoneOrderPercentage?: number;
  readonly ecommercePercentage?: number;
}

export interface MerchantBusinessVolumeDistribution {
  readonly otherVolumePercentage?: number;
  readonly consumerToConsumerVolumePercentage?: number;
  readonly businessToConsumerVolumePercentage?: number;
  readonly businessToBusinessVolumePercentage?: number;
  readonly personToPersonVolumePercentage?: number;
}

export interface MerchantUnderwritingData {
  readonly annualAchVolume?: number;
  readonly averageAchTransferAmount?: number;
  readonly averageCardTransferAmount?: number;
  readonly businessDescription?: string;
  readonly cardVolumeDistribution?: MerchantCardVolumeDistribution;
  readonly creditCheckAllowed?: boolean;
  readonly creditCheckIpAddress?: string;
  readonly creditCheckTimestamp?: IsoTimestamp;
  readonly creditCheckUserAgent?: string;
  readonly refundPolicy?: string;
  readonly volumeDistributionByBusinessType?: MerchantBusinessVolumeDistribution;
}

export interface MerchantAssociatedIdentity {
  readonly identityRoles: readonly string[];
  readonly relationType?: "control_person" | "beneficial_owner" | "representative";
  readonly firstName?: string;
  readonly lastName?: string;
  readonly email?: string;
  readonly phone?: string;
  readonly title?: string;
  readonly taxId?: string;
  readonly dateOfBirth?: MerchantProfileDate;
  readonly personalAddress?: Address;
  readonly principalPercentageOwnership?: number;
}

export interface MerchantAccount {
  readonly id: MerchantAccountId;
  readonly environment: Environment;
  readonly tenantId: PlatformTenantId;
  readonly externalMerchantRef?: string;
  readonly displayName: string;
  readonly legalEntityType: string;
  readonly country: string;
  readonly merchantMode: MerchantMode;
  readonly defaultCurrency: string;
  readonly status: MerchantAccountStatus;
  readonly capabilityStatus: string;
  readonly businessAddress?: Address;
  readonly personalAddress?: Address;
  readonly doingBusinessAs?: string;
  readonly businessPhone?: string;
  readonly businessTaxId?: string;
  readonly phone?: string;
  readonly taxId?: string;
  readonly email?: string;
  readonly firstName?: string;
  readonly lastName?: string;
  readonly dateOfBirth?: MerchantProfileDate;
  readonly incorporationDate?: MerchantProfileDate;
  readonly maxTransactionAmount?: number;
  readonly achMaxTransactionAmount?: number;
  readonly annualCardVolume?: number;
  readonly mcc?: string;
  readonly url?: string;
  readonly principalPercentageOwnership?: number;
  readonly hasAcceptedCreditCardsPreviously?: boolean;
  readonly settlementBankAccount?: MerchantSettlementBankAccount;
  readonly associatedIdentities?: readonly MerchantAssociatedIdentity[];
  readonly underwriting?: MerchantUnderwritingData;
  readonly metadata?: Metadata;
  readonly processorAccountRefs: readonly ProcessorRef[];
  readonly createdAt: IsoTimestamp;
  readonly updatedAt: IsoTimestamp;
}

export type MerchantOnboardingSessionStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "action_required"
  | "approved"
  | "rejected"
  | "restricted";

export interface MerchantOnboardingSession {
  readonly id: MerchantOnboardingSessionId;
  readonly environment: Environment;
  readonly merchantAccountId: MerchantAccountId;
  readonly status: MerchantOnboardingSessionStatus;
  readonly submittedAt?: IsoTimestamp;
  readonly approvedAt?: IsoTimestamp;
  readonly rejectedAt?: IsoTimestamp;
  readonly externalOnboardingRef?: string;
  readonly currentRequirementCount: number;
  readonly openRequirementCount: number;
  readonly processorRefs: readonly ProcessorRef[];
  readonly metadata?: Metadata;
  readonly createdAt: IsoTimestamp;
  readonly updatedAt: IsoTimestamp;
}

export type MerchantRequirementStatus = "pending" | "submitted" | "satisfied" | "failed" | "waived";

export interface MerchantRequirement {
  readonly id: MerchantRequirementId;
  readonly environment: Environment;
  readonly onboardingSessionId: MerchantOnboardingSessionId;
  readonly merchantAccountId: MerchantAccountId;
  readonly requirementType: string;
  readonly status: MerchantRequirementStatus;
  readonly reasonCode?: string;
  readonly title: string;
  readonly description?: string;
  readonly sourceProvider: string;
  readonly providerRequirementRef?: string;
  readonly requestedAt?: IsoTimestamp;
  readonly satisfiedAt?: IsoTimestamp;
  readonly expiresAt?: IsoTimestamp;
  readonly metadata?: Metadata;
}

export interface MerchantRequirementDocument {
  readonly id: string;
  readonly environment: Environment;
  readonly onboardingSessionId: MerchantOnboardingSessionId;
  readonly merchantAccountId: MerchantAccountId;
  readonly requirementId: MerchantRequirementId;
  readonly sourceProvider: string;
  readonly documentId: string;
  readonly uploadLinkId: string;
  readonly fileName?: string;
  readonly contentType?: string;
  readonly requestedAt: IsoTimestamp;
  readonly uploadedByType: "operator" | "merchant";
  readonly uploadedByRef: string;
  readonly status?: string;
  readonly recordedAt?: IsoTimestamp;
  readonly metadata?: Metadata;
}

export type MerchantCapabilityStatus = "active" | "restricted" | "disabled";

export interface MerchantCapability {
  readonly id: MerchantCapabilityId;
  readonly environment: Environment;
  readonly merchantAccountId: MerchantAccountId;
  readonly capabilityKey: string;
  readonly status: MerchantCapabilityStatus;
  readonly restrictedReason?: string;
  readonly effectiveAt: IsoTimestamp;
  readonly expiresAt?: IsoTimestamp;
  readonly updatedByType: "system" | "operator" | "merchant";
  readonly updatedByRef?: string;
  readonly processorRefs: readonly ProcessorRef[];
}
