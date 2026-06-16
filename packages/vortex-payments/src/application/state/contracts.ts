import type { CustomerProfileId, Environment, MerchantAccountId } from "../../domain/common";
import type { MerchantAccountStatus, MerchantCapability, MerchantOnboardingSessionStatus } from "../../domain/merchant";
import type { CustomerPaymentState, MerchantAccountState } from "../../domain/state";

export interface GetMerchantAccountStateQuery {
  readonly environment: Environment;
  readonly merchantAccountId: MerchantAccountId;
}

export interface GetMerchantAccountCapabilitiesQuery {
  readonly environment: Environment;
  readonly merchantAccountId: MerchantAccountId;
}

export interface MerchantCapabilitySnapshot extends Omit<MerchantCapability, "processorRefs"> {}

export interface MerchantAccountStateSnapshot {
  readonly merchantAccountId: MerchantAccountId;
  readonly environment: Environment;
  readonly merchantStatus: MerchantAccountStatus;
  readonly onboardingSessionId?: string;
  readonly onboardingStatus?: MerchantOnboardingSessionStatus;
  readonly openRequirementIds: readonly string[];
  readonly activeCapabilityKeys: readonly string[];
  readonly restrictedCapabilityKeys: readonly string[];
  readonly canAcceptPayments: boolean;
  readonly payoutReadiness: MerchantAccountState["payoutReadiness"];
  readonly payoutBlockReason?: string;
  readonly defaultPayoutAccountId?: string;
  readonly defaultPaymentMethodId?: string;
  readonly latestSettlementStatus?: MerchantAccountState["latestSettlementStatus"];
  readonly latestPayoutStatus?: MerchantAccountState["latestPayoutStatus"];
  readonly capabilitySnapshots: readonly MerchantCapabilitySnapshot[];
  readonly generatedAt: string;
}

export interface MerchantAccountCapabilitiesSnapshot {
  readonly merchantAccountId: MerchantAccountId;
  readonly environment: Environment;
  readonly activeCapabilityKeys: readonly string[];
  readonly restrictedCapabilityKeys: readonly string[];
  readonly capabilities: readonly MerchantCapabilitySnapshot[];
  readonly generatedAt: string;
}

export interface GetCustomerPaymentStateQuery {
  readonly environment: Environment;
  readonly merchantAccountId: MerchantAccountId;
  readonly customerProfileId: CustomerProfileId;
}

export interface MerchantStateReader {
  getMerchantAccountState(query: GetMerchantAccountStateQuery): Promise<MerchantAccountStateSnapshot | null>;
  getMerchantAccountCapabilities(
    query: GetMerchantAccountCapabilitiesQuery,
  ): Promise<MerchantAccountCapabilitiesSnapshot | null>;
  getCustomerPaymentState(query: GetCustomerPaymentStateQuery): Promise<CustomerPaymentState | null>;
}
