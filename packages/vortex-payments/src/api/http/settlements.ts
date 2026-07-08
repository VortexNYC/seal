import type { ApiSuccess } from "../contract/common";
import type {
  GetMerchantSettlementQuery,
  ListMerchantSettlementsQuery,
  MerchantSettlementDetail,
  MerchantSettlementList,
} from "../../application/settlements/contracts";
import type { SettlementsService } from "../../application/settlements/service";
import type { HttpRequestEnvelope, HttpResponseEnvelope } from "./billing";

export interface SettlementsHttpHandlers {
  listMerchantSettlements(
    request: HttpRequestEnvelope<ListMerchantSettlementsQuery>,
  ): Promise<HttpResponseEnvelope<MerchantSettlementList>>;
  getMerchantSettlement(
    request: HttpRequestEnvelope<GetMerchantSettlementQuery>,
  ): Promise<HttpResponseEnvelope<MerchantSettlementDetail>>;
}

export interface SettlementsHttpHandlerDependencies {
  readonly service: SettlementsService;
  readonly createRequestId?: () => string;
}

function createDefaultRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
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

export function createSettlementsHttpHandlers(
  dependencies: SettlementsHttpHandlerDependencies,
): SettlementsHttpHandlers {
  const createRequestId = dependencies.createRequestId ?? createDefaultRequestId;

  return {
    async listMerchantSettlements(request) {
      const requestId = request.requestId ?? createRequestId();
      const result = await dependencies.service.listMerchantSettlements(request.body);
      return toSuccessResponse(result, requestId);
    },

    async getMerchantSettlement(request) {
      const requestId = request.requestId ?? createRequestId();
      const result = await dependencies.service.getMerchantSettlement(request.body);
      return toSuccessResponse(result, requestId);
    },
  };
}
