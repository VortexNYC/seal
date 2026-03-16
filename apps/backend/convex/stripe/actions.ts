/**
 * Stripe Actions
 *
 * Convex actions for interacting with Stripe API.
 * These run in Node.js runtime and can make external API calls.
 *
 * Billing is scoped to the ORGANIZATION, not the user.
 */

import { ConvexError, v } from "convex/values";
import Stripe from "stripe";

import { internal } from "../_generated/api";
import type { Doc, Id } from "../_generated/dataModel";
import { type ActionCtx, action, internalAction } from "../_generated/server";
import { getOrCreateStripeCustomer } from "./helpers";

function initializeStripe(): Stripe {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    throw new Error("STRIPE_SECRET_KEY not configured");
  }
  return new Stripe(stripeSecretKey, {
    apiVersion: "2025-12-15.clover",
  });
}

/**
 * Retrieve a coupon from Stripe API
 * Used to hydrate coupon data when webhook payload is incomplete
 */
export const retrieveCoupon = internalAction({
  args: {
    couponId: v.string(),
  },
  handler: async (_ctx, { couponId }) => {
    const stripe = initializeStripe();

    try {
      const coupon = await stripe.coupons.retrieve(couponId, {
        expand: ["applies_to"],
      });
      return coupon;
    } catch (error) {
      console.error("Failed to retrieve coupon from Stripe", {
        operation: "retrieveCoupon",
        couponId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },
});

/**
 * Retrieve a promotion code from Stripe API
 * Used to hydrate promo code data when webhook payload is incomplete
 */
export const retrievePromotionCode = internalAction({
  args: {
    promotionCodeId: v.string(),
  },
  handler: async (_ctx, { promotionCodeId }) => {
    const stripe = initializeStripe();

    try {
      const promotionCode = await stripe.promotionCodes.retrieve(promotionCodeId, {
        expand: ["coupon"],
      });
      return promotionCode;
    } catch (error) {
      console.error("Failed to retrieve promotion code from Stripe", {
        operation: "retrievePromotionCode",
        promotionCodeId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },
});

// =====================
// PUBLIC ACTIONS (called from frontend)
// =====================

/**
 * Resolve the authenticated user and their active organization.
 */
async function resolveAuthContext(ctx: ActionCtx): Promise<{
  user: Doc<"users">;
  organization: Doc<"organizations">;
}> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new ConvexError("Authentication required");
  }

  const user: Doc<"users"> | null = await ctx.runQuery(
    internal.organizations.helpers.getUserByClerkId,
    { clerkId: identity.subject },
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

/**
 * Resolve or create a Stripe customer for an organization.
 */
async function resolveOrgStripeCustomer(
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

/**
 * Count active members in an organization for per-seat billing.
 */
async function getOrgMemberCount(
  ctx: ActionCtx,
  organizationId: Id<"organizations">,
): Promise<number> {
  const count: number = await ctx.runQuery(
    internal.organizations.helpers.getActiveMemberCount,
    { organizationId },
  );
  return Math.max(count, 1); // At least 1 seat (the owner)
}

/**
 * Create a Stripe Checkout session for upgrading to a paid plan.
 *
 * Frontend calls this action, gets back a URL, and redirects to Stripe Checkout.
 * After checkout, Stripe webhook handles subscription creation.
 */
export const createCheckoutSession = action({
  args: {
    lookupKey: v.string(),
    successUrl: v.string(),
    cancelUrl: v.string(),
  },
  handler: async (ctx, { lookupKey, successUrl, cancelUrl }): Promise<{ url: string }> => {
    const stripe = initializeStripe();
    const { user, organization } = await resolveAuthContext(ctx);

    const stripeCustomerId = await resolveOrgStripeCustomer(ctx, stripe, organization, user.email);
    const memberCount = await getOrgMemberCount(ctx, organization._id);

    // Look up the price by lookup key
    const priceData = await ctx.runMutation(
      internal.stripe.subscription_actions.getPriceByLookupKey,
      { lookupKey },
    );

    if (!priceData?.price) {
      throw new ConvexError(`Price not found for lookup key: ${lookupKey}`);
    }

    // Create Checkout session
    const session = await stripe.checkout.sessions.create({
      customer: stripeCustomerId,
      mode: "subscription",
      line_items: [
        {
          price: priceData.price.externalPriceId,
          quantity: memberCount,
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      subscription_data: {
        metadata: {
          organizationId: organization._id,
          lookupKey,
        },
      },
    });

    if (!session.url) {
      throw new ConvexError("Failed to create checkout session");
    }

    return { url: session.url };
  },
});

/**
 * Create an embedded Stripe Checkout session for inline subscription upgrades.
 *
 * Same logic as createCheckoutSession, but uses `ui_mode: "embedded"` so the
 * frontend renders the checkout inline via `<EmbeddedCheckout />` instead of
 * redirecting to a Stripe-hosted page.
 */
export const createEmbeddedCheckoutSession = action({
  args: {
    lookupKey: v.string(),
    returnUrl: v.string(),
  },
  handler: async (ctx, { lookupKey, returnUrl }): Promise<{ clientSecret: string }> => {
    const stripe = initializeStripe();
    const { user, organization } = await resolveAuthContext(ctx);

    const stripeCustomerId = await resolveOrgStripeCustomer(ctx, stripe, organization, user.email);
    const memberCount = await getOrgMemberCount(ctx, organization._id);

    // Look up the price by lookup key
    const priceData = await ctx.runMutation(
      internal.stripe.subscription_actions.getPriceByLookupKey,
      { lookupKey },
    );

    if (!priceData?.price) {
      throw new ConvexError(`Price not found for lookup key: ${lookupKey}`);
    }

    // Create embedded Checkout session
    const session = await stripe.checkout.sessions.create({
      ui_mode: "embedded",
      customer: stripeCustomerId,
      mode: "subscription",
      line_items: [
        {
          price: priceData.price.externalPriceId,
          quantity: memberCount,
        },
      ],
      return_url: returnUrl,
      subscription_data: {
        metadata: {
          organizationId: organization._id,
          lookupKey,
        },
      },
    });

    if (!session.client_secret) {
      throw new ConvexError("Failed to create embedded checkout session");
    }

    return { clientSecret: session.client_secret };
  },
});

/**
 * Create a Stripe Customer Portal session for managing billing.
 *
 * Allows users to update payment methods and view invoices.
 * Cancellation is disabled in portal config — handled through our own UI.
 * Frontend calls this action, gets back a URL, and redirects to the portal.
 */
export const createCustomerPortalSession = action({
  args: {
    returnUrl: v.string(),
  },
  handler: async (ctx, { returnUrl }): Promise<{ url: string }> => {
    const stripe = initializeStripe();
    const { organization } = await resolveAuthContext(ctx);

    if (!organization.stripeCustomerId) {
      throw new ConvexError("No billing account found. Please contact support.");
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: organization.stripeCustomerId,
      return_url: returnUrl,
    });

    return { url: session.url };
  },
});
