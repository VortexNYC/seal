import { describe, expect, test } from "vitest";
import type { Settlement } from "../../domain/funds";
import type { PaymentsUnitOfWork } from "../../storage/unit-of-work";
import { createSettlementsService } from "./impl";

function createSettlement(overrides: Partial<Settlement> = {}): Settlement {
  return {
    id: "st_123",
    environment: "sandbox",
    merchantAccountId: "merchant_123",
    currency: "USD",
    status: "closed",
    grossAmount: 1000,
    feeAmount: 100,
    refundAmount: 0,
    adjustmentAmount: 0,
    netAmount: 900,
    direction: "credit",
    processorRefs: [],
    createdAt: "2026-05-14T13:00:00.000Z",
    updatedAt: "2026-05-14T14:00:00.000Z",
    ...overrides,
  };
}

function createUow(settlements: readonly Settlement[]): PaymentsUnitOfWork {
  const records = new Map(
    settlements.map((settlement) => [`${settlement.environment}:${settlement.id}`, settlement]),
  );
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
      async getByMerchantAccountId() {
        return null;
      },
      async save() {},
    },
    customerStates: {
      async getByMerchantAndCustomer() {
        return null;
      },
      async save() {},
    },
    paymentMethods: {
      async getById() {
        return null;
      },
      async getByProcessorRef() {
        return null;
      },
      async listByOwner() {
        return [];
      },
      async save() {},
    },
    paymentMethodSetupSessions: {
      async getById() {
        return null;
      },
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
      async getById(id, options) {
        return records.get(`${options.environment}:${id}`) ?? null;
      },
      async getByProcessorRef() {
        return null;
      },
      async listByMerchant(environment, merchantAccountId) {
        return Array.from(records.values()).filter(
          (record) =>
            record.environment === environment && record.merchantAccountId === merchantAccountId,
        );
      },
      async save(record) {
        records.set(`${record.environment}:${record.id}`, record);
      },
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
      async saveCanonicalEvent() {},
      async getCanonicalEventById() {
        return null;
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
      async getByScopeAndKey() {
        return null;
      },
      async save() {},
    },
    async runInTransaction(work) {
      return await work(this);
    },
  };
}

describe("createSettlementsService", () => {
  test("lists merchant settlements newest first", async () => {
    const service = createSettlementsService({
      uow: createUow([
        createSettlement({ id: "st_older", updatedAt: "2026-05-14T12:00:00.000Z" }),
        createSettlement({ id: "st_newer", updatedAt: "2026-05-14T15:00:00.000Z" }),
        createSettlement({ id: "st_other", merchantAccountId: "merchant_999" }),
      ]),
    });

    const result = await service.listMerchantSettlements({
      environment: "sandbox",
      merchantAccountId: "merchant_123",
    });

    expect(result).toEqual({
      items: [
        expect.objectContaining({ id: "st_newer" }),
        expect.objectContaining({ id: "st_older" }),
      ],
      hasMore: false,
    });
  });

  test("gets merchant settlement by id within scope", async () => {
    const service = createSettlementsService({
      uow: createUow([createSettlement()]),
    });

    const settlement = await service.getMerchantSettlement({
      environment: "sandbox",
      merchantAccountId: "merchant_123",
      settlementId: "st_123",
    });
    expect(settlement).toMatchObject({
      id: "st_123",
      merchantAccountId: "merchant_123",
      currency: "USD",
      status: "closed",
      netAmount: 900,
    });
    expect(settlement).not.toHaveProperty("processorRefs");

    expect(
      await service.getMerchantSettlement({
        environment: "sandbox",
        merchantAccountId: "merchant_999",
        settlementId: "st_123",
      }),
    ).toBeNull();
  });
});
