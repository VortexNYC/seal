import type { ApiError, ApiSuccess } from "../contract/common";
import type {
  CollectInvoicePaymentCommand,
  CollectInvoicePaymentResult,
  GetCustomerPaymentMethodsQuery,
  GetMerchantReadinessQuery,
  MerchantReadinessSnapshot,
  ReconcileInvoicePaymentQuery,
  ReconcileInvoicePaymentResult,
  ReconcileInvoiceRefundQuery,
  ReconcileInvoiceRefundResult,
  RefundInvoicePaymentCommand,
  RefundInvoicePaymentResult,
  BillingCustomerPaymentMethodSummary,
} from "../../application/billing/contracts";
import type { BillingPaymentsService } from "../../application/billing/service";
import { BillingServiceError } from "../../application/billing/impl";

export interface HttpRequestEnvelope<TBody> {
  readonly body: TBody;
  readonly requestId?: string;
}

export type HttpResponseEnvelope<TBody> =
  | {
      readonly status: number;
      readonly body: ApiSuccess<TBody>;
    }
  | {
      readonly status: number;
      readonly body: ApiError;
    };

export interface BillingHttpHandlers {
  collectInvoicePayment(
    request: HttpRequestEnvelope<CollectInvoicePaymentCommand>,
  ): Promise<HttpResponseEnvelope<CollectInvoicePaymentResult>>;
  refundInvoicePayment(
    request: HttpRequestEnvelope<RefundInvoicePaymentCommand>,
  ): Promise<HttpResponseEnvelope<RefundInvoicePaymentResult>>;
  reconcileInvoicePayment(
    request: HttpRequestEnvelope<ReconcileInvoicePaymentQuery>,
  ): Promise<HttpResponseEnvelope<ReconcileInvoicePaymentResult | null>>;
  reconcileInvoiceRefund(
    request: HttpRequestEnvelope<ReconcileInvoiceRefundQuery>,
  ): Promise<HttpResponseEnvelope<ReconcileInvoiceRefundResult | null>>;
  getMerchantReadiness(
    request: HttpRequestEnvelope<GetMerchantReadinessQuery>,
  ): Promise<HttpResponseEnvelope<MerchantReadinessSnapshot | null>>;
  listCustomerPaymentMethods(
    request: HttpRequestEnvelope<GetCustomerPaymentMethodsQuery>,
  ): Promise<HttpResponseEnvelope<readonly BillingCustomerPaymentMethodSummary[]>>;
}

export interface BillingHttpHandlerDependencies {
  readonly service: BillingPaymentsService;
  readonly createRequestId?: () => string;
}

function createDefaultRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function toErrorResponse(error: unknown, requestId: string): HttpResponseEnvelope<never> {
  if (error instanceof BillingServiceError) {
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
        category: "billing_service",
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
      category: "billing_service",
      message: error instanceof Error ? error.message : "unexpected billing handler failure",
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
    },
  };
}

export function createBillingHttpHandlers(
  dependencies: BillingHttpHandlerDependencies,
): BillingHttpHandlers {
  const createRequestId = dependencies.createRequestId ?? createDefaultRequestId;

  return {
    async collectInvoicePayment(request) {
      const requestId = request.requestId ?? createRequestId();
      try {
        const result = await dependencies.service.collectInvoicePayment(request.body);
        return toSuccessResponse(result, requestId);
      } catch (error) {
        return toErrorResponse(error, requestId);
      }
    },

    async refundInvoicePayment(request) {
      const requestId = request.requestId ?? createRequestId();
      try {
        const result = await dependencies.service.refundInvoicePayment(request.body);
        return toSuccessResponse(result, requestId);
      } catch (error) {
        return toErrorResponse(error, requestId);
      }
    },

    async reconcileInvoicePayment(request) {
      const requestId = request.requestId ?? createRequestId();
      try {
        const result = await dependencies.service.reconcileInvoicePayment(request.body);
        return toSuccessResponse(result, requestId);
      } catch (error) {
        return toErrorResponse(error, requestId);
      }
    },

    async reconcileInvoiceRefund(request) {
      const requestId = request.requestId ?? createRequestId();
      try {
        const result = await dependencies.service.reconcileInvoiceRefund(request.body);
        return toSuccessResponse(result, requestId);
      } catch (error) {
        return toErrorResponse(error, requestId);
      }
    },

    async getMerchantReadiness(request) {
      const requestId = request.requestId ?? createRequestId();
      try {
        const result = await dependencies.service.getMerchantReadiness(request.body);
        return toSuccessResponse(result, requestId);
      } catch (error) {
        return toErrorResponse(error, requestId);
      }
    },

    async listCustomerPaymentMethods(request) {
      const requestId = request.requestId ?? createRequestId();
      try {
        const result = await dependencies.service.listCustomerPaymentMethods(request.body);
        return toSuccessResponse(result, requestId);
      } catch (error) {
        return toErrorResponse(error, requestId);
      }
    },
  };
}
