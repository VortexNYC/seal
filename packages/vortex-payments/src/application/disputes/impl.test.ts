import { describe, expect, test } from "vitest";
import type { Dispute } from "../../domain/disputes";
import type { MerchantAccount } from "../../domain/merchant";
import type { PaymentsProviderAdapter } from "../../providers/types";
import type { PaymentsUnitOfWork } from "../../storage/unit-of-work";
import { createDisputesService } from "./impl";

function createDispute(overrides: Partial<Dispute> = {}): Dispute {
  return {
    id: "dp_123",
    environment: "sandbox",
    merchantAccountId: "merchant_123",
    paymentId: "pay_123",
    amount: 900,
    currency: "USD",
    stage: "chargeback",
    responseState: "needs_response",
    openedAt: "2026-05-14T13:00:00.000Z",
    processorRefs: [
      {
        provider: "finix",
        objectType: "dispute",
        objectId: "DI_123",
        relationship: "dispute",
        recordedAt: "2026-05-14T13:00:00.000Z",
      },
    ],
    createdAt: "2026-05-14T13:00:00.000Z",
    updatedAt: "2026-05-14T14:00:00.000Z",
    ...overrides,
  };
}

function createMerchant(overrides: Partial<MerchantAccount> = {}): MerchantAccount {
  return {
    id: "merchant_123",
    environment: "sandbox",
    tenantId: "tenant_123",
    displayName: "Merchant 123",
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
        objectId: "MU_123",
        relationship: "merchant_account",
        recordedAt: "2026-05-14T13:00:00.000Z",
      },
    ],
    createdAt: "2026-05-14T13:00:00.000Z",
    updatedAt: "2026-05-14T13:00:00.000Z",
    ...overrides,
  };
}

function createUow(
  disputes: readonly Dispute[],
  merchant: MerchantAccount | null = null,
): PaymentsUnitOfWork {
  const records = new Map(
    disputes.map((dispute) => [`${dispute.environment}:${dispute.id}`, dispute]),
  );
  return {
    merchants: {
      async getById(id, options) {
        return merchant && merchant.id === id && merchant.environment === options.environment
          ? merchant
          : null;
      },
      async listByTenant() {
        return merchant ? [merchant] : [];
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

function createProviderRegistry(adapter: PaymentsProviderAdapter) {
  return {
    getAdapter() {
      return adapter;
    },
    listAdapters() {
      return [adapter];
    },
  };
}

function createAdapter(overrides: Partial<PaymentsProviderAdapter> = {}): PaymentsProviderAdapter {
  return {
    key: "finix",
    supportedCapabilities: [],
    async verifyWebhookSignature() {
      return { valid: true, deliveryKey: "delivery_123", receivedAt: "2026-05-14T13:00:00.000Z" };
    },
    async createMerchantOnboarding() {
      return {
        ok: false,
        error: {
          provider: "finix",
          category: "not_supported",
          code: "not_supported",
          message: "not supported",
          retryable: false,
        },
      };
    },
    async createPaymentIntent() {
      return {
        ok: false,
        error: {
          provider: "finix",
          category: "not_supported",
          code: "not_supported",
          message: "not supported",
          retryable: false,
        },
      };
    },
    async createRefund() {
      return {
        ok: false,
        error: {
          provider: "finix",
          category: "not_supported",
          code: "not_supported",
          message: "not supported",
          retryable: false,
        },
      };
    },
    async fetchObjectSnapshot() {
      return {
        ok: false,
        error: {
          provider: "finix",
          category: "not_supported",
          code: "not_supported",
          message: "not supported",
          retryable: false,
        },
      };
    },
    ...overrides,
  };
}

describe("createDisputesService", () => {
  test("lists merchant disputes newest first", async () => {
    const service = createDisputesService({
      uow: createUow([
        createDispute({ id: "dp_older", updatedAt: "2026-05-14T12:00:00.000Z" }),
        createDispute({ id: "dp_newer", updatedAt: "2026-05-14T15:00:00.000Z" }),
        createDispute({ id: "dp_other", merchantAccountId: "merchant_999" }),
      ]),
    });

    const result = await service.listMerchantDisputes({
      environment: "sandbox",
      merchantAccountId: "merchant_123",
    });

    expect(result).toEqual({
      items: [
        expect.objectContaining({ id: "dp_newer" }),
        expect.objectContaining({ id: "dp_older" }),
      ],
      hasMore: false,
    });
  });

  test("gets merchant dispute by id within scope", async () => {
    const service = createDisputesService({
      uow: createUow([createDispute()]),
    });

    const dispute = await service.getMerchantDispute({
      environment: "sandbox",
      merchantAccountId: "merchant_123",
      disputeId: "dp_123",
    });
    expect(dispute).toMatchObject({
      id: "dp_123",
      merchantAccountId: "merchant_123",
      paymentId: "pay_123",
      amount: 900,
      currency: "USD",
      responseState: "needs_response",
    });
    expect(dispute).not.toHaveProperty("processorRefs");

    expect(
      await service.getMerchantDispute({
        environment: "sandbox",
        merchantAccountId: "merchant_999",
        disputeId: "dp_123",
      }),
    ).toBeNull();
  });

  test("projects card-present terminal lineage without provider refs", async () => {
    const service = createDisputesService({
      uow: createUow([
        createDispute({
          terminalSessionId: "tcs_terminal_123",
          terminalReaderId: "tr_terminal_123",
        }),
      ]),
    });

    const dispute = await service.getMerchantDispute({
      environment: "sandbox",
      merchantAccountId: "merchant_123",
      disputeId: "dp_123",
    });

    expect(dispute).toMatchObject({
      id: "dp_123",
      paymentId: "pay_123",
      terminalSessionId: "tcs_terminal_123",
      terminalReaderId: "tr_terminal_123",
    });
    expect(dispute).not.toHaveProperty("processorRefs");
  });

  test("accepts dispute with provider primitive and updates canonical response state", async () => {
    const service = createDisputesService({
      uow: createUow(
        [
          createDispute({
            terminalSessionId: "tcs_terminal_123",
            terminalReaderId: "tr_terminal_123",
          }),
        ],
        createMerchant(),
      ),
      providers: createProviderRegistry(
        createAdapter({
          async acceptDispute(_context, input) {
            expect(input.disputeRef.objectId).toBe("DI_123");
            return {
              ok: true,
              value: {
                disputeRef: input.disputeRef,
                state: "ACCEPTED",
                openedAt: "2026-05-14T13:00:00.000Z",
                updatedAt: "2026-05-14T16:00:00.000Z",
              },
            };
          },
        }),
      ),
      resolveProviderContext: () => ({ provider: "finix", environment: "sandbox" }),
      now: () => "2026-05-14T16:00:00.000Z",
    });

    const result = await service.acceptDispute({
      environment: "sandbox",
      merchantAccountId: "merchant_123",
      disputeId: "dp_123",
    });

    expect(result.dispute.responseState).toBe("accepted");
    expect(result.dispute.evidenceStatus).toBe("accepted");
    expect(result.dispute.terminalSessionId).toBe("tcs_terminal_123");
    expect(result.dispute.terminalReaderId).toBe("tr_terminal_123");
    expect(result.action).toBe("accepted");
    expect(result.actionState).toBe("ACCEPTED");
  });

  test("creates, lists, submits evidence, and lists adjustment transfers with provider primitives", async () => {
    const evidenceRef = {
      provider: "finix",
      objectType: "dispute_evidence",
      objectId: "DE_123",
      relationship: "dispute_evidence",
      recordedAt: "2026-05-14T16:00:00.000Z",
    } as const;
    const fileRef = {
      provider: "finix",
      objectType: "file",
      objectId: "FILE_123",
      relationship: "dispute_file",
      recordedAt: "2026-05-14T15:00:00.000Z",
    } as const;
    const service = createDisputesService({
      uow: createUow([createDispute()], createMerchant()),
      providers: createProviderRegistry(
        createAdapter({
          async createDisputeEvidence(_context, input) {
            expect(input.fileRef.objectId).toBe("FILE_123");
            return {
              ok: true,
              value: {
                evidenceRef,
                disputeRef: input.disputeRef,
                fileRef: input.fileRef,
                state: "PENDING",
                createdAt: "2026-05-14T16:00:00.000Z",
                updatedAt: "2026-05-14T16:00:00.000Z",
              },
            };
          },
          async listDisputeEvidence(_context, input) {
            expect(input.disputeRef.objectId).toBe("DI_123");
            return {
              ok: true,
              value: {
                items: [
                  {
                    evidenceRef,
                    createdAt: "2026-05-14T16:00:00.000Z",
                    updatedAt: "2026-05-14T16:00:00.000Z",
                  },
                ],
              },
            };
          },
          async submitDisputeEvidence(_context, input) {
            expect(input.note).toBe("Receipt and fulfillment evidence attached.");
            return {
              ok: true,
              value: {
                evidenceRef,
                disputeRef: input.disputeRef,
                state: "SUBMITTED",
                createdAt: "2026-05-14T16:00:00.000Z",
                updatedAt: "2026-05-14T16:05:00.000Z",
              },
            };
          },
          async listDisputeAdjustments(_context, input) {
            expect(input.disputeRef.objectId).toBe("DI_123");
            return {
              ok: true,
              value: {
                items: [
                  {
                    adjustmentRef: {
                      provider: "finix",
                      objectType: "dispute_adjustment",
                      objectId: "TR_ADJ_123",
                      relationship: "dispute_adjustment",
                      recordedAt: "2026-05-14T16:10:00.000Z",
                    },
                    amount: 900,
                    currency: "USD",
                  },
                ],
              },
            };
          },
        }),
      ),
      resolveProviderContext: () => ({ provider: "finix", environment: "sandbox" }),
      now: () => "2026-05-14T16:05:00.000Z",
    });

    const created = await service.createDisputeEvidence({
      environment: "sandbox",
      merchantAccountId: "merchant_123",
      disputeId: "dp_123",
      fileRef,
    });
    const evidence = await service.listDisputeEvidence({
      environment: "sandbox",
      merchantAccountId: "merchant_123",
      disputeId: "dp_123",
    });
    const submitted = await service.submitDisputeEvidence({
      environment: "sandbox",
      merchantAccountId: "merchant_123",
      disputeId: "dp_123",
      note: "Receipt and fulfillment evidence attached.",
    });
    const adjustments = await service.listDisputeAdjustmentTransfers({
      environment: "sandbox",
      merchantAccountId: "merchant_123",
      disputeId: "dp_123",
    });

    expect(created.evidence.state).toBe("PENDING");
    expect(evidence.items).toHaveLength(1);
    expect(evidence.items[0]?.state).toBeUndefined();
    expect(submitted.dispute.responseState).toBe("responded");
    expect(adjustments.items[0]?.amount).toBe(900);
  });
});
