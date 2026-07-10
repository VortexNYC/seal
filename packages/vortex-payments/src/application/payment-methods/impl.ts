import type { PaymentIntent } from "../../domain/payments";
import type { PaymentMethod } from "../../domain/payment-methods";
import type { CustomerPaymentState } from "../../domain/state";
import type { CanonicalDomainEvent } from "../../events/types";
import { deriveCustomerPaymentState } from "../state/derive-customer-payment-state";
import {
  getCustomerPaymentReadinessReasons,
  type ArchivePaymentMethodCommand,
  type CustomerPaymentStateSnapshot,
  type DisablePaymentMethodCommand,
  type ListCustomerPaymentMethodsQuery,
  type PaymentMethodSnapshot,
  type SetDefaultCustomerPaymentMethodCommand,
} from "./contracts";
import type { PaymentMethodsService } from "./service";

export class PaymentMethodsServiceError extends Error {
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
    code: PaymentMethodsServiceError["code"],
    message: string,
    options?: {
      retryable?: boolean;
      details?: Readonly<Record<string, string>>;
    },
  ) {
    super(message);
    this.name = "PaymentMethodsServiceError";
    this.code = code;
    this.retryable = options?.retryable ?? false;
    this.details = options?.details;
  }
}

export interface PaymentMethodsServiceDependencies {
  readonly listPaymentMethods: (
    query: ListCustomerPaymentMethodsQuery,
  ) => Promise<readonly PaymentMethod[]>;
  readonly savePaymentMethod: (record: PaymentMethod) => Promise<void>;
  readonly listPaymentIntents: (
    query: ListCustomerPaymentMethodsQuery,
  ) => Promise<readonly PaymentIntent[]>;
  readonly saveCustomerPaymentState?: (state: CustomerPaymentState) => Promise<void>;
  readonly saveCanonicalEvent?: (event: CanonicalDomainEvent) => Promise<void>;
  readonly now?: () => string;
}

function createPaymentMethodEvent(input: {
  readonly id: string;
  readonly paymentMethod: PaymentMethod;
  readonly customerProfileId: string;
  readonly merchantAccountId: string;
  readonly occurredAt: string;
  readonly action: "default_changed" | "archived" | "disabled";
  readonly reason?: string;
}): CanonicalDomainEvent {
  return {
    id: input.id,
    environment: input.paymentMethod.environment,
    eventType: "payment_method.updated",
    aggregateType: "payment_method",
    aggregateId: input.paymentMethod.id,
    occurredAt: input.occurredAt,
    sourceProvider: "vortex",
    payload: {
      merchantAccountId: input.merchantAccountId,
      customerProfileId: input.customerProfileId,
      paymentMethodId: input.paymentMethod.id,
      paymentMethodStatus: input.paymentMethod.status,
      isDefault: input.paymentMethod.isDefault,
      action: input.action,
      reason: input.reason ?? null,
    },
    createdAt: input.occurredAt,
  };
}

function toSnapshot(record: PaymentMethod): PaymentMethodSnapshot {
  return {
    id: record.id,
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

function isCustomerPaymentMethodInScope(
  paymentMethod: PaymentMethod,
  query: ListCustomerPaymentMethodsQuery,
): boolean {
  return (
    paymentMethod.ownerType === "customer" &&
    paymentMethod.ownerId === query.customerProfileId &&
    (paymentMethod.merchantAccountId === undefined ||
      paymentMethod.merchantAccountId === query.merchantAccountId)
  );
}

function assertCustomerOwnership(
  record: PaymentMethod,
  query: ListCustomerPaymentMethodsQuery,
): void {
  if (record.ownerType !== "customer" || record.ownerId !== query.customerProfileId) {
    throw new PaymentMethodsServiceError(
      "invalid_request",
      "payment method does not belong to customer",
      {
        details: {
          paymentMethodId: record.id,
          customerProfileId: query.customerProfileId,
        },
      },
    );
  }
}

async function deriveAndPersistCustomerState(
  dependencies: PaymentMethodsServiceDependencies,
  query: ListCustomerPaymentMethodsQuery,
  paymentMethods: readonly PaymentMethod[],
): Promise<CustomerPaymentStateSnapshot> {
  const paymentIntents = await dependencies.listPaymentIntents(query);
  const generatedAt = dependencies.now?.() ?? new Date().toISOString();
  const state = deriveCustomerPaymentState({
    customerProfileId: query.customerProfileId,
    merchantAccountId: query.merchantAccountId,
    environment: query.environment,
    paymentMethods,
    paymentIntents,
    generatedAt,
  });
  await dependencies.saveCustomerPaymentState?.(state);

  const customerMethods = paymentMethods.filter((paymentMethod) =>
    isCustomerPaymentMethodInScope(paymentMethod, query),
  );
  const snapshots = customerMethods.map(toSnapshot);

  return {
    ...state,
    readinessReasons: getCustomerPaymentReadinessReasons(state, customerMethods),
    paymentMethods: snapshots,
    defaultPaymentMethod: snapshots.find(
      (paymentMethod) => paymentMethod.id === state.defaultPaymentMethodId,
    ),
    requiresActionPaymentIntentCount: state.requiresActionPaymentIntentIds.length,
  };
}

async function saveLifecycleChange(
  dependencies: PaymentMethodsServiceDependencies,
  command: ArchivePaymentMethodCommand | DisablePaymentMethodCommand,
  nextStatus: PaymentMethod["status"],
): Promise<PaymentMethodSnapshot> {
  const paymentMethods = await dependencies.listPaymentMethods(command);
  const selected = paymentMethods.find(
    (paymentMethod) => paymentMethod.id === command.paymentMethodId,
  );

  if (!selected) {
    throw new PaymentMethodsServiceError("not_found", "payment method not found", {
      details: { paymentMethodId: command.paymentMethodId },
    });
  }
  assertCustomerOwnership(selected, command);
  if (selected.status === nextStatus) {
    return toSnapshot(selected);
  }
  if (selected.status === "archived") {
    throw new PaymentMethodsServiceError(
      "conflict",
      "archived payment method cannot change lifecycle state",
      {
        details: { paymentMethodId: command.paymentMethodId },
      },
    );
  }

  const changedAt = dependencies.now?.() ?? new Date().toISOString();
  const updatedSelected: PaymentMethod = {
    ...selected,
    status: nextStatus,
    isDefault: false,
    archivedAt: nextStatus === "archived" ? changedAt : selected.archivedAt,
    updatedAt: changedAt,
  };
  await dependencies.savePaymentMethod(updatedSelected);

  const customerMethods = paymentMethods
    .filter((paymentMethod) => isCustomerPaymentMethodInScope(paymentMethod, command))
    .map((paymentMethod) =>
      paymentMethod.id === updatedSelected.id ? updatedSelected : paymentMethod,
    );

  const hasDefault = customerMethods.some(
    (paymentMethod) => paymentMethod.status === "active" && paymentMethod.isDefault,
  );
  const fallback = !hasDefault
    ? customerMethods.find((paymentMethod) => paymentMethod.status === "active")
    : undefined;

  await dependencies.saveCanonicalEvent?.(
    createPaymentMethodEvent({
      id: `${updatedSelected.id}:payment_method.updated:${changedAt}`,
      paymentMethod: updatedSelected,
      customerProfileId: command.customerProfileId,
      merchantAccountId: command.merchantAccountId,
      occurredAt: changedAt,
      action: nextStatus === "archived" ? "archived" : "disabled",
      reason: command.reason,
    }),
  );

  if (fallback) {
    const updatedFallback: PaymentMethod = {
      ...fallback,
      isDefault: true,
      updatedAt: changedAt,
    };
    await dependencies.savePaymentMethod(updatedFallback);
    await deriveAndPersistCustomerState(
      dependencies,
      command,
      customerMethods.map((paymentMethod) =>
        paymentMethod.id === updatedFallback.id ? updatedFallback : paymentMethod,
      ),
    );
  } else {
    await deriveAndPersistCustomerState(dependencies, command, customerMethods);
  }

  return toSnapshot(updatedSelected);
}

export function createPaymentMethodsService(
  dependencies: PaymentMethodsServiceDependencies,
): PaymentMethodsService {
  return {
    async listCustomerPaymentMethods(
      query: ListCustomerPaymentMethodsQuery,
    ): Promise<readonly PaymentMethodSnapshot[]> {
      const paymentMethods = await dependencies.listPaymentMethods(query);
      return paymentMethods
        .filter((paymentMethod) => isCustomerPaymentMethodInScope(paymentMethod, query))
        .map(toSnapshot);
    },

    async getCustomerPaymentMethod(query) {
      const paymentMethods = await dependencies.listPaymentMethods(query);
      const paymentMethod = paymentMethods.find(
        (record) =>
          record.id === query.paymentMethodId && isCustomerPaymentMethodInScope(record, query),
      );
      return paymentMethod ? toSnapshot(paymentMethod) : null;
    },

    async setDefaultCustomerPaymentMethod(
      command: SetDefaultCustomerPaymentMethodCommand,
    ): Promise<readonly PaymentMethodSnapshot[]> {
      const paymentMethods = await dependencies.listPaymentMethods(command);
      const customerMethods = paymentMethods.filter((paymentMethod) =>
        isCustomerPaymentMethodInScope(paymentMethod, command),
      );
      const selected = customerMethods.find(
        (paymentMethod) => paymentMethod.id === command.paymentMethodId,
      );

      if (!selected) {
        throw new PaymentMethodsServiceError("not_found", "payment method not found", {
          details: { paymentMethodId: command.paymentMethodId },
        });
      }
      if (selected.status !== "active") {
        throw new PaymentMethodsServiceError(
          "invalid_request",
          "payment method must be active to become default",
          {
            details: { paymentMethodId: command.paymentMethodId },
          },
        );
      }

      const updates = customerMethods.map((paymentMethod) => ({
        ...paymentMethod,
        isDefault: paymentMethod.id === command.paymentMethodId,
        updatedAt: dependencies.now?.() ?? new Date().toISOString(),
      }));

      for (const record of updates) {
        await dependencies.savePaymentMethod(record);
      }
      const selectedUpdated = updates.find(
        (paymentMethod) => paymentMethod.id === command.paymentMethodId,
      );
      if (selectedUpdated) {
        await dependencies.saveCanonicalEvent?.(
          createPaymentMethodEvent({
            id: `${selectedUpdated.id}:payment_method.updated:${selectedUpdated.updatedAt}`,
            paymentMethod: selectedUpdated,
            customerProfileId: command.customerProfileId,
            merchantAccountId: command.merchantAccountId,
            occurredAt: selectedUpdated.updatedAt,
            action: "default_changed",
          }),
        );
      }
      await deriveAndPersistCustomerState(dependencies, command, updates);
      return updates.map(toSnapshot);
    },

    async archivePaymentMethod(
      command: ArchivePaymentMethodCommand,
    ): Promise<PaymentMethodSnapshot> {
      return saveLifecycleChange(dependencies, command, "archived");
    },

    async disablePaymentMethod(
      command: DisablePaymentMethodCommand,
    ): Promise<PaymentMethodSnapshot> {
      return saveLifecycleChange(dependencies, command, "disabled");
    },

    async getCustomerPaymentState(
      query: ListCustomerPaymentMethodsQuery,
    ): Promise<CustomerPaymentStateSnapshot> {
      const paymentMethods = await dependencies.listPaymentMethods(query);
      return deriveAndPersistCustomerState(dependencies, query, paymentMethods);
    },
  };
}
