import { describe, expect, test } from "vitest";
import type { MerchantAccount } from "../../domain/merchant";
import type { PaymentsUnitOfWork } from "../../storage/unit-of-work";
import { createMerchantTimelineService, MerchantTimelineServiceError } from "./impl";

function createMerchant(seed?: MerchantAccount): MerchantAccount {
  return seed ?? {
    id: "merchant_123",
    environment: "sandbox",
    tenantId: "tenant_123",
    displayName: "Acme",
    legalEntityType: "company",
    country: "US",
    merchantMode: "processing",
    defaultCurrency: "USD",
    status: "active",
    capabilityStatus: "unknown",
    processorAccountRefs: [{
      provider: "finix",
      objectType: "merchant",
      objectId: "finix_merchant_123",
      relationship: "primary",
      recordedAt: "2026-05-14T18:00:00.000Z",
    }],
    createdAt: "2026-05-14T18:00:00.000Z",
    updatedAt: "2026-05-14T18:00:00.000Z",
  };
}

function createUnitOfWork(merchant?: MerchantAccount | null): PaymentsUnitOfWork {
  return {
    merchants: {
      async getById() { return merchant ?? null; },
      async listByTenant() { return []; },
      async getByProcessorRef() { return null; },
      async save() {},
    },
    customers: { async getById() { return null; }, async save() {} },
    onboarding: {
      async getSessionById() { return null; },
      async getLatestSessionByMerchantAccountId() { return null; },
      async listRequirementsForSession() { return []; },
      async listDocumentsForRequirement() { return []; },
      async saveSession() {},
      async saveRequirement() {},
      async saveRequirementDocument() {},
    },
    paymentMethods: { async getById() { return null; }, async getByProcessorRef() { return null; }, async listByOwner() { return []; }, async save() {} },
    paymentMethodSetupSessions: { async getById() { return null; }, async save() {} },
    paymentIntents: { async getById() { return null; }, async getByProcessorRef() { return null; }, async listByMerchant() { return []; }, async listByCustomerProfile() { return []; }, async save() {} },
    payments: { async getById() { return null; }, async getByPaymentIntentId() { return null; }, async save() {} },
    refunds: { async getById() { return null; }, async getByProcessorRef() { return null; }, async listByPayment() { return []; }, async save() {} },
    settlements: { async getById() { return null; }, async getByProcessorRef() { return null; }, async listByMerchant() { return []; }, async save() {} },
    payouts: { async getById() { return null; }, async getByProcessorRef() { return null; }, async listByMerchant() { return []; }, async save() {} },
    disputes: { async getById() { return null; }, async getByProcessorRef() { return null; }, async listByMerchant() { return []; }, async save() {} },
    merchantStates: { async getByMerchantAccountId() { return null; }, async save() {} },
    customerStates: { async getByMerchantAndCustomer() { return null; }, async save() {} },
    events: {
      async getRawWebhookById() { return null; },
      async getRawWebhookByDeliveryKey() { return null; },
      async saveRawWebhook() {},
      async getProcessorEventById() { return null; },
      async saveProcessorEvent() {},
      async saveCanonicalEvent() {},
      async getCanonicalEventById() { return null; },
      async getWebhookEndpointById() { return null; },
      async saveWebhookEndpoint() {},
      async saveWebhookDelivery() {},
      async saveEventSubscription() {},
    },
    cases: { async getById() { return null; }, async save() {}, async saveActivity() {}, async saveNote() {} },
    idempotency: { async getByScopeAndKey() { return null; }, async save() {} },
    async runInTransaction(work) { return work(this); },
  };
}

describe("createMerchantTimelineService", () => {
  test("lists merchant timeline events newest first from dependency", async () => {
    const service = createMerchantTimelineService({
      uow: createUnitOfWork(createMerchant()),
      async listMerchantTimelineEvents() {
        return [{
          id: "evt_123",
          environment: "sandbox",
          eventType: "merchant_account.approved",
          aggregateType: "merchant_account",
          aggregateId: "finix_merchant_123",
          occurredAt: "2026-05-14T20:00:00.000Z",
          sourceProvider: "finix",
          payload: { merchantAccountId: "merchant_123" },
          createdAt: "2026-05-14T20:00:01.000Z",
        }];
      },
    });

    const result = await service.listMerchantTimeline({
      environment: "sandbox",
      merchantAccountId: "merchant_123",
      limit: 20,
    });

    expect(result).toMatchObject({
      hasMore: false,
      items: [{
        id: "evt_123",
        eventType: "merchant_account.approved",
        aggregateId: "finix_merchant_123",
        description: "Merchant account can accept payments.",
      }],
    });
  });

  test("maps operator reconciliation event descriptions for funds and disputes", async () => {
    const service = createMerchantTimelineService({
      uow: createUnitOfWork(createMerchant()),
      async listMerchantTimelineEvents() {
        return [
          {
            id: "evt_settlement",
            environment: "sandbox",
            eventType: "settlement.reconciled",
            aggregateType: "settlement",
            aggregateId: "set_123",
            occurredAt: "2026-05-14T20:00:00.000Z",
            sourceProvider: "vortex",
            payload: { merchantAccountId: "merchant_123" },
            createdAt: "2026-05-14T20:00:00.000Z",
          },
          {
            id: "evt_payout",
            environment: "sandbox",
            eventType: "payout.reconciled",
            aggregateType: "payout",
            aggregateId: "po_123",
            occurredAt: "2026-05-14T19:00:00.000Z",
            sourceProvider: "vortex",
            payload: { merchantAccountId: "merchant_123" },
            createdAt: "2026-05-14T19:00:00.000Z",
          },
          {
            id: "evt_dispute",
            environment: "sandbox",
            eventType: "dispute.reconciled",
            aggregateType: "dispute",
            aggregateId: "disp_123",
            occurredAt: "2026-05-14T18:00:00.000Z",
            sourceProvider: "vortex",
            payload: { merchantAccountId: "merchant_123" },
            createdAt: "2026-05-14T18:00:00.000Z",
          },
        ];
      },
    });

    const result = await service.listMerchantTimeline({
      environment: "sandbox",
      merchantAccountId: "merchant_123",
      limit: 20,
    });

    expect(result.items).toMatchObject([
      {
        id: "evt_settlement",
        eventType: "settlement.reconciled",
        description: "A settlement was refreshed from provider state by local reconciliation.",
      },
      {
        id: "evt_payout",
        eventType: "payout.reconciled",
        description: "A payout was refreshed from provider state by local reconciliation.",
      },
      {
        id: "evt_dispute",
        eventType: "dispute.reconciled",
        description: "A dispute was refreshed from provider state by local reconciliation.",
      },
    ]);
  });

  test("throws not_found when merchant missing", async () => {
    const service = createMerchantTimelineService({
      uow: createUnitOfWork(null),
      async listMerchantTimelineEvents() {
        return [];
      },
    });

    await expect(service.listMerchantTimeline({
      environment: "sandbox",
      merchantAccountId: "missing",
    })).rejects.toBeInstanceOf(MerchantTimelineServiceError);
  });
});
