import type { ProcessorRef } from "../../domain/common";
import type {
  MerchantRateAssignment,
  PaymentRateAmounts,
  PaymentRatePlan,
} from "../../domain/rates";
import type {
  ActivatePaymentRatePlanInput,
  AssignMerchantRatePlanInput,
  CreatePaymentRatePlanInput,
  MerchantRateAssignmentRepository,
  PaymentRatePlanRepository,
  PaymentRatesProviderPort,
  PaymentRatesService,
  SyncPaymentRatePlanProviderInput,
} from "./contracts";

export type PaymentRatesServiceErrorCode =
  | "invalid_request"
  | "not_found"
  | "conflict"
  | "provider_error";

export class PaymentRatesServiceError extends Error {
  constructor(
    readonly code: PaymentRatesServiceErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "PaymentRatesServiceError";
  }
}

export interface CreatePaymentRatesServiceArgs {
  readonly ratePlans: PaymentRatePlanRepository;
  readonly assignments: MerchantRateAssignmentRepository;
  readonly provider: PaymentRatesProviderPort;
  readonly now?: () => string;
  readonly createId?: (prefix: string) => string;
}

interface PaymentRatesRuntime {
  readonly ratePlans: PaymentRatePlanRepository;
  readonly assignments: MerchantRateAssignmentRepository;
  readonly provider: PaymentRatesProviderPort;
  readonly now: () => string;
  readonly createId: (prefix: string) => string;
}

function defaultNow(): string {
  return new Date().toISOString();
}

function defaultCreateId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

function assertNonNegativeInteger(value: number | null | undefined, field: string): void {
  if (value === null || value === undefined) {
    return;
  }
  if (!Number.isInteger(value) || value < 0) {
    throw new PaymentRatesServiceError(
      "invalid_request",
      `${field} must be a non-negative integer`,
    );
  }
}

function requireNonNegativeInteger(value: number | null | undefined, field: string): void {
  if (value === null || value === undefined) {
    throw new PaymentRatesServiceError(
      "invalid_request",
      `${field} is required for Finix fee profile sync; use 0 when the rail should be priced at zero`,
    );
  }
  assertNonNegativeInteger(value, field);
}

function validateRates(rates: PaymentRateAmounts): void {
  requireNonNegativeInteger(rates.achBasisPoints, "achBasisPoints");
  requireNonNegativeInteger(rates.achFixedFee, "achFixedFee");
  requireNonNegativeInteger(rates.cardBasisPoints, "cardBasisPoints");
  requireNonNegativeInteger(rates.cardFixedFee, "cardFixedFee");
  assertNonNegativeInteger(rates.achBasisPointsFeeLimit, "achBasisPointsFeeLimit");
  assertNonNegativeInteger(rates.achCreditReturnFixedFee, "achCreditReturnFixedFee");
  assertNonNegativeInteger(rates.achDebitReturnFixedFee, "achDebitReturnFixedFee");
  assertNonNegativeInteger(rates.achFixedFee, "achFixedFee");
  assertNonNegativeInteger(rates.cardBasisPoints, "cardBasisPoints");
  assertNonNegativeInteger(rates.cardCrossBorderBasisPoints, "cardCrossBorderBasisPoints");
  assertNonNegativeInteger(rates.cardFixedFee, "cardFixedFee");
  assertNonNegativeInteger(rates.disputeFixedFee, "disputeFixedFee");
}

function providerFeeProfileRef(plan: PaymentRatePlan): ProcessorRef | undefined {
  return plan.providerFeeProfileRef;
}

async function createDraftRatePlan(
  runtime: PaymentRatesRuntime,
  input: CreatePaymentRatePlanInput,
): Promise<PaymentRatePlan> {
  validateRates(input.rates);
  const latest = await runtime.ratePlans.getLatestByCode(
    input.environment,
    input.tenantId,
    input.code,
  );
  if (latest !== null && latest.status !== "archived") {
    throw new PaymentRatesServiceError(
      "conflict",
      "rate plan code already has an unarchived version",
    );
  }
  const timestamp = runtime.now();
  const record: PaymentRatePlan = {
    id: runtime.createId("rate_plan"),
    environment: input.environment,
    tenantId: input.tenantId,
    code: input.code,
    version: (latest?.version ?? 0) + 1,
    displayName: input.displayName,
    status: "draft",
    pricingStrategy: input.pricingStrategy,
    rates: input.rates,
    provider: "finix",
    providerSyncStatus: "not_synced",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  await runtime.ratePlans.save(record);
  return record;
}

async function activateRatePlan(
  runtime: PaymentRatesRuntime,
  input: ActivatePaymentRatePlanInput,
): Promise<PaymentRatePlan> {
  const existing = await runtime.ratePlans.getById(input.ratePlanId, input.environment);
  if (existing === null) {
    throw new PaymentRatesServiceError("not_found", "rate plan not found");
  }
  if (existing.status !== "draft") {
    throw new PaymentRatesServiceError("conflict", "only draft rate plans can be activated");
  }
  if (providerFeeProfileRef(existing) === undefined || existing.providerSyncStatus !== "synced") {
    throw new PaymentRatesServiceError(
      "conflict",
      "rate plan must be synced to provider before activation",
    );
  }
  const activated: PaymentRatePlan = {
    ...existing,
    status: "active",
    effectiveAt: input.effectiveAt ?? runtime.now(),
    updatedAt: runtime.now(),
  };
  await runtime.ratePlans.save(activated);
  return activated;
}

async function syncRatePlanToProvider(
  runtime: PaymentRatesRuntime,
  input: SyncPaymentRatePlanProviderInput,
): Promise<PaymentRatePlan> {
  const existing = await runtime.ratePlans.getById(input.ratePlanId, input.environment);
  if (existing === null) {
    throw new PaymentRatesServiceError("not_found", "rate plan not found");
  }
  if (existing.status !== "draft") {
    throw new PaymentRatesServiceError("conflict", "only draft rate plans can be synced");
  }
  try {
    const sync = await runtime.provider.createFeeProfile(existing);
    const synced: PaymentRatePlan = {
      ...existing,
      providerFeeProfileRef: sync.feeProfileRef,
      providerSyncStatus: "synced",
      providerSyncError: undefined,
      updatedAt: runtime.now(),
    };
    await runtime.ratePlans.save(synced);
    return synced;
  } catch (error) {
    const failed: PaymentRatePlan = {
      ...existing,
      providerSyncStatus: "failed",
      providerSyncError: error instanceof Error ? error.message : "provider sync failed",
      updatedAt: runtime.now(),
    };
    await runtime.ratePlans.save(failed);
    throw new PaymentRatesServiceError(
      "provider_error",
      failed.providerSyncError ?? "provider sync failed",
    );
  }
}

async function assignMerchantRatePlan(
  runtime: PaymentRatesRuntime,
  input: AssignMerchantRatePlanInput,
): Promise<MerchantRateAssignment> {
  const plan = await runtime.ratePlans.getById(input.ratePlanId, input.environment);
  if (plan === null) {
    throw new PaymentRatesServiceError("not_found", "rate plan not found");
  }
  if (plan.status !== "active") {
    throw new PaymentRatesServiceError("conflict", "only active rate plans can be assigned");
  }
  if (plan.providerFeeProfileRef === undefined || plan.providerSyncStatus !== "synced") {
    throw new PaymentRatesServiceError(
      "conflict",
      "rate plan must have synced provider fee profile",
    );
  }
  if (
    input.providerMerchantRef.provider !== "finix" ||
    input.providerMerchantRef.objectType !== "merchant"
  ) {
    throw new PaymentRatesServiceError(
      "invalid_request",
      "merchant rate assignment requires a Finix merchant processor ref",
    );
  }
  const timestamp = runtime.now();
  const previous = await runtime.assignments.getActiveByMerchant(
    input.environment,
    input.merchantAccountId,
  );
  if (previous !== null) {
    await runtime.assignments.save({
      ...previous,
      status: "archived",
      supersededAt: timestamp,
      updatedAt: timestamp,
    });
  }
  const pending: MerchantRateAssignment = {
    id: runtime.createId("rate_assignment"),
    environment: input.environment,
    tenantId: input.tenantId,
    merchantAccountId: input.merchantAccountId,
    ratePlanId: plan.id,
    status: "pending_provider_sync",
    provider: "finix",
    providerMerchantRef: input.providerMerchantRef,
    providerFeeProfileRef: plan.providerFeeProfileRef,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  await runtime.assignments.save(pending);
  try {
    const result = await runtime.provider.assignMerchantFeeProfile({
      assignment: pending,
      plan,
      verifyWithTransfer: input.verifyWithTransfer,
    });
    const active: MerchantRateAssignment = {
      ...pending,
      status: "active",
      providerMerchantProfileRef: result.merchantProfileRef,
      providerFeeProfileRef: result.feeProfileRef,
      providerVerifiedTransferRef: result.verifiedTransferRef,
      providerLinkedFeeCount: result.linkedFeeCount,
      assignedAt: timestamp,
      verifiedAt: runtime.now(),
      updatedAt: runtime.now(),
    };
    await runtime.assignments.save(active);
    return active;
  } catch (error) {
    const failed: MerchantRateAssignment = {
      ...pending,
      status: "failed",
      failureReason: error instanceof Error ? error.message : "provider assignment failed",
      updatedAt: runtime.now(),
    };
    await runtime.assignments.save(failed);
    throw new PaymentRatesServiceError(
      "provider_error",
      failed.failureReason ?? "provider assignment failed",
    );
  }
}

export function createPaymentRatesService(
  args: CreatePaymentRatesServiceArgs,
): PaymentRatesService {
  const runtime: PaymentRatesRuntime = {
    ratePlans: args.ratePlans,
    assignments: args.assignments,
    provider: args.provider,
    now: args.now ?? defaultNow,
    createId: args.createId ?? defaultCreateId,
  };

  return {
    async createDraftRatePlan(input) {
      return createDraftRatePlan(runtime, input);
    },
    async activateRatePlan(input) {
      return activateRatePlan(runtime, input);
    },
    async syncRatePlanToProvider(input) {
      return syncRatePlanToProvider(runtime, input);
    },
    async assignMerchantRatePlan(input) {
      return assignMerchantRatePlan(runtime, input);
    },
  };
}
