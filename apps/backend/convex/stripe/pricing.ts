/**
 * Stripe Pricing Utilities
 *
 * Lookup key format: {tier}:{interval}:v{version}
 * Examples: free:monthly:v2, pro:monthly:v2, pro:yearly:v2
 *
 * Plan configuration (tier, features) is stored in Stripe Product metadata.
 * This module only handles lookup key parsing/validation.
 */

// Available tiers (for type safety only - actual limits come from Stripe metadata)
export const TIER_NAMES = ["free", "pro", "enterprise"] as const;
export type TierName = (typeof TIER_NAMES)[number];

export const BILLING_INTERVALS = ["monthly", "yearly"] as const;
export type BillingInterval = (typeof BILLING_INTERVALS)[number];

/**
 * Parsed lookup key structure
 */
export interface ParsedLookupKey {
  tier: TierName;
  interval: BillingInterval;
  version: string;
}

// Regex: tier:interval:vN
const LOOKUP_KEY_REGEX = /^([a-z]+):(monthly|yearly):(v\d+)$/;

/**
 * Build a lookup key from components
 */
export function buildLookupKey(
  tier: TierName,
  interval: BillingInterval,
  version = "v2",
): string {
  return `${tier}:${interval}:${version}`;
}

/**
 * Validate a lookup key format
 */
export function isValidLookupKey(key: string | null | undefined): boolean {
  if (!key) return false;
  const match = key.match(LOOKUP_KEY_REGEX);
  if (!match) return false;

  const tier = match[1];
  return tier !== undefined && TIER_NAMES.includes(tier as TierName);
}

/**
 * Parse a lookup key into its components
 * Returns null if the key is invalid
 */
export function parseLookupKey(key: string | null | undefined): ParsedLookupKey | null {
  if (!key) return null;

  const match = key.match(LOOKUP_KEY_REGEX);
  if (!match) return null;

  const [, tier, interval, version] = match;
  if (!tier || !interval || !version) return null;
  if (!TIER_NAMES.includes(tier as TierName)) return null;

  return {
    tier: tier as TierName,
    interval: interval as BillingInterval,
    version,
  };
}

/**
 * Extract tier name from a lookup key
 */
export function getTierFromLookupKey(key: string | null | undefined): TierName | null {
  const parsed = parseLookupKey(key);
  return parsed?.tier ?? null;
}
