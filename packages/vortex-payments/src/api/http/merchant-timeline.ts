import type { ApiSuccess } from "../contract/common";
import type {
  ListMerchantTimelineQuery,
  MerchantTimelineList,
} from "../../application/merchant-timeline/contracts";
import type { MerchantTimelineService } from "../../application/merchant-timeline/service";
import { MerchantTimelineServiceError } from "../../application/merchant-timeline/impl";
import type { HttpRequestEnvelope, HttpResponseEnvelope } from "./billing";

export interface MerchantTimelineHttpHandlers {
  listMerchantTimeline(
    request: HttpRequestEnvelope<ListMerchantTimelineQuery>,
  ): Promise<HttpResponseEnvelope<MerchantTimelineList>>;
}

export interface MerchantTimelineHttpHandlerDependencies {
  readonly service: MerchantTimelineService;
  readonly createRequestId?: () => string;
}

function createDefaultRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
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

function toErrorResponse(error: unknown, requestId: string): HttpResponseEnvelope<never> {
  if (error instanceof MerchantTimelineServiceError) {
    return {
      status: 404,
      body: {
        code: error.code,
        category: "merchant_timeline_service",
        message: error.message,
        requestId,
      },
    };
  }

  return {
    status: 500,
    body: {
      code: "internal_error",
      category: "merchant_timeline_service",
      message: error instanceof Error ? error.message : "unexpected merchant timeline handler failure",
      requestId,
    },
  };
}

export function createMerchantTimelineHttpHandlers(
  dependencies: MerchantTimelineHttpHandlerDependencies,
): MerchantTimelineHttpHandlers {
  const createRequestId = dependencies.createRequestId ?? createDefaultRequestId;

  return {
    async listMerchantTimeline(request) {
      const requestId = request.requestId ?? createRequestId();
      try {
        const result = await dependencies.service.listMerchantTimeline(request.body);
        return toSuccessResponse(result, requestId);
      } catch (error) {
        return toErrorResponse(error, requestId);
      }
    },
  };
}
