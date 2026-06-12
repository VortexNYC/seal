import type { ApiSuccess } from "../contract/common";
import type {
  ArchivePaymentMethodCommand,
  CustomerPaymentStateSnapshot,
  DisablePaymentMethodCommand,
  GetCustomerPaymentMethodQuery,
  ListCustomerPaymentMethodsQuery,
  PaymentMethodSnapshot,
  SetDefaultCustomerPaymentMethodCommand,
} from "../../application/payment-methods/contracts";
import type { PaymentMethodsService } from "../../application/payment-methods/service";
import { PaymentMethodsServiceError } from "../../application/payment-methods/impl";
import type { HttpRequestEnvelope, HttpResponseEnvelope } from "./billing";

export interface PaymentMethodsHttpHandlers {
  listCustomerPaymentMethods(
    request: HttpRequestEnvelope<ListCustomerPaymentMethodsQuery>,
  ): Promise<HttpResponseEnvelope<readonly PaymentMethodSnapshot[]>>;
  getCustomerPaymentMethod(
    request: HttpRequestEnvelope<GetCustomerPaymentMethodQuery>,
  ): Promise<HttpResponseEnvelope<PaymentMethodSnapshot | null>>;
  setDefaultCustomerPaymentMethod(
    request: HttpRequestEnvelope<SetDefaultCustomerPaymentMethodCommand>,
  ): Promise<HttpResponseEnvelope<readonly PaymentMethodSnapshot[]>>;
  archivePaymentMethod(
    request: HttpRequestEnvelope<ArchivePaymentMethodCommand>,
  ): Promise<HttpResponseEnvelope<PaymentMethodSnapshot>>;
  disablePaymentMethod(
    request: HttpRequestEnvelope<DisablePaymentMethodCommand>,
  ): Promise<HttpResponseEnvelope<PaymentMethodSnapshot>>;
  getCustomerPaymentState(
    request: HttpRequestEnvelope<ListCustomerPaymentMethodsQuery>,
  ): Promise<HttpResponseEnvelope<CustomerPaymentStateSnapshot>>;
}

export interface PaymentMethodsHttpHandlerDependencies {
  readonly service: PaymentMethodsService;
  readonly createRequestId?: () => string;
}

function createDefaultRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function toErrorResponse(error: unknown, requestId: string): HttpResponseEnvelope<never> {
  if (error instanceof PaymentMethodsServiceError) {
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
        category: "payment_methods_service",
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
      category: "payment_methods_service",
      message: error instanceof Error ? error.message : "unexpected payment methods handler failure",
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

export function createPaymentMethodsHttpHandlers(
  dependencies: PaymentMethodsHttpHandlerDependencies,
): PaymentMethodsHttpHandlers {
  const createRequestId = dependencies.createRequestId ?? createDefaultRequestId;

  return {
    async listCustomerPaymentMethods(request) {
      const requestId = request.requestId ?? createRequestId();
      try {
        const result = await dependencies.service.listCustomerPaymentMethods(request.body);
        return toSuccessResponse(result, requestId);
      } catch (error) {
        return toErrorResponse(error, requestId);
      }
    },

    async getCustomerPaymentMethod(request) {
      const requestId = request.requestId ?? createRequestId();
      try {
        const result = await dependencies.service.getCustomerPaymentMethod(request.body);
        return toSuccessResponse(result, requestId);
      } catch (error) {
        return toErrorResponse(error, requestId);
      }
    },

    async setDefaultCustomerPaymentMethod(request) {
      const requestId = request.requestId ?? createRequestId();
      try {
        const result = await dependencies.service.setDefaultCustomerPaymentMethod(request.body);
        return toSuccessResponse(result, requestId);
      } catch (error) {
        return toErrorResponse(error, requestId);
      }
    },

    async archivePaymentMethod(request) {
      const requestId = request.requestId ?? createRequestId();
      try {
        const result = await dependencies.service.archivePaymentMethod(request.body);
        return toSuccessResponse(result, requestId);
      } catch (error) {
        return toErrorResponse(error, requestId);
      }
    },

    async disablePaymentMethod(request) {
      const requestId = request.requestId ?? createRequestId();
      try {
        const result = await dependencies.service.disablePaymentMethod(request.body);
        return toSuccessResponse(result, requestId);
      } catch (error) {
        return toErrorResponse(error, requestId);
      }
    },

    async getCustomerPaymentState(request) {
      const requestId = request.requestId ?? createRequestId();
      try {
        const result = await dependencies.service.getCustomerPaymentState(request.body);
        return toSuccessResponse(result, requestId);
      } catch (error) {
        return toErrorResponse(error, requestId);
      }
    },
  };
}
