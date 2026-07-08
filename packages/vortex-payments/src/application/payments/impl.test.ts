import { describe, expect, test } from "vitest";
import type { MerchantAccount } from "../../domain/merchant";
import type { PaymentMethod } from "../../domain/payment-methods";
import type { Payment, PaymentIntent } from "../../domain/payments";
import type { CustomerPaymentState, MerchantAccountState } from "../../domain/state";
import type { CanonicalDomainEvent } from "../../events/types";
import type { ProviderRegistry } from "../../providers/registry";
import type { PaymentsProviderAdapter, ProviderContext } from "../../providers/types";
import type { IdempotencyRecord } from "../../storage/repositories";
import type { PaymentsUnitOfWork } from "../../storage/unit-of-work";
import { createPaymentsService, type PaymentsServiceError } from "./impl";

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

function createPaymentMethod(overrides: Partial<PaymentMethod> = {}): PaymentMethod {
  return {
    id: "pm_123",
    environment: "sandbox",
    merchantAccountId: "merchant_123",
    ownerType: "customer",
    ownerId: "customer_123",
    methodType: "card",
    status: "active",
    isDefault: true,
    processorInstrumentRefs: [
      {
        provider: "finix",
        objectType: "payment_instrument",
        objectId: "pi_123",
        relationship: "payment_method",
        recordedAt: "2026-04-23T12:00:00.000Z",
      },
    ],
    createdAt: "2026-04-23T00:00:00.000Z",
    updatedAt: "2026-04-23T00:00:00.000Z",
    ...overrides,
  };
}

function createMemoryUnitOfWork(seed?: {
  merchant?: MerchantAccount;
  paymentIntent?: PaymentIntent;
}): PaymentsUnitOfWork {
  const merchants = new Map<string, MerchantAccount>();
  const paymentIntents = new Map<string, PaymentIntent>();
  const payments = new Map<string, Payment>();
  const merchantStates = new Map<string, MerchantAccountState>();
  const customerStates = new Map<string, CustomerPaymentState>();
  const paymentMethodsStore = new Map<string, PaymentMethod>();
  const canonicalEvents = new Map<string, CanonicalDomainEvent>();
  const idempotency = new Map<string, IdempotencyRecord>();

  if (seed?.merchant) {
    merchants.set(`${seed.merchant.environment}:${seed.merchant.id}`, seed.merchant);
  }
  if (seed?.paymentIntent) {
    paymentIntents.set(
      `${seed.paymentIntent.environment}:${seed.paymentIntent.id}`,
      seed.paymentIntent,
    );
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
        return (
          Array.from(merchants.values()).find(
            (merchant) =>
              merchant.environment === environment &&
              merchant.processorAccountRefs.some(
                (ref) =>
                  ref.provider === provider &&
                  ref.objectType === objectType &&
                  ref.objectId === objectId,
              ),
          ) ?? null
        );
      },
      async save(record) {
        merchants.set(`${record.environment}:${record.id}`, record);
      },
    },
    customers: {
      async getById() {
        return null;
      },
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
        return (
          customerStates.get(`${environment}:${merchantAccountId}:${customerProfileId}`) ?? null
        );
      },
      async save(record) {
        customerStates.set(
          `${record.environment}:${record.merchantAccountId}:${record.customerProfileId}`,
          record,
        );
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
        return Array.from(paymentMethodsStore.values()).filter(
          (record) =>
            record.environment === environment &&
            record.ownerType === ownerType &&
            record.ownerId === ownerId,
        );
      },
      async save(record) {
        paymentMethodsStore.set(`${record.environment}:${record.id}`, record);
      },
    },
    paymentMethodSetupSessions: {
      async getById() {
        return null;
      },
      async save() {},
    },
    paymentIntents: {
      async getById(id, options) {
        return paymentIntents.get(`${options.environment}:${id}`) ?? null;
      },
      async getByProcessorRef(environment, provider, objectType, objectId) {
        return (
          Array.from(paymentIntents.values()).find(
            (record) =>
              record.environment === environment &&
              record.processorIntentRefs.some(
                (ref) =>
                  ref.provider === provider &&
                  ref.objectType === objectType &&
                  ref.objectId === objectId,
              ),
          ) ?? null
        );
      },
      async listByMerchant(environment, merchantAccountId) {
        return Array.from(paymentIntents.values()).filter(
          (record) =>
            record.environment === environment && record.merchantAccountId === merchantAccountId,
        );
      },
      async listByCustomerProfile(environment, merchantAccountId, customerProfileId) {
        return Array.from(paymentIntents.values()).filter(
          (record) =>
            record.environment === environment &&
            record.merchantAccountId === merchantAccountId &&
            record.customerProfileId === customerProfileId,
        );
      },
      async save(record) {
        paymentIntents.set(`${record.environment}:${record.id}`, record);
      },
    },
    payments: {
      async getById(id, options) {
        return payments.get(`${options.environment}:${id}`) ?? null;
      },
      async getByPaymentIntentId(environment, paymentIntentId) {
        return (
          Array.from(payments.values()).find(
            (record) =>
              record.environment === environment && record.paymentIntentId === paymentIntentId,
          ) ?? null
        );
      },
      async save(record) {
        payments.set(`${record.environment}:${record.id}`, record);
      },
    },
    refunds: {
      async getById() {
        return null;
      },
      async getByProcessorRef() {
        return null;
      },
      async listByPayment() {
        return [];
      },
      async save() {},
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

describe("createPaymentsService", () => {
  test("throws not_found when merchant does not exist", async () => {
    const adapter: PaymentsProviderAdapter = {
      key: "finix",
      supportedCapabilities: ["payments"],
      async verifyWebhookSignature() {
        throw new Error("not used");
      },
      async createMerchantOnboarding() {
        throw new Error("not used");
      },
      async createPaymentIntent() {
        throw new Error("not used");
      },
      async createRefund() {
        throw new Error("not used");
      },
      async fetchObjectSnapshot() {
        throw new Error("not used");
      },
    };

    const service = createPaymentsService({
      uow: createMemoryUnitOfWork(),
      providers: createRegistry(adapter),
      listPaymentMethods: async () => [createPaymentMethod()],
      resolveProviderContext: () => providerContext,
    });

    await expect(
      service.createPaymentIntent({
        environment: "sandbox",
        merchantAccountId: "missing_merchant",
        customerProfileId: "customer_123",
        amount: 500,
        currency: "USD",
        captureMode: "automatic",
      }),
    ).rejects.toMatchObject({
      name: "PaymentsServiceError",
      code: "not_found",
    } satisfies Partial<PaymentsServiceError>);
  });

  test("maps provider failure into service error", async () => {
    const adapter: PaymentsProviderAdapter = {
      key: "finix",
      supportedCapabilities: ["payments"],
      async verifyWebhookSignature() {
        throw new Error("not used");
      },
      async createMerchantOnboarding() {
        throw new Error("not used");
      },
      async createPaymentIntent() {
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
      async createRefund() {
        throw new Error("not used");
      },
      async fetchObjectSnapshot() {
        throw new Error("not used");
      },
    };

    const service = createPaymentsService({
      uow: createMemoryUnitOfWork({ merchant: createMerchant() }),
      providers: createRegistry(adapter),
      listPaymentMethods: async () => [createPaymentMethod()],
      resolveProviderContext: () => providerContext,
    });

    await expect(
      service.createPaymentIntent({
        environment: "sandbox",
        merchantAccountId: "merchant_123",
        customerProfileId: "customer_123",
        amount: 500,
        currency: "USD",
        captureMode: "automatic",
      }),
    ).rejects.toMatchObject({
      name: "PaymentsServiceError",
      code: "provider_unavailable",
      retryable: true,
    } satisfies Partial<PaymentsServiceError>);
  });

  test("persists failed payment intent and payment for provider-declared terminal decline", async () => {
    const uow = createMemoryUnitOfWork({ merchant: createMerchant() });
    const adapter: PaymentsProviderAdapter = {
      key: "finix",
      supportedCapabilities: ["payments"],
      async verifyWebhookSignature() {
        throw new Error("not used");
      },
      async createMerchantOnboarding() {
        throw new Error("not used");
      },
      async createPaymentIntent() {
        return {
          ok: false,
          error: {
            provider: "finix",
            category: "invalid_request",
            code: "DECLINED",
            message: "Authorization AU_declined_123 was declined.",
            retryable: false,
            rawRef: "AU_declined_123",
          },
        };
      },
      async createRefund() {
        throw new Error("not used");
      },
      async fetchObjectSnapshot() {
        throw new Error("not used");
      },
    };

    const service = createPaymentsService({
      uow,
      providers: createRegistry(adapter),
      listPaymentMethods: async () => [createPaymentMethod()],
      resolveProviderContext: () => providerContext,
      now: () => "2026-04-23T12:05:00.000Z",
      createId: (prefix) => `${prefix}_failed`,
    });

    const snapshot = await service.createPaymentIntent({
      environment: "sandbox",
      merchantAccountId: "merchant_123",
      customerProfileId: "customer_123",
      amount: 500,
      currency: "USD",
      captureMode: "automatic",
      idempotencyKey: "idem_failed_123",
      metadata: { invoiceId: "inv_failed_123" },
    });

    expect(snapshot).toEqual({
      id: "pi_failed",
      paymentId: "pay_failed",
      merchantAccountId: "merchant_123",
      customerProfileId: "customer_123",
      paymentMethodId: "pm_123",
      status: "failed",
      amount: 500,
      currency: "USD",
      requiresAction: false,
      canCapture: false,
      canCancel: false,
      canRetry: true,
      nextStep: "retry",
      nextActionType: undefined,
      hostedActionUrl: undefined,
    });

    const storedIntent = await uow.paymentIntents.getById("pi_failed", { environment: "sandbox" });
    expect(storedIntent).toMatchObject({
      status: "failed",
      processorIntentRefs: [
        {
          provider: "finix",
          objectType: "authorization",
          objectId: "AU_declined_123",
          relationship: "payment_intent",
          recordedAt: "2026-04-23T12:05:00.000Z",
        },
      ],
    });

    const storedPayment = await uow.payments.getById("pay_failed", { environment: "sandbox" });
    expect(storedPayment).toMatchObject({
      status: "failed",
      failureCode: "DECLINED",
      failureMessage: "Authorization AU_declined_123 was declined.",
      processorPaymentRefs: [
        {
          provider: "finix",
          objectType: "authorization",
          objectId: "AU_declined_123",
          relationship: "payment",
          recordedAt: "2026-04-23T12:05:00.000Z",
        },
      ],
    });
    expect(
      await uow.events.getCanonicalEventById("pay_failed:payment.failed:2026-04-23T12:05:00.000Z", {
        environment: "sandbox",
      }),
    ).toMatchObject({
      eventType: "payment.failed",
      aggregateId: "pay_failed",
      payload: {
        merchantAccountId: "merchant_123",
        paymentIntentId: "pi_failed",
        paymentId: "pay_failed",
      },
    });

    const replay = await service.createPaymentIntent({
      environment: "sandbox",
      merchantAccountId: "merchant_123",
      customerProfileId: "customer_123",
      amount: 500,
      currency: "USD",
      captureMode: "automatic",
      idempotencyKey: "idem_failed_123",
      metadata: { invoiceId: "inv_failed_123" },
    });
    expect(replay).toEqual(snapshot);
  });

  test("creates payment intent and supports idempotent replay", async () => {
    const uow = createMemoryUnitOfWork({ merchant: createMerchant() });
    let providerCalls = 0;
    const adapter: PaymentsProviderAdapter = {
      key: "finix",
      supportedCapabilities: ["payments"],
      async verifyWebhookSignature() {
        throw new Error("not used");
      },
      async createMerchantOnboarding() {
        throw new Error("not used");
      },
      async createPaymentIntent() {
        providerCalls += 1;
        return {
          ok: true,
          value: {
            intentRef: {
              provider: "finix",
              objectType: "transfer",
              objectId: "tr_123",
              relationship: "payment_intent",
              recordedAt: "2026-04-23T12:01:00.000Z",
            },
            status: "captured",
            nextActionType: "none",
            clientTokenRef: "https://pay.vortex.test/action",
          },
        };
      },
      async createRefund() {
        throw new Error("not used");
      },
      async fetchObjectSnapshot() {
        throw new Error("not used");
      },
    };

    const service = createPaymentsService({
      uow,
      providers: createRegistry(adapter),
      listPaymentMethods: async () => [createPaymentMethod()],
      resolveProviderContext: () => providerContext,
      now: () => "2026-04-23T12:05:00.000Z",
      createId: (prefix) => `${prefix}_fixed`,
    });

    const snapshot = await service.createPaymentIntent({
      environment: "sandbox",
      merchantAccountId: "merchant_123",
      customerProfileId: "customer_123",
      amount: 500,
      currency: "USD",
      captureMode: "automatic",
      idempotencyKey: "idem_123",
      metadata: { invoiceId: "inv_123" },
    });

    expect(snapshot).toEqual({
      id: "pi_fixed",
      paymentId: "pay_fixed",
      merchantAccountId: "merchant_123",
      customerProfileId: "customer_123",
      paymentMethodId: "pm_123",
      status: "captured",
      amount: 500,
      currency: "USD",
      requiresAction: false,
      canCapture: false,
      canCancel: false,
      canRetry: false,
      nextStep: "none",
      nextActionType: "none",
      hostedActionUrl: "https://pay.vortex.test/action",
    });

    const stored = await uow.paymentIntents.getById("pi_fixed", { environment: "sandbox" });
    expect(stored).toMatchObject({
      customerProfileId: "customer_123",
      captureMode: "automatic",
      status: "captured",
      processorIntentRefs: [
        {
          provider: "finix",
          objectType: "transfer",
          objectId: "tr_123",
          relationship: "payment_intent",
          recordedAt: "2026-04-23T12:01:00.000Z",
        },
      ],
      metadata: {
        invoiceId: "inv_123",
        selectedPaymentMethodId: "pm_123",
      },
    });

    const customerState = await uow.customerStates.getByMerchantAndCustomer(
      "sandbox",
      "merchant_123",
      "customer_123",
    );
    expect(customerState).toMatchObject({
      defaultPaymentMethodId: "pm_123",
      activePaymentMethodIds: ["pm_123"],
      latestPaymentIntentStatus: "captured",
      readiness: "ready",
    });
    expect(
      await uow.events.getCanonicalEventById("pay_fixed:payment.created:2026-04-23T12:05:00.000Z", {
        environment: "sandbox",
      }),
    ).toMatchObject({
      eventType: "payment.created",
      aggregateId: "pay_fixed",
      payload: {
        merchantAccountId: "merchant_123",
        paymentIntentId: "pi_fixed",
        paymentId: "pay_fixed",
        paymentStatus: "captured",
      },
    });

    const replay = await service.createPaymentIntent({
      environment: "sandbox",
      merchantAccountId: "merchant_123",
      customerProfileId: "customer_123",
      amount: 500,
      currency: "USD",
      captureMode: "automatic",
      idempotencyKey: "idem_123",
      metadata: { invoiceId: "inv_123" },
    });

    expect(replay).toEqual(snapshot);
    expect(providerCalls).toBe(1);
  });

  test("lists payment intents within merchant scope", async () => {
    const service = createPaymentsService({
      uow: createMemoryUnitOfWork({
        merchant: createMerchant(),
        paymentIntent: {
          id: "pi_123",
          environment: "sandbox",
          merchantAccountId: "merchant_123",
          customerProfileId: "customer_123",
          externalPaymentRef: "order_123",
          amount: 500,
          currency: "USD",
          captureMode: "manual",
          status: "authorized",
          metadata: { selectedPaymentMethodId: "pm_123" },
          processorIntentRefs: [],
          createdAt: "2026-04-23T12:00:00.000Z",
          updatedAt: "2026-04-23T12:01:00.000Z",
        },
      }),
      providers: createRegistry({
        key: "finix",
        supportedCapabilities: ["payments"],
        async verifyWebhookSignature() {
          throw new Error("not used");
        },
        async createMerchantOnboarding() {
          throw new Error("not used");
        },
        async createPaymentIntent() {
          throw new Error("not used");
        },
        async createRefund() {
          throw new Error("not used");
        },
        async fetchObjectSnapshot() {
          throw new Error("not used");
        },
      }),
      listPaymentMethods: async () => [createPaymentMethod()],
      resolveProviderContext: () => providerContext,
    });

    const snapshots = await service.listPaymentIntents({
      environment: "sandbox",
      merchantAccountId: "merchant_123",
      customerProfileId: "customer_123",
      status: "authorized",
    });

    expect(snapshots).toEqual([
      {
        id: "pi_123",
        merchantAccountId: "merchant_123",
        customerProfileId: "customer_123",
        paymentId: undefined,
        paymentMethodId: "pm_123",
        status: "authorized",
        amount: 500,
        currency: "USD",
        requiresAction: false,
        canCapture: true,
        canCancel: true,
        canRetry: false,
        nextStep: "capture",
        nextActionType: undefined,
        hostedActionUrl: undefined,
      },
    ]);
  });

  test("captures manual authorization payment intent", async () => {
    const uow = createMemoryUnitOfWork({
      merchant: createMerchant(),
      paymentIntent: {
        id: "pi_123",
        environment: "sandbox",
        merchantAccountId: "merchant_123",
        customerProfileId: "customer_123",
        amount: 500,
        currency: "USD",
        captureMode: "manual",
        status: "authorized",
        metadata: { selectedPaymentMethodId: "pm_123" },
        processorIntentRefs: [
          {
            provider: "finix",
            objectType: "authorization",
            objectId: "auth_123",
            relationship: "payment_intent",
            recordedAt: "2026-04-23T12:00:00.000Z",
          },
        ],
        createdAt: "2026-04-23T12:00:00.000Z",
        updatedAt: "2026-04-23T12:00:00.000Z",
      },
    });
    await uow.payments.save({
      id: "pay_123",
      environment: "sandbox",
      merchantAccountId: "merchant_123",
      paymentIntentId: "pi_123",
      customerProfileId: "customer_123",
      paymentMethodId: "pm_123",
      amount: 500,
      currency: "USD",
      status: "authorized",
      direction: "debit",
      authorizedAt: "2026-04-23T12:00:00.000Z",
      processorPaymentRefs: [
        {
          provider: "finix",
          objectType: "authorization",
          objectId: "auth_123",
          relationship: "payment",
          recordedAt: "2026-04-23T12:00:00.000Z",
        },
      ],
      createdAt: "2026-04-23T12:00:00.000Z",
      updatedAt: "2026-04-23T12:00:00.000Z",
    });

    const service = createPaymentsService({
      uow,
      providers: createRegistry({
        key: "finix",
        supportedCapabilities: ["payments"],
        async verifyWebhookSignature() {
          throw new Error("not used");
        },
        async createMerchantOnboarding() {
          throw new Error("not used");
        },
        async createPaymentIntent() {
          throw new Error("not used");
        },
        async capturePaymentIntent() {
          return {
            ok: true,
            value: {
              intentRef: {
                provider: "finix",
                objectType: "authorization",
                objectId: "auth_123",
                relationship: "payment_intent",
                recordedAt: "2026-04-23T12:05:00.000Z",
              },
              paymentRef: {
                provider: "finix",
                objectType: "transfer",
                objectId: "tr_123",
                relationship: "payment",
                recordedAt: "2026-04-23T12:05:00.000Z",
              },
              status: "captured",
              recordedAt: "2026-04-23T12:05:00.000Z",
            },
          };
        },
        async createRefund() {
          throw new Error("not used");
        },
        async fetchObjectSnapshot() {
          throw new Error("not used");
        },
      }),
      listPaymentMethods: async () => [createPaymentMethod()],
      resolveProviderContext: () => providerContext,
    });

    const snapshot = await service.capturePaymentIntent({
      environment: "sandbox",
      merchantAccountId: "merchant_123",
      paymentIntentId: "pi_123",
    });

    expect(snapshot).toEqual({
      id: "pi_123",
      paymentId: "pay_123",
      merchantAccountId: "merchant_123",
      customerProfileId: "customer_123",
      paymentMethodId: "pm_123",
      status: "captured",
      amount: 500,
      currency: "USD",
      requiresAction: false,
      canCapture: false,
      canCancel: false,
      canRetry: false,
      nextStep: "none",
      nextActionType: undefined,
      hostedActionUrl: undefined,
    });
    expect(
      await uow.events.getCanonicalEventById("pay_123:payment.captured:2026-04-23T12:05:00.000Z", {
        environment: "sandbox",
      }),
    ).toMatchObject({
      eventType: "payment.captured",
      aggregateId: "pay_123",
      payload: {
        merchantAccountId: "merchant_123",
        paymentIntentId: "pi_123",
        paymentId: "pay_123",
      },
    });
  });

  test("cancels manual authorization payment intent", async () => {
    const uow = createMemoryUnitOfWork({
      merchant: createMerchant(),
      paymentIntent: {
        id: "pi_123",
        environment: "sandbox",
        merchantAccountId: "merchant_123",
        customerProfileId: "customer_123",
        amount: 500,
        currency: "USD",
        captureMode: "manual",
        status: "authorized",
        metadata: { selectedPaymentMethodId: "pm_123" },
        processorIntentRefs: [
          {
            provider: "finix",
            objectType: "authorization",
            objectId: "auth_123",
            relationship: "payment_intent",
            recordedAt: "2026-04-23T12:00:00.000Z",
          },
        ],
        createdAt: "2026-04-23T12:00:00.000Z",
        updatedAt: "2026-04-23T12:00:00.000Z",
      },
    });
    await uow.payments.save({
      id: "pay_123",
      environment: "sandbox",
      merchantAccountId: "merchant_123",
      paymentIntentId: "pi_123",
      customerProfileId: "customer_123",
      paymentMethodId: "pm_123",
      amount: 500,
      currency: "USD",
      status: "authorized",
      direction: "debit",
      authorizedAt: "2026-04-23T12:00:00.000Z",
      processorPaymentRefs: [
        {
          provider: "finix",
          objectType: "authorization",
          objectId: "auth_123",
          relationship: "payment",
          recordedAt: "2026-04-23T12:00:00.000Z",
        },
      ],
      createdAt: "2026-04-23T12:00:00.000Z",
      updatedAt: "2026-04-23T12:00:00.000Z",
    });

    const service = createPaymentsService({
      uow,
      providers: createRegistry({
        key: "finix",
        supportedCapabilities: ["payments"],
        async verifyWebhookSignature() {
          throw new Error("not used");
        },
        async createMerchantOnboarding() {
          throw new Error("not used");
        },
        async createPaymentIntent() {
          throw new Error("not used");
        },
        async cancelPaymentIntent() {
          return {
            ok: true,
            value: {
              intentRef: {
                provider: "finix",
                objectType: "authorization",
                objectId: "auth_123",
                relationship: "payment_intent",
                recordedAt: "2026-04-23T12:05:00.000Z",
              },
              status: "canceled",
              recordedAt: "2026-04-23T12:05:00.000Z",
            },
          };
        },
        async createRefund() {
          throw new Error("not used");
        },
        async fetchObjectSnapshot() {
          throw new Error("not used");
        },
      }),
      listPaymentMethods: async () => [createPaymentMethod()],
      resolveProviderContext: () => providerContext,
    });

    const snapshot = await service.cancelPaymentIntent({
      environment: "sandbox",
      merchantAccountId: "merchant_123",
      paymentIntentId: "pi_123",
    });

    expect(snapshot).toEqual({
      id: "pi_123",
      paymentId: "pay_123",
      merchantAccountId: "merchant_123",
      customerProfileId: "customer_123",
      paymentMethodId: "pm_123",
      status: "canceled",
      amount: 500,
      currency: "USD",
      requiresAction: false,
      canCapture: false,
      canCancel: false,
      canRetry: true,
      nextStep: "retry",
      nextActionType: undefined,
      hostedActionUrl: undefined,
    });
    expect(
      await uow.events.getCanonicalEventById("pay_123:payment.canceled:2026-04-23T12:05:00.000Z", {
        environment: "sandbox",
      }),
    ).toMatchObject({
      eventType: "payment.canceled",
      aggregateId: "pay_123",
      payload: {
        merchantAccountId: "merchant_123",
        paymentIntentId: "pi_123",
        paymentId: "pay_123",
      },
    });
  });

  test("retries failed payment intent with original payment method", async () => {
    const uow = createMemoryUnitOfWork({
      merchant: createMerchant(),
      paymentIntent: {
        id: "pi_failed_source",
        environment: "sandbox",
        merchantAccountId: "merchant_123",
        customerProfileId: "customer_123",
        externalPaymentRef: "order_123",
        amount: 500,
        currency: "USD",
        captureMode: "automatic",
        status: "failed",
        returnUrl: "https://example.com/return",
        fraudSessionId: "fraud_123",
        metadata: {
          invoiceId: "inv_123",
          selectedPaymentMethodId: "pm_123",
        },
        processorIntentRefs: [
          {
            provider: "finix",
            objectType: "authorization",
            objectId: "auth_failed_123",
            relationship: "payment_intent",
            recordedAt: "2026-04-23T12:00:00.000Z",
          },
        ],
        createdAt: "2026-04-23T12:00:00.000Z",
        updatedAt: "2026-04-23T12:00:00.000Z",
      },
    });
    await uow.payments.save({
      id: "pay_failed_source",
      environment: "sandbox",
      merchantAccountId: "merchant_123",
      paymentIntentId: "pi_failed_source",
      customerProfileId: "customer_123",
      paymentMethodId: "pm_123",
      amount: 500,
      currency: "USD",
      status: "failed",
      direction: "debit",
      failureCode: "DECLINED",
      failureMessage: "declined",
      processorPaymentRefs: [
        {
          provider: "finix",
          objectType: "authorization",
          objectId: "auth_failed_123",
          relationship: "payment",
          recordedAt: "2026-04-23T12:00:00.000Z",
        },
      ],
      createdAt: "2026-04-23T12:00:00.000Z",
      updatedAt: "2026-04-23T12:00:00.000Z",
    });

    const service = createPaymentsService({
      uow,
      providers: createRegistry({
        key: "finix",
        supportedCapabilities: ["payments"],
        async verifyWebhookSignature() {
          throw new Error("not used");
        },
        async createMerchantOnboarding() {
          throw new Error("not used");
        },
        async createPaymentIntent() {
          return {
            ok: true,
            value: {
              intentRef: {
                provider: "finix",
                objectType: "transfer",
                objectId: "tr_retry_123",
                relationship: "payment_intent",
                recordedAt: "2026-04-23T12:10:00.000Z",
              },
              status: "captured",
              nextActionType: "none",
              clientTokenRef: "https://pay.vortex.test/retry",
            },
          };
        },
        async createRefund() {
          throw new Error("not used");
        },
        async fetchObjectSnapshot() {
          throw new Error("not used");
        },
      }),
      listPaymentMethods: async () => [createPaymentMethod()],
      resolveProviderContext: () => providerContext,
      now: () => "2026-04-23T12:10:00.000Z",
      createId: (prefix) => `${prefix}_retry`,
    });

    const snapshot = await service.retryPaymentIntent({
      environment: "sandbox",
      merchantAccountId: "merchant_123",
      paymentIntentId: "pi_failed_source",
      idempotencyKey: "idem_retry_123",
    });

    expect(snapshot).toEqual({
      id: "pi_retry",
      paymentId: "pay_retry",
      merchantAccountId: "merchant_123",
      customerProfileId: "customer_123",
      paymentMethodId: "pm_123",
      status: "captured",
      amount: 500,
      currency: "USD",
      requiresAction: false,
      canCapture: false,
      canCancel: false,
      canRetry: false,
      nextStep: "none",
      nextActionType: "none",
      hostedActionUrl: "https://pay.vortex.test/retry",
    });
    const retriedIntent = await uow.paymentIntents.getById("pi_retry", { environment: "sandbox" });
    expect(retriedIntent?.metadata).toMatchObject({
      invoiceId: "inv_123",
      selectedPaymentMethodId: "pm_123",
      retriedFromPaymentIntentId: "pi_failed_source",
    });
  });

  test("returns conflict when retrying non-retryable payment intent", async () => {
    const uow = createMemoryUnitOfWork({
      merchant: createMerchant(),
      paymentIntent: {
        id: "pi_not_retryable",
        environment: "sandbox",
        merchantAccountId: "merchant_123",
        amount: 500,
        currency: "USD",
        captureMode: "automatic",
        status: "requires_action",
        metadata: { selectedPaymentMethodId: "pm_123" },
        processorIntentRefs: [],
        createdAt: "2026-04-23T12:00:00.000Z",
        updatedAt: "2026-04-23T12:00:00.000Z",
      },
    });

    const service = createPaymentsService({
      uow,
      providers: createRegistry({
        key: "finix",
        supportedCapabilities: ["payments"],
        async verifyWebhookSignature() {
          throw new Error("not used");
        },
        async createMerchantOnboarding() {
          throw new Error("not used");
        },
        async createPaymentIntent() {
          throw new Error("not used");
        },
        async createRefund() {
          throw new Error("not used");
        },
        async fetchObjectSnapshot() {
          throw new Error("not used");
        },
      }),
      listPaymentMethods: async () => [createPaymentMethod()],
      resolveProviderContext: () => providerContext,
    });

    await expect(
      service.retryPaymentIntent({
        environment: "sandbox",
        merchantAccountId: "merchant_123",
        paymentIntentId: "pi_not_retryable",
      }),
    ).rejects.toMatchObject({
      code: "conflict",
      message: "payment intent is not retryable",
    });
  });

  test("returns stored payment intent snapshot", async () => {
    const uow = createMemoryUnitOfWork({
      merchant: createMerchant(),
      paymentIntent: {
        id: "pi_123",
        environment: "sandbox",
        merchantAccountId: "merchant_123",
        customerProfileId: "customer_123",
        amount: 500,
        currency: "USD",
        captureMode: "automatic",
        status: "requires_action",
        metadata: { selectedPaymentMethodId: "pm_123" },
        nextActionType: "redirect",
        hostedActionUrl: "https://pay.vortex.test/action-required",
        processorIntentRefs: [],
        createdAt: "2026-04-23T12:00:00.000Z",
        updatedAt: "2026-04-23T12:00:00.000Z",
      },
    });
    await uow.payments.save({
      id: "pay_123",
      environment: "sandbox",
      merchantAccountId: "merchant_123",
      paymentIntentId: "pi_123",
      customerProfileId: "customer_123",
      paymentMethodId: "pm_123",
      amount: 500,
      currency: "USD",
      status: "requires_action",
      direction: "debit",
      processorPaymentRefs: [],
      createdAt: "2026-04-23T12:00:00.000Z",
      updatedAt: "2026-04-23T12:00:00.000Z",
    });

    const service = createPaymentsService({
      uow,
      providers: createRegistry({
        key: "finix",
        supportedCapabilities: ["payments"],
        async verifyWebhookSignature() {
          throw new Error("not used");
        },
        async createMerchantOnboarding() {
          throw new Error("not used");
        },
        async createPaymentIntent() {
          throw new Error("not used");
        },
        async createRefund() {
          throw new Error("not used");
        },
        async fetchObjectSnapshot() {
          throw new Error("not used");
        },
      }),
      listPaymentMethods: async () => [createPaymentMethod()],
      resolveProviderContext: () => providerContext,
    });

    const snapshot = await service.getPaymentIntent({
      environment: "sandbox",
      paymentIntentId: "pi_123",
    });

    expect(snapshot).toEqual({
      id: "pi_123",
      paymentId: "pay_123",
      merchantAccountId: "merchant_123",
      customerProfileId: "customer_123",
      paymentMethodId: "pm_123",
      status: "requires_action",
      amount: 500,
      currency: "USD",
      requiresAction: true,
      canCapture: false,
      canCancel: false,
      canRetry: false,
      nextStep: "complete_required_action",
      nextActionType: "redirect",
      hostedActionUrl: "https://pay.vortex.test/action-required",
    });
  });
});
