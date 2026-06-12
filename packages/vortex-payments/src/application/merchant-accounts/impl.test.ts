import { describe, expect, test } from "vitest";
import type { MerchantAccount } from "../../domain/merchant";
import type { MerchantAccountState } from "../../domain/state";
import type { CanonicalDomainEvent } from "../../events/types";
import type { PaymentsUnitOfWork } from "../../storage/unit-of-work";
import { createMerchantAccountsService, MerchantAccountsServiceError } from "./impl";

function createMemoryUnitOfWork(seed?: {
  merchant?: MerchantAccount;
  merchantState?: MerchantAccountState;
}): PaymentsUnitOfWork {
  const merchants = new Map<string, MerchantAccount>();
  const merchantStates = new Map<string, MerchantAccountState>();
  const canonicalEvents = new Map<string, CanonicalDomainEvent>();

  if (seed?.merchant) {
    merchants.set(seed.merchant.id, seed.merchant);
  }
  if (seed?.merchantState) {
    merchantStates.set(seed.merchantState.merchantAccountId, seed.merchantState);
  }

  return {
    merchants: {
      async getById(id, options) {
        const merchant = merchants.get(id);
        return merchant && merchant.environment === options.environment ? merchant : null;
      },
      async listByTenant(environment, tenantId) {
        return [...merchants.values()].filter((merchant) => merchant.environment === environment && merchant.tenantId === tenantId);
      },
      async getByProcessorRef() {
        return null;
      },
      async save(record) {
        merchants.set(record.id, record);
      },
    },
    customers: {
      async getById() { return null; },
      async save() { throw new Error("unused"); },
    },
    onboarding: {
      async getSessionById() { return null; },
      async getLatestSessionByMerchantAccountId() { return null; },
      async listRequirementsForSession() { return []; },
      async listDocumentsForRequirement() { return []; },
      async saveSession() { throw new Error("unused"); },
      async saveRequirement() { throw new Error("unused"); },
      async saveRequirementDocument() { throw new Error("unused"); },
    },
    paymentMethods: {
      async getById() { return null; },
      async getByProcessorRef() { return null; },
      async listByOwner() { return []; },
      async save() { throw new Error("unused"); },
    },
    paymentMethodSetupSessions: {
      async getById() { return null; },
      async save() { throw new Error("unused"); },
    },
    paymentIntents: {
      async getById() { return null; },
      async getByProcessorRef() { return null; },
      async listByMerchant() { return []; },
      async listByCustomerProfile() { return []; },
      async save() { throw new Error("unused"); },
    },
    payments: {
      async getById() { return null; },
      async getByPaymentIntentId() { return null; },
      async save() { throw new Error("unused"); },
    },
    refunds: {
      async getById() { return null; },
      async getByProcessorRef() { return null; },
      async listByPayment() { return []; },
      async save() { throw new Error("unused"); },
    },
    settlements: {
      async getById() { return null; },
      async getByProcessorRef() { return null; },
      async listByMerchant() { return []; },
      async save() { throw new Error("unused"); },
    },
    payouts: {
      async getById() { return null; },
      async getByProcessorRef() { return null; },
      async listByMerchant() { return []; },
      async save() { throw new Error("unused"); },
    },
    disputes: {
      async getById() { return null; },
      async getByProcessorRef() { return null; },
      async listByMerchant() { return []; },
      async save() { throw new Error("unused"); },
    },
    merchantStates: {
      async getByMerchantAccountId(merchantAccountId, options) {
        const state = merchantStates.get(merchantAccountId);
        return state && state.environment === options.environment ? state : null;
      },
      async save(record) {
        merchantStates.set(record.merchantAccountId, record);
      },
    },
    customerStates: {
      async getByMerchantAndCustomer() { return null; },
      async save() { throw new Error("unused"); },
    },
    events: {
      async getRawWebhookById() { return null; },
      async getRawWebhookByDeliveryKey() { return null; },
      async saveRawWebhook() { throw new Error("unused"); },
      async getProcessorEventById() { return null; },
      async saveProcessorEvent() { throw new Error("unused"); },
      async saveCanonicalEvent(record) { canonicalEvents.set(`${record.environment}:${record.id}`, record); },
      async getCanonicalEventById(id, options) { return canonicalEvents.get(`${options.environment}:${id}`) ?? null; },
      async getWebhookEndpointById() { return null; },
      async saveWebhookEndpoint() { throw new Error("unused"); },
      async saveWebhookDelivery() { throw new Error("unused"); },
      async saveEventSubscription() { throw new Error("unused"); },
    },
    cases: {
      async getById() { return null; },
      async save() { throw new Error("unused"); },
      async saveActivity() { throw new Error("unused"); },
      async saveNote() { throw new Error("unused"); },
    },
    idempotency: {
      async getByScopeAndKey() { return null; },
      async save() { throw new Error("unused"); },
    },
    async runInTransaction(work) {
      return work(this);
    },
  };
}

describe("createMerchantAccountsService", () => {
  test("creates merchant account and initial state", async () => {
    const uow = createMemoryUnitOfWork();
    const service = createMerchantAccountsService({
      uow,
      now: () => "2026-05-14T18:00:00.000Z",
      createId: () => "ma_123",
    });

    const merchant = await service.createMerchantAccount({
      environment: "sandbox",
      tenantId: "tenant_123",
      externalMerchantRef: "ext_123",
      displayName: "Acme",
      legalEntityType: "company",
      country: "US",
      merchantMode: "processing",
      defaultCurrency: "USD",
      businessAddress: {
        line1: "1 Main",
        city: "NYC",
        postalCode: "10001",
        country: "US",
      },
      doingBusinessAs: "Acme DBA",
      email: "owner@acme.test",
      associatedIdentities: [{ identityRoles: ["owner"], firstName: "Sam" }],
      metadata: { source: "test" },
    });

	    expect(merchant).toMatchObject({
	      id: "ma_123",
	      tenantId: "tenant_123",
	      displayName: "Acme",
      status: "draft",
      capabilityStatus: "unknown",
      defaultCurrency: "USD",
      businessAddress: {
        line1: "1 Main",
        city: "NYC",
        postalCode: "10001",
        country: "US",
      },
	      doingBusinessAs: "Acme DBA",
	      email: "owner@acme.test",
	      taxIdentity: {
	        associatedIdentityCount: 1,
	        beneficialOwnerCount: 0,
	        controlPersonCount: 0,
	        representativeCount: 0,
	      },
	      settlementAccount: {
	        present: false,
	      },
	      metadata: { source: "test" },
	    });
	    expect(merchant).not.toHaveProperty("associatedIdentities");
	    expect(merchant).not.toHaveProperty("processorAccountRefs");

    const state = await uow.merchantStates.getByMerchantAccountId("ma_123", {
      environment: "sandbox",
    });
    expect(state).toMatchObject({
      merchantAccountId: "ma_123",
      merchantStatus: "draft",
      canAcceptPayments: false,
      payoutReadiness: "unknown",
    });
    const createdEvent = await uow.events.getCanonicalEventById("ma_123:merchant_account.created:2026-05-14T18:00:00.000Z", {
      environment: "sandbox",
    });
    expect(createdEvent).toMatchObject({
      eventType: "merchant_account.created",
      aggregateId: "ma_123",
      payload: {
        merchantAccountId: "ma_123",
        displayName: "Acme",
      },
    });
  });

  test("lists tenant merchant accounts newest first", async () => {
    const first: MerchantAccount = {
      id: "ma_123",
      environment: "sandbox",
      tenantId: "tenant_123",
      displayName: "Acme One",
      legalEntityType: "company",
      country: "US",
      merchantMode: "processing",
      defaultCurrency: "USD",
      status: "draft",
      capabilityStatus: "unknown",
      processorAccountRefs: [],
      createdAt: "2026-05-14T18:00:00.000Z",
      updatedAt: "2026-05-14T18:00:00.000Z",
    };
    const second: MerchantAccount = {
      id: "ma_456",
      environment: "sandbox",
      tenantId: "tenant_123",
      displayName: "Acme Two",
      legalEntityType: "company",
      country: "US",
      merchantMode: "hybrid",
      defaultCurrency: "USD",
      status: "draft",
      capabilityStatus: "unknown",
      processorAccountRefs: [],
      createdAt: "2026-05-14T19:00:00.000Z",
      updatedAt: "2026-05-14T20:00:00.000Z",
    };
    const otherTenant: MerchantAccount = {
      id: "ma_789",
      environment: "sandbox",
      tenantId: "tenant_other",
      displayName: "Other",
      legalEntityType: "company",
      country: "US",
      merchantMode: "processing",
      defaultCurrency: "USD",
      status: "draft",
      capabilityStatus: "unknown",
      processorAccountRefs: [],
      createdAt: "2026-05-14T17:00:00.000Z",
      updatedAt: "2026-05-14T21:00:00.000Z",
    };
    const uow = createMemoryUnitOfWork();
    await uow.merchants.save(first);
    await uow.merchants.save(second);
    await uow.merchants.save(otherTenant);
    const service = createMerchantAccountsService({ uow });

    const result = await service.listMerchantAccounts({
      environment: "sandbox",
      tenantId: "tenant_123",
    });

    expect(result.map((merchant) => merchant.id)).toEqual(["ma_456", "ma_123"]);
  });

  test("gets existing merchant account", async () => {
    const merchant: MerchantAccount = {
      id: "ma_123",
      environment: "sandbox",
      tenantId: "tenant_123",
      displayName: "Acme",
      legalEntityType: "company",
      country: "US",
      merchantMode: "processing",
      defaultCurrency: "USD",
      status: "draft",
      capabilityStatus: "unknown",
      processorAccountRefs: [],
      createdAt: "2026-05-14T18:00:00.000Z",
      updatedAt: "2026-05-14T18:00:00.000Z",
    };
    const uow = createMemoryUnitOfWork({ merchant });
    const service = createMerchantAccountsService({ uow });

    const result = await service.getMerchantAccount({
      environment: "sandbox",
      merchantAccountId: "ma_123",
    });

    expect(result).toMatchObject({
      id: merchant.id,
      displayName: merchant.displayName,
      taxIdentity: {
        associatedIdentityCount: 0,
        beneficialOwnerCount: 0,
        controlPersonCount: 0,
        representativeCount: 0,
      },
      settlementAccount: {
        present: false,
      },
    });
    expect(result).not.toHaveProperty("processorAccountRefs");
  });

  test("updates existing merchant account", async () => {
    const merchant: MerchantAccount = {
      id: "ma_123",
      environment: "sandbox",
      tenantId: "tenant_123",
      displayName: "Acme",
      legalEntityType: "company",
      country: "US",
      merchantMode: "processing",
      defaultCurrency: "USD",
      status: "draft",
      capabilityStatus: "unknown",
      processorAccountRefs: [],
      createdAt: "2026-05-14T18:00:00.000Z",
      updatedAt: "2026-05-14T18:00:00.000Z",
    };
    const merchantState: MerchantAccountState = {
      merchantAccountId: "ma_123",
      environment: "sandbox",
      merchantStatus: "draft",
      openRequirementIds: [],
      activeCapabilityKeys: [],
      restrictedCapabilityKeys: [],
      canAcceptPayments: false,
      payoutReadiness: "unknown",
      capabilitySnapshots: [],
      generatedAt: "2026-05-14T18:00:00.000Z",
    };
    const uow = createMemoryUnitOfWork({ merchant, merchantState });
    const service = createMerchantAccountsService({
      uow,
      now: () => "2026-05-14T19:00:00.000Z",
    });

    const updated = await service.updateMerchantAccount({
      environment: "sandbox",
      merchantAccountId: "ma_123",
      displayName: "Acme 2",
      merchantMode: "hybrid",
      mcc: "5734",
      settlementBankAccount: {
        accountNumber: "1234",
        accountType: "checking",
        bankCode: "021000021",
        name: "Acme",
      },
      metadata: { stage: "updated" },
    });

	    expect(updated).toMatchObject({
	      id: "ma_123",
	      displayName: "Acme 2",
	      merchantMode: "hybrid",
	      mcc: "5734",
	      settlementAccount: {
	        accountNumberMasked: "****1234",
	        accountType: "checking",
	        bankCode: "021000021",
	        name: "Acme",
	        present: true,
	      },
	      metadata: { stage: "updated" },
	      updatedAt: "2026-05-14T19:00:00.000Z",
	    });
	    expect(updated).not.toHaveProperty("settlementBankAccount");
	    expect(updated).not.toHaveProperty("processorAccountRefs");
    const updatedEvent = await uow.events.getCanonicalEventById("ma_123:merchant_account.updated:2026-05-14T19:00:00.000Z", {
      environment: "sandbox",
    });
    expect(updatedEvent).toMatchObject({
      eventType: "merchant_account.updated",
      aggregateId: "ma_123",
      payload: {
        merchantAccountId: "ma_123",
        displayName: "Acme 2",
      },
    });
  });

  test("clears nullable merchant account fields when patch sends null", async () => {
    const merchant: MerchantAccount = {
      id: "ma_123",
      environment: "sandbox",
      tenantId: "tenant_123",
      displayName: "Acme",
      legalEntityType: "company",
      country: "US",
      merchantMode: "processing",
      defaultCurrency: "USD",
      status: "draft",
      capabilityStatus: "unknown",
      doingBusinessAs: "Acme DBA",
      email: "owner@acme.test",
      businessAddress: {
        line1: "1 Main",
        city: "NYC",
        postalCode: "10001",
        country: "US",
      },
      settlementBankAccount: {
        accountNumber: "1234",
        accountType: "checking",
        bankCode: "021000021",
        name: "Acme",
      },
      associatedIdentities: [{ identityRoles: ["owner"], firstName: "Sam" }],
      metadata: { source: "seed" },
      processorAccountRefs: [],
      createdAt: "2026-05-14T18:00:00.000Z",
      updatedAt: "2026-05-14T18:00:00.000Z",
    };
    const uow = createMemoryUnitOfWork({ merchant });
    const service = createMerchantAccountsService({
      uow,
      now: () => "2026-05-14T19:30:00.000Z",
    });

    const updated = await service.updateMerchantAccount({
      environment: "sandbox",
      merchantAccountId: "ma_123",
      doingBusinessAs: null,
      email: null,
      businessAddress: null,
      settlementBankAccount: null,
      associatedIdentities: null,
      metadata: null,
    });

	    expect(updated).toMatchObject({
	      id: "ma_123",
	      displayName: "Acme",
	      doingBusinessAs: undefined,
      email: undefined,
      businessAddress: undefined,
	      settlementAccount: {
	        present: false,
	      },
	      taxIdentity: {
	        associatedIdentityCount: 0,
	      },
	      metadata: undefined,
	      updatedAt: "2026-05-14T19:30:00.000Z",
	    });
	    expect(updated).not.toHaveProperty("settlementBankAccount");
	    expect(updated).not.toHaveProperty("associatedIdentities");
  });

  test("throws not_found when updating missing merchant", async () => {
    const service = createMerchantAccountsService({ uow: createMemoryUnitOfWork() });

    await expect(
      service.updateMerchantAccount({
        environment: "sandbox",
        merchantAccountId: "ma_missing",
        displayName: "Nope",
      }),
    ).rejects.toBeInstanceOf(MerchantAccountsServiceError);
  });
});
