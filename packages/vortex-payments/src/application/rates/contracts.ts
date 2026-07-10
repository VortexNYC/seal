import type {
  Environment,
  MerchantAccountId,
  PlatformTenantId,
  ProcessorRef,
} from "../../domain/common";
import type {
  MerchantRateAssignment,
  MerchantRateAssignmentId,
  PaymentRateAmounts,
  PaymentRatePlan,
  PaymentRatePlanId,
  PaymentRatePricingStrategy,
} from "../../domain/rates";

export interface CreatePaymentRatePlanInput {
  readonly environment: Environment;
  readonly tenantId: PlatformTenantId;
  readonly code: string;
  readonly displayName: string;
  readonly pricingStrategy: PaymentRatePricingStrategy;
  readonly rates: PaymentRateAmounts;
}

export interface ActivatePaymentRatePlanInput {
  readonly environment: Environment;
  readonly ratePlanId: PaymentRatePlanId;
  readonly effectiveAt?: string;
}

export interface SyncPaymentRatePlanProviderInput {
  readonly environment: Environment;
  readonly ratePlanId: PaymentRatePlanId;
}

export interface AssignMerchantRatePlanInput {
  readonly environment: Environment;
  readonly tenantId: PlatformTenantId;
  readonly merchantAccountId: MerchantAccountId;
  readonly ratePlanId: PaymentRatePlanId;
  readonly providerMerchantRef: ProcessorRef;
  readonly verifyWithTransfer?: boolean;
}

export interface PaymentRatePlanRepository {
  getById(id: PaymentRatePlanId, environment: Environment): Promise<PaymentRatePlan | null>;
  getLatestByCode(
    environment: Environment,
    tenantId: PlatformTenantId,
    code: string,
  ): Promise<PaymentRatePlan | null>;
  save(record: PaymentRatePlan): Promise<void>;
}

export interface MerchantRateAssignmentRepository {
  getById(
    id: MerchantRateAssignmentId,
    environment: Environment,
  ): Promise<MerchantRateAssignment | null>;
  getActiveByMerchant(
    environment: Environment,
    merchantAccountId: MerchantAccountId,
  ): Promise<MerchantRateAssignment | null>;
  save(record: MerchantRateAssignment): Promise<void>;
}

export interface ProviderRatePlanSyncResult {
  readonly feeProfileRef: ProcessorRef;
}

export interface ProviderMerchantRateAssignmentResult {
  readonly merchantProfileRef: ProcessorRef;
  readonly feeProfileRef: ProcessorRef;
  readonly verifiedTransferRef?: ProcessorRef;
  readonly linkedFeeCount?: number;
}

export interface PaymentRatesProviderPort {
  createFeeProfile(
    plan: PaymentRatePlan,
    input?: { readonly idempotencyKey?: string },
  ): Promise<ProviderRatePlanSyncResult>;
  assignMerchantFeeProfile(input: {
    readonly assignment: MerchantRateAssignment;
    readonly plan: PaymentRatePlan;
    readonly verifyWithTransfer?: boolean;
  }): Promise<ProviderMerchantRateAssignmentResult>;
}

export interface PaymentRatesService {
  createDraftRatePlan(input: CreatePaymentRatePlanInput): Promise<PaymentRatePlan>;
  activateRatePlan(input: ActivatePaymentRatePlanInput): Promise<PaymentRatePlan>;
  syncRatePlanToProvider(input: SyncPaymentRatePlanProviderInput): Promise<PaymentRatePlan>;
  assignMerchantRatePlan(input: AssignMerchantRatePlanInput): Promise<MerchantRateAssignment>;
}
