import type { ApiSuccess } from "../contract/common";
import type {
  CreateMerchantAccountCommand,
  GetMerchantAccountQuery,
  ListMerchantAccountsQuery,
  MerchantAccountList,
  MerchantAccountSnapshot,
  UpdateMerchantAccountCommand,
} from "../../application/merchant-accounts/contracts";
import type { MerchantAccountsService } from "../../application/merchant-accounts/service";
import { MerchantAccountsServiceError } from "../../application/merchant-accounts/impl";
import type { HttpRequestEnvelope, HttpResponseEnvelope } from "./billing";

export interface MerchantAccountsHttpHandlers {
  createMerchantAccount(
    request: HttpRequestEnvelope<CreateMerchantAccountCommand>,
  ): Promise<HttpResponseEnvelope<MerchantAccountSnapshot>>;
  listMerchantAccounts(
    request: HttpRequestEnvelope<ListMerchantAccountsQuery>,
  ): Promise<HttpResponseEnvelope<MerchantAccountList>>;
  getMerchantAccount(
    request: HttpRequestEnvelope<GetMerchantAccountQuery>,
  ): Promise<HttpResponseEnvelope<MerchantAccountSnapshot | null>>;
  updateMerchantAccount(
    request: HttpRequestEnvelope<UpdateMerchantAccountCommand>,
  ): Promise<HttpResponseEnvelope<MerchantAccountSnapshot>>;
}

export interface MerchantAccountsHttpHandlerDependencies {
  readonly service: MerchantAccountsService;
  readonly createRequestId?: () => string;
}

function createDefaultRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function toErrorResponse(error: unknown, requestId: string): HttpResponseEnvelope<never> {
  if (error instanceof MerchantAccountsServiceError) {
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
        category: "merchant_accounts_service",
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
      category: "merchant_accounts_service",
      message: error instanceof Error ? error.message : "unexpected merchant accounts handler failure",
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

export function createMerchantAccountsHttpHandlers(
  dependencies: MerchantAccountsHttpHandlerDependencies,
): MerchantAccountsHttpHandlers {
  const createRequestId = dependencies.createRequestId ?? createDefaultRequestId;

  return {
    async createMerchantAccount(request) {
      const requestId = request.requestId ?? createRequestId();
      try {
        const result = await dependencies.service.createMerchantAccount(request.body);
        return toSuccessResponse(result, requestId, 201);
      } catch (error) {
        return toErrorResponse(error, requestId);
      }
    },

    async listMerchantAccounts(request) {
      const requestId = request.requestId ?? createRequestId();
      try {
        const result = await dependencies.service.listMerchantAccounts(request.body);
        return toSuccessResponse(result, requestId);
      } catch (error) {
        return toErrorResponse(error, requestId);
      }
    },

    async getMerchantAccount(request) {
      const requestId = request.requestId ?? createRequestId();
      try {
        const result = await dependencies.service.getMerchantAccount(request.body);
        return toSuccessResponse(result, requestId);
      } catch (error) {
        return toErrorResponse(error, requestId);
      }
    },

    async updateMerchantAccount(request) {
      const requestId = request.requestId ?? createRequestId();
      try {
        const result = await dependencies.service.updateMerchantAccount(request.body);
        return toSuccessResponse(result, requestId);
      } catch (error) {
        return toErrorResponse(error, requestId);
      }
    },
  };
}
