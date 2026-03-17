import { useQuery } from "convex/react";

import { api } from "@seal/backend/convex/_generated/api";

const PLAN_FEATURES = {
  free: { maxSeats: 1, templates: false, branding: false, api: false, webhooks: false, sso: false },
  pro: { maxSeats: 20, templates: true, branding: true, api: true, webhooks: true, sso: false },
  enterprise: { maxSeats: Infinity, templates: true, branding: true, api: true, webhooks: true, sso: true },
} as const;

/**
 * Hook for checking subscription plan limits in the UI.
 *
 * Wraps `getSubscriptionDetails` and provides convenient helpers
 * for conditionally rendering tier-gated features.
 */
export function useSubscriptionLimits() {
  const subscription = useQuery(api.stripe.queries.getSubscriptionDetails);

  const isLoading = subscription === undefined;

  const tier = (subscription?.tier ?? "free") as keyof typeof PLAN_FEATURES;
  const isActive = subscription?.status === "active" || subscription?.status === "trialing";

  const isPro = isActive && (tier === "pro" || tier === "enterprise");
  const isEnterprise = isActive && tier === "enterprise";

  const features = PLAN_FEATURES[tier] ?? PLAN_FEATURES.free;

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
