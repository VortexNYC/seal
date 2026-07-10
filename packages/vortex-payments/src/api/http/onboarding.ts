import type { ApiSuccess } from "../contract/common";
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
} from "../../application/merchant-onboarding/contracts";
import type { MerchantOnboardingService } from "../../application/merchant-onboarding/service";
import { MerchantOnboardingServiceError } from "../../application/merchant-onboarding/impl";
import type { HttpRequestEnvelope, HttpResponseEnvelope } from "./billing";

type PublicMerchantOnboardingRequirementView = Omit<
  MerchantOnboardingRequirementView,
  "sourceProvider" | "providerRequirementRef"
>;

type PublicMerchantRequirementDocumentView = Omit<MerchantRequirementDocumentView, "provider">;

type PublicMerchantRequirementUploadStatus = Omit<MerchantRequirementUploadStatus, "provider">;

type PublicMerchantOnboardingSnapshot = Omit<MerchantOnboardingSnapshot, "metadata"> & {
  readonly metadata?: MerchantOnboardingSnapshot["metadata"];
};

type PublicRefreshedMerchantRequirementState = Omit<
  RefreshedMerchantRequirementState,
  "requirement" | "documents"
> & {
  readonly requirement: PublicMerchantOnboardingRequirementView;
  readonly documents: readonly PublicMerchantRequirementDocumentView[];
};

type PublicRefreshedMerchantOnboardingSessionState = Omit<
  RefreshedMerchantOnboardingSessionState,
  "requirements"
> & {
  readonly requirements: readonly PublicMerchantOnboardingRequirementView[];
};

export interface OnboardingHttpHandlers {
  submitMerchantOnboarding(
    request: HttpRequestEnvelope<SubmitMerchantOnboardingCommand>,
  ): Promise<HttpResponseEnvelope<PublicMerchantOnboardingSnapshot>>;
  getMerchantOnboardingSnapshot(
    request: HttpRequestEnvelope<GetMerchantOnboardingSnapshotQuery>,
  ): Promise<HttpResponseEnvelope<PublicMerchantOnboardingSnapshot | null>>;
  refreshMerchantOnboardingSession(
    request: HttpRequestEnvelope<RefreshMerchantOnboardingSessionCommand>,
  ): Promise<HttpResponseEnvelope<PublicRefreshedMerchantOnboardingSessionState | null>>;
  listMerchantRequirements(
    request: HttpRequestEnvelope<ListMerchantRequirementsQuery>,
  ): Promise<HttpResponseEnvelope<readonly PublicMerchantOnboardingRequirementView[]>>;
  listMerchantRequirementDocuments(
    request: HttpRequestEnvelope<ListMerchantRequirementDocumentsQuery>,
  ): Promise<HttpResponseEnvelope<readonly PublicMerchantRequirementDocumentView[]>>;
  refreshMerchantRequirement(
    request: HttpRequestEnvelope<RefreshMerchantRequirementCommand>,
  ): Promise<HttpResponseEnvelope<PublicRefreshedMerchantRequirementState | null>>;
  satisfyMerchantRequirements(
    request: HttpRequestEnvelope<SatisfyMerchantRequirementsCommand>,
  ): Promise<HttpResponseEnvelope<PublicMerchantOnboardingSnapshot>>;
  createRequirementUploadLink(
    request: HttpRequestEnvelope<CreateMerchantRequirementUploadLinkCommand>,
  ): Promise<HttpResponseEnvelope<MerchantRequirementUploadLink>>;
  getRequirementUploadStatus(
    request: HttpRequestEnvelope<GetMerchantRequirementUploadStatusQuery>,
  ): Promise<HttpResponseEnvelope<PublicMerchantRequirementUploadStatus | null>>;
}

export interface OnboardingHttpHandlerDependencies {
  readonly service: MerchantOnboardingService;
  readonly createRequestId?: () => string;
}

function createDefaultRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function toErrorResponse(error: unknown, requestId: string): HttpResponseEnvelope<never> {
  if (error instanceof MerchantOnboardingServiceError) {
    const status =
      error.code === "invalid_request"
        ? 400
        : error.code === "not_found"
          ? 404
          : error.code === "conflict"
            ? 409
            : error.code === "action_required"
              ? 422
              : error.code === "provider_unavailable"
                ? 503
                : 500;

    return {
      status,
      body: {
        code: error.code,
        category: "merchant_onboarding_service",
        message: error.message,
        actionRequired: error.code === "action_required",
        retryable: error.retryable,
        requestId,
      },
    };
  }

  return {
    status: 500,
    body: {
      code: "internal_error",
      category: "merchant_onboarding_service",
      message:
        error instanceof Error ? error.message : "unexpected merchant onboarding handler failure",
      requestId,
    },
  };
}

function toSuccessResponse<TBody>(
  data: TBody,
  requestId: string,
  status = 200,
): HttpResponseEnvelope<TBody> {
  return {
    status,
    body: {
      data,
      requestId,
    } as ApiSuccess<TBody>,
  };
}

async function handleOnboardingRequest<TCommand, TResult, TBody>(
  request: HttpRequestEnvelope<TCommand>,
  createRequestId: () => string,
  run: (command: TCommand) => Promise<TResult>,
  toPublicBody: (result: TResult) => TBody,
  status = 200,
): Promise<HttpResponseEnvelope<TBody>> {
  const requestId = request.requestId ?? createRequestId();
  try {
    const result = await run(request.body);
    return toSuccessResponse(toPublicBody(result), requestId, status);
  } catch (error) {
    return toErrorResponse(error, requestId);
  }
}

function toPublicRequirement(
  requirement: MerchantOnboardingRequirementView,
): PublicMerchantOnboardingRequirementView {
  const {
    sourceProvider: _sourceProvider,
    providerRequirementRef: _providerRequirementRef,
    ...publicRequirement
  } = requirement;
  if (_sourceProvider === "vortex") {
    const publicMetadata = toPublicMetadata(publicRequirement.metadata);
    const { metadata: _metadata, ...publicRequirementWithoutMetadata } = publicRequirement;
    return {
      ...publicRequirementWithoutMetadata,
      ...(publicMetadata ? { metadata: publicMetadata } : {}),
    };
  }
  const { description: _description, ...providerNeutralRequirement } = publicRequirement;
  const publicMetadata = toPublicMetadata(providerNeutralRequirement.metadata);
  const { metadata: _metadata, ...providerNeutralRequirementWithoutMetadata } =
    providerNeutralRequirement;
  return {
    ...providerNeutralRequirementWithoutMetadata,
    requirementId: toPublicRequirementId(providerNeutralRequirement.requirementId),
    requirementType: "onboarding_requirement",
    title: "Onboarding requirement pending",
    ...(publicMetadata ? { metadata: publicMetadata } : {}),
  };
}

function toPublicDocument(
  document: MerchantRequirementDocumentView,
): PublicMerchantRequirementDocumentView {
  const { provider: _provider, ...publicDocument } = document;
  return {
    ...publicDocument,
    requirementId: toPublicRequirementId(publicDocument.requirementId),
  };
}

function toPublicUploadStatus(
  status: MerchantRequirementUploadStatus,
): PublicMerchantRequirementUploadStatus {
  const { provider: _provider, ...publicStatus } = status;
  return {
    ...publicStatus,
    requirementId: toPublicRequirementId(publicStatus.requirementId),
  };
}

function toPublicUploadLink(link: MerchantRequirementUploadLink): MerchantRequirementUploadLink {
  return {
    ...link,
    requirementId: toPublicRequirementId(link.requirementId),
  };
}

function toPublicRequirementId(requirementId: string): string {
  return requirementId.replace(":provider_requirement:", ":onboarding_requirement:");
}

function toPublicMetadata(
  metadata: Readonly<Record<string, string>> | undefined,
): Readonly<Record<string, string>> | undefined {
  const metadataEntries = Object.entries(metadata ?? {}).filter(([key, value]) => {
    const normalizedKey = key.toLowerCase();
    const normalizedValue = value.toLowerCase();
    return (
      !normalizedKey.includes("provider") &&
      !normalizedKey.includes("processor") &&
      !normalizedValue.includes("provider") &&
      !normalizedValue.includes("processor") &&
      !normalizedValue.includes("finix")
    );
  });
  return metadataEntries.length > 0 ? Object.fromEntries(metadataEntries) : undefined;
}

function toPublicSnapshot(snapshot: MerchantOnboardingSnapshot): PublicMerchantOnboardingSnapshot {
  const publicMetadata = toPublicMetadata(snapshot.metadata);
  const { metadata: _metadata, ...snapshotWithoutMetadata } = snapshot;
  return {
    ...snapshotWithoutMetadata,
    requirementIds: snapshot.requirementIds.map(toPublicRequirementId),
    openRequirementIds: snapshot.openRequirementIds.map(toPublicRequirementId),
    ...(publicMetadata ? { metadata: publicMetadata } : {}),
  };
}

export function createOnboardingHttpHandlers(
  dependencies: OnboardingHttpHandlerDependencies,
): OnboardingHttpHandlers {
  const createRequestId = dependencies.createRequestId ?? createDefaultRequestId;
  const service = dependencies.service;

  return {
    async submitMerchantOnboarding(request) {
      return handleOnboardingRequest(
        request,
        createRequestId,
        (body) => service.submitMerchantOnboarding(body),
        toPublicSnapshot,
        202,
      );
    },

    async getMerchantOnboardingSnapshot(request) {
      return handleOnboardingRequest(
        request,
        createRequestId,
        (body) => service.getMerchantOnboardingSnapshot(body),
        (result) => (result === null ? null : toPublicSnapshot(result)),
      );
    },

    async refreshMerchantOnboardingSession(request) {
      return handleOnboardingRequest(
        request,
        createRequestId,
        (body) => service.refreshMerchantOnboardingSession(body),
        (result) =>
          result === null
            ? null
            : {
                ...result,
                snapshot: toPublicSnapshot(result.snapshot),
                requirements: result.requirements.map(toPublicRequirement),
              },
        202,
      );
    },

    async listMerchantRequirements(request) {
      return handleOnboardingRequest(
        request,
        createRequestId,
        (body) => service.listMerchantRequirements(body),
        (result) => result.map(toPublicRequirement),
      );
    },

    async listMerchantRequirementDocuments(request) {
      return handleOnboardingRequest(
        request,
        createRequestId,
        (body) => service.listMerchantRequirementDocuments(body),
        (result) => result.map(toPublicDocument),
      );
    },

    async satisfyMerchantRequirements(request) {
      return handleOnboardingRequest(
        request,
        createRequestId,
        (body) => service.satisfyMerchantRequirements(body),
        toPublicSnapshot,
        202,
      );
    },

    async refreshMerchantRequirement(request) {
      return handleOnboardingRequest(
        request,
        createRequestId,
        (body) => service.refreshMerchantRequirement(body),
        (result) =>
          result === null
            ? null
            : {
                ...result,
                requirement: toPublicRequirement(result.requirement),
                documents: result.documents.map(toPublicDocument),
              },
        202,
      );
    },

    async createRequirementUploadLink(request) {
      return handleOnboardingRequest(
        request,
        createRequestId,
        (body) => service.createRequirementUploadLink(body),
        toPublicUploadLink,
        201,
      );
    },

    async getRequirementUploadStatus(request) {
      return handleOnboardingRequest(
        request,
        createRequestId,
        (body) => service.getRequirementUploadStatus(body),
        (result) => (result === null ? null : toPublicUploadStatus(result)),
      );
    },
  };
}
