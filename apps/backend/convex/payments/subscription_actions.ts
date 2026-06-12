"use node";

import { ConvexError, v } from "convex/values";
import Stripe from "stripe";

import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { type ActionCtx, action } from "../_generated/server";
import { getOrCreateStripeCustomer } from "../stripe/helpers";

function initializeStripe(): Stripe {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    throw new Error("STRIPE_SECRET_KEY not configured");
  }

  return new Stripe(stripeSecretKey, {
    apiVersion: "2026-02-25.clover",
  });
}

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
  stripe: Stripe,
  organization: Doc<"organizations">,
  adminEmail: string,
): Promise<string> {
  if (organization.stripeCustomerId) {
    return organization.stripeCustomerId;
  }

  const stripeCustomerId = await getOrCreateStripeCustomer(
    stripe,
    organization._id,
    adminEmail,
    organization.name,
    undefined,
  );

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
    const stripe = initializeStripe();
    const { user, organization } = await resolveAuthContext(ctx);

    const stripeCustomerId = await resolveOrgBillingCustomer(ctx, stripe, organization, user.email);
    const memberCount = await getOrgMemberCount(ctx, organization._id);

    const priceData = await ctx.runMutation(
      internal.stripe.subscription_actions.getPriceByLookupKey,
      { lookupKey: args.lookupKey },
    );

    if (!priceData?.price) {
      throw new ConvexError(`Price not found for lookup key: ${args.lookupKey}`);
    }

    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: "subscription",
      line_items: [
        {
          price: priceData.price.externalPriceId,
          quantity: memberCount,
        },
      ],
      success_url: args.successUrl,
      cancel_url: args.cancelUrl,
      subscription_data: {
        metadata: {
          organizationId: organization._id,
          lookupKey: args.lookupKey,
        },
      },
    });

    if (!session.url) {
      throw new ConvexError("Failed to create checkout session");
    }

    return { checkoutUrl: session.url };
  },
});

export const createCustomerPortalSession = action({
  args: {
    returnUrl: v.string(),
  },
  handler: async (ctx, args): Promise<{ url: string }> => {
    const stripe = initializeStripe();
    const { organization } = await resolveAuthContext(ctx);

    if (!organization.stripeCustomerId) {
      throw new ConvexError("No billing account found. Please contact support.");
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: organization.stripeCustomerId,
      return_url: args.returnUrl,
    });

    return { url: session.url };
  },
});

export const pauseSubscription = action({
  args: {
    slug: v.string(),
    subscriptionId: v.string(),
  },
  handler: async (ctx, args) => {
    const processor = await resolveProcessorContext(ctx, args);
    const stripe = initializeStripe();

    await stripe.subscriptions.update(
      processor.processorSubscriptionId,
      { pause_collection: { behavior: "void" } },
      { stripeAccount: processor.processorAccountId },
    );

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
    const stripe = initializeStripe();

    await stripe.subscriptions.update(
      processor.processorSubscriptionId,
      { pause_collection: null },
      { stripeAccount: processor.processorAccountId },
    );

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
    const stripe = initializeStripe();

    await stripe.subscriptions.update(
      processor.processorSubscriptionId,
      { cancel_at_period_end: true },
      { stripeAccount: processor.processorAccountId },
    );

    return { success: true };
  },
});
