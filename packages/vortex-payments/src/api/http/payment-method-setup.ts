import type { ApiSuccess } from "../contract/common";
import type {
  CreatePaymentMethodFromSetupCommand,
  CreatePaymentMethodSetupSessionCommand,
  CreatedPaymentMethodSnapshot,
  PaymentMethodSetupSessionSnapshot,
} from "../../application/payment-method-setup/contracts";
import type { PaymentMethodSetupService } from "../../application/payment-method-setup/service";
import { PaymentMethodSetupServiceError } from "../../application/payment-method-setup/impl";
import type { HttpRequestEnvelope, HttpResponseEnvelope } from "./billing";

export interface PaymentMethodSetupHttpHandlers {
  createPaymentMethodSetupSession(
    request: HttpRequestEnvelope<CreatePaymentMethodSetupSessionCommand>,
  ): Promise<HttpResponseEnvelope<PaymentMethodSetupSessionSnapshot>>;
  createPaymentMethod(
    request: HttpRequestEnvelope<CreatePaymentMethodFromSetupCommand>,
  ): Promise<HttpResponseEnvelope<CreatedPaymentMethodSnapshot>>;
}

export interface PaymentMethodSetupHttpHandlerDependencies {
  readonly service: PaymentMethodSetupService;
  readonly createRequestId?: () => string;
}

function createDefaultRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function toErrorResponse(error: unknown, requestId: string): HttpResponseEnvelope<never> {
  if (error instanceof PaymentMethodSetupServiceError) {
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
        category: "payment_method_setup_service",
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
      category: "payment_method_setup_service",
      message:
        error instanceof Error ? error.message : "unexpected payment method setup handler failure",
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

export function createPaymentMethodSetupHttpHandlers(
  dependencies: PaymentMethodSetupHttpHandlerDependencies,
): PaymentMethodSetupHttpHandlers {
  const createRequestId = dependencies.createRequestId ?? createDefaultRequestId;

  return {
    async createPaymentMethodSetupSession(request) {
      const requestId = request.requestId ?? createRequestId();
      try {
        const result = await dependencies.service.createPaymentMethodSetupSession(request.body);
        return toSuccessResponse(result, requestId, 201);
      } catch (error) {
        return toErrorResponse(error, requestId);
      }
    },

    async createPaymentMethod(request) {
      const requestId = request.requestId ?? createRequestId();
      try {
        const result = await dependencies.service.createPaymentMethodFromSetup(request.body);
        return toSuccessResponse(result, requestId, 201);
      } catch (error) {
        return toErrorResponse(error, requestId);
      }
    },
  };
}
