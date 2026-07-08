import type { MerchantAccountId, PaymentMethodId, ProcessorRef } from "../../domain/common";
import type { MerchantAccount } from "../../domain/merchant";
import type { PaymentIntent } from "../../domain/payments";
import type {
  CustomerProfile,
  PaymentMethod,
  PaymentMethodSetupSession,
} from "../../domain/payment-methods";
import type { CanonicalDomainEvent } from "../../events/types";
import type {
  PaymentsProviderAdapter,
  ProviderContext,
  ProviderError,
  ProviderPaymentMethodOutput,
} from "../../providers/types";
import type { ProviderRegistry } from "../../providers/registry";
import type { PaymentsUnitOfWork } from "../../storage/unit-of-work";
import { deriveCustomerPaymentState } from "../state/derive-customer-payment-state";
import type {
  CreatePaymentMethodFromSetupCommand,
  CreatePaymentMethodSetupSessionCommand,
  CreatedPaymentMethodSnapshot,
  PaymentMethodSetupSessionSnapshot,
} from "./contracts";
import type { PaymentMethodSetupService } from "./service";

export class PaymentMethodSetupServiceError extends Error {
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
    code: PaymentMethodSetupServiceError["code"],
    message: string,
    options?: {
      retryable?: boolean;
      details?: Readonly<Record<string, string>>;
    },
  ) {
    super(message);
    this.name = "PaymentMethodSetupServiceError";
    this.code = code;
    this.retryable = options?.retryable ?? false;
    this.details = options?.details;
  }
}

export interface PaymentMethodSetupServiceDependencies {
  readonly uow: PaymentsUnitOfWork;
  readonly providers: ProviderRegistry;
  readonly resolveProviderContext: (merchant: MerchantAccount) => ProviderContext;
  readonly now?: () => string;
  readonly createId?: (prefix: "pmset" | "pmsec" | "pm" | "idem") => string;
  readonly setupSessionTtlMs?: number;
}

const DEFAULT_IDEMPOTENCY_TTL_MS = 1000 * 60 * 60 * 24;
const DEFAULT_SETUP_SESSION_TTL_MS = 1000 * 60 * 30;

type PaymentMethodSetupCreateId = NonNullable<PaymentMethodSetupServiceDependencies["createId"]>;
type CreatePaymentMethod = NonNullable<PaymentsProviderAdapter["createPaymentMethod"]>;

interface PaymentMethodSetupRuntime {
  readonly uow: PaymentsUnitOfWork;
  readonly providers: ProviderRegistry;
  readonly resolveProviderContext: (merchant: MerchantAccount) => ProviderContext;
  readonly now: () => string;
  readonly createId: PaymentMethodSetupCreateId;
  readonly setupSessionTtlMs: number;
}

interface SetupIdempotencyContext {
  readonly scope: string;
  readonly requestHash: string;
}

interface SetupOwnerContext {
  readonly customer: CustomerProfile | null;
  readonly providerContext: ProviderContext;
}

function createDefaultId(prefix: "pmset" | "pmsec" | "pm" | "idem"): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
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
      left.localeCompare(right),
    );
    return `{${entries
      .map(([key, entryValue]) => `${JSON.stringify(key)}:${stableStringify(entryValue)}`)
      .join(",")}}`;
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

function mapProviderError(error: ProviderError): PaymentMethodSetupServiceError {
  switch (error.category) {
    case "invalid_request":
      return new PaymentMethodSetupServiceError("invalid_request", error.message, {
        retryable: error.retryable,
        details: { provider: error.provider, code: error.code },
      });
    case "action_required":
      return new PaymentMethodSetupServiceError("action_required", error.message, {
        retryable: error.retryable,
        details: { provider: error.provider, code: error.code },
      });
    case "authentication_failed":
    case "rate_limited":
    case "temporarily_unavailable":
    case "unknown":
    case "not_supported":
    default:
      return new PaymentMethodSetupServiceError("provider_unavailable", error.message, {
        retryable: error.retryable,
        details: { provider: error.provider, code: error.code },
      });
  }
}

function toSetupSessionSnapshot(
  record: PaymentMethodSetupSession,
): PaymentMethodSetupSessionSnapshot {
  return {
    id: record.id,
    environment: record.environment,
    merchantAccountId: record.merchantAccountId,
    ownerType: record.ownerType,
    ownerId: record.ownerId,
    methodType: record.methodType,
    status: record.status,
    clientSecret: record.clientSecret,
    setAsDefault: record.setAsDefault,
    expiresAt: record.expiresAt,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  };
}

function dedupeProcessorRefs(refs: readonly ProcessorRef[]): readonly ProcessorRef[] {
  const seen = new Set<string>();
  return refs.filter((ref) => {
    const key = `${ref.provider}:${ref.objectType}:${ref.objectId}:${ref.relationship}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function createPaymentMethodCreatedEvent(input: {
  readonly paymentMethod: PaymentMethod;
  readonly setupSessionId: string;
  readonly occurredAt: string;
}): CanonicalDomainEvent {
  return {
    id: `${input.paymentMethod.id}:payment_method.created:${input.occurredAt}`,
    environment: input.paymentMethod.environment,
    eventType: "payment_method.created",
    aggregateType: "payment_method",
    aggregateId: input.paymentMethod.id,
    occurredAt: input.occurredAt,
    sourceProvider: "vortex",
    payload: {
      merchantAccountId: input.paymentMethod.merchantAccountId ?? null,
      ownerType: input.paymentMethod.ownerType,
      ownerId: input.paymentMethod.ownerId,
      paymentMethodId: input.paymentMethod.id,
      paymentMethodStatus: input.paymentMethod.status,
      isDefault: input.paymentMethod.isDefault,
      methodType: input.paymentMethod.methodType,
      setupSessionId: input.setupSessionId,
      brandSummary: input.paymentMethod.brandSummary ?? null,
      last4: input.paymentMethod.last4 ?? null,
    },
    createdAt: input.occurredAt,
  };
}

function toPaymentMethodSnapshot(record: PaymentMethod): CreatedPaymentMethodSnapshot {
  return {
    id: record.id,
    merchantAccountId: record.merchantAccountId,
    ownerType: record.ownerType,
    ownerId: record.ownerId,
    methodType: record.methodType,
    status: record.status,
    isDefault: record.isDefault,
    brandSummary: record.brandSummary,
    last4: record.last4,
    expiryMonth: record.expiryMonth,
    expiryYear: record.expiryYear,
  };
}

async function getMerchantOrThrow(
  uow: PaymentsUnitOfWork,
  environment: CreatePaymentMethodSetupSessionCommand["environment"],
  merchantAccountId: MerchantAccountId,
): Promise<MerchantAccount> {
  const merchant = await uow.merchants.getById(merchantAccountId, { environment });
  if (!merchant) {
    throw new PaymentMethodSetupServiceError("not_found", "merchant account not found", {
      details: { merchantAccountId },
    });
  }
  return merchant;
}

async function getCustomerProfileOrThrow(
  uow: PaymentsUnitOfWork,
  environment: CreatePaymentMethodSetupSessionCommand["environment"],
  merchantAccountId: MerchantAccountId,
  customerProfileId: string,
) {
  const customer = await uow.customers.getById(customerProfileId, { environment });
  if (!customer || customer.merchantAccountId !== merchantAccountId) {
    throw new PaymentMethodSetupServiceError("not_found", "customer profile not found", {
      details: { customerProfileId, merchantAccountId },
    });
  }
  return customer;
}

async function deriveAndPersistCustomerState(
  uow: PaymentsUnitOfWork,
  environment: CreatePaymentMethodFromSetupCommand["environment"],
  merchantAccountId: MerchantAccountId,
  customerProfileId: string,
  paymentMethods: readonly PaymentMethod[],
  generatedAt: string,
): Promise<void> {
  const paymentIntents: readonly PaymentIntent[] = await uow.paymentIntents.listByCustomerProfile(
    environment,
    merchantAccountId,
    customerProfileId,
  );
  await uow.customerStates.save(
    deriveCustomerPaymentState({
      environment,
      merchantAccountId,
      customerProfileId,
      paymentMethods,
      paymentIntents,
      generatedAt,
    }),
  );
}

async function assertSetupOwnerExists(
  runtime: PaymentMethodSetupRuntime,
  command: CreatePaymentMethodSetupSessionCommand,
): Promise<MerchantAccount> {
  const merchant = await getMerchantOrThrow(
    runtime.uow,
    command.environment,
    command.merchantAccountId,
  );
  if (command.ownerType === "customer") {
    await getCustomerProfileOrThrow(
      runtime.uow,
      command.environment,
      command.merchantAccountId,
      command.ownerId,
    );
  }
  return merchant;
}

function getPaymentMethodCreatorOrThrow(
  adapter: PaymentsProviderAdapter,
  providerContext: ProviderContext,
): CreatePaymentMethod {
  if (!adapter.createPaymentMethod) {
    throw new PaymentMethodSetupServiceError(
      "provider_unavailable",
      "provider does not implement payment method creation",
      { details: { provider: providerContext.provider } },
    );
  }
  return adapter.createPaymentMethod;
}

function assertProviderSupportsPaymentMethodSetup(
  adapter: PaymentsProviderAdapter,
  providerContext: ProviderContext,
): void {
  if (!adapter.supportedCapabilities.includes("payment_methods") || !adapter.createPaymentMethod) {
    throw new PaymentMethodSetupServiceError(
      "provider_unavailable",
      "provider does not support payment methods",
      { details: { provider: providerContext.provider } },
    );
  }
}

function buildSetupSession(
  runtime: PaymentMethodSetupRuntime,
  command: CreatePaymentMethodSetupSessionCommand,
  providerContext: ProviderContext,
): PaymentMethodSetupSession {
  const createdAt = runtime.now();
  return {
    id: runtime.createId("pmset"),
    environment: command.environment,
    merchantAccountId: command.merchantAccountId,
    ownerType: command.ownerType,
    ownerId: command.ownerId,
    methodType: command.methodType,
    provider: providerContext.provider,
    clientSecret: runtime.createId("pmsec"),
    status: "pending_tokenization",
    setAsDefault: command.setAsDefault ?? false,
    expiresAt: new Date(Date.parse(createdAt) + runtime.setupSessionTtlMs).toISOString(),
    createdAt,
    updatedAt: createdAt,
  };
}

async function createPaymentMethodSetupSession(
  runtime: PaymentMethodSetupRuntime,
  command: CreatePaymentMethodSetupSessionCommand,
): Promise<PaymentMethodSetupSessionSnapshot> {
  const merchant = await assertSetupOwnerExists(runtime, command);
  const providerContext = runtime.resolveProviderContext(merchant);
  const adapter = runtime.providers.getAdapter(providerContext.provider);
  assertProviderSupportsPaymentMethodSetup(adapter, providerContext);

  const session = buildSetupSession(runtime, command, providerContext);
  await runtime.uow.paymentMethodSetupSessions.save(session);
  return toSetupSessionSnapshot(session);
}

async function getSetupSessionOrThrow(
  uow: PaymentsUnitOfWork,
  command: CreatePaymentMethodFromSetupCommand,
): Promise<PaymentMethodSetupSession> {
  const session = await uow.paymentMethodSetupSessions.getById(
    command.paymentMethodSetupSessionId,
    { environment: command.environment },
  );
  if (!session) {
    throw new PaymentMethodSetupServiceError(
      "not_found",
      "payment method setup session not found",
      {
        details: { paymentMethodSetupSessionId: command.paymentMethodSetupSessionId },
      },
    );
  }
  return session;
}

function buildSetupIdempotencyContext(
  session: PaymentMethodSetupSession,
  command: CreatePaymentMethodFromSetupCommand,
): SetupIdempotencyContext {
  return {
    scope: `payment_method_setup:${session.id}`,
    requestHash: hashRequest({
      sessionId: session.id,
      setupToken: command.setupToken,
    }),
  };
}

async function replayIdempotentPaymentMethod(
  uow: PaymentsUnitOfWork,
  command: CreatePaymentMethodFromSetupCommand,
  idempotency: SetupIdempotencyContext,
): Promise<CreatedPaymentMethodSnapshot | null> {
  if (!command.idempotencyKey) {
    return null;
  }
  const existing = await uow.idempotency.getByScopeAndKey(
    command.environment,
    idempotency.scope,
    command.idempotencyKey,
  );
  if (!existing) {
    return null;
  }
  if (existing.requestHash !== idempotency.requestHash) {
    throw new PaymentMethodSetupServiceError(
      "conflict",
      "idempotency key reused with different payment method setup request",
      { details: { idempotencyKey: command.idempotencyKey } },
    );
  }
  const replay = await uow.paymentMethods.getById(existing.responseRef as PaymentMethodId, {
    environment: command.environment,
  });
  if (!replay) {
    throw new PaymentMethodSetupServiceError(
      "internal_error",
      "payment method idempotency record points to missing payment method",
      { details: { paymentMethodId: existing.responseRef } },
    );
  }
  return toPaymentMethodSnapshot(replay);
}

async function assertSetupSessionConsumable(
  uow: PaymentsUnitOfWork,
  session: PaymentMethodSetupSession,
  currentTime: string,
): Promise<void> {
  if (session.status === "consuming") {
    throw new PaymentMethodSetupServiceError(
      "conflict",
      "payment method setup session is already being consumed",
      { details: { paymentMethodSetupSessionId: session.id } },
    );
  }
  if (session.status === "consumed") {
    throw new PaymentMethodSetupServiceError(
      "conflict",
      "payment method setup session already consumed",
      {
        details: { paymentMethodSetupSessionId: session.id },
      },
    );
  }
  if (Date.parse(session.expiresAt) <= Date.parse(currentTime)) {
    await uow.paymentMethodSetupSessions.save({
      ...session,
      status: "expired",
      updatedAt: currentTime,
    });
    throw new PaymentMethodSetupServiceError("conflict", "payment method setup session expired", {
      details: { paymentMethodSetupSessionId: session.id },
    });
  }
}

async function getSetupOwnerContext(
  runtime: PaymentMethodSetupRuntime,
  uow: PaymentsUnitOfWork,
  command: CreatePaymentMethodFromSetupCommand,
  session: PaymentMethodSetupSession,
): Promise<SetupOwnerContext> {
  const merchant = await getMerchantOrThrow(uow, command.environment, session.merchantAccountId);
  const customer =
    session.ownerType === "customer"
      ? await getCustomerProfileOrThrow(
          uow,
          command.environment,
          session.merchantAccountId,
          session.ownerId,
        )
      : null;
  const providerContext = runtime.resolveProviderContext(merchant);
  if (providerContext.provider !== session.provider) {
    throw new PaymentMethodSetupServiceError(
      "conflict",
      "payment method setup session provider mismatch",
      { details: { paymentMethodSetupSessionId: session.id } },
    );
  }
  return { customer, providerContext };
}

async function markSetupSessionStatus(
  uow: PaymentsUnitOfWork,
  session: PaymentMethodSetupSession,
  status: PaymentMethodSetupSession["status"],
  updatedAt: string,
): Promise<void> {
  await uow.paymentMethodSetupSessions.save({
    ...session,
    status,
    updatedAt,
  });
}

async function createProviderPaymentMethodOrThrow(
  runtime: PaymentMethodSetupRuntime,
  uow: PaymentsUnitOfWork,
  command: CreatePaymentMethodFromSetupCommand,
  session: PaymentMethodSetupSession,
  ownerContext: SetupOwnerContext,
): Promise<ProviderPaymentMethodOutput> {
  const adapter = runtime.providers.getAdapter(ownerContext.providerContext.provider);
  const createPaymentMethod = getPaymentMethodCreatorOrThrow(adapter, ownerContext.providerContext);
  const providerResult = await createPaymentMethod(ownerContext.providerContext, {
    merchantAccountId: session.merchantAccountId,
    ownerType: session.ownerType,
    ownerId: session.ownerId,
    ownerRef: ownerContext.customer?.processorCustomerRefs.find(
      (ref) => ref.provider === ownerContext.providerContext.provider,
    ),
    methodType: session.methodType,
    setupToken: command.setupToken,
  });
  if (providerResult.ok && providerResult.value) {
    return providerResult.value;
  }
  await markSetupSessionStatus(uow, session, "failed", runtime.now());
  throw mapProviderError(
    providerResult.error ?? {
      provider: ownerContext.providerContext.provider,
      category: "unknown",
      code: "provider_result_missing",
      message: "provider payment method creation failed without error details",
      retryable: false,
    },
  );
}

async function listScopedPaymentMethods(
  uow: PaymentsUnitOfWork,
  command: CreatePaymentMethodFromSetupCommand,
  session: PaymentMethodSetupSession,
): Promise<readonly PaymentMethod[]> {
  const existingMethods = await uow.paymentMethods.listByOwner(
    command.environment,
    session.ownerType,
    session.ownerId,
  );
  return existingMethods.filter(
    (paymentMethod) =>
      paymentMethod.ownerType === session.ownerType &&
      paymentMethod.ownerId === session.ownerId &&
      (paymentMethod.merchantAccountId === undefined ||
        paymentMethod.merchantAccountId === session.merchantAccountId),
  );
}

function shouldMakePaymentMethodDefault(
  session: PaymentMethodSetupSession,
  scopedMethods: readonly PaymentMethod[],
): boolean {
  return (
    session.setAsDefault ||
    !scopedMethods.some(
      (paymentMethod) => paymentMethod.status === "active" && paymentMethod.isDefault,
    )
  );
}

function buildPaymentMethodRecord(input: {
  readonly id: PaymentMethodId;
  readonly command: CreatePaymentMethodFromSetupCommand;
  readonly session: PaymentMethodSetupSession;
  readonly providerOutput: ProviderPaymentMethodOutput;
  readonly isDefault: boolean;
}): PaymentMethod {
  return {
    id: input.id,
    environment: input.command.environment,
    merchantAccountId: input.session.merchantAccountId,
    ownerType: input.session.ownerType,
    ownerId: input.session.ownerId,
    methodType: input.providerOutput.methodType,
    brandSummary: input.providerOutput.brandSummary,
    last4: input.providerOutput.last4,
    expiryMonth: input.providerOutput.expiryMonth,
    expiryYear: input.providerOutput.expiryYear,
    status: input.providerOutput.status === "active" ? "active" : "disabled",
    isDefault: input.isDefault && input.providerOutput.status === "active",
    fingerprint: input.providerOutput.fingerprint,
    processorInstrumentRefs: [input.providerOutput.paymentMethodRef],
    createdAt: input.providerOutput.recordedAt,
    updatedAt: input.providerOutput.recordedAt,
    archivedAt: undefined,
  };
}

async function savePaymentMethodWithDefaultState(
  uow: PaymentsUnitOfWork,
  paymentMethod: PaymentMethod,
  scopedMethods: readonly PaymentMethod[],
): Promise<readonly PaymentMethod[]> {
  const resultingMethods: PaymentMethod[] = [];
  for (const method of scopedMethods) {
    if (paymentMethod.isDefault && method.isDefault) {
      const updatedMethod = {
        ...method,
        isDefault: false,
        updatedAt: paymentMethod.createdAt,
      };
      await uow.paymentMethods.save(updatedMethod);
      resultingMethods.push(updatedMethod);
    } else {
      resultingMethods.push(method);
    }
  }
  await uow.paymentMethods.save(paymentMethod);
  resultingMethods.push(paymentMethod);
  return resultingMethods;
}

async function saveCustomerOwnerRef(
  uow: PaymentsUnitOfWork,
  customer: CustomerProfile | null,
  providerOutput: ProviderPaymentMethodOutput,
): Promise<void> {
  if (!customer || !providerOutput.ownerRef) {
    return;
  }
  await uow.customers.save({
    ...customer,
    processorCustomerRefs: dedupeProcessorRefs([
      ...customer.processorCustomerRefs,
      providerOutput.ownerRef,
    ]),
    updatedAt: providerOutput.recordedAt,
  });
}

async function markSetupSessionConsumed(
  uow: PaymentsUnitOfWork,
  session: PaymentMethodSetupSession,
  paymentMethod: PaymentMethod,
): Promise<void> {
  await uow.paymentMethodSetupSessions.save({
    ...session,
    status: "consumed",
    updatedAt: paymentMethod.createdAt,
    consumedAt: paymentMethod.createdAt,
    attachedPaymentMethodId: paymentMethod.id,
  });
}

async function persistPaymentMethodSideEffects(input: {
  readonly uow: PaymentsUnitOfWork;
  readonly command: CreatePaymentMethodFromSetupCommand;
  readonly session: PaymentMethodSetupSession;
  readonly paymentMethod: PaymentMethod;
  readonly resultingMethods: readonly PaymentMethod[];
}): Promise<void> {
  if (input.session.ownerType === "customer") {
    await deriveAndPersistCustomerState(
      input.uow,
      input.command.environment,
      input.session.merchantAccountId,
      input.session.ownerId,
      input.resultingMethods,
      input.paymentMethod.createdAt,
    );
  }
  await input.uow.events.saveCanonicalEvent(
    createPaymentMethodCreatedEvent({
      paymentMethod: input.paymentMethod,
      setupSessionId: input.session.id,
      occurredAt: input.paymentMethod.createdAt,
    }),
  );
}

async function saveSetupIdempotency(
  runtime: PaymentMethodSetupRuntime,
  uow: PaymentsUnitOfWork,
  command: CreatePaymentMethodFromSetupCommand,
  idempotency: SetupIdempotencyContext,
  paymentMethod: PaymentMethod,
): Promise<void> {
  if (!command.idempotencyKey) {
    return;
  }
  await uow.idempotency.save({
    id: runtime.createId("idem"),
    environment: command.environment,
    scope: idempotency.scope,
    idempotencyKey: command.idempotencyKey,
    requestHash: idempotency.requestHash,
    responseRef: paymentMethod.id,
    createdAt: paymentMethod.createdAt,
    expiresAt: new Date(
      Date.parse(paymentMethod.createdAt) + DEFAULT_IDEMPOTENCY_TTL_MS,
    ).toISOString(),
  });
}

async function createPaymentMethodFromSetup(
  runtime: PaymentMethodSetupRuntime,
  command: CreatePaymentMethodFromSetupCommand,
): Promise<CreatedPaymentMethodSnapshot> {
  return runtime.uow.runInTransaction(async (uow) => {
    const session = await getSetupSessionOrThrow(uow, command);
    const idempotency = buildSetupIdempotencyContext(session, command);
    const replay = await replayIdempotentPaymentMethod(uow, command, idempotency);
    if (replay) {
      return replay;
    }

    await assertSetupSessionConsumable(uow, session, runtime.now());
    const ownerContext = await getSetupOwnerContext(runtime, uow, command, session);
    await markSetupSessionStatus(uow, session, "consuming", runtime.now());

    const providerOutput = await createProviderPaymentMethodOrThrow(
      runtime,
      uow,
      command,
      session,
      ownerContext,
    );
    const scopedMethods = await listScopedPaymentMethods(uow, command, session);
    const paymentMethod = buildPaymentMethodRecord({
      id: runtime.createId("pm"),
      command,
      session,
      providerOutput,
      isDefault: shouldMakePaymentMethodDefault(session, scopedMethods),
    });
    const resultingMethods = await savePaymentMethodWithDefaultState(
      uow,
      paymentMethod,
      scopedMethods,
    );

    await saveCustomerOwnerRef(uow, ownerContext.customer, providerOutput);
    await markSetupSessionConsumed(uow, session, paymentMethod);
    await persistPaymentMethodSideEffects({
      uow,
      command,
      session,
      paymentMethod,
      resultingMethods,
    });
    await saveSetupIdempotency(runtime, uow, command, idempotency, paymentMethod);
    return toPaymentMethodSnapshot(paymentMethod);
  });
}

export function createPaymentMethodSetupService(
  dependencies: PaymentMethodSetupServiceDependencies,
): PaymentMethodSetupService {
  const runtime: PaymentMethodSetupRuntime = {
    uow: dependencies.uow,
    providers: dependencies.providers,
    resolveProviderContext: dependencies.resolveProviderContext,
    now: dependencies.now ?? (() => new Date().toISOString()),
    createId: dependencies.createId ?? createDefaultId,
    setupSessionTtlMs: dependencies.setupSessionTtlMs ?? DEFAULT_SETUP_SESSION_TTL_MS,
  };

  return {
    async createPaymentMethodSetupSession(
      command: CreatePaymentMethodSetupSessionCommand,
    ): Promise<PaymentMethodSetupSessionSnapshot> {
      return createPaymentMethodSetupSession(runtime, command);
    },

    async createPaymentMethodFromSetup(
      command: CreatePaymentMethodFromSetupCommand,
    ): Promise<CreatedPaymentMethodSnapshot> {
      return createPaymentMethodFromSetup(runtime, command);
    },
  };
}
