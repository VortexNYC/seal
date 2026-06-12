import type {
  MerchantAccountId,
  MerchantOnboardingSessionId,
  MerchantRequirementId,
} from "../../domain/common";
import type { MerchantOnboardingSessionStatus } from "../../domain/merchant";

export interface SubmitOnboardingSessionRequest {
  readonly submittedByType: "operator" | "merchant" | "system";
  readonly submittedByRef: string;
  readonly merchantAgreementAccepted: true;
  readonly merchantAgreementAcceptedAt: string;
  readonly merchantAgreementIpAddress: string;
  readonly merchantAgreementUserAgent: string;
  readonly paymentTermsUrl?: string;
  readonly paymentPrivacyUrl?: string;
  readonly vortexTermsUrl?: string;
  readonly vortexPrivacyUrl?: string;
  readonly feeDisclosureVersion?: string;
  readonly feeDisclosureUrl?: string;
  readonly consentComponentVersion?: string;
  readonly idempotencyKey?: string;
}

export interface SubmitOnboardingRequirementRequest {
  readonly requirementId: string;
  readonly documentIds?: readonly string[];
  readonly payload?: Readonly<Record<string, string | number | boolean | null>>;
}

export interface SubmitOnboardingRequirementsRequest {
  readonly submissions: readonly SubmitOnboardingRequirementRequest[];
  readonly submittedByType: "operator" | "merchant";
  readonly submittedByRef: string;
}

export interface CreateOnboardingRequirementUploadLinkRequest {
  readonly fileName: string;
  readonly contentType: string;
  readonly uploadedByType: "operator" | "merchant";
  readonly uploadedByRef: string;
}

export interface ApiMerchantOnboardingSnapshot {
  readonly merchantAccountId: MerchantAccountId;
  readonly onboardingSessionId: MerchantOnboardingSessionId;
  readonly status: MerchantOnboardingSessionStatus;
  readonly requirementIds: readonly MerchantRequirementId[];
  readonly openRequirementIds: readonly MerchantRequirementId[];
  readonly metadata?: Readonly<Record<string, string>>;
}

export interface ApiMerchantOnboardingRequirement {
  readonly requirementId: MerchantRequirementId;
  readonly requirementType: string;
  readonly status: "pending" | "submitted" | "satisfied" | "failed" | "waived";
  readonly reasonCode?: string;
  readonly title: string;
  readonly description?: string;
  readonly requestedAt?: string;
  readonly satisfiedAt?: string;
  readonly expiresAt?: string;
  readonly metadata?: Readonly<Record<string, string>>;
}

export interface ApiMerchantRequirementDocument {
  readonly requirementId: MerchantRequirementId;
  readonly documentId: string;
  readonly uploadLinkId: string;
  readonly fileName?: string;
  readonly contentType?: string;
  readonly requestedAt: string;
  readonly uploadedByType: "operator" | "merchant";
  readonly uploadedByRef: string;
  readonly status?: string;
  readonly recordedAt?: string;
}

export interface ApiMerchantRequirementUploadLink {
  readonly requirementId: MerchantRequirementId;
  readonly documentId: string;
  readonly uploadLinkId: string;
  readonly uploadUrl: string;
  readonly expiresAt?: string;
}

export interface ApiMerchantRequirementUploadStatus {
  readonly requirementId: MerchantRequirementId;
  readonly documentId: string;
  readonly uploadLinkId: string;
  readonly fileName?: string;
  readonly contentType?: string;
  readonly requestedAt?: string;
  readonly status?: string;
  readonly recordedAt?: string;
}

export interface RefreshOnboardingRequirementResponse {
  readonly requirement: ApiMerchantOnboardingRequirement;
  readonly documents: readonly ApiMerchantRequirementDocument[];
}

export interface RefreshOnboardingSessionResponse {
  readonly snapshot: ApiMerchantOnboardingSnapshot;
  readonly requirements: readonly ApiMerchantOnboardingRequirement[];
}
