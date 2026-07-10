"use node";

import { ConvexError, v } from "convex/values";

import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { type ActionCtx, action } from "../_generated/server";
import {
  createVortexBillingCheckoutSession,
  createVortexBillingPortalSession,
} from "./vortex_billing_processor";

async function resolveAuthContext(ctx: ActionCtx): Promise<{
  user: Doc<"users">;
  organization: Doc<"organizations">;
}> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new ConvexError("Authentication required");
  }

  const user: Doc<"users"> | null = await ctx.runQuery(
    internal.organizations.helpers.getUserByAuthSubject,
    { authSubject: identity.subject },
  );

  if (!user) {
    throw new ConvexError("User not found");
  }

  if (!user.activeOrganizationId) {
    throw new ConvexError("No active organization");
  }

  const organization: Doc<"organizations"> | null = await ctx.runQuery(
    internal.organizations.helpers.getOrganizationById,
    { organizationId: user.activeOrganizationId },
  );

  if (!organization) {
    throw new ConvexError("Organization not found");
  }

  return { user, organization };
}

async function getOrgMemberCount(
  ctx: ActionCtx,
  organizationId: Id<"organizations">,
): Promise<number> {
  const count: number = await ctx.runQuery(internal.organizations.helpers.getActiveMemberCount, {
    organizationId,
  });
  return Math.max(count, 1);
}

export const createCheckoutSession = action({
  args: {
    lookupKey: v.string(),
    successUrl: v.string(),
    cancelUrl: v.string(),
    promoCode: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ checkoutUrl: string }> => {
    const { organization } = await resolveAuthContext(ctx);
    const memberCount = await getOrgMemberCount(ctx, organization._id);

    const catalogPrice = await ctx.runQuery(
      internal.vortex_billing.catalog_queries.getActiveVortexSubscriptionPriceByLookupKey,
      { lookupKey: args.lookupKey },
    );
    if (catalogPrice === null || catalogPrice.vortexPriceId === undefined) {
      throw new ConvexError(
        `Seal subscription price not found for Vortex checkout lookupKey: ${args.lookupKey}. Run Vortex catalog sync before creating checkout.`,
      );
    }

    const checkoutUrl = await createVortexBillingCheckoutSession({
      organizationId: organization._id,
      lookupKey: args.lookupKey,
      quantity: memberCount,
      promoCode: args.promoCode,
      priceId: catalogPrice.vortexPriceId,
      priceUnitAmount: catalogPrice.unitAmount,
    });

    return { checkoutUrl };
  },
});

export const createCustomerPortalSession = action({
  args: {
    returnUrl: v.string(),
  },
  handler: async (ctx, _args): Promise<{ url: string }> => {
    const { organization } = await resolveAuthContext(ctx);
    const url = await createVortexBillingPortalSession({ organizationId: organization._id });

    return { url };
  },
});

export const pauseSubscription = action({
  args: {
    slug: v.string(),
    subscriptionId: v.string(),
  },
  handler: async (_ctx, _args) => {
    throw new ConvexError("Subscription pause must be handled by Vortex Billing");
  },
});

export const resumeSubscription = action({
  args: {
    slug: v.string(),
    subscriptionId: v.string(),
  },
  handler: async (_ctx, _args) => {
    throw new ConvexError("Subscription resume must be handled by Vortex Billing");
  },
});

export const cancelSubscription = action({
  args: {
    slug: v.string(),
    subscriptionId: v.string(),
  },
  handler: async (_ctx, _args) => {
    throw new ConvexError("Subscription cancellation must be handled by Vortex Billing");
  },
});
