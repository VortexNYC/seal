import type {
  MerchantAccountId,
  MerchantOnboardingSessionId,
  MerchantRequirementId,
  ProcessorRef,
} from "../../domain/common";
import type {
  MerchantAccount,
  MerchantAccountStatus,
  MerchantOnboardingSession,
  MerchantOnboardingSessionStatus,
  MerchantRequirement,
  MerchantRequirementDocument,
  MerchantRequirementStatus,
} from "../../domain/merchant";
import type { CanonicalDomainEvent } from "../../events/types";
import type { ProviderRegistry } from "../../providers/registry";
import type { ProviderContext, ProviderError } from "../../providers/types";
import type { PaymentsUnitOfWork } from "../../storage/unit-of-work";
import { deriveMerchantAccountState } from "../state/derive-merchant-account-state";
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
  SatisfyMerchantRequirementsCommand,
  SubmitMerchantOnboardingCommand,
} from "./contracts";
import type { MerchantOnboardingService } from "./service";
function sealAssertPresent<T>(
  value: T | null | undefined,
  message = "Expected value to be present.",
): NonNullable<T> {
  if (value === null || value === undefined) {
    throw new Error(message);
  }
  return value;
}

export class MerchantOnboardingServiceError extends Error {
  readonly code:
    | "invalid_request"
    | "not_found"
    | "conflict"
    | "action_required"
    | "provider_unavailable"
    | "internal_error";
  readonly retryable: boolean;
  readonly details?: Readonly<Record<string, string>>;

  constructor(
    code: MerchantOnboardingServiceError["code"],
    message: string,
    options?: {
      retryable?: boolean;
      details?: Readonly<Record<string, string>>;
    },
  ) {
    super(message);
    this.name = "MerchantOnboardingServiceError";
    this.code = code;
    this.retryable = options?.retryable ?? false;
    this.details = options?.details;
  }
}

export interface MerchantOnboardingServiceDependencies {
  readonly uow: PaymentsUnitOfWork;
  readonly providers: ProviderRegistry;
  readonly resolveProviderContext: (merchant: MerchantAccount) => ProviderContext;
  readonly now?: () => string;
  readonly createId?: (prefix: "onb" | "req" | "idem") => string;
}

const DEFAULT_IDEMPOTENCY_TTL_MS = 1000 * 60 * 60 * 24;

function createDefaultId(prefix: "onb" | "req" | "idem"): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function createMerchantOnboardingEvent(input: {
  readonly id: string;
  readonly eventType: CanonicalDomainEvent["eventType"];
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly environment: MerchantAccount["environment"];
  readonly sourceProvider: string;
  readonly occurredAt: string;
  readonly merchantAccountId: MerchantAccountId;
  readonly payload?: CanonicalDomainEvent["payload"];
}): CanonicalDomainEvent {
  return {
    id: input.id,
    environment: input.environment,
    eventType: input.eventType,
    aggregateType: input.aggregateType,
    aggregateId: input.aggregateId,
    occurredAt: input.occurredAt,
    sourceProvider: input.sourceProvider,
    payload: {
      merchantAccountId: input.merchantAccountId,
      ...input.payload,
    },
    createdAt: input.occurredAt,
  };
}

function mapOnboardingStatusEventType(
  status: MerchantOnboardingSessionStatus,
): Extract<
  CanonicalDomainEvent["eventType"],
  | "merchant_account.submitted"
  | "merchant_account.approved"
  | "merchant_account.rejected"
  | "merchant_account.action_required"
  | "merchant_account.restricted"
> {
  switch (status) {
    case "submitted":
    case "under_review":
      return "merchant_account.submitted";
    case "approved":
      return "merchant_account.approved";
    case "rejected":
      return "merchant_account.rejected";
    case "action_required":
      return "merchant_account.action_required";
    case "restricted":
      return "merchant_account.restricted";
    case "draft":
      return "merchant_account.submitted";
  }
}

function stableStringify(value: unknown): string {
  if (value === null || value === undefined) {
    return "null";
  }

  if (typeof value === "string") {
    return JSON.stringify(value);
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) =>
      left.localeCompare(right),
    );
    return `{${entries
      .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`)
      .join(",")}}`;
  }

  return JSON.stringify(String(value));
}

function hashRequest(value: unknown): string {
  const stable = stableStringify(value);
  let hash = 2166136261;

  for (let index = 0; index < stable.length; index += 1) {
    hash ^= stable.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return `fnv1a_${(hash >>> 0).toString(16)}`;
}

function mapProviderError(error: ProviderError): MerchantOnboardingServiceError {
  switch (error.category) {
    case "invalid_request":
      return new MerchantOnboardingServiceError("invalid_request", error.message, {
        retryable: error.retryable,
        details: { provider: error.provider, code: error.code },
      });
    case "action_required":
      return new MerchantOnboardingServiceError("action_required", error.message, {
        retryable: error.retryable,
        details: { provider: error.provider, code: error.code },
      });
    case "authentication_failed":
    case "rate_limited":
    case "temporarily_unavailable":
    case "unknown":
    case "not_supported":
    default:
      return new MerchantOnboardingServiceError("provider_unavailable", error.message, {
        retryable: error.retryable,
        details: { provider: error.provider, code: error.code },
      });
  }
}

const FINIX_REFUND_POLICIES = new Set([
  "NO_REFUNDS",
  "MERCHANDISE_EXCHANGE_ONLY",
  "REFUNDS_WITHIN_30_DAYS",
  "OTHER",
]);

function sumDefinedPercentages(values: readonly (number | undefined)[]): number | null {
  let total = 0;
  for (const value of values) {
    if (value === undefined) {
      return null;
    }
    total += value;
  }
  return total;
}

function assertPercentageTotal(total: number | null, field: string, invalid: string[]): void {
  if (total === null) {
    invalid.push(`${field} must include all percentage fields`);
    return;
  }
  if (total !== 100) {
    invalid.push(`${field} must total 100`);
  }
}

function assertRequiredFinixUnderwriting(merchant: MerchantAccount): void {
  const underwriting = merchant.underwriting;
  const missing: string[] = [];
  const invalid: string[] = [];
  if (merchant.achMaxTransactionAmount === undefined) missing.push("achMaxTransactionAmount");
  if (merchant.annualCardVolume === undefined) missing.push("annualCardVolume");
  if (underwriting?.annualAchVolume === undefined) missing.push("underwriting.annualAchVolume");
  if (underwriting?.averageAchTransferAmount === undefined)
    missing.push("underwriting.averageAchTransferAmount");
  if (underwriting?.averageCardTransferAmount === undefined)
    missing.push("underwriting.averageCardTransferAmount");
  if (!underwriting?.businessDescription) missing.push("underwriting.businessDescription");
  if (underwriting?.cardVolumeDistribution === undefined)
    missing.push("underwriting.cardVolumeDistribution");
  if (!underwriting?.refundPolicy) missing.push("underwriting.refundPolicy");
  if (underwriting?.volumeDistributionByBusinessType === undefined)
    missing.push("underwriting.volumeDistributionByBusinessType");
  if (underwriting?.refundPolicy && !FINIX_REFUND_POLICIES.has(underwriting.refundPolicy)) {
    invalid.push("underwriting.refundPolicy is not a supported Finix refund policy");
  }
  if (underwriting?.cardVolumeDistribution) {
    assertPercentageTotal(
      sumDefinedPercentages([
        underwriting.cardVolumeDistribution.cardPresentPercentage,
        underwriting.cardVolumeDistribution.mailOrderTelephoneOrderPercentage,
        underwriting.cardVolumeDistribution.ecommercePercentage,
      ]),
      "underwriting.cardVolumeDistribution",
      invalid,
    );
  }
  if (underwriting?.volumeDistributionByBusinessType) {
    assertPercentageTotal(
      sumDefinedPercentages([
        underwriting.volumeDistributionByBusinessType.otherVolumePercentage,
        underwriting.volumeDistributionByBusinessType.consumerToConsumerVolumePercentage,
        underwriting.volumeDistributionByBusinessType.businessToConsumerVolumePercentage,
        underwriting.volumeDistributionByBusinessType.businessToBusinessVolumePercentage,
        underwriting.volumeDistributionByBusinessType.personToPersonVolumePercentage,
      ]),
      "underwriting.volumeDistributionByBusinessType",
      invalid,
    );
  }
  for (const [index, identity] of merchant.associatedIdentities?.entries() ?? []) {
    if (
      (identity.principalPercentageOwnership ?? 0) >= 25 &&
      identity.relationType !== "beneficial_owner"
    ) {
      invalid.push(
        `associatedIdentities.${index}.relationType must be beneficial_owner for ownership >= 25`,
      );
    }
  }
  if (missing.length > 0 || invalid.length > 0) {
    throw new MerchantOnboardingServiceError(
      "invalid_request",
      "Finix onboarding requires complete and valid additional underwriting data",
      {
        details: {
          missingFields: missing.join(","),
          invalidFields: invalid.join(","),
        },
      },
    );
  }
}

function mapProviderOnboardingStatus(status: string): MerchantOnboardingSessionStatus {
  switch (status) {
    case "approved":
      return "approved";
    case "rejected":
      return "rejected";
    case "action_required":
      return "action_required";
    case "under_review":
      return "under_review";
    default:
      return "submitted";
  }
}

function mapOnboardingToMerchantStatus(
  status: MerchantOnboardingSessionStatus,
): MerchantAccountStatus {
  switch (status) {
    case "approved":
      return "active";
    case "rejected":
      return "rejected";
    case "action_required":
    case "restricted":
      return "restricted";
    case "under_review":
    case "submitted":
      return "pending_review";
    case "draft":
    default:
      return "draft";
  }
}

function dedupeProcessorRefs(refs: readonly ProcessorRef[]): readonly ProcessorRef[] {
  const seen = new Set<string>();
  const result: ProcessorRef[] = [];

  for (const ref of refs) {
    const key = `${ref.provider}:${ref.objectType}:${ref.objectId}:${ref.relationship}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(ref);
  }

  return result;
}

function createRequirementRecord(input: {
  environment: SubmitMerchantOnboardingCommand["environment"];
  onboardingSessionId: MerchantOnboardingSessionId;
  merchantAccountId: MerchantAccountId;
  requirementId: MerchantRequirementId;
  providerRequirementRef: string;
  requestedAt: string;
}): MerchantRequirement {
  return {
    id: input.requirementId,
    environment: input.environment,
    onboardingSessionId: input.onboardingSessionId,
    merchantAccountId: input.merchantAccountId,
    requirementType: "provider_requirement",
    status: "pending",
    title: "Provider requirement pending",
    description: "Provider reported an open onboarding requirement",
    sourceProvider: "finix",
    providerRequirementRef: input.providerRequirementRef,
    requestedAt: input.requestedAt,
  };
}

function createRequirementId(
  merchantAccountId: MerchantAccountId,
  providerRequirementRef: string,
): MerchantRequirementId {
  return `${merchantAccountId}:provider_requirement:${providerRequirementRef}`;
}

function toRequirementView(requirement: MerchantRequirement): MerchantOnboardingRequirementView {
  return {
    requirementId: requirement.id,
    requirementType: requirement.requirementType,
    status: requirement.status,
    reasonCode: requirement.reasonCode,
    title: requirement.title,
    description: requirement.description,
    sourceProvider: requirement.sourceProvider,
    providerRequirementRef: requirement.providerRequirementRef,
    requestedAt: requirement.requestedAt,
    satisfiedAt: requirement.satisfiedAt,
    expiresAt: requirement.expiresAt,
    metadata: requirement.metadata,
  };
}

function mergeRequirementMetadata(
  existing: Readonly<Record<string, string>> | undefined,
  incoming: Readonly<Record<string, string>> | undefined,
): Readonly<Record<string, string>> | undefined {
  if (!existing && !incoming) {
    return undefined;
  }
  return {
    ...existing,
    ...incoming,
  };
}

function reconcileRefreshedRequirement(
  existing: MerchantRequirement | null,
  incoming: MerchantRequirement,
): MerchantRequirement {
  if (!existing) {
    return incoming;
  }

  return {
    ...existing,
    ...incoming,
    id: existing.id,
    requestedAt: incoming.requestedAt ?? existing.requestedAt,
    satisfiedAt: incoming.satisfiedAt,
    metadata: mergeRequirementMetadata(existing.metadata, incoming.metadata),
  };
}

function closeRemovedRequirement(
  requirement: MerchantRequirement,
  onboardingStatus: MerchantOnboardingSessionStatus,
  refreshedAt: string,
): MerchantRequirement {
  const closedStatus: MerchantRequirementStatus =
    onboardingStatus === "approved" ? "satisfied" : "waived";
  return {
    ...requirement,
    status: closedStatus,
    satisfiedAt:
      closedStatus === "satisfied"
        ? (requirement.satisfiedAt ?? refreshedAt)
        : requirement.satisfiedAt,
    metadata: {
      ...requirement.metadata,
      providerRefreshClosedAt: refreshedAt,
      providerRefreshClosedReason: "removed_from_provider_projection",
    },
  };
}

function toSnapshot(
  session: MerchantOnboardingSession,
  requirements: readonly MerchantRequirement[],
  metadata?: Readonly<Record<string, string>>,
): MerchantOnboardingSnapshot {
  const mergedMetadata = { ...session.metadata, ...metadata };
  return {
    merchantAccountId: session.merchantAccountId,
    onboardingSessionId: session.id,
    status: session.status,
    requirementIds: requirements.map((requirement) => requirement.id),
    openRequirementIds: requirements
      .filter(
        (requirement) => requirement.status === "pending" || requirement.status === "submitted",
      )
      .map((requirement) => requirement.id),
    metadata: Object.keys(mergedMetadata).length > 0 ? mergedMetadata : undefined,
  };
}

function consentMetadata(
  consent: SubmitMerchantOnboardingCommand["consent"],
): Readonly<Record<string, string>> {
  return Object.fromEntries(
    Object.entries({
      merchantAgreementAcceptedAt: consent.merchantAgreementAcceptedAt,
      merchantAgreementIpAddress: consent.merchantAgreementIpAddress,
      merchantAgreementUserAgent: consent.merchantAgreementUserAgent,
      paymentTermsUrl: consent.paymentTermsUrl,
      paymentPrivacyUrl: consent.paymentPrivacyUrl,
      vortexTermsUrl: consent.vortexTermsUrl,
      vortexPrivacyUrl: consent.vortexPrivacyUrl,
      feeDisclosureVersion: consent.feeDisclosureVersion,
      feeDisclosureUrl: consent.feeDisclosureUrl,
      consentComponentVersion: consent.consentComponentVersion,
    }).filter(
      (entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].length > 0,
    ),
  );
}

function createRequirementSubmissionMetadata(input: {
  previous?: Readonly<Record<string, string>>;
  submittedAt: string;
  submittedByType: "operator" | "merchant";
  submittedByRef: string;
  payload?: Readonly<Record<string, string | number | boolean | null>>;
  documentIds?: readonly string[];
}): Readonly<Record<string, string>> {
  return {
    ...input.previous,
    lastSubmittedAt: input.submittedAt,
    lastSubmittedByType: input.submittedByType,
    lastSubmittedByRef: input.submittedByRef,
    submittedPayload: JSON.stringify(input.payload ?? {}),
    submittedDocumentIds: JSON.stringify(input.documentIds ?? []),
  };
}

function createRequirementDocumentRecord(input: {
  environment: SubmitMerchantOnboardingCommand["environment"];
  merchantAccountId: MerchantAccountId;
  onboardingSessionId: MerchantOnboardingSessionId;
  requirementId: MerchantRequirementId;
  sourceProvider: string;
  documentId: string;
  uploadLinkId: string;
  contentType: string;
  fileName: string;
  requestedAt: string;
  uploadedByType: "operator" | "merchant";
  uploadedByRef: string;
}): MerchantRequirementDocument {
  return {
    id: `${input.requirementId}:${input.documentId}`,
    environment: input.environment,
    onboardingSessionId: input.onboardingSessionId,
    merchantAccountId: input.merchantAccountId,
    requirementId: input.requirementId,
    sourceProvider: input.sourceProvider,
    documentId: input.documentId,
    uploadLinkId: input.uploadLinkId,
    fileName: input.fileName,
    contentType: input.contentType,
    requestedAt: input.requestedAt,
    uploadedByType: input.uploadedByType,
    uploadedByRef: input.uploadedByRef,
  };
}

function getLatestRequirementDocument(
  documents: readonly MerchantRequirementDocument[],
): MerchantRequirementDocument | null {
  return (
    [...documents].sort((left, right) => right.requestedAt.localeCompare(left.requestedAt))[0] ??
    null
  );
}

function toRequirementDocumentView(
  document: MerchantRequirementDocument,
): MerchantRequirementDocumentView {
  return {
    requirementId: document.requirementId,
    documentId: document.documentId,
    uploadLinkId: document.uploadLinkId,
    fileName: document.fileName,
    contentType: document.contentType,
    requestedAt: document.requestedAt,
    uploadedByType: document.uploadedByType,
    uploadedByRef: document.uploadedByRef,
    provider: document.sourceProvider,
    status: document.status,
    recordedAt: document.recordedAt,
  };
}

function getRequirementSnapshotObjectType(
  requirement: MerchantRequirement,
): "verification" | "compliance_form" | null {
  if (requirement.requirementType === "verification") {
    return "verification";
  }
  if (requirement.requirementType === "compliance_form") {
    return "compliance_form";
  }
  const [, sourceType] = requirement.id.split(":");
  if (sourceType === "verification" || sourceType === "compliance_form") {
    return sourceType;
  }
  return null;
}

function mapRequirementSnapshotStatus(
  objectType: "verification" | "compliance_form",
  status: string | undefined,
): MerchantRequirementStatus | null {
  if (!status) {
    return null;
  }
  if (objectType === "verification") {
    switch (status) {
      case "SUCCEEDED":
      case "APPROVED":
        return "satisfied";
      case "FAILED":
      case "REJECTED":
        return "failed";
      case "PENDING":
      case "IN_PROGRESS":
        return "submitted";
      default:
        return "pending";
    }
  }
  switch (status) {
    case "COMPLETED":
    case "SUCCEEDED":
      return "satisfied";
    case "SUBMITTED":
    case "IN_REVIEW":
      return "submitted";
    case "FAILED":
    case "REJECTED":
      return "failed";
    case "WAIVED":
      return "waived";
    default:
      return "pending";
  }
}

function readRequirementMetadataValue(
  requirement: MerchantRequirement,
  key: string,
): string | undefined {
  const value = requirement.metadata?.[key];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

async function getMerchantOrThrow(
  uow: PaymentsUnitOfWork,
  environment: SubmitMerchantOnboardingCommand["environment"],
  merchantAccountId: MerchantAccountId,
): Promise<MerchantAccount> {
  const merchant = await uow.merchants.getById(merchantAccountId, { environment });
  if (!merchant) {
    throw new MerchantOnboardingServiceError("not_found", "merchant account not found", {
      details: { merchantAccountId },
    });
  }

  return merchant;
}

async function withIdempotentResult<TResult>(
  uow: PaymentsUnitOfWork,
  options: {
    environment: SubmitMerchantOnboardingCommand["environment"];
    scope: string;
    idempotencyKey?: string;
    request: unknown;
    createId: (prefix: "idem") => string;
    now: string;
  },
  work: () => Promise<TResult>,
): Promise<TResult> {
  if (!options.idempotencyKey) {
    return work();
  }

  const requestHash = hashRequest(options.request);
  const existing = await uow.idempotency.getByScopeAndKey(
    options.environment,
    options.scope,
    options.idempotencyKey,
  );

  if (existing) {
    if (existing.requestHash !== requestHash) {
      throw new MerchantOnboardingServiceError(
        "conflict",
        "idempotency key reused with different request",
        { details: { scope: options.scope } },
      );
    }

    return JSON.parse(existing.responseRef) as TResult;
  }

  const result = await work();
  await uow.idempotency.save({
    id: options.createId("idem"),
    environment: options.environment,
    scope: options.scope,
    idempotencyKey: options.idempotencyKey,
    requestHash,
    responseRef: JSON.stringify(result),
    createdAt: options.now,
    expiresAt: new Date(Date.parse(options.now) + DEFAULT_IDEMPOTENCY_TTL_MS).toISOString(),
  });
  return result;
}

export function createMerchantOnboardingService(
  dependencies: MerchantOnboardingServiceDependencies,
): MerchantOnboardingService {
  const now = dependencies.now ?? (() => new Date().toISOString());
  const createId = dependencies.createId ?? createDefaultId;

  return {
    async submitMerchantOnboarding(
      command: SubmitMerchantOnboardingCommand,
    ): Promise<MerchantOnboardingSnapshot> {
      return dependencies.uow.runInTransaction(async (uow) => {
        return withIdempotentResult(
          uow,
          {
            environment: command.environment,
            scope: `payments:onboarding:submit:${command.merchantAccountId}`,
            idempotencyKey: command.idempotencyKey,
            request: command,
            createId: (prefix) => createId(prefix),
            now: now(),
          },
          async () => {
            const merchant = await getMerchantOrThrow(
              uow,
              command.environment,
              command.merchantAccountId,
            );
            const providerContext = dependencies.resolveProviderContext(merchant);
            if (
              providerContext.provider === "finix" &&
              command.consent.merchantAgreementAccepted !== true
            ) {
              throw new MerchantOnboardingServiceError(
                "invalid_request",
                "Finix onboarding requires merchant agreement consent attestation",
              );
            }
            if (providerContext.provider === "finix") {
              assertRequiredFinixUnderwriting(merchant);
            }
            const adapter = dependencies.providers.getAdapter(providerContext.provider);
            const submittedAt = now();
            const providerResult = await adapter.createMerchantOnboarding(providerContext, {
              merchantAccountId: merchant.id,
              externalMerchantRef: merchant.externalMerchantRef,
              displayName: merchant.displayName,
              legalEntityType: merchant.legalEntityType,
              country: merchant.country,
              merchantMode: merchant.merchantMode,
              businessAddress: merchant.businessAddress
                ? {
                    line1: merchant.businessAddress.line1,
                    line2: merchant.businessAddress.line2,
                    city: merchant.businessAddress.city,
                    region: merchant.businessAddress.region,
                    postalCode: merchant.businessAddress.postalCode,
                    country: merchant.businessAddress.country,
                  }
                : undefined,
              personalAddress: merchant.personalAddress
                ? {
                    line1: merchant.personalAddress.line1,
                    line2: merchant.personalAddress.line2,
                    city: merchant.personalAddress.city,
                    region: merchant.personalAddress.region,
                    postalCode: merchant.personalAddress.postalCode,
                    country: merchant.personalAddress.country,
                  }
                : undefined,
              doingBusinessAs: merchant.doingBusinessAs,
              businessPhone: merchant.businessPhone,
              businessTaxId: merchant.businessTaxId,
              phone: merchant.phone,
              taxId: merchant.taxId,
              email: merchant.email,
              firstName: merchant.firstName,
              lastName: merchant.lastName,
              dateOfBirth: merchant.dateOfBirth,
              incorporationDate: merchant.incorporationDate,
              maxTransactionAmount: merchant.maxTransactionAmount,
              achMaxTransactionAmount: merchant.achMaxTransactionAmount,
              annualCardVolume: merchant.annualCardVolume,
              mcc: merchant.mcc,
              url: merchant.url,
              principalPercentageOwnership: merchant.principalPercentageOwnership,
              hasAcceptedCreditCardsPreviously: merchant.hasAcceptedCreditCardsPreviously,
              settlementBankAccount: merchant.settlementBankAccount,
              underwriting: merchant.underwriting,
              associatedIdentities: merchant.associatedIdentities?.map((identity) => ({
                identityRoles: identity.identityRoles,
                relationType: identity.relationType,
                firstName: identity.firstName,
                lastName: identity.lastName,
                email: identity.email,
                phone: identity.phone,
                title: identity.title,
                taxId: identity.taxId,
                dateOfBirth: identity.dateOfBirth,
                personalAddress: identity.personalAddress
                  ? {
                      line1: identity.personalAddress.line1,
                      line2: identity.personalAddress.line2,
                      city: identity.personalAddress.city,
                      region: identity.personalAddress.region,
                      postalCode: identity.personalAddress.postalCode,
                      country: identity.personalAddress.country,
                    }
                  : undefined,
                principalPercentageOwnership: identity.principalPercentageOwnership,
              })),
              merchantAgreementAccepted: command.consent.merchantAgreementAccepted,
              merchantAgreementAcceptedAt: command.consent.merchantAgreementAcceptedAt,
              merchantAgreementIpAddress: command.consent.merchantAgreementIpAddress,
              merchantAgreementUserAgent: command.consent.merchantAgreementUserAgent,
            });

            if (!providerResult.ok || !providerResult.value) {
              throw mapProviderError(
                providerResult.error ?? {
                  provider: providerContext.provider,
                  category: "unknown",
                  code: "provider_result_missing",
                  message: "provider onboarding failed without error details",
                  retryable: false,
                },
              );
            }

            const onboardingStatus = mapProviderOnboardingStatus(providerResult.value.status);
            const onboardingSessionId = createId("onb");
            const requirementIds = providerResult.value.requirementRefs.map((requirementRef) =>
              createRequirementId(merchant.id, requirementRef),
            );
            const requirements = providerResult.value.requirementRefs.map((requirementRef, index) =>
              createRequirementRecord({
                environment: command.environment,
                onboardingSessionId,
                merchantAccountId: merchant.id,
                requirementId: sealAssertPresent(requirementIds[index]),
                providerRequirementRef: requirementRef,
                requestedAt: submittedAt,
              }),
            );
            const sessionProcessorRefs = dedupeProcessorRefs([
              providerResult.value.onboardingRef,
              ...(providerResult.value.accountRef ? [providerResult.value.accountRef] : []),
            ]);

            const session: MerchantOnboardingSession = {
              id: onboardingSessionId,
              environment: command.environment,
              merchantAccountId: merchant.id,
              status: onboardingStatus,
              submittedAt,
              approvedAt: onboardingStatus === "approved" ? submittedAt : undefined,
              rejectedAt: onboardingStatus === "rejected" ? submittedAt : undefined,
              externalOnboardingRef: providerResult.value.onboardingRef.objectId,
              currentRequirementCount: requirementIds.length,
              openRequirementCount: requirements.filter(
                (requirement) => requirement.status === "pending",
              ).length,
              processorRefs: sessionProcessorRefs,
              metadata: consentMetadata(command.consent),
              createdAt: submittedAt,
              updatedAt: submittedAt,
            };

            const updatedMerchant: MerchantAccount = {
              ...merchant,
              status: mapOnboardingToMerchantStatus(onboardingStatus),
              processorAccountRefs: dedupeProcessorRefs([
                ...merchant.processorAccountRefs,
                ...(providerResult.value.accountRef ? [providerResult.value.accountRef] : []),
              ]),
              updatedAt: submittedAt,
            };

            await uow.merchants.save(updatedMerchant);
            await uow.onboarding.saveSession(session);
            for (const requirement of requirements) {
              await uow.onboarding.saveRequirement(requirement);
            }
            await uow.merchantStates.save(
              deriveMerchantAccountState({
                merchant: updatedMerchant,
                onboardingSession: session,
                requirements,
                generatedAt: submittedAt,
              }),
            );
            await uow.events.saveCanonicalEvent(
              createMerchantOnboardingEvent({
                id: `${merchant.id}:merchant_account.submitted:${submittedAt}`,
                eventType: mapOnboardingStatusEventType(onboardingStatus),
                aggregateType: "merchant_account",
                aggregateId: merchant.id,
                environment: command.environment,
                sourceProvider: providerContext.provider,
                occurredAt: submittedAt,
                merchantAccountId: merchant.id,
                payload: {
                  onboardingSessionId: session.id,
                  onboardingStatus: session.status,
                  submittedByType: command.submittedByType,
                  submittedByRef: command.submittedByRef,
                  merchantAgreementAccepted: command.consent.merchantAgreementAccepted,
                  merchantAgreementAcceptedAt: command.consent.merchantAgreementAcceptedAt,
                  openRequirementCount: session.openRequirementCount,
                },
              }),
            );

            return toSnapshot(session, requirements, {
              provider: providerContext.provider,
              submittedByType: command.submittedByType,
              submittedByRef: command.submittedByRef,
            });
          },
        );
      });
    },

    async getMerchantOnboardingSnapshot(
      query: GetMerchantOnboardingSnapshotQuery,
    ): Promise<MerchantOnboardingSnapshot | null> {
      const session = await dependencies.uow.onboarding.getSessionById(query.onboardingSessionId, {
        environment: query.environment,
      });
      if (!session || session.merchantAccountId !== query.merchantAccountId) {
        return null;
      }

      const requirements = await dependencies.uow.onboarding.listRequirementsForSession(
        session.id,
        {
          environment: query.environment,
        },
      );
      return toSnapshot(session, requirements);
    },

    async refreshMerchantOnboardingSession(
      command: RefreshMerchantOnboardingSessionCommand,
    ): Promise<RefreshedMerchantOnboardingSessionState | null> {
      return dependencies.uow.runInTransaction(async (uow) => {
        const merchant = await uow.merchants.getById(command.merchantAccountId, {
          environment: command.environment,
        });
        if (!merchant) {
          return null;
        }
        const session = await uow.onboarding.getSessionById(command.onboardingSessionId, {
          environment: command.environment,
        });
        if (!session || session.merchantAccountId !== command.merchantAccountId) {
          return null;
        }

        const providerContext = dependencies.resolveProviderContext(merchant);
        const adapter = dependencies.providers.getAdapter(providerContext.provider);
        if (!adapter.refreshMerchantOnboarding) {
          throw new MerchantOnboardingServiceError(
            "provider_unavailable",
            "provider does not support onboarding session refresh",
            { details: { provider: providerContext.provider } },
          );
        }
        const merchantRef = merchant.processorAccountRefs.find(
          (ref) => ref.objectType === "merchant",
        );
        const providerResult = await adapter.refreshMerchantOnboarding(providerContext, {
          merchantAccountId: command.merchantAccountId,
          onboardingSessionId: command.onboardingSessionId,
          merchantRef,
        });
        if (!providerResult.ok || !providerResult.value) {
          throw mapProviderError(
            providerResult.error ?? {
              provider: providerContext.provider,
              category: "unknown",
              code: "provider_result_missing",
              message: "provider onboarding refresh failed without error details",
              retryable: false,
            },
          );
        }

        const providerValue = providerResult.value;
        const existingRequirements = await uow.onboarding.listRequirementsForSession(session.id, {
          environment: command.environment,
        });
        const existingRequirementsById = new Map(
          existingRequirements.map((requirement) => [requirement.id, requirement]),
        );
        const existingRequirementsByProviderRef = new Map(
          existingRequirements
            .filter((requirement) => requirement.providerRequirementRef !== undefined)
            .map((requirement) => [
              sealAssertPresent(requirement.providerRequirementRef),
              requirement,
            ]),
        );

        const refreshedAt = now();
        const reconciledCurrentRequirements = providerValue.requirements.map((requirement) => {
          const existingRequirement =
            existingRequirementsById.get(requirement.id) ??
            (requirement.providerRequirementRef
              ? (existingRequirementsByProviderRef.get(requirement.providerRequirementRef) ?? null)
              : null);
          return reconcileRefreshedRequirement(existingRequirement, requirement);
        });

        const matchedRequirementIds = new Set(
          reconciledCurrentRequirements.map((requirement) => requirement.id),
        );
        const closedRequirements = existingRequirements
          .filter((requirement) => !matchedRequirementIds.has(requirement.id))
          .map((requirement) =>
            closeRemovedRequirement(requirement, providerValue.onboardingStatus, refreshedAt),
          );
        const reconciledRequirements = [...reconciledCurrentRequirements, ...closedRequirements];

        for (const requirement of reconciledRequirements) {
          await uow.onboarding.saveRequirement(requirement);
        }

        const openRequirementCount = reconciledCurrentRequirements.filter(
          (requirement) => requirement.status === "pending" || requirement.status === "submitted",
        ).length;
        const updatedSession: MerchantOnboardingSession = {
          ...session,
          status: providerValue.onboardingStatus,
          currentRequirementCount: reconciledCurrentRequirements.length,
          openRequirementCount,
          processorRefs: dedupeProcessorRefs([
            ...session.processorRefs,
            ...providerValue.processorRefs,
          ]),
          approvedAt:
            providerValue.onboardingStatus === "approved"
              ? (session.approvedAt ?? refreshedAt)
              : session.approvedAt,
          rejectedAt:
            providerValue.onboardingStatus === "rejected"
              ? (session.rejectedAt ?? refreshedAt)
              : session.rejectedAt,
          updatedAt: refreshedAt,
        };
        const updatedMerchant: MerchantAccount = {
          ...merchant,
          status: providerValue.merchantStatus,
          metadata: providerValue.metadata
            ? { ...merchant.metadata, ...providerValue.metadata }
            : merchant.metadata,
          processorAccountRefs: dedupeProcessorRefs([
            ...merchant.processorAccountRefs,
            ...providerValue.processorRefs,
          ]),
          updatedAt: refreshedAt,
        };
        await uow.onboarding.saveSession(updatedSession);
        await uow.merchants.save(updatedMerchant);
        await uow.merchantStates.save(
          deriveMerchantAccountState({
            merchant: updatedMerchant,
            onboardingSession: updatedSession,
            requirements: reconciledRequirements,
            generatedAt: refreshedAt,
          }),
        );
        if (updatedSession.status !== session.status) {
          await uow.events.saveCanonicalEvent(
            createMerchantOnboardingEvent({
              id: `${merchant.id}:${updatedSession.status}:${refreshedAt}`,
              eventType: mapOnboardingStatusEventType(updatedSession.status),
              aggregateType: "merchant_account",
              aggregateId: merchant.id,
              environment: command.environment,
              sourceProvider: providerContext.provider,
              occurredAt: refreshedAt,
              merchantAccountId: merchant.id,
              payload: {
                onboardingSessionId: updatedSession.id,
                previousOnboardingStatus: session.status,
                onboardingStatus: updatedSession.status,
                openRequirementCount: updatedSession.openRequirementCount,
              },
            }),
          );
        }

        return {
          snapshot: toSnapshot(updatedSession, reconciledCurrentRequirements),
          requirements: reconciledCurrentRequirements.map((requirement) =>
            toRequirementView(requirement),
          ),
        };
      });
    },

    async listMerchantRequirements(
      query: ListMerchantRequirementsQuery,
    ): Promise<readonly MerchantOnboardingRequirementView[]> {
      const session = await dependencies.uow.onboarding.getSessionById(query.onboardingSessionId, {
        environment: query.environment,
      });
      if (!session || session.merchantAccountId !== query.merchantAccountId) {
        return [];
      }

      const requirements = await dependencies.uow.onboarding.listRequirementsForSession(
        session.id,
        {
          environment: query.environment,
        },
      );
      return requirements.map((requirement) => toRequirementView(requirement));
    },

    async listMerchantRequirementDocuments(
      query: ListMerchantRequirementDocumentsQuery,
    ): Promise<readonly MerchantRequirementDocumentView[]> {
      const session = await dependencies.uow.onboarding.getSessionById(query.onboardingSessionId, {
        environment: query.environment,
      });
      if (!session || session.merchantAccountId !== query.merchantAccountId) {
        return [];
      }

      const requirements = await dependencies.uow.onboarding.listRequirementsForSession(
        session.id,
        {
          environment: query.environment,
        },
      );
      const requirement = requirements.find((entry) => entry.id === query.requirementId) ?? null;
      if (!requirement) {
        return [];
      }

      const documents = await dependencies.uow.onboarding.listDocumentsForRequirement(
        requirement.id,
        {
          environment: query.environment,
        },
      );
      return [...documents]
        .sort((left, right) => right.requestedAt.localeCompare(left.requestedAt))
        .map((document) => toRequirementDocumentView(document));
    },

    async refreshMerchantRequirement(
      command: RefreshMerchantRequirementCommand,
    ): Promise<RefreshedMerchantRequirementState | null> {
      return dependencies.uow.runInTransaction(async (uow) => {
        const merchant = await uow.merchants.getById(command.merchantAccountId, {
          environment: command.environment,
        });
        if (!merchant) {
          return null;
        }
        const session = await uow.onboarding.getSessionById(command.onboardingSessionId, {
          environment: command.environment,
        });
        if (!session || session.merchantAccountId !== command.merchantAccountId) {
          return null;
        }
        const requirements = await uow.onboarding.listRequirementsForSession(session.id, {
          environment: command.environment,
        });
        const requirement =
          requirements.find((entry) => entry.id === command.requirementId) ?? null;
        if (!requirement) {
          return null;
        }

        const providerContext = dependencies.resolveProviderContext(merchant);
        const adapter = dependencies.providers.getAdapter(providerContext.provider);

        const storedDocuments = await uow.onboarding.listDocumentsForRequirement(requirement.id, {
          environment: command.environment,
        });
        const refreshedDocuments: MerchantRequirementDocument[] = [];
        for (const document of storedDocuments) {
          const snapshot = await adapter.fetchObjectSnapshot(providerContext, {
            provider: providerContext.provider,
            objectType: "file",
            objectId: document.documentId,
            relationship: "requirement_document",
            recordedAt: document.recordedAt ?? document.requestedAt,
          });
          if (!snapshot.ok || !snapshot.value) {
            throw mapProviderError(
              snapshot.error ?? {
                provider: providerContext.provider,
                category: "unknown",
                code: "provider_snapshot_missing",
                message: "provider document snapshot missing",
                retryable: false,
              },
            );
          }
          const refreshedDocument: MerchantRequirementDocument = {
            ...document,
            status: snapshot.value.status,
            recordedAt: snapshot.value.recordedAt,
          };
          await uow.onboarding.saveRequirementDocument(refreshedDocument);
          refreshedDocuments.push(refreshedDocument);
        }

        let refreshedRequirement = requirement;
        const requirementObjectType = getRequirementSnapshotObjectType(requirement);
        if (requirement.providerRequirementRef && requirementObjectType) {
          const snapshot = await adapter.fetchObjectSnapshot(providerContext, {
            provider: providerContext.provider,
            objectType: requirementObjectType,
            objectId: requirement.providerRequirementRef,
            relationship: "onboarding_requirement",
            recordedAt: requirement.requestedAt ?? now(),
          });
          if (!snapshot.ok || !snapshot.value) {
            throw mapProviderError(
              snapshot.error ?? {
                provider: providerContext.provider,
                category: "unknown",
                code: "provider_snapshot_missing",
                message: "provider requirement snapshot missing",
                retryable: false,
              },
            );
          }
          const mappedStatus = mapRequirementSnapshotStatus(
            requirementObjectType,
            snapshot.value.status,
          );
          refreshedRequirement = {
            ...requirement,
            status: mappedStatus ?? requirement.status,
            satisfiedAt:
              mappedStatus === "satisfied"
                ? (snapshot.value.recordedAt ?? requirement.satisfiedAt ?? now())
                : requirement.satisfiedAt,
            metadata: snapshot.value.metadata
              ? { ...requirement.metadata, ...snapshot.value.metadata }
              : requirement.metadata,
          };
          await uow.onboarding.saveRequirement(refreshedRequirement);
        }

        const updatedRequirements = requirements.map((entry) =>
          entry.id === refreshedRequirement.id ? refreshedRequirement : entry,
        );
        const openRequirementCount = updatedRequirements.filter(
          (entry) => entry.status === "pending" || entry.status === "submitted",
        ).length;
        const refreshedAt = now();
        const updatedSession: MerchantOnboardingSession = {
          ...session,
          currentRequirementCount: updatedRequirements.length,
          openRequirementCount,
          updatedAt: refreshedAt,
        };
        const updatedMerchant: MerchantAccount = {
          ...merchant,
          updatedAt: refreshedAt,
        };
        await uow.onboarding.saveSession(updatedSession);
        await uow.merchants.save(updatedMerchant);
        await uow.merchantStates.save(
          deriveMerchantAccountState({
            merchant: updatedMerchant,
            onboardingSession: updatedSession,
            requirements: updatedRequirements,
            generatedAt: refreshedAt,
          }),
        );
        await uow.events.saveCanonicalEvent(
          createMerchantOnboardingEvent({
            id: `${refreshedRequirement.id}:merchant_requirement.refreshed:${refreshedAt}`,
            eventType: "merchant_requirement.refreshed",
            aggregateType: "merchant_requirement",
            aggregateId: refreshedRequirement.id,
            environment: command.environment,
            sourceProvider: providerContext.provider,
            occurredAt: refreshedAt,
            merchantAccountId: merchant.id,
            payload: {
              onboardingSessionId: updatedSession.id,
              requirementId: refreshedRequirement.id,
              requirementStatus: refreshedRequirement.status,
              documentCount: refreshedDocuments.length,
            },
          }),
        );

        return {
          requirement: toRequirementView(refreshedRequirement),
          documents: refreshedDocuments
            .sort((left, right) => right.requestedAt.localeCompare(left.requestedAt))
            .map((document) => toRequirementDocumentView(document)),
        };
      });
    },

    async satisfyMerchantRequirements(
      command: SatisfyMerchantRequirementsCommand,
    ): Promise<MerchantOnboardingSnapshot> {
      return dependencies.uow.runInTransaction(async (uow) => {
        const merchant = await getMerchantOrThrow(
          uow,
          command.environment,
          command.merchantAccountId,
        );
        const session = await uow.onboarding.getSessionById(command.onboardingSessionId, {
          environment: command.environment,
        });
        if (!session || session.merchantAccountId !== command.merchantAccountId) {
          throw new MerchantOnboardingServiceError("not_found", "onboarding session not found", {
            details: {
              merchantAccountId: command.merchantAccountId,
              onboardingSessionId: command.onboardingSessionId,
            },
          });
        }
        if (session.status === "approved" || session.status === "rejected") {
          throw new MerchantOnboardingServiceError(
            "conflict",
            "onboarding session is not editable",
            {
              details: { onboardingSessionId: command.onboardingSessionId },
            },
          );
        }
        if (command.submissions.length === 0) {
          throw new MerchantOnboardingServiceError(
            "invalid_request",
            "at least one requirement submission is required",
          );
        }

        const requirements = await uow.onboarding.listRequirementsForSession(session.id, {
          environment: command.environment,
        });
        const requirementsById = new Map(
          requirements.map((requirement) => [requirement.id, requirement]),
        );
        const submittedAt = now();

        for (const submission of command.submissions) {
          const requirement = requirementsById.get(submission.requirementId);
          if (!requirement) {
            throw new MerchantOnboardingServiceError(
              "invalid_request",
              "requirement does not belong to onboarding session",
              {
                details: { requirementId: submission.requirementId },
              },
            );
          }
          if (requirement.status === "satisfied" || requirement.status === "waived") {
            throw new MerchantOnboardingServiceError("conflict", "requirement is already closed", {
              details: { requirementId: submission.requirementId },
            });
          }
          const hasPayload =
            submission.payload !== undefined && Object.keys(submission.payload).length > 0;
          const hasDocuments =
            submission.documentIds !== undefined && submission.documentIds.length > 0;
          if (!hasPayload && !hasDocuments) {
            throw new MerchantOnboardingServiceError(
              "invalid_request",
              "requirement submission must include payload or documentIds",
              {
                details: { requirementId: submission.requirementId },
              },
            );
          }

          const updatedRequirement: MerchantRequirement = {
            ...requirement,
            status: "submitted",
            metadata: createRequirementSubmissionMetadata({
              previous: requirement.metadata,
              submittedAt,
              submittedByType: command.submittedByType,
              submittedByRef: command.submittedByRef,
              payload: submission.payload,
              documentIds: submission.documentIds,
            }),
          };
          requirementsById.set(updatedRequirement.id, updatedRequirement);
          await uow.onboarding.saveRequirement(updatedRequirement);
        }

        const updatedRequirements = Array.from(requirementsById.values());
        const openRequirementCount = updatedRequirements.filter(
          (requirement) => requirement.status === "pending" || requirement.status === "submitted",
        ).length;
        const nextSessionStatus: MerchantOnboardingSessionStatus =
          openRequirementCount > 0 ? "under_review" : "approved";
        const updatedSession: MerchantOnboardingSession = {
          ...session,
          status: nextSessionStatus,
          approvedAt: nextSessionStatus === "approved" ? submittedAt : session.approvedAt,
          currentRequirementCount: updatedRequirements.length,
          openRequirementCount,
          updatedAt: submittedAt,
        };
        const updatedMerchant: MerchantAccount = {
          ...merchant,
          status: mapOnboardingToMerchantStatus(nextSessionStatus),
          updatedAt: submittedAt,
        };

        await uow.onboarding.saveSession(updatedSession);
        await uow.merchants.save(updatedMerchant);
        await uow.merchantStates.save(
          deriveMerchantAccountState({
            merchant: updatedMerchant,
            onboardingSession: updatedSession,
            requirements: updatedRequirements,
            generatedAt: submittedAt,
          }),
        );
        for (const submission of command.submissions) {
          const submittedRequirement = requirementsById.get(submission.requirementId);
          if (!submittedRequirement) {
            continue;
          }
          await uow.events.saveCanonicalEvent(
            createMerchantOnboardingEvent({
              id: `${submittedRequirement.id}:merchant_requirement.submitted:${submittedAt}`,
              eventType: "merchant_requirement.submitted",
              aggregateType: "merchant_requirement",
              aggregateId: submittedRequirement.id,
              environment: command.environment,
              sourceProvider: "vortex",
              occurredAt: submittedAt,
              merchantAccountId: merchant.id,
              payload: {
                onboardingSessionId: updatedSession.id,
                requirementId: submittedRequirement.id,
                requirementStatus: submittedRequirement.status,
                submittedByType: command.submittedByType,
                submittedByRef: command.submittedByRef,
                documentCount: submission.documentIds?.length ?? 0,
                payloadFieldCount: submission.payload ? Object.keys(submission.payload).length : 0,
              },
            }),
          );
        }

        return toSnapshot(updatedSession, updatedRequirements, {
          submittedByType: command.submittedByType,
          submittedByRef: command.submittedByRef,
        });
      });
    },

    async createRequirementUploadLink(
      command: CreateMerchantRequirementUploadLinkCommand,
    ): Promise<MerchantRequirementUploadLink> {
      return dependencies.uow.runInTransaction(async (uow) => {
        const merchant = await getMerchantOrThrow(
          uow,
          command.environment,
          command.merchantAccountId,
        );
        const session = await uow.onboarding.getSessionById(command.onboardingSessionId, {
          environment: command.environment,
        });
        if (!session || session.merchantAccountId !== command.merchantAccountId) {
          throw new MerchantOnboardingServiceError("not_found", "onboarding session not found", {
            details: {
              merchantAccountId: command.merchantAccountId,
              onboardingSessionId: command.onboardingSessionId,
            },
          });
        }

        const requirements = await uow.onboarding.listRequirementsForSession(session.id, {
          environment: command.environment,
        });
        const requirement =
          requirements.find((entry) => entry.id === command.requirementId) ?? null;
        if (!requirement) {
          throw new MerchantOnboardingServiceError("not_found", "merchant requirement not found", {
            details: { requirementId: command.requirementId },
          });
        }
        if (requirement.status === "satisfied" || requirement.status === "waived") {
          throw new MerchantOnboardingServiceError(
            "conflict",
            "merchant requirement is already closed",
            {
              details: { requirementId: command.requirementId },
            },
          );
        }

        const providerContext = dependencies.resolveProviderContext(merchant);
        const adapter = dependencies.providers.getAdapter(providerContext.provider);
        if (!adapter.createOnboardingRequirementUploadLink) {
          throw new MerchantOnboardingServiceError(
            "provider_unavailable",
            "provider does not support onboarding document upload links",
            { details: { provider: providerContext.provider } },
          );
        }

        const providerResult = await adapter.createOnboardingRequirementUploadLink(
          providerContext,
          {
            merchantAccountId: command.merchantAccountId,
            onboardingSessionId: command.onboardingSessionId,
            requirementId: command.requirementId,
            providerRequirementRef: requirement.providerRequirementRef,
            fileName: command.fileName,
            contentType: command.contentType,
            uploadedByType: command.uploadedByType,
            uploadedByRef: command.uploadedByRef,
          },
        );
        if (!providerResult.ok || !providerResult.value) {
          throw mapProviderError(
            providerResult.error ?? {
              provider: providerContext.provider,
              category: "unknown",
              code: "provider_result_missing",
              message: "provider upload link creation failed without error details",
              retryable: false,
            },
          );
        }

        const requestedAt = now();
        await uow.onboarding.saveRequirementDocument(
          createRequirementDocumentRecord({
            environment: command.environment,
            merchantAccountId: command.merchantAccountId,
            onboardingSessionId: command.onboardingSessionId,
            requirementId: command.requirementId,
            sourceProvider: providerContext.provider,
            documentId: providerResult.value.documentId,
            uploadLinkId: providerResult.value.uploadLinkId,
            contentType: command.contentType,
            fileName: command.fileName,
            requestedAt,
            uploadedByType: command.uploadedByType,
            uploadedByRef: command.uploadedByRef,
          }),
        );
        await uow.events.saveCanonicalEvent(
          createMerchantOnboardingEvent({
            id: `${command.requirementId}:merchant_requirement_document.upload_link_created:${requestedAt}`,
            eventType: "merchant_requirement_document.upload_link_created",
            aggregateType: "merchant_requirement_document",
            aggregateId: providerResult.value.documentId,
            environment: command.environment,
            sourceProvider: "vortex",
            occurredAt: requestedAt,
            merchantAccountId: merchant.id,
            payload: {
              onboardingSessionId: command.onboardingSessionId,
              requirementId: command.requirementId,
              documentId: providerResult.value.documentId,
              uploadLinkId: providerResult.value.uploadLinkId,
              uploadedByType: command.uploadedByType,
              uploadedByRef: command.uploadedByRef,
            },
          }),
        );

        return {
          requirementId: command.requirementId,
          documentId: providerResult.value.documentId,
          uploadLinkId: providerResult.value.uploadLinkId,
          uploadUrl: providerResult.value.uploadUrl,
          expiresAt: providerResult.value.expiresAt,
        };
      });
    },

    async getRequirementUploadStatus(
      query: GetMerchantRequirementUploadStatusQuery,
    ): Promise<MerchantRequirementUploadStatus | null> {
      const merchant = await dependencies.uow.merchants.getById(query.merchantAccountId, {
        environment: query.environment,
      });
      if (!merchant) {
        return null;
      }
      const session = await dependencies.uow.onboarding.getSessionById(query.onboardingSessionId, {
        environment: query.environment,
      });
      if (!session || session.merchantAccountId !== query.merchantAccountId) {
        return null;
      }
      const requirements = await dependencies.uow.onboarding.listRequirementsForSession(
        session.id,
        {
          environment: query.environment,
        },
      );
      const requirement = requirements.find((entry) => entry.id === query.requirementId) ?? null;
      if (!requirement) {
        return null;
      }

      const storedDocuments = await dependencies.uow.onboarding.listDocumentsForRequirement(
        requirement.id,
        {
          environment: query.environment,
        },
      );
      const latestDocument = getLatestRequirementDocument(storedDocuments);
      const fallbackDocument = latestDocument
        ? null
        : (() => {
            const documentId = readRequirementMetadataValue(requirement, "lastUploadDocumentId");
            const uploadLinkId = readRequirementMetadataValue(requirement, "lastUploadLinkId");
            const requestedAt = readRequirementMetadataValue(
              requirement,
              "lastUploadLinkRequestedAt",
            );
            if (!documentId || !uploadLinkId || !requestedAt) {
              return null;
            }
            return {
              id: `${requirement.id}:${documentId}`,
              environment: query.environment,
              onboardingSessionId: session.id,
              merchantAccountId: merchant.id,
              requirementId: requirement.id,
              sourceProvider: requirement.sourceProvider,
              documentId,
              uploadLinkId,
              fileName: readRequirementMetadataValue(requirement, "lastUploadFileName"),
              contentType: readRequirementMetadataValue(requirement, "lastUploadContentType"),
              requestedAt,
              uploadedByType:
                readRequirementMetadataValue(requirement, "lastUploadLinkRequestedByType") ===
                "operator"
                  ? "operator"
                  : "merchant",
              uploadedByRef:
                readRequirementMetadataValue(requirement, "lastUploadLinkRequestedByRef") ??
                "unknown",
            } satisfies MerchantRequirementDocument;
          })();
      const document = latestDocument ?? fallbackDocument;
      if (!document) {
        return null;
      }

      const providerContext = dependencies.resolveProviderContext(merchant);
      const adapter = dependencies.providers.getAdapter(providerContext.provider);
      const snapshot = await adapter.fetchObjectSnapshot(providerContext, {
        provider: providerContext.provider,
        objectType: "file",
        objectId: document.documentId,
        relationship: "requirement_document",
        recordedAt: document.requestedAt,
      });
      if (!snapshot.ok || !snapshot.value) {
        throw mapProviderError(
          snapshot.error ?? {
            provider: providerContext.provider,
            category: "unknown",
            code: "provider_snapshot_missing",
            message: "provider upload status snapshot missing",
            retryable: false,
          },
        );
      }

      await dependencies.uow.onboarding.saveRequirementDocument({
        ...document,
        status: snapshot.value.status,
        recordedAt: snapshot.value.recordedAt,
      });

      return {
        requirementId: requirement.id,
        documentId: document.documentId,
        uploadLinkId: document.uploadLinkId,
        fileName: document.fileName,
        contentType: document.contentType,
        requestedAt: document.requestedAt,
        provider: snapshot.value.provider,
        status: snapshot.value.status,
        recordedAt: snapshot.value.recordedAt,
      };
    },
  };
}
