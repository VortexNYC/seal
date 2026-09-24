import { PLAN_LIMITS } from "@/lib/plan-limits";

/**
 * Plan gating is unlocked while Seal org billing is rebuilt.
 * Merchant payments / Finix-era billing UI and APIs were removed;
 * do not reintroduce tier locks against the old subscription surface.
 */
export function useSubscriptionLimits() {
  const features = PLAN_LIMITS.enterprise;

  return {
    isPro: true,
    isEnterprise: true,
    isLoading: false,
    tier: "enterprise" as const,
    subscription: null,
    canCreateTemplates: features.templates,
    canBrand: features.branding,
    canUseAPI: features.api,
    canUseWebhooks: features.webhooks,
    canUseSSO: features.sso,
    maxSeats: features.maxSeats,
  };
}
