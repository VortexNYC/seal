/**
 * Plan limits — single source of truth for tier feature flags.
 *
 * Pure constants, no runtime dependencies. Mirrors the backend contract.
 */
export const PLAN_LIMITS = {
  free: {
    maxSeats: 3,
    templates: true,
    branding: false,
    api: true,
    webhooks: true,
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
