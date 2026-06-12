import type { ApiSuccess } from "../contract/common";
import type {
  CreateCustomerProfileCommand,
  CustomerProfileSnapshot,
  GetCustomerProfileQuery,
  UpdateCustomerProfileCommand,
} from "../../application/customers/contracts";
import type { CustomersService } from "../../application/customers/service";
import { CustomersServiceError } from "../../application/customers/impl";
import type { HttpRequestEnvelope, HttpResponseEnvelope } from "./billing";

export interface CustomersHttpHandlers {
  createCustomerProfile(
    request: HttpRequestEnvelope<CreateCustomerProfileCommand>,
  ): Promise<HttpResponseEnvelope<CustomerProfileSnapshot>>;
  getCustomerProfile(
    request: HttpRequestEnvelope<GetCustomerProfileQuery>,
  ): Promise<HttpResponseEnvelope<CustomerProfileSnapshot | null>>;
  updateCustomerProfile(
    request: HttpRequestEnvelope<UpdateCustomerProfileCommand>,
  ): Promise<HttpResponseEnvelope<CustomerProfileSnapshot>>;
}

export interface CustomersHttpHandlerDependencies {
  readonly service: CustomersService;
  readonly createRequestId?: () => string;
}

function createDefaultRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function toErrorResponse(error: unknown, requestId: string): HttpResponseEnvelope<never> {
  if (error instanceof CustomersServiceError) {
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
        category: "customers_service",
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
      category: "customers_service",
      message: error instanceof Error ? error.message : "unexpected customers handler failure",
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

export function createCustomersHttpHandlers(
  dependencies: CustomersHttpHandlerDependencies,
): CustomersHttpHandlers {
  const createRequestId = dependencies.createRequestId ?? createDefaultRequestId;

  return {
    async createCustomerProfile(request) {
      const requestId = request.requestId ?? createRequestId();
      try {
        const result = await dependencies.service.createCustomerProfile(request.body);
        return toSuccessResponse(result, requestId, 201);
      } catch (error) {
        return toErrorResponse(error, requestId);
      }
    },

    async getCustomerProfile(request) {
      const requestId = request.requestId ?? createRequestId();
      try {
        const result = await dependencies.service.getCustomerProfile(request.body);
        return toSuccessResponse(result, requestId);
      } catch (error) {
        return toErrorResponse(error, requestId);
      }
    },

    async updateCustomerProfile(request) {
      const requestId = request.requestId ?? createRequestId();
      try {
        const result = await dependencies.service.updateCustomerProfile(request.body);
        return toSuccessResponse(result, requestId);
      } catch (error) {
        return toErrorResponse(error, requestId);
      }
    },
  };
}
