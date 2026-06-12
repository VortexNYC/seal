import type { ApiSuccess } from "../contract/common";
import type {
  GetMerchantPayoutQuery,
  GetMerchantSellerPayoutProfileQuery,
  GetSettlementFundingTimelineQuery,
  GetSettlementPayoutReadinessQuery,
  ListMerchantPayoutsQuery,
  MerchantPayoutDetail,
  MerchantPayoutList,
  MerchantSellerPayoutProfileDetail,
  SettlementFundingTimelineDetail,
  SettlementPayoutReadinessDetail,
} from "../../application/payouts/contracts";
import type { PayoutsService } from "../../application/payouts/service";
import type { HttpRequestEnvelope, HttpResponseEnvelope } from "./billing";

export interface PayoutsHttpHandlers {
  listMerchantPayouts(
    request: HttpRequestEnvelope<ListMerchantPayoutsQuery>,
  ): Promise<HttpResponseEnvelope<MerchantPayoutList>>;
  getMerchantPayout(
    request: HttpRequestEnvelope<GetMerchantPayoutQuery>,
  ): Promise<HttpResponseEnvelope<MerchantPayoutDetail>>;
  getMerchantSellerPayoutProfile(
    request: HttpRequestEnvelope<GetMerchantSellerPayoutProfileQuery>,
  ): Promise<HttpResponseEnvelope<MerchantSellerPayoutProfileDetail>>;
  getSettlementPayoutReadiness(
    request: HttpRequestEnvelope<GetSettlementPayoutReadinessQuery>,
  ): Promise<HttpResponseEnvelope<SettlementPayoutReadinessDetail>>;
  getSettlementFundingTimeline(
    request: HttpRequestEnvelope<GetSettlementFundingTimelineQuery>,
  ): Promise<HttpResponseEnvelope<SettlementFundingTimelineDetail>>;
}

export interface PayoutsHttpHandlerDependencies {
  readonly service: PayoutsService;
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

export function createPayoutsHttpHandlers(
  dependencies: PayoutsHttpHandlerDependencies,
): PayoutsHttpHandlers {
  const createRequestId = dependencies.createRequestId ?? createDefaultRequestId;

  return {
    async listMerchantPayouts(request) {
      const requestId = request.requestId ?? createRequestId();
      const result = await dependencies.service.listMerchantPayouts(request.body);
      return toSuccessResponse(result, requestId);
    },

    async getMerchantPayout(request) {
      const requestId = request.requestId ?? createRequestId();
      const result = await dependencies.service.getMerchantPayout(request.body);
      return toSuccessResponse(result, requestId);
    },

    async getMerchantSellerPayoutProfile(request) {
      const requestId = request.requestId ?? createRequestId();
      const result = await dependencies.service.getMerchantSellerPayoutProfile(request.body);
      return toSuccessResponse(result, requestId);
    },

    async getSettlementPayoutReadiness(request) {
      const requestId = request.requestId ?? createRequestId();
      const result = await dependencies.service.getSettlementPayoutReadiness(request.body);
      return toSuccessResponse(result, requestId);
    },

    async getSettlementFundingTimeline(request) {
      const requestId = request.requestId ?? createRequestId();
      const result = await dependencies.service.getSettlementFundingTimeline(request.body);
      return toSuccessResponse(result, requestId);
    },
  };
}
