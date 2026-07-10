import type { CustomerProfileId, MerchantAccountId } from "../../domain/common";
import type { MerchantAccount } from "../../domain/merchant";
import type { CustomerProfile } from "../../domain/payment-methods";
import type { CanonicalDomainEvent } from "../../events/types";
import type { PaymentsUnitOfWork } from "../../storage/unit-of-work";
import type {
  CreateCustomerProfileCommand,
  CustomerProfileSnapshot,
  GetCustomerProfileQuery,
  UpdateCustomerProfileCommand,
} from "./contracts";
import type { CustomersService } from "./service";

export class CustomersServiceError extends Error {
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
    code: CustomersServiceError["code"],
    message: string,
    options?: {
      retryable?: boolean;
      details?: Readonly<Record<string, string>>;
    },
  ) {
    super(message);
    this.name = "CustomersServiceError";
    this.code = code;
    this.retryable = options?.retryable ?? false;
    this.details = options?.details;
  }
}

export interface CustomersServiceDependencies {
  readonly uow: PaymentsUnitOfWork;
  readonly now?: () => string;
  readonly createId?: (prefix: "cust") => string;
}

function createDefaultId(prefix: "cust"): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function createCustomerEvent(input: {
  readonly id: string;
  readonly eventType: CanonicalDomainEvent["eventType"];
  readonly customer: CustomerProfile;
  readonly occurredAt: string;
}): CanonicalDomainEvent {
  return {
    id: input.id,
    environment: input.customer.environment,
    eventType: input.eventType,
    aggregateType: "customer",
    aggregateId: input.customer.id,
    occurredAt: input.occurredAt,
    sourceProvider: "vortex",
    payload: {
      merchantAccountId: input.customer.merchantAccountId,
      customerProfileId: input.customer.id,
      externalCustomerId: input.customer.externalCustomerId ?? null,
      name: input.customer.name ?? null,
      email: input.customer.email ?? null,
    },
    createdAt: input.occurredAt,
  };
}

function toSnapshot(record: CustomerProfile): CustomerProfileSnapshot {
  return {
    id: record.id,
    environment: record.environment,
    merchantAccountId: record.merchantAccountId,
    externalCustomerId: record.externalCustomerId,
    name: record.name,
    email: record.email,
    phone: record.phone,
    metadata: record.metadata,
  };
}

async function getMerchantOrThrow(
  uow: PaymentsUnitOfWork,
  environment: CreateCustomerProfileCommand["environment"],
  merchantAccountId: MerchantAccountId,
): Promise<MerchantAccount> {
  const merchant = await uow.merchants.getById(merchantAccountId, { environment });
  if (!merchant) {
    throw new CustomersServiceError("not_found", "merchant account not found", {
      details: { merchantAccountId },
    });
  }
  return merchant;
}

async function getCustomerOrThrow(
  uow: PaymentsUnitOfWork,
  environment: UpdateCustomerProfileCommand["environment"],
  merchantAccountId: MerchantAccountId,
  customerProfileId: CustomerProfileId,
): Promise<CustomerProfile> {
  const customer = await uow.customers.getById(customerProfileId, { environment });
  if (!customer || customer.merchantAccountId !== merchantAccountId) {
    throw new CustomersServiceError("not_found", "customer profile not found", {
      details: { merchantAccountId, customerProfileId },
    });
  }
  return customer;
}

export function createCustomersService(
  dependencies: CustomersServiceDependencies,
): CustomersService {
  const now = dependencies.now ?? (() => new Date().toISOString());
  const createId = dependencies.createId ?? createDefaultId;

  return {
    async createCustomerProfile(
      command: CreateCustomerProfileCommand,
    ): Promise<CustomerProfileSnapshot> {
      await getMerchantOrThrow(dependencies.uow, command.environment, command.merchantAccountId);
      const createdAt = now();
      const customer: CustomerProfile = {
        id: createId("cust"),
        environment: command.environment,
        merchantAccountId: command.merchantAccountId,
        externalCustomerId: command.externalCustomerId,
        name: command.name,
        email: command.email,
        phone: command.phone,
        metadata: command.metadata,
        processorCustomerRefs: [],
        createdAt,
        updatedAt: createdAt,
      };
      await dependencies.uow.customers.save(customer);
      await dependencies.uow.events.saveCanonicalEvent(
        createCustomerEvent({
          id: `${customer.id}:customer.created:${createdAt}`,
          eventType: "customer.created",
          customer,
          occurredAt: createdAt,
        }),
      );
      return toSnapshot(customer);
    },

    async getCustomerProfile(
      query: GetCustomerProfileQuery,
    ): Promise<CustomerProfileSnapshot | null> {
      const customer = await dependencies.uow.customers.getById(query.customerProfileId, {
        environment: query.environment,
      });
      if (!customer || customer.merchantAccountId !== query.merchantAccountId) {
        return null;
      }
      return toSnapshot(customer);
    },

    async updateCustomerProfile(
      command: UpdateCustomerProfileCommand,
    ): Promise<CustomerProfileSnapshot> {
      await getMerchantOrThrow(dependencies.uow, command.environment, command.merchantAccountId);
      const existing = await getCustomerOrThrow(
        dependencies.uow,
        command.environment,
        command.merchantAccountId,
        command.customerProfileId,
      );
      const updated: CustomerProfile = {
        ...existing,
        name: command.name ?? existing.name,
        email: command.email ?? existing.email,
        phone: command.phone ?? existing.phone,
        metadata: command.metadata ?? existing.metadata,
        updatedAt: now(),
      };
      await dependencies.uow.customers.save(updated);
      await dependencies.uow.events.saveCanonicalEvent(
        createCustomerEvent({
          id: `${updated.id}:customer.updated:${updated.updatedAt}`,
          eventType: "customer.updated",
          customer: updated,
          occurredAt: updated.updatedAt,
        }),
      );
      return toSnapshot(updated);
    },
  };
}
