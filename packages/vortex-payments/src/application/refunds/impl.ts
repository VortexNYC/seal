import type { MerchantAccountId, PaymentId } from "../../domain/common";
import type { MerchantAccount } from "../../domain/merchant";
import type { Payment, Refund, RefundStatus } from "../../domain/payments";
import type { CanonicalDomainEvent } from "../../events/types";
import type { ProviderContext, ProviderError } from "../../providers/types";
import type { ProviderRegistry } from "../../providers/registry";
import type { PaymentsUnitOfWork } from "../../storage/unit-of-work";
import type { CreateRefundCommand, GetRefundQuery, RefundSnapshot } from "./contracts";
import type { RefundsService } from "./service";

export class RefundsServiceError extends Error {
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
    code: RefundsServiceError["code"],
    message: string,
    options?: {
      retryable?: boolean;
      details?: Readonly<Record<string, string>>;
    },
  ) {
    super(message);
    this.name = "RefundsServiceError";
    this.code = code;
    this.retryable = options?.retryable ?? false;
    this.details = options?.details;
  }
}

export interface RefundsServiceDependencies {
  readonly uow: PaymentsUnitOfWork;
  readonly providers: ProviderRegistry;
  readonly resolveProviderContext: (merchant: MerchantAccount) => ProviderContext;
  readonly now?: () => string;
  readonly createId?: (prefix: "refund" | "idem") => string;
}

const DEFAULT_IDEMPOTENCY_TTL_MS = 1000 * 60 * 60 * 24;

function createDefaultId(prefix: "refund" | "idem"): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function createRefundEvent(input: {
  readonly id: string;
  readonly refund: Refund;
  readonly occurredAt: string;
}): CanonicalDomainEvent {
  return {
    id: input.id,
    environment: input.refund.environment,
    eventType: "refund.created",
    aggregateType: "refund",
    aggregateId: input.refund.id,
    occurredAt: input.occurredAt,
    sourceProvider: "vortex",
    payload: {
      merchantAccountId: input.refund.merchantAccountId,
      paymentId: input.refund.paymentId,
      refundId: input.refund.id,
      refundStatus: input.refund.status,
      amount: input.refund.amount,
      currency: input.refund.currency,
      reason: input.refund.reason,
      ...(input.refund.terminalSessionId ? { terminalSessionId: input.refund.terminalSessionId } : {}),
      ...(input.refund.terminalReaderId ? { terminalReaderId: input.refund.terminalReaderId } : {}),
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
      left.localeCompare(right)
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

function mapProviderError(error: ProviderError): RefundsServiceError {
  switch (error.category) {
    case "invalid_request":
      return new RefundsServiceError("invalid_request", error.message, {
        retryable: error.retryable,
        details: { provider: error.provider, code: error.code },
      });
    case "action_required":
      return new RefundsServiceError("action_required", error.message, {
        retryable: error.retryable,
        details: { provider: error.provider, code: error.code },
      });
    case "authentication_failed":
    case "rate_limited":
    case "temporarily_unavailable":
    case "unknown":
    case "not_supported":
    default:
      return new RefundsServiceError("provider_unavailable", error.message, {
        retryable: error.retryable,
        details: { provider: error.provider, code: error.code },
      });
  }
}

function mapProviderRefundStatus(status: string): RefundStatus {
  switch (status) {
    case "succeeded":
    case "completed":
      return "succeeded";
    case "failed":
    case "declined":
      return "failed";
    case "pending":
    case "processing":
    default:
      return "pending";
  }
}

function toSnapshot(refund: Refund): RefundSnapshot {
  return {
    id: refund.id,
    merchantAccountId: refund.merchantAccountId,
    paymentId: refund.paymentId,
    amount: refund.amount,
    currency: refund.currency,
    status: refund.status,
    reason: refund.reason,
    ...(refund.terminalSessionId ? { terminalSessionId: refund.terminalSessionId } : {}),
    ...(refund.terminalReaderId ? { terminalReaderId: refund.terminalReaderId } : {}),
  };
}

async function getMerchantOrThrow(
  uow: PaymentsUnitOfWork,
  environment: CreateRefundCommand["environment"],
  merchantAccountId: MerchantAccountId,
): Promise<MerchantAccount> {
  const merchant = await uow.merchants.getById(merchantAccountId, { environment });
  if (!merchant) {
    throw new RefundsServiceError("not_found", "merchant account not found", {
      details: { merchantAccountId },
    });
  }
  return merchant;
}

async function getPaymentOrThrow(
  uow: PaymentsUnitOfWork,
  environment: CreateRefundCommand["environment"],
  paymentId: PaymentId,
): Promise<Payment> {
  const payment = await uow.payments.getById(paymentId, { environment });
  if (!payment) {
    throw new RefundsServiceError("not_found", "payment not found", {
      details: { paymentId },
    });
  }
  return payment;
}

function sumSucceededRefundAmount(refunds: readonly Refund[]): number {
  return refunds.reduce((total, refund) => {
    return refund.status === "succeeded" ? total + refund.amount : total;
  }, 0);
}

function sumPendingOrSucceededRefundAmount(refunds: readonly Refund[]): number {
  return refunds.reduce((total, refund) => {
    return refund.status === "failed" ? total : total + refund.amount;
  }, 0);
}

async function withIdempotentResult<TResult>(
  uow: PaymentsUnitOfWork,
  options: {
    environment: CreateRefundCommand["environment"];
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
      throw new RefundsServiceError("conflict", "idempotency key reused with different request", {
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

export function createRefundsService(dependencies: RefundsServiceDependencies): RefundsService {
  const now = dependencies.now ?? (() => new Date().toISOString());
  const createId = dependencies.createId ?? createDefaultId;

  return {
    async createRefund(command: CreateRefundCommand): Promise<RefundSnapshot> {
      return dependencies.uow.runInTransaction(async (uow) => {
        return withIdempotentResult(
          uow,
          {
            environment: command.environment,
            scope: `payments:createRefund:${command.paymentId}`,
            idempotencyKey: command.idempotencyKey,
            request: command,
            createId: (prefix) => createId(prefix),
            now: now(),
          },
          async () => {
            const merchant = await getMerchantOrThrow(uow, command.environment, command.merchantAccountId);
            const payment = await getPaymentOrThrow(uow, command.environment, command.paymentId);

            if (payment.merchantAccountId !== command.merchantAccountId) {
              throw new RefundsServiceError("invalid_request", "payment does not belong to merchant", {
                details: { paymentId: command.paymentId },
              });
            }
            if (command.amount <= 0) {
              throw new RefundsServiceError("invalid_request", "refund amount must be greater than zero", {
                details: { paymentId: command.paymentId },
              });
            }
            if (command.amount > payment.amount) {
              throw new RefundsServiceError("invalid_request", "refund amount exceeds payment amount", {
                details: { paymentId: command.paymentId },
              });
            }

            const existingRefunds = await uow.refunds.listByPayment(command.environment, payment.id);
            const reservedAmount = sumPendingOrSucceededRefundAmount(existingRefunds);
            if (reservedAmount + command.amount > payment.amount) {
              throw new RefundsServiceError(
                "conflict",
                "refund amount exceeds remaining refundable amount",
                {
                  details: {
                    paymentId: command.paymentId,
                    remainingRefundableAmount: String(Math.max(payment.amount - reservedAmount, 0)),
                  },
                },
              );
            }

            const paymentRef = payment.processorPaymentRefs[0];
            if (!paymentRef) {
              throw new RefundsServiceError("invalid_request", "payment is missing provider reference", {
                details: { paymentId: command.paymentId },
              });
            }

            const providerContext = dependencies.resolveProviderContext(merchant);
            const providerKey = paymentRef.provider as ProviderContext["provider"];
            const adapter = dependencies.providers.getAdapter(providerKey || providerContext.provider);
            const providerResult = await adapter.createRefund(providerContext, {
              paymentRef,
              amount: command.amount,
              reason: command.reason,
              idempotencyKey: command.idempotencyKey,
            });

            if (!providerResult.ok || !providerResult.value) {
              throw mapProviderError(providerResult.error ?? {
                provider: providerContext.provider,
                category: "unknown",
                code: "provider_result_missing",
                message: "provider refund failed without error details",
                retryable: false,
              });
            }

            const recordedAt = now();
            const refund: Refund = {
              id: createId("refund"),
              environment: command.environment,
              merchantAccountId: command.merchantAccountId,
              paymentId: payment.id,
              amount: command.amount,
              currency: payment.currency,
              status: mapProviderRefundStatus(providerResult.value.status),
              reason: command.reason,
              requestedByType: command.requestedByType,
              requestedByRef: command.requestedByRef,
              processorRefundRefs: [providerResult.value.refundRef],
              terminalSessionId: payment.terminalSessionId,
              terminalReaderId: payment.terminalReaderId,
              createdAt: recordedAt,
              updatedAt: recordedAt,
            };
            await uow.refunds.save(refund);
            await uow.events.saveCanonicalEvent(createRefundEvent({
              id: `${refund.id}:refund.created:${recordedAt}`,
              refund,
              occurredAt: recordedAt,
            }));

            if (refund.status === "succeeded") {
              const succeededAmount = sumSucceededRefundAmount([...existingRefunds, refund]);
              await uow.payments.save({
                ...payment,
                status: succeededAmount >= payment.amount ? "refunded_full" : "refunded_partial",
                updatedAt: recordedAt,
              });
            }

            return toSnapshot(refund);
          },
        );
      });
    },

    async getRefund(query: GetRefundQuery): Promise<RefundSnapshot | null> {
      const refund = await dependencies.uow.refunds.getById(query.refundId, {
        environment: query.environment,
      });
      return refund ? toSnapshot(refund) : null;
    },
  };
}
