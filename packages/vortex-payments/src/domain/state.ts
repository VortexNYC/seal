import type {
  Environment,
  IsoTimestamp,
  MerchantAccountId,
  MerchantOnboardingSessionId,
  MerchantRequirementId,
  PaymentMethodId,
  PayoutAccountId,
} from "./common";
import type { MerchantAccountStatus, MerchantCapability, MerchantOnboardingSessionStatus } from "./merchant";
import type { PayoutStatus, SettlementStatus } from "./funds";

export type MerchantPayoutReadiness = "ready" | "paused" | "blocked" | "unknown";

export interface MerchantAccountState {
  readonly merchantAccountId: MerchantAccountId;
  readonly environment: Environment;
  readonly merchantStatus: MerchantAccountStatus;
  readonly onboardingSessionId?: MerchantOnboardingSessionId;
  readonly onboardingStatus?: MerchantOnboardingSessionStatus;
  readonly openRequirementIds: readonly MerchantRequirementId[];
  readonly activeCapabilityKeys: readonly string[];
  readonly restrictedCapabilityKeys: readonly string[];
  readonly canAcceptPayments: boolean;
  readonly payoutReadiness: MerchantPayoutReadiness;
  readonly payoutBlockReason?: string;
  readonly defaultPayoutAccountId?: PayoutAccountId;
  readonly defaultPaymentMethodId?: PaymentMethodId;
  readonly latestSettlementStatus?: SettlementStatus;
  readonly latestPayoutStatus?: PayoutStatus;
  readonly capabilitySnapshots: readonly MerchantCapability[];
  readonly generatedAt: IsoTimestamp;
}

export type CustomerPaymentReadiness = "ready" | "action_required" | "blocked" | "unknown";

export interface CustomerPaymentState {
  readonly customerProfileId: string;
  readonly merchantAccountId: MerchantAccountId;
  readonly environment: Environment;
  readonly defaultPaymentMethodId?: PaymentMethodId;
  readonly activePaymentMethodIds: readonly PaymentMethodId[];
  readonly requiresActionPaymentIntentIds: readonly string[];
  readonly latestPaymentIntentStatus?: string;
  readonly readiness: CustomerPaymentReadiness;
  readonly generatedAt: IsoTimestamp;
}
