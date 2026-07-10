import type { MerchantCapability } from "../../domain/merchant";
import type { Payout } from "../../domain/funds";
import type {
  MerchantAccount,
  MerchantOnboardingSession,
  MerchantRequirement,
} from "../../domain/merchant";
import type { MerchantAccountState, MerchantPayoutReadiness } from "../../domain/state";
import type { PaymentMethodId, PayoutAccountId } from "../../domain/common";

export interface DeriveMerchantAccountStateInput {
  readonly merchant: MerchantAccount;
  readonly onboardingSession?: MerchantOnboardingSession | null;
  readonly requirements?: readonly MerchantRequirement[];
  readonly capabilities?: readonly MerchantCapability[];
  readonly latestPayout?: Payout | null;
  readonly defaultPayoutAccountId?: PayoutAccountId;
  readonly defaultPaymentMethodId?: PaymentMethodId;
  readonly generatedAt: string;
}

function deriveCanAcceptPayments(
  merchant: MerchantAccount,
  onboardingSession?: MerchantOnboardingSession | null,
  capabilities?: readonly MerchantCapability[],
): boolean {
  if (merchant.status !== "active") {
    return false;
  }

  if (onboardingSession && !["approved", "restricted"].includes(onboardingSession.status)) {
    return false;
  }

  if (!capabilities || capabilities.length === 0) {
    return true;
  }

  const processingCapability = capabilities.find(
    (capability) => capability.capabilityKey === "card_payments",
  );
  if (!processingCapability) {
    return true;
  }

  return processingCapability.status === "active";
}

function derivePayoutReadiness(
  merchant: MerchantAccount,
  onboardingSession?: MerchantOnboardingSession | null,
  requirements?: readonly MerchantRequirement[],
  capabilities?: readonly MerchantCapability[],
  latestPayout?: Payout | null,
): { readiness: MerchantPayoutReadiness; reason?: string } {
  if (merchant.status === "rejected" || merchant.status === "disabled") {
    return { readiness: "blocked", reason: `merchant_status:${merchant.status}` };
  }

  if (merchant.status === "restricted") {
    return { readiness: "paused", reason: `merchant_status:${merchant.status}` };
  }

  if (onboardingSession?.status === "rejected") {
    return { readiness: "blocked", reason: `onboarding_status:${onboardingSession.status}` };
  }

  const openRequirements = (requirements ?? []).filter((requirement) =>
    ["pending", "failed"].includes(requirement.status),
  );

  if (openRequirements.length > 0) {
    return {
      readiness: "paused",
      reason: "open_requirements",
    };
  }

  const payoutCapability = (capabilities ?? []).find(
    (capability) => capability.capabilityKey === "payouts",
  );
  if (payoutCapability && payoutCapability.status !== "active") {
    return {
      readiness: payoutCapability.status === "restricted" ? "paused" : "blocked",
      reason: `capability:${payoutCapability.status}`,
    };
  }

  if (latestPayout?.status === "held") {
    return { readiness: "paused", reason: "latest_payout:held" };
  }

  if (merchant.status === "active") {
    return { readiness: "ready" };
  }

  return { readiness: "unknown" };
}

export function deriveMerchantAccountState(
  input: DeriveMerchantAccountStateInput,
): MerchantAccountState {
  const requirements = input.requirements ?? [];
  const capabilities = input.capabilities ?? [];
  const openRequirements = requirements.filter((requirement) =>
    ["pending", "failed"].includes(requirement.status),
  );
  const activeCapabilities = capabilities.filter((capability) => capability.status === "active");
  const restrictedCapabilities = capabilities.filter(
    (capability) => capability.status !== "active",
  );
  const payoutReadiness = derivePayoutReadiness(
    input.merchant,
    input.onboardingSession,
    requirements,
    capabilities,
    input.latestPayout,
  );

  return {
    merchantAccountId: input.merchant.id,
    environment: input.merchant.environment,
    merchantStatus: input.merchant.status,
    onboardingSessionId: input.onboardingSession?.id,
    onboardingStatus: input.onboardingSession?.status,
    openRequirementIds: openRequirements.map((requirement) => requirement.id),
    activeCapabilityKeys: activeCapabilities.map((capability) => capability.capabilityKey),
    restrictedCapabilityKeys: restrictedCapabilities.map((capability) => capability.capabilityKey),
    canAcceptPayments: deriveCanAcceptPayments(
      input.merchant,
      input.onboardingSession,
      capabilities,
    ),
    payoutReadiness: payoutReadiness.readiness,
    payoutBlockReason: payoutReadiness.reason,
    defaultPayoutAccountId: input.defaultPayoutAccountId,
    defaultPaymentMethodId: input.defaultPaymentMethodId,
    latestPayoutStatus: input.latestPayout?.status,
    capabilitySnapshots: capabilities,
    generatedAt: input.generatedAt,
  };
}
