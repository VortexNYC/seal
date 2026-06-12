import type { ApiSuccess } from "../contract/common";
import type {
  IngestProviderWebhookCommand,
  WebhookIngestionResult,
} from "../../application/webhooks/contracts";
import type { WebhooksService } from "../../application/webhooks/service";
import { WebhooksServiceError } from "../../application/webhooks/impl";
import type { HttpRequestEnvelope, HttpResponseEnvelope } from "./billing";

export interface WebhooksHttpHandlers {
  ingestProviderWebhook(
    request: HttpRequestEnvelope<IngestProviderWebhookCommand>,
  ): Promise<HttpResponseEnvelope<WebhookIngestionResult>>;
}

export interface WebhooksHttpHandlerDependencies {
  readonly service: WebhooksService;
  readonly createRequestId?: () => string;
}

function createDefaultRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function toErrorResponse(error: unknown, requestId: string): HttpResponseEnvelope<never> {
  if (error instanceof WebhooksServiceError) {
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
        category: "webhooks_service",
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
      category: "webhooks_service",
      message: error instanceof Error ? error.message : "unexpected webhook handler failure",
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

export function createWebhooksHttpHandlers(
  dependencies: WebhooksHttpHandlerDependencies,
): WebhooksHttpHandlers {
  const createRequestId = dependencies.createRequestId ?? createDefaultRequestId;

  return {
    async ingestProviderWebhook(request) {
      const requestId = request.requestId ?? createRequestId();
      try {
        const result = await dependencies.service.ingestProviderWebhook(request.body);
        return toSuccessResponse(result, requestId, result.accepted ? 202 : 200);
      } catch (error) {
        return toErrorResponse(error, requestId);
      }
    },
  };
}
