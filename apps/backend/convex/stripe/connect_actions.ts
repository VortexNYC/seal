"use node";
/**
 * Vortex Connect provider actions (Node runtime).
 *
 * These internal actions call the current provider APIs to create/connect accounts and generate onboarding links.
 * All callers must be owners/admins for the target organization.
 */
import { randomUUID } from "crypto";

import { ConvexError, v } from "convex/values";
import Stripe from "stripe";

import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { ActionCtx } from "../_generated/server";
import { internalAction } from "../_generated/server";
import { isAdmin } from "../auth.utils";
import { mapStripeCapabilities, mapStripeRequirements } from "./connect_helpers";

function initializeStripe(): Stripe {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    throw new Error("STRIPE_SECRET_KEY not configured");
  }

  return new Stripe(stripeSecretKey, {
    apiVersion: "2026-02-25.clover",
  });
}

async function resolveAdminMembership(ctx: ActionCtx, organizationId: Id<"organizations">) {
  // Guard: only owners/admins can manage Vortex Connect settings.
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new ConvexError("Authentication required");
  }

  const user = await ctx.runQuery(internal.organizations.helpers.getUserByAuthSubject, {
    authSubject: identity.subject,
  });

  if (!user) {
    throw new ConvexError("User not found");
  }

  const membership = await ctx.runQuery(
    internal.organizations.helpers.getActiveMembershipByUserAndOrganization,
    {
      userId: user._id,
      organizationId,
    },
  );

  if (!membership) {
    throw new ConvexError("Organization membership required");
  }

  if (!isAdmin(membership)) {
    throw new ConvexError("Only workspace owners and admins can manage Vortex Connect settings");
  }

  return { user, membership };
}

export const createConnectedAccount = internalAction({
  args: {
    organizationId: v.id("organizations"),
    feeHandling: v.optional(v.union(v.literal("absorb"), v.literal("pass_to_recipient"))),
  },
  handler: async (ctx, args): Promise<{ stripeAccountId: string }> => {
    await resolveAdminMembership(ctx, args.organizationId);

    // If a connected account already exists, return it instead of creating another.
    const existing = await ctx.runQuery(
      internal.stripe.connect_mutations.getAccountByOrganizationId,
      {
        organizationId: args.organizationId,
      },
    );

    if (existing) {
      return { stripeAccountId: existing.stripeAccountId };
    }

    const stripe = initializeStripe();

    // Standard Connect account: Stripe-hosted onboarding and dashboard access.
    const account = await stripe.accounts.create({
      type: "standard",
      country: "US",
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      metadata: {
        organizationId: args.organizationId,
      },
    });

    await ctx.runMutation(internal.stripe.connect_mutations.upsertStripeAccount, {
      organizationId: args.organizationId,
      stripeAccountId: account.id,
      accountType: "standard",
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      detailsSubmitted: account.details_submitted,
      requirements: mapStripeRequirements(account),
      capabilities: mapStripeCapabilities(account),
      feeHandling: args.feeHandling ?? "absorb",
    });

    return { stripeAccountId: account.id };
  },
});

export const createAccountLink = internalAction({
  args: {
    organizationId: v.id("organizations"),
    returnUrl: v.string(),
    refreshUrl: v.string(),
  },
  handler: async (ctx, args): Promise<{ url: string }> => {
    await resolveAdminMembership(ctx, args.organizationId);

    const account = await ctx.runQuery(
      internal.stripe.connect_mutations.getAccountByOrganizationId,
      {
        organizationId: args.organizationId,
      },
    );

    if (!account) {
      throw new ConvexError("No Vortex Connect account found for this organization");
    }

    const stripe = initializeStripe();
    // Account Links are short-lived onboarding URLs for Standard accounts.
    const accountLink = await stripe.accountLinks.create({
      account: account.stripeAccountId,
      refresh_url: args.refreshUrl,
      return_url: args.returnUrl,
      type: "account_onboarding",
    });

    return { url: accountLink.url };
  },
});

export const createConnectOAuthUrl = internalAction({
  args: {
    organizationId: v.id("organizations"),
    redirectUri: v.string(),
  },
  handler: async (ctx, args): Promise<{ url: string; state: string }> => {
    await resolveAdminMembership(ctx, args.organizationId);

    const clientId = process.env.STRIPE_CONNECT_CLIENT_ID;
    if (!clientId) {
      throw new ConvexError("STRIPE_CONNECT_CLIENT_ID not configured");
    }

    // State binds the OAuth callback to a specific org and protects against CSRF.
    const state = `${args.organizationId}:${randomUUID()}`;

    const url = new URL("https://connect.stripe.com/oauth/authorize");
    url.searchParams.set("response_type", "code");
    url.searchParams.set("client_id", clientId);
    url.searchParams.set("scope", "read_write");
    url.searchParams.set("redirect_uri", args.redirectUri);
    url.searchParams.set("state", state);

    return { url: url.toString(), state };
  },
});

export const exchangeConnectOAuthCode = internalAction({
  args: {
    organizationId: v.id("organizations"),
    code: v.string(),
    state: v.string(),
  },
  handler: async (ctx, args): Promise<{ stripeAccountId: string }> => {
    await resolveAdminMembership(ctx, args.organizationId);

    // Ensure the OAuth callback is for the same org that initiated the flow.
    if (!args.state.startsWith(`${args.organizationId}:`)) {
      throw new ConvexError("Invalid OAuth state");
    }

    const stripe = initializeStripe();
    const token = await stripe.oauth.token({
      grant_type: "authorization_code",
      code: args.code,
    });

    if (!token.stripe_user_id) {
      throw new ConvexError("Vortex Connect OAuth did not return an account");
    }

    await ctx.runAction(internal.stripe.connect_actions.connectExistingAccount, {
      organizationId: args.organizationId,
      stripeAccountId: token.stripe_user_id,
    });

    return { stripeAccountId: token.stripe_user_id };
  },
});

export const connectExistingAccount = internalAction({
  args: {
    organizationId: v.id("organizations"),
    stripeAccountId: v.string(),
  },
  handler: async (ctx, args): Promise<void> => {
    const stripe = initializeStripe();
    const account = await stripe.accounts.retrieve(args.stripeAccountId);

    if (!account || typeof account === "string") {
      throw new ConvexError("Vortex Connect provider account not found");
    }

    // Persist the latest account capabilities and requirements in Convex.
    await ctx.runMutation(internal.stripe.connect_mutations.upsertStripeAccount, {
      organizationId: args.organizationId,
      stripeAccountId: account.id,
      accountType: "standard",
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      detailsSubmitted: account.details_submitted,
      requirements: mapStripeRequirements(account),
      capabilities: mapStripeCapabilities(account),
      feeHandling: "absorb",
    });
  },
});

/**
 * Refresh the connected account status from Stripe.
 * Called when the user returns from onboarding to ensure local state is up-to-date
 * (webhooks may not have arrived yet).
 */
/**
 * Create a Stripe AccountSession for embedded Connect components.
 * Returns a client_secret that the frontend passes to `loadConnectAndInitialize()`.
 * The session is scoped to a specific connected account and set of enabled components.
 */
export const createAccountSession = internalAction({
  args: {
    organizationId: v.id("organizations"),
    components: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args): Promise<{ clientSecret: string }> => {
    await resolveAdminMembership(ctx, args.organizationId);

    const account = await ctx.runQuery(
      internal.stripe.connect_mutations.getAccountByOrganizationId,
      {
        organizationId: args.organizationId,
      },
    );

    if (!account) {
      throw new ConvexError("No Vortex Connect account found for this organization");
    }

    const stripe = initializeStripe();

    const accountSession = await stripe.accountSessions.create({
      account: account.stripeAccountId,
      components: {
        account_onboarding: { enabled: true },
        account_management: { enabled: true },
        notification_banner: { enabled: true },
        payments: { enabled: true },
        payouts: { enabled: true },
        payouts_list: { enabled: true },
        balances: { enabled: true },
        disputes_list: { enabled: true },
        documents: { enabled: true },
      },
    });

    return { clientSecret: accountSession.client_secret };
  },
});

export const refreshConnectedAccount = internalAction({
  args: {
    organizationId: v.id("organizations"),
  },
  handler: async (ctx, args): Promise<{ status: "not_connected" | "refreshed" }> => {
    await resolveAdminMembership(ctx, args.organizationId);

    const existing = await ctx.runQuery(
      internal.stripe.connect_mutations.getAccountByOrganizationId,
      {
        organizationId: args.organizationId,
      },
    );

    if (!existing) {
      return { status: "not_connected" };
    }

    const stripe = initializeStripe();
    const account = await stripe.accounts.retrieve(existing.stripeAccountId);

    if (!account || typeof account === "string") {
      throw new ConvexError("Vortex Connect provider account not found");
    }

    // Update local record with latest Stripe state
    await ctx.runMutation(internal.stripe.connect_mutations.upsertStripeAccount, {
      organizationId: args.organizationId,
      stripeAccountId: account.id,
      accountType: account.type === "express" ? "express" : "standard",
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      detailsSubmitted: account.details_submitted,
      requirements: mapStripeRequirements(account),
      capabilities: mapStripeCapabilities(account),
      feeHandling: undefined, // Preserve existing value
    });

    return { status: "refreshed" };
  },
});
