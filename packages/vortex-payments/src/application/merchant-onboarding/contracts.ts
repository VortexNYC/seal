import type {
  Environment,
  MerchantAccountId,
  MerchantOnboardingSessionId,
  MerchantRequirementId,
  Metadata,
} from "../../domain/common";
import type { MerchantOnboardingSessionStatus } from "../../domain/merchant";

export interface MerchantOnboardingConsentAttestation {
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
}

export interface SubmitMerchantOnboardingCommand {
  readonly environment: Environment;
  readonly merchantAccountId: MerchantAccountId;
  readonly submittedByType: "operator" | "merchant" | "system";
  readonly submittedByRef: string;
  readonly consent: MerchantOnboardingConsentAttestation;
  readonly idempotencyKey?: string;
}

export interface MerchantRequirementSubmission {
  readonly requirementId: MerchantRequirementId;
  readonly documentIds?: readonly string[];
  readonly payload?: Readonly<Record<string, string | number | boolean | null>>;
}

export interface SatisfyMerchantRequirementsCommand {
  readonly environment: Environment;
  readonly merchantAccountId: MerchantAccountId;
  readonly onboardingSessionId: MerchantOnboardingSessionId;
  readonly submissions: readonly MerchantRequirementSubmission[];
  readonly submittedByType: "operator" | "merchant";
  readonly submittedByRef: string;
}

export interface MerchantOnboardingRequirementView {
  readonly requirementId: MerchantRequirementId;
  readonly requirementType: string;
  readonly status: "pending" | "submitted" | "satisfied" | "failed" | "waived";
  readonly reasonCode?: string;
  readonly title: string;
  readonly description?: string;
  readonly sourceProvider: string;
  readonly providerRequirementRef?: string;
  readonly requestedAt?: string;
  readonly satisfiedAt?: string;
  readonly expiresAt?: string;
  readonly metadata?: Metadata;
}

export interface MerchantOnboardingSnapshot {
  readonly merchantAccountId: MerchantAccountId;
  readonly onboardingSessionId: MerchantOnboardingSessionId;
  readonly status: MerchantOnboardingSessionStatus;
  readonly requirementIds: readonly MerchantRequirementId[];
  readonly openRequirementIds: readonly MerchantRequirementId[];
  readonly metadata?: Metadata;
}

export interface GetMerchantOnboardingSnapshotQuery {
  readonly environment: Environment;
  readonly merchantAccountId: MerchantAccountId;
  readonly onboardingSessionId: MerchantOnboardingSessionId;
}

export interface RefreshMerchantOnboardingSessionCommand {
  readonly environment: Environment;
  readonly merchantAccountId: MerchantAccountId;
  readonly onboardingSessionId: MerchantOnboardingSessionId;
}

export interface ListMerchantRequirementsQuery {
  readonly environment: Environment;
  readonly merchantAccountId: MerchantAccountId;
  readonly onboardingSessionId: MerchantOnboardingSessionId;
}

export interface ListMerchantRequirementDocumentsQuery {
  readonly environment: Environment;
  readonly merchantAccountId: MerchantAccountId;
  readonly onboardingSessionId: MerchantOnboardingSessionId;
  readonly requirementId: MerchantRequirementId;
}

export interface RefreshMerchantRequirementCommand {
  readonly environment: Environment;
  readonly merchantAccountId: MerchantAccountId;
  readonly onboardingSessionId: MerchantOnboardingSessionId;
  readonly requirementId: MerchantRequirementId;
}

export interface CreateMerchantRequirementUploadLinkCommand {
  readonly environment: Environment;
  readonly merchantAccountId: MerchantAccountId;
  readonly onboardingSessionId: MerchantOnboardingSessionId;
  readonly requirementId: MerchantRequirementId;
  readonly fileName: string;
  readonly contentType: string;
  readonly uploadedByType: "operator" | "merchant";
  readonly uploadedByRef: string;
}

export interface MerchantRequirementUploadLink {
  readonly requirementId: MerchantRequirementId;
  readonly documentId: string;
  readonly uploadLinkId: string;
  readonly uploadUrl: string;
  readonly expiresAt?: string;
}

export interface GetMerchantRequirementUploadStatusQuery {
  readonly environment: Environment;
  readonly merchantAccountId: MerchantAccountId;
  readonly onboardingSessionId: MerchantOnboardingSessionId;
  readonly requirementId: MerchantRequirementId;
}

export interface MerchantRequirementDocumentView {
  readonly requirementId: MerchantRequirementId;
  readonly documentId: string;
  readonly uploadLinkId: string;
  readonly fileName?: string;
  readonly contentType?: string;
  readonly requestedAt: string;
  readonly uploadedByType: "operator" | "merchant";
  readonly uploadedByRef: string;
  readonly provider: string;
  readonly status?: string;
  readonly recordedAt?: string;
}

export interface MerchantRequirementUploadStatus {
  readonly requirementId: MerchantRequirementId;
  readonly documentId: string;
  readonly uploadLinkId: string;
  readonly fileName?: string;
  readonly contentType?: string;
  readonly requestedAt?: string;
  readonly provider: string;
  readonly status?: string;
  readonly recordedAt?: string;
}

export interface RefreshedMerchantRequirementState {
  readonly requirement: MerchantOnboardingRequirementView;
  readonly documents: readonly MerchantRequirementDocumentView[];
}

export interface RefreshedMerchantOnboardingSessionState {
  readonly snapshot: MerchantOnboardingSnapshot;
  readonly requirements: readonly MerchantOnboardingRequirementView[];
}
