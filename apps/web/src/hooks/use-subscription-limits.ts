import { api } from "@seal/backend/convex/_generated/api";
<<<<<<< HEAD
import { useQuery } from "convex/react";
=======
import { PLAN_LIMITS } from "@seal/backend/convex/auth/plan_limits";
>>>>>>> ddc9cdc (feat: pricing tier enforcement — Free/Professional/Enterprise (#72))

/**
 * Hook for checking subscription plan limits in the UI.
 *
 * Wraps `getSubscriptionDetails` and provides convenient helpers
 * for conditionally rendering tier-gated features.
 */
export function useSubscriptionLimits() {
  const subscription = useQuery(api.stripe.queries.getSubscriptionDetails);

  const isLoading = subscription === undefined;

  const tier = (subscription?.tier ?? "free") as keyof typeof PLAN_LIMITS;
  const isActive = subscription?.status === "active" || subscription?.status === "trialing";

  const isPro = isActive && (tier === "pro" || tier === "enterprise");
  const isEnterprise = isActive && tier === "enterprise";

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
