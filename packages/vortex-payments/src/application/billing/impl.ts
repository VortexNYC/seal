import type { MerchantAccountId, ProcessorRef } from "../../domain/common";
import type { MerchantAccount } from "../../domain/merchant";
import type { Payment, PaymentIntent, Refund } from "../../domain/payments";
import type { PaymentMethod } from "../../domain/payment-methods";
import type { ProviderContext, ProviderKey, ProviderObjectSnapshot } from "../../providers/types";
import type { ProviderRegistry } from "../../providers/registry";
import type { PaymentsUnitOfWork } from "../../storage/unit-of-work";
import type { PaymentsService } from "../payments/service";
import type { RefundsService } from "../refunds/service";
import {
  mapCollectInvoiceExecutionResult,
  mapMerchantAccountStateToReadinessSnapshot,
  mapPaymentMethodsToBillingSummaries,
} from "./mappers";
import type {
  CollectInvoicePaymentCommand,
  CollectInvoicePaymentResult,
  GetCustomerPaymentMethodsQuery,
  GetMerchantReadinessQuery,
  MerchantReadinessSnapshot,
  ReconcileInvoicePaymentQuery,
  ReconcileInvoicePaymentResult,
  ReconcileInvoiceRefundQuery,
  ReconcileInvoiceRefundResult,
  RefundInvoicePaymentCommand,
  RefundInvoicePaymentResult,
} from "./contracts";
import type { BillingPaymentsService } from "./service";

export class BillingServiceError extends Error {
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
    code: BillingServiceError["code"],
    message: string,
    options?: {
      retryable?: boolean;
      details?: Readonly<Record<string, string>>;
    },
  ) {
    super(message);
    this.name = "BillingServiceError";
    this.code = code;
    this.retryable = options?.retryable ?? false;
    this.details = options?.details;
  }
}

export interface BillingPaymentsServiceDependencies {
  readonly uow: PaymentsUnitOfWork;
  readonly providers: ProviderRegistry;
  readonly payments: PaymentsService;
  readonly refunds: RefundsService;
  readonly listPaymentMethods: (
    query: GetCustomerPaymentMethodsQuery,
  ) => Promise<readonly PaymentMethod[]>;
  readonly resolveProviderContext: (merchant: MerchantAccount) => ProviderContext;
  readonly now?: () => string;
  readonly createId?: (prefix: "pi" | "refund" | "idem") => string;
}

const DEFAULT_IDEMPOTENCY_TTL_MS = 1000 * 60 * 60 * 24;

function createDefaultId(prefix: "pi" | "refund" | "idem"): string {
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

function isProviderKey(value: string): value is ProviderKey {
  return value === "finix" || value === "payrix";
}

function resolveReconciliationProviderContext(
  resolveProviderContext: (merchant: MerchantAccount) => ProviderContext,
  merchant: MerchantAccount,
  provider: ProviderKey,
  environment: ReconcileInvoicePaymentQuery["environment"],
): ProviderContext {
  const baseContext = resolveProviderContext(merchant);
  return {
    ...baseContext,
    provider,
    environment,
  };
}

function mapPaymentSnapshotStatus(snapshot: ProviderObjectSnapshot): PaymentIntent["status"] {
  if (snapshot.objectType === "authorization") {
    switch (snapshot.status) {
      case "SUCCEEDED":
        return "authorized";
      case "FAILED":
        return "failed";
      case "CANCELED":
      case "VOIDED":
        return "canceled";
      default:
        return "pending";
    }
  }

  switch (snapshot.status) {
    case "SUCCEEDED":
      return "captured";
    case "FAILED":
      return "failed";
    case "CANCELED":
      return "canceled";
    default:
      return "pending";
  }
}

function mapRefundSnapshotStatus(snapshot: ProviderObjectSnapshot): Refund["status"] {
  switch (snapshot.status) {
    case "SUCCEEDED":
      return "succeeded";
    case "FAILED":
      return "failed";
    default:
      return "pending";
  }
}

function getRequiredPaymentProcessorRef(
  payment: Payment,
  paymentId: ReconcileInvoicePaymentQuery["paymentId"],
): ProcessorRef & { readonly provider: ProviderKey } {
  const paymentRef =
    payment.processorPaymentRefs.find((ref) => ref.relationship === "payment") ??
    payment.processorPaymentRefs[0] ??
    null;
  if (!paymentRef) {
    throw new BillingServiceError(
      "invalid_request",
      "payment is missing provider payment reference",
      {
        details: { paymentId },
      },
    );
  }
  if (!isProviderKey(paymentRef.provider)) {
    throw new BillingServiceError("invalid_request", "payment provider is not registered", {
      details: { provider: paymentRef.provider },
    });
  }
  return paymentRef;
}

async function fetchPaymentProviderSnapshot(
  dependencies: BillingPaymentsServiceDependencies,
  uow: PaymentsUnitOfWork,
  query: ReconcileInvoicePaymentQuery,
  payment: Payment,
  paymentRef: ProcessorRef & { readonly provider: ProviderKey },
): Promise<ProviderObjectSnapshot> {
  const merchant = await getMerchantOrThrow(uow, query.environment, payment.merchantAccountId);
  const provider = dependencies.providers.getAdapter(paymentRef.provider);
  const snapshot = await provider.fetchObjectSnapshot(
    resolveReconciliationProviderContext(
      dependencies.resolveProviderContext,
      merchant,
      paymentRef.provider,
      query.environment,
    ),
    paymentRef,
  );
  if (!snapshot.ok || !snapshot.value) {
    throw new BillingServiceError(
      snapshot.error?.category === "temporarily_unavailable"
        ? "provider_unavailable"
        : "invalid_request",
      snapshot.error?.message ?? "provider payment snapshot unavailable",
      {
        retryable: snapshot.error?.retryable ?? false,
        details: { paymentId: query.paymentId },
      },
    );
  }
  return snapshot.value;
}

async function saveReconciledPaymentIntent(
  uow: PaymentsUnitOfWork,
  query: ReconcileInvoicePaymentQuery,
  payment: Payment,
  nextStatus: PaymentIntent["status"],
  recordedAt: string,
): Promise<PaymentIntent> {
  const paymentIntent = payment.paymentIntentId
    ? await uow.paymentIntents.getById(payment.paymentIntentId, {
        environment: query.environment,
      })
    : null;
  if (!paymentIntent) {
    throw new BillingServiceError(
      "invalid_request",
      "payment is missing canonical payment intent",
      {
        details: { paymentId: query.paymentId },
      },
    );
  }

  await uow.paymentIntents.save({
    ...paymentIntent,
    status: nextStatus,
    confirmedAt:
      nextStatus === "authorized" || nextStatus === "captured"
        ? (paymentIntent.confirmedAt ?? recordedAt)
        : paymentIntent.confirmedAt,
    canceledAt:
      nextStatus === "canceled"
        ? (paymentIntent.canceledAt ?? recordedAt)
        : paymentIntent.canceledAt,
    updatedAt: recordedAt,
  });

  return paymentIntent;
}

function preserveRefundedPaymentStatus(
  currentStatus: Payment["status"],
  nextStatus: PaymentIntent["status"],
): Payment["status"] {
  if (currentStatus === "refunded_full" || currentStatus === "refunded_partial") {
    return currentStatus;
  }
  return nextStatus;
}

function sumSucceededRefunds(refunds: readonly Refund[]): number {
  return refunds.reduce((total, refund) => {
    return refund.status === "succeeded" ? total + refund.amount : total;
  }, 0);
}

function derivePaymentStatusAfterRefund(
  payment: Payment,
  refunds: readonly Refund[],
): Payment["status"] {
  const refundedAmount = sumSucceededRefunds(refunds);
  if (refundedAmount >= payment.amount) {
    return "refunded_full";
  }
  if (refundedAmount > 0) {
    return "refunded_partial";
  }
  return payment.status;
}

async function getMerchantOrThrow(
  uow: PaymentsUnitOfWork,
  environment: GetMerchantReadinessQuery["environment"],
  merchantAccountId: MerchantAccountId,
): Promise<MerchantAccount> {
  const merchant = await uow.merchants.getById(merchantAccountId, { environment });
  if (!merchant) {
    throw new BillingServiceError("not_found", "merchant account not found", {
      details: { merchantAccountId },
    });
  }

  return merchant;
}

async function getMerchantReadinessSnapshot(
  uow: PaymentsUnitOfWork,
  query: GetMerchantReadinessQuery,
): Promise<MerchantReadinessSnapshot | null> {
  const existingState = await uow.merchantStates.getByMerchantAccountId(query.merchantAccountId, {
    environment: query.environment,
  });

  if (existingState) {
    return mapMerchantAccountStateToReadinessSnapshot(existingState);
  }

  const merchant = await uow.merchants.getById(query.merchantAccountId, {
    environment: query.environment,
  });
  if (!merchant) {
    return null;
  }

  return {
    merchantAccountId: merchant.id,
    merchantStatus: merchant.status,
    canAcceptPayments: merchant.status === "active",
    payoutReadiness: merchant.status === "active" ? "unknown" : "blocked",
    payoutBlockReason:
      merchant.status === "active" ? undefined : `merchant_status:${merchant.status}`,
  };
}

async function withIdempotentResult<TResult>(
  uow: PaymentsUnitOfWork,
  options: {
    environment: GetMerchantReadinessQuery["environment"];
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
      throw new BillingServiceError("conflict", "idempotency key reused with different request", {
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

export function createBillingPaymentsService(
  dependencies: BillingPaymentsServiceDependencies,
): BillingPaymentsService {
  const now = dependencies.now ?? (() => new Date().toISOString());
  const createId = dependencies.createId ?? createDefaultId;

  return {
    async collectInvoicePayment(
      command: CollectInvoicePaymentCommand,
    ): Promise<CollectInvoicePaymentResult> {
      return dependencies.uow.runInTransaction(async (uow) => {
        return withIdempotentResult(
          uow,
          {
            environment: command.environment,
            scope: `billing:collectInvoicePayment:${command.invoiceId}`,
            idempotencyKey: command.idempotencyKey,
            request: command,
            createId: (prefix) => createId(prefix),
            now: now(),
          },
          async () => {
            await getMerchantOrThrow(uow, command.environment, command.merchantAccountId);
            const readiness = await getMerchantReadinessSnapshot(uow, {
              environment: command.environment,
              merchantAccountId: command.merchantAccountId,
            });

            if (!readiness?.canAcceptPayments) {
              throw new BillingServiceError("action_required", "merchant cannot accept payments", {
                details: { merchantAccountId: command.merchantAccountId },
              });
            }

            try {
              const paymentIntent = await dependencies.payments.createPaymentIntent({
                environment: command.environment,
                merchantAccountId: command.merchantAccountId,
                customerProfileId: command.customerProfileId,
                paymentMethodId: command.paymentMethodId,
                amount: command.amount,
                currency: command.currency,
                captureMode: "automatic",
                externalPaymentRef: command.externalInvoiceRef,
                metadata: {
                  ...command.metadata,
                  billingAccountId: command.billingAccountId,
                  invoiceId: command.invoiceId,
                },
              });

              if (!paymentIntent.paymentId) {
                throw new BillingServiceError(
                  "internal_error",
                  "payment intent is missing canonical payment id",
                  {
                    details: { paymentIntentId: paymentIntent.id },
                  },
                );
              }

              return mapCollectInvoiceExecutionResult(command, {
                paymentIntentId: paymentIntent.id,
                paymentId: paymentIntent.paymentId,
                paymentStatus: paymentIntent.status,
                requiresAction: paymentIntent.requiresAction,
                nextStep: paymentIntent.nextStep,
                hostedActionUrl: paymentIntent.hostedActionUrl,
                nextActionType: paymentIntent.nextActionType,
              });
            } catch (error) {
              if (error instanceof Error && error.name === "PaymentsServiceError") {
                const typedError = error as Error & {
                  readonly code?: BillingServiceError["code"];
                  readonly retryable?: boolean;
                  readonly details?: Readonly<Record<string, string>>;
                };
                throw new BillingServiceError(
                  typedError.code === "provider_unavailable"
                    ? "provider_unavailable"
                    : typedError.code === "action_required"
                      ? "action_required"
                      : typedError.code === "not_found"
                        ? "not_found"
                        : typedError.code === "conflict"
                          ? "conflict"
                          : "invalid_request",
                  typedError.message,
                  {
                    retryable: typedError.retryable ?? false,
                    details: typedError.details,
                  },
                );
              }

              throw error;
            }
          },
        );
      });
    },

    async refundInvoicePayment(
      command: RefundInvoicePaymentCommand,
    ): Promise<RefundInvoicePaymentResult> {
      return dependencies.uow.runInTransaction(async (uow) => {
        return withIdempotentResult(
          uow,
          {
            environment: command.environment,
            scope: `billing:refundInvoicePayment:${command.invoiceId}:${command.paymentId}`,
            idempotencyKey: command.idempotencyKey,
            request: command,
            createId: (prefix) => createId(prefix),
            now: now(),
          },
          async () => {
            await getMerchantOrThrow(uow, command.environment, command.merchantAccountId);

            try {
              const refund = await dependencies.refunds.createRefund({
                environment: command.environment,
                merchantAccountId: command.merchantAccountId,
                paymentId: command.paymentId,
                amount: command.amount,
                reason: command.reason,
                requestedByType: command.requestedByType,
                requestedByRef: command.requestedByRef,
                idempotencyKey: command.idempotencyKey,
              });

              return {
                invoiceId: command.invoiceId,
                refundId: refund.id,
                refundStatus: refund.status,
              };
            } catch (error) {
              if (error instanceof Error && error.name === "RefundsServiceError") {
                const typedError = error as Error & {
                  readonly code?: BillingServiceError["code"];
                  readonly retryable?: boolean;
                  readonly details?: Readonly<Record<string, string>>;
                };
                throw new BillingServiceError(
                  typedError.code === "provider_unavailable"
                    ? "provider_unavailable"
                    : typedError.code === "action_required"
                      ? "action_required"
                      : typedError.code === "not_found"
                        ? "not_found"
                        : typedError.code === "conflict"
                          ? "conflict"
                          : "invalid_request",
                  typedError.message,
                  {
                    retryable: typedError.retryable ?? false,
                    details: typedError.details,
                  },
                );
              }

              throw error;
            }
          },
        );
      });
    },

    async reconcileInvoicePayment(
      query: ReconcileInvoicePaymentQuery,
    ): Promise<ReconcileInvoicePaymentResult | null> {
      return dependencies.uow.runInTransaction(async (uow) => {
        const payment = await uow.payments.getById(query.paymentId, {
          environment: query.environment,
        });
        if (!payment) {
          return null;
        }

        const paymentRef = getRequiredPaymentProcessorRef(payment, query.paymentId);
        const snapshot = await fetchPaymentProviderSnapshot(
          dependencies,
          uow,
          query,
          payment,
          paymentRef,
        );
        const nextStatus = mapPaymentSnapshotStatus(snapshot);
        const updatedPayment: Payment = {
          ...payment,
          status: preserveRefundedPaymentStatus(payment.status, nextStatus),
          authorizedAt:
            nextStatus === "authorized"
              ? (payment.authorizedAt ?? snapshot.recordedAt)
              : payment.authorizedAt,
          capturedAt:
            nextStatus === "captured"
              ? (payment.capturedAt ?? snapshot.recordedAt)
              : payment.capturedAt,
          updatedAt: snapshot.recordedAt,
        };
        await uow.payments.save(updatedPayment);

        const paymentIntent = await saveReconciledPaymentIntent(
          uow,
          query,
          payment,
          nextStatus,
          snapshot.recordedAt,
        );

        return {
          paymentId: payment.id,
          paymentIntentId: paymentIntent.id,
          paymentStatus: nextStatus,
          amount: payment.amount,
          currency: payment.currency,
          reconciledAt: snapshot.recordedAt,
        };
      });
    },

    async reconcileInvoiceRefund(
      query: ReconcileInvoiceRefundQuery,
    ): Promise<ReconcileInvoiceRefundResult | null> {
      return dependencies.uow.runInTransaction(async (uow) => {
        const refund = await uow.refunds.getById(query.refundId, {
          environment: query.environment,
        });
        if (!refund) {
          return null;
        }

        const refundRef =
          refund.processorRefundRefs.find((ref) => ref.relationship === "refund") ??
          refund.processorRefundRefs[0] ??
          null;
        if (!refundRef) {
          throw new BillingServiceError(
            "invalid_request",
            "refund is missing provider refund reference",
            {
              details: { refundId: query.refundId },
            },
          );
        }
        if (!isProviderKey(refundRef.provider)) {
          throw new BillingServiceError("invalid_request", "refund provider is not registered", {
            details: { provider: refundRef.provider },
          });
        }

        const merchant = await getMerchantOrThrow(uow, query.environment, refund.merchantAccountId);
        const provider = dependencies.providers.getAdapter(refundRef.provider);
        const snapshot = await provider.fetchObjectSnapshot(
          resolveReconciliationProviderContext(
            dependencies.resolveProviderContext,
            merchant,
            refundRef.provider,
            query.environment,
          ),
          refundRef,
        );
        if (!snapshot.ok || !snapshot.value) {
          throw new BillingServiceError(
            snapshot.error?.category === "temporarily_unavailable"
              ? "provider_unavailable"
              : "invalid_request",
            snapshot.error?.message ?? "provider refund snapshot unavailable",
            {
              retryable: snapshot.error?.retryable ?? false,
              details: { refundId: query.refundId },
            },
          );
        }

        const updatedRefund: Refund = {
          ...refund,
          status: mapRefundSnapshotStatus(snapshot.value),
          updatedAt: snapshot.value.recordedAt,
        };
        await uow.refunds.save(updatedRefund);

        const payment = await uow.payments.getById(refund.paymentId, {
          environment: query.environment,
        });
        if (payment) {
          const refunds = await uow.refunds.listByPayment(query.environment, refund.paymentId);
          await uow.payments.save({
            ...payment,
            status: derivePaymentStatusAfterRefund(
              payment,
              refunds.map((entry) => (entry.id === updatedRefund.id ? updatedRefund : entry)),
            ),
            updatedAt: snapshot.value.recordedAt,
          });
        }

        return {
          refundId: refund.id,
          paymentId: refund.paymentId,
          refundStatus: updatedRefund.status,
          amount: refund.amount,
          currency: refund.currency,
          reconciledAt: snapshot.value.recordedAt,
        };
      });
    },

    async getMerchantReadiness(
      query: GetMerchantReadinessQuery,
    ): Promise<MerchantReadinessSnapshot | null> {
      return getMerchantReadinessSnapshot(dependencies.uow, query);
    },

    async listCustomerPaymentMethods(
      query: GetCustomerPaymentMethodsQuery,
    ): Promise<ReturnType<typeof mapPaymentMethodsToBillingSummaries>> {
      const paymentMethods = await dependencies.listPaymentMethods(query);
      return mapPaymentMethodsToBillingSummaries(
        paymentMethods.filter(
          (paymentMethod) =>
            paymentMethod.ownerType === "customer" &&
            paymentMethod.ownerId === query.customerProfileId &&
            paymentMethod.status === "active",
        ),
      );
    },
  };
}
