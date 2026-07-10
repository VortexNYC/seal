import type { ApiSuccess } from "../contract/common";
import type {
  CancelPaymentHardwareOrderCommand,
  CreatePaymentHardwareOrderCommand,
  GetPaymentHardwareOrderQuery,
  ListPaymentHardwareOrdersQuery,
  ListPaymentHardwareSkusQuery,
  PaymentHardwareOrderPreview,
  PaymentHardwareOrderSnapshot,
  PaymentHardwareReturnSnapshot,
  PaymentHardwareSkuSnapshot,
  PreviewPaymentHardwareOrderCommand,
  RequestPaymentHardwareReturnCommand,
  UpsertPaymentHardwareSkuCommand,
} from "../../application/hardware/contracts";
import { PaymentHardwareServiceError } from "../../application/hardware/impl";
import type { PaymentHardwareService } from "../../application/hardware/service";
import type { HttpRequestEnvelope, HttpResponseEnvelope } from "./billing";

export interface PaymentHardwareHttpHandlers {
  upsertSku(
    request: HttpRequestEnvelope<UpsertPaymentHardwareSkuCommand>,
  ): Promise<HttpResponseEnvelope<PaymentHardwareSkuSnapshot>>;
  listSkus(
    request: HttpRequestEnvelope<ListPaymentHardwareSkusQuery>,
  ): Promise<HttpResponseEnvelope<readonly PaymentHardwareSkuSnapshot[]>>;
  previewOrder(
    request: HttpRequestEnvelope<PreviewPaymentHardwareOrderCommand>,
  ): Promise<HttpResponseEnvelope<PaymentHardwareOrderPreview>>;
  createOrder(
    request: HttpRequestEnvelope<CreatePaymentHardwareOrderCommand>,
  ): Promise<HttpResponseEnvelope<PaymentHardwareOrderSnapshot>>;
  getOrder(
    request: HttpRequestEnvelope<GetPaymentHardwareOrderQuery>,
  ): Promise<HttpResponseEnvelope<PaymentHardwareOrderSnapshot | null>>;
  listOrders(
    request: HttpRequestEnvelope<ListPaymentHardwareOrdersQuery>,
  ): Promise<HttpResponseEnvelope<readonly PaymentHardwareOrderSnapshot[]>>;
  cancelOrder(
    request: HttpRequestEnvelope<CancelPaymentHardwareOrderCommand>,
  ): Promise<HttpResponseEnvelope<PaymentHardwareOrderSnapshot>>;
  requestReturn(
    request: HttpRequestEnvelope<RequestPaymentHardwareReturnCommand>,
  ): Promise<HttpResponseEnvelope<PaymentHardwareReturnSnapshot>>;
}

export interface PaymentHardwareHttpHandlerDependencies {
  readonly service: PaymentHardwareService;
  readonly createRequestId?: () => string;
}

function createDefaultRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function toErrorResponse(error: unknown, requestId: string): HttpResponseEnvelope<never> {
  if (error instanceof PaymentHardwareServiceError) {
    const status =
      error.code === "invalid_request"
        ? 400
        : error.code === "not_found"
          ? 404
          : error.code === "conflict"
            ? 409
            : error.code === "action_required"
              ? 422
              : 500;
    return {
      status,
      body: {
        code: error.code,
        category: "payment_hardware_service",
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
      category: "payment_hardware_service",
      message:
        error instanceof Error ? error.message : "unexpected payment hardware handler failure",
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

export function createPaymentHardwareHttpHandlers(
  dependencies: PaymentHardwareHttpHandlerDependencies,
): PaymentHardwareHttpHandlers {
  const createRequestId = dependencies.createRequestId ?? createDefaultRequestId;
  return {
    async upsertSku(request) {
      const requestId = request.requestId ?? createRequestId();
      try {
        return toSuccessResponse(
          await dependencies.service.upsertSku(request.body),
          requestId,
          201,
        );
      } catch (error) {
        return toErrorResponse(error, requestId);
      }
    },
    async listSkus(request) {
      const requestId = request.requestId ?? createRequestId();
      try {
        return toSuccessResponse(await dependencies.service.listSkus(request.body), requestId);
      } catch (error) {
        return toErrorResponse(error, requestId);
      }
    },
    async previewOrder(request) {
      const requestId = request.requestId ?? createRequestId();
      try {
        return toSuccessResponse(await dependencies.service.previewOrder(request.body), requestId);
      } catch (error) {
        return toErrorResponse(error, requestId);
      }
    },
    async createOrder(request) {
      const requestId = request.requestId ?? createRequestId();
      try {
        return toSuccessResponse(
          await dependencies.service.createOrder(request.body),
          requestId,
          201,
        );
      } catch (error) {
        return toErrorResponse(error, requestId);
      }
    },
    async getOrder(request) {
      const requestId = request.requestId ?? createRequestId();
      try {
        return toSuccessResponse(await dependencies.service.getOrder(request.body), requestId);
      } catch (error) {
        return toErrorResponse(error, requestId);
      }
    },
    async listOrders(request) {
      const requestId = request.requestId ?? createRequestId();
      try {
        return toSuccessResponse(await dependencies.service.listOrders(request.body), requestId);
      } catch (error) {
        return toErrorResponse(error, requestId);
      }
    },
    async cancelOrder(request) {
      const requestId = request.requestId ?? createRequestId();
      try {
        return toSuccessResponse(await dependencies.service.cancelOrder(request.body), requestId);
      } catch (error) {
        return toErrorResponse(error, requestId);
      }
    },
    async requestReturn(request) {
      const requestId = request.requestId ?? createRequestId();
      try {
        return toSuccessResponse(
          await dependencies.service.requestReturn(request.body),
          requestId,
          201,
        );
      } catch (error) {
        return toErrorResponse(error, requestId);
      }
    },
  };
}
