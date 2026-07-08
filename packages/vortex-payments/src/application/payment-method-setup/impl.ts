import type { MerchantAccountId, PaymentMethodId, ProcessorRef } from "../../domain/common";
import type { MerchantAccount } from "../../domain/merchant";
import type { PaymentIntent } from "../../domain/payments";
import type { PaymentMethod, PaymentMethodSetupSession } from "../../domain/payment-methods";
import type { CanonicalDomainEvent } from "../../events/types";
import type { ProviderContext, ProviderError } from "../../providers/types";
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

export function createPaymentMethodSetupService(
  dependencies: PaymentMethodSetupServiceDependencies,
): PaymentMethodSetupService {
  const createId = dependencies.createId ?? createDefaultId;
  const now = dependencies.now ?? (() => new Date().toISOString());
  const setupSessionTtlMs = dependencies.setupSessionTtlMs ?? DEFAULT_SETUP_SESSION_TTL_MS;

  return {
    async createPaymentMethodSetupSession(
      command: CreatePaymentMethodSetupSessionCommand,
    ): Promise<PaymentMethodSetupSessionSnapshot> {
      const merchant = await getMerchantOrThrow(
        dependencies.uow,
        command.environment,
        command.merchantAccountId,
      );
      if (command.ownerType === "customer") {
        await getCustomerProfileOrThrow(
          dependencies.uow,
          command.environment,
          command.merchantAccountId,
          command.ownerId,
        );
      }
      const providerContext = dependencies.resolveProviderContext(merchant);
      const adapter = dependencies.providers.getAdapter(providerContext.provider);
      if (
        !adapter.supportedCapabilities.includes("payment_methods") ||
        !adapter.createPaymentMethod
      ) {
        throw new PaymentMethodSetupServiceError(
          "provider_unavailable",
          "provider does not support payment methods",
          { details: { provider: providerContext.provider } },
        );
      }

      const createdAt = now();
      const session: PaymentMethodSetupSession = {
        id: createId("pmset"),
        environment: command.environment,
        merchantAccountId: command.merchantAccountId,
        ownerType: command.ownerType,
        ownerId: command.ownerId,
        methodType: command.methodType,
        provider: providerContext.provider,
        clientSecret: createId("pmsec"),
        status: "pending_tokenization",
        setAsDefault: command.setAsDefault ?? false,
        expiresAt: new Date(Date.parse(createdAt) + setupSessionTtlMs).toISOString(),
        createdAt,
        updatedAt: createdAt,
      };

      await dependencies.uow.paymentMethodSetupSessions.save(session);
      return toSetupSessionSnapshot(session);
    },

    async createPaymentMethodFromSetup(
      command: CreatePaymentMethodFromSetupCommand,
    ): Promise<CreatedPaymentMethodSnapshot> {
      return dependencies.uow.runInTransaction(async (uow) => {
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
        const idempotencyScope = `payment_method_setup:${session.id}`;
        const requestHash = hashRequest({
          sessionId: session.id,
          setupToken: command.setupToken,
        });
        if (command.idempotencyKey) {
          const existing = await uow.idempotency.getByScopeAndKey(
            command.environment,
            idempotencyScope,
            command.idempotencyKey,
          );
          if (existing) {
            if (existing.requestHash !== requestHash) {
              throw new PaymentMethodSetupServiceError(
                "conflict",
                "idempotency key reused with different payment method setup request",
                { details: { idempotencyKey: command.idempotencyKey } },
              );
            }
            const replay = await uow.paymentMethods.getById(
              existing.responseRef as PaymentMethodId,
              {
                environment: command.environment,
              },
            );
            if (!replay) {
              throw new PaymentMethodSetupServiceError(
                "internal_error",
                "payment method idempotency record points to missing payment method",
                { details: { paymentMethodId: existing.responseRef } },
              );
            }
            return toPaymentMethodSnapshot(replay);
          }
        }

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
            { details: { paymentMethodSetupSessionId: session.id } },
          );
        }
        if (Date.parse(session.expiresAt) <= Date.parse(now())) {
          const expiredSession: PaymentMethodSetupSession = {
            ...session,
            status: "expired",
            updatedAt: now(),
          };
          await uow.paymentMethodSetupSessions.save(expiredSession);
          throw new PaymentMethodSetupServiceError(
            "conflict",
            "payment method setup session expired",
            { details: { paymentMethodSetupSessionId: session.id } },
          );
        }

        const merchant = await getMerchantOrThrow(
          uow,
          command.environment,
          session.merchantAccountId,
        );
        const customer =
          session.ownerType === "customer"
            ? await getCustomerProfileOrThrow(
                uow,
                command.environment,
                session.merchantAccountId,
                session.ownerId,
              )
            : null;
        const providerContext = dependencies.resolveProviderContext(merchant);
        if (providerContext.provider !== session.provider) {
          throw new PaymentMethodSetupServiceError(
            "conflict",
            "payment method setup session provider mismatch",
            { details: { paymentMethodSetupSessionId: session.id } },
          );
        }

        const consumingAt = now();
        await uow.paymentMethodSetupSessions.save({
          ...session,
          status: "consuming",
          updatedAt: consumingAt,
        });

        const adapter = dependencies.providers.getAdapter(providerContext.provider);
        if (!adapter.createPaymentMethod) {
          throw new PaymentMethodSetupServiceError(
            "provider_unavailable",
            "provider does not implement payment method creation",
            { details: { provider: providerContext.provider } },
          );
        }
        const providerResult = await adapter.createPaymentMethod(providerContext, {
          merchantAccountId: session.merchantAccountId,
          ownerType: session.ownerType,
          ownerId: session.ownerId,
          ownerRef: customer?.processorCustomerRefs.find(
            (ref) => ref.provider === providerContext.provider,
          ),
          methodType: session.methodType,
          setupToken: command.setupToken,
        });
        if (!providerResult.ok || !providerResult.value) {
          await uow.paymentMethodSetupSessions.save({
            ...session,
            status: "failed",
            updatedAt: now(),
          });
          throw mapProviderError(
            providerResult.error ?? {
              provider: providerContext.provider,
              category: "unknown",
              code: "provider_result_missing",
              message: "provider payment method creation failed without error details",
              retryable: false,
            },
          );
        }

        const createdAt = providerResult.value.recordedAt;
        const existingMethods = await uow.paymentMethods.listByOwner(
          command.environment,
          session.ownerType,
          session.ownerId,
        );
        const scopedMethods = existingMethods.filter(
          (paymentMethod) =>
            paymentMethod.ownerType === session.ownerType &&
            paymentMethod.ownerId === session.ownerId &&
            (paymentMethod.merchantAccountId === undefined ||
              paymentMethod.merchantAccountId === session.merchantAccountId),
        );
        const makeDefault =
          session.setAsDefault ||
          !scopedMethods.some(
            (paymentMethod) => paymentMethod.status === "active" && paymentMethod.isDefault,
          );
        const paymentMethod: PaymentMethod = {
          id: createId("pm"),
          environment: command.environment,
          merchantAccountId: session.merchantAccountId,
          ownerType: session.ownerType,
          ownerId: session.ownerId,
          methodType: providerResult.value.methodType,
          brandSummary: providerResult.value.brandSummary,
          last4: providerResult.value.last4,
          expiryMonth: providerResult.value.expiryMonth,
          expiryYear: providerResult.value.expiryYear,
          status: providerResult.value.status === "active" ? "active" : "disabled",
          isDefault: makeDefault && providerResult.value.status === "active",
          fingerprint: providerResult.value.fingerprint,
          processorInstrumentRefs: [providerResult.value.paymentMethodRef],
          createdAt,
          updatedAt: createdAt,
          archivedAt: undefined,
        };

        for (const method of scopedMethods) {
          if (paymentMethod.isDefault && method.isDefault) {
            await uow.paymentMethods.save({
              ...method,
              isDefault: false,
              updatedAt: createdAt,
            });
          }
        }
        await uow.paymentMethods.save(paymentMethod);

        if (customer && providerResult.value.ownerRef) {
          await uow.customers.save({
            ...customer,
            processorCustomerRefs: dedupeProcessorRefs([
              ...customer.processorCustomerRefs,
              providerResult.value.ownerRef,
            ]),
            updatedAt: createdAt,
          });
        }

        const consumedSession: PaymentMethodSetupSession = {
          ...session,
          status: "consumed",
          updatedAt: createdAt,
          consumedAt: createdAt,
          attachedPaymentMethodId: paymentMethod.id,
        };
        await uow.paymentMethodSetupSessions.save(consumedSession);

        const resultingMethods = [
          ...scopedMethods.map((method) =>
            paymentMethod.isDefault && method.isDefault
              ? { ...method, isDefault: false, updatedAt: createdAt }
              : method,
          ),
          paymentMethod,
        ];
        if (session.ownerType === "customer") {
          await deriveAndPersistCustomerState(
            uow,
            command.environment,
            session.merchantAccountId,
            session.ownerId,
            resultingMethods,
            createdAt,
          );
        }

        await uow.events.saveCanonicalEvent(
          createPaymentMethodCreatedEvent({
            paymentMethod,
            setupSessionId: session.id,
            occurredAt: createdAt,
          }),
        );

        if (command.idempotencyKey) {
          await uow.idempotency.save({
            id: createId("idem"),
            environment: command.environment,
            scope: idempotencyScope,
            idempotencyKey: command.idempotencyKey,
            requestHash,
            responseRef: paymentMethod.id,
            createdAt,
            expiresAt: new Date(Date.parse(createdAt) + DEFAULT_IDEMPOTENCY_TTL_MS).toISOString(),
          });
        }

        return toPaymentMethodSnapshot(paymentMethod);
      });
    },
  };
}
