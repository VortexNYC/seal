import type {
  MerchantAccountId,
  PaymentIntentId,
  PaymentMethodId,
  ProcessorRef,
} from "../../domain/common";
import type { MerchantAccount } from "../../domain/merchant";
import type { PaymentMethod } from "../../domain/payment-methods";
import type {
  Payment,
  PaymentIntent,
  PaymentIntentNextStep,
  PaymentIntentStatus,
  PaymentStatus,
} from "../../domain/payments";
import type { CanonicalDomainEvent } from "../../events/types";
import type {
  PaymentsProviderAdapter,
  ProviderCancelPaymentIntentOutput,
  ProviderCapturePaymentIntentOutput,
  ProviderContext,
  ProviderError,
  ProviderPaymentIntentOutput,
} from "../../providers/types";
import type { ProviderRegistry } from "../../providers/registry";
import type { PaymentsUnitOfWork } from "../../storage/unit-of-work";
import { deriveCustomerPaymentState } from "../state/derive-customer-payment-state";
import type {
  CancelPaymentIntentCommand,
  CapturePaymentIntentCommand,
  CreatePaymentIntentCommand,
  GetPaymentIntentQuery,
  ListPaymentIntentsQuery,
  PaymentIntentSnapshot,
  RetryPaymentIntentCommand,
} from "./contracts";
import type { PaymentsService } from "./service";

export class PaymentsServiceError extends Error {
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
    code: PaymentsServiceError["code"],
    message: string,
    options?: {
      retryable?: boolean;
      details?: Readonly<Record<string, string>>;
    },
  ) {
    super(message);
    this.name = "PaymentsServiceError";
    this.code = code;
    this.retryable = options?.retryable ?? false;
    this.details = options?.details;
  }
}

export interface PaymentsServiceDependencies {
  readonly uow: PaymentsUnitOfWork;
  readonly providers: ProviderRegistry;
  readonly listPaymentMethods: (query: {
    readonly environment: CreatePaymentIntentCommand["environment"];
    readonly merchantAccountId: MerchantAccountId;
    readonly customerProfileId?: CreatePaymentIntentCommand["customerProfileId"];
  }) => Promise<readonly PaymentMethod[]>;
  readonly resolveProviderContext: (merchant: MerchantAccount) => ProviderContext;
  readonly now?: () => string;
  readonly createId?: (prefix: "pi" | "pay" | "idem") => string;
}

const DEFAULT_IDEMPOTENCY_TTL_MS = 1000 * 60 * 60 * 24;

function createDefaultId(prefix: "pi" | "pay" | "idem"): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function createPaymentEvent(input: {
  readonly id: string;
  readonly eventType: CanonicalDomainEvent["eventType"];
  readonly paymentIntent: PaymentIntent;
  readonly payment: Payment;
  readonly occurredAt: string;
}): CanonicalDomainEvent {
  return {
    id: input.id,
    environment: input.payment.environment,
    eventType: input.eventType,
    aggregateType: "payment",
    aggregateId: input.payment.id,
    occurredAt: input.occurredAt,
    sourceProvider: "vortex",
    payload: {
      merchantAccountId: input.payment.merchantAccountId,
      customerProfileId: input.payment.customerProfileId ?? null,
      paymentIntentId: input.paymentIntent.id,
      paymentId: input.payment.id,
      paymentStatus: input.payment.status,
      paymentIntentStatus: input.paymentIntent.status,
      amount: input.payment.amount,
      currency: input.payment.currency,
    },
    createdAt: input.occurredAt,
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

function mapProviderError(error: ProviderError): PaymentsServiceError {
  switch (error.category) {
    case "invalid_request":
      return new PaymentsServiceError("invalid_request", error.message, {
        retryable: error.retryable,
        details: { provider: error.provider, code: error.code },
      });
    case "action_required":
      return new PaymentsServiceError("action_required", error.message, {
        retryable: error.retryable,
        details: { provider: error.provider, code: error.code },
      });
    case "authentication_failed":
    case "rate_limited":
    case "temporarily_unavailable":
    case "unknown":
    case "not_supported":
    default:
      return new PaymentsServiceError("provider_unavailable", error.message, {
        retryable: error.retryable,
        details: { provider: error.provider, code: error.code },
      });
  }
}

function mapProviderPaymentIntentStatus(status: string): PaymentIntentStatus {
  switch (status) {
    case "requires_action":
    case "action_required":
      return "requires_action";
    case "authorized":
    case "requires_capture":
      return "authorized";
    case "captured":
    case "succeeded":
      return "captured";
    case "failed":
    case "declined":
      return "failed";
    case "canceled":
    case "cancelled":
      return "canceled";
    case "pending":
    case "processing":
    default:
      return "pending";
  }
}

function mapPaymentStatus(status: PaymentIntentStatus): PaymentStatus {
  switch (status) {
    case "requires_action":
      return "requires_action";
    case "authorized":
      return "authorized";
    case "captured":
      return "captured";
    case "failed":
      return "failed";
    case "canceled":
      return "canceled";
    case "pending":
    default:
      return "pending";
  }
}

function shouldPersistFailedProviderResult(error: ProviderError): boolean {
  return (
    error.category === "invalid_request" &&
    error.retryable === false &&
    typeof error.rawRef === "string" &&
    error.rawRef.length > 0
  );
}

function createFailedProcessorRef(
  error: ProviderError,
  provider: ProviderContext["provider"],
  recordedAt: string,
): ProcessorRef {
  return {
    provider,
    objectType: "authorization",
    objectId: error.rawRef ?? "unknown",
    relationship: "payment_intent",
    recordedAt,
  };
}

function readHostedActionUrl(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }
  return value.startsWith("http://") || value.startsWith("https://") ? value : undefined;
}

function canCapturePaymentIntent(record: PaymentIntent): boolean {
  return record.captureMode === "manual" && record.status === "authorized";
}

function canCancelPaymentIntent(record: PaymentIntent): boolean {
  return (
    record.captureMode === "manual" &&
    (record.status === "pending" ||
      record.status === "requires_action" ||
      record.status === "authorized")
  );
}

function canRetryPaymentIntent(record: PaymentIntent): boolean {
  return record.status === "failed" || record.status === "canceled";
}

function getPaymentIntentNextStep(record: PaymentIntent): PaymentIntentNextStep {
  if (record.status === "requires_action") {
    return "complete_required_action";
  }
  if (canRetryPaymentIntent(record)) {
    return "retry";
  }
  if (canCapturePaymentIntent(record)) {
    return "capture";
  }
  if (canCancelPaymentIntent(record)) {
    return "cancel";
  }
  return "none";
}

function toSnapshot(
  record: PaymentIntent,
  input?: {
    paymentId?: string;
    paymentMethodId?: PaymentMethodId;
  },
): PaymentIntentSnapshot {
  return {
    id: record.id,
    paymentId: input?.paymentId,
    merchantAccountId: record.merchantAccountId,
    customerProfileId: record.customerProfileId,
    paymentMethodId: input?.paymentMethodId,
    status: record.status,
    amount: record.amount,
    currency: record.currency,
    requiresAction: record.status === "requires_action",
    canCapture: canCapturePaymentIntent(record),
    canCancel: canCancelPaymentIntent(record),
    canRetry: canRetryPaymentIntent(record),
    nextStep: getPaymentIntentNextStep(record),
    nextActionType: record.nextActionType,
    hostedActionUrl: record.hostedActionUrl,
  };
}

async function getMerchantOrThrow(
  uow: PaymentsUnitOfWork,
  environment: CreatePaymentIntentCommand["environment"],
  merchantAccountId: MerchantAccountId,
): Promise<MerchantAccount> {
  const merchant = await uow.merchants.getById(merchantAccountId, { environment });
  if (!merchant) {
    throw new PaymentsServiceError("not_found", "merchant account not found", {
      details: { merchantAccountId },
    });
  }
  return merchant;
}

function selectMerchantRef(
  merchant: MerchantAccount,
  provider: ProviderContext["provider"],
): ProcessorRef {
  const merchantRef = merchant.processorAccountRefs.find(
    (processorRef) => processorRef.provider === provider,
  );
  if (!merchantRef) {
    throw new PaymentsServiceError(
      "invalid_request",
      "merchant is missing provider merchant reference",
      {
        details: {
          merchantAccountId: merchant.id,
          provider,
        },
      },
    );
  }
  return merchantRef;
}

function selectPaymentMethodId(
  command: CreatePaymentIntentCommand,
  paymentMethods: readonly PaymentMethod[],
  now: string,
): PaymentMethodId {
  if (command.customerProfileId) {
    const customerState = deriveCustomerPaymentState({
      customerProfileId: command.customerProfileId,
      merchantAccountId: command.merchantAccountId,
      environment: command.environment,
      paymentMethods,
      generatedAt: now,
    });

    if (command.paymentMethodId) {
      const selected = paymentMethods.find(
        (paymentMethod) =>
          paymentMethod.id === command.paymentMethodId &&
          paymentMethod.status === "active" &&
          paymentMethod.ownerType === "customer" &&
          paymentMethod.ownerId === command.customerProfileId,
      );

      if (!selected) {
        throw new PaymentsServiceError(
          "invalid_request",
          "payment method is not active for customer",
          {
            details: { paymentMethodId: command.paymentMethodId },
          },
        );
      }

      return selected.id;
    }

    if (customerState.defaultPaymentMethodId) {
      return customerState.defaultPaymentMethodId;
    }

    const firstActive = paymentMethods.find(
      (paymentMethod) =>
        paymentMethod.ownerType === "customer" &&
        paymentMethod.ownerId === command.customerProfileId &&
        paymentMethod.status === "active",
    );

    if (!firstActive) {
      throw new PaymentsServiceError("action_required", "customer has no active payment method", {
        details: { customerProfileId: command.customerProfileId },
      });
    }

    return firstActive.id;
  }

  if (!command.paymentMethodId) {
    throw new PaymentsServiceError("invalid_request", "payment method id is required", {
      details: { merchantAccountId: command.merchantAccountId },
    });
  }

  const selected = paymentMethods.find(
    (paymentMethod) =>
      paymentMethod.id === command.paymentMethodId && paymentMethod.status === "active",
  );

  if (!selected) {
    throw new PaymentsServiceError("invalid_request", "payment method is not active", {
      details: { paymentMethodId: command.paymentMethodId },
    });
  }

  return selected.id;
}

function selectPaymentMethodRef(
  paymentMethod: PaymentMethod | undefined,
  provider: ProviderContext["provider"],
  paymentMethodId: PaymentMethodId,
): ProcessorRef {
  const paymentMethodRef = paymentMethod?.processorInstrumentRefs.find(
    (processorRef) => processorRef.provider === provider,
  );
  if (!paymentMethodRef) {
    throw new PaymentsServiceError(
      "invalid_request",
      "payment method is missing provider payment instrument reference",
      {
        details: {
          paymentMethodId,
          provider,
        },
      },
    );
  }
  return paymentMethodRef;
}

async function withIdempotentResult<TResult>(
  uow: PaymentsUnitOfWork,
  options: {
    environment: CreatePaymentIntentCommand["environment"];
    scope: string;
    idempotencyKey?: string;
    request: unknown;
    createId: (prefix: "idem") => string;
    now: string;
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
      throw new PaymentsServiceError("conflict", "idempotency key reused with different request", {
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

async function getPaymentIntentInScope(
  uow: PaymentsUnitOfWork,
  command: {
    readonly environment: CreatePaymentIntentCommand["environment"];
    readonly merchantAccountId: MerchantAccountId;
    readonly paymentIntentId: PaymentIntentId;
  },
): Promise<PaymentIntent> {
  const record = await uow.paymentIntents.getById(command.paymentIntentId, {
    environment: command.environment,
  });
  if (!record || record.merchantAccountId !== command.merchantAccountId) {
    throw new PaymentsServiceError("not_found", "payment intent not found", {
      details: { paymentIntentId: command.paymentIntentId },
    });
  }
  return record;
}

function selectPaymentIntentRef(
  record: PaymentIntent,
  provider: ProviderContext["provider"],
): ProcessorRef {
  const paymentIntentRef = record.processorIntentRefs.find(
    (processorRef) => processorRef.provider === provider,
  );
  if (!paymentIntentRef) {
    throw new PaymentsServiceError(
      "invalid_request",
      "payment intent is missing provider reference",
      {
        details: { paymentIntentId: record.id, provider },
      },
    );
  }
  return paymentIntentRef;
}

async function saveCustomerPaymentStateForIntent(
  dependencies: PaymentsServiceDependencies,
  uow: PaymentsUnitOfWork,
  paymentIntent: PaymentIntent,
): Promise<void> {
  if (!paymentIntent.customerProfileId) {
    return;
  }
  const paymentMethods = await dependencies.listPaymentMethods({
    environment: paymentIntent.environment,
    merchantAccountId: paymentIntent.merchantAccountId,
    customerProfileId: paymentIntent.customerProfileId,
  });
  const paymentIntents = await uow.paymentIntents.listByCustomerProfile(
    paymentIntent.environment,
    paymentIntent.merchantAccountId,
    paymentIntent.customerProfileId,
  );
  await uow.customerStates.save(
    deriveCustomerPaymentState({
      customerProfileId: paymentIntent.customerProfileId,
      merchantAccountId: paymentIntent.merchantAccountId,
      environment: paymentIntent.environment,
      paymentMethods,
      paymentIntents,
      generatedAt: paymentIntent.updatedAt,
    }),
  );
}

function assertCapturablePaymentIntent(record: PaymentIntent): void {
  if (record.captureMode !== "manual") {
    throw new PaymentsServiceError(
      "conflict",
      "only manual authorization payment intents can be captured",
      {
        details: { paymentIntentId: record.id },
      },
    );
  }
  if (record.status !== "authorized") {
    throw new PaymentsServiceError("conflict", "payment intent is not capturable", {
      details: { paymentIntentId: record.id, status: record.status },
    });
  }
}

function assertCancelablePaymentIntent(record: PaymentIntent): void {
  if (record.captureMode !== "manual") {
    throw new PaymentsServiceError(
      "conflict",
      "only manual authorization payment intents can be canceled",
      {
        details: { paymentIntentId: record.id },
      },
    );
  }
  if (record.status === "captured" || record.status === "failed") {
    throw new PaymentsServiceError("conflict", "payment intent is not cancelable", {
      details: { paymentIntentId: record.id, status: record.status },
    });
  }
}

async function resolvePaymentIntentProvider(input: {
  readonly dependencies: PaymentsServiceDependencies;
  readonly uow: PaymentsUnitOfWork;
  readonly environment: CreatePaymentIntentCommand["environment"];
  readonly merchantAccountId: MerchantAccountId;
}): Promise<{
  readonly merchant: MerchantAccount;
  readonly providerContext: ProviderContext;
  readonly adapter: PaymentsProviderAdapter;
}> {
  const merchant = await getMerchantOrThrow(input.uow, input.environment, input.merchantAccountId);
  const providerContext = input.dependencies.resolveProviderContext(merchant);
  const adapter = input.dependencies.providers.getAdapter(providerContext.provider);
  return { merchant, providerContext, adapter };
}

function requireProviderCapture(
  adapter: PaymentsProviderAdapter,
  providerContext: ProviderContext,
): NonNullable<PaymentsProviderAdapter["capturePaymentIntent"]> {
  if (!adapter.capturePaymentIntent) {
    throw new PaymentsServiceError(
      "provider_unavailable",
      "provider does not support capture for payment intents",
      {
        details: { provider: providerContext.provider },
      },
    );
  }
  return adapter.capturePaymentIntent;
}

function requireProviderCancel(
  adapter: PaymentsProviderAdapter,
  providerContext: ProviderContext,
): NonNullable<PaymentsProviderAdapter["cancelPaymentIntent"]> {
  if (!adapter.cancelPaymentIntent) {
    throw new PaymentsServiceError(
      "provider_unavailable",
      "provider does not support cancel for payment intents",
      {
        details: { provider: providerContext.provider },
      },
    );
  }
  return adapter.cancelPaymentIntent;
}

function missingCaptureResultError(providerContext: ProviderContext): ProviderError {
  return {
    provider: providerContext.provider,
    category: "unknown",
    code: "provider_result_missing",
    message: "provider capture failed without error details",
    retryable: false,
  };
}

function missingCancelResultError(providerContext: ProviderContext): ProviderError {
  return {
    provider: providerContext.provider,
    category: "unknown",
    code: "provider_result_missing",
    message: "provider cancel failed without error details",
    retryable: false,
  };
}

function applyCapturedIntentResult(
  record: PaymentIntent,
  providerOutput: ProviderCapturePaymentIntentOutput,
): PaymentIntent {
  const nextStatus = mapProviderPaymentIntentStatus(providerOutput.status);
  return {
    ...record,
    status: nextStatus,
    nextActionType: nextStatus === "requires_action" ? record.nextActionType : undefined,
    hostedActionUrl: nextStatus === "requires_action" ? record.hostedActionUrl : undefined,
    processorIntentRefs: [providerOutput.intentRef],
    updatedAt: providerOutput.recordedAt,
  };
}

function applyCapturedPaymentResult(
  existingPayment: Payment,
  providerOutput: ProviderCapturePaymentIntentOutput,
): Payment {
  const nextStatus = mapProviderPaymentIntentStatus(providerOutput.status);
  return {
    ...existingPayment,
    status: mapPaymentStatus(nextStatus),
    capturedAt: nextStatus === "captured" ? providerOutput.recordedAt : existingPayment.capturedAt,
    settlementEligibleAt:
      nextStatus === "captured" ? providerOutput.recordedAt : existingPayment.settlementEligibleAt,
    updatedAt: providerOutput.recordedAt,
    processorPaymentRefs: providerOutput.paymentRef
      ? [providerOutput.paymentRef]
      : existingPayment.processorPaymentRefs,
  };
}

function applyCanceledIntentResult(
  record: PaymentIntent,
  providerOutput: ProviderCancelPaymentIntentOutput,
): PaymentIntent {
  const nextStatus = mapProviderPaymentIntentStatus(providerOutput.status);
  return {
    ...record,
    status: nextStatus,
    nextActionType: nextStatus === "requires_action" ? record.nextActionType : undefined,
    hostedActionUrl: nextStatus === "requires_action" ? record.hostedActionUrl : undefined,
    canceledAt: nextStatus === "canceled" ? providerOutput.recordedAt : record.canceledAt,
    processorIntentRefs: [providerOutput.intentRef],
    updatedAt: providerOutput.recordedAt,
  };
}

function applyCanceledPaymentResult(
  existingPayment: Payment,
  providerOutput: ProviderCancelPaymentIntentOutput,
): Payment {
  const nextStatus = mapProviderPaymentIntentStatus(providerOutput.status);
  return {
    ...existingPayment,
    status: mapPaymentStatus(nextStatus),
    updatedAt: providerOutput.recordedAt,
  };
}

async function savePaymentTransitionEvent(
  uow: PaymentsUnitOfWork,
  input: {
    readonly eventType:
      | "payment.captured"
      | "payment.canceled"
      | "payment.created"
      | "payment.failed";
    readonly paymentIntent: PaymentIntent;
    readonly payment: Payment | null;
    readonly occurredAt: string;
  },
): Promise<void> {
  if (!input.payment) {
    return;
  }
  await uow.events.saveCanonicalEvent(
    createPaymentEvent({
      id: `${input.payment.id}:${input.eventType}:${input.occurredAt}`,
      eventType: input.eventType,
      paymentIntent: input.paymentIntent,
      payment: input.payment,
      occurredAt: input.occurredAt,
    }),
  );
}

async function snapshotPaymentIntentWithPayment(
  uow: PaymentsUnitOfWork,
  environment: CreatePaymentIntentCommand["environment"],
  record: PaymentIntent,
): Promise<PaymentIntentSnapshot> {
  const payment = await uow.payments.getByPaymentIntentId(environment, record.id);
  return toSnapshot(record, {
    paymentId: payment?.id,
    paymentMethodId: payment?.paymentMethodId ?? record.metadata?.selectedPaymentMethodId,
  });
}

async function capturePaymentIntentInTransaction(
  dependencies: PaymentsServiceDependencies,
  uow: PaymentsUnitOfWork,
  command: CapturePaymentIntentCommand,
): Promise<PaymentIntentSnapshot> {
  const record = await getPaymentIntentInScope(uow, command);
  assertCapturablePaymentIntent(record);

  const { merchant, providerContext, adapter } = await resolvePaymentIntentProvider({
    dependencies,
    uow,
    environment: command.environment,
    merchantAccountId: command.merchantAccountId,
  });
  const capturePaymentIntent = requireProviderCapture(adapter, providerContext);
  const providerResult = await capturePaymentIntent(providerContext, {
    merchantAccountId: merchant.id,
    intentRef: selectPaymentIntentRef(record, providerContext.provider),
    amount: record.amount,
  });
  if (!providerResult.ok || !providerResult.value) {
    throw mapProviderError(providerResult.error ?? missingCaptureResultError(providerContext));
  }

  const updatedIntent = applyCapturedIntentResult(record, providerResult.value);
  await uow.paymentIntents.save(updatedIntent);

  const existingPayment = await uow.payments.getByPaymentIntentId(
    command.environment,
    command.paymentIntentId,
  );
  const updatedPayment = existingPayment
    ? applyCapturedPaymentResult(existingPayment, providerResult.value)
    : null;
  if (updatedPayment) {
    await uow.payments.save(updatedPayment);
  }

  await saveCustomerPaymentStateForIntent(dependencies, uow, updatedIntent);
  await savePaymentTransitionEvent(uow, {
    eventType: "payment.captured",
    paymentIntent: updatedIntent,
    payment: updatedPayment,
    occurredAt: providerResult.value.recordedAt,
  });
  return snapshotPaymentIntentWithPayment(uow, command.environment, updatedIntent);
}

async function cancelPaymentIntentInTransaction(
  dependencies: PaymentsServiceDependencies,
  uow: PaymentsUnitOfWork,
  command: CancelPaymentIntentCommand,
): Promise<PaymentIntentSnapshot> {
  const record = await getPaymentIntentInScope(uow, command);
  if (record.status === "canceled") {
    return snapshotPaymentIntentWithPayment(uow, command.environment, record);
  }
  assertCancelablePaymentIntent(record);

  const { merchant, providerContext, adapter } = await resolvePaymentIntentProvider({
    dependencies,
    uow,
    environment: command.environment,
    merchantAccountId: command.merchantAccountId,
  });
  const cancelPaymentIntent = requireProviderCancel(adapter, providerContext);
  const providerResult = await cancelPaymentIntent(providerContext, {
    merchantAccountId: merchant.id,
    intentRef: selectPaymentIntentRef(record, providerContext.provider),
  });
  if (!providerResult.ok || !providerResult.value) {
    throw mapProviderError(providerResult.error ?? missingCancelResultError(providerContext));
  }

  const updatedIntent = applyCanceledIntentResult(record, providerResult.value);
  await uow.paymentIntents.save(updatedIntent);

  const existingPayment = await uow.payments.getByPaymentIntentId(
    command.environment,
    command.paymentIntentId,
  );
  const updatedPayment = existingPayment
    ? applyCanceledPaymentResult(existingPayment, providerResult.value)
    : null;
  if (updatedPayment) {
    await uow.payments.save(updatedPayment);
  }

  await saveCustomerPaymentStateForIntent(dependencies, uow, updatedIntent);
  await savePaymentTransitionEvent(uow, {
    eventType: "payment.canceled",
    paymentIntent: updatedIntent,
    payment: updatedPayment,
    occurredAt: providerResult.value.recordedAt,
  });
  return snapshotPaymentIntentWithPayment(uow, command.environment, updatedIntent);
}

function missingCreateResultError(providerContext: ProviderContext): ProviderError {
  return {
    provider: providerContext.provider,
    category: "unknown",
    code: "provider_result_missing",
    message: "provider payment intent failed without error details",
    retryable: false,
  };
}

function createIntentMetadata(
  command: CreatePaymentIntentCommand,
  selectedPaymentMethodId: PaymentMethodId,
): PaymentIntent["metadata"] {
  return {
    ...command.metadata,
    selectedPaymentMethodId,
  };
}

function buildFailedPaymentIntentRecord(input: {
  readonly command: CreatePaymentIntentCommand;
  readonly selectedPaymentMethodId: PaymentMethodId;
  readonly failedIntentRef: ProcessorRef;
  readonly recordedAt: string;
  readonly createId: (prefix: "pi") => string;
}): PaymentIntent {
  return {
    id: input.createId("pi"),
    environment: input.command.environment,
    merchantAccountId: input.command.merchantAccountId,
    customerProfileId: input.command.customerProfileId,
    externalPaymentRef: input.command.externalPaymentRef,
    amount: input.command.amount,
    currency: input.command.currency,
    captureMode: input.command.captureMode,
    status: "failed",
    returnUrl: input.command.returnUrl,
    fraudSessionId: input.command.fraudSessionId,
    metadata: createIntentMetadata(input.command, input.selectedPaymentMethodId),
    nextActionType: undefined,
    hostedActionUrl: undefined,
    processorIntentRefs: [input.failedIntentRef],
    createdAt: input.recordedAt,
    updatedAt: input.recordedAt,
  };
}

function buildFailedPaymentRecord(input: {
  readonly command: CreatePaymentIntentCommand;
  readonly failedIntentRecord: PaymentIntent;
  readonly selectedPaymentMethodId: PaymentMethodId;
  readonly failedIntentRef: ProcessorRef;
  readonly providerError: ProviderError;
  readonly recordedAt: string;
  readonly createId: (prefix: "pay") => string;
}): Payment {
  return {
    id: input.createId("pay"),
    environment: input.command.environment,
    merchantAccountId: input.command.merchantAccountId,
    paymentIntentId: input.failedIntentRecord.id,
    customerProfileId: input.command.customerProfileId,
    paymentMethodId: input.selectedPaymentMethodId,
    amount: input.command.amount,
    currency: input.command.currency,
    status: "failed",
    direction: "debit",
    failureCode: input.providerError.code,
    failureMessage: input.providerError.message,
    processorPaymentRefs: [
      {
        ...input.failedIntentRef,
        relationship: "payment",
      },
    ],
    createdAt: input.recordedAt,
    updatedAt: input.recordedAt,
  };
}

async function saveCustomerStateForCreatedIntent(input: {
  readonly uow: PaymentsUnitOfWork;
  readonly paymentIntent: PaymentIntent;
  readonly paymentMethods: readonly PaymentMethod[];
  readonly generatedAt: string;
}): Promise<void> {
  if (!input.paymentIntent.customerProfileId) {
    return;
  }
  await input.uow.customerStates.save(
    deriveCustomerPaymentState({
      customerProfileId: input.paymentIntent.customerProfileId,
      merchantAccountId: input.paymentIntent.merchantAccountId,
      environment: input.paymentIntent.environment,
      paymentMethods: input.paymentMethods,
      paymentIntents: [input.paymentIntent],
      generatedAt: input.generatedAt,
    }),
  );
}

async function persistFailedProviderPaymentIntent(input: {
  readonly uow: PaymentsUnitOfWork;
  readonly command: CreatePaymentIntentCommand;
  readonly providerContext: ProviderContext;
  readonly providerError: ProviderError;
  readonly paymentMethods: readonly PaymentMethod[];
  readonly selectedPaymentMethodId: PaymentMethodId;
  readonly recordedAt: string;
  readonly createId: (prefix: "pi" | "pay") => string;
}): Promise<PaymentIntentSnapshot> {
  const failedIntentRef = createFailedProcessorRef(
    input.providerError,
    input.providerContext.provider,
    input.recordedAt,
  );
  const failedIntentRecord = buildFailedPaymentIntentRecord({
    command: input.command,
    selectedPaymentMethodId: input.selectedPaymentMethodId,
    failedIntentRef,
    recordedAt: input.recordedAt,
    createId: input.createId,
  });
  await input.uow.paymentIntents.save(failedIntentRecord);

  const failedPaymentRecord = buildFailedPaymentRecord({
    command: input.command,
    failedIntentRecord,
    selectedPaymentMethodId: input.selectedPaymentMethodId,
    failedIntentRef,
    providerError: input.providerError,
    recordedAt: input.recordedAt,
    createId: input.createId,
  });
  await input.uow.payments.save(failedPaymentRecord);
  await saveCustomerStateForCreatedIntent({
    uow: input.uow,
    paymentIntent: failedIntentRecord,
    paymentMethods: input.paymentMethods,
    generatedAt: input.recordedAt,
  });
  await savePaymentTransitionEvent(input.uow, {
    eventType: "payment.failed",
    paymentIntent: failedIntentRecord,
    payment: failedPaymentRecord,
    occurredAt: input.recordedAt,
  });

  return toSnapshot(failedIntentRecord, {
    paymentId: failedPaymentRecord.id,
    paymentMethodId: input.selectedPaymentMethodId,
  });
}

function buildCreatedPaymentIntentRecord(input: {
  readonly command: CreatePaymentIntentCommand;
  readonly selectedPaymentMethodId: PaymentMethodId;
  readonly providerOutput: ProviderPaymentIntentOutput;
  readonly recordedAt: string;
  readonly createId: (prefix: "pi") => string;
}): PaymentIntent {
  return {
    id: input.createId("pi"),
    environment: input.command.environment,
    merchantAccountId: input.command.merchantAccountId,
    customerProfileId: input.command.customerProfileId,
    externalPaymentRef: input.command.externalPaymentRef,
    amount: input.command.amount,
    currency: input.command.currency,
    captureMode: input.command.captureMode,
    status: mapProviderPaymentIntentStatus(input.providerOutput.status),
    returnUrl: input.command.returnUrl,
    fraudSessionId: input.command.fraudSessionId,
    metadata: createIntentMetadata(input.command, input.selectedPaymentMethodId),
    nextActionType: input.providerOutput.nextActionType,
    hostedActionUrl: readHostedActionUrl(input.providerOutput.clientTokenRef),
    processorIntentRefs: [input.providerOutput.intentRef],
    createdAt: input.recordedAt,
    updatedAt: input.recordedAt,
  };
}

function buildCreatedPaymentRecord(input: {
  readonly command: CreatePaymentIntentCommand;
  readonly record: PaymentIntent;
  readonly selectedPaymentMethodId: PaymentMethodId;
  readonly recordedAt: string;
  readonly createId: (prefix: "pay") => string;
}): Payment {
  return {
    id: input.createId("pay"),
    environment: input.command.environment,
    merchantAccountId: input.command.merchantAccountId,
    paymentIntentId: input.record.id,
    customerProfileId: input.command.customerProfileId,
    paymentMethodId: input.selectedPaymentMethodId,
    amount: input.command.amount,
    currency: input.command.currency,
    status: mapPaymentStatus(input.record.status),
    direction: "debit",
    authorizedAt: input.record.status === "authorized" ? input.recordedAt : undefined,
    capturedAt: input.record.status === "captured" ? input.recordedAt : undefined,
    settlementEligibleAt: input.record.status === "captured" ? input.recordedAt : undefined,
    processorPaymentRefs: input.record.processorIntentRefs,
    createdAt: input.recordedAt,
    updatedAt: input.recordedAt,
  };
}

async function persistCreatedProviderPaymentIntent(input: {
  readonly uow: PaymentsUnitOfWork;
  readonly command: CreatePaymentIntentCommand;
  readonly providerOutput: ProviderPaymentIntentOutput;
  readonly paymentMethods: readonly PaymentMethod[];
  readonly selectedPaymentMethodId: PaymentMethodId;
  readonly recordedAt: string;
  readonly createId: (prefix: "pi" | "pay") => string;
}): Promise<PaymentIntentSnapshot> {
  const record = buildCreatedPaymentIntentRecord({
    command: input.command,
    selectedPaymentMethodId: input.selectedPaymentMethodId,
    providerOutput: input.providerOutput,
    recordedAt: input.recordedAt,
    createId: input.createId,
  });
  await input.uow.paymentIntents.save(record);

  const paymentRecord = buildCreatedPaymentRecord({
    command: input.command,
    record,
    selectedPaymentMethodId: input.selectedPaymentMethodId,
    recordedAt: input.recordedAt,
    createId: input.createId,
  });
  await input.uow.payments.save(paymentRecord);
  await saveCustomerStateForCreatedIntent({
    uow: input.uow,
    paymentIntent: record,
    paymentMethods: input.paymentMethods,
    generatedAt: input.recordedAt,
  });
  await savePaymentTransitionEvent(input.uow, {
    eventType: "payment.created",
    paymentIntent: record,
    payment: paymentRecord,
    occurredAt: input.recordedAt,
  });

  return toSnapshot(record, {
    paymentId: paymentRecord.id,
    paymentMethodId: input.selectedPaymentMethodId,
  });
}

async function createPaymentIntentInTransaction(input: {
  readonly dependencies: PaymentsServiceDependencies;
  readonly uow: PaymentsUnitOfWork;
  readonly command: CreatePaymentIntentCommand;
  readonly now: () => string;
  readonly createId: (prefix: "pi" | "pay" | "idem") => string;
}): Promise<PaymentIntentSnapshot> {
  return withIdempotentResult(
    input.uow,
    {
      environment: input.command.environment,
      scope: `payments:createPaymentIntent:${input.command.merchantAccountId}`,
      idempotencyKey: input.command.idempotencyKey,
      request: input.command,
      createId: (prefix) => input.createId(prefix),
      now: input.now(),
    },
    () => createPaymentIntentWithoutIdempotency(input),
  );
}

async function createPaymentIntentWithoutIdempotency(input: {
  readonly dependencies: PaymentsServiceDependencies;
  readonly uow: PaymentsUnitOfWork;
  readonly command: CreatePaymentIntentCommand;
  readonly now: () => string;
  readonly createId: (prefix: "pi" | "pay") => string;
}): Promise<PaymentIntentSnapshot> {
  const { merchant, providerContext, adapter } = await resolvePaymentIntentProvider({
    dependencies: input.dependencies,
    uow: input.uow,
    environment: input.command.environment,
    merchantAccountId: input.command.merchantAccountId,
  });
  const paymentMethods = await input.dependencies.listPaymentMethods({
    environment: input.command.environment,
    merchantAccountId: input.command.merchantAccountId,
    customerProfileId: input.command.customerProfileId,
  });
  const selectedPaymentMethodId = selectPaymentMethodId(input.command, paymentMethods, input.now());
  const selectedPaymentMethod = paymentMethods.find(
    (paymentMethod) => paymentMethod.id === selectedPaymentMethodId,
  );
  const providerResult = await adapter.createPaymentIntent(providerContext, {
    merchantAccountId: merchant.id,
    merchantRef: selectMerchantRef(merchant, providerContext.provider),
    paymentMethodRef: selectPaymentMethodRef(
      selectedPaymentMethod,
      providerContext.provider,
      selectedPaymentMethodId,
    ),
    amount: input.command.amount,
    currency: input.command.currency,
    captureMode: input.command.captureMode,
    returnUrl: input.command.returnUrl,
    fraudSessionId: input.command.fraudSessionId,
    idempotencyKey: input.command.idempotencyKey,
  });

  const recordedAt = input.now();
  if (!providerResult.ok || !providerResult.value) {
    const providerError = providerResult.error ?? missingCreateResultError(providerContext);
    if (!shouldPersistFailedProviderResult(providerError)) {
      throw mapProviderError(providerError);
    }
    return persistFailedProviderPaymentIntent({
      uow: input.uow,
      command: input.command,
      providerContext,
      providerError,
      paymentMethods,
      selectedPaymentMethodId,
      recordedAt,
      createId: input.createId,
    });
  }

  return persistCreatedProviderPaymentIntent({
    uow: input.uow,
    command: input.command,
    providerOutput: providerResult.value,
    paymentMethods,
    selectedPaymentMethodId,
    recordedAt,
    createId: input.createId,
  });
}

async function listPaymentIntentsForMerchant(
  uow: PaymentsUnitOfWork,
  query: ListPaymentIntentsQuery,
): Promise<readonly PaymentIntentSnapshot[]> {
  const records = await uow.paymentIntents.listByMerchant(
    query.environment,
    query.merchantAccountId,
  );
  const filtered = records
    .filter(
      (record) =>
        query.customerProfileId === undefined ||
        record.customerProfileId === query.customerProfileId,
    )
    .filter((record) => query.status === undefined || record.status === query.status)
    .filter(
      (record) =>
        query.externalPaymentRef === undefined ||
        record.externalPaymentRef === query.externalPaymentRef,
    )
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .slice(0, Math.min(query.limit ?? 50, 100));

  return Promise.all(
    filtered.map(async (record) =>
      snapshotPaymentIntentWithPayment(uow, record.environment, record),
    ),
  );
}

async function retryPaymentIntentUsingCreate(
  uow: PaymentsUnitOfWork,
  command: RetryPaymentIntentCommand,
  createPaymentIntent: (command: CreatePaymentIntentCommand) => Promise<PaymentIntentSnapshot>,
): Promise<PaymentIntentSnapshot> {
  const record = await uow.paymentIntents.getById(command.paymentIntentId, {
    environment: command.environment,
  });
  if (!record || record.merchantAccountId !== command.merchantAccountId) {
    throw new PaymentsServiceError("not_found", "payment intent not found", {
      details: { paymentIntentId: command.paymentIntentId },
    });
  }
  if (!canRetryPaymentIntent(record)) {
    throw new PaymentsServiceError("conflict", "payment intent is not retryable", {
      details: { paymentIntentId: record.id, status: record.status },
    });
  }

  const retrySourcePaymentMethodId =
    command.paymentMethodId ?? record.metadata?.selectedPaymentMethodId;
  const retryMetadata: Record<string, string> = {
    ...record.metadata,
    retriedFromPaymentIntentId: record.id,
  };

  if (retrySourcePaymentMethodId) {
    retryMetadata.selectedPaymentMethodId = retrySourcePaymentMethodId;
  }

  return createPaymentIntent({
    environment: command.environment,
    merchantAccountId: record.merchantAccountId,
    customerProfileId: record.customerProfileId,
    amount: record.amount,
    currency: record.currency,
    captureMode: record.captureMode,
    paymentMethodId: retrySourcePaymentMethodId,
    externalPaymentRef: record.externalPaymentRef,
    returnUrl: record.returnUrl,
    fraudSessionId: record.fraudSessionId,
    metadata: retryMetadata,
    idempotencyKey: command.idempotencyKey,
  });
}

async function getPaymentIntentSnapshot(
  uow: PaymentsUnitOfWork,
  query: GetPaymentIntentQuery,
): Promise<PaymentIntentSnapshot | null> {
  const record = await uow.paymentIntents.getById(query.paymentIntentId, {
    environment: query.environment,
  });
  if (!record) {
    return null;
  }
  return snapshotPaymentIntentWithPayment(uow, query.environment, record);
}

export function createPaymentsService(dependencies: PaymentsServiceDependencies): PaymentsService {
  const now = dependencies.now ?? (() => new Date().toISOString());
  const createId = dependencies.createId ?? createDefaultId;

  return {
    async createPaymentIntent(command: CreatePaymentIntentCommand): Promise<PaymentIntentSnapshot> {
      return dependencies.uow.runInTransaction(async (uow) => {
        return createPaymentIntentInTransaction({
          dependencies,
          uow,
          command,
          now,
          createId,
        });
      });
    },

    async listPaymentIntents(
      query: ListPaymentIntentsQuery,
    ): Promise<readonly PaymentIntentSnapshot[]> {
      return listPaymentIntentsForMerchant(dependencies.uow, query);
    },

    async capturePaymentIntent(
      command: CapturePaymentIntentCommand,
    ): Promise<PaymentIntentSnapshot> {
      return dependencies.uow.runInTransaction(async (uow) => {
        return capturePaymentIntentInTransaction(dependencies, uow, command);
      });
    },

    async cancelPaymentIntent(command: CancelPaymentIntentCommand): Promise<PaymentIntentSnapshot> {
      return dependencies.uow.runInTransaction(async (uow) => {
        return cancelPaymentIntentInTransaction(dependencies, uow, command);
      });
    },

    async retryPaymentIntent(command: RetryPaymentIntentCommand): Promise<PaymentIntentSnapshot> {
      return retryPaymentIntentUsingCreate(dependencies.uow, command, (retryCommand) =>
        this.createPaymentIntent(retryCommand),
      );
    },

    async getPaymentIntent(query: GetPaymentIntentQuery): Promise<PaymentIntentSnapshot | null> {
      return getPaymentIntentSnapshot(dependencies.uow, query);
    },
  };
}
