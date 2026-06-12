import { describe, expect, test } from "vitest";
import type { MerchantAccount } from "../../domain/merchant";
import type { PaymentIntent } from "../../domain/payments";
import type { CustomerProfile, PaymentMethod, PaymentMethodSetupSession } from "../../domain/payment-methods";
import type { CanonicalDomainEvent } from "../../events/types";
import type { ProviderRegistry } from "../../providers/registry";
import type {
  ProviderContext,
  ProviderPaymentMethodInput,
  ProviderPaymentMethodOutput,
  ProviderResult,
} from "../../providers/types";
import type { PaymentsUnitOfWork } from "../../storage/unit-of-work";
import { createPaymentMethodSetupService, PaymentMethodSetupServiceError } from "./impl";

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
    metadata: {},
    createdAt: "2026-04-23T12:00:00.000Z",
    updatedAt: "2026-04-23T12:00:00.000Z",
    ...overrides,
  };
}

function createCustomerProfile(overrides: Partial<CustomerProfile> = {}): CustomerProfile {
  return {
    id: "customer_123",
    environment: "sandbox",
    merchantAccountId: "merchant_123",
    name: "Customer",
    processorCustomerRefs: [],
    createdAt: "2026-04-23T12:00:00.000Z",
    updatedAt: "2026-04-23T12:00:00.000Z",
    ...overrides,
  };
}

function createUnitOfWork(options?: {
  merchant?: MerchantAccount | null;
  customer?: CustomerProfile | null;
  setupSession?: PaymentMethodSetupSession | null;
  paymentMethods?: PaymentMethod[];
  paymentIntents?: PaymentIntent[];
  idempotencyRecord?: {
    readonly environment: "sandbox" | "production";
    readonly scope: string;
    readonly idempotencyKey: string;
    readonly requestHash: string;
    readonly responseRef: string;
  } | null;
}) {
  const savedSetupSessions: PaymentMethodSetupSession[] = [];
  const savedPaymentMethods: PaymentMethod[] = [];
  const savedCustomerStates: unknown[] = [];
  const savedCustomers: CustomerProfile[] = [];
  const savedCanonicalEvents: CanonicalDomainEvent[] = [];
  const savedIdempotency: unknown[] = [];
  let customer = options?.customer ?? createCustomerProfile();
  let setupSession = options?.setupSession ?? null;
  let paymentMethods = options?.paymentMethods ?? [];
  const uow: PaymentsUnitOfWork = {
    merchants: {
      async getById() { return options?.merchant ?? createMerchant(); },
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
      async save(record) { savedCustomerStates.push(record); },
    },
    paymentMethods: {
      async getById(id) { return paymentMethods.find((method) => method.id === id) ?? null; },
      async getByProcessorRef() { return null; },
      async listByOwner() { return paymentMethods; },
      async save(record) {
        savedPaymentMethods.push(record);
        paymentMethods = [...paymentMethods.filter((method) => method.id !== record.id), record];
      },
    },
    paymentMethodSetupSessions: {
      async getById() { return setupSession; },
      async save(record) {
        savedSetupSessions.push(record);
        setupSession = record;
      },
    },
    paymentIntents: {
      async getById() { return null; },
      async getByProcessorRef() { return null; },
      async listByMerchant() { return []; },
      async listByCustomerProfile() { return options?.paymentIntents ?? []; },
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
      async saveCanonicalEvent(record) { savedCanonicalEvents.push(record); },
      async getCanonicalEventById() { return null; },
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
      async getByScopeAndKey(environment, scope, idempotencyKey) {
        const record = options?.idempotencyRecord;
        if (
          record &&
          record.environment === environment &&
          record.scope === scope &&
          record.idempotencyKey === idempotencyKey
        ) {
          return {
            id: "idem_existing",
            environment,
            scope,
            idempotencyKey,
            requestHash: record.requestHash,
            responseRef: record.responseRef,
            createdAt: "2026-04-23T12:00:00.000Z",
          };
        }
        return null;
      },
      async save(record) { savedIdempotency.push(record); },
    },
    async runInTransaction(work) { return work(uow); },
  };

  return {
    uow,
    savedSetupSessions,
    savedPaymentMethods,
    savedCustomerStates,
    savedCustomers,
    savedCanonicalEvents,
    savedIdempotency,
  };
}

function createRegistry(options?: {
  onCreatePaymentMethodInput?: (input: ProviderPaymentMethodInput) => void;
  providerResult?: ProviderResult<ProviderPaymentMethodOutput>;
}): ProviderRegistry {
  const adapter = {
    key: "finix" as const,
    supportedCapabilities: ["payment_methods"] as const,
    async createPaymentMethod(_context: ProviderContext, input: ProviderPaymentMethodInput) {
      options?.onCreatePaymentMethodInput?.(input);
      return options?.providerResult ?? {
        ok: true as const,
        value: {
          paymentMethodRef: {
            provider: "finix",
            objectType: "payment_instrument",
            objectId: "PI_123",
            relationship: "payment_method",
            recordedAt: "2026-04-23T12:00:00.000Z",
          },
          ownerRef: {
            provider: "finix",
            objectType: "identity",
            objectId: "ID_123",
            relationship: "buyer",
            recordedAt: "2026-04-23T12:00:00.000Z",
          },
          status: "active",
          methodType: "card",
          brandSummary: "VISA",
          last4: "4242",
          expiryMonth: 1,
          expiryYear: 2030,
          fingerprint: "fp_123",
          recordedAt: "2026-04-23T12:00:00.000Z",
        },
      };
    },
    async verifyWebhookSignature() { throw new Error("unused"); },
    async createMerchantOnboarding() { throw new Error("unused"); },
    async createPaymentIntent() { throw new Error("unused"); },
    async createRefund() { throw new Error("unused"); },
    async fetchObjectSnapshot() { throw new Error("unused"); },
  };
  return {
    getAdapter() { return adapter; },
    listAdapters() { return [adapter]; },
  };
}

describe("createPaymentMethodSetupService", () => {
  test("creates payment method setup session", async () => {
    const { uow, savedSetupSessions } = createUnitOfWork();
    const service = createPaymentMethodSetupService({
      uow,
      providers: createRegistry(),
      resolveProviderContext: () => ({ provider: "finix", environment: "sandbox" }),
      now: () => "2026-04-23T12:00:00.000Z",
      createId: (prefix) => `${prefix}_123`,
    });

    const session = await service.createPaymentMethodSetupSession({
      environment: "sandbox",
      merchantAccountId: "merchant_123",
      ownerType: "customer",
      ownerId: "customer_123",
      methodType: "card",
      setAsDefault: true,
    });

    expect(session.id).toBe("pmset_123");
    expect(session.clientSecret).toBe("pmsec_123");
    expect(savedSetupSessions).toHaveLength(1);
  });

  test("creates canonical payment method from setup session", async () => {
    let createPaymentMethodInput: ProviderPaymentMethodInput | undefined;
    const existingOwnerRef = {
      provider: "finix",
      objectType: "identity",
      objectId: "ID_existing",
      relationship: "buyer",
      recordedAt: "2026-04-23T11:00:00.000Z",
    } as const;
    const {
      uow,
      savedSetupSessions,
      savedPaymentMethods,
      savedCustomerStates,
      savedCustomers,
      savedCanonicalEvents,
      savedIdempotency,
    } = createUnitOfWork({
      customer: createCustomerProfile({
        processorCustomerRefs: [existingOwnerRef],
      }),
      setupSession: {
        id: "pmset_123",
        environment: "sandbox",
        merchantAccountId: "merchant_123",
        ownerType: "customer",
        ownerId: "customer_123",
        methodType: "card",
        provider: "finix",
        clientSecret: "pmsec_123",
        status: "pending_tokenization",
        setAsDefault: true,
        expiresAt: "2026-04-23T12:30:00.000Z",
        createdAt: "2026-04-23T12:00:00.000Z",
        updatedAt: "2026-04-23T12:00:00.000Z",
      },
    });
    const service = createPaymentMethodSetupService({
      uow,
      providers: createRegistry({
        onCreatePaymentMethodInput(input: ProviderPaymentMethodInput) {
          createPaymentMethodInput = input;
        },
      }),
      resolveProviderContext: () => ({ provider: "finix", environment: "sandbox" }),
      now: () => "2026-04-23T12:00:00.000Z",
      createId: (prefix) => `${prefix}_123`,
    });

    const paymentMethod = await service.createPaymentMethodFromSetup({
      environment: "sandbox",
      paymentMethodSetupSessionId: "pmset_123",
      setupToken: "tok_123",
      idempotencyKey: "idem_123",
    });

    expect(paymentMethod).toEqual({
      id: "pm_123",
      merchantAccountId: "merchant_123",
      ownerType: "customer",
      ownerId: "customer_123",
      methodType: "card",
      status: "active",
      isDefault: true,
      brandSummary: "VISA",
      last4: "4242",
      expiryMonth: 1,
      expiryYear: 2030,
    });
    expect(savedPaymentMethods).toHaveLength(1);
    expect(savedCustomerStates).toHaveLength(1);
    expect(savedCustomers).toHaveLength(1);
    expect(savedIdempotency).toHaveLength(1);
    expect(createPaymentMethodInput?.ownerRef).toEqual(existingOwnerRef);
    expect(savedSetupSessions.map((session) => session.status)).toEqual(["consuming", "consumed"]);
    expect(savedSetupSessions.at(-1)?.attachedPaymentMethodId).toBe("pm_123");
    expect(savedCanonicalEvents).toContainEqual(expect.objectContaining({
      eventType: "payment_method.created",
      aggregateId: "pm_123",
      payload: expect.objectContaining({
        merchantAccountId: "merchant_123",
        ownerType: "customer",
        ownerId: "customer_123",
        paymentMethodStatus: "active",
        isDefault: true,
        setupSessionId: "pmset_123",
      }),
    }));
  });

  test("rejects expired setup session", async () => {
    const { uow } = createUnitOfWork({
      setupSession: {
        id: "pmset_123",
        environment: "sandbox",
        merchantAccountId: "merchant_123",
        ownerType: "customer",
        ownerId: "customer_123",
        methodType: "card",
        provider: "finix",
        clientSecret: "pmsec_123",
        status: "pending_tokenization",
        setAsDefault: false,
        expiresAt: "2026-04-23T11:59:00.000Z",
        createdAt: "2026-04-23T11:00:00.000Z",
        updatedAt: "2026-04-23T11:00:00.000Z",
      },
    });
    const service = createPaymentMethodSetupService({
      uow,
      providers: createRegistry(),
      resolveProviderContext: () => ({ provider: "finix", environment: "sandbox" }),
      now: () => "2026-04-23T12:00:00.000Z",
    });

    await expect(
      service.createPaymentMethodFromSetup({
        environment: "sandbox",
        paymentMethodSetupSessionId: "pmset_123",
        setupToken: "tok_123",
      }),
    ).rejects.toBeInstanceOf(PaymentMethodSetupServiceError);
  });

  test("replays consumed setup session for same idempotency key", async () => {
    const existingPaymentMethod: PaymentMethod = {
      id: "pm_existing",
      environment: "sandbox",
      merchantAccountId: "merchant_123",
      ownerType: "customer",
      ownerId: "customer_123",
      methodType: "card",
      status: "active",
      isDefault: true,
      brandSummary: "VISA",
      last4: "4242",
      expiryMonth: 1,
      expiryYear: 2030,
      processorInstrumentRefs: [],
      createdAt: "2026-04-23T12:00:00.000Z",
      updatedAt: "2026-04-23T12:00:00.000Z",
    };
    const { uow } = createUnitOfWork({
      setupSession: {
        id: "pmset_123",
        environment: "sandbox",
        merchantAccountId: "merchant_123",
        ownerType: "customer",
        ownerId: "customer_123",
        methodType: "card",
        provider: "finix",
        clientSecret: "pmsec_123",
        status: "consumed",
        setAsDefault: true,
        expiresAt: "2026-04-23T12:30:00.000Z",
        createdAt: "2026-04-23T12:00:00.000Z",
        updatedAt: "2026-04-23T12:05:00.000Z",
        consumedAt: "2026-04-23T12:05:00.000Z",
      },
      paymentMethods: [existingPaymentMethod],
      idempotencyRecord: {
        environment: "sandbox",
        scope: "payment_method_setup:pmset_123",
        idempotencyKey: "idem_123",
        requestHash: "fnv1a_6b20ecef",
        responseRef: "pm_existing",
      },
    });
    const service = createPaymentMethodSetupService({
      uow,
      providers: createRegistry(),
      resolveProviderContext: () => ({ provider: "finix", environment: "sandbox" }),
      now: () => "2026-04-23T12:10:00.000Z",
    });

    await expect(
      service.createPaymentMethodFromSetup({
        environment: "sandbox",
        paymentMethodSetupSessionId: "pmset_123",
        setupToken: "tok_123",
        idempotencyKey: "idem_123",
      }),
    ).resolves.toEqual({
      id: "pm_existing",
      merchantAccountId: "merchant_123",
      ownerType: "customer",
      ownerId: "customer_123",
      methodType: "card",
      status: "active",
      isDefault: true,
      brandSummary: "VISA",
      last4: "4242",
      expiryMonth: 1,
      expiryYear: 2030,
    });
  });

  test("rejects consumed setup session for different idempotency key before provider call", async () => {
    let providerCalled = false;
    const { uow } = createUnitOfWork({
      setupSession: {
        id: "pmset_123",
        environment: "sandbox",
        merchantAccountId: "merchant_123",
        ownerType: "customer",
        ownerId: "customer_123",
        methodType: "card",
        provider: "finix",
        clientSecret: "pmsec_123",
        status: "consumed",
        setAsDefault: true,
        expiresAt: "2026-04-23T12:30:00.000Z",
        createdAt: "2026-04-23T12:00:00.000Z",
        updatedAt: "2026-04-23T12:05:00.000Z",
        consumedAt: "2026-04-23T12:05:00.000Z",
      },
    });
    const service = createPaymentMethodSetupService({
      uow,
      providers: createRegistry({
        onCreatePaymentMethodInput() {
          providerCalled = true;
        },
      }),
      resolveProviderContext: () => ({ provider: "finix", environment: "sandbox" }),
      now: () => "2026-04-23T12:10:00.000Z",
    });

    await expect(
      service.createPaymentMethodFromSetup({
        environment: "sandbox",
        paymentMethodSetupSessionId: "pmset_123",
        setupToken: "tok_123",
        idempotencyKey: "idem_other",
      }),
    ).rejects.toMatchObject({
      code: "conflict",
      message: "payment method setup session already consumed",
    });
    expect(providerCalled).toBe(false);
  });

  test("rejects consuming setup session before provider call", async () => {
    let providerCalled = false;
    const { uow } = createUnitOfWork({
      setupSession: {
        id: "pmset_123",
        environment: "sandbox",
        merchantAccountId: "merchant_123",
        ownerType: "customer",
        ownerId: "customer_123",
        methodType: "card",
        provider: "finix",
        clientSecret: "pmsec_123",
        status: "consuming",
        setAsDefault: true,
        expiresAt: "2026-04-23T12:30:00.000Z",
        createdAt: "2026-04-23T12:00:00.000Z",
        updatedAt: "2026-04-23T12:05:00.000Z",
      },
    });
    const service = createPaymentMethodSetupService({
      uow,
      providers: createRegistry({
        onCreatePaymentMethodInput() {
          providerCalled = true;
        },
      }),
      resolveProviderContext: () => ({ provider: "finix", environment: "sandbox" }),
      now: () => "2026-04-23T12:10:00.000Z",
    });

    await expect(
      service.createPaymentMethodFromSetup({
        environment: "sandbox",
        paymentMethodSetupSessionId: "pmset_123",
        setupToken: "tok_123",
      }),
    ).rejects.toMatchObject({
      code: "conflict",
      message: "payment method setup session is already being consumed",
    });
    expect(providerCalled).toBe(false);
  });

  test("marks setup session failed when provider create fails", async () => {
    const { uow, savedSetupSessions } = createUnitOfWork({
      setupSession: {
        id: "pmset_123",
        environment: "sandbox",
        merchantAccountId: "merchant_123",
        ownerType: "customer",
        ownerId: "customer_123",
        methodType: "card",
        provider: "finix",
        clientSecret: "pmsec_123",
        status: "pending_tokenization",
        setAsDefault: true,
        expiresAt: "2026-04-23T12:30:00.000Z",
        createdAt: "2026-04-23T12:00:00.000Z",
        updatedAt: "2026-04-23T12:00:00.000Z",
      },
    });
    const service = createPaymentMethodSetupService({
      uow,
      providers: createRegistry({
        providerResult: {
          ok: false,
          error: {
            provider: "finix",
            category: "temporarily_unavailable",
            code: "provider_down",
            message: "provider down",
            retryable: true,
          },
        },
      }),
      resolveProviderContext: () => ({ provider: "finix", environment: "sandbox" }),
      now: () => "2026-04-23T12:10:00.000Z",
    });

    await expect(
      service.createPaymentMethodFromSetup({
        environment: "sandbox",
        paymentMethodSetupSessionId: "pmset_123",
        setupToken: "tok_123",
      }),
    ).rejects.toMatchObject({
      code: "provider_unavailable",
      message: "provider down",
      retryable: true,
    });
    expect(savedSetupSessions.map((session) => session.status)).toEqual(["consuming", "failed"]);
  });
});
