import { describe, expect, test } from "vitest";
import type { MerchantAccount } from "../../domain/merchant";
import type { CustomerProfile } from "../../domain/payment-methods";
import type { CanonicalDomainEvent } from "../../events/types";
import type { PaymentsUnitOfWork } from "../../storage/unit-of-work";
import { createCustomersService, CustomersServiceError } from "./impl";

function createMerchant(overrides: Partial<MerchantAccount> = {}): MerchantAccount {
  return {
    id: "merchant_123",
    environment: "sandbox",
    tenantId: "tenant_123",
    displayName: "Merchant",
    legalEntityType: "CORPORATION",
    country: "USA",
    merchantMode: "processing",
    defaultCurrency: "USD",
    status: "draft",
    capabilityStatus: "draft",
    processorAccountRefs: [],
    createdAt: "2026-04-23T12:00:00.000Z",
    updatedAt: "2026-04-23T12:00:00.000Z",
    ...overrides,
  };
}

function createCustomer(overrides: Partial<CustomerProfile> = {}): CustomerProfile {
  return {
    id: "cust_123",
    environment: "sandbox",
    merchantAccountId: "merchant_123",
    externalCustomerId: "ext_123",
    name: "Customer",
    email: "customer@example.com",
    phone: "5551112222",
    processorCustomerRefs: [],
    createdAt: "2026-04-23T12:00:00.000Z",
    updatedAt: "2026-04-23T12:00:00.000Z",
    ...overrides,
  };
}

function createUnitOfWork(options?: {
  merchant?: MerchantAccount | null;
  customer?: CustomerProfile | null;
}) {
  const savedCustomers: CustomerProfile[] = [];
  const canonicalEvents = new Map<string, CanonicalDomainEvent>();
  let customer = options?.customer ?? null;
  const uow: PaymentsUnitOfWork = {
    merchants: {
      async getById() { return options?.merchant === undefined ? createMerchant() : options.merchant; },
      async listByTenant() { return []; },
      async getByProcessorRef() { return null; },
      async save() {},
    },
    customers: {
      async getById() { return customer; },
      async save(record) {
        savedCustomers.push(record);
        customer = record;
      },
    },
    onboarding: {
      async getSessionById() { return null; },
      async getLatestSessionByMerchantAccountId() { return null; },
      async listRequirementsForSession() { return []; },
      async listDocumentsForRequirement() { return []; },
      async saveSession() {},
      async saveRequirement() {},
      async saveRequirementDocument() {},
    },
    merchantStates: {
      async getByMerchantAccountId() { return null; },
      async save() {},
    },
    customerStates: {
      async getByMerchantAndCustomer() { return null; },
      async save() {},
    },
    paymentMethods: {
      async getById() { return null; },
      async getByProcessorRef() { return null; },
      async listByOwner() { return []; },
      async save() {},
    },
    paymentMethodSetupSessions: {
      async getById() { return null; },
      async save() {},
    },
    paymentIntents: {
      async getById() { return null; },
      async getByProcessorRef() { return null; },
      async listByMerchant() { return []; },
      async listByCustomerProfile() { return []; },
      async save() {},
    },
    payments: {
      async getById() { return null; },
      async getByPaymentIntentId() { return null; },
      async save() {},
    },
    refunds: {
      async getById() { return null; },
      async getByProcessorRef() { return null; },
      async listByPayment() { return []; },
      async save() {},
    },
    settlements: {
      async getById() { return null; },
      async getByProcessorRef() { return null; },
      async listByMerchant() { return []; },
      async save() {},
    },
    payouts: {
      async getById() { return null; },
      async getByProcessorRef() { return null; },
      async listByMerchant() { return []; },
      async save() {},
    },
    disputes: {
      async getById() { return null; },
      async getByProcessorRef() { return null; },
      async listByMerchant() { return []; },
      async save() {},
    },
    events: {
      async getRawWebhookById() { return null; },
      async getRawWebhookByDeliveryKey() { return null; },
      async saveRawWebhook() {},
      async getProcessorEventById() { return null; },
      async saveProcessorEvent() {},
      async saveCanonicalEvent(record) { canonicalEvents.set(`${record.environment}:${record.id}`, record); },
      async getCanonicalEventById(id, options) { return canonicalEvents.get(`${options.environment}:${id}`) ?? null; },
      async getWebhookEndpointById() { return null; },
      async saveWebhookEndpoint() {},
      async saveWebhookDelivery() {},
      async saveEventSubscription() {},
    },
    cases: {
      async getById() { return null; },
      async save() {},
      async saveActivity() {},
      async saveNote() {},
    },
    idempotency: {
      async getByScopeAndKey() { return null; },
      async save() {},
    },
    async runInTransaction(work) { return work(uow); },
  };

  return { uow, savedCustomers };
}

describe("createCustomersService", () => {
  test("creates customer profile", async () => {
    const { uow, savedCustomers } = createUnitOfWork();
    const service = createCustomersService({
      uow,
      now: () => "2026-04-23T12:00:00.000Z",
      createId: () => "cust_123",
    });

    const customer = await service.createCustomerProfile({
      environment: "sandbox",
      merchantAccountId: "merchant_123",
      name: "Customer",
      email: "customer@example.com",
    });

    expect(customer.id).toBe("cust_123");
    expect(savedCustomers).toHaveLength(1);
    expect(await uow.events.getCanonicalEventById("cust_123:customer.created:2026-04-23T12:00:00.000Z", {
      environment: "sandbox",
    })).toMatchObject({
      eventType: "customer.created",
      aggregateId: "cust_123",
      payload: {
        merchantAccountId: "merchant_123",
        customerProfileId: "cust_123",
        email: "customer@example.com",
      },
    });
  });

  test("returns null for customer outside merchant scope", async () => {
    const { uow } = createUnitOfWork({
      customer: createCustomer({ merchantAccountId: "merchant_other" }),
    });
    const service = createCustomersService({ uow });

    const customer = await service.getCustomerProfile({
      environment: "sandbox",
      merchantAccountId: "merchant_123",
      customerProfileId: "cust_123",
    });

    expect(customer).toBeNull();
  });

  test("updates customer profile", async () => {
    const { uow, savedCustomers } = createUnitOfWork({ customer: createCustomer() });
    const service = createCustomersService({
      uow,
      now: () => "2026-04-23T13:00:00.000Z",
    });

    const customer = await service.updateCustomerProfile({
      environment: "sandbox",
      merchantAccountId: "merchant_123",
      customerProfileId: "cust_123",
      email: "updated@example.com",
    });

    expect(customer.email).toBe("updated@example.com");
    expect(savedCustomers.at(-1)?.updatedAt).toBe("2026-04-23T13:00:00.000Z");
    expect(await uow.events.getCanonicalEventById("cust_123:customer.updated:2026-04-23T13:00:00.000Z", {
      environment: "sandbox",
    })).toMatchObject({
      eventType: "customer.updated",
      aggregateId: "cust_123",
      payload: {
        merchantAccountId: "merchant_123",
        customerProfileId: "cust_123",
        email: "updated@example.com",
      },
    });
  });

  test("throws not_found when merchant missing", async () => {
    const { uow } = createUnitOfWork({ merchant: null });
    const service = createCustomersService({ uow });

    await expect(
      service.createCustomerProfile({
        environment: "sandbox",
        merchantAccountId: "merchant_123",
      }),
    ).rejects.toBeInstanceOf(CustomersServiceError);
  });
});
