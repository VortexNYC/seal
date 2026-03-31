/**
 * Pre-downgrade validation.
 *
 * Validates that an organization can safely downgrade to a target tier
 * before processing a cancellation from the billing UI.
 */

import { v } from "convex/values";

import { internalMutation } from "../_generated/server";
import { PLAN_LIMITS } from "../auth/subscription_guards";

/**
 * Validate that an org can safely downgrade to a target tier.
 * Called from the billing UI before processing a cancellation.
 */
export const validateDowngrade = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    targetTier: v.union(v.literal("free"), v.literal("pro")),
  },
  handler: async (ctx, { organizationId, targetTier }) => {
    const limits = PLAN_LIMITS[targetTier];

    // Check seat count
    const members = await ctx.db
      .query("organization_members")
      .withIndex("by_organization", (q) => q.eq("organizationId", organizationId))
      .filter((q) => q.eq(q.field("status"), "active"))
      .collect();

    if (members.length > limits.maxSeats) {
      const tierLabel = targetTier === "free" ? "Free" : "Professional";
      const excess = members.length - limits.maxSeats;
      return {
        canDowngrade: false as const,
        reason: `You have ${members.length} team members. ${tierLabel} plan supports ${limits.maxSeats} seat${limits.maxSeats === 1 ? "" : "s"}. Remove ${excess} member${excess === 1 ? "" : "s"} first.`,
        blockers: { seats: { current: members.length, limit: limits.maxSeats } },
      };
    }

    return { canDowngrade: true as const, reason: null, blockers: null };
  },
});
