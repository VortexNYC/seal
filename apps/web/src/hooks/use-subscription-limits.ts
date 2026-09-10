import { useQuery } from "@tanstack/react-query";

import { getCurrentSubscription } from "@/lib/api-client";
import { PLAN_LIMITS } from "@/lib/plan-limits";
import { parseSelectValue } from "@/lib/select-values";

const PLAN_TIERS = [
  "free",
  "pro",
  "enterprise",
] as const satisfies readonly (keyof typeof PLAN_LIMITS)[];

/**
 * Hook for checking subscription plan limits in the UI.
 *
 * Pulls the active organization plan from the Worker and provides helpers
 * for conditionally rendering tier-gated features.
 */
export function useSubscriptionLimits() {
  const { data: subscription, isLoading } = useQuery({
    queryKey: ["api", "users", "me", "subscription"],
    queryFn: getCurrentSubscription,
  });

  const tier =
    parseSelectValue(subscription?.plan ?? "free", PLAN_TIERS) ?? "free";

  const isPro = tier === "pro" || tier === "enterprise";
  const isEnterprise = tier === "enterprise";

  const features = PLAN_LIMITS[tier] ?? PLAN_LIMITS.free;

  return {
    isPro,
    isEnterprise,
    isLoading,
    tier,
    subscription,
    // Feature flags
    canCreateTemplates: isPro && features.templates,
    canBrand: isPro && features.branding,
    canUseAPI: isPro && features.api,
    canUseWebhooks: isPro && features.webhooks,
    canUseSSO: isEnterprise && features.sso,
    maxSeats: features.maxSeats,
  };
}
