import type {
  CardPresentPaymentIntentId,
  MerchantAccountId,
  PaymentId,
  TerminalLocationId,
  TerminalReaderId,
} from "../../domain/common";
import type { MerchantAccount } from "../../domain/merchant";
import type { Payment } from "../../domain/payments";
import type {
  CardPresentPaymentIntent,
  TerminalConnectionSession,
  TerminalLocation,
  TerminalReader,
} from "../../domain/terminal";
import type { CanonicalDomainEvent } from "../../events/types";
import type { PaymentsUnitOfWork } from "../../storage/unit-of-work";
import type {
  CardPresentPaymentIntentSnapshot,
  CreateTerminalLocationCommand,
  TerminalConnectionSessionSnapshot,
  TerminalLocationSnapshot,
  TerminalNextAction,
  TerminalReaderSnapshot,
} from "./contracts";
import type { TerminalService } from "./service";

export class TerminalServiceError extends Error {
  readonly code: "invalid_request" | "not_found" | "conflict" | "action_required" | "internal_error";
  readonly retryable: boolean;
  readonly details?: Readonly<Record<string, string>>;

  constructor(
    code: TerminalServiceError["code"],
    message: string,
    options?: {
      retryable?: boolean;
      details?: Readonly<Record<string, string>>;
    },
  ) {
    super(message);
    this.name = "TerminalServiceError";
    this.code = code;
    this.retryable = options?.retryable ?? false;
    this.details = options?.details;
  }
}

export interface TerminalServiceDependencies {
  readonly uow: PaymentsUnitOfWork;
  readonly now?: () => string;
  readonly createId?: (prefix: "tl" | "tr" | "tcs" | "cpi" | "pay" | "evt" | "idem") => string;
}

const DEFAULT_IDEMPOTENCY_TTL_MS = 1000 * 60 * 60 * 24;

function createDefaultId(prefix: "tl" | "tr" | "tcs" | "cpi" | "pay" | "evt" | "idem"): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function requireTerminalRepositories(uow: PaymentsUnitOfWork): {
  readonly terminalLocations: NonNullable<PaymentsUnitOfWork["terminalLocations"]>;
  readonly terminalReaders: NonNullable<PaymentsUnitOfWork["terminalReaders"]>;
  readonly terminalConnectionSessions: NonNullable<PaymentsUnitOfWork["terminalConnectionSessions"]>;
  readonly cardPresentPaymentIntents: NonNullable<PaymentsUnitOfWork["cardPresentPaymentIntents"]>;
} {
  if (!uow.terminalLocations || !uow.terminalReaders || !uow.terminalConnectionSessions || !uow.cardPresentPaymentIntents) {
    throw new TerminalServiceError("internal_error", "terminal persistence is not configured");
  }
  return {
    terminalLocations: uow.terminalLocations,
    terminalReaders: uow.terminalReaders,
    terminalConnectionSessions: uow.terminalConnectionSessions,
    cardPresentPaymentIntents: uow.cardPresentPaymentIntents,
  };
}

function stableStringify(value: unknown): string {
  if (value === null || value === undefined) {
    return "null";
  }
  if (typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) =>
      left.localeCompare(right)
    );
    return `{${entries.map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`).join(",")}}`;
  }
  return JSON.stringify(String(value));
}

function hashRequest(value: unknown): string {
  const stable = stableStringify(value);
  let hash = 2166136261;
  for (let index = 0; index < stable.length; index += 1) {
    hash ^= stable.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a_${(hash >>> 0).toString(16)}`;
}

async function withIdempotentResult<TResult>(
  uow: PaymentsUnitOfWork,
  options: {
    readonly environment: CreateTerminalLocationCommand["environment"];
    readonly scope: string;
    readonly idempotencyKey?: string;
    readonly request: unknown;
    readonly createId: (prefix: "idem") => string;
    readonly now: string;
  },
  work: () => Promise<TResult>,
): Promise<TResult> {
  if (!options.idempotencyKey) {
    return work();
  }
  const requestHash = hashRequest(options.request);
  const existing = await uow.idempotency.getByScopeAndKey(options.environment, options.scope, options.idempotencyKey);
  if (existing) {
    if (existing.requestHash !== requestHash) {
      throw new TerminalServiceError("conflict", "idempotency key reused with different request", {
        details: { scope: options.scope },
      });
    }
    return JSON.parse(existing.responseRef) as TResult;
  }
  const result = await work();
  await uow.idempotency.save({
    id: options.createId("idem"),
    environment: options.environment,
    scope: options.scope,
    idempotencyKey: options.idempotencyKey,
    requestHash,
    responseRef: JSON.stringify(result),
    createdAt: options.now,
    expiresAt: new Date(Date.parse(options.now) + DEFAULT_IDEMPOTENCY_TTL_MS).toISOString(),
  });
  return result;
}

async function getMerchantOrThrow(
  uow: PaymentsUnitOfWork,
  environment: CreateTerminalLocationCommand["environment"],
  merchantAccountId: MerchantAccountId,
): Promise<MerchantAccount> {
  const merchant = await uow.merchants.getById(merchantAccountId, { environment });
  if (!merchant) {
    throw new TerminalServiceError("not_found", "merchant account not found", { details: { merchantAccountId } });
  }
  return merchant;
}

async function ensureMerchantCanAcceptPayments(
  uow: PaymentsUnitOfWork,
  environment: CreateTerminalLocationCommand["environment"],
  merchantAccountId: MerchantAccountId,
): Promise<void> {
  const state = await uow.merchantStates.getByMerchantAccountId(merchantAccountId, { environment });
  if (!state?.canAcceptPayments) {
    throw new TerminalServiceError("action_required", "merchant cannot accept card-present payments", {
      details: { merchantAccountId, nextAction: "resolve_merchant_readiness" },
    });
  }
}

function nextActionForLocation(location: TerminalLocation): TerminalNextAction {
  return location.status === "active" ? "none" : "enable_location";
}

function nextActionForReader(location: TerminalLocation, reader: TerminalReader): TerminalNextAction {
  const locationAction = nextActionForLocation(location);
  if (locationAction !== "none") {
    return locationAction;
  }
  if (reader.registrationStatus !== "registered") {
    return "register_reader";
  }
  if (reader.connectivityStatus !== "online") {
    return "bring_reader_online";
  }
  if (reader.healthStatus !== "healthy") {
    return "repair_reader";
  }
  return "none";
}

function assertReaderReady(location: TerminalLocation, reader: TerminalReader): void {
  const nextAction = nextActionForReader(location, reader);
  if (nextAction !== "none") {
    throw new TerminalServiceError("action_required", "terminal reader is not ready", {
      details: { locationId: location.id, readerId: reader.id, nextAction },
    });
  }
}

async function getLocationInScope(
  uow: PaymentsUnitOfWork,
  environment: CreateTerminalLocationCommand["environment"],
  merchantAccountId: MerchantAccountId,
  locationId: TerminalLocationId,
): Promise<TerminalLocation> {
  const repos = requireTerminalRepositories(uow);
  const location = await repos.terminalLocations.getById(locationId, { environment });
  if (!location || location.merchantAccountId !== merchantAccountId) {
    throw new TerminalServiceError("not_found", "terminal location not found", { details: { locationId } });
  }
  return location;
}

async function getReaderInScope(
  uow: PaymentsUnitOfWork,
  environment: CreateTerminalLocationCommand["environment"],
  merchantAccountId: MerchantAccountId,
  readerId: TerminalReaderId,
): Promise<TerminalReader> {
  const repos = requireTerminalRepositories(uow);
  const reader = await repos.terminalReaders.getById(readerId, { environment });
  if (!reader || reader.merchantAccountId !== merchantAccountId) {
    throw new TerminalServiceError("not_found", "terminal reader not found", { details: { readerId } });
  }
  return reader;
}

async function getCardPresentIntentInScope(
  uow: PaymentsUnitOfWork,
  command: {
    readonly environment: CreateTerminalLocationCommand["environment"];
    readonly merchantAccountId: MerchantAccountId;
    readonly cardPresentPaymentIntentId: CardPresentPaymentIntentId;
  },
): Promise<CardPresentPaymentIntent> {
  const repos = requireTerminalRepositories(uow);
  const intent = await repos.cardPresentPaymentIntents.getById(command.cardPresentPaymentIntentId, {
    environment: command.environment,
  });
  if (!intent || intent.merchantAccountId !== command.merchantAccountId) {
    throw new TerminalServiceError("not_found", "card-present payment intent not found", {
      details: { cardPresentPaymentIntentId: command.cardPresentPaymentIntentId },
    });
  }
  return intent;
}

function toLocationSnapshot(location: TerminalLocation): TerminalLocationSnapshot {
  return {
    id: location.id,
    merchantAccountId: location.merchantAccountId,
    displayName: location.displayName,
    status: location.status,
    address: location.address,
    metadata: location.metadata,
    createdAt: location.createdAt,
    updatedAt: location.updatedAt,
  };
}

function toReaderSnapshot(location: TerminalLocation, reader: TerminalReader): TerminalReaderSnapshot {
  return {
    id: reader.id,
    merchantAccountId: reader.merchantAccountId,
    locationId: reader.locationId,
    label: reader.label,
    registrationStatus: reader.registrationStatus,
    healthStatus: reader.healthStatus,
    connectivityStatus: reader.connectivityStatus,
    deviceType: reader.deviceType,
    serialNumberMasked: reader.serialNumberMasked,
    metadata: reader.metadata,
    nextAction: nextActionForReader(location, reader),
    createdAt: reader.createdAt,
    updatedAt: reader.updatedAt,
  };
}

function toSessionSnapshot(
  session: TerminalConnectionSession,
  nextAction: TerminalNextAction,
): TerminalConnectionSessionSnapshot {
  return {
    id: session.id,
    merchantAccountId: session.merchantAccountId,
    locationId: session.locationId,
    readerId: session.readerId,
    status: session.status,
    clientToken: session.clientToken,
    expiresAt: session.expiresAt,
    nextAction,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
  };
}

function canCapture(intent: CardPresentPaymentIntent): boolean {
  return intent.capturePolicy.captureMode === "manual" && intent.status === "authorized";
}

function canCancel(intent: CardPresentPaymentIntent): boolean {
  return intent.status === "requires_reader" || intent.status === "processing" || intent.status === "authorized";
}

function toIntentSnapshot(intent: CardPresentPaymentIntent): CardPresentPaymentIntentSnapshot {
  return {
    id: intent.id,
    paymentId: intent.paymentId,
    merchantAccountId: intent.merchantAccountId,
    locationId: intent.locationId,
    readerId: intent.readerId,
    connectionSessionId: intent.connectionSessionId,
    customerProfileId: intent.customerProfileId,
    externalOrderRef: intent.externalOrderRef,
    amount: intent.amount,
    currency: intent.currency,
    status: intent.status,
    capturePolicy: intent.capturePolicy,
    nextAction: canCapture(intent) ? "capture" : canCancel(intent) ? "cancel" : "none",
    canCapture: canCapture(intent),
    canCancel: canCancel(intent),
    failureCode: intent.failureCode,
    failureMessage: intent.failureMessage,
    metadata: intent.metadata,
    createdAt: intent.createdAt,
    updatedAt: intent.updatedAt,
    authorizedAt: intent.authorizedAt,
    capturedAt: intent.capturedAt,
    canceledAt: intent.canceledAt,
  };
}

function createTerminalEvent(input: {
  readonly id: string;
  readonly eventType: CanonicalDomainEvent["eventType"];
  readonly intent: CardPresentPaymentIntent;
  readonly occurredAt: string;
}): CanonicalDomainEvent {
  return {
    id: input.id,
    environment: input.intent.environment,
    eventType: input.eventType,
    aggregateType: "card_present_payment_intent",
    aggregateId: input.intent.id,
    occurredAt: input.occurredAt,
    sourceProvider: "vortex",
    payload: {
      merchantAccountId: input.intent.merchantAccountId,
      cardPresentPaymentIntentId: input.intent.id,
      paymentId: input.intent.paymentId ?? null,
      status: input.intent.status,
      amount: input.intent.amount,
      currency: input.intent.currency,
      locationId: input.intent.locationId,
      readerId: input.intent.readerId,
    },
    createdAt: input.occurredAt,
  };
}

export function createTerminalService(dependencies: TerminalServiceDependencies): TerminalService {
  const now = dependencies.now ?? (() => new Date().toISOString());
  const createId = dependencies.createId ?? createDefaultId;
  const uow = dependencies.uow;
  const repos = requireTerminalRepositories(uow);

  return {
    async createTerminalLocation(command) {
      const timestamp = now();
      return withIdempotentResult(
        uow,
        {
          environment: command.environment,
          scope: `terminal_location:${command.merchantAccountId}`,
          idempotencyKey: command.idempotencyKey,
          request: command,
          createId,
          now: timestamp,
        },
        async () => {
          await getMerchantOrThrow(uow, command.environment, command.merchantAccountId);
          const location: TerminalLocation = {
            id: createId("tl"),
            environment: command.environment,
            merchantAccountId: command.merchantAccountId,
            displayName: command.displayName,
            status: "active",
            address: command.address,
            metadata: command.metadata,
            processorRefs: [],
            createdAt: timestamp,
            updatedAt: timestamp,
          };
          await repos.terminalLocations.save(location);
          return toLocationSnapshot(location);
        },
      );
    },

    async listTerminalLocations(query) {
      const records = await repos.terminalLocations.listByMerchant(query.environment, query.merchantAccountId);
      return records
        .filter((record) => !query.status || record.status === query.status)
        .map(toLocationSnapshot);
    },

    async registerTerminalReader(command) {
      const timestamp = now();
      return withIdempotentResult(
        uow,
        {
          environment: command.environment,
          scope: `terminal_reader:${command.merchantAccountId}:${command.locationId}`,
          idempotencyKey: command.idempotencyKey,
          request: command,
          createId,
          now: timestamp,
        },
        async () => {
          await getMerchantOrThrow(uow, command.environment, command.merchantAccountId);
          const location = await getLocationInScope(uow, command.environment, command.merchantAccountId, command.locationId);
          const reader: TerminalReader = {
            id: createId("tr"),
            environment: command.environment,
            merchantAccountId: command.merchantAccountId,
            locationId: command.locationId,
            label: command.label,
            registrationStatus: command.registrationStatus ?? "registered",
            healthStatus: command.healthStatus ?? "healthy",
            connectivityStatus: command.connectivityStatus ?? "online",
            deviceType: command.deviceType,
            serialNumberMasked: command.serialNumberMasked,
            metadata: command.metadata,
            processorRefs: [],
            createdAt: timestamp,
            updatedAt: timestamp,
          };
          await repos.terminalReaders.save(reader);
          return toReaderSnapshot(location, reader);
        },
      );
    },

    async listTerminalReaders(query) {
      const readers = query.locationId
        ? await repos.terminalReaders.listByLocation(query.environment, query.merchantAccountId, query.locationId)
        : await repos.terminalReaders.listByMerchant(query.environment, query.merchantAccountId);
      const snapshots = await Promise.all(
        readers.map(async (reader) => {
          const location = await getLocationInScope(uow, query.environment, query.merchantAccountId, reader.locationId);
          return toReaderSnapshot(location, reader);
        }),
      );
      return snapshots;
    },

    async createTerminalConnectionSession(command) {
      const timestamp = now();
      return withIdempotentResult(
        uow,
        {
          environment: command.environment,
          scope: `terminal_connection:${command.merchantAccountId}:${command.locationId}`,
          idempotencyKey: command.idempotencyKey,
          request: command,
          createId,
          now: timestamp,
        },
        async () => {
          await getMerchantOrThrow(uow, command.environment, command.merchantAccountId);
          await ensureMerchantCanAcceptPayments(uow, command.environment, command.merchantAccountId);
          const location = await getLocationInScope(uow, command.environment, command.merchantAccountId, command.locationId);
          let nextAction = nextActionForLocation(location);
          if (command.readerId) {
            const reader = await getReaderInScope(uow, command.environment, command.merchantAccountId, command.readerId);
            nextAction = nextActionForReader(location, reader);
            assertReaderReady(location, reader);
          }
          if (nextAction !== "none") {
            throw new TerminalServiceError("action_required", "terminal location is not ready", {
              details: { locationId: location.id, nextAction },
            });
          }
          const id = createId("tcs");
          const session: TerminalConnectionSession = {
            id,
            environment: command.environment,
            merchantAccountId: command.merchantAccountId,
            locationId: command.locationId,
            readerId: command.readerId,
            status: "issued",
            clientToken: `vtx_terminal_${id}`,
            expiresAt: new Date(Date.parse(timestamp) + 1000 * 60 * 15).toISOString(),
            createdByType: command.createdByType,
            createdByRef: command.createdByRef,
            processorRefs: [],
            createdAt: timestamp,
            updatedAt: timestamp,
          };
          await repos.terminalConnectionSessions.save(session);
          return toSessionSnapshot(session, "none");
        },
      );
    },

    async createCardPresentPaymentIntent(command) {
      const timestamp = now();
      return withIdempotentResult(
        uow,
        {
          environment: command.environment,
          scope: `card_present_intent:${command.merchantAccountId}:${command.externalOrderRef ?? "manual"}`,
          idempotencyKey: command.idempotencyKey,
          request: command,
          createId,
          now: timestamp,
        },
        async () => {
          await getMerchantOrThrow(uow, command.environment, command.merchantAccountId);
          await ensureMerchantCanAcceptPayments(uow, command.environment, command.merchantAccountId);
          const location = await getLocationInScope(uow, command.environment, command.merchantAccountId, command.locationId);
          const reader = await getReaderInScope(uow, command.environment, command.merchantAccountId, command.readerId);
          assertReaderReady(location, reader);
          if (command.amount <= 0) {
            throw new TerminalServiceError("invalid_request", "amount must be positive");
          }
          if (command.capturePolicy.tipAmount && !command.capturePolicy.allowTip) {
            throw new TerminalServiceError("invalid_request", "tip amount requires tip policy");
          }
          const intent: CardPresentPaymentIntent = {
            id: createId("cpi"),
            environment: command.environment,
            merchantAccountId: command.merchantAccountId,
            locationId: command.locationId,
            readerId: command.readerId,
            connectionSessionId: command.connectionSessionId,
            customerProfileId: command.customerProfileId,
            externalOrderRef: command.externalOrderRef,
            amount: command.amount,
            currency: command.currency,
            status: command.capturePolicy.captureMode === "manual" ? "authorized" : "captured",
            capturePolicy: command.capturePolicy,
            metadata: command.metadata,
            processorRefs: [],
            createdAt: timestamp,
            updatedAt: timestamp,
            authorizedAt: timestamp,
            capturedAt: command.capturePolicy.captureMode === "automatic" ? timestamp : undefined,
          };
          await repos.cardPresentPaymentIntents.save(intent);
          await uow.events.saveCanonicalEvent(createTerminalEvent({
            id: createId("evt"),
            eventType: "card_present_payment_intent.created",
            intent,
            occurredAt: timestamp,
          }));
          return toIntentSnapshot(intent);
        },
      );
    },

    async getCardPresentPaymentIntent(query) {
      const intent = await repos.cardPresentPaymentIntents.getById(query.cardPresentPaymentIntentId, {
        environment: query.environment,
      });
      if (!intent || intent.merchantAccountId !== query.merchantAccountId) {
        return null;
      }
      return toIntentSnapshot(intent);
    },

    async listCardPresentPaymentIntents(query) {
      const records = await repos.cardPresentPaymentIntents.listByMerchant(query.environment, query.merchantAccountId);
      return records.filter((record) => !query.status || record.status === query.status).map(toIntentSnapshot);
    },

    async captureCardPresentPaymentIntent(command) {
      const timestamp = now();
      return withIdempotentResult(
        uow,
        {
          environment: command.environment,
          scope: `card_present_capture:${command.cardPresentPaymentIntentId}`,
          idempotencyKey: command.idempotencyKey,
          request: command,
          createId,
          now: timestamp,
        },
        async () => {
          const intent = await getCardPresentIntentInScope(uow, command);
          if (!canCapture(intent)) {
            throw new TerminalServiceError("conflict", "card-present payment intent cannot be captured", {
              details: { cardPresentPaymentIntentId: intent.id, status: intent.status },
            });
          }
          const finalAmount = command.amount ?? intent.amount + (command.tipAmount ?? intent.capturePolicy.tipAmount ?? 0);
          const tipAmount = command.tipAmount ?? intent.capturePolicy.tipAmount ?? 0;
          if (tipAmount > 0 && !intent.capturePolicy.allowTip) {
            throw new TerminalServiceError("invalid_request", "tip capture is not allowed", { details: { cardPresentPaymentIntentId: intent.id } });
          }
          if (finalAmount > intent.amount) {
            if (!intent.capturePolicy.allowOvercapture) {
              throw new TerminalServiceError("invalid_request", "overcapture is not allowed", { details: { cardPresentPaymentIntentId: intent.id } });
            }
            const max = intent.capturePolicy.maxOvercaptureAmount ?? intent.amount;
            if (finalAmount > max) {
              throw new TerminalServiceError("invalid_request", "capture amount exceeds overcapture limit", {
                details: { cardPresentPaymentIntentId: intent.id },
              });
            }
          }
          const paymentId: PaymentId = createId("pay");
          const capturedIntent: CardPresentPaymentIntent = {
            ...intent,
            amount: finalAmount,
            status: "captured",
            paymentId,
            capturePolicy: {
              ...intent.capturePolicy,
              tipAmount,
            },
            updatedAt: timestamp,
            capturedAt: timestamp,
          };
          const payment: Payment = {
            id: paymentId,
            environment: intent.environment,
            merchantAccountId: intent.merchantAccountId,
            terminalSessionId: intent.connectionSessionId,
            terminalReaderId: intent.readerId,
            cardPresentPaymentIntentId: intent.id,
            customerProfileId: intent.customerProfileId,
            amount: finalAmount,
            currency: intent.currency,
            status: "captured",
            direction: "debit",
            authorizedAt: intent.authorizedAt,
            capturedAt: timestamp,
            settlementEligibleAt: timestamp,
            processorPaymentRefs: [],
            createdAt: timestamp,
            updatedAt: timestamp,
          };
          await uow.payments.save(payment);
          await repos.cardPresentPaymentIntents.save(capturedIntent);
          await uow.events.saveCanonicalEvent(createTerminalEvent({
            id: createId("evt"),
            eventType: "card_present_payment_intent.captured",
            intent: capturedIntent,
            occurredAt: timestamp,
          }));
          return toIntentSnapshot(capturedIntent);
        },
      );
    },

    async cancelCardPresentPaymentIntent(command) {
      const timestamp = now();
      const intent = await getCardPresentIntentInScope(uow, command);
      if (!canCancel(intent)) {
        throw new TerminalServiceError("conflict", "card-present payment intent cannot be canceled", {
          details: { cardPresentPaymentIntentId: intent.id, status: intent.status },
        });
      }
      const canceled: CardPresentPaymentIntent = {
        ...intent,
        status: "canceled",
        updatedAt: timestamp,
        canceledAt: timestamp,
      };
      await repos.cardPresentPaymentIntents.save(canceled);
      await uow.events.saveCanonicalEvent(createTerminalEvent({
        id: createId("evt"),
        eventType: "card_present_payment_intent.canceled",
        intent: canceled,
        occurredAt: timestamp,
      }));
      return toIntentSnapshot(canceled);
    },
  };
}
