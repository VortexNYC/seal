import { useQuery } from "convex/react";

import { api } from "@seal/backend/convex/_generated/api";

/**
 * Hook for checking subscription plan limits in the UI.
 *
 * Wraps `getSubscriptionDetails` and provides convenient helpers
 * for conditionally rendering tier-gated features.
 */
export function useSubscriptionLimits() {
  const subscription = useQuery(api.stripe.queries.getSubscriptionDetails);

  const isLoading = subscription === undefined;

  const tier = subscription?.tier ?? "free";
  const isActive = subscription?.status === "active" || subscription?.status === "trialing";

  const isPro = isActive && (tier === "pro" || tier === "enterprise");
  const isEnterprise = isActive && tier === "enterprise";

  return {
    isPro,
    isEnterprise,
    isLoading,
    tier,
    subscription,
  };
}
