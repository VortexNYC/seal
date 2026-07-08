import type { CanonicalDomainEvent, ProcessorEvent, RawProcessorWebhook } from "../../events/types";
import type { PaymentsProviderAdapter, ProviderKey } from "../../providers/types";
import type { ProviderRegistry } from "../../providers/registry";
import type { PaymentsUnitOfWork } from "../../storage/unit-of-work";
import type { IngestProviderWebhookCommand, WebhookIngestionResult } from "./contracts";
import type { CanonicalEventsService } from "../events/service";
import type { WebhooksService } from "./service";

export class WebhooksServiceError extends Error {
  readonly code:
    | "invalid_request"
    | "not_found"
    | "conflict"
    | "action_required"
    | "provider_unavailable"
    | "internal_error";
  readonly retryable: boolean;
  readonly details?: Readonly<Record<string, string>>;

  constructor(
    code: WebhooksServiceError["code"],
    message: string,
    options?: {
      retryable?: boolean;
      details?: Readonly<Record<string, string>>;
    },
  ) {
    super(message);
    this.name = "WebhooksServiceError";
    this.code = code;
    this.retryable = options?.retryable ?? false;
    this.details = options?.details;
  }
}

export interface ProviderWebhookMapper {
  readonly provider: ProviderKey;
  mapRawWebhookRecord(input: {
    readonly id: string;
    readonly environment: IngestProviderWebhookCommand["environment"];
    readonly deliveryKey: string;
    readonly headers: Readonly<Record<string, string>>;
    readonly rawBody: string;
    readonly signatureValidationStatus: RawProcessorWebhook["signatureValidationStatus"];
    readonly processingStatus?: RawProcessorWebhook["processingStatus"];
    readonly receivedAt?: string;
  }): RawProcessorWebhook;
  mapRawWebhookToProcessorEvent(input: {
    readonly rawWebhookId: string;
    readonly environment: IngestProviderWebhookCommand["environment"];
    readonly rawBody: string;
    readonly receivedAt?: string;
    readonly providerWebhookId?: string;
  }): ProcessorEvent | null;
  mapProcessorEventToCanonicalDomainEvents(event: ProcessorEvent): readonly CanonicalDomainEvent[];
}

export interface WebhooksServiceDependencies {
  readonly uow: PaymentsUnitOfWork;
  readonly providers: ProviderRegistry;
  readonly webhookMappers: Readonly<Partial<Record<ProviderKey, ProviderWebhookMapper>>>;
  readonly canonicalEvents?: CanonicalEventsService;
  readonly afterCanonicalEventsApplied?: (events: readonly CanonicalDomainEvent[]) => Promise<void>;
  readonly now?: () => string;
  readonly createId?: (prefix: "raw" | "evt") => string;
}

function createDefaultId(prefix: "raw" | "evt"): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function lowerCaseHeaders(
  headers: Readonly<Record<string, string>>,
): Readonly<Record<string, string>> {
  return Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]),
  );
}

function getAdapterOrThrow(
  providers: ProviderRegistry,
  provider: ProviderKey,
): PaymentsProviderAdapter {
  try {
    return providers.getAdapter(provider);
  } catch {
    throw new WebhooksServiceError("not_found", "provider adapter not registered", {
      details: { provider },
    });
  }
}

function getMapperOrThrow(
  mappers: WebhooksServiceDependencies["webhookMappers"],
  provider: ProviderKey,
): ProviderWebhookMapper {
  const mapper = mappers[provider];
  if (!mapper) {
    throw new WebhooksServiceError("not_found", "provider webhook mapper not registered", {
      details: { provider },
    });
  }
  return mapper;
}

function toDuplicateIngestionResult(existing: RawProcessorWebhook): WebhookIngestionResult {
  return {
    rawWebhookId: existing.id,
    accepted: existing.processingStatus === "accepted",
    duplicate: true,
    signatureStatus: existing.signatureValidationStatus,
  };
}

async function ingestProviderWebhookInTransaction(args: {
  readonly dependencies: WebhooksServiceDependencies;
  readonly createId: (prefix: "raw" | "evt") => string;
  readonly command: IngestProviderWebhookCommand;
  readonly uow: PaymentsUnitOfWork;
}): Promise<WebhookIngestionResult> {
  const { command, createId, dependencies, uow } = args;
  const adapter = getAdapterOrThrow(dependencies.providers, command.provider);
  const mapper = getMapperOrThrow(dependencies.webhookMappers, command.provider);
  const normalizedHeaders = lowerCaseHeaders(command.headers);
  const verification = await adapter.verifyWebhookSignature(
    {
      provider: command.provider,
      environment: command.environment,
    },
    normalizedHeaders,
    command.rawBody,
  );

  const existing = await uow.events.getRawWebhookByDeliveryKey(
    command.environment,
    command.provider,
    verification.deliveryKey,
  );
  if (existing) {
    return toDuplicateIngestionResult(existing);
  }

  const rawWebhookId = createId("raw");
  const signatureStatus = verification.valid ? "valid" : "invalid";
  const rawWebhook = mapper.mapRawWebhookRecord({
    id: rawWebhookId,
    environment: command.environment,
    deliveryKey: verification.deliveryKey,
    headers: normalizedHeaders,
    rawBody: command.rawBody,
    signatureValidationStatus: signatureStatus,
    processingStatus: verification.valid ? "pending" : "rejected",
    receivedAt: command.receivedAt,
  });

  if (!verification.valid) {
    await uow.events.saveRawWebhook(rawWebhook);
    return {
      rawWebhookId,
      accepted: false,
      duplicate: false,
      signatureStatus,
      signatureReason: verification.reason,
    };
  }

  const processorEvent = mapper.mapRawWebhookToProcessorEvent({
    rawWebhookId,
    environment: command.environment,
    rawBody: command.rawBody,
    receivedAt: command.receivedAt,
    providerWebhookId: verification.providerWebhookId,
  });

  if (!processorEvent) {
    await uow.events.saveRawWebhook({
      ...rawWebhook,
      processingStatus: "rejected",
    });
    return {
      rawWebhookId,
      accepted: false,
      duplicate: false,
      signatureStatus,
    };
  }

  const canonicalEvents = mapper.mapProcessorEventToCanonicalDomainEvents(processorEvent);
  const normalizationStatus = canonicalEvents.length > 0 ? "normalized" : "failed";
  await uow.events.saveRawWebhook({
    ...rawWebhook,
    processingStatus: canonicalEvents.length > 0 ? "accepted" : "rejected",
  });
  await uow.events.saveProcessorEvent({
    ...processorEvent,
    id: processorEvent.id || createId("evt"),
    normalizationStatus,
    normalizationError:
      canonicalEvents.length > 0 ? undefined : "no canonical events mapped from processor event",
  });
  for (const event of canonicalEvents) {
    await uow.events.saveCanonicalEvent(event);
  }
  if (canonicalEvents.length > 0) {
    await dependencies.canonicalEvents?.applyCanonicalEvents(canonicalEvents);
    await dependencies.afterCanonicalEventsApplied?.(canonicalEvents);
  }

  return {
    rawWebhookId,
    accepted: canonicalEvents.length > 0,
    duplicate: false,
    signatureStatus,
  };
}

export function createWebhooksService(dependencies: WebhooksServiceDependencies): WebhooksService {
  const createId = dependencies.createId ?? createDefaultId;

  return {
    async ingestProviderWebhook(
      command: IngestProviderWebhookCommand,
    ): Promise<WebhookIngestionResult> {
      return dependencies.uow.runInTransaction(async (uow) => {
        return ingestProviderWebhookInTransaction({ dependencies, createId, command, uow });
      });
    },
  };
}
