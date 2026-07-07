import { describe, expect, test } from "vitest";
import type {
  CanonicalDomainEvent,
  ProcessorEvent,
  RawProcessorWebhook,
} from "../../events/types";
import type { CustomerPaymentState, MerchantAccountState } from "../../domain/state";
import type { PaymentMethod } from "../../domain/payment-methods";
import type { IdempotencyRecord } from "../../storage/repositories";
import type { PaymentsUnitOfWork } from "../../storage/unit-of-work";
import type { ProviderRegistry } from "../../providers/registry";
import type { PaymentsProviderAdapter } from "../../providers/types";
import type { CanonicalEventsService } from "../events/service";
import {
  createWebhooksService,
  type ProviderWebhookMapper,
  type WebhooksServiceError,
} from "./impl";

function createMemoryUnitOfWork(): PaymentsUnitOfWork {
  const rawWebhooks = new Map<string, RawProcessorWebhook>();
  const processorEvents = new Map<string, ProcessorEvent>();
  const canonicalEvents = new Map<string, CanonicalDomainEvent>();
  const merchantStates = new Map<string, MerchantAccountState>();
  const customerStates = new Map<string, CustomerPaymentState>();
  const paymentMethodsStore = new Map<string, PaymentMethod>();
  const idempotency = new Map<string, IdempotencyRecord>();

  return {
    merchants: {
      async getById() {
        return null;
      },
      async listByTenant() {
        return [];
      },
      async getByProcessorRef() {
        return null;
      },
      async save() {},
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
      async getById() {
        return null;
      },
      async getByPaymentIntentId() {
        return null;
      },
      async save() {},
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
      async getRawWebhookById(id, options) {
        return rawWebhooks.get(`${options.environment}:${id}`) ?? null;
      },
      async getRawWebhookByDeliveryKey(environment, provider, deliveryKey) {
        return (
          Array.from(rawWebhooks.values()).find(
            (record) =>
              record.environment === environment &&
              record.provider === provider &&
              record.deliveryKey === deliveryKey,
          ) ?? null
        );
      },
      async saveRawWebhook(record) {
        rawWebhooks.set(`${record.environment}:${record.id}`, record);
      },
      async getProcessorEventById(id, options) {
        return processorEvents.get(`${options.environment}:${id}`) ?? null;
      },
      async saveProcessorEvent(record) {
        processorEvents.set(`${record.environment}:${record.id}`, record);
      },
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

const mapper: ProviderWebhookMapper = {
  provider: "finix",
  mapRawWebhookRecord(input) {
    return {
      id: input.id,
      environment: input.environment,
      provider: "finix",
      deliveryKey: input.deliveryKey,
      processorWebhookId: "evt_123",
      processorEntityType: "transfer",
      processorEventType: "transfer.updated",
      headers: input.headers,
      rawBody: input.rawBody,
      signatureValidationStatus: input.signatureValidationStatus,
      processingStatus: input.processingStatus ?? "pending",
      receivedAt: input.receivedAt ?? "2026-04-23T12:00:00.000Z",
    };
  },
  mapRawWebhookToProcessorEvent(input) {
    return {
      id: "proc_evt_123",
      environment: input.environment,
      provider: "finix",
      processorEventId: "evt_123",
      processorEntityType: "transfer",
      processorEventType: "transfer.updated",
      processorObjectId: "tr_123",
      occurredAt: input.receivedAt ?? "2026-04-23T12:00:00.000Z",
      payload: JSON.stringify({ state: "SUCCEEDED" }),
      rawWebhookId: input.rawWebhookId,
      normalizationStatus: "pending",
      createdAt: input.receivedAt ?? "2026-04-23T12:00:00.000Z",
    };
  },
  mapProcessorEventToCanonicalDomainEvents(event) {
    return [
      {
        id: `${event.id}:payment.captured`,
        environment: event.environment,
        eventType: "payment.captured",
        aggregateType: "payment",
        aggregateId: event.processorObjectId,
        occurredAt: event.occurredAt,
        sourceProvider: "finix",
        sourceEventRef: event.id,
        correlationId: event.rawWebhookId,
        payload: { state: "SUCCEEDED" },
        createdAt: event.createdAt,
      },
    ];
  },
};

describe("createWebhooksService", () => {
  test("throws when provider mapper missing", async () => {
    const adapter: PaymentsProviderAdapter = {
      key: "finix",
      supportedCapabilities: ["webhooks"],
      async verifyWebhookSignature() {
        return {
          valid: true,
          deliveryKey: "delivery_123",
          receivedAt: "2026-04-23T12:00:00.000Z",
        };
      },
      async createMerchantOnboarding() { throw new Error("not used"); },
      async createPaymentIntent() { throw new Error("not used"); },
      async createRefund() { throw new Error("not used"); },
      async fetchObjectSnapshot() { throw new Error("not used"); },
    };

    const service = createWebhooksService({
      uow: createMemoryUnitOfWork(),
      providers: createRegistry(adapter),
      webhookMappers: {} as never,
    });

    await expect(service.ingestProviderWebhook({
      environment: "sandbox",
      provider: "finix",
      headers: {},
      rawBody: "{}",
      receivedAt: "2026-04-23T12:00:00.000Z",
    })).rejects.toMatchObject({ name: "WebhooksServiceError", code: "not_found" } satisfies Partial<WebhooksServiceError>);
  });

  test("stores invalid signature webhook as rejected", async () => {
    const uow = createMemoryUnitOfWork();
    const adapter: PaymentsProviderAdapter = {
      key: "finix",
      supportedCapabilities: ["webhooks"],
      async verifyWebhookSignature() {
        return {
          valid: false,
          reason: "bad signature",
          deliveryKey: "delivery_123",
          receivedAt: "2026-04-23T12:00:00.000Z",
        };
      },
      async createMerchantOnboarding() { throw new Error("not used"); },
      async createPaymentIntent() { throw new Error("not used"); },
      async createRefund() { throw new Error("not used"); },
      async fetchObjectSnapshot() { throw new Error("not used"); },
    };

    const service = createWebhooksService({
      uow,
      providers: createRegistry(adapter),
      webhookMappers: { finix: mapper } as const,
      createId: () => "raw_fixed",
    });

    const result = await service.ingestProviderWebhook({
      environment: "sandbox",
      provider: "finix",
      headers: {},
      rawBody: "{}",
      receivedAt: "2026-04-23T12:00:00.000Z",
    });

    expect(result).toEqual({
      rawWebhookId: "raw_fixed",
      accepted: false,
      duplicate: false,
      signatureStatus: "invalid",
      signatureReason: "bad signature",
    });

    const stored = await uow.events.getRawWebhookById("raw_fixed", { environment: "sandbox" });
    expect(stored).toMatchObject({
      signatureValidationStatus: "invalid",
      processingStatus: "rejected",
      deliveryKey: "delivery_123",
    });
  });

  test("ingests valid webhook and dedupes by delivery key", async () => {
    const uow = createMemoryUnitOfWork();
    const applied: CanonicalDomainEvent[][] = [];
    let verifyCalls = 0;
    const adapter: PaymentsProviderAdapter = {
      key: "finix",
      supportedCapabilities: ["webhooks"],
      async verifyWebhookSignature() {
        verifyCalls += 1;
        return {
          valid: true,
          providerWebhookId: "evt_123",
          deliveryKey: "delivery_123",
          receivedAt: "2026-04-23T12:00:00.000Z",
        };
      },
      async createMerchantOnboarding() { throw new Error("not used"); },
      async createPaymentIntent() { throw new Error("not used"); },
      async createRefund() { throw new Error("not used"); },
      async fetchObjectSnapshot() { throw new Error("not used"); },
    };

    const canonicalEvents: CanonicalEventsService = {
      async applyCanonicalEvents(events) {
        applied.push([...events]);
      },
    };

    const service = createWebhooksService({
      uow,
      providers: createRegistry(adapter),
      webhookMappers: { finix: mapper } as const,
      canonicalEvents,
      createId: () => "raw_fixed",
    });

    const first = await service.ingestProviderWebhook({
      environment: "sandbox",
      provider: "finix",
      headers: { "Finix-Signature": "sig" },
      rawBody: "{}",
      receivedAt: "2026-04-23T12:00:00.000Z",
    });
    expect(first).toEqual({
      rawWebhookId: "raw_fixed",
      accepted: true,
      duplicate: false,
      signatureStatus: "valid",
    });

    const storedEvent = await uow.events.getProcessorEventById("proc_evt_123", { environment: "sandbox" });
    expect(storedEvent).toMatchObject({
      normalizationStatus: "normalized",
      rawWebhookId: "raw_fixed",
    });

    const storedCanonical = await uow.events.getCanonicalEventById("proc_evt_123:payment.captured", {
      environment: "sandbox",
    });
    expect(storedCanonical).toMatchObject({
      eventType: "payment.captured",
      aggregateId: "tr_123",
    });

    const duplicate = await service.ingestProviderWebhook({
      environment: "sandbox",
      provider: "finix",
      headers: { "Finix-Signature": "sig" },
      rawBody: "{}",
      receivedAt: "2026-04-23T12:00:01.000Z",
    });
    expect(duplicate).toEqual({
      rawWebhookId: "raw_fixed",
      accepted: true,
      duplicate: true,
      signatureStatus: "valid",
    });
    expect(verifyCalls).toBe(2);
    expect(applied).toHaveLength(1);
    expect(applied[0]?.[0]?.eventType).toBe("payment.captured");
  });
});
