import { describe, expect, test } from "vitest";
import type { Payout, Settlement } from "../../domain/funds";
import type { Dispute } from "../../domain/disputes";
import type {
  MerchantAccount,
  MerchantOnboardingSession,
  MerchantRequirement,
} from "../../domain/merchant";
import type { Payment, PaymentIntent, Refund } from "../../domain/payments";
import type { PaymentMethod } from "../../domain/payment-methods";
import type { CustomerPaymentState } from "../../domain/state";
import type { MerchantAccountState } from "../../domain/state";
import type { CanonicalDomainEvent } from "../../events/types";
import type { IdempotencyRecord } from "../../storage/repositories";
import type { PaymentsUnitOfWork } from "../../storage/unit-of-work";
import { createCanonicalEventsService } from "./impl";

interface SeedRecord {
  readonly environment: string;
  readonly id: string;
}

interface MemoryUnitOfWorkSeed {
  merchant?: MerchantAccount;
  session?: MerchantOnboardingSession;
  requirement?: MerchantRequirement;
  paymentIntent?: PaymentIntent;
  payment?: Payment;
  refund?: Refund;
  settlement?: Settlement;
  payout?: Payout;
  dispute?: Dispute;
}

function seedById<TRecord extends SeedRecord>(
  records: Map<string, TRecord>,
  record: TRecord | undefined,
): void {
  if (!record) {
    return;
  }
  records.set(`${record.environment}:${record.id}`, record);
}

function seedMemoryUnitOfWorkMaps(input: {
  readonly seed: MemoryUnitOfWorkSeed | undefined;
  readonly merchants: Map<string, MerchantAccount>;
  readonly sessions: Map<string, MerchantOnboardingSession>;
  readonly requirements: Map<string, MerchantRequirement>;
  readonly paymentIntents: Map<string, PaymentIntent>;
  readonly payments: Map<string, Payment>;
  readonly refunds: Map<string, Refund>;
  readonly settlements: Map<string, Settlement>;
  readonly payouts: Map<string, Payout>;
  readonly disputes: Map<string, Dispute>;
}): void {
  seedById(input.merchants, input.seed?.merchant);
  seedById(input.sessions, input.seed?.session);
  seedById(input.requirements, input.seed?.requirement);
  seedById(input.paymentIntents, input.seed?.paymentIntent);
  seedById(input.payments, input.seed?.payment);
  seedById(input.refunds, input.seed?.refund);
  seedById(input.settlements, input.seed?.settlement);
  seedById(input.payouts, input.seed?.payout);
  seedById(input.disputes, input.seed?.dispute);
}

function createMemoryUnitOfWork(seed?: MemoryUnitOfWorkSeed): PaymentsUnitOfWork {
  const merchants = new Map<string, MerchantAccount>();
  const sessions = new Map<string, MerchantOnboardingSession>();
  const requirements = new Map<string, MerchantRequirement>();
  const paymentIntents = new Map<string, PaymentIntent>();
  const payments = new Map<string, Payment>();
  const refunds = new Map<string, Refund>();
  const settlements = new Map<string, Settlement>();
  const payouts = new Map<string, Payout>();
  const paymentMethods = new Map<string, PaymentMethod>();
  const disputes = new Map<string, Dispute>();
  const merchantStates = new Map<string, MerchantAccountState>();
  const customerStates = new Map<string, CustomerPaymentState>();
  const idempotency = new Map<string, IdempotencyRecord>();

  seedMemoryUnitOfWorkMaps({
    seed,
    merchants,
    sessions,
    requirements,
    paymentIntents,
    payments,
    refunds,
    settlements,
    payouts,
    disputes,
  });

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
      async getSessionById(id, options) {
        return sessions.get(`${options.environment}:${id}`) ?? null;
      },
      async getLatestSessionByMerchantAccountId(merchantAccountId, options) {
        return (
          Array.from(sessions.values())
            .filter(
              (session) =>
                session.environment === options.environment &&
                session.merchantAccountId === merchantAccountId,
            )
            .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null
        );
      },
      async listRequirementsForSession(onboardingSessionId, options) {
        return Array.from(requirements.values()).filter(
          (requirement) =>
            requirement.environment === options.environment &&
            requirement.onboardingSessionId === onboardingSessionId,
        );
      },
      async listDocumentsForRequirement() {
        return [];
      },
      async saveSession(record) {
        sessions.set(`${record.environment}:${record.id}`, record);
      },
      async saveRequirement(record) {
        requirements.set(`${record.environment}:${record.id}`, record);
      },
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
        return paymentMethods.get(`${options.environment}:${id}`) ?? null;
      },
      async getByProcessorRef(environment, provider, objectType, objectId) {
        return (
          Array.from(paymentMethods.values()).find(
            (record) =>
              record.environment === environment &&
              record.processorInstrumentRefs.some(
                (ref) =>
                  ref.provider === provider &&
                  ref.objectType === objectType &&
                  ref.objectId === objectId,
              ),
          ) ?? null
        );
      },
      async listByOwner(environment, ownerType, ownerId) {
        return Array.from(paymentMethods.values()).filter(
          (record) =>
            record.environment === environment &&
            record.ownerType === ownerType &&
            record.ownerId === ownerId,
        );
      },
      async save(record) {
        paymentMethods.set(`${record.environment}:${record.id}`, record);
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
      async getById(id, options) {
        return refunds.get(`${options.environment}:${id}`) ?? null;
      },
      async getByProcessorRef(environment, provider, objectType, objectId) {
        return (
          Array.from(refunds.values()).find(
            (record) =>
              record.environment === environment &&
              record.processorRefundRefs.some(
                (ref) =>
                  ref.provider === provider &&
                  ref.objectType === objectType &&
                  ref.objectId === objectId,
              ),
          ) ?? null
        );
      },
      async listByPayment(environment, paymentId) {
        return Array.from(refunds.values()).filter(
          (record) => record.environment === environment && record.paymentId === paymentId,
        );
      },
      async save(record) {
        refunds.set(`${record.environment}:${record.id}`, record);
      },
    },
    settlements: {
      async getById(id, options) {
        return settlements.get(`${options.environment}:${id}`) ?? null;
      },
      async getByProcessorRef(environment, provider, objectType, objectId) {
        return (
          Array.from(settlements.values()).find(
            (record) =>
              record.environment === environment &&
              record.processorRefs.some(
                (ref) =>
                  ref.provider === provider &&
                  ref.objectType === objectType &&
                  ref.objectId === objectId,
              ),
          ) ?? null
        );
      },
      async listByMerchant(environment, merchantAccountId) {
        return Array.from(settlements.values()).filter(
          (record) =>
            record.environment === environment && record.merchantAccountId === merchantAccountId,
        );
      },
      async save(record) {
        settlements.set(`${record.environment}:${record.id}`, record);
      },
    },
    payouts: {
      async getById(id, options) {
        return payouts.get(`${options.environment}:${id}`) ?? null;
      },
      async getByProcessorRef(environment, provider, objectType, objectId) {
        return (
          Array.from(payouts.values()).find(
            (record) =>
              record.environment === environment &&
              record.processorRefs.some(
                (ref) =>
                  ref.provider === provider &&
                  ref.objectType === objectType &&
                  ref.objectId === objectId,
              ),
          ) ?? null
        );
      },
      async listByMerchant(environment, merchantAccountId) {
        return Array.from(payouts.values()).filter(
          (record) =>
            record.environment === environment && record.merchantAccountId === merchantAccountId,
        );
      },
      async save(record) {
        payouts.set(`${record.environment}:${record.id}`, record);
      },
    },
    disputes: {
      async getById(id, options) {
        return disputes.get(`${options.environment}:${id}`) ?? null;
      },
      async getByProcessorRef(environment, provider, objectType, objectId) {
        return (
          Array.from(disputes.values()).find(
            (record) =>
              record.environment === environment &&
              record.processorRefs.some(
                (ref) =>
                  ref.provider === provider &&
                  ref.objectType === objectType &&
                  ref.objectId === objectId,
              ),
          ) ?? null
        );
      },
      async listByMerchant(environment, merchantAccountId) {
        return Array.from(disputes.values()).filter(
          (record) =>
            record.environment === environment && record.merchantAccountId === merchantAccountId,
        );
      },
      async save(record) {
        disputes.set(`${record.environment}:${record.id}`, record);
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

describe("createCanonicalEventsService", () => {
  test("applies merchant event and recalculates merchant state", async () => {
    const uow = createMemoryUnitOfWork({
      merchant: {
        id: "merchant_123",
        environment: "sandbox",
        tenantId: "tenant_123",
        displayName: "Merchant",
        legalEntityType: "CORPORATION",
        country: "USA",
        merchantMode: "processing",
        defaultCurrency: "USD",
        status: "pending_review",
        capabilityStatus: "pending_review",
        processorAccountRefs: [
          {
            provider: "finix",
            objectType: "merchant",
            objectId: "mu_123",
            relationship: "merchant_account",
            recordedAt: "2026-04-23T00:00:00.000Z",
          },
        ],
        createdAt: "2026-04-23T00:00:00.000Z",
        updatedAt: "2026-04-23T00:00:00.000Z",
      },
      session: {
        id: "onb_123",
        environment: "sandbox",
        merchantAccountId: "merchant_123",
        status: "under_review",
        currentRequirementCount: 0,
        openRequirementCount: 0,
        processorRefs: [],
        createdAt: "2026-04-23T00:00:00.000Z",
        updatedAt: "2026-04-23T00:00:00.000Z",
      },
    });

    const service = createCanonicalEventsService({ uow });
    await service.applyCanonicalEvents([
      {
        id: "evt_1",
        environment: "sandbox",
        eventType: "merchant_account.approved",
        aggregateType: "merchant_account",
        aggregateId: "mu_123",
        occurredAt: "2026-04-23T12:00:00.000Z",
        sourceProvider: "finix",
        payload: { objectType: "merchant" },
        createdAt: "2026-04-23T12:00:00.000Z",
      } satisfies CanonicalDomainEvent,
    ]);

    const merchant = await uow.merchants.getById("merchant_123", { environment: "sandbox" });
    expect(merchant?.status).toBe("active");
    const state = await uow.merchantStates.getByMerchantAccountId("merchant_123", {
      environment: "sandbox",
    });
    expect(state).toMatchObject({
      merchantStatus: "active",
      canAcceptPayments: true,
      onboardingStatus: "approved",
    });
  });

  test("applies merchant restricted event and pauses merchant state", async () => {
    const uow = createMemoryUnitOfWork({
      merchant: {
        id: "merchant_restricted_123",
        environment: "sandbox",
        tenantId: "tenant_123",
        displayName: "Restricted Merchant",
        legalEntityType: "company",
        country: "US",
        merchantMode: "processing",
        defaultCurrency: "USD",
        status: "active",
        capabilityStatus: "active",
        processorAccountRefs: [
          {
            provider: "finix",
            objectType: "merchant",
            objectId: "mu_restricted_123",
            relationship: "merchant_account",
            recordedAt: "2026-04-23T00:00:00.000Z",
          },
        ],
        createdAt: "2026-04-23T00:00:00.000Z",
        updatedAt: "2026-04-23T00:00:00.000Z",
      },
      session: {
        id: "onb_restricted_123",
        environment: "sandbox",
        merchantAccountId: "merchant_restricted_123",
        status: "approved",
        approvedAt: "2026-04-23T10:00:00.000Z",
        currentRequirementCount: 0,
        openRequirementCount: 0,
        processorRefs: [],
        createdAt: "2026-04-23T00:00:00.000Z",
        updatedAt: "2026-04-23T10:00:00.000Z",
      },
    });

    const service = createCanonicalEventsService({ uow });
    await service.applyCanonicalEvents([
      {
        id: "evt_restricted_1",
        environment: "sandbox",
        eventType: "merchant_account.restricted",
        aggregateType: "merchant_account",
        aggregateId: "mu_restricted_123",
        occurredAt: "2026-04-23T12:00:00.000Z",
        sourceProvider: "finix",
        payload: { objectType: "merchant" },
        createdAt: "2026-04-23T12:00:00.000Z",
      } satisfies CanonicalDomainEvent,
    ]);

    const merchant = await uow.merchants.getById("merchant_restricted_123", {
      environment: "sandbox",
    });
    expect(merchant).toMatchObject({ status: "restricted" });

    const session = await uow.onboarding.getSessionById("onb_restricted_123", {
      environment: "sandbox",
    });
    expect(session).toMatchObject({ status: "restricted" });

    const state = await uow.merchantStates.getByMerchantAccountId("merchant_restricted_123", {
      environment: "sandbox",
    });
    expect(state).toMatchObject({
      merchantStatus: "restricted",
      onboardingStatus: "restricted",
      canAcceptPayments: false,
      payoutReadiness: "paused",
      payoutBlockReason: "merchant_status:restricted",
    });
  });

  test("applies merchant rejected event and blocks merchant state", async () => {
    const uow = createMemoryUnitOfWork({
      merchant: {
        id: "merchant_rejected_123",
        environment: "sandbox",
        tenantId: "tenant_123",
        displayName: "Rejected Merchant",
        legalEntityType: "company",
        country: "US",
        merchantMode: "processing",
        defaultCurrency: "USD",
        status: "active",
        capabilityStatus: "active",
        processorAccountRefs: [
          {
            provider: "finix",
            objectType: "merchant",
            objectId: "mu_rejected_123",
            relationship: "merchant_account",
            recordedAt: "2026-04-23T00:00:00.000Z",
          },
        ],
        createdAt: "2026-04-23T00:00:00.000Z",
        updatedAt: "2026-04-23T00:00:00.000Z",
      },
      session: {
        id: "onb_rejected_123",
        environment: "sandbox",
        merchantAccountId: "merchant_rejected_123",
        status: "approved",
        approvedAt: "2026-04-23T10:00:00.000Z",
        currentRequirementCount: 0,
        openRequirementCount: 0,
        processorRefs: [],
        createdAt: "2026-04-23T00:00:00.000Z",
        updatedAt: "2026-04-23T10:00:00.000Z",
      },
    });

    const service = createCanonicalEventsService({ uow });
    await service.applyCanonicalEvents([
      {
        id: "evt_rejected_1",
        environment: "sandbox",
        eventType: "merchant_account.rejected",
        aggregateType: "merchant_account",
        aggregateId: "mu_rejected_123",
        occurredAt: "2026-04-23T12:00:00.000Z",
        sourceProvider: "finix",
        payload: { objectType: "merchant" },
        createdAt: "2026-04-23T12:00:00.000Z",
      } satisfies CanonicalDomainEvent,
    ]);

    const merchant = await uow.merchants.getById("merchant_rejected_123", {
      environment: "sandbox",
    });
    expect(merchant).toMatchObject({ status: "rejected" });

    const session = await uow.onboarding.getSessionById("onb_rejected_123", {
      environment: "sandbox",
    });
    expect(session).toMatchObject({ status: "rejected", rejectedAt: "2026-04-23T12:00:00.000Z" });

    const state = await uow.merchantStates.getByMerchantAccountId("merchant_rejected_123", {
      environment: "sandbox",
    });
    expect(state).toMatchObject({
      merchantStatus: "rejected",
      onboardingStatus: "rejected",
      canAcceptPayments: false,
      payoutReadiness: "blocked",
      payoutBlockReason: "merchant_status:rejected",
    });
  });

  test("applies payment event to payment intent by processor ref", async () => {
    const uow = createMemoryUnitOfWork({
      paymentIntent: {
        id: "pi_123",
        environment: "sandbox",
        merchantAccountId: "merchant_123",
        amount: 500,
        currency: "USD",
        captureMode: "automatic",
        status: "pending",
        processorIntentRefs: [
          {
            provider: "finix",
            objectType: "transfer",
            objectId: "tr_123",
            relationship: "payment_intent",
            recordedAt: "2026-04-23T00:00:00.000Z",
          },
        ],
        createdAt: "2026-04-23T00:00:00.000Z",
        updatedAt: "2026-04-23T00:00:00.000Z",
      },
    });

    const service = createCanonicalEventsService({ uow });
    await service.applyCanonicalEvents([
      {
        id: "evt_2",
        environment: "sandbox",
        eventType: "payment.captured",
        aggregateType: "payment",
        aggregateId: "tr_123",
        occurredAt: "2026-04-23T12:00:00.000Z",
        sourceProvider: "finix",
        payload: { objectType: "transfer" },
        createdAt: "2026-04-23T12:00:00.000Z",
      } satisfies CanonicalDomainEvent,
    ]);

    const record = await uow.paymentIntents.getById("pi_123", { environment: "sandbox" });
    expect(record).toMatchObject({ status: "captured", confirmedAt: "2026-04-23T12:00:00.000Z" });
  });

  test("applies canceled payment event to payment intent by processor ref", async () => {
    const uow = createMemoryUnitOfWork({
      paymentIntent: {
        id: "pi_cancel_123",
        environment: "sandbox",
        merchantAccountId: "merchant_123",
        amount: 500,
        currency: "USD",
        captureMode: "manual",
        status: "authorized",
        confirmedAt: "2026-04-23T11:00:00.000Z",
        processorIntentRefs: [
          {
            provider: "finix",
            objectType: "authorization",
            objectId: "auth_123",
            relationship: "payment_intent",
            recordedAt: "2026-04-23T00:00:00.000Z",
          },
        ],
        createdAt: "2026-04-23T00:00:00.000Z",
        updatedAt: "2026-04-23T11:00:00.000Z",
      },
    });

    const service = createCanonicalEventsService({ uow });
    await service.applyCanonicalEvents([
      {
        id: "evt_cancel_123",
        environment: "sandbox",
        eventType: "payment.canceled",
        aggregateType: "payment",
        aggregateId: "auth_123",
        occurredAt: "2026-04-23T12:00:00.000Z",
        sourceProvider: "finix",
        payload: { objectType: "authorization" },
        createdAt: "2026-04-23T12:00:00.000Z",
      } satisfies CanonicalDomainEvent,
    ]);

    const record = await uow.paymentIntents.getById("pi_cancel_123", { environment: "sandbox" });
    expect(record).toMatchObject({
      status: "canceled",
      canceledAt: "2026-04-23T12:00:00.000Z",
      updatedAt: "2026-04-23T12:00:00.000Z",
    });
  });

  test("does not regress terminal payment intent status on out-of-order event", async () => {
    const uow = createMemoryUnitOfWork({
      paymentIntent: {
        id: "pi_terminal_123",
        environment: "sandbox",
        merchantAccountId: "merchant_123",
        amount: 500,
        currency: "USD",
        captureMode: "manual",
        status: "canceled",
        canceledAt: "2026-04-23T11:00:00.000Z",
        processorIntentRefs: [
          {
            provider: "finix",
            objectType: "authorization",
            objectId: "auth_terminal_123",
            relationship: "payment_intent",
            recordedAt: "2026-04-23T00:00:00.000Z",
          },
        ],
        createdAt: "2026-04-23T00:00:00.000Z",
        updatedAt: "2026-04-23T11:00:00.000Z",
      },
    });

    const service = createCanonicalEventsService({ uow });
    await service.applyCanonicalEvents([
      {
        id: "evt_authorized_old_123",
        environment: "sandbox",
        eventType: "payment.authorized",
        aggregateType: "payment",
        aggregateId: "auth_terminal_123",
        occurredAt: "2026-04-23T10:00:00.000Z",
        sourceProvider: "finix",
        payload: { objectType: "authorization" },
        createdAt: "2026-04-23T10:00:00.000Z",
      } satisfies CanonicalDomainEvent,
    ]);

    const record = await uow.paymentIntents.getById("pi_terminal_123", { environment: "sandbox" });
    expect(record).toMatchObject({
      status: "canceled",
      canceledAt: "2026-04-23T11:00:00.000Z",
      updatedAt: "2026-04-23T11:00:00.000Z",
    });
  });

  test("applies archived payment method event by processor ref", async () => {
    const uow = createMemoryUnitOfWork({
      paymentIntent: {
        id: "pi_123",
        environment: "sandbox",
        merchantAccountId: "merchant_123",
        customerProfileId: "customer_123",
        amount: 500,
        currency: "USD",
        captureMode: "automatic",
        status: "requires_action",
        processorIntentRefs: [],
        createdAt: "2026-04-23T00:00:00.000Z",
        updatedAt: "2026-04-23T00:00:00.000Z",
      },
    });

    await uow.paymentMethods.save({
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
          objectId: "pi_method_123",
          relationship: "payment_method",
          recordedAt: "2026-04-23T00:00:00.000Z",
        },
      ],
      createdAt: "2026-04-23T00:00:00.000Z",
      updatedAt: "2026-04-23T00:00:00.000Z",
    });

    await uow.paymentMethods.save({
      id: "pm_456",
      environment: "sandbox",
      merchantAccountId: "merchant_123",
      ownerType: "customer",
      ownerId: "customer_123",
      methodType: "card",
      status: "active",
      isDefault: false,
      processorInstrumentRefs: [
        {
          provider: "finix",
          objectType: "payment_instrument",
          objectId: "pi_method_456",
          relationship: "payment_method",
          recordedAt: "2026-04-23T00:00:00.000Z",
        },
      ],
      createdAt: "2026-04-23T00:00:00.000Z",
      updatedAt: "2026-04-23T00:00:00.000Z",
    });

    const service = createCanonicalEventsService({ uow });
    await service.applyCanonicalEvents([
      {
        id: "evt_pm",
        environment: "sandbox",
        eventType: "payment_method.updated",
        aggregateType: "payment_method",
        aggregateId: "pi_method_123",
        occurredAt: "2026-04-23T12:00:00.000Z",
        sourceProvider: "finix",
        payload: { objectType: "payment_instrument", enabled: false, disabled_code: "ARCHIVED" },
        createdAt: "2026-04-23T12:00:00.000Z",
      } satisfies CanonicalDomainEvent,
    ]);

    const record = await uow.paymentMethods.getById("pm_123", { environment: "sandbox" });
    expect(record).toMatchObject({
      status: "archived",
      isDefault: false,
      archivedAt: "2026-04-23T12:00:00.000Z",
    });

    const fallback = await uow.paymentMethods.getById("pm_456", { environment: "sandbox" });
    expect(fallback).toMatchObject({ isDefault: true });

    const customerState = await uow.customerStates.getByMerchantAndCustomer(
      "sandbox",
      "merchant_123",
      "customer_123",
    );
    expect(customerState).toMatchObject({
      defaultPaymentMethodId: "pm_456",
      activePaymentMethodIds: ["pm_456"],
      readiness: "action_required",
    });
  });

  test("applies disabled payment method event by processor ref", async () => {
    const uow = createMemoryUnitOfWork();

    await uow.paymentMethods.save({
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
          objectId: "pi_method_123",
          relationship: "payment_method",
          recordedAt: "2026-04-23T00:00:00.000Z",
        },
      ],
      createdAt: "2026-04-23T00:00:00.000Z",
      updatedAt: "2026-04-23T00:00:00.000Z",
    });

    await uow.paymentMethods.save({
      id: "pm_456",
      environment: "sandbox",
      merchantAccountId: "merchant_123",
      ownerType: "customer",
      ownerId: "customer_123",
      methodType: "card",
      status: "active",
      isDefault: false,
      processorInstrumentRefs: [
        {
          provider: "finix",
          objectType: "payment_instrument",
          objectId: "pi_method_456",
          relationship: "payment_method",
          recordedAt: "2026-04-23T00:00:00.000Z",
        },
      ],
      createdAt: "2026-04-23T00:00:00.000Z",
      updatedAt: "2026-04-23T00:00:00.000Z",
    });

    const service = createCanonicalEventsService({ uow });
    await service.applyCanonicalEvents([
      {
        id: "evt_pm_disabled",
        environment: "sandbox",
        eventType: "payment_method.updated",
        aggregateType: "payment_method",
        aggregateId: "pi_method_123",
        occurredAt: "2026-04-23T12:00:00.000Z",
        sourceProvider: "finix",
        payload: { objectType: "payment_instrument", enabled: false },
        createdAt: "2026-04-23T12:00:00.000Z",
      } satisfies CanonicalDomainEvent,
    ]);

    const record = await uow.paymentMethods.getById("pm_123", { environment: "sandbox" });
    expect(record).toMatchObject({ status: "disabled", isDefault: false, archivedAt: undefined });

    const fallback = await uow.paymentMethods.getById("pm_456", { environment: "sandbox" });
    expect(fallback).toMatchObject({ isDefault: true });

    const customerState = await uow.customerStates.getByMerchantAndCustomer(
      "sandbox",
      "merchant_123",
      "customer_123",
    );
    expect(customerState).toMatchObject({
      defaultPaymentMethodId: "pm_456",
      activePaymentMethodIds: ["pm_456"],
      readiness: "ready",
    });
  });

  test("applies refund event to refund by processor ref", async () => {
    const uow = createMemoryUnitOfWork({
      payment: {
        id: "payment_123",
        environment: "sandbox",
        merchantAccountId: "merchant_123",
        amount: 500,
        currency: "USD",
        status: "captured",
        direction: "debit",
        processorPaymentRefs: [
          {
            provider: "finix",
            objectType: "transfer",
            objectId: "tr_123",
            relationship: "payment",
            recordedAt: "2026-04-23T00:00:00.000Z",
          },
        ],
        createdAt: "2026-04-23T00:00:00.000Z",
        updatedAt: "2026-04-23T00:00:00.000Z",
      },
      refund: {
        id: "refund_123",
        environment: "sandbox",
        merchantAccountId: "merchant_123",
        paymentId: "payment_123",
        amount: 100,
        currency: "USD",
        status: "pending",
        reason: "customer_request",
        requestedByType: "operator",
        requestedByRef: "user_123",
        processorRefundRefs: [
          {
            provider: "finix",
            objectType: "transfer",
            objectId: "rf_123",
            relationship: "refund",
            recordedAt: "2026-04-23T00:00:00.000Z",
          },
        ],
        createdAt: "2026-04-23T00:00:00.000Z",
        updatedAt: "2026-04-23T00:00:00.000Z",
      },
    });

    const service = createCanonicalEventsService({ uow });
    await service.applyCanonicalEvents([
      {
        id: "evt_3",
        environment: "sandbox",
        eventType: "refund.succeeded",
        aggregateType: "refund",
        aggregateId: "rf_123",
        occurredAt: "2026-04-23T12:00:00.000Z",
        sourceProvider: "finix",
        payload: { objectType: "transfer" },
        createdAt: "2026-04-23T12:00:00.000Z",
      } satisfies CanonicalDomainEvent,
    ]);

    const record = await uow.refunds.getById("refund_123", { environment: "sandbox" });
    expect(record).toMatchObject({ status: "succeeded", updatedAt: "2026-04-23T12:00:00.000Z" });

    const payment = await uow.payments.getById("payment_123", { environment: "sandbox" });
    expect(payment).toMatchObject({
      status: "refunded_partial",
      updatedAt: "2026-04-23T12:00:00.000Z",
    });
  });

  test("does not regress terminal refund status on out-of-order event", async () => {
    const uow = createMemoryUnitOfWork({
      payment: {
        id: "payment_terminal_123",
        environment: "sandbox",
        merchantAccountId: "merchant_123",
        amount: 100,
        currency: "USD",
        status: "refunded_full",
        direction: "debit",
        processorPaymentRefs: [
          {
            provider: "finix",
            objectType: "transfer",
            objectId: "tr_terminal_123",
            relationship: "payment",
            recordedAt: "2026-04-23T00:00:00.000Z",
          },
        ],
        createdAt: "2026-04-23T00:00:00.000Z",
        updatedAt: "2026-04-23T11:00:00.000Z",
      },
      refund: {
        id: "refund_terminal_123",
        environment: "sandbox",
        merchantAccountId: "merchant_123",
        paymentId: "payment_terminal_123",
        amount: 100,
        currency: "USD",
        status: "succeeded",
        reason: "customer_request",
        requestedByType: "operator",
        requestedByRef: "user_123",
        processorRefundRefs: [
          {
            provider: "finix",
            objectType: "transfer",
            objectId: "rf_terminal_123",
            relationship: "refund",
            recordedAt: "2026-04-23T00:00:00.000Z",
          },
        ],
        createdAt: "2026-04-23T00:00:00.000Z",
        updatedAt: "2026-04-23T11:00:00.000Z",
      },
    });

    const service = createCanonicalEventsService({ uow });
    await service.applyCanonicalEvents([
      {
        id: "evt_refund_old_pending",
        environment: "sandbox",
        eventType: "refund.created",
        aggregateType: "refund",
        aggregateId: "rf_terminal_123",
        occurredAt: "2026-04-23T10:00:00.000Z",
        sourceProvider: "finix",
        payload: { objectType: "transfer" },
        createdAt: "2026-04-23T10:00:00.000Z",
      } satisfies CanonicalDomainEvent,
    ]);

    const record = await uow.refunds.getById("refund_terminal_123", { environment: "sandbox" });
    expect(record).toMatchObject({ status: "succeeded", updatedAt: "2026-04-23T11:00:00.000Z" });

    const payment = await uow.payments.getById("payment_terminal_123", { environment: "sandbox" });
    expect(payment).toMatchObject({
      status: "refunded_full",
      updatedAt: "2026-04-23T11:00:00.000Z",
    });
  });

  test("applies replayed refund event after initial missing-row no-op", async () => {
    const uow = createMemoryUnitOfWork({
      payment: {
        id: "payment_replay_123",
        environment: "sandbox",
        merchantAccountId: "merchant_123",
        amount: 100,
        currency: "USD",
        status: "captured",
        direction: "debit",
        processorPaymentRefs: [
          {
            provider: "finix",
            objectType: "transfer",
            objectId: "tr_replay_123",
            relationship: "payment",
            recordedAt: "2026-04-23T00:00:00.000Z",
          },
        ],
        createdAt: "2026-04-23T00:00:00.000Z",
        updatedAt: "2026-04-23T00:00:00.000Z",
      },
    });

    const service = createCanonicalEventsService({ uow });
    const event = {
      id: "evt_refund_replay_123",
      environment: "sandbox",
      eventType: "refund.succeeded",
      aggregateType: "refund",
      aggregateId: "rf_replay_provider_123",
      occurredAt: "2026-04-23T12:00:00.000Z",
      sourceProvider: "finix",
      payload: { objectType: "transfer" },
      createdAt: "2026-04-23T12:00:00.000Z",
    } satisfies CanonicalDomainEvent;

    await service.applyCanonicalEvents([event]);
    expect(await uow.refunds.getById("refund_replay_123", { environment: "sandbox" })).toBeNull();

    await uow.refunds.save({
      id: "refund_replay_123",
      environment: "sandbox",
      merchantAccountId: "merchant_123",
      paymentId: "payment_replay_123",
      amount: 100,
      currency: "USD",
      status: "pending",
      reason: "customer_request",
      requestedByType: "operator",
      requestedByRef: "user_123",
      processorRefundRefs: [
        {
          provider: "finix",
          objectType: "transfer",
          objectId: "rf_replay_provider_123",
          relationship: "refund",
          recordedAt: "2026-04-23T00:00:00.000Z",
        },
      ],
      createdAt: "2026-04-23T00:00:00.000Z",
      updatedAt: "2026-04-23T00:00:00.000Z",
    });

    await service.applyCanonicalEvents([event]);

    const refund = await uow.refunds.getById("refund_replay_123", { environment: "sandbox" });
    expect(refund).toMatchObject({ status: "succeeded", updatedAt: "2026-04-23T12:00:00.000Z" });

    const payment = await uow.payments.getById("payment_replay_123", { environment: "sandbox" });
    expect(payment).toMatchObject({
      status: "refunded_full",
      updatedAt: "2026-04-23T12:00:00.000Z",
    });
  });

  test("applies settlement event by processor ref", async () => {
    const uow = createMemoryUnitOfWork({
      settlement: {
        id: "settlement_local_123",
        environment: "sandbox",
        merchantAccountId: "merchant_123",
        currency: "USD",
        status: "accruing",
        grossAmount: 1000,
        feeAmount: 10,
        refundAmount: 0,
        adjustmentAmount: 0,
        netAmount: 990,
        direction: "credit",
        openedAt: "2026-04-23T00:00:00.000Z",
        processorRefs: [
          {
            provider: "finix",
            objectType: "settlement",
            objectId: "st_123",
            relationship: "settlement",
            recordedAt: "2026-04-23T00:00:00.000Z",
          },
        ],
        createdAt: "2026-04-23T00:00:00.000Z",
        updatedAt: "2026-04-23T00:00:00.000Z",
      },
    });

    const service = createCanonicalEventsService({ uow });
    await service.applyCanonicalEvents([
      {
        id: "evt_settlement",
        environment: "sandbox",
        eventType: "settlement.closed",
        aggregateType: "settlement",
        aggregateId: "st_123",
        occurredAt: "2026-04-23T12:00:00.000Z",
        sourceProvider: "finix",
        payload: { objectType: "settlement" },
        createdAt: "2026-04-23T12:00:00.000Z",
      } satisfies CanonicalDomainEvent,
    ]);

    const record = await uow.settlements.getById("settlement_local_123", {
      environment: "sandbox",
    });
    expect(record).toMatchObject({
      status: "closed",
      closedAt: "2026-04-23T12:00:00.000Z",
      updatedAt: "2026-04-23T12:00:00.000Z",
    });
  });

  test("creates settlement from provider event payload when no row exists", async () => {
    const uow = createMemoryUnitOfWork();

    const service = createCanonicalEventsService({ uow });
    await service.applyCanonicalEvents([
      {
        id: "evt_settlement_create",
        environment: "sandbox",
        eventType: "settlement.accruing_started",
        aggregateType: "settlement",
        aggregateId: "st_created_123",
        occurredAt: "2026-04-23T12:00:00.000Z",
        sourceProvider: "finix",
        payload: {
          objectType: "settlement",
          merchantAccountId: "merchant_123",
          currency: "USD",
          grossAmount: 1000,
          feeAmount: 25,
          refundAmount: 100,
          adjustmentAmount: 0,
          netAmount: 875,
          direction: "credit",
        },
        createdAt: "2026-04-23T12:00:00.000Z",
      } satisfies CanonicalDomainEvent,
    ]);

    const record = await uow.settlements.getById("settlement_finix_st_created_123", {
      environment: "sandbox",
    });
    expect(record).toMatchObject({
      merchantAccountId: "merchant_123",
      status: "accruing",
      grossAmount: 1000,
      feeAmount: 25,
      refundAmount: 100,
      netAmount: 875,
      openedAt: "2026-04-23T12:00:00.000Z",
      processorRefs: [
        {
          provider: "finix",
          objectType: "settlement",
          objectId: "st_created_123",
          relationship: "settlement",
        },
      ],
    });
  });

  test("does not regress terminal settlement status on out-of-order event", async () => {
    const uow = createMemoryUnitOfWork({
      settlement: {
        id: "settlement_terminal_123",
        environment: "sandbox",
        merchantAccountId: "merchant_123",
        currency: "USD",
        status: "closed",
        grossAmount: 1000,
        feeAmount: 10,
        refundAmount: 0,
        adjustmentAmount: 0,
        netAmount: 990,
        direction: "credit",
        openedAt: "2026-04-23T00:00:00.000Z",
        closedAt: "2026-04-23T11:00:00.000Z",
        processorRefs: [
          {
            provider: "finix",
            objectType: "settlement",
            objectId: "st_terminal_123",
            relationship: "settlement",
            recordedAt: "2026-04-23T00:00:00.000Z",
          },
        ],
        createdAt: "2026-04-23T00:00:00.000Z",
        updatedAt: "2026-04-23T11:00:00.000Z",
      },
    });

    const service = createCanonicalEventsService({ uow });
    await service.applyCanonicalEvents([
      {
        id: "evt_settlement_old_123",
        environment: "sandbox",
        eventType: "settlement.accruing_started",
        aggregateType: "settlement",
        aggregateId: "st_terminal_123",
        occurredAt: "2026-04-23T10:00:00.000Z",
        sourceProvider: "finix",
        payload: { objectType: "settlement" },
        createdAt: "2026-04-23T10:00:00.000Z",
      } satisfies CanonicalDomainEvent,
    ]);

    const record = await uow.settlements.getById("settlement_terminal_123", {
      environment: "sandbox",
    });
    expect(record).toMatchObject({
      status: "closed",
      closedAt: "2026-04-23T11:00:00.000Z",
      updatedAt: "2026-04-23T11:00:00.000Z",
    });
  });

  test("applies payout event by processor ref", async () => {
    const uow = createMemoryUnitOfWork({
      payout: {
        id: "payout_local_123",
        environment: "sandbox",
        merchantAccountId: "merchant_123",
        amount: 990,
        currency: "USD",
        direction: "credit",
        status: "pending",
        processorRefs: [
          {
            provider: "finix",
            objectType: "payout",
            objectId: "po_123",
            relationship: "payout",
            recordedAt: "2026-04-23T00:00:00.000Z",
          },
        ],
        createdAt: "2026-04-23T00:00:00.000Z",
        updatedAt: "2026-04-23T00:00:00.000Z",
      },
    });

    const service = createCanonicalEventsService({ uow });
    await service.applyCanonicalEvents([
      {
        id: "evt_payout",
        environment: "sandbox",
        eventType: "payout.succeeded",
        aggregateType: "payout",
        aggregateId: "po_123",
        occurredAt: "2026-04-23T12:00:00.000Z",
        sourceProvider: "finix",
        payload: { objectType: "payout" },
        createdAt: "2026-04-23T12:00:00.000Z",
      } satisfies CanonicalDomainEvent,
    ]);

    const record = await uow.payouts.getById("payout_local_123", { environment: "sandbox" });
    expect(record).toMatchObject({ status: "succeeded", updatedAt: "2026-04-23T12:00:00.000Z" });
  });

  test("creates payout from provider event payload when no row exists", async () => {
    const uow = createMemoryUnitOfWork();

    const service = createCanonicalEventsService({ uow });
    await service.applyCanonicalEvents([
      {
        id: "evt_payout_create",
        environment: "sandbox",
        eventType: "payout.succeeded",
        aggregateType: "payout",
        aggregateId: "po_created_123",
        occurredAt: "2026-04-23T12:30:00.000Z",
        sourceProvider: "finix",
        payload: {
          objectType: "payout",
          merchantAccountId: "merchant_123",
          settlement: "st_created_123",
          amount: 875,
          currency: "USD",
          direction: "debit",
          expectedArrivalAt: "2026-04-24T12:30:00.000Z",
        },
        createdAt: "2026-04-23T12:30:00.000Z",
      } satisfies CanonicalDomainEvent,
    ]);

    const record = await uow.payouts.getById("payout_finix_po_created_123", {
      environment: "sandbox",
    });
    expect(record).toMatchObject({
      merchantAccountId: "merchant_123",
      settlementId: "settlement_finix_st_created_123",
      amount: 875,
      currency: "USD",
      direction: "debit",
      status: "succeeded",
      expectedArrivalAt: "2026-04-24T12:30:00.000Z",
      processorRefs: [
        {
          provider: "finix",
          objectType: "payout",
          objectId: "po_created_123",
          relationship: "payout",
        },
      ],
    });
  });

  test("does not regress terminal payout status on out-of-order event", async () => {
    const uow = createMemoryUnitOfWork({
      payout: {
        id: "payout_terminal_123",
        environment: "sandbox",
        merchantAccountId: "merchant_123",
        amount: 990,
        currency: "USD",
        direction: "credit",
        status: "succeeded",
        processorRefs: [
          {
            provider: "finix",
            objectType: "payout",
            objectId: "po_terminal_123",
            relationship: "payout",
            recordedAt: "2026-04-23T00:00:00.000Z",
          },
        ],
        createdAt: "2026-04-23T00:00:00.000Z",
        updatedAt: "2026-04-23T11:00:00.000Z",
      },
    });

    const service = createCanonicalEventsService({ uow });
    await service.applyCanonicalEvents([
      {
        id: "evt_payout_old_123",
        environment: "sandbox",
        eventType: "payout.created",
        aggregateType: "payout",
        aggregateId: "po_terminal_123",
        occurredAt: "2026-04-23T10:00:00.000Z",
        sourceProvider: "finix",
        payload: { objectType: "payout" },
        createdAt: "2026-04-23T10:00:00.000Z",
      } satisfies CanonicalDomainEvent,
    ]);

    const record = await uow.payouts.getById("payout_terminal_123", { environment: "sandbox" });
    expect(record).toMatchObject({
      status: "succeeded",
      updatedAt: "2026-04-23T11:00:00.000Z",
    });
  });

  test("applies dispute event by processor ref", async () => {
    const uow = createMemoryUnitOfWork({
      dispute: {
        id: "dispute_local_123",
        environment: "sandbox",
        merchantAccountId: "merchant_123",
        paymentId: "payment_123",
        amount: 500,
        currency: "USD",
        stage: "chargeback",
        responseState: "needs_response",
        openedAt: "2026-04-23T00:00:00.000Z",
        processorRefs: [
          {
            provider: "finix",
            objectType: "dispute",
            objectId: "dp_123",
            relationship: "dispute",
            recordedAt: "2026-04-23T00:00:00.000Z",
          },
        ],
        createdAt: "2026-04-23T00:00:00.000Z",
        updatedAt: "2026-04-23T00:00:00.000Z",
      },
    });

    const service = createCanonicalEventsService({ uow });
    await service.applyCanonicalEvents([
      {
        id: "evt_dispute",
        environment: "sandbox",
        eventType: "dispute.won",
        aggregateType: "dispute",
        aggregateId: "dp_123",
        occurredAt: "2026-04-23T12:00:00.000Z",
        sourceProvider: "finix",
        payload: { objectType: "dispute" },
        createdAt: "2026-04-23T12:00:00.000Z",
      } satisfies CanonicalDomainEvent,
    ]);

    const record = await uow.disputes.getById("dispute_local_123", { environment: "sandbox" });
    expect(record).toMatchObject({
      stage: "won",
      responseState: "closed",
      closedAt: "2026-04-23T12:00:00.000Z",
      updatedAt: "2026-04-23T12:00:00.000Z",
    });
  });
});
