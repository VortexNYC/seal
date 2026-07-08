import type {
  CurrencyCode,
  Environment,
  IsoTimestamp,
  Metadata,
  ProcessorRef,
} from "../domain/common";
import type {
  MerchantAccountStatus,
  MerchantOnboardingSessionStatus,
  MerchantRequirement,
} from "../domain/merchant";
import type { MerchantAccountState } from "../domain/state";
import type {
  SellerPayoutCapability,
  SellerPayoutMode,
  SellerPayoutRail,
  SellerPayoutSchedule,
} from "../domain/funds";

export type ProviderKey = "finix" | "payrix";

export type ProcessorCapability =
  | "merchant_onboarding"
  | "payment_methods"
  | "payments"
  | "refunds"
  | "settlements"
  | "payouts"
  | "disputes"
  | "terminals"
  | "webhooks";

export interface ProviderContext {
  readonly provider: ProviderKey;
  readonly environment: Environment;
  readonly tenantId?: string;
}

export interface ProviderError {
  readonly provider: ProviderKey;
  readonly category:
    | "invalid_request"
    | "authentication_failed"
    | "action_required"
    | "rate_limited"
    | "temporarily_unavailable"
    | "not_supported"
    | "unknown";
  readonly code: string;
  readonly message: string;
  readonly retryable: boolean;
  readonly rawRef?: string;
}

export interface ProviderResult<T> {
  readonly ok: boolean;
  readonly value?: T;
  readonly error?: ProviderError;
}

export interface ProviderWebhookVerificationResult {
  readonly valid: boolean;
  readonly reason?: string;
  readonly providerWebhookId?: string;
  readonly deliveryKey: string;
  readonly receivedAt: IsoTimestamp;
}

export interface ProviderObjectSnapshot {
  readonly provider: ProviderKey;
  readonly objectType: string;
  readonly objectId: string;
  readonly status?: string;
  readonly metadata?: Metadata;
  readonly recordedAt: IsoTimestamp;
}

export interface ProviderMerchantProfileDate {
  readonly day: number;
  readonly month: number;
  readonly year: number;
}

export interface ProviderMerchantSettlementBankAccount {
  readonly accountNumber: string;
  readonly accountType: string;
  readonly bankCode: string;
  readonly name: string;
  readonly attemptValidationCheck?: boolean;
}

export interface ProviderMerchantCardVolumeDistribution {
  readonly cardPresentPercentage?: number;
  readonly mailOrderTelephoneOrderPercentage?: number;
  readonly ecommercePercentage?: number;
}

export interface ProviderMerchantBusinessVolumeDistribution {
  readonly otherVolumePercentage?: number;
  readonly consumerToConsumerVolumePercentage?: number;
  readonly businessToConsumerVolumePercentage?: number;
  readonly businessToBusinessVolumePercentage?: number;
  readonly personToPersonVolumePercentage?: number;
}

export interface ProviderMerchantUnderwritingData {
  readonly annualAchVolume?: number;
  readonly averageAchTransferAmount?: number;
  readonly averageCardTransferAmount?: number;
  readonly businessDescription?: string;
  readonly cardVolumeDistribution?: ProviderMerchantCardVolumeDistribution;
  readonly creditCheckAllowed?: boolean;
  readonly creditCheckIpAddress?: string;
  readonly creditCheckTimestamp?: IsoTimestamp;
  readonly creditCheckUserAgent?: string;
  readonly refundPolicy?: string;
  readonly volumeDistributionByBusinessType?: ProviderMerchantBusinessVolumeDistribution;
}

export interface ProviderMerchantAssociatedIdentity {
  readonly identityRoles: readonly string[];
  readonly relationType?: "control_person" | "beneficial_owner" | "representative";
  readonly firstName?: string;
  readonly lastName?: string;
  readonly email?: string;
  readonly phone?: string;
  readonly title?: string;
  readonly taxId?: string;
  readonly dateOfBirth?: ProviderMerchantProfileDate;
  readonly personalAddress?: {
    readonly line1?: string;
    readonly line2?: string;
    readonly city?: string;
    readonly region?: string;
    readonly postalCode?: string;
    readonly country?: string;
  };
  readonly principalPercentageOwnership?: number;
}

export interface ProviderMerchantOnboardingInput {
  readonly merchantAccountId: string;
  readonly externalMerchantRef?: string;
  readonly displayName: string;
  readonly legalEntityType: string;
  readonly country: string;
  readonly merchantMode: string;
  readonly businessAddress?: {
    readonly line1?: string;
    readonly line2?: string;
    readonly city?: string;
    readonly region?: string;
    readonly postalCode?: string;
    readonly country?: string;
  };
  readonly personalAddress?: {
    readonly line1?: string;
    readonly line2?: string;
    readonly city?: string;
    readonly region?: string;
    readonly postalCode?: string;
    readonly country?: string;
  };
  readonly doingBusinessAs?: string;
  readonly businessPhone?: string;
  readonly businessTaxId?: string;
  readonly phone?: string;
  readonly taxId?: string;
  readonly email?: string;
  readonly firstName?: string;
  readonly lastName?: string;
  readonly dateOfBirth?: ProviderMerchantProfileDate;
  readonly incorporationDate?: ProviderMerchantProfileDate;
  readonly maxTransactionAmount?: number;
  readonly achMaxTransactionAmount?: number;
  readonly annualCardVolume?: number;
  readonly mcc?: string;
  readonly url?: string;
  readonly principalPercentageOwnership?: number;
  readonly hasAcceptedCreditCardsPreviously?: boolean;
  readonly settlementBankAccount?: ProviderMerchantSettlementBankAccount;
  readonly associatedIdentities?: readonly ProviderMerchantAssociatedIdentity[];
  readonly underwriting?: ProviderMerchantUnderwritingData;
  readonly merchantAgreementAccepted?: true;
  readonly merchantAgreementAcceptedAt?: IsoTimestamp;
  readonly merchantAgreementIpAddress?: string;
  readonly merchantAgreementUserAgent?: string;
}

export interface ProviderMerchantOnboardingOutput {
  readonly onboardingRef: ProcessorRef;
  readonly accountRef?: ProcessorRef;
  readonly status: string;
  readonly requirementRefs: readonly string[];
}

export interface ProviderMerchantOnboardingRefreshInput {
  readonly merchantAccountId: string;
  readonly onboardingSessionId: string;
  readonly merchantRef?: ProcessorRef;
}

export interface ProviderMerchantOnboardingRefreshOutput {
  readonly merchantStatus: MerchantAccountStatus;
  readonly onboardingStatus: MerchantOnboardingSessionStatus;
  readonly requirements: readonly MerchantRequirement[];
  readonly processorRefs: readonly ProcessorRef[];
  readonly metadata?: Metadata;
}

export interface ProviderOnboardingRequirementUploadLinkInput {
  readonly merchantAccountId: string;
  readonly onboardingSessionId: string;
  readonly requirementId: string;
  readonly providerRequirementRef?: string;
  readonly fileName: string;
  readonly contentType: string;
  readonly uploadedByType: "operator" | "merchant";
  readonly uploadedByRef: string;
}

export interface ProviderOnboardingRequirementUploadLinkOutput {
  readonly documentId: string;
  readonly uploadLinkId: string;
  readonly uploadUrl: string;
  readonly expiresAt?: IsoTimestamp;
}

export interface ProviderPaymentMethodInput {
  readonly merchantAccountId: string;
  readonly ownerType: "customer" | "merchant";
  readonly ownerId: string;
  readonly ownerRef?: ProcessorRef;
  readonly methodType: string;
  readonly setupToken: string;
}

export interface ProviderPaymentMethodOutput {
  readonly paymentMethodRef: ProcessorRef;
  readonly ownerRef?: ProcessorRef;
  readonly status: string;
  readonly methodType: string;
  readonly brandSummary?: string;
  readonly last4?: string;
  readonly expiryMonth?: number;
  readonly expiryYear?: number;
  readonly fingerprint?: string;
  readonly recordedAt: IsoTimestamp;
}

export interface ProviderPaymentIntentInput {
  readonly merchantAccountId: string;
  readonly merchantRef?: ProcessorRef;
  readonly paymentMethodRef?: ProcessorRef;
  readonly terminalReaderRef?: ProcessorRef;
  readonly amount: number;
  readonly currency: string;
  readonly captureMode: string;
  readonly returnUrl?: string;
  readonly fraudSessionId?: string;
  readonly idempotencyKey?: string;
}

export interface ProviderPaymentIntentOutput {
  readonly intentRef: ProcessorRef;
  readonly status: string;
  readonly nextActionType?: string;
  readonly clientTokenRef?: string;
}

export interface ProviderCapturePaymentIntentInput {
  readonly merchantAccountId: string;
  readonly intentRef: ProcessorRef;
  readonly amount?: number;
}

export interface ProviderCapturePaymentIntentOutput {
  readonly intentRef: ProcessorRef;
  readonly paymentRef?: ProcessorRef;
  readonly status: string;
  readonly recordedAt: IsoTimestamp;
}

export interface ProviderCancelPaymentIntentInput {
  readonly merchantAccountId: string;
  readonly intentRef: ProcessorRef;
}

export interface ProviderCancelPaymentIntentOutput {
  readonly intentRef: ProcessorRef;
  readonly status: string;
  readonly recordedAt: IsoTimestamp;
}

export interface ProviderRefundInput {
  readonly paymentRef: ProcessorRef;
  readonly amount: number;
  readonly reason: string;
  readonly idempotencyKey?: string;
}

export interface ProviderRefundOutput {
  readonly refundRef: ProcessorRef;
  readonly status: string;
}

export interface ProviderMerchantOperationalStateInput {
  readonly merchantAccountId: string;
  readonly merchantRef: ProcessorRef;
  readonly onboardingSessionId?: string;
}

export interface ProviderMerchantOperationalStateOutput {
  readonly merchantState: MerchantAccountState;
  readonly capabilityStatus: string;
  readonly providerSummary: Readonly<Record<string, string | number | boolean | null>>;
}

export interface ProviderSellerPayoutProfileInput {
  readonly merchantAccountId: string;
  readonly merchantRef: ProcessorRef;
}

export interface ProviderSellerPayoutProfileOutput {
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
  readonly capabilities?: readonly SellerPayoutCapability[];
  readonly fetchedAt: IsoTimestamp;
}

export interface ProviderPaymentIntentInspectionInput {
  readonly merchantAccountId: string;
  readonly intentRef: ProcessorRef;
}

export interface ProviderPaymentIntentInspectionOutput {
  readonly status: "pending" | "authorized" | "captured" | "failed" | "canceled";
  readonly recordedAt: IsoTimestamp;
}

export interface ProviderDisputeSummary {
  readonly disputeRef: ProcessorRef;
  readonly merchantRef?: ProcessorRef;
  readonly paymentRef?: ProcessorRef;
  readonly amount?: number;
  readonly currency?: string;
  readonly state?: string;
  readonly reason?: string | null;
  readonly type?: string;
  readonly tags?: Metadata;
  readonly openedAt: IsoTimestamp;
  readonly updatedAt: IsoTimestamp;
}

export interface ProviderDisputeEvidenceSummary {
  readonly evidenceRef: ProcessorRef;
  readonly disputeRef?: ProcessorRef;
  readonly fileRef?: ProcessorRef;
  readonly state?: string;
  readonly type?: string;
  readonly tags?: Metadata;
  readonly createdAt: IsoTimestamp;
  readonly updatedAt: IsoTimestamp;
}

export interface ProviderDisputeAdjustmentSummary {
  readonly adjustmentRef: ProcessorRef;
  readonly disputeRef?: ProcessorRef;
  readonly paymentRef?: ProcessorRef;
  readonly amount?: number;
  readonly currency?: string;
  readonly type?: string;
  readonly createdAt?: IsoTimestamp;
  readonly updatedAt?: IsoTimestamp;
}

export interface ProviderListResult<TItem> {
  readonly items: readonly TItem[];
  readonly page?: {
    readonly limit?: number;
    readonly offset?: number;
    readonly count?: number;
  };
}

export type ProviderSettlementLineageSourceKind =
  | "payment"
  | "refund"
  | "fee"
  | "adjustment"
  | "unknown_transfer"
  | "unknown_entry";

export interface ProviderSettlementLineageRow {
  readonly rowRef: ProcessorRef;
  readonly sourceKind: ProviderSettlementLineageSourceKind;
  readonly linkedToProcessorRef?: ProcessorRef;
  readonly amount: number;
  readonly currency?: string;
  readonly rawState?: string;
  readonly occurredAt: IsoTimestamp;
  readonly evidenceSource: "provider_settlement_transfer" | "provider_settlement_entry";
}

export interface PaymentsProviderAdapter {
  readonly key: ProviderKey;
  readonly supportedCapabilities: readonly ProcessorCapability[];
  verifyWebhookSignature(
    context: ProviderContext,
    headers: Readonly<Record<string, string>>,
    rawBody: string,
  ): Promise<ProviderWebhookVerificationResult>;
  createMerchantOnboarding(
    context: ProviderContext,
    input: ProviderMerchantOnboardingInput,
  ): Promise<ProviderResult<ProviderMerchantOnboardingOutput>>;
  createPaymentMethod?(
    context: ProviderContext,
    input: ProviderPaymentMethodInput,
  ): Promise<ProviderResult<ProviderPaymentMethodOutput>>;
  refreshMerchantOnboarding?(
    context: ProviderContext,
    input: ProviderMerchantOnboardingRefreshInput,
  ): Promise<ProviderResult<ProviderMerchantOnboardingRefreshOutput>>;
  createOnboardingRequirementUploadLink?(
    context: ProviderContext,
    input: ProviderOnboardingRequirementUploadLinkInput,
  ): Promise<ProviderResult<ProviderOnboardingRequirementUploadLinkOutput>>;
  createPaymentIntent(
    context: ProviderContext,
    input: ProviderPaymentIntentInput,
  ): Promise<ProviderResult<ProviderPaymentIntentOutput>>;
  capturePaymentIntent?(
    context: ProviderContext,
    input: ProviderCapturePaymentIntentInput,
  ): Promise<ProviderResult<ProviderCapturePaymentIntentOutput>>;
  cancelPaymentIntent?(
    context: ProviderContext,
    input: ProviderCancelPaymentIntentInput,
  ): Promise<ProviderResult<ProviderCancelPaymentIntentOutput>>;
  createRefund(
    context: ProviderContext,
    input: ProviderRefundInput,
  ): Promise<ProviderResult<ProviderRefundOutput>>;
  fetchObjectSnapshot(
    context: ProviderContext,
    ref: ProcessorRef,
  ): Promise<ProviderResult<ProviderObjectSnapshot>>;
  inspectMerchantOperationalState?(
    context: ProviderContext,
    input: ProviderMerchantOperationalStateInput,
  ): Promise<ProviderResult<ProviderMerchantOperationalStateOutput>>;
  getSellerPayoutProfile?(
    context: ProviderContext,
    input: ProviderSellerPayoutProfileInput,
  ): Promise<ProviderResult<ProviderSellerPayoutProfileOutput>>;
  listSettlementLineage?(
    context: ProviderContext,
    input: { readonly settlementRef: ProcessorRef },
  ): Promise<ProviderResult<ProviderListResult<ProviderSettlementLineageRow>>>;
  inspectPaymentIntent?(
    context: ProviderContext,
    input: ProviderPaymentIntentInspectionInput,
  ): Promise<ProviderResult<ProviderPaymentIntentInspectionOutput>>;
  acceptDispute?(
    context: ProviderContext,
    input: { readonly disputeRef: ProcessorRef; readonly tags?: Metadata },
  ): Promise<ProviderResult<ProviderDisputeSummary>>;
  createDisputeEvidence?(
    context: ProviderContext,
    input: {
      readonly disputeRef: ProcessorRef;
      readonly fileRef: ProcessorRef;
      readonly type?: string;
      readonly tags?: Metadata;
    },
  ): Promise<ProviderResult<ProviderDisputeEvidenceSummary>>;
  getDisputeEvidence?(
    context: ProviderContext,
    input: { readonly disputeRef: ProcessorRef; readonly evidenceRef: ProcessorRef },
  ): Promise<ProviderResult<ProviderDisputeEvidenceSummary>>;
  listDisputeEvidence?(
    context: ProviderContext,
    input: { readonly disputeRef: ProcessorRef },
  ): Promise<ProviderResult<ProviderListResult<ProviderDisputeEvidenceSummary>>>;
  submitDisputeEvidence?(
    context: ProviderContext,
    input: {
      readonly disputeRef: ProcessorRef;
      readonly note: string;
      readonly amount?: number;
      readonly refund?: string;
      readonly tags?: Metadata;
    },
  ): Promise<ProviderResult<ProviderDisputeEvidenceSummary>>;
  listDisputeAdjustments?(
    context: ProviderContext,
    input: { readonly disputeRef: ProcessorRef },
  ): Promise<ProviderResult<ProviderListResult<ProviderDisputeAdjustmentSummary>>>;
}
