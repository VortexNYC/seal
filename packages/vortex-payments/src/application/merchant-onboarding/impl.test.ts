import { describe, expect, test } from "vitest";
import type {
  MerchantAccount,
  MerchantOnboardingSession,
  MerchantRequirement,
  MerchantRequirementDocument,
} from "../../domain/merchant";
import type { CustomerPaymentState, MerchantAccountState } from "../../domain/state";
import type { PaymentMethod } from "../../domain/payment-methods";
import type { CanonicalDomainEvent } from "../../events/types";
import type { IdempotencyRecord } from "../../storage/repositories";
import type { ProviderRegistry } from "../../providers/registry";
import type { PaymentsProviderAdapter, ProviderContext } from "../../providers/types";
import type { PaymentsUnitOfWork } from "../../storage/unit-of-work";
import {
  createMerchantOnboardingService,
  MerchantOnboardingServiceError,
} from "./impl";

const consent = {
  merchantAgreementAccepted: true,
  merchantAgreementAcceptedAt: "2026-04-23T00:00:00.000Z",
  merchantAgreementIpAddress: "203.0.113.10",
  merchantAgreementUserAgent: "VortexTest/1.0",
  paymentTermsUrl: "https://payments.vortex.nyc/terms",
  paymentPrivacyUrl: "https://payments.vortex.nyc/privacy",
  vortexTermsUrl: "https://vortex.nyc/terms",
  vortexPrivacyUrl: "https://vortex.nyc/privacy",
  feeDisclosureVersion: "fees-2026-05-18",
  feeDisclosureUrl: "https://vortex.nyc/fees",
  consentComponentVersion: "vortex-payments-consent@0.1.0",
} as const;

const underwriting = {
  annualAchVolume: 200000,
  averageAchTransferAmount: 20000,
  averageCardTransferAmount: 5000,
  businessDescription: "Vortex merchant test business",
  cardVolumeDistribution: {
    cardPresentPercentage: 30,
    mailOrderTelephoneOrderPercentage: 10,
    ecommercePercentage: 60,
  },
  refundPolicy: "MERCHANDISE_EXCHANGE_ONLY",
  volumeDistributionByBusinessType: {
    otherVolumePercentage: 0,
    consumerToConsumerVolumePercentage: 0,
    businessToConsumerVolumePercentage: 100,
    businessToBusinessVolumePercentage: 0,
    personToPersonVolumePercentage: 0,
  },
} as const;

function createMerchant(overrides: Partial<MerchantAccount> = {}): MerchantAccount {
  return {
    id: "merchant_123",
    environment: "sandbox",
    tenantId: "tenant_123",
    externalMerchantRef: "ext_merchant_123",
    displayName: "Vortex Merchant",
    legalEntityType: "CORPORATION",
    country: "USA",
    merchantMode: "processing",
    defaultCurrency: "USD",
    status: "draft",
    capabilityStatus: "draft",
    processorAccountRefs: [],
    achMaxTransactionAmount: 1000000,
    annualCardVolume: 12000000,
    underwriting,
    createdAt: "2026-04-23T00:00:00.000Z",
    updatedAt: "2026-04-23T00:00:00.000Z",
    ...overrides,
  };
}

function createMemoryUnitOfWork(seed?: { merchant?: MerchantAccount }): PaymentsUnitOfWork {
  const merchants = new Map<string, MerchantAccount>();
  const sessions = new Map<string, MerchantOnboardingSession>();
  const requirements = new Map<string, MerchantRequirement>();
  const requirementDocuments = new Map<string, MerchantRequirementDocument>();
  const merchantStates = new Map<string, MerchantAccountState>();
  const customerStates = new Map<string, CustomerPaymentState>();
  const paymentMethods = new Map<string, PaymentMethod>();
  const idempotency = new Map<string, IdempotencyRecord>();
  const canonicalEvents = new Map<string, CanonicalDomainEvent>();

  if (seed?.merchant) {
    merchants.set(`${seed.merchant.environment}:${seed.merchant.id}`, seed.merchant);
  }

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
        return Array.from(merchants.values()).find(
          (merchant) =>
            merchant.environment === environment &&
            merchant.processorAccountRefs.some(
              (ref) => ref.provider === provider && ref.objectType === objectType && ref.objectId === objectId,
            ),
        ) ?? null;
      },
      async save(record) {
        merchants.set(`${record.environment}:${record.id}`, record);
      },
    },
    customers: {
      async getById() { return null; },
      async save() {},
    },
    onboarding: {
      async getSessionById(id, options) {
        const session = sessions.get(`${options.environment}:${id}`);
        return session ?? null;
      },
      async getLatestSessionByMerchantAccountId(merchantAccountId, options) {
        return Array.from(sessions.values())
          .filter((session) => session.environment === options.environment && session.merchantAccountId === merchantAccountId)
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null;
      },
      async listRequirementsForSession(onboardingSessionId, options) {
        return Array.from(requirements.values()).filter(
          (requirement) =>
            requirement.environment === options.environment &&
            requirement.onboardingSessionId === onboardingSessionId,
        );
      },
      async listDocumentsForRequirement(requirementId, options) {
        return Array.from(requirementDocuments.values()).filter(
          (document) => document.environment === options.environment && document.requirementId === requirementId,
        );
      },
      async saveSession(record) {
        sessions.set(`${record.environment}:${record.id}`, record);
      },
      async saveRequirement(record) {
        requirements.set(`${record.environment}:${record.id}`, record);
      },
      async saveRequirementDocument(record) {
        requirementDocuments.set(`${record.environment}:${record.id}`, record);
      },
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
        return paymentMethods.get(`${options.environment}:${id}`) ?? null;
      },
      async getByProcessorRef() {
        return null;
      },
      async listByOwner(environment, ownerType, ownerId) {
        return Array.from(paymentMethods.values()).filter((record) => record.environment === environment && record.ownerType === ownerType && record.ownerId === ownerId);
      },
      async save(record) {
        paymentMethods.set(`${record.environment}:${record.id}`, record);
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

const providerContext: ProviderContext = {
  provider: "finix",
  environment: "sandbox",
  tenantId: "tenant_123",
};

function createUnusedOnboardingAdapter(): PaymentsProviderAdapter {
  return {
    key: "finix",
    supportedCapabilities: ["merchant_onboarding"],
    async verifyWebhookSignature() { throw new Error("not used"); },
    async createMerchantOnboarding() { throw new Error("provider should not be called"); },
    async createPaymentIntent() { throw new Error("not used"); },
    async createRefund() { throw new Error("not used"); },
    async fetchObjectSnapshot() { throw new Error("not used"); },
  };
}

describe("createMerchantOnboardingService", () => {
  test("throws not_found when merchant does not exist", async () => {
    const adapter: PaymentsProviderAdapter = {
      key: "finix",
      supportedCapabilities: ["merchant_onboarding"],
      async verifyWebhookSignature() {
        throw new Error("not used");
      },
      async createMerchantOnboarding() {
        throw new Error("not used");
      },
      async createPaymentIntent() {
        throw new Error("not used");
      },
      async createRefund() {
        throw new Error("not used");
      },
      async createOnboardingRequirementUploadLink() {
        throw new Error("not used");
      },
      async fetchObjectSnapshot() {
        throw new Error("not used");
      },
    };

    const service = createMerchantOnboardingService({
      uow: createMemoryUnitOfWork(),
      providers: createRegistry(adapter),
      resolveProviderContext: () => providerContext,
    });

    await expect(
      service.submitMerchantOnboarding({
        environment: "sandbox",
        merchantAccountId: "missing_merchant",
        submittedByType: "operator",
        submittedByRef: "user_123",
        consent,
      }),
    ).rejects.toMatchObject({
      name: "MerchantOnboardingServiceError",
      code: "not_found",
    } satisfies Partial<MerchantOnboardingServiceError>);
  });

  test("maps provider failure into service error", async () => {
    const adapter: PaymentsProviderAdapter = {
      key: "finix",
      supportedCapabilities: ["merchant_onboarding"],
      async verifyWebhookSignature() {
        throw new Error("not used");
      },
      async createMerchantOnboarding() {
        return {
          ok: false,
          error: {
            provider: "finix",
            category: "temporarily_unavailable",
            code: "finix_down",
            message: "Finix unavailable",
            retryable: true,
          },
        };
      },
      async createPaymentIntent() {
        throw new Error("not used");
      },
      async createRefund() {
        throw new Error("not used");
      },
      async createOnboardingRequirementUploadLink() {
        throw new Error("not used");
      },
      async fetchObjectSnapshot() {
        throw new Error("not used");
      },
    };

    const service = createMerchantOnboardingService({
      uow: createMemoryUnitOfWork({ merchant: createMerchant() }),
      providers: createRegistry(adapter),
      resolveProviderContext: () => providerContext,
    });

    await expect(
      service.submitMerchantOnboarding({
        environment: "sandbox",
        merchantAccountId: "merchant_123",
        submittedByType: "operator",
        submittedByRef: "user_123",
        consent,
      }),
    ).rejects.toMatchObject({
      name: "MerchantOnboardingServiceError",
      code: "provider_unavailable",
      retryable: true,
    } satisfies Partial<MerchantOnboardingServiceError>);
  });

  test("lists and submits onboarding requirement remediation", async () => {
    const merchant = createMerchant({
      status: "restricted",
      processorAccountRefs: [{
        provider: "finix",
        objectType: "merchant",
        objectId: "mu_123",
        relationship: "onboarding_account",
        recordedAt: "2026-04-23T12:00:00.000Z",
      }],
    });
    const uow = createMemoryUnitOfWork({ merchant });
    await uow.onboarding.saveSession({
      id: "onb_existing",
      environment: "sandbox",
      merchantAccountId: merchant.id,
      status: "action_required",
      submittedAt: "2026-04-23T12:00:00.000Z",
      currentRequirementCount: 1,
      openRequirementCount: 1,
      processorRefs: [],
      createdAt: "2026-04-23T12:00:00.000Z",
      updatedAt: "2026-04-23T12:00:00.000Z",
    });
    await uow.onboarding.saveRequirement({
      id: "merchant_123:provider_requirement:cf_123",
      environment: "sandbox",
      onboardingSessionId: "onb_existing",
      merchantAccountId: merchant.id,
      requirementType: "compliance_form",
      status: "pending",
      title: "Upload owner document",
      sourceProvider: "finix",
      providerRequirementRef: "cf_123",
      requestedAt: "2026-04-23T12:00:00.000Z",
    });

    const adapter: PaymentsProviderAdapter = {
      key: "finix",
      supportedCapabilities: ["merchant_onboarding"],
      async verifyWebhookSignature() { throw new Error("not used"); },
      async createMerchantOnboarding() { throw new Error("not used"); },
      async createPaymentIntent() { throw new Error("not used"); },
      async createRefund() { throw new Error("not used"); },
      async refreshMerchantOnboarding() {
        return {
          ok: true,
          value: {
            merchantStatus: "restricted",
            onboardingStatus: "action_required",
            processorRefs: [{
              provider: "finix",
              objectType: "merchant",
              objectId: "mu_123",
              relationship: "onboarding_account",
              recordedAt: "2026-04-23T13:00:00.000Z",
            }],
            metadata: { tier: "gold" },
            requirements: [{
              id: "merchant_123:verification:ver_1",
              environment: "sandbox",
              onboardingSessionId: "onb_existing",
              merchantAccountId: "merchant_123",
              requirementType: "merchant_verification",
              status: "submitted",
              reasonCode: "INCOMPLETE_APPLICATION",
              title: "merchant_verification",
              description: "Need more docs",
              sourceProvider: "finix",
              providerRequirementRef: "ver_1",
              requestedAt: "2026-04-21T00:00:00.000Z",
              metadata: { team: "risk" },
            }],
          },
        };
      },
      async createOnboardingRequirementUploadLink() {
        return {
          ok: true,
          value: {
            documentId: "file_123",
            uploadLinkId: "link_123",
            uploadUrl: "https://upload.finix.test/link_123",
            expiresAt: "2026-04-23T14:00:00.000Z",
          },
        };
      },
      async fetchObjectSnapshot(_context, ref) {
        if (ref.objectType === "compliance_form") {
          return {
            ok: true,
            value: {
              provider: "finix",
              objectType: "compliance_form",
              objectId: "cf_123",
              status: "IN_REVIEW",
              recordedAt: "2026-04-23T13:00:00.000Z",
            },
          };
        }
        return {
          ok: true,
          value: {
            provider: "finix",
            objectType: "file",
            objectId: "file_123",
            status: "UPLOADED",
            recordedAt: "2026-04-23T13:00:00.000Z",
          },
        };
      },
    };

    const service = createMerchantOnboardingService({
      uow,
      providers: createRegistry(adapter),
      resolveProviderContext: () => providerContext,
      now: () => "2026-04-23T13:00:00.000Z",
    });

    expect(await service.listMerchantRequirements({
      environment: "sandbox",
      merchantAccountId: merchant.id,
      onboardingSessionId: "onb_existing",
    })).toEqual([{
      requirementId: "merchant_123:provider_requirement:cf_123",
      requirementType: "compliance_form",
      status: "pending",
      title: "Upload owner document",
      sourceProvider: "finix",
      providerRequirementRef: "cf_123",
      requestedAt: "2026-04-23T12:00:00.000Z",
    }]);


    expect(await service.createRequirementUploadLink({
      environment: "sandbox",
      merchantAccountId: merchant.id,
      onboardingSessionId: "onb_existing",
      requirementId: "merchant_123:provider_requirement:cf_123",
      fileName: "owner-license.png",
      contentType: "image/png",
      uploadedByType: "merchant",
      uploadedByRef: "user_123",
    })).toEqual({
      requirementId: "merchant_123:provider_requirement:cf_123",
      documentId: "file_123",
      uploadLinkId: "link_123",
      uploadUrl: "https://upload.finix.test/link_123",
      expiresAt: "2026-04-23T14:00:00.000Z",
    });
    expect(await uow.events.getCanonicalEventById(
      "merchant_123:provider_requirement:cf_123:merchant_requirement_document.upload_link_created:2026-04-23T13:00:00.000Z",
      { environment: "sandbox" },
    )).toMatchObject({
      eventType: "merchant_requirement_document.upload_link_created",
      aggregateId: "file_123",
      payload: {
        merchantAccountId: "merchant_123",
        requirementId: "merchant_123:provider_requirement:cf_123",
        documentId: "file_123",
      },
    });

    expect(await service.listMerchantRequirementDocuments({
      environment: "sandbox",
      merchantAccountId: merchant.id,
      onboardingSessionId: "onb_existing",
      requirementId: "merchant_123:provider_requirement:cf_123",
    })).toEqual([{
      requirementId: "merchant_123:provider_requirement:cf_123",
      documentId: "file_123",
      uploadLinkId: "link_123",
      fileName: "owner-license.png",
      contentType: "image/png",
      requestedAt: "2026-04-23T13:00:00.000Z",
      uploadedByType: "merchant",
      uploadedByRef: "user_123",
      provider: "finix",
    }]);

    expect(await service.getRequirementUploadStatus({
      environment: "sandbox",
      merchantAccountId: merchant.id,
      onboardingSessionId: "onb_existing",
      requirementId: "merchant_123:provider_requirement:cf_123",
    })).toEqual({
      requirementId: "merchant_123:provider_requirement:cf_123",
      documentId: "file_123",
      uploadLinkId: "link_123",
      fileName: "owner-license.png",
      contentType: "image/png",
      requestedAt: "2026-04-23T13:00:00.000Z",
      provider: "finix",
      status: "UPLOADED",
      recordedAt: "2026-04-23T13:00:00.000Z",
    });

    expect(await service.refreshMerchantRequirement({
      environment: "sandbox",
      merchantAccountId: merchant.id,
      onboardingSessionId: "onb_existing",
      requirementId: "merchant_123:provider_requirement:cf_123",
    })).toMatchObject({
      requirement: {
        requirementId: "merchant_123:provider_requirement:cf_123",
        requirementType: "compliance_form",
        status: "submitted",
        title: "Upload owner document",
        sourceProvider: "finix",
        providerRequirementRef: "cf_123",
        requestedAt: "2026-04-23T12:00:00.000Z",
      },
      documents: [{
        requirementId: "merchant_123:provider_requirement:cf_123",
        documentId: "file_123",
        uploadLinkId: "link_123",
        fileName: "owner-license.png",
        contentType: "image/png",
        requestedAt: "2026-04-23T13:00:00.000Z",
        uploadedByType: "merchant",
        uploadedByRef: "user_123",
        provider: "finix",
        status: "UPLOADED",
        recordedAt: "2026-04-23T13:00:00.000Z",
      }],
    });

    expect(await uow.events.getCanonicalEventById(
      "merchant_123:provider_requirement:cf_123:merchant_requirement.refreshed:2026-04-23T13:00:00.000Z",
      { environment: "sandbox" },
    )).toMatchObject({
      eventType: "merchant_requirement.refreshed",
      aggregateId: "merchant_123:provider_requirement:cf_123",
      payload: {
        merchantAccountId: "merchant_123",
        requirementId: "merchant_123:provider_requirement:cf_123",
        requirementStatus: "submitted",
      },
    });

    const snapshot = await service.satisfyMerchantRequirements({
      environment: "sandbox",
      merchantAccountId: merchant.id,
      onboardingSessionId: "onb_existing",
      submissions: [{
        requirementId: "merchant_123:provider_requirement:cf_123",
        payload: { ownerFirstName: "Sam" },
        documentIds: ["file_123"],
      }],
      submittedByType: "merchant",
      submittedByRef: "user_123",
    });

    expect(snapshot).toMatchObject({
      merchantAccountId: merchant.id,
      onboardingSessionId: "onb_existing",
      status: "under_review",
      openRequirementIds: [
        "merchant_123:provider_requirement:cf_123",
      ],
      requirementIds: [
        "merchant_123:provider_requirement:cf_123",
      ],
      metadata: {
        submittedByType: "merchant",
        submittedByRef: "user_123",
      },
    });

    expect(await uow.events.getCanonicalEventById(
      "merchant_123:provider_requirement:cf_123:merchant_requirement.submitted:2026-04-23T13:00:00.000Z",
      { environment: "sandbox" },
    )).toMatchObject({
      eventType: "merchant_requirement.submitted",
      aggregateId: "merchant_123:provider_requirement:cf_123",
      payload: {
        merchantAccountId: "merchant_123",
        requirementId: "merchant_123:provider_requirement:cf_123",
        submittedByType: "merchant",
      },
    });

    const [storedRequirement] = await uow.onboarding.listRequirementsForSession("onb_existing", { environment: "sandbox" });
    expect(storedRequirement).toMatchObject({
      status: "submitted",
      metadata: {
        lastSubmittedAt: "2026-04-23T13:00:00.000Z",
        lastSubmittedByType: "merchant",
        lastSubmittedByRef: "user_123",
        submittedDocumentIds: '["file_123"]',
        submittedPayload: '{"ownerFirstName":"Sam"}',
      },
    });

    expect(await uow.onboarding.listDocumentsForRequirement("merchant_123:provider_requirement:cf_123", { environment: "sandbox" })).toEqual([
      {
        id: "merchant_123:provider_requirement:cf_123:file_123",
        environment: "sandbox",
        onboardingSessionId: "onb_existing",
        merchantAccountId: merchant.id,
        requirementId: "merchant_123:provider_requirement:cf_123",
        sourceProvider: "finix",
        documentId: "file_123",
        uploadLinkId: "link_123",
        fileName: "owner-license.png",
        contentType: "image/png",
        requestedAt: "2026-04-23T13:00:00.000Z",
        uploadedByType: "merchant",
        uploadedByRef: "user_123",
        status: "UPLOADED",
        recordedAt: "2026-04-23T13:00:00.000Z",
      },
    ]);

    expect(await service.refreshMerchantOnboardingSession({
      environment: "sandbox",
      merchantAccountId: merchant.id,
      onboardingSessionId: "onb_existing",
    })).toEqual({
      snapshot: {
        merchantAccountId: merchant.id,
        onboardingSessionId: "onb_existing",
        status: "action_required",
        requirementIds: ["merchant_123:verification:ver_1"],
        openRequirementIds: ["merchant_123:verification:ver_1"],
      },
      requirements: [{
        requirementId: "merchant_123:verification:ver_1",
        requirementType: "merchant_verification",
        status: "submitted",
        reasonCode: "INCOMPLETE_APPLICATION",
        title: "merchant_verification",
        description: "Need more docs",
        sourceProvider: "finix",
        providerRequirementRef: "ver_1",
        requestedAt: "2026-04-21T00:00:00.000Z",
        metadata: { team: "risk" },
      }],
    });

    expect(await service.listMerchantRequirements({
      environment: "sandbox",
      merchantAccountId: merchant.id,
      onboardingSessionId: "onb_existing",
    })).toEqual([
      {
        requirementId: "merchant_123:provider_requirement:cf_123",
        requirementType: "compliance_form",
        status: "waived",
        title: "Upload owner document",
        sourceProvider: "finix",
        providerRequirementRef: "cf_123",
        requestedAt: "2026-04-23T12:00:00.000Z",
        metadata: {
          lastSubmittedAt: "2026-04-23T13:00:00.000Z",
          lastSubmittedByType: "merchant",
          lastSubmittedByRef: "user_123",
          submittedDocumentIds: '["file_123"]',
          submittedPayload: '{"ownerFirstName":"Sam"}',
          providerRefreshClosedAt: "2026-04-23T13:00:00.000Z",
          providerRefreshClosedReason: "removed_from_provider_projection",
        },
      },
      {
        requirementId: "merchant_123:verification:ver_1",
        requirementType: "merchant_verification",
        status: "submitted",
        reasonCode: "INCOMPLETE_APPLICATION",
        title: "merchant_verification",
        description: "Need more docs",
        sourceProvider: "finix",
        providerRequirementRef: "ver_1",
        requestedAt: "2026-04-21T00:00:00.000Z",
        metadata: { team: "risk" },
      },
    ]);

    expect(await uow.onboarding.getSessionById("onb_existing", { environment: "sandbox" })).toMatchObject({
      status: "action_required",
      openRequirementCount: 1,
    });
    expect(await uow.merchants.getById(merchant.id, { environment: "sandbox" })).toMatchObject({
      status: "restricted",
    });
    expect(await uow.events.getCanonicalEventById(
      "merchant_123:action_required:2026-04-23T13:00:00.000Z",
      { environment: "sandbox" },
    )).toMatchObject({
      eventType: "merchant_account.action_required",
      aggregateId: "merchant_123",
      payload: {
        merchantAccountId: "merchant_123",
        onboardingSessionId: "onb_existing",
        onboardingStatus: "action_required",
      },
    });
  });

  test("normalizes legacy provider requirement rows during refresh", async () => {
    const merchant = createMerchant({
      status: "restricted",
      processorAccountRefs: [{
        provider: "finix",
        objectType: "merchant",
        objectId: "mu_123",
        relationship: "onboarding_account",
        recordedAt: "2026-04-23T12:00:00.000Z",
      }],
    });
    const uow = createMemoryUnitOfWork({ merchant });
    await uow.onboarding.saveSession({
      id: "onb_existing",
      environment: "sandbox",
      merchantAccountId: merchant.id,
      status: "action_required",
      submittedAt: "2026-04-23T12:00:00.000Z",
      currentRequirementCount: 1,
      openRequirementCount: 1,
      processorRefs: [],
      createdAt: "2026-04-23T12:00:00.000Z",
      updatedAt: "2026-04-23T12:00:00.000Z",
    });
    await uow.onboarding.saveRequirement({
      id: "merchant_123:provider_requirement:cf_123",
      environment: "sandbox",
      onboardingSessionId: "onb_existing",
      merchantAccountId: merchant.id,
      requirementType: "provider_requirement",
      status: "submitted",
      title: "Provider requirement pending",
      sourceProvider: "finix",
      providerRequirementRef: "cf_123",
      requestedAt: "2026-04-23T12:00:00.000Z",
      metadata: {
        lastSubmittedAt: "2026-04-23T12:30:00.000Z",
        submittedPayload: '{"ownerFirstName":"Sam"}',
      },
    });

    const adapter: PaymentsProviderAdapter = {
      key: "finix",
      supportedCapabilities: ["merchant_onboarding"],
      async verifyWebhookSignature() { throw new Error("not used"); },
      async createMerchantOnboarding() { throw new Error("not used"); },
      async createPaymentIntent() { throw new Error("not used"); },
      async createRefund() { throw new Error("not used"); },
      async refreshMerchantOnboarding() {
        return {
          ok: true,
          value: {
            merchantStatus: "restricted",
            onboardingStatus: "action_required",
            processorRefs: [],
            requirements: [{
              id: "merchant_123:compliance_form:cf_123",
              environment: "sandbox",
              onboardingSessionId: "onb_existing",
              merchantAccountId: "merchant_123",
              requirementType: "compliance_form",
              status: "pending",
              title: "Owner document",
              description: "Upload government ID",
              sourceProvider: "finix",
              providerRequirementRef: "cf_123",
              requestedAt: "2026-04-23T12:00:00.000Z",
              metadata: { finixCategory: "kyc" },
            }],
          },
        };
      },
      async createOnboardingRequirementUploadLink() {
        throw new Error("not used");
      },
      async fetchObjectSnapshot() {
        throw new Error("not used");
      },
    };

    const service = createMerchantOnboardingService({
      uow,
      providers: createRegistry(adapter),
      resolveProviderContext: () => providerContext,
      now: () => "2026-04-23T13:00:00.000Z",
    });

    expect(await service.refreshMerchantOnboardingSession({
      environment: "sandbox",
      merchantAccountId: merchant.id,
      onboardingSessionId: "onb_existing",
    })).toEqual({
      snapshot: {
        merchantAccountId: merchant.id,
        onboardingSessionId: "onb_existing",
        status: "action_required",
        requirementIds: ["merchant_123:provider_requirement:cf_123"],
        openRequirementIds: ["merchant_123:provider_requirement:cf_123"],
      },
      requirements: [{
        requirementId: "merchant_123:provider_requirement:cf_123",
        requirementType: "compliance_form",
        status: "pending",
        title: "Owner document",
        description: "Upload government ID",
        sourceProvider: "finix",
        providerRequirementRef: "cf_123",
        requestedAt: "2026-04-23T12:00:00.000Z",
        metadata: {
          lastSubmittedAt: "2026-04-23T12:30:00.000Z",
          submittedPayload: '{"ownerFirstName":"Sam"}',
          finixCategory: "kyc",
        },
      }],
    });

    expect(await service.listMerchantRequirements({
      environment: "sandbox",
      merchantAccountId: merchant.id,
      onboardingSessionId: "onb_existing",
    })).toEqual([{
      requirementId: "merchant_123:provider_requirement:cf_123",
      requirementType: "compliance_form",
      status: "pending",
      title: "Owner document",
      description: "Upload government ID",
      sourceProvider: "finix",
      providerRequirementRef: "cf_123",
      requestedAt: "2026-04-23T12:00:00.000Z",
      metadata: {
        lastSubmittedAt: "2026-04-23T12:30:00.000Z",
        submittedPayload: '{"ownerFirstName":"Sam"}',
        finixCategory: "kyc",
      },
    }]);
  });

  test("refresh marks onboarding approved and activates merchant state", async () => {
    const merchant = createMerchant({
      status: "pending_review",
      processorAccountRefs: [{
        provider: "finix",
        objectType: "merchant",
        objectId: "mu_123",
        relationship: "onboarding_account",
        recordedAt: "2026-04-23T12:00:00.000Z",
      }],
    });
    const uow = createMemoryUnitOfWork({ merchant });
    await uow.onboarding.saveSession({
      id: "onb_existing",
      environment: "sandbox",
      merchantAccountId: merchant.id,
      status: "under_review",
      submittedAt: "2026-04-23T12:00:00.000Z",
      currentRequirementCount: 1,
      openRequirementCount: 1,
      processorRefs: [],
      createdAt: "2026-04-23T12:00:00.000Z",
      updatedAt: "2026-04-23T12:00:00.000Z",
    });
    await uow.onboarding.saveRequirement({
      id: "merchant_123:provider_requirement:ver_1",
      environment: "sandbox",
      onboardingSessionId: "onb_existing",
      merchantAccountId: merchant.id,
      requirementType: "provider_requirement",
      status: "submitted",
      title: "Provider review",
      sourceProvider: "finix",
      providerRequirementRef: "ver_1",
      requestedAt: "2026-04-23T12:00:00.000Z",
    });

    const adapter: PaymentsProviderAdapter = {
      key: "finix",
      supportedCapabilities: ["merchant_onboarding"],
      async verifyWebhookSignature() { throw new Error("not used"); },
      async createMerchantOnboarding() { throw new Error("not used"); },
      async createPaymentIntent() { throw new Error("not used"); },
      async createRefund() { throw new Error("not used"); },
      async refreshMerchantOnboarding() {
        return {
          ok: true,
          value: {
            merchantStatus: "active",
            onboardingStatus: "approved",
            processorRefs: [],
            requirements: [],
          },
        };
      },
      async createOnboardingRequirementUploadLink() { throw new Error("not used"); },
      async fetchObjectSnapshot() { throw new Error("not used"); },
    };

    const service = createMerchantOnboardingService({
      uow,
      providers: createRegistry(adapter),
      resolveProviderContext: () => providerContext,
      now: () => "2026-04-23T13:00:00.000Z",
    });

    expect(await service.refreshMerchantOnboardingSession({
      environment: "sandbox",
      merchantAccountId: merchant.id,
      onboardingSessionId: "onb_existing",
    })).toEqual({
      snapshot: {
        merchantAccountId: merchant.id,
        onboardingSessionId: "onb_existing",
        status: "approved",
        requirementIds: [],
        openRequirementIds: [],
      },
      requirements: [],
    });

    expect(await uow.onboarding.getSessionById("onb_existing", { environment: "sandbox" })).toMatchObject({
      status: "approved",
      approvedAt: "2026-04-23T13:00:00.000Z",
      rejectedAt: undefined,
      currentRequirementCount: 0,
      openRequirementCount: 0,
    });
    expect(await uow.merchants.getById(merchant.id, { environment: "sandbox" })).toMatchObject({
      status: "active",
    });
    expect(await uow.merchantStates.getByMerchantAccountId(merchant.id, { environment: "sandbox" })).toMatchObject({
      merchantStatus: "active",
      onboardingStatus: "approved",
      openRequirementIds: [],
      canAcceptPayments: true,
      payoutReadiness: "ready",
    });
    expect(await service.listMerchantRequirements({
      environment: "sandbox",
      merchantAccountId: merchant.id,
      onboardingSessionId: "onb_existing",
    })).toEqual([{
      requirementId: "merchant_123:provider_requirement:ver_1",
      requirementType: "provider_requirement",
      status: "satisfied",
      title: "Provider review",
      sourceProvider: "finix",
      providerRequirementRef: "ver_1",
      requestedAt: "2026-04-23T12:00:00.000Z",
      satisfiedAt: "2026-04-23T13:00:00.000Z",
      metadata: {
        providerRefreshClosedAt: "2026-04-23T13:00:00.000Z",
        providerRefreshClosedReason: "removed_from_provider_projection",
      },
    }]);
  });

  test("refresh marks onboarding rejected and blocks merchant state", async () => {
    const merchant = createMerchant({
      status: "pending_review",
      processorAccountRefs: [{
        provider: "finix",
        objectType: "merchant",
        objectId: "mu_123",
        relationship: "onboarding_account",
        recordedAt: "2026-04-23T12:00:00.000Z",
      }],
    });
    const uow = createMemoryUnitOfWork({ merchant });
    await uow.onboarding.saveSession({
      id: "onb_existing",
      environment: "sandbox",
      merchantAccountId: merchant.id,
      status: "under_review",
      submittedAt: "2026-04-23T12:00:00.000Z",
      currentRequirementCount: 0,
      openRequirementCount: 0,
      processorRefs: [],
      createdAt: "2026-04-23T12:00:00.000Z",
      updatedAt: "2026-04-23T12:00:00.000Z",
    });

    const adapter: PaymentsProviderAdapter = {
      key: "finix",
      supportedCapabilities: ["merchant_onboarding"],
      async verifyWebhookSignature() { throw new Error("not used"); },
      async createMerchantOnboarding() { throw new Error("not used"); },
      async createPaymentIntent() { throw new Error("not used"); },
      async createRefund() { throw new Error("not used"); },
      async refreshMerchantOnboarding() {
        return {
          ok: true,
          value: {
            merchantStatus: "rejected",
            onboardingStatus: "rejected",
            processorRefs: [],
            requirements: [],
          },
        };
      },
      async createOnboardingRequirementUploadLink() { throw new Error("not used"); },
      async fetchObjectSnapshot() { throw new Error("not used"); },
    };

    const service = createMerchantOnboardingService({
      uow,
      providers: createRegistry(adapter),
      resolveProviderContext: () => providerContext,
      now: () => "2026-04-23T13:00:00.000Z",
    });

    expect(await service.refreshMerchantOnboardingSession({
      environment: "sandbox",
      merchantAccountId: merchant.id,
      onboardingSessionId: "onb_existing",
    })).toEqual({
      snapshot: {
        merchantAccountId: merchant.id,
        onboardingSessionId: "onb_existing",
        status: "rejected",
        requirementIds: [],
        openRequirementIds: [],
      },
      requirements: [],
    });

    expect(await uow.onboarding.getSessionById("onb_existing", { environment: "sandbox" })).toMatchObject({
      status: "rejected",
      rejectedAt: "2026-04-23T13:00:00.000Z",
      approvedAt: undefined,
    });
    expect(await uow.merchants.getById(merchant.id, { environment: "sandbox" })).toMatchObject({
      status: "rejected",
    });
    expect(await uow.merchantStates.getByMerchantAccountId(merchant.id, { environment: "sandbox" })).toMatchObject({
      merchantStatus: "rejected",
      onboardingStatus: "rejected",
      canAcceptPayments: false,
      payoutReadiness: "blocked",
      payoutBlockReason: "merchant_status:rejected",
    });
  });

  test("rejects Finix onboarding when percentage distributions or refund policy are invalid", async () => {
    const service = createMerchantOnboardingService({
      uow: createMemoryUnitOfWork({
        merchant: createMerchant({
          underwriting: {
            ...underwriting,
            refundPolicy: "SOMETHING_ELSE",
            cardVolumeDistribution: {
              cardPresentPercentage: 30,
              mailOrderTelephoneOrderPercentage: 10,
              ecommercePercentage: 50,
            },
          },
        }),
      }),
      providers: createRegistry(createUnusedOnboardingAdapter()),
      resolveProviderContext: () => providerContext,
    });

    await expect(service.submitMerchantOnboarding({
      environment: "sandbox",
      merchantAccountId: "merchant_123",
      submittedByType: "operator",
      submittedByRef: "user_123",
      consent,
    })).rejects.toMatchObject({
      code: "invalid_request",
      details: {
        invalidFields: expect.stringContaining("underwriting.cardVolumeDistribution must total 100"),
      },
    } satisfies Partial<MerchantOnboardingServiceError>);
  });

  test("rejects Finix onboarding when associated owner at or above 25 percent is not marked beneficial_owner", async () => {
    const service = createMerchantOnboardingService({
      uow: createMemoryUnitOfWork({
        merchant: createMerchant({
          associatedIdentities: [{
            identityRoles: ["OWNER"],
            relationType: "representative",
            principalPercentageOwnership: 25,
          }],
        }),
      }),
      providers: createRegistry(createUnusedOnboardingAdapter()),
      resolveProviderContext: () => providerContext,
    });

    await expect(service.submitMerchantOnboarding({
      environment: "sandbox",
      merchantAccountId: "merchant_123",
      submittedByType: "operator",
      submittedByRef: "user_123",
      consent,
    })).rejects.toMatchObject({
      code: "invalid_request",
      details: {
        invalidFields: expect.stringContaining("associatedIdentities.0.relationType must be beneficial_owner"),
      },
    } satisfies Partial<MerchantOnboardingServiceError>);
  });

  test("creates onboarding session, requirements, and merchant state", async () => {
    const uow = createMemoryUnitOfWork({ merchant: createMerchant() });
    const adapter: PaymentsProviderAdapter = {
      key: "finix",
      supportedCapabilities: ["merchant_onboarding"],
      async verifyWebhookSignature() {
        throw new Error("not used");
      },
      async createMerchantOnboarding(_context, input) {
        expect(input).toMatchObject({
          merchantAgreementAccepted: true,
          merchantAgreementAcceptedAt: consent.merchantAgreementAcceptedAt,
          merchantAgreementIpAddress: consent.merchantAgreementIpAddress,
          merchantAgreementUserAgent: consent.merchantAgreementUserAgent,
          underwriting,
        });
        return {
          ok: true,
          value: {
            onboardingRef: {
              provider: "finix",
              objectType: "identity",
              objectId: "id_123",
              relationship: "seller_identity",
              recordedAt: "2026-04-23T12:00:00.000Z",
            },
            accountRef: {
              provider: "finix",
              objectType: "merchant",
              objectId: "mu_123",
              relationship: "merchant_account",
              recordedAt: "2026-04-23T12:01:00.000Z",
            },
            status: "under_review",
            requirementRefs: ["ver_123", "cf_123"],
          },
        };
      },
      async createPaymentIntent() {
        throw new Error("not used");
      },
      async createRefund() {
        throw new Error("not used");
      },
      async createOnboardingRequirementUploadLink() {
        throw new Error("not used");
      },
      async fetchObjectSnapshot() {
        throw new Error("not used");
      },
    };

    const service = createMerchantOnboardingService({
      uow,
      providers: createRegistry(adapter),
      resolveProviderContext: () => providerContext,
      now: () => "2026-04-23T12:05:00.000Z",
      createId: (prefix) => `${prefix}_fixed`,
    });

    const snapshot = await service.submitMerchantOnboarding({
      environment: "sandbox",
      merchantAccountId: "merchant_123",
      submittedByType: "operator",
      submittedByRef: "user_123",
      consent,
      idempotencyKey: "idem_123",
    });

    expect(snapshot).toEqual({
      merchantAccountId: "merchant_123",
      onboardingSessionId: "onb_fixed",
      status: "under_review",
      requirementIds: [
        "merchant_123:provider_requirement:ver_123",
        "merchant_123:provider_requirement:cf_123",
      ],
      openRequirementIds: [
        "merchant_123:provider_requirement:ver_123",
        "merchant_123:provider_requirement:cf_123",
      ],
      metadata: {
        provider: "finix",
        submittedByType: "operator",
        submittedByRef: "user_123",
        merchantAgreementAcceptedAt: consent.merchantAgreementAcceptedAt,
        merchantAgreementIpAddress: consent.merchantAgreementIpAddress,
        merchantAgreementUserAgent: consent.merchantAgreementUserAgent,
        paymentTermsUrl: consent.paymentTermsUrl,
        paymentPrivacyUrl: consent.paymentPrivacyUrl,
        vortexTermsUrl: consent.vortexTermsUrl,
        vortexPrivacyUrl: consent.vortexPrivacyUrl,
        feeDisclosureVersion: consent.feeDisclosureVersion,
        feeDisclosureUrl: consent.feeDisclosureUrl,
        consentComponentVersion: consent.consentComponentVersion,
      },
    });

    const storedSession = await uow.onboarding.getSessionById("onb_fixed", { environment: "sandbox" });
    expect(storedSession).toMatchObject({
      merchantAccountId: "merchant_123",
      status: "under_review",
      currentRequirementCount: 2,
      openRequirementCount: 2,
      metadata: expect.objectContaining({
        feeDisclosureVersion: "fees-2026-05-18",
        consentComponentVersion: "vortex-payments-consent@0.1.0",
      }),
    });

    const storedRequirements = await uow.onboarding.listRequirementsForSession("onb_fixed", {
      environment: "sandbox",
    });
    expect(storedRequirements).toHaveLength(2);
    expect(storedRequirements.map((requirement) => requirement.providerRequirementRef)).toEqual([
      "ver_123",
      "cf_123",
    ]);

    const updatedMerchant = await uow.merchants.getById("merchant_123", { environment: "sandbox" });
    expect(updatedMerchant).toMatchObject({
      status: "pending_review",
      processorAccountRefs: [
        {
          provider: "finix",
          objectType: "merchant",
          objectId: "mu_123",
          relationship: "merchant_account",
          recordedAt: "2026-04-23T12:01:00.000Z",
        },
      ],
    });

    const merchantState = await uow.merchantStates.getByMerchantAccountId("merchant_123", {
      environment: "sandbox",
    });
    expect(merchantState).toMatchObject({
      onboardingSessionId: "onb_fixed",
      onboardingStatus: "under_review",
      canAcceptPayments: false,
      openRequirementIds: [
        "merchant_123:provider_requirement:ver_123",
        "merchant_123:provider_requirement:cf_123",
      ],
    });
    expect(await uow.events.getCanonicalEventById(
      "merchant_123:merchant_account.submitted:2026-04-23T12:05:00.000Z",
      { environment: "sandbox" },
    )).toMatchObject({
      eventType: "merchant_account.submitted",
      aggregateId: "merchant_123",
      payload: {
        merchantAccountId: "merchant_123",
        onboardingSessionId: "onb_fixed",
        submittedByType: "operator",
      },
    });

    const replay = await service.submitMerchantOnboarding({
      environment: "sandbox",
      merchantAccountId: "merchant_123",
      submittedByType: "operator",
      submittedByRef: "user_123",
      consent,
      idempotencyKey: "idem_123",
    });
    expect(replay).toEqual(snapshot);
  });
});
