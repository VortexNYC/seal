/**
 * Plan limits — single source of truth for tier feature flags.
 * Imported by both backend (subscription_guards.ts) and frontend (use-subscription-limits.ts).
 * No Convex runtime dependencies — pure constants only.
 */

export const PLAN_LIMITS = {
  free: {
    maxSeats: 1,
    templates: false,
    branding: false,
    api: false,
    webhooks: false,
    sso: false,
  },
  pro: {
    maxSeats: 20,
    templates: true,
    branding: true,
    api: true,
    webhooks: true,
    sso: false,
  },
  enterprise: {
    maxSeats: Infinity,
    templates: true,
    branding: true,
    api: true,
    webhooks: true,
    sso: true,
  },
} as const;

export type TierPlan = "free" | "pro" | "enterprise";
