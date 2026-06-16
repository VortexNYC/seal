import type { ApiSuccess } from "../contract/common";
import type {
  GetMerchantAccountCapabilitiesQuery,
  GetMerchantAccountStateQuery,
} from "../../application/state/contracts";
import type { PaymentsStateReader } from "../../application/state/service";
import type { HttpRequestEnvelope, HttpResponseEnvelope } from "./billing";

export interface MerchantStateHttpHandlers {
  getMerchantAccountState(
    request: HttpRequestEnvelope<GetMerchantAccountStateQuery>,
  ): Promise<HttpResponseEnvelope<Awaited<ReturnType<PaymentsStateReader["getMerchantAccountState"]>>>>;
  getMerchantAccountCapabilities(
    request: HttpRequestEnvelope<GetMerchantAccountCapabilitiesQuery>,
  ): Promise<HttpResponseEnvelope<Awaited<ReturnType<PaymentsStateReader["getMerchantAccountCapabilities"]>>>>;
}

export interface MerchantStateHttpHandlerDependencies {
  readonly reader: PaymentsStateReader;
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

export function createMerchantStateHttpHandlers(
  dependencies: MerchantStateHttpHandlerDependencies,
): MerchantStateHttpHandlers {
  const createRequestId = dependencies.createRequestId ?? createDefaultRequestId;

  return {
    async getMerchantAccountState(request) {
      const requestId = request.requestId ?? createRequestId();
      const result = await dependencies.reader.getMerchantAccountState(request.body);
      return toSuccessResponse(result, requestId);
    },

    async getMerchantAccountCapabilities(request) {
      const requestId = request.requestId ?? createRequestId();
      const result = await dependencies.reader.getMerchantAccountCapabilities(request.body);
      return toSuccessResponse(result, requestId);
    },
  };
}
