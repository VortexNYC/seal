import type { ProcessorRef } from "../../domain/common";
import type { MerchantRateAssignment, PaymentRateAmounts, PaymentRatePlan } from "../../domain/rates";
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
    throw new PaymentRatesServiceError("invalid_request", `${field} must be a non-negative integer`);
  }
}

function requireNonNegativeInteger(value: number | null | undefined, field: string): void {
  if (value === null || value === undefined) {
    throw new PaymentRatesServiceError("invalid_request", `${field} is required for Finix fee profile sync; use 0 when the rail should be priced at zero`);
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

export function createPaymentRatesService(args: CreatePaymentRatesServiceArgs): PaymentRatesService {
  const now = args.now ?? defaultNow;
  const createId = args.createId ?? defaultCreateId;

  return {
    async createDraftRatePlan(input: CreatePaymentRatePlanInput): Promise<PaymentRatePlan> {
      validateRates(input.rates);
      const latest = await args.ratePlans.getLatestByCode(input.environment, input.tenantId, input.code);
      if (latest !== null && latest.status !== "archived") {
        throw new PaymentRatesServiceError("conflict", "rate plan code already has an unarchived version");
      }
      const timestamp = now();
      const record: PaymentRatePlan = {
        id: createId("rate_plan"),
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
      await args.ratePlans.save(record);
      return record;
    },

    async activateRatePlan(input: ActivatePaymentRatePlanInput): Promise<PaymentRatePlan> {
      const existing = await args.ratePlans.getById(input.ratePlanId, input.environment);
      if (existing === null) {
        throw new PaymentRatesServiceError("not_found", "rate plan not found");
      }
      if (existing.status !== "draft") {
        throw new PaymentRatesServiceError("conflict", "only draft rate plans can be activated");
      }
      if (providerFeeProfileRef(existing) === undefined || existing.providerSyncStatus !== "synced") {
        throw new PaymentRatesServiceError("conflict", "rate plan must be synced to provider before activation");
      }
      const activated: PaymentRatePlan = {
        ...existing,
        status: "active",
        effectiveAt: input.effectiveAt ?? now(),
        updatedAt: now(),
      };
      await args.ratePlans.save(activated);
      return activated;
    },

    async syncRatePlanToProvider(input: SyncPaymentRatePlanProviderInput): Promise<PaymentRatePlan> {
      const existing = await args.ratePlans.getById(input.ratePlanId, input.environment);
      if (existing === null) {
        throw new PaymentRatesServiceError("not_found", "rate plan not found");
      }
      if (existing.status !== "draft") {
        throw new PaymentRatesServiceError("conflict", "only draft rate plans can be synced");
      }
      try {
        const sync = await args.provider.createFeeProfile(existing);
        const synced: PaymentRatePlan = {
          ...existing,
          providerFeeProfileRef: sync.feeProfileRef,
          providerSyncStatus: "synced",
          providerSyncError: undefined,
          updatedAt: now(),
        };
        await args.ratePlans.save(synced);
        return synced;
      } catch (error) {
        const failed: PaymentRatePlan = {
          ...existing,
          providerSyncStatus: "failed",
          providerSyncError: error instanceof Error ? error.message : "provider sync failed",
          updatedAt: now(),
        };
        await args.ratePlans.save(failed);
        throw new PaymentRatesServiceError("provider_error", failed.providerSyncError ?? "provider sync failed");
      }
    },

    async assignMerchantRatePlan(input: AssignMerchantRatePlanInput): Promise<MerchantRateAssignment> {
      const plan = await args.ratePlans.getById(input.ratePlanId, input.environment);
      if (plan === null) {
        throw new PaymentRatesServiceError("not_found", "rate plan not found");
      }
      if (plan.status !== "active") {
        throw new PaymentRatesServiceError("conflict", "only active rate plans can be assigned");
      }
      if (plan.providerFeeProfileRef === undefined || plan.providerSyncStatus !== "synced") {
        throw new PaymentRatesServiceError("conflict", "rate plan must have synced provider fee profile");
      }
      if (input.providerMerchantRef.provider !== "finix" || input.providerMerchantRef.objectType !== "merchant") {
        throw new PaymentRatesServiceError("invalid_request", "merchant rate assignment requires a Finix merchant processor ref");
      }
      const timestamp = now();
      const previous = await args.assignments.getActiveByMerchant(input.environment, input.merchantAccountId);
      if (previous !== null) {
        await args.assignments.save({
          ...previous,
          status: "archived",
          supersededAt: timestamp,
          updatedAt: timestamp,
        });
      }
      const pending: MerchantRateAssignment = {
        id: createId("rate_assignment"),
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
      await args.assignments.save(pending);
      try {
        const result = await args.provider.assignMerchantFeeProfile({
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
          verifiedAt: now(),
          updatedAt: now(),
        };
        await args.assignments.save(active);
        return active;
      } catch (error) {
        const failed: MerchantRateAssignment = {
          ...pending,
          status: "failed",
          failureReason: error instanceof Error ? error.message : "provider assignment failed",
          updatedAt: now(),
        };
        await args.assignments.save(failed);
        throw new PaymentRatesServiceError("provider_error", failed.failureReason ?? "provider assignment failed");
      }
    },
  };
}
