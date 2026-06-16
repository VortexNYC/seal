import type { ApiSuccess } from "../contract/common";
import type {
  CancelPaymentIntentCommand,
  CapturePaymentIntentCommand,
  CreatePaymentIntentCommand,
  GetPaymentIntentQuery,
  ListPaymentIntentsQuery,
  PaymentIntentSnapshot,
  RetryPaymentIntentCommand,
} from "../../application/payments/contracts";
import type { PaymentsService } from "../../application/payments/service";
import { PaymentsServiceError } from "../../application/payments/impl";
import type { HttpRequestEnvelope, HttpResponseEnvelope } from "./billing";

export interface PaymentIntentsHttpHandlers {
  createPaymentIntent(
    request: HttpRequestEnvelope<CreatePaymentIntentCommand>,
  ): Promise<HttpResponseEnvelope<PaymentIntentSnapshot>>;
  getPaymentIntent(
    request: HttpRequestEnvelope<GetPaymentIntentQuery>,
  ): Promise<HttpResponseEnvelope<PaymentIntentSnapshot | null>>;
  listPaymentIntents(
    request: HttpRequestEnvelope<ListPaymentIntentsQuery>,
  ): Promise<HttpResponseEnvelope<readonly PaymentIntentSnapshot[]>>;
  capturePaymentIntent(
    request: HttpRequestEnvelope<CapturePaymentIntentCommand>,
  ): Promise<HttpResponseEnvelope<PaymentIntentSnapshot>>;
  cancelPaymentIntent(
    request: HttpRequestEnvelope<CancelPaymentIntentCommand>,
  ): Promise<HttpResponseEnvelope<PaymentIntentSnapshot>>;
  retryPaymentIntent(
    request: HttpRequestEnvelope<RetryPaymentIntentCommand>,
  ): Promise<HttpResponseEnvelope<PaymentIntentSnapshot>>;
}

export interface PaymentIntentsHttpHandlerDependencies {
  readonly service: PaymentsService;
  readonly createRequestId?: () => string;
}

function createDefaultRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function toErrorResponse(error: unknown, requestId: string): HttpResponseEnvelope<never> {
  if (error instanceof PaymentsServiceError) {
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
        category: "payments_service",
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
      category: "payments_service",
      message: error instanceof Error ? error.message : "unexpected payment intent handler failure",
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

export function createPaymentIntentsHttpHandlers(
  dependencies: PaymentIntentsHttpHandlerDependencies,
): PaymentIntentsHttpHandlers {
  const createRequestId = dependencies.createRequestId ?? createDefaultRequestId;

  return {
    async createPaymentIntent(request) {
      const requestId = request.requestId ?? createRequestId();
      try {
        const result = await dependencies.service.createPaymentIntent(request.body);
        return toSuccessResponse(result, requestId, 201);
      } catch (error) {
        return toErrorResponse(error, requestId);
      }
    },

    async getPaymentIntent(request) {
      const requestId = request.requestId ?? createRequestId();
      try {
        const result = await dependencies.service.getPaymentIntent(request.body);
        return toSuccessResponse(result, requestId);
      } catch (error) {
        return toErrorResponse(error, requestId);
      }
    },

    async listPaymentIntents(request) {
      const requestId = request.requestId ?? createRequestId();
      try {
        const result = await dependencies.service.listPaymentIntents(request.body);
        return toSuccessResponse(result, requestId);
      } catch (error) {
        return toErrorResponse(error, requestId);
      }
    },

    async capturePaymentIntent(request) {
      const requestId = request.requestId ?? createRequestId();
      try {
        const result = await dependencies.service.capturePaymentIntent(request.body);
        return toSuccessResponse(result, requestId, 202);
      } catch (error) {
        return toErrorResponse(error, requestId);
      }
    },

    async cancelPaymentIntent(request) {
      const requestId = request.requestId ?? createRequestId();
      try {
        const result = await dependencies.service.cancelPaymentIntent(request.body);
        return toSuccessResponse(result, requestId, 202);
      } catch (error) {
        return toErrorResponse(error, requestId);
      }
    },

    async retryPaymentIntent(request) {
      const requestId = request.requestId ?? createRequestId();
      try {
        const result = await dependencies.service.retryPaymentIntent(request.body);
        return toSuccessResponse(result, requestId, 202);
      } catch (error) {
        return toErrorResponse(error, requestId);
      }
    },
  };
}
