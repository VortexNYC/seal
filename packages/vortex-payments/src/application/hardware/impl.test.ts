import { describe, expect, test } from "vitest";
import type {
  MerchantAccount,
  MerchantAccountState,
  PaymentHardwareOrder,
  PaymentHardwareReturn,
  PaymentHardwareSku,
  PaymentsUnitOfWork,
} from "../..";
import { createPaymentHardwareService, PaymentHardwareServiceError } from "./impl";

const now = "2026-06-05T23:00:00.000Z";

function createUow() {
  const skus = new Map<string, PaymentHardwareSku>();
  const orders = new Map<string, PaymentHardwareOrder>();
  const returns = new Map<string, PaymentHardwareReturn>();
  const idempotency = new Map<string, Parameters<PaymentsUnitOfWork["idempotency"]["save"]>[0]>();
  const merchant: MerchantAccount = {
    id: "macc_hardware",
    environment: "sandbox",
    tenantId: "org_hardware",
    displayName: "Hardware Merchant",
    legalEntityType: "business",
    country: "USA",
    merchantMode: "processing",
    defaultCurrency: "USD",
    status: "active",
    capabilityStatus: "enabled",
    processorAccountRefs: [],
    createdAt: now,
    updatedAt: now,
  };
  const merchantState: MerchantAccountState = {
    environment: "sandbox",
    merchantAccountId: merchant.id,
    merchantStatus: "active",
    canAcceptPayments: true,
    payoutReadiness: "ready",
    openRequirementIds: [],
    activeCapabilityKeys: [],
    restrictedCapabilityKeys: [],
    capabilitySnapshots: [],
    generatedAt: now,
  };

  const uow: PaymentsUnitOfWork = {
    merchants: {
      async getById(id, options) {
        return id === merchant.id && options.environment === merchant.environment ? merchant : null;
      },
      async listByTenant() {
        return [merchant];
      },
      async getByProcessorRef() {
        return null;
      },
      async save() {},
    },
    merchantStates: {
      async getByMerchantAccountId(id, options) {
        return id === merchant.id && options.environment === merchant.environment
          ? merchantState
          : null;
      },
      async save() {},
    },
    paymentHardwareSkus: {
      async getById(id, options) {
        const record = skus.get(id) ?? null;
        return record?.environment === options.environment ? record : null;
      },
      async getBySkuCode(environment, skuCode) {
        return (
          [...skus.values()].find(
            (record) => record.environment === environment && record.skuCode === skuCode,
          ) ?? null
        );
      },
      async list(environment) {
        return [...skus.values()].filter((record) => record.environment === environment);
      },
      async save(record) {
        skus.set(record.id, record);
      },
    },
    paymentHardwareOrders: {
      async getById(id, options) {
        const record = orders.get(id) ?? null;
        return record?.environment === options.environment ? record : null;
      },
      async listByMerchant(environment, merchantAccountId) {
        return [...orders.values()].filter(
          (record) =>
            record.environment === environment && record.merchantAccountId === merchantAccountId,
        );
      },
      async save(record) {
        orders.set(record.id, record);
      },
    },
    paymentHardwareReturns: {
      async listByOrder(environment, orderId) {
        return [...returns.values()].filter(
          (record) => record.environment === environment && record.orderId === orderId,
        );
      },
      async save(record) {
        returns.set(record.id, record);
      },
    },
    idempotency: {
      async getByScopeAndKey(environment, scope, idempotencyKey) {
        return idempotency.get(`${environment}:${scope}:${idempotencyKey}`) ?? null;
      },
      async save(record) {
        idempotency.set(`${record.environment}:${record.scope}:${record.idempotencyKey}`, record);
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
    async runInTransaction(work) {
      return work(uow);
    },
  };

  return { uow, skus, orders, returns };
}

async function seedSku(uow: PaymentsUnitOfWork, status: "active" | "inactive" = "active") {
  const service = createPaymentHardwareService({
    uow,
    now: () => now,
    createId: (prefix) => `${prefix}_seed`,
  });
  return service.upsertSku({
    environment: "sandbox",
    skuCode: "PAX_D135",
    displayName: "Pax D135",
    deviceType: "pin_pad",
    status,
    unitAmount: 9900,
    currency: "USD",
  });
}

describe("payment hardware service", () => {
  test("creates provider-action-required Vortex hardware orders without leaking Finix ids", async () => {
    const { uow } = createUow();
    const sku = await seedSku(uow);
    const service = createPaymentHardwareService({
      uow,
      now: () => now,
      createId: (prefix) => `${prefix}_1`,
    });

    const order = await service.createOrder({
      environment: "sandbox",
      merchantAccountId: "macc_hardware",
      lines: [{ skuId: sku.id, quantity: 2 }],
      shippingAddress: {
        line1: "1 Hardware Way",
        city: "New York",
        region: "NY",
        postalCode: "10001",
        country: "USA",
      },
      contactEmail: "ops@vortex.test",
      idempotencyKey: "idem_order",
    });

    expect(order.id).toBe("phord_1");
    expect(order.status).toBe("provider_action_required");
    expect(order.nextAction).toBe("place_provider_order");
    expect(order.providerAction).toEqual({
      rail: "finix_device_store",
      action: "place_order_in_provider_portal",
      reason:
        "Finix production device ordering is dashboard-managed, sandbox ordering is not replicable, and there is no customer-facing device store.",
    });
    expect(JSON.stringify(order)).not.toContain("device_order");
  });

  test("replays matching order idempotency and rejects changed requests", async () => {
    const { uow } = createUow();
    const sku = await seedSku(uow);
    const service = createPaymentHardwareService({
      uow,
      now: () => now,
      createId: (prefix) => `${prefix}_idem`,
    });
    const command = {
      environment: "sandbox" as const,
      merchantAccountId: "macc_hardware",
      lines: [{ skuId: sku.id, quantity: 1 }],
      shippingAddress: {
        line1: "1 Hardware Way",
        city: "New York",
        region: "NY",
        postalCode: "10001",
        country: "USA",
      },
      idempotencyKey: "idem_order",
    };

    const first = await service.createOrder(command);
    const second = await service.createOrder(command);
    expect(second).toEqual(first);

    await expect(
      service.createOrder({ ...command, lines: [{ skuId: sku.id, quantity: 2 }] }),
    ).rejects.toMatchObject({
      code: "conflict",
    });
  });

  test("blocks inactive hardware SKUs before order creation", async () => {
    const { uow } = createUow();
    const sku = await seedSku(uow, "inactive");
    const service = createPaymentHardwareService({ uow, now: () => now });

    await expect(
      service.previewOrder({
        environment: "sandbox",
        merchantAccountId: "macc_hardware",
        lines: [{ skuId: sku.id, quantity: 1 }],
        shippingAddress: {
          line1: "1 Hardware Way",
          city: "New York",
          region: "NY",
          postalCode: "10001",
          country: "USA",
        },
      }),
    ).rejects.toMatchObject({
      code: "action_required",
      details: { nextAction: "select_active_sku" },
    });
  });

  test("cancels provider-action-required orders locally without provider ids", async () => {
    const { uow } = createUow();
    const sku = await seedSku(uow);
    const service = createPaymentHardwareService({
      uow,
      now: () => now,
      createId: (prefix) => `${prefix}_cancel`,
    });
    const order = await service.createOrder({
      environment: "sandbox",
      merchantAccountId: "macc_hardware",
      lines: [{ skuId: sku.id, quantity: 1 }],
      shippingAddress: {
        line1: "1 Hardware Way",
        city: "New York",
        region: "NY",
        postalCode: "10001",
        country: "USA",
      },
    });

    const canceled = await service.cancelOrder({
      environment: "sandbox",
      merchantAccountId: "macc_hardware",
      orderId: order.id,
      reason: "merchant requested cancellation",
    });

    expect(canceled.status).toBe("canceled");
    expect(canceled.nextAction).toBe("none");
    expect(canceled.providerAction).toBeUndefined();
  });

  test("blocks cancellation after shipment", async () => {
    const { uow, orders } = createUow();
    const sku = await seedSku(uow);
    orders.set("phord_shipped", {
      id: "phord_shipped",
      environment: "sandbox",
      merchantAccountId: "macc_hardware",
      status: "shipped",
      lines: [{ skuId: sku.id, quantity: 1, unitAmount: 9900, currency: "USD" }],
      shippingAddress: {
        line1: "1 Hardware Way",
        city: "New York",
        region: "NY",
        postalCode: "10001",
        country: "USA",
      },
      shipment: {
        status: "shipped",
        carrier: "ups",
        trackingNumberMasked: "****1234",
        shippedAt: now,
      },
      processorRefs: [],
      createdAt: now,
      updatedAt: now,
    });
    const service = createPaymentHardwareService({ uow, now: () => now });

    await expect(
      service.cancelOrder({
        environment: "sandbox",
        merchantAccountId: "macc_hardware",
        orderId: "phord_shipped",
        reason: "too late",
      }),
    ).rejects.toBeInstanceOf(PaymentHardwareServiceError);
  });
});
