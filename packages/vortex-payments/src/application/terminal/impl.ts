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
  TerminalNextAction,
  TerminalReaderSnapshot,
} from "./contracts";
import type { TerminalService } from "./service";

export class TerminalServiceError extends Error {
  readonly code:
    | "invalid_request"
    | "not_found"
    | "conflict"
    | "action_required"
    | "internal_error";
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

type TerminalCreateId = NonNullable<TerminalServiceDependencies["createId"]>;

function requireTerminalRepositories(uow: PaymentsUnitOfWork): {
  readonly terminalLocations: NonNullable<PaymentsUnitOfWork["terminalLocations"]>;
  readonly terminalReaders: NonNullable<PaymentsUnitOfWork["terminalReaders"]>;
  readonly terminalConnectionSessions: NonNullable<
    PaymentsUnitOfWork["terminalConnectionSessions"]
  >;
  readonly cardPresentPaymentIntents: NonNullable<PaymentsUnitOfWork["cardPresentPaymentIntents"]>;
} {
  if (
    !uow.terminalLocations ||
    !uow.terminalReaders ||
    !uow.terminalConnectionSessions ||
    !uow.cardPresentPaymentIntents
  ) {
    throw new TerminalServiceError("internal_error", "terminal persistence is not configured");
  }
  return {
    terminalLocations: uow.terminalLocations,
    terminalReaders: uow.terminalReaders,
    terminalConnectionSessions: uow.terminalConnectionSessions,
    cardPresentPaymentIntents: uow.cardPresentPaymentIntents,
  };
}

type TerminalRepositories = ReturnType<typeof requireTerminalRepositories>;

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
      left.localeCompare(right),
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
  const existing = await uow.idempotency.getByScopeAndKey(
    options.environment,
    options.scope,
    options.idempotencyKey,
  );
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
    throw new TerminalServiceError("not_found", "merchant account not found", {
      details: { merchantAccountId },
    });
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
    throw new TerminalServiceError(
      "action_required",
      "merchant cannot accept card-present payments",
      {
        details: { merchantAccountId, nextAction: "resolve_merchant_readiness" },
      },
    );
  }
}

function nextActionForLocation(location: TerminalLocation): TerminalNextAction {
  return location.status === "active" ? "none" : "enable_location";
}

function nextActionForReader(
  location: TerminalLocation,
  reader: TerminalReader,
): TerminalNextAction {
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
    throw new TerminalServiceError("not_found", "terminal location not found", {
      details: { locationId },
    });
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
    throw new TerminalServiceError("not_found", "terminal reader not found", {
      details: { readerId },
    });
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

function toReaderSnapshot(
  location: TerminalLocation,
  reader: TerminalReader,
): TerminalReaderSnapshot {
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
  return (
    intent.status === "requires_reader" ||
    intent.status === "processing" ||
    intent.status === "authorized"
  );
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

async function createTerminalLocationSnapshot(input: {
  readonly uow: PaymentsUnitOfWork;
  readonly repos: TerminalRepositories;
  readonly command: CreateTerminalLocationCommand;
  readonly createId: TerminalCreateId;
  readonly timestamp: string;
}): Promise<TerminalLocationSnapshot> {
  return withIdempotentResult(
    input.uow,
    {
      environment: input.command.environment,
      scope: `terminal_location:${input.command.merchantAccountId}`,
      idempotencyKey: input.command.idempotencyKey,
      request: input.command,
      createId: input.createId,
      now: input.timestamp,
    },
    async () => {
      await getMerchantOrThrow(
        input.uow,
        input.command.environment,
        input.command.merchantAccountId,
      );
      const location: TerminalLocation = {
        id: input.createId("tl"),
        environment: input.command.environment,
        merchantAccountId: input.command.merchantAccountId,
        displayName: input.command.displayName,
        status: "active",
        address: input.command.address,
        metadata: input.command.metadata,
        processorRefs: [],
        createdAt: input.timestamp,
        updatedAt: input.timestamp,
      };
      await input.repos.terminalLocations.save(location);
      return toLocationSnapshot(location);
    },
  );
}

async function listTerminalLocationSnapshots(
  repos: TerminalRepositories,
  query: ListTerminalLocationsQuery,
): Promise<readonly TerminalLocationSnapshot[]> {
  const records = await repos.terminalLocations.listByMerchant(
    query.environment,
    query.merchantAccountId,
  );
  return records
    .filter((record) => !query.status || record.status === query.status)
    .map(toLocationSnapshot);
}

async function registerTerminalReaderSnapshot(input: {
  readonly uow: PaymentsUnitOfWork;
  readonly repos: TerminalRepositories;
  readonly command: RegisterTerminalReaderCommand;
  readonly createId: TerminalCreateId;
  readonly timestamp: string;
}): Promise<TerminalReaderSnapshot> {
  return withIdempotentResult(
    input.uow,
    {
      environment: input.command.environment,
      scope: `terminal_reader:${input.command.merchantAccountId}:${input.command.locationId}`,
      idempotencyKey: input.command.idempotencyKey,
      request: input.command,
      createId: input.createId,
      now: input.timestamp,
    },
    async () => {
      await getMerchantOrThrow(
        input.uow,
        input.command.environment,
        input.command.merchantAccountId,
      );
      const location = await getLocationInScope(
        input.uow,
        input.command.environment,
        input.command.merchantAccountId,
        input.command.locationId,
      );
      const reader: TerminalReader = {
        id: input.createId("tr"),
        environment: input.command.environment,
        merchantAccountId: input.command.merchantAccountId,
        locationId: input.command.locationId,
        label: input.command.label,
        registrationStatus: input.command.registrationStatus ?? "registered",
        healthStatus: input.command.healthStatus ?? "healthy",
        connectivityStatus: input.command.connectivityStatus ?? "online",
        deviceType: input.command.deviceType,
        serialNumberMasked: input.command.serialNumberMasked,
        metadata: input.command.metadata,
        processorRefs: [],
        createdAt: input.timestamp,
        updatedAt: input.timestamp,
      };
      await input.repos.terminalReaders.save(reader);
      return toReaderSnapshot(location, reader);
    },
  );
}

async function listTerminalReaderSnapshots(input: {
  readonly uow: PaymentsUnitOfWork;
  readonly repos: TerminalRepositories;
  readonly query: ListTerminalReadersQuery;
}): Promise<readonly TerminalReaderSnapshot[]> {
  const readers = input.query.locationId
    ? await input.repos.terminalReaders.listByLocation(
        input.query.environment,
        input.query.merchantAccountId,
        input.query.locationId,
      )
    : await input.repos.terminalReaders.listByMerchant(
        input.query.environment,
        input.query.merchantAccountId,
      );
  return Promise.all(
    readers.map(async (reader) => {
      const location = await getLocationInScope(
        input.uow,
        input.query.environment,
        input.query.merchantAccountId,
        reader.locationId,
      );
      return toReaderSnapshot(location, reader);
    }),
  );
}

async function createTerminalConnectionSessionSnapshot(input: {
  readonly uow: PaymentsUnitOfWork;
  readonly repos: TerminalRepositories;
  readonly command: CreateTerminalConnectionSessionCommand;
  readonly createId: TerminalCreateId;
  readonly timestamp: string;
}): Promise<TerminalConnectionSessionSnapshot> {
  return withIdempotentResult(
    input.uow,
    {
      environment: input.command.environment,
      scope: `terminal_connection:${input.command.merchantAccountId}:${input.command.locationId}`,
      idempotencyKey: input.command.idempotencyKey,
      request: input.command,
      createId: input.createId,
      now: input.timestamp,
    },
    async () => createTerminalConnectionSessionRecord(input),
  );
}

async function createTerminalConnectionSessionRecord(input: {
  readonly uow: PaymentsUnitOfWork;
  readonly repos: TerminalRepositories;
  readonly command: CreateTerminalConnectionSessionCommand;
  readonly createId: TerminalCreateId;
  readonly timestamp: string;
}): Promise<TerminalConnectionSessionSnapshot> {
  await getMerchantOrThrow(input.uow, input.command.environment, input.command.merchantAccountId);
  await ensureMerchantCanAcceptPayments(
    input.uow,
    input.command.environment,
    input.command.merchantAccountId,
  );
  const location = await getLocationInScope(
    input.uow,
    input.command.environment,
    input.command.merchantAccountId,
    input.command.locationId,
  );
  let nextAction = nextActionForLocation(location);
  if (input.command.readerId) {
    const reader = await getReaderInScope(
      input.uow,
      input.command.environment,
      input.command.merchantAccountId,
      input.command.readerId,
    );
    nextAction = nextActionForReader(location, reader);
    assertReaderReady(location, reader);
  }
  if (nextAction !== "none") {
    throw new TerminalServiceError("action_required", "terminal location is not ready", {
      details: { locationId: location.id, nextAction },
    });
  }
  const id = input.createId("tcs");
  const session: TerminalConnectionSession = {
    id,
    environment: input.command.environment,
    merchantAccountId: input.command.merchantAccountId,
    locationId: input.command.locationId,
    readerId: input.command.readerId,
    status: "issued",
    clientToken: `vtx_terminal_${id}`,
    expiresAt: new Date(Date.parse(input.timestamp) + 1000 * 60 * 15).toISOString(),
    createdByType: input.command.createdByType,
    createdByRef: input.command.createdByRef,
    processorRefs: [],
    createdAt: input.timestamp,
    updatedAt: input.timestamp,
  };
  await input.repos.terminalConnectionSessions.save(session);
  return toSessionSnapshot(session, "none");
}

async function createCardPresentPaymentIntentSnapshot(input: {
  readonly uow: PaymentsUnitOfWork;
  readonly repos: TerminalRepositories;
  readonly command: CreateCardPresentPaymentIntentCommand;
  readonly createId: TerminalCreateId;
  readonly timestamp: string;
}): Promise<CardPresentPaymentIntentSnapshot> {
  return withIdempotentResult(
    input.uow,
    {
      environment: input.command.environment,
      scope: `card_present_intent:${input.command.merchantAccountId}:${input.command.externalOrderRef ?? "manual"}`,
      idempotencyKey: input.command.idempotencyKey,
      request: input.command,
      createId: input.createId,
      now: input.timestamp,
    },
    async () => createCardPresentPaymentIntentRecord(input),
  );
}

async function createCardPresentPaymentIntentRecord(input: {
  readonly uow: PaymentsUnitOfWork;
  readonly repos: TerminalRepositories;
  readonly command: CreateCardPresentPaymentIntentCommand;
  readonly createId: TerminalCreateId;
  readonly timestamp: string;
}): Promise<CardPresentPaymentIntentSnapshot> {
  await getMerchantOrThrow(input.uow, input.command.environment, input.command.merchantAccountId);
  await ensureMerchantCanAcceptPayments(
    input.uow,
    input.command.environment,
    input.command.merchantAccountId,
  );
  const location = await getLocationInScope(
    input.uow,
    input.command.environment,
    input.command.merchantAccountId,
    input.command.locationId,
  );
  const reader = await getReaderInScope(
    input.uow,
    input.command.environment,
    input.command.merchantAccountId,
    input.command.readerId,
  );
  assertReaderReady(location, reader);
  if (input.command.amount <= 0) {
    throw new TerminalServiceError("invalid_request", "amount must be positive");
  }
  if (input.command.capturePolicy.tipAmount && !input.command.capturePolicy.allowTip) {
    throw new TerminalServiceError("invalid_request", "tip amount requires tip policy");
  }
  const intent: CardPresentPaymentIntent = {
    id: input.createId("cpi"),
    environment: input.command.environment,
    merchantAccountId: input.command.merchantAccountId,
    locationId: input.command.locationId,
    readerId: input.command.readerId,
    connectionSessionId: input.command.connectionSessionId,
    customerProfileId: input.command.customerProfileId,
    externalOrderRef: input.command.externalOrderRef,
    amount: input.command.amount,
    currency: input.command.currency,
    status: input.command.capturePolicy.captureMode === "manual" ? "authorized" : "captured",
    capturePolicy: input.command.capturePolicy,
    metadata: input.command.metadata,
    processorRefs: [],
    createdAt: input.timestamp,
    updatedAt: input.timestamp,
    authorizedAt: input.timestamp,
    capturedAt:
      input.command.capturePolicy.captureMode === "automatic" ? input.timestamp : undefined,
  };
  await input.repos.cardPresentPaymentIntents.save(intent);
  await input.uow.events.saveCanonicalEvent(
    createTerminalEvent({
      id: input.createId("evt"),
      eventType: "card_present_payment_intent.created",
      intent,
      occurredAt: input.timestamp,
    }),
  );
  return toIntentSnapshot(intent);
}

async function getCardPresentPaymentIntentSnapshot(
  repos: TerminalRepositories,
  query: GetCardPresentPaymentIntentQuery,
): Promise<CardPresentPaymentIntentSnapshot | null> {
  const intent = await repos.cardPresentPaymentIntents.getById(query.cardPresentPaymentIntentId, {
    environment: query.environment,
  });
  if (!intent || intent.merchantAccountId !== query.merchantAccountId) {
    return null;
  }
  return toIntentSnapshot(intent);
}

async function listCardPresentPaymentIntentSnapshots(
  repos: TerminalRepositories,
  query: ListCardPresentPaymentIntentsQuery,
): Promise<readonly CardPresentPaymentIntentSnapshot[]> {
  const records = await repos.cardPresentPaymentIntents.listByMerchant(
    query.environment,
    query.merchantAccountId,
  );
  return records
    .filter((record) => !query.status || record.status === query.status)
    .map(toIntentSnapshot);
}

async function captureCardPresentPaymentIntentSnapshot(input: {
  readonly uow: PaymentsUnitOfWork;
  readonly command: CaptureCardPresentPaymentIntentCommand;
  readonly createId: TerminalCreateId;
  readonly timestamp: string;
}): Promise<CardPresentPaymentIntentSnapshot> {
  return withIdempotentResult(
    input.uow,
    {
      environment: input.command.environment,
      scope: `card_present_capture:${input.command.cardPresentPaymentIntentId}`,
      idempotencyKey: input.command.idempotencyKey,
      request: input.command,
      createId: input.createId,
      now: input.timestamp,
    },
    async () => captureCardPresentPaymentIntentRecord(input),
  );
}

async function captureCardPresentPaymentIntentRecord(input: {
  readonly uow: PaymentsUnitOfWork;
  readonly command: CaptureCardPresentPaymentIntentCommand;
  readonly createId: TerminalCreateId;
  readonly timestamp: string;
}): Promise<CardPresentPaymentIntentSnapshot> {
  const intent = await getCardPresentIntentInScope(input.uow, input.command);
  if (!canCapture(intent)) {
    throw new TerminalServiceError("conflict", "card-present payment intent cannot be captured", {
      details: { cardPresentPaymentIntentId: intent.id, status: intent.status },
    });
  }
  const finalAmount =
    input.command.amount ??
    intent.amount + (input.command.tipAmount ?? intent.capturePolicy.tipAmount ?? 0);
  const tipAmount = input.command.tipAmount ?? intent.capturePolicy.tipAmount ?? 0;
  if (tipAmount > 0 && !intent.capturePolicy.allowTip) {
    throw new TerminalServiceError("invalid_request", "tip capture is not allowed", {
      details: { cardPresentPaymentIntentId: intent.id },
    });
  }
  if (finalAmount > intent.amount) {
    validateCardPresentOvercapture(intent, finalAmount);
  }
  const paymentId: PaymentId = input.createId("pay");
  const capturedIntent = createCapturedIntent({
    intent,
    finalAmount,
    paymentId,
    tipAmount,
    timestamp: input.timestamp,
  });
  await saveCapturedCardPresentIntent({
    uow: input.uow,
    createId: input.createId,
    intent: capturedIntent,
    occurredAt: input.timestamp,
  });
  return toIntentSnapshot(capturedIntent);
}

function validateCardPresentOvercapture(
  intent: CardPresentPaymentIntent,
  finalAmount: number,
): void {
  if (!intent.capturePolicy.allowOvercapture) {
    throw new TerminalServiceError("invalid_request", "overcapture is not allowed", {
      details: { cardPresentPaymentIntentId: intent.id },
    });
  }
  const max = intent.capturePolicy.maxOvercaptureAmount ?? intent.amount;
  if (finalAmount > max) {
    throw new TerminalServiceError("invalid_request", "capture amount exceeds overcapture limit", {
      details: { cardPresentPaymentIntentId: intent.id },
    });
  }
}

function createCapturedIntent(input: {
  readonly intent: CardPresentPaymentIntent;
  readonly finalAmount: number;
  readonly paymentId: PaymentId;
  readonly tipAmount: number;
  readonly timestamp: string;
}): CardPresentPaymentIntent {
  return {
    ...input.intent,
    amount: input.finalAmount,
    status: "captured",
    paymentId: input.paymentId,
    capturePolicy: {
      ...input.intent.capturePolicy,
      tipAmount: input.tipAmount,
    },
    updatedAt: input.timestamp,
    capturedAt: input.timestamp,
  };
}

async function saveCapturedCardPresentIntent(input: {
  readonly uow: PaymentsUnitOfWork;
  readonly createId: TerminalCreateId;
  readonly intent: CardPresentPaymentIntent;
  readonly occurredAt: string;
}): Promise<void> {
  const payment: Payment = {
    id: input.intent.paymentId,
    environment: input.intent.environment,
    merchantAccountId: input.intent.merchantAccountId,
    terminalSessionId: input.intent.connectionSessionId,
    terminalReaderId: input.intent.readerId,
    cardPresentPaymentIntentId: input.intent.id,
    customerProfileId: input.intent.customerProfileId,
    amount: input.intent.amount,
    currency: input.intent.currency,
    status: "captured",
    direction: "debit",
    authorizedAt: input.intent.authorizedAt,
    capturedAt: input.occurredAt,
    settlementEligibleAt: input.occurredAt,
    processorPaymentRefs: [],
    createdAt: input.occurredAt,
    updatedAt: input.occurredAt,
  };
  await input.uow.payments.save(payment);
  await requireTerminalRepositories(input.uow).cardPresentPaymentIntents.save(input.intent);
  await input.uow.events.saveCanonicalEvent(
    createTerminalEvent({
      id: input.createId("evt"),
      eventType: "card_present_payment_intent.captured",
      intent: input.intent,
      occurredAt: input.occurredAt,
    }),
  );
}

async function cancelCardPresentPaymentIntentSnapshot(input: {
  readonly uow: PaymentsUnitOfWork;
  readonly command: CancelCardPresentPaymentIntentCommand;
  readonly createId: TerminalCreateId;
  readonly timestamp: string;
}): Promise<CardPresentPaymentIntentSnapshot> {
  const intent = await getCardPresentIntentInScope(input.uow, input.command);
  if (!canCancel(intent)) {
    throw new TerminalServiceError("conflict", "card-present payment intent cannot be canceled", {
      details: { cardPresentPaymentIntentId: intent.id, status: intent.status },
    });
  }
  const canceled: CardPresentPaymentIntent = {
    ...intent,
    status: "canceled",
    updatedAt: input.timestamp,
    canceledAt: input.timestamp,
  };
  await requireTerminalRepositories(input.uow).cardPresentPaymentIntents.save(canceled);
  await input.uow.events.saveCanonicalEvent(
    createTerminalEvent({
      id: input.createId("evt"),
      eventType: "card_present_payment_intent.canceled",
      intent: canceled,
      occurredAt: input.timestamp,
    }),
  );
  return toIntentSnapshot(canceled);
}

export function createTerminalService(dependencies: TerminalServiceDependencies): TerminalService {
  const now = dependencies.now ?? (() => new Date().toISOString());
  const createId = dependencies.createId ?? createDefaultId;
  const uow = dependencies.uow;
  const repos = requireTerminalRepositories(uow);

  return {
    async createTerminalLocation(command) {
      return createTerminalLocationSnapshot({ uow, repos, command, createId, timestamp: now() });
    },

    async listTerminalLocations(query) {
      return listTerminalLocationSnapshots(repos, query);
    },

    async registerTerminalReader(command) {
      return registerTerminalReaderSnapshot({ uow, repos, command, createId, timestamp: now() });
    },

    async listTerminalReaders(query) {
      return listTerminalReaderSnapshots({ uow, repos, query });
    },

    async createTerminalConnectionSession(command) {
      return createTerminalConnectionSessionSnapshot({
        uow,
        repos,
        command,
        createId,
        timestamp: now(),
      });
    },

    async createCardPresentPaymentIntent(command) {
      return createCardPresentPaymentIntentSnapshot({
        uow,
        repos,
        command,
        createId,
        timestamp: now(),
      });
    },

    async getCardPresentPaymentIntent(query) {
      return getCardPresentPaymentIntentSnapshot(repos, query);
    },

    async listCardPresentPaymentIntents(query) {
      return listCardPresentPaymentIntentSnapshots(repos, query);
    },

    async captureCardPresentPaymentIntent(command) {
      return captureCardPresentPaymentIntentSnapshot({
        uow,
        command,
        createId,
        timestamp: now(),
      });
    },

    async cancelCardPresentPaymentIntent(command) {
      return cancelCardPresentPaymentIntentSnapshot({ uow, command, createId, timestamp: now() });
    },
  };
}
