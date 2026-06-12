import type {
  CreateMerchantRequirementUploadLinkCommand,
  GetMerchantOnboardingSnapshotQuery,
  GetMerchantRequirementUploadStatusQuery,
  ListMerchantRequirementDocumentsQuery,
  ListMerchantRequirementsQuery,
  MerchantOnboardingRequirementView,
  MerchantOnboardingSnapshot,
  MerchantRequirementDocumentView,
  MerchantRequirementUploadLink,
  MerchantRequirementUploadStatus,
  RefreshMerchantOnboardingSessionCommand,
  RefreshMerchantRequirementCommand,
  RefreshedMerchantOnboardingSessionState,
  RefreshedMerchantRequirementState,
  SubmitMerchantOnboardingCommand,
  SatisfyMerchantRequirementsCommand,
} from "./contracts";

export interface MerchantOnboardingService {
  submitMerchantOnboarding(
    command: SubmitMerchantOnboardingCommand,
  ): Promise<MerchantOnboardingSnapshot>;
  getMerchantOnboardingSnapshot(
    query: GetMerchantOnboardingSnapshotQuery,
  ): Promise<MerchantOnboardingSnapshot | null>;
  refreshMerchantOnboardingSession(
    command: RefreshMerchantOnboardingSessionCommand,
  ): Promise<RefreshedMerchantOnboardingSessionState | null>;
  listMerchantRequirements(
    query: ListMerchantRequirementsQuery,
  ): Promise<readonly MerchantOnboardingRequirementView[]>;
  listMerchantRequirementDocuments(
    query: ListMerchantRequirementDocumentsQuery,
  ): Promise<readonly MerchantRequirementDocumentView[]>;
  satisfyMerchantRequirements(
    command: SatisfyMerchantRequirementsCommand,
  ): Promise<MerchantOnboardingSnapshot>;
  refreshMerchantRequirement(
    command: RefreshMerchantRequirementCommand,
  ): Promise<RefreshedMerchantRequirementState | null>;
  createRequirementUploadLink(
    command: CreateMerchantRequirementUploadLinkCommand,
  ): Promise<MerchantRequirementUploadLink>;
  getRequirementUploadStatus(
    query: GetMerchantRequirementUploadStatusQuery,
  ): Promise<MerchantRequirementUploadStatus | null>;
}
