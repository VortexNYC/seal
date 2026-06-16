import { describe, expect, test } from "vitest";

import type { MerchantAccount, Payment, PaymentsUnitOfWork, Refund, Settlement, SettlementLineageEntry } from "../..";
import { createSettlementLineageService } from "./impl";

function createMerchant(): MerchantAccount {
  return {
    id: "merchant_123",
    environment: "sandbox",
    tenantId: "tenant_123",
    displayName: "Merchant",
    legalEntityType: "CORPORATION",
    country: "US",
    merchantMode: "processing",
    defaultCurrency: "USD",
    status: "active",
    capabilityStatus: "active",
    createdAt: "2026-05-18T10:00:00.000Z",
    updatedAt: "2026-05-18T10:00:00.000Z",
    processorAccountRefs: [{ provider: "finix", objectType: "merchant", objectId: "MU123", relationship: "merchant_account", recordedAt: "2026-05-18T10:00:00.000Z" }],
  };
}

function createSettlement(): Settlement {
  return {
    id: "settlement_123",
    environment: "sandbox",
    merchantAccountId: "merchant_123",
    currency: "USD",
    status: "closed",
    grossAmount: 1000,
    feeAmount: 30,
    refundAmount: 100,
    adjustmentAmount: 0,
    netAmount: 870,
    direction: "credit",
    closedAt: "2026-05-18T10:10:00.000Z",
    processorRefs: [{ provider: "finix", objectType: "settlement", objectId: "ST123", relationship: "settlement", recordedAt: "2026-05-18T10:10:00.000Z" }],
    createdAt: "2026-05-18T10:00:00.000Z",
    updatedAt: "2026-05-18T10:10:00.000Z",
  };
}

function createPayment(): Payment {
  return {
    id: "payment_123",
    environment: "sandbox",
    merchantAccountId: "merchant_123",
    amount: 1000,
    currency: "USD",
    status: "captured",
    direction: "debit",
    processorPaymentRefs: [{ provider: "finix", objectType: "transfer", objectId: "TR_PAYMENT", relationship: "payment", recordedAt: "2026-05-18T10:01:00.000Z" }],
    createdAt: "2026-05-18T10:01:00.000Z",
    updatedAt: "2026-05-18T10:01:00.000Z",
  };
}

function createRefund(): Refund {
  return {
    id: "refund_123",
    environment: "sandbox",
    merchantAccountId: "merchant_123",
    paymentId: "payment_123",
    amount: 100,
    currency: "USD",
    status: "succeeded",
    reason: "refund",
    requestedByType: "operator",
    requestedByRef: "test",
    settlementImpactAmount: 100,
    processorRefundRefs: [{ provider: "finix", objectType: "transfer", objectId: "TR_REFUND", relationship: "refund", recordedAt: "2026-05-18T10:02:00.000Z" }],
    createdAt: "2026-05-18T10:02:00.000Z",
    updatedAt: "2026-05-18T10:02:00.000Z",
  };
}

function createUnitOfWork(): PaymentsUnitOfWork {
  const merchant = createMerchant();
  const settlement = createSettlement();
  const payment = createPayment();
  const refund = createRefund();
  const entries = new Map<string, SettlementLineageEntry>();
  return {
    merchants: {
      async getById() { return merchant; },
      async listByTenant() { return [merchant]; },
      async getByProcessorRef() { return merchant; },
      async save() {},
    },
    customers: { async getById() { return null; }, async save() {} },
    onboarding: { async getSessionById() { return null; }, async getLatestSessionByMerchantAccountId() { return null; }, async listRequirementsForSession() { return []; }, async listDocumentsForRequirement() { return []; }, async saveSession() {}, async saveRequirement() {}, async saveRequirementDocument() {} },
    merchantStates: { async getByMerchantAccountId() { return null; }, async save() {} },
    customerStates: { async getByMerchantAndCustomer() { return null; }, async save() {} },
    paymentMethods: { async getById() { return null; }, async getByProcessorRef() { return null; }, async listByOwner() { return []; }, async save() {} },
    paymentMethodSetupSessions: { async getById() { return null; }, async save() {} },
    paymentIntents: { async getById() { return null; }, async getByProcessorRef() { return null; }, async listByMerchant() { return []; }, async listByCustomerProfile() { return []; }, async save() {} },
    payments: {
      async getById() { return payment; },
      async getByPaymentIntentId() { return null; },
      async getByProcessorRef(_environment, _provider, _objectType, objectId) { return objectId === "TR_PAYMENT" ? payment : null; },
      async save() {},
    } as PaymentsUnitOfWork["payments"],
    refunds: {
      async getById() { return refund; },
      async getByProcessorRef(_environment, _provider, _objectType, objectId) { return objectId === "TR_REFUND" ? refund : null; },
      async listByPayment() { return [refund]; },
      async save() {},
    },
    settlements: {
      async getById() { return settlement; },
      async getByProcessorRef() { return settlement; },
      async listByMerchant() { return [settlement]; },
      async save() {},
    },
    payouts: { async getById() { return null; }, async getByProcessorRef() { return null; }, async listByMerchant() { return []; }, async save() {} },
    settlementLineageEntries: {
      async getByProviderRowRef(_environment, _provider, _objectType, objectId) { return entries.get(objectId) ?? null; },
      async listBySettlement() { return [...entries.values()]; },
      async save(record) { entries.set(record.providerRowRef.objectId, record); },
    },
    sellerPayoutProfileSnapshots: undefined,
    disputes: { async getById() { return null; }, async getByProcessorRef() { return null; }, async listByMerchant() { return []; }, async save() {} },
    events: { async getRawWebhookById() { return null; }, async getRawWebhookByDeliveryKey() { return null; }, async saveRawWebhook() {}, async getProcessorEventById() { return null; }, async saveProcessorEvent() {}, async saveCanonicalEvent() {}, async getCanonicalEventById() { return null; }, async getWebhookEndpointById() { return null; }, async saveWebhookEndpoint() {}, async saveWebhookDelivery() {}, async saveEventSubscription() {} },
    cases: { async getById() { return null; }, async save() {}, async saveActivity() {}, async saveNote() {} },
    idempotency: { async getByScopeAndKey() { return null; }, async save() {} },
    async runInTransaction(work) { return work(this); },
  };
}

describe("createSettlementLineageService", () => {
  test("syncs settlement lineage rows through provider adapter", async () => {
    const uow = createUnitOfWork();
    const service = createSettlementLineageService({
      uow,
      providers: {
        getAdapter() {
          return {
            key: "finix",
            supportedCapabilities: [],
            async verifyWebhookSignature() { throw new Error("unused"); },
            async createMerchantOnboarding() { throw new Error("unused"); },
            async createPaymentIntent() { throw new Error("unused"); },
            async createRefund() { throw new Error("unused"); },
            async fetchObjectSnapshot() { throw new Error("unused"); },
            async listSettlementLineage() {
              return {
                ok: true,
                value: {
                  items: [
                    {
                      rowRef: { provider: "finix", objectType: "transfer", objectId: "TR_PAYMENT", relationship: "settlement_transfer", recordedAt: "2026-05-18T10:10:00.000Z" },
                      sourceKind: "payment",
                      amount: 1000,
                      currency: "USD",
                      occurredAt: "2026-05-18T10:10:00.000Z",
                      evidenceSource: "provider_settlement_transfer",
                    },
                    {
                      rowRef: { provider: "finix", objectType: "transfer", objectId: "TR_REFUND", relationship: "settlement_transfer", recordedAt: "2026-05-18T10:10:00.000Z" },
                      sourceKind: "refund",
                      amount: 100,
                      currency: "USD",
                      occurredAt: "2026-05-18T10:10:00.000Z",
                      evidenceSource: "provider_settlement_transfer",
                    },
                    {
                      rowRef: { provider: "finix", objectType: "settlement_entry", objectId: "ENTRY_FEE", relationship: "settlement_entry", recordedAt: "2026-05-18T10:10:00.000Z" },
                      sourceKind: "fee",
                      amount: 30,
                      currency: "USD",
                      occurredAt: "2026-05-18T10:10:00.000Z",
                      evidenceSource: "provider_settlement_entry",
                    },
                  ],
                },
              };
            },
          };
        },
        listAdapters() { return []; },
      },
      resolveProviderContext: () => ({ provider: "finix", environment: "sandbox" }),
      now: () => "2026-05-18T10:11:00.000Z",
    });

    const result = await service.syncSettlementLineage({
      environment: "sandbox",
      merchantAccountId: "merchant_123",
      settlementId: "settlement_123",
    });

    expect(result).not.toBeNull();
    expect(result?.considered).toBe(3);
    expect(result?.resolvedPayments).toBe(1);
    expect(result?.resolvedRefunds).toBe(1);
    expect(result?.unresolved).toBe(1);
    expect(result?.entries.some((entry) => entry.paymentId === "payment_123")).toBe(true);
    expect(result?.entries.some((entry) => entry.refundId === "refund_123")).toBe(true);
    expect(result?.entries.some((entry) => entry.sourceKind === "fee")).toBe(true);
  });
});
