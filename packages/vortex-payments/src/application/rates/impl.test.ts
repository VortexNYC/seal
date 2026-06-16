import { describe, expect, test } from "vitest";
import type { Environment, MerchantAccountId, PlatformTenantId, ProcessorRef } from "../../domain/common";
import type { MerchantRateAssignment, PaymentRatePlan } from "../../domain/rates";
import type {
  MerchantRateAssignmentRepository,
  PaymentRatePlanRepository,
  PaymentRatesProviderPort,
} from "./contracts";
import { createPaymentRatesService, PaymentRatesServiceError } from "./impl";

const environment: Environment = "sandbox";
const tenantId: PlatformTenantId = "tenant_1";
const merchantAccountId: MerchantAccountId = "ma_1";

function ref(objectType: string, objectId: string, relationship: string): ProcessorRef {
  return {
    provider: "finix",
    objectType,
    objectId,
    relationship,
    recordedAt: "2026-05-15T00:00:00.000Z",
  };
}

function createMemoryRatePlanRepository(seed: readonly PaymentRatePlan[] = []): PaymentRatePlanRepository {
  const records = new Map(seed.map((record) => [record.id, record]));
  return {
    async getById(id, requestedEnvironment) {
      const record = records.get(id) ?? null;
      return record?.environment === requestedEnvironment ? record : null;
    },
    async getLatestByCode(requestedEnvironment, requestedTenantId, code) {
      const matching = [...records.values()]
        .filter((record) => record.environment === requestedEnvironment && record.tenantId === requestedTenantId && record.code === code)
        .sort((left, right) => right.version - left.version);
      return matching[0] ?? null;
    },
    async save(record) {
      records.set(record.id, record);
    },
  };
}

function createMemoryAssignmentRepository(seed: readonly MerchantRateAssignment[] = []): MerchantRateAssignmentRepository {
  const records = new Map(seed.map((record) => [record.id, record]));
  return {
    async getById(id, requestedEnvironment) {
      const record = records.get(id) ?? null;
      return record?.environment === requestedEnvironment ? record : null;
    },
    async getActiveByMerchant(requestedEnvironment, requestedMerchantAccountId) {
      return [...records.values()].find(
        (record) => record.environment === requestedEnvironment && record.merchantAccountId === requestedMerchantAccountId && record.status === "active",
      ) ?? null;
    },
    async save(record) {
      records.set(record.id, record);
    },
  };
}

function createProvider(): PaymentRatesProviderPort {
  return {
    async createFeeProfile() {
      return { feeProfileRef: ref("fee_profile", "FP_123", "rate_plan_fee_profile") };
    },
    async assignMerchantFeeProfile({ plan }) {
      if (plan.providerFeeProfileRef === undefined) {
        throw new Error("missing fee profile");
      }
      return {
        merchantProfileRef: ref("merchant_profile", "MP_123", "merchant_profile"),
        feeProfileRef: plan.providerFeeProfileRef,
        verifiedTransferRef: ref("transfer", "TR_123", "rate_assignment_verification_transfer"),
        linkedFeeCount: 2,
      };
    },
  };
}

function createService(seed?: { readonly ratePlans?: readonly PaymentRatePlan[]; readonly assignments?: readonly MerchantRateAssignment[] }) {
  let idCounter = 0;
  return createPaymentRatesService({
    ratePlans: createMemoryRatePlanRepository(seed?.ratePlans),
    assignments: createMemoryAssignmentRepository(seed?.assignments),
    provider: createProvider(),
    now: () => "2026-05-15T00:00:00.000Z",
    createId: (prefix) => `${prefix}_${++idCounter}`,
  });
}

describe("createPaymentRatesService", () => {
  test("creates, syncs, activates, and assigns a Finix-backed merchant rate plan", async () => {
    const service = createService();

    const draft = await service.createDraftRatePlan({
      environment,
      tenantId,
      code: "standard",
      displayName: "Standard",
      pricingStrategy: "blended",
      rates: {
        cardBasisPoints: 290,
        cardFixedFee: 30,
        achBasisPoints: 80,
        achFixedFee: 25,
        disputeFixedFee: 1500,
      },
    });
    expect(draft.status).toBe("draft");
    expect(draft.providerSyncStatus).toBe("not_synced");

    const synced = await service.syncRatePlanToProvider({ environment, ratePlanId: draft.id });
    expect(synced.providerSyncStatus).toBe("synced");
    expect(synced.providerFeeProfileRef?.objectId).toBe("FP_123");

    const active = await service.activateRatePlan({ environment, ratePlanId: draft.id });
    expect(active.status).toBe("active");

    const assignment = await service.assignMerchantRatePlan({
      environment,
      tenantId,
      merchantAccountId,
      ratePlanId: active.id,
      providerMerchantRef: ref("merchant", "MU_123", "merchant_account"),
      verifyWithTransfer: true,
    });
    expect(assignment.status).toBe("active");
    expect(assignment.providerMerchantProfileRef?.objectId).toBe("MP_123");
    expect(assignment.providerFeeProfileRef?.objectId).toBe("FP_123");
    expect(assignment.providerVerifiedTransferRef?.objectId).toBe("TR_123");
    expect(assignment.providerLinkedFeeCount).toBe(2);
  });

  test("blocks activation before provider sync", async () => {
    const service = createService();
    const draft = await service.createDraftRatePlan({
      environment,
      tenantId,
      code: "standard",
      displayName: "Standard",
      pricingStrategy: "blended",
      rates: { cardBasisPoints: 290, cardFixedFee: 30, achBasisPoints: 0, achFixedFee: 0 },
    });

    await expect(service.activateRatePlan({ environment, ratePlanId: draft.id })).rejects.toMatchObject({
      code: "conflict",
    } satisfies Partial<PaymentRatesServiceError>);
  });

  test("rejects Finix fee profiles without explicit ACH pricing fields", async () => {
    const service = createService();

    await expect(service.createDraftRatePlan({
      environment,
      tenantId,
      code: "missing-ach",
      displayName: "Missing ACH",
      pricingStrategy: "blended",
      rates: { cardBasisPoints: 290, cardFixedFee: 30 },
    })).rejects.toMatchObject({
      code: "invalid_request",
      message: "achBasisPoints is required for Finix fee profile sync; use 0 when the rail should be priced at zero",
    } satisfies Partial<PaymentRatesServiceError>);
  });

  test("archives previous active merchant assignment when assigning a new rate plan", async () => {
    const previous: MerchantRateAssignment = {
      id: "assignment_previous",
      environment,
      tenantId,
      merchantAccountId,
      ratePlanId: "rate_plan_previous",
      status: "active",
      provider: "finix",
      providerMerchantRef: ref("merchant", "MU_123", "merchant_account"),
      providerFeeProfileRef: ref("fee_profile", "FP_old", "rate_plan_fee_profile"),
      createdAt: "2026-05-14T00:00:00.000Z",
      updatedAt: "2026-05-14T00:00:00.000Z",
    };
    const service = createService({ assignments: [previous] });
    const draft = await service.createDraftRatePlan({
      environment,
      tenantId,
      code: "standard",
      displayName: "Standard",
      pricingStrategy: "blended",
      rates: { cardBasisPoints: 290, cardFixedFee: 30, achBasisPoints: 0, achFixedFee: 0 },
    });
    const synced = await service.syncRatePlanToProvider({ environment, ratePlanId: draft.id });
    const active = await service.activateRatePlan({ environment, ratePlanId: synced.id });

    const assignment = await service.assignMerchantRatePlan({
      environment,
      tenantId,
      merchantAccountId,
      ratePlanId: active.id,
      providerMerchantRef: ref("merchant", "MU_123", "merchant_account"),
    });

    expect(assignment.status).toBe("active");
    expect(assignment.id).not.toBe(previous.id);
  });
});
