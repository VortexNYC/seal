import { describe, expect, test } from "vitest";
import type { MerchantAccountState, CustomerPaymentState } from "../../domain/state";
import type { PaymentsUnitOfWork } from "../../storage/unit-of-work";
import { createStateReader } from "./impl";

function createMemoryUnitOfWork(seed?: {
  merchantState?: MerchantAccountState;
  customerState?: CustomerPaymentState;
}): PaymentsUnitOfWork {
  const merchantStates = new Map<string, MerchantAccountState>();
  const customerStates = new Map<string, CustomerPaymentState>();

  if (seed?.merchantState) {
    merchantStates.set(
      `${seed.merchantState.environment}:${seed.merchantState.merchantAccountId}`,
      seed.merchantState,
    );
  }
  if (seed?.customerState) {
    customerStates.set(
      `${seed.customerState.environment}:${seed.customerState.merchantAccountId}:${seed.customerState.customerProfileId}`,
      seed.customerState,
    );
  }

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
      return work(this);
    },
  };
}

describe("createStateReader", () => {
  test("reads persisted merchant state", async () => {
    const reader = createStateReader({
      uow: createMemoryUnitOfWork({
        merchantState: {
          merchantAccountId: "merchant_123",
          environment: "sandbox",
          merchantStatus: "active",
          openRequirementIds: [],
          activeCapabilityKeys: [],
          restrictedCapabilityKeys: [],
          canAcceptPayments: true,
          payoutReadiness: "ready",
          capabilitySnapshots: [],
          generatedAt: "2026-04-23T12:00:00.000Z",
        },
      }),
    });

    const state = await reader.getMerchantAccountState({
      environment: "sandbox",
      merchantAccountId: "merchant_123",
    });

    expect(state).toMatchObject({ merchantStatus: "active", canAcceptPayments: true });
  });

  test("reads persisted merchant capabilities snapshot", async () => {
    const reader = createStateReader({
      uow: createMemoryUnitOfWork({
        merchantState: {
          merchantAccountId: "merchant_123",
          environment: "sandbox",
          merchantStatus: "active",
          openRequirementIds: [],
          activeCapabilityKeys: ["card_payments"],
          restrictedCapabilityKeys: ["payouts"],
          canAcceptPayments: true,
          payoutReadiness: "ready",
          capabilitySnapshots: [
            {
              id: "cap_123",
              environment: "sandbox",
              merchantAccountId: "merchant_123",
              capabilityKey: "card_payments",
              status: "active",
              effectiveAt: "2026-04-23T11:00:00.000Z",
              updatedByType: "system",
              processorRefs: [],
            },
          ],
          generatedAt: "2026-04-23T12:00:00.000Z",
        },
      }),
    });

    const state = await reader.getMerchantAccountCapabilities({
      environment: "sandbox",
      merchantAccountId: "merchant_123",
    });

    expect(state).toMatchObject({
      merchantAccountId: "merchant_123",
      activeCapabilityKeys: ["card_payments"],
      restrictedCapabilityKeys: ["payouts"],
      capabilities: [{ capabilityKey: "card_payments", status: "active" }],
    });
  });

  test("reads persisted customer payment state", async () => {
    const reader = createStateReader({
      uow: createMemoryUnitOfWork({
        customerState: {
          customerProfileId: "customer_123",
          merchantAccountId: "merchant_123",
          environment: "sandbox",
          defaultPaymentMethodId: "pm_123",
          activePaymentMethodIds: ["pm_123"],
          requiresActionPaymentIntentIds: [],
          latestPaymentIntentStatus: "captured",
          readiness: "ready",
          generatedAt: "2026-04-23T12:00:00.000Z",
        },
      }),
    });

    const state = await reader.getCustomerPaymentState({
      environment: "sandbox",
      merchantAccountId: "merchant_123",
      customerProfileId: "customer_123",
    });

    expect(state).toMatchObject({ defaultPaymentMethodId: "pm_123", readiness: "ready" });
  });
});
