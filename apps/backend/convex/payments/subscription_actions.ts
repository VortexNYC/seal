"use node";

import { ConvexError, v } from "convex/values";

import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { type ActionCtx, action } from "../_generated/server";
import {
  cancelProcessorSubscription,
  createCustomerPortalUrl,
  createHostedCheckoutSession,
  getOrCreateBillingCustomerId,
  pauseProcessorSubscription,
  resumeProcessorSubscription,
} from "../stripe/subscription_processor";
import {
  createVortexBillingCheckoutSession,
  createVortexBillingPortalSession,
  selectSaasBillingProvider,
} from "./vortex_billing_processor";

async function resolveProcessorContext(
  ctx: ActionCtx,
  args: { slug: string; subscriptionId: string },
) {
  return await ctx.runQuery(internal.payments.queries.resolveSubscriptionProcessorContext, args);
}

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

async function resolveOrgBillingCustomer(
  ctx: ActionCtx,
  organization: Doc<"organizations">,
  adminEmail: string,
): Promise<string> {
  if (organization.stripeCustomerId) {
    return organization.stripeCustomerId;
  }

  const stripeCustomerId = await getOrCreateBillingCustomerId({
    organizationId: organization._id,
    adminEmail,
    organizationName: organization.name,
  });

  await ctx.runMutation(internal.stripe.subscription_actions.updateOrgStripeCustomerId, {
    organizationId: organization._id,
    stripeCustomerId,
  });

  return stripeCustomerId;
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
  },
  handler: async (ctx, args): Promise<{ checkoutUrl: string }> => {
    const { user, organization } = await resolveAuthContext(ctx);
    const memberCount = await getOrgMemberCount(ctx, organization._id);

    if (selectSaasBillingProvider(organization._id) === "vortex_billing") {
      const checkoutUrl = await createVortexBillingCheckoutSession({
        organizationId: organization._id,
        lookupKey: args.lookupKey,
        quantity: memberCount,
      });

      return { checkoutUrl };
    }

    const priceData = await ctx.runMutation(
      internal.stripe.subscription_actions.getPriceByLookupKey,
      { lookupKey: args.lookupKey },
    );

    if (!priceData?.price) {
      throw new ConvexError(`Price not found for lookup key: ${args.lookupKey}`);
    }

    const stripeCustomerId = await resolveOrgBillingCustomer(ctx, organization, user.email);
    const checkoutUrl = await createHostedCheckoutSession({
      customerId: stripeCustomerId,
      externalPriceId: priceData.price.externalPriceId,
      quantity: memberCount,
      successUrl: args.successUrl,
      cancelUrl: args.cancelUrl,
      organizationId: organization._id,
      lookupKey: args.lookupKey,
    });

    return { checkoutUrl };
  },
});

export const createCustomerPortalSession = action({
  args: {
    returnUrl: v.string(),
  },
  handler: async (ctx, args): Promise<{ url: string }> => {
    const { user, organization } = await resolveAuthContext(ctx);

    if (selectSaasBillingProvider(organization._id) === "vortex_billing") {
      const url = await createVortexBillingPortalSession({ organizationId: organization._id });
      return { url };
    }

    const stripeCustomerId = await resolveOrgBillingCustomer(ctx, organization, user.email);

    const url = await createCustomerPortalUrl({
      customerId: stripeCustomerId,
      returnUrl: args.returnUrl,
    });

    return { url };
  },
});

export const pauseSubscription = action({
  args: {
    slug: v.string(),
    subscriptionId: v.string(),
  },
  handler: async (ctx, args) => {
    const processor = await resolveProcessorContext(ctx, args);
    await pauseProcessorSubscription(processor);

    return { success: true };
  },
});

export const resumeSubscription = action({
  args: {
    slug: v.string(),
    subscriptionId: v.string(),
  },
  handler: async (ctx, args) => {
    const processor = await resolveProcessorContext(ctx, args);
    await resumeProcessorSubscription(processor);

    return { success: true };
  },
});

export const cancelSubscription = action({
  args: {
    slug: v.string(),
    subscriptionId: v.string(),
  },
  handler: async (ctx, args) => {
    const processor = await resolveProcessorContext(ctx, args);
    await cancelProcessorSubscription(processor);

    return { success: true };
  },
});
