import type { ApiSuccess } from "../contract/common";
import type {
  CancelCardPresentPaymentIntentCommand,
  CaptureCardPresentPaymentIntentCommand,
  CardPresentPaymentIntentSnapshot,
  CreateCardPresentPaymentIntentCommand,
  CreateTerminalConnectionSessionCommand,
  CreateTerminalLocationCommand,
  GetCardPresentPaymentIntentQuery,
  ListCardPresentPaymentIntentsQuery,
  ListTerminalLocationsQuery,
  ListTerminalReadersQuery,
  RegisterTerminalReaderCommand,
  TerminalConnectionSessionSnapshot,
  TerminalLocationSnapshot,
  TerminalReaderSnapshot,
} from "../../application/terminal/contracts";
import { TerminalServiceError } from "../../application/terminal/impl";
import type { TerminalService } from "../../application/terminal/service";
import type { HttpRequestEnvelope, HttpResponseEnvelope } from "./billing";

export interface TerminalHttpHandlers {
  createTerminalLocation(
    request: HttpRequestEnvelope<CreateTerminalLocationCommand>,
  ): Promise<HttpResponseEnvelope<TerminalLocationSnapshot>>;
  listTerminalLocations(
    request: HttpRequestEnvelope<ListTerminalLocationsQuery>,
  ): Promise<HttpResponseEnvelope<readonly TerminalLocationSnapshot[]>>;
  registerTerminalReader(
    request: HttpRequestEnvelope<RegisterTerminalReaderCommand>,
  ): Promise<HttpResponseEnvelope<TerminalReaderSnapshot>>;
  listTerminalReaders(
    request: HttpRequestEnvelope<ListTerminalReadersQuery>,
  ): Promise<HttpResponseEnvelope<readonly TerminalReaderSnapshot[]>>;
  createTerminalConnectionSession(
    request: HttpRequestEnvelope<CreateTerminalConnectionSessionCommand>,
  ): Promise<HttpResponseEnvelope<TerminalConnectionSessionSnapshot>>;
  createCardPresentPaymentIntent(
    request: HttpRequestEnvelope<CreateCardPresentPaymentIntentCommand>,
  ): Promise<HttpResponseEnvelope<CardPresentPaymentIntentSnapshot>>;
  getCardPresentPaymentIntent(
    request: HttpRequestEnvelope<GetCardPresentPaymentIntentQuery>,
  ): Promise<HttpResponseEnvelope<CardPresentPaymentIntentSnapshot | null>>;
  listCardPresentPaymentIntents(
    request: HttpRequestEnvelope<ListCardPresentPaymentIntentsQuery>,
  ): Promise<HttpResponseEnvelope<readonly CardPresentPaymentIntentSnapshot[]>>;
  captureCardPresentPaymentIntent(
    request: HttpRequestEnvelope<CaptureCardPresentPaymentIntentCommand>,
  ): Promise<HttpResponseEnvelope<CardPresentPaymentIntentSnapshot>>;
  cancelCardPresentPaymentIntent(
    request: HttpRequestEnvelope<CancelCardPresentPaymentIntentCommand>,
  ): Promise<HttpResponseEnvelope<CardPresentPaymentIntentSnapshot>>;
}

export interface TerminalHttpHandlerDependencies {
  readonly service: TerminalService;
  readonly createRequestId?: () => string;
}

function createDefaultRequestId(): string {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function toErrorResponse(error: unknown, requestId: string): HttpResponseEnvelope<never> {
  if (error instanceof TerminalServiceError) {
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
        category: "terminal_service",
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
      category: "terminal_service",
      message: error instanceof Error ? error.message : "unexpected terminal handler failure",
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

export function createTerminalHttpHandlers(
  dependencies: TerminalHttpHandlerDependencies,
): TerminalHttpHandlers {
  const createRequestId = dependencies.createRequestId ?? createDefaultRequestId;
  return {
    async createTerminalLocation(request) {
      const requestId = request.requestId ?? createRequestId();
      try {
        return toSuccessResponse(
          await dependencies.service.createTerminalLocation(request.body),
          requestId,
          201,
        );
      } catch (error) {
        return toErrorResponse(error, requestId);
      }
    },
    async listTerminalLocations(request) {
      const requestId = request.requestId ?? createRequestId();
      try {
        return toSuccessResponse(
          await dependencies.service.listTerminalLocations(request.body),
          requestId,
        );
      } catch (error) {
        return toErrorResponse(error, requestId);
      }
    },
    async registerTerminalReader(request) {
      const requestId = request.requestId ?? createRequestId();
      try {
        return toSuccessResponse(
          await dependencies.service.registerTerminalReader(request.body),
          requestId,
          201,
        );
      } catch (error) {
        return toErrorResponse(error, requestId);
      }
    },
    async listTerminalReaders(request) {
      const requestId = request.requestId ?? createRequestId();
      try {
        return toSuccessResponse(
          await dependencies.service.listTerminalReaders(request.body),
          requestId,
        );
      } catch (error) {
        return toErrorResponse(error, requestId);
      }
    },
    async createTerminalConnectionSession(request) {
      const requestId = request.requestId ?? createRequestId();
      try {
        return toSuccessResponse(
          await dependencies.service.createTerminalConnectionSession(request.body),
          requestId,
          201,
        );
      } catch (error) {
        return toErrorResponse(error, requestId);
      }
    },
    async createCardPresentPaymentIntent(request) {
      const requestId = request.requestId ?? createRequestId();
      try {
        return toSuccessResponse(
          await dependencies.service.createCardPresentPaymentIntent(request.body),
          requestId,
          201,
        );
      } catch (error) {
        return toErrorResponse(error, requestId);
      }
    },
    async getCardPresentPaymentIntent(request) {
      const requestId = request.requestId ?? createRequestId();
      try {
        return toSuccessResponse(
          await dependencies.service.getCardPresentPaymentIntent(request.body),
          requestId,
        );
      } catch (error) {
        return toErrorResponse(error, requestId);
      }
    },
    async listCardPresentPaymentIntents(request) {
      const requestId = request.requestId ?? createRequestId();
      try {
        return toSuccessResponse(
          await dependencies.service.listCardPresentPaymentIntents(request.body),
          requestId,
        );
      } catch (error) {
        return toErrorResponse(error, requestId);
      }
    },
    async captureCardPresentPaymentIntent(request) {
      const requestId = request.requestId ?? createRequestId();
      try {
        return toSuccessResponse(
          await dependencies.service.captureCardPresentPaymentIntent(request.body),
          requestId,
          202,
        );
      } catch (error) {
        return toErrorResponse(error, requestId);
      }
    },
    async cancelCardPresentPaymentIntent(request) {
      const requestId = request.requestId ?? createRequestId();
      try {
        return toSuccessResponse(
          await dependencies.service.cancelCardPresentPaymentIntent(request.body),
          requestId,
          202,
        );
      } catch (error) {
        return toErrorResponse(error, requestId);
      }
    },
  };
}
