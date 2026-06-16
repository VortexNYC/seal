import type { ApiSuccess } from "../contract/common";
import type {
  AcceptDisputeCommand,
  CreateDisputeEvidenceCommand,
  DisputeAdjustmentTransferList,
  DisputeEvidenceActionResult,
  DisputeEvidenceList,
  DisputeProviderActionResult,
  GetDisputeEvidenceQuery,
  GetMerchantDisputeQuery,
  ListDisputeAdjustmentTransfersQuery,
  ListDisputeEvidenceQuery,
  ListMerchantDisputesQuery,
  MerchantDisputeDetail,
  MerchantDisputeList,
  SubmitDisputeEvidenceCommand,
} from "../../application/disputes/contracts";
import { DisputesServiceError } from "../../application/disputes/impl";
import type { DisputesService } from "../../application/disputes/service";
import type { HttpRequestEnvelope, HttpResponseEnvelope } from "./billing";

export interface DisputesHttpHandlers {
  listMerchantDisputes(
    request: HttpRequestEnvelope<ListMerchantDisputesQuery>,
  ): Promise<HttpResponseEnvelope<MerchantDisputeList>>;
  getMerchantDispute(
    request: HttpRequestEnvelope<GetMerchantDisputeQuery>,
  ): Promise<HttpResponseEnvelope<MerchantDisputeDetail>>;
  acceptDispute(
    request: HttpRequestEnvelope<AcceptDisputeCommand>,
  ): Promise<HttpResponseEnvelope<DisputeProviderActionResult>>;
  createDisputeEvidence(
    request: HttpRequestEnvelope<CreateDisputeEvidenceCommand>,
  ): Promise<HttpResponseEnvelope<DisputeEvidenceActionResult>>;
  getDisputeEvidence(
    request: HttpRequestEnvelope<GetDisputeEvidenceQuery>,
  ): Promise<HttpResponseEnvelope<DisputeEvidenceActionResult>>;
  listDisputeEvidence(
    request: HttpRequestEnvelope<ListDisputeEvidenceQuery>,
  ): Promise<HttpResponseEnvelope<DisputeEvidenceList>>;
  submitDisputeEvidence(
    request: HttpRequestEnvelope<SubmitDisputeEvidenceCommand>,
  ): Promise<HttpResponseEnvelope<DisputeEvidenceActionResult>>;
  listDisputeAdjustmentTransfers(
    request: HttpRequestEnvelope<ListDisputeAdjustmentTransfersQuery>,
  ): Promise<HttpResponseEnvelope<DisputeAdjustmentTransferList>>;
}

export interface DisputesHttpHandlerDependencies {
  readonly service: DisputesService;
  readonly createRequestId?: () => string;
}

function createDefaultRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function toErrorResponse(error: unknown, requestId: string): HttpResponseEnvelope<never> {
  if (error instanceof DisputesServiceError) {
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
        category: "disputes_service",
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
      category: "disputes_service",
      message: error instanceof Error ? error.message : "unexpected disputes handler failure",
      requestId,
    },
  };
}

function toSuccessResponse<TBody>(data: TBody, requestId: string, status = 200): HttpResponseEnvelope<TBody> {
  return {
    status,
    body: {
      data,
      requestId,
    } as ApiSuccess<TBody>,
  };
}

export function createDisputesHttpHandlers(
  dependencies: DisputesHttpHandlerDependencies,
): DisputesHttpHandlers {
  const createRequestId = dependencies.createRequestId ?? createDefaultRequestId;

  return {
    async listMerchantDisputes(request) {
      const requestId = request.requestId ?? createRequestId();
      try {
        const result = await dependencies.service.listMerchantDisputes(request.body);
        return toSuccessResponse(result, requestId);
      } catch (error) {
        return toErrorResponse(error, requestId);
      }
    },

    async getMerchantDispute(request) {
      const requestId = request.requestId ?? createRequestId();
      try {
        const result = await dependencies.service.getMerchantDispute(request.body);
        return toSuccessResponse(result, requestId);
      } catch (error) {
        return toErrorResponse(error, requestId);
      }
    },

    async acceptDispute(request) {
      const requestId = request.requestId ?? createRequestId();
      try {
        const result = await dependencies.service.acceptDispute(request.body);
        return toSuccessResponse(result, requestId);
      } catch (error) {
        return toErrorResponse(error, requestId);
      }
    },

    async createDisputeEvidence(request) {
      const requestId = request.requestId ?? createRequestId();
      try {
        const result = await dependencies.service.createDisputeEvidence(request.body);
        return toSuccessResponse(result, requestId, 201);
      } catch (error) {
        return toErrorResponse(error, requestId);
      }
    },

    async getDisputeEvidence(request) {
      const requestId = request.requestId ?? createRequestId();
      try {
        const result = await dependencies.service.getDisputeEvidence(request.body);
        return toSuccessResponse(result, requestId);
      } catch (error) {
        return toErrorResponse(error, requestId);
      }
    },

    async listDisputeEvidence(request) {
      const requestId = request.requestId ?? createRequestId();
      try {
        const result = await dependencies.service.listDisputeEvidence(request.body);
        return toSuccessResponse(result, requestId);
      } catch (error) {
        return toErrorResponse(error, requestId);
      }
    },

    async submitDisputeEvidence(request) {
      const requestId = request.requestId ?? createRequestId();
      try {
        const result = await dependencies.service.submitDisputeEvidence(request.body);
        return toSuccessResponse(result, requestId);
      } catch (error) {
        return toErrorResponse(error, requestId);
      }
    },

    async listDisputeAdjustmentTransfers(request) {
      const requestId = request.requestId ?? createRequestId();
      try {
        const result = await dependencies.service.listDisputeAdjustmentTransfers(request.body);
        return toSuccessResponse(result, requestId);
      } catch (error) {
        return toErrorResponse(error, requestId);
      }
    },
  };
}
