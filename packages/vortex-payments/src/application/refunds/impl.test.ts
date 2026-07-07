import { describe, expect, test } from "vitest";
import type { MerchantAccount } from "../../domain/merchant";
import type { Payment, Refund } from "../../domain/payments";
import type { CustomerPaymentState, MerchantAccountState } from "../../domain/state";
import type { PaymentMethod } from "../../domain/payment-methods";
import type { CanonicalDomainEvent } from "../../events/types";
import type { ProviderRegistry } from "../../providers/registry";
import type { PaymentsProviderAdapter, ProviderContext } from "../../providers/types";
import type { IdempotencyRecord } from "../../storage/repositories";
import type { PaymentsUnitOfWork } from "../../storage/unit-of-work";
import { createRefundsService, type RefundsServiceError } from "./impl";

function createMerchant(overrides: Partial<MerchantAccount> = {}): MerchantAccount {
  return {
    id: "merchant_123",
    environment: "sandbox",
    tenantId: "tenant_123",
    displayName: "Vortex Merchant",
    legalEntityType: "CORPORATION",
    country: "USA",
    merchantMode: "processing",
    defaultCurrency: "USD",
    status: "active",
    capabilityStatus: "active",
    processorAccountRefs: [
      {
        provider: "finix",
        objectType: "merchant",
        objectId: "mu_123",
        relationship: "merchant_account",
        recordedAt: "2026-04-23T12:00:00.000Z",
      },
    ],
    createdAt: "2026-04-23T00:00:00.000Z",
    updatedAt: "2026-04-23T00:00:00.000Z",
    ...overrides,
  };
}

function createPayment(overrides: Partial<Payment> = {}): Payment {
  return {
    id: "payment_123",
    environment: "sandbox",
    merchantAccountId: "merchant_123",
    amount: 500,
    currency: "USD",
    status: "captured",
    direction: "debit",
    processorPaymentRefs: [
      {
        provider: "finix",
        objectType: "transfer",
        objectId: "tr_123",
        relationship: "payment",
        recordedAt: "2026-04-23T12:00:00.000Z",
      },
    ],
    createdAt: "2026-04-23T00:00:00.000Z",
    updatedAt: "2026-04-23T00:00:00.000Z",
    ...overrides,
  };
}

function createMemoryUnitOfWork(seed?: { merchant?: MerchantAccount; payment?: Payment; refund?: Refund }): PaymentsUnitOfWork {
  const merchants = new Map<string, MerchantAccount>();
  const payments = new Map<string, Payment>();
  const refunds = new Map<string, Refund>();
  const merchantStates = new Map<string, MerchantAccountState>();
  const customerStates = new Map<string, CustomerPaymentState>();
  const paymentMethodsStore = new Map<string, PaymentMethod>();
  const canonicalEvents = new Map<string, CanonicalDomainEvent>();
  const idempotency = new Map<string, IdempotencyRecord>();

  if (seed?.merchant) {
    merchants.set(`${seed.merchant.environment}:${seed.merchant.id}`, seed.merchant);
  }
  if (seed?.payment) {
    payments.set(`${seed.payment.environment}:${seed.payment.id}`, seed.payment);
  }
  if (seed?.refund) {
    refunds.set(`${seed.refund.environment}:${seed.refund.id}`, seed.refund);
  }

  return {
    merchants: {
      async getById(id, options) {
        return merchants.get(`${options.environment}:${id}`) ?? null;
      },
      async listByTenant(environment, tenantId) {
        return Array.from(merchants.values()).filter(
          (merchant) => merchant.environment === environment && merchant.tenantId === tenantId,
        );
      },
      async getByProcessorRef(environment, provider, objectType, objectId) {
        return Array.from(merchants.values()).find(
          (merchant) =>
            merchant.environment === environment &&
            merchant.processorAccountRefs.some(
              (ref) => ref.provider === provider && ref.objectType === objectType && ref.objectId === objectId,
            ),
        ) ?? null;
      },
      async save(record) {
        merchants.set(`${record.environment}:${record.id}`, record);
      },
    },
    customers: {
      async getById() { return null; },
      async save() {},
    },
    onboarding: {
      async getSessionById() {
        return null;
      },
      async getLatestSessionByMerchantAccountId() {
        return null;
      },
      async listRequirementsForSession() {
        return [];
      },
      async listDocumentsForRequirement() {
        return [];
      },
      async saveSession() {},
      async saveRequirement() {},
      async saveRequirementDocument() {},
    },
    merchantStates: {
      async getByMerchantAccountId(merchantAccountId, options) {
        return merchantStates.get(`${options.environment}:${merchantAccountId}`) ?? null;
      },
      async save(record) {
        merchantStates.set(`${record.environment}:${record.merchantAccountId}`, record);
      },
    },
    customerStates: {
      async getByMerchantAndCustomer(environment, merchantAccountId, customerProfileId) {
        return customerStates.get(`${environment}:${merchantAccountId}:${customerProfileId}`) ?? null;
      },
      async save(record) {
        customerStates.set(`${record.environment}:${record.merchantAccountId}:${record.customerProfileId}`, record);
      },
    },
    paymentMethods: {
      async getById(id, options) {
        return paymentMethodsStore.get(`${options.environment}:${id}`) ?? null;
      },
      async getByProcessorRef() {
        return null;
      },
      async listByOwner(environment, ownerType, ownerId) {
        return Array.from(paymentMethodsStore.values()).filter((record) => record.environment === environment && record.ownerType === ownerType && record.ownerId === ownerId);
      },
      async save(record) {
        paymentMethodsStore.set(`${record.environment}:${record.id}`, record);
      },
    },
    paymentMethodSetupSessions: {
      async getById() { return null; },
      async save() {},
    },
    paymentIntents: {
      async getById() {
        return null;
      },
      async getByProcessorRef() {
        return null;
      },
      async listByMerchant() {
        return [];
      },
      async listByCustomerProfile() {
        return [];
      },
      async save() {},
    },
    payments: {
      async getById(id, options) {
        return payments.get(`${options.environment}:${id}`) ?? null;
      },
      async getByPaymentIntentId(environment, paymentIntentId) {
        return Array.from(payments.values()).find(
          (record) => record.environment === environment && record.paymentIntentId === paymentIntentId,
        ) ?? null;
      },
      async save(record) {
        payments.set(`${record.environment}:${record.id}`, record);
      },
    },
    refunds: {
      async getById(id, options) {
        return refunds.get(`${options.environment}:${id}`) ?? null;
      },
      async getByProcessorRef(environment, provider, objectType, objectId) {
        return Array.from(refunds.values()).find(
          (record) =>
            record.environment === environment &&
            record.processorRefundRefs.some(
              (ref) => ref.provider === provider && ref.objectType === objectType && ref.objectId === objectId,
            ),
        ) ?? null;
      },
      async listByPayment(environment, paymentId) {
        return Array.from(refunds.values()).filter(
          (record) => record.environment === environment && record.paymentId === paymentId,
        );
      },
      async save(record) {
        refunds.set(`${record.environment}:${record.id}`, record);
      },
    },
    settlements: {
      async getById() {
        return null;
      },
      async getByProcessorRef() {
        return null;
      },
      async listByMerchant() {
        return [];
      },
      async save() {},
    },
    payouts: {
      async getById() {
        return null;
      },
      async getByProcessorRef() {
        return null;
      },
      async listByMerchant() {
        return [];
      },
      async save() {},
    },
    disputes: {
      async getById() {
        return null;
      },
      async getByProcessorRef() {
        return null;
      },
      async listByMerchant() {
        return [];
      },
      async save() {},
    },
    events: {
      async getRawWebhookById() {
        return null;
      },
      async getRawWebhookByDeliveryKey() {
        return null;
      },
      async saveRawWebhook() {},
      async getProcessorEventById() {
        return null;
      },
      async saveProcessorEvent() {},
      async saveCanonicalEvent(record) {
        canonicalEvents.set(`${record.environment}:${record.id}`, record);
      },
      async getCanonicalEventById(id, options) {
        return canonicalEvents.get(`${options.environment}:${id}`) ?? null;
      },
      async getWebhookEndpointById() {
        return null;
      },
      async saveWebhookEndpoint() {},
      async saveWebhookDelivery() {},
      async saveEventSubscription() {},
    },
    cases: {
      async getById() {
        return null;
      },
      async save() {},
      async saveActivity() {},
      async saveNote() {},
    },
    idempotency: {
      async getByScopeAndKey(environment, scope, key) {
        return idempotency.get(`${environment}:${scope}:${key}`) ?? null;
      },
      async save(record) {
        idempotency.set(`${record.environment}:${record.scope}:${record.idempotencyKey}`, record);
      },
    },
    async runInTransaction(work) {
      return work(this);
    },
  };
}

function createRegistry(adapter: PaymentsProviderAdapter): ProviderRegistry {
  return {
    getAdapter() {
      return adapter;
    },
    listAdapters() {
      return [adapter];
    },
  };
}

const providerContext: ProviderContext = {
  provider: "finix",
  environment: "sandbox",
  tenantId: "tenant_123",
};

describe("createRefundsService", () => {
  test("throws not_found when merchant does not exist", async () => {
    const adapter: PaymentsProviderAdapter = {
      key: "finix",
      supportedCapabilities: ["refunds"],
      async verifyWebhookSignature() { throw new Error("not used"); },
      async createMerchantOnboarding() { throw new Error("not used"); },
      async createPaymentIntent() { throw new Error("not used"); },
      async createRefund() { throw new Error("not used"); },
      async fetchObjectSnapshot() { throw new Error("not used"); },
    };

    const service = createRefundsService({
      uow: createMemoryUnitOfWork({ payment: createPayment() }),
      providers: createRegistry(adapter),
      resolveProviderContext: () => providerContext,
    });

    await expect(service.createRefund({
      environment: "sandbox",
      merchantAccountId: "missing_merchant",
      paymentId: "payment_123",
      amount: 100,
      reason: "customer_request",
      requestedByType: "operator",
      requestedByRef: "user_123",
    })).rejects.toMatchObject({ name: "RefundsServiceError", code: "not_found" } satisfies Partial<RefundsServiceError>);
  });

  test("maps provider failure into service error", async () => {
    const adapter: PaymentsProviderAdapter = {
      key: "finix",
      supportedCapabilities: ["refunds"],
      async verifyWebhookSignature() { throw new Error("not used"); },
      async createMerchantOnboarding() { throw new Error("not used"); },
      async createPaymentIntent() { throw new Error("not used"); },
      async createRefund() {
        return {
          ok: false,
          error: {
            provider: "finix",
            category: "temporarily_unavailable",
            code: "finix_down",
            message: "Finix unavailable",
            retryable: true,
          },
        };
      },
      async fetchObjectSnapshot() { throw new Error("not used"); },
    };

    const service = createRefundsService({
      uow: createMemoryUnitOfWork({ merchant: createMerchant(), payment: createPayment() }),
      providers: createRegistry(adapter),
      resolveProviderContext: () => providerContext,
    });

    await expect(service.createRefund({
      environment: "sandbox",
      merchantAccountId: "merchant_123",
      paymentId: "payment_123",
      amount: 100,
      reason: "customer_request",
      requestedByType: "operator",
      requestedByRef: "user_123",
    })).rejects.toMatchObject({ name: "RefundsServiceError", code: "provider_unavailable", retryable: true } satisfies Partial<RefundsServiceError>);
  });

  test("creates refund and supports idempotent replay", async () => {
    const uow = createMemoryUnitOfWork({ merchant: createMerchant(), payment: createPayment() });
    let providerCalls = 0;
    const adapter: PaymentsProviderAdapter = {
      key: "finix",
      supportedCapabilities: ["refunds"],
      async verifyWebhookSignature() { throw new Error("not used"); },
      async createMerchantOnboarding() { throw new Error("not used"); },
      async createPaymentIntent() { throw new Error("not used"); },
      async createRefund() {
        providerCalls += 1;
        return {
          ok: true,
          value: {
            refundRef: {
              provider: "finix",
              objectType: "transfer",
              objectId: "rf_123",
              relationship: "refund",
              recordedAt: "2026-04-23T12:01:00.000Z",
            },
            status: "succeeded",
          },
        };
      },
      async fetchObjectSnapshot() { throw new Error("not used"); },
    };

    const service = createRefundsService({
      uow,
      providers: createRegistry(adapter),
      resolveProviderContext: () => providerContext,
      now: () => "2026-04-23T12:05:00.000Z",
      createId: (prefix) => `${prefix}_fixed`,
    });

    const snapshot = await service.createRefund({
      environment: "sandbox",
      merchantAccountId: "merchant_123",
      paymentId: "payment_123",
      amount: 100,
      reason: "customer_request",
      requestedByType: "operator",
      requestedByRef: "user_123",
      idempotencyKey: "idem_123",
    });

    expect(snapshot).toEqual({
      id: "refund_fixed",
      merchantAccountId: "merchant_123",
      paymentId: "payment_123",
      amount: 100,
      currency: "USD",
      status: "succeeded",
      reason: "customer_request",
    });

    const stored = await uow.refunds.getById("refund_fixed", { environment: "sandbox" });
    expect(stored).toMatchObject({
      merchantAccountId: "merchant_123",
      paymentId: "payment_123",
      amount: 100,
      currency: "USD",
      status: "succeeded",
      reason: "customer_request",
      requestedByType: "operator",
      requestedByRef: "user_123",
      processorRefundRefs: [
        {
          provider: "finix",
          objectType: "transfer",
          objectId: "rf_123",
          relationship: "refund",
          recordedAt: "2026-04-23T12:01:00.000Z",
        },
      ],
    });
    expect(await uow.events.getCanonicalEventById("refund_fixed:refund.created:2026-04-23T12:05:00.000Z", {
      environment: "sandbox",
    })).toMatchObject({
      eventType: "refund.created",
      aggregateId: "refund_fixed",
      payload: {
        merchantAccountId: "merchant_123",
        paymentId: "payment_123",
        refundId: "refund_fixed",
        refundStatus: "succeeded",
      },
    });

    const replay = await service.createRefund({
      environment: "sandbox",
      merchantAccountId: "merchant_123",
      paymentId: "payment_123",
      amount: 100,
      reason: "customer_request",
      requestedByType: "operator",
      requestedByRef: "user_123",
      idempotencyKey: "idem_123",
    });

    expect(replay).toEqual(snapshot);
    expect(providerCalls).toBe(1);
  });

  test("preserves card-present terminal lineage on refund snapshot and canonical event", async () => {
    const uow = createMemoryUnitOfWork({
      merchant: createMerchant(),
      payment: createPayment({
        terminalSessionId: "tcs_terminal_123",
        terminalReaderId: "tr_terminal_123",
        cardPresentPaymentIntentId: "cpi_terminal_123",
      }),
    });
    const service = createRefundsService({
      uow,
      providers: createRegistry({
        key: "finix",
        supportedCapabilities: ["refunds"],
        async verifyWebhookSignature() { throw new Error("not used"); },
        async createMerchantOnboarding() { throw new Error("not used"); },
        async createPaymentIntent() { throw new Error("not used"); },
        async createRefund() {
          return {
            ok: true,
            value: {
              refundRef: {
                provider: "finix",
                objectType: "transfer",
                objectId: "rf_terminal_123",
                relationship: "refund",
                recordedAt: "2026-04-23T12:01:00.000Z",
              },
              status: "succeeded",
            },
          };
        },
        async fetchObjectSnapshot() { throw new Error("not used"); },
      }),
      resolveProviderContext: () => providerContext,
      now: () => "2026-04-23T12:05:00.000Z",
      createId: (prefix) => `${prefix}_terminal`,
    });

    const snapshot = await service.createRefund({
      environment: "sandbox",
      merchantAccountId: "merchant_123",
      paymentId: "payment_123",
      amount: 100,
      reason: "customer_request",
      requestedByType: "operator",
      requestedByRef: "user_123",
    });

    expect(snapshot).toMatchObject({
      id: "refund_terminal",
      paymentId: "payment_123",
      terminalSessionId: "tcs_terminal_123",
      terminalReaderId: "tr_terminal_123",
    });
    expect(snapshot).not.toHaveProperty("processorRefundRefs");
    const stored = await uow.refunds.getById("refund_terminal", { environment: "sandbox" });
    expect(stored).toMatchObject({
      terminalSessionId: "tcs_terminal_123",
      terminalReaderId: "tr_terminal_123",
      processorRefundRefs: [expect.objectContaining({ provider: "finix", objectId: "rf_terminal_123" })],
    });
    expect(await uow.events.getCanonicalEventById("refund_terminal:refund.created:2026-04-23T12:05:00.000Z", {
      environment: "sandbox",
    })).toMatchObject({
      eventType: "refund.created",
      payload: {
        paymentId: "payment_123",
        refundId: "refund_terminal",
        terminalSessionId: "tcs_terminal_123",
        terminalReaderId: "tr_terminal_123",
      },
    });
  });

  test("rejects refund when existing pending and succeeded refunds exhaust refundable amount", async () => {
    const service = createRefundsService({
      uow: createMemoryUnitOfWork({
        merchant: createMerchant(),
        payment: createPayment({ amount: 500 }),
        refund: {
          id: "refund_existing_pending",
          environment: "sandbox",
          merchantAccountId: "merchant_123",
          paymentId: "payment_123",
          amount: 300,
          currency: "USD",
          status: "pending",
          reason: "customer_request",
          requestedByType: "operator",
          requestedByRef: "user_123",
          processorRefundRefs: [],
          createdAt: "2026-04-23T00:00:00.000Z",
          updatedAt: "2026-04-23T00:00:00.000Z",
        },
      }),
      providers: createRegistry({
        key: "finix",
        supportedCapabilities: ["refunds"],
        async verifyWebhookSignature() { throw new Error("not used"); },
        async createMerchantOnboarding() { throw new Error("not used"); },
        async createPaymentIntent() { throw new Error("not used"); },
        async createRefund() { throw new Error("not used"); },
        async fetchObjectSnapshot() { throw new Error("not used"); },
      }),
      resolveProviderContext: () => providerContext,
    });

    await expect(service.createRefund({
      environment: "sandbox",
      merchantAccountId: "merchant_123",
      paymentId: "payment_123",
      amount: 250,
      reason: "customer_request",
      requestedByType: "operator",
      requestedByRef: "user_123",
    })).rejects.toMatchObject({
      name: "RefundsServiceError",
      code: "conflict",
    } satisfies Partial<RefundsServiceError>);
  });

  test("marks payment refunded_full when refund succeeds for full amount", async () => {
    const uow = createMemoryUnitOfWork({ merchant: createMerchant(), payment: createPayment({ amount: 500 }) });
    const service = createRefundsService({
      uow,
      providers: createRegistry({
        key: "finix",
        supportedCapabilities: ["refunds"],
        async verifyWebhookSignature() { throw new Error("not used"); },
        async createMerchantOnboarding() { throw new Error("not used"); },
        async createPaymentIntent() { throw new Error("not used"); },
        async createRefund() {
          return {
            ok: true,
            value: {
              refundRef: {
                provider: "finix",
                objectType: "transfer",
                objectId: "rf_full_123",
                relationship: "refund",
                recordedAt: "2026-04-23T12:01:00.000Z",
              },
              status: "succeeded",
            },
          };
        },
        async fetchObjectSnapshot() { throw new Error("not used"); },
      }),
      resolveProviderContext: () => providerContext,
      now: () => "2026-04-23T12:05:00.000Z",
      createId: (prefix) => `${prefix}_full`,
    });

    await service.createRefund({
      environment: "sandbox",
      merchantAccountId: "merchant_123",
      paymentId: "payment_123",
      amount: 500,
      reason: "customer_request",
      requestedByType: "operator",
      requestedByRef: "user_123",
    });

    const payment = await uow.payments.getById("payment_123", { environment: "sandbox" });
    expect(payment).toMatchObject({ status: "refunded_full" });
  });

  test("returns stored refund snapshot", async () => {
    const service = createRefundsService({
      uow: createMemoryUnitOfWork({
        merchant: createMerchant(),
        payment: createPayment(),
        refund: {
          id: "refund_123",
          environment: "sandbox",
          merchantAccountId: "merchant_123",
          paymentId: "payment_123",
          amount: 100,
          currency: "USD",
          status: "pending",
          reason: "customer_request",
          requestedByType: "operator",
          requestedByRef: "user_123",
          processorRefundRefs: [],
          createdAt: "2026-04-23T12:00:00.000Z",
          updatedAt: "2026-04-23T12:00:00.000Z",
        },
      }),
      providers: createRegistry({
        key: "finix",
        supportedCapabilities: ["refunds"],
        async verifyWebhookSignature() { throw new Error("not used"); },
        async createMerchantOnboarding() { throw new Error("not used"); },
        async createPaymentIntent() { throw new Error("not used"); },
        async createRefund() { throw new Error("not used"); },
        async fetchObjectSnapshot() { throw new Error("not used"); },
      }),
      resolveProviderContext: () => providerContext,
    });

    const snapshot = await service.getRefund({
      environment: "sandbox",
      refundId: "refund_123",
    });

    expect(snapshot).toEqual({
      id: "refund_123",
      merchantAccountId: "merchant_123",
      paymentId: "payment_123",
      amount: 100,
      currency: "USD",
      status: "pending",
      reason: "customer_request",
    });
  });
});
