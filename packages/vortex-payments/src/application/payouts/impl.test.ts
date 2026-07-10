import { describe, expect, test } from "vitest";
import type { Payout, SellerPayoutProfileSnapshot, Settlement } from "../../domain/funds";
import type { MerchantAccount } from "../../domain/merchant";
import type { MerchantAccountState } from "../../domain/state";
import type { PaymentsUnitOfWork } from "../../storage/unit-of-work";
import { createPayoutsService } from "./impl";

function createPayout(overrides: Partial<Payout> = {}): Payout {
  return {
    id: "po_123",
    environment: "sandbox",
    merchantAccountId: "merchant_123",
    amount: 900,
    currency: "USD",
    direction: "credit",
    status: "succeeded",
    processorRefs: [],
    createdAt: "2026-05-14T13:00:00.000Z",
    updatedAt: "2026-05-14T14:00:00.000Z",
    ...overrides,
  };
}

function createSettlement(overrides: Partial<Settlement> = {}): Settlement {
  return {
    id: "settlement_123",
    environment: "sandbox",
    merchantAccountId: "merchant_123",
    currency: "USD",
    status: "approved",
    grossAmount: 1000,
    feeAmount: 50,
    refundAmount: 0,
    adjustmentAmount: 0,
    netAmount: 950,
    direction: "credit",
    closedAt: "2026-05-14T13:00:00.000Z",
    approvedAt: "2026-05-14T14:00:00.000Z",
    processorRefs: [],
    createdAt: "2026-05-14T12:00:00.000Z",
    updatedAt: "2026-05-14T14:00:00.000Z",
    ...overrides,
  };
}

function createMerchant(overrides: Partial<MerchantAccount> = {}): MerchantAccount {
  return {
    id: "merchant_123",
    environment: "sandbox",
    tenantId: "tenant_123",
    displayName: "Merchant",
    legalEntityType: "business",
    country: "USA",
    merchantMode: "processing",
    defaultCurrency: "USD",
    status: "active",
    capabilityStatus: "active",
    processorAccountRefs: [
      {
        provider: "finix",
        objectType: "merchant",
        objectId: "MU123",
        relationship: "merchant_account",
        recordedAt: "2026-05-14T12:00:00.000Z",
      },
    ],
    createdAt: "2026-05-14T12:00:00.000Z",
    updatedAt: "2026-05-14T12:00:00.000Z",
    ...overrides,
  };
}

function createMerchantState(overrides: Partial<MerchantAccountState> = {}): MerchantAccountState {
  return {
    merchantAccountId: "merchant_123",
    environment: "sandbox",
    merchantStatus: "active",
    openRequirementIds: [],
    activeCapabilityKeys: [],
    restrictedCapabilityKeys: [],
    canAcceptPayments: true,
    payoutReadiness: "ready",
    capabilitySnapshots: [],
    generatedAt: "2026-05-14T12:00:00.000Z",
    ...overrides,
  };
}

function createUow(
  payouts: readonly Payout[],
  settlements: readonly Settlement[] = [],
  merchants: readonly MerchantAccount[] = [],
  merchantStates: readonly MerchantAccountState[] = [],
): PaymentsUnitOfWork {
  const records = new Map(payouts.map((payout) => [`${payout.environment}:${payout.id}`, payout]));
  const settlementRecords = new Map(
    settlements.map((settlement) => [`${settlement.environment}:${settlement.id}`, settlement]),
  );
  const merchantRecords = new Map(
    merchants.map((merchant) => [`${merchant.environment}:${merchant.id}`, merchant]),
  );
  const stateRecords = new Map(
    merchantStates.map((state) => [`${state.environment}:${state.merchantAccountId}`, state]),
  );
  return {
    merchants: {
      async getById(id, options) {
        return merchantRecords.get(`${options.environment}:${id}`) ?? null;
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
      async getByMerchantAccountId(merchantAccountId, options) {
        return stateRecords.get(`${options.environment}:${merchantAccountId}`) ?? null;
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
        return settlementRecords.get(`${options.environment}:${id}`) ?? null;
      },
      async getByProcessorRef() {
        return null;
      },
      async listByMerchant(environment, merchantAccountId) {
        return Array.from(settlementRecords.values()).filter(
          (record) =>
            record.environment === environment && record.merchantAccountId === merchantAccountId,
        );
      },
      async save() {},
    },
    payouts: {
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

describe("createPayoutsService", () => {
  test("lists merchant payouts newest first", async () => {
    const service = createPayoutsService({
      uow: createUow([
        createPayout({ id: "po_older", updatedAt: "2026-05-14T12:00:00.000Z" }),
        createPayout({ id: "po_newer", updatedAt: "2026-05-14T15:00:00.000Z" }),
        createPayout({ id: "po_other", merchantAccountId: "merchant_999" }),
      ]),
    });

    const result = await service.listMerchantPayouts({
      environment: "sandbox",
      merchantAccountId: "merchant_123",
    });

    expect(result).toEqual({
      items: [
        expect.objectContaining({ id: "po_newer" }),
        expect.objectContaining({ id: "po_older" }),
      ],
      hasMore: false,
    });
  });

  test("gets merchant payout by id within scope", async () => {
    const service = createPayoutsService({
      uow: createUow([createPayout()]),
    });

    const payout = await service.getMerchantPayout({
      environment: "sandbox",
      merchantAccountId: "merchant_123",
      payoutId: "po_123",
    });
    expect(payout).toMatchObject({
      id: "po_123",
      merchantAccountId: "merchant_123",
      amount: 900,
      currency: "USD",
      status: "succeeded",
    });
    expect(payout).not.toHaveProperty("processorRefs");

    expect(
      await service.getMerchantPayout({
        environment: "sandbox",
        merchantAccountId: "merchant_999",
        payoutId: "po_123",
      }),
    ).toBeNull();
  });

  test("derives settlement payout readiness without creating payout writes", async () => {
    const service = createPayoutsService({
      uow: createUow([], [createSettlement()], [], [createMerchantState()]),
      now: () => "2026-05-14T16:00:00.000Z",
    });

    const result = await service.getSettlementPayoutReadiness({
      environment: "sandbox",
      merchantAccountId: "merchant_123",
      settlementId: "settlement_123",
    });

    expect(result).toEqual({
      environment: "sandbox",
      merchantAccountId: "merchant_123",
      settlementId: "settlement_123",
      status: "ready",
      blockers: [],
      nextAction: "await_funding_transfer",
      settlementStatus: "approved",
      merchantPayoutReadiness: "ready",
      payoutIds: [],
      generatedAt: "2026-05-14T16:00:00.000Z",
    });
  });

  test("marks settlement readiness paid when funding transfer succeeded", async () => {
    const service = createPayoutsService({
      uow: createUow(
        [createPayout({ settlementId: "settlement_123", status: "succeeded" })],
        [createSettlement()],
        [],
        [createMerchantState()],
      ),
      now: () => "2026-05-14T16:00:00.000Z",
    });

    const result = await service.getSettlementPayoutReadiness({
      environment: "sandbox",
      merchantAccountId: "merchant_123",
      settlementId: "settlement_123",
    });

    expect(result).toEqual(
      expect.objectContaining({
        status: "paid",
        nextAction: "funding_transfer_succeeded",
        payoutIds: ["po_123"],
      }),
    );
  });

  test("builds settlement funding timeline", async () => {
    const service = createPayoutsService({
      uow: createUow(
        [
          createPayout({
            settlementId: "settlement_123",
            updatedAt: "2026-05-14T15:00:00.000Z",
            expectedArrivalAt: "2026-05-15T15:00:00.000Z",
          }),
        ],
        [createSettlement()],
        [],
        [createMerchantState()],
      ),
      now: () => "2026-05-14T16:00:00.000Z",
    });

    const result = await service.getSettlementFundingTimeline({
      environment: "sandbox",
      merchantAccountId: "merchant_123",
      settlementId: "settlement_123",
    });

    expect(result?.items.map((item) => [item.kind, item.id])).toEqual([
      ["settlement", "settlement_123"],
      ["funding_transfer", "po_123"],
    ]);
    expect(result?.generatedAt).toBe("2026-05-14T16:00:00.000Z");
  });

  test("reads provider-backed seller payout profile snapshot", async () => {
    const savedSnapshots: SellerPayoutProfileSnapshot[] = [];
    const uow = createUow([], [], [createMerchant()]);
    const service = createPayoutsService({
      uow: {
        ...uow,
        sellerPayoutProfileSnapshots: {
          async listByMerchant() {
            return savedSnapshots;
          },
          async save(record) {
            savedSnapshots.push(record);
          },
        },
      },
      providers: {
        getAdapter() {
          return {
            key: "finix",
            supportedCapabilities: [],
            async verifyWebhookSignature() {
              return {
                valid: true,
                deliveryKey: "delivery",
                receivedAt: "2026-05-14T12:00:00.000Z",
              };
            },
            async createMerchantOnboarding() {
              return { ok: false };
            },
            async createPaymentIntent() {
              return { ok: false };
            },
            async createRefund() {
              return { ok: false };
            },
            async fetchObjectSnapshot() {
              return { ok: false };
            },
            async getSellerPayoutProfile() {
              return {
                ok: true,
                value: {
                  mode: "net",
                  payoutRail: "next_day_ach",
                  payoutSchedule: "daily",
                  fetchedAt: "2026-05-14T12:00:00.000Z",
                },
              };
            },
          };
        },
        listAdapters() {
          return [];
        },
      },
      resolveProviderContext: () => ({ provider: "finix", environment: "sandbox" }),
    });

    const result = await service.getMerchantSellerPayoutProfile({
      environment: "sandbox",
      merchantAccountId: "merchant_123",
    });

    expect(result).toEqual(
      expect.objectContaining({
        environment: "sandbox",
        merchantAccountId: "merchant_123",
        mode: "net",
        payoutRail: "next_day_ach",
        payoutSchedule: "daily",
        capabilities: expect.arrayContaining([
          expect.objectContaining({ key: "standard_next_day_ach", status: "enabled" }),
          expect.objectContaining({ key: "same_day_ach", status: "disabled" }),
          expect.objectContaining({ key: "instant_card_push", status: "disabled" }),
          expect.objectContaining({ key: "gross_payout", status: "disabled" }),
          expect.objectContaining({ key: "sub_merchant_payee_payment", status: "disabled" }),
        ]),
      }),
    );
    expect(result).not.toHaveProperty("provider");
    expect(result).not.toHaveProperty("merchantRef");
    expect(result).not.toHaveProperty("profileRef");
    expect(savedSnapshots).toHaveLength(1);
  });
});
