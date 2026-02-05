/**
 * Stripe Connect Webhook Event Handlers
 */

import type { GenericActionCtx } from "convex/server";
import type Stripe from "stripe";

import { internal } from "../_generated/api";
import type { DataModel, Id } from "../_generated/dataModel";
import { mapStripeCapabilities, mapStripeRequirements } from "./connect_helpers";

type HttpActionCtx = GenericActionCtx<DataModel>;

async function resolveOrganizationId(
  ctx: HttpActionCtx,
  stripeAccountId: string,
  account?: Stripe.Account,
): Promise<Id<"organizations"> | null> {
  const metadataOrgId = account?.metadata?.organizationId;
  if (metadataOrgId) {
    return metadataOrgId as Id<"organizations">;
  }

  const existing = await ctx.runQuery(internal.stripe.connect_mutations.getAccountByStripeId, {
    stripeAccountId,
  });

  return existing?.organizationId ?? null;
}

async function handleAccountUpdated(ctx: HttpActionCtx, account: Stripe.Account): Promise<void> {
  const orgId = await resolveOrganizationId(ctx, account.id, account);
  if (!orgId) {
    console.warn("Stripe Connect webhook for unknown account", {
      operation: "stripeConnect.accountUpdated",
      stripeAccountId: account.id,
    });
    return;
  }

  await ctx.runMutation(internal.stripe.connect_mutations.upsertStripeAccount, {
    organizationId: orgId,
    stripeAccountId: account.id,
    accountType: account.type === "express" ? "express" : "standard",
    chargesEnabled: account.charges_enabled,
    payoutsEnabled: account.payouts_enabled,
    detailsSubmitted: account.details_submitted,
    requirements: mapStripeRequirements(account),
    capabilities: mapStripeCapabilities(account),
    feeHandling: undefined,
  });
}

async function handleAccountAuthorized(
  ctx: HttpActionCtx,
  stripeAccountId: string | null,
): Promise<void> {
  if (!stripeAccountId) {
    console.warn("Stripe Connect authorization missing account", {
      operation: "stripeConnect.accountAuthorized",
    });
    return;
  }

  const existing = await ctx.runQuery(internal.stripe.connect_mutations.getAccountByStripeId, {
    stripeAccountId,
  });

  if (!existing) {
    console.warn("Stripe Connect authorization for unknown account", {
      operation: "stripeConnect.accountAuthorized",
      stripeAccountId,
    });
    return;
  }

  await ctx.runAction(internal.stripe.connect_actions.connectExistingAccount, {
    organizationId: existing.organizationId,
    stripeAccountId,
  });
}

async function handleAccountDeauthorized(
  ctx: HttpActionCtx,
  stripeAccountId: string | null,
): Promise<void> {
  if (!stripeAccountId) {
    console.warn("Stripe Connect deauthorized event missing account", {
      operation: "stripeConnect.accountDeauthorized",
    });
    return;
  }

  await ctx.runMutation(internal.stripe.connect_mutations.markAccountDisconnected, {
    stripeAccountId,
  });
}

async function handleCapabilityUpdated(
  ctx: HttpActionCtx,
  capability: Stripe.Capability,
): Promise<void> {
  const stripeAccountId = capability.account as string | null;
  if (!stripeAccountId) {
    return;
  }

  const existing = await ctx.runQuery(internal.stripe.connect_mutations.getAccountByStripeId, {
    stripeAccountId,
  });

  if (!existing) {
    return;
  }

  await ctx.runAction(internal.stripe.connect_actions.connectExistingAccount, {
    organizationId: existing.organizationId,
    stripeAccountId,
  });
}

export async function processStripeConnectWebhookEvent(
  ctx: HttpActionCtx,
  event: Stripe.Event,
): Promise<void> {
  switch (event.type) {
    case "account.updated":
      await handleAccountUpdated(ctx, event.data.object as Stripe.Account);
      return;
    case "account.application.authorized":
      await handleAccountAuthorized(ctx, event.account ?? null);
      return;
    case "account.application.deauthorized":
      await handleAccountDeauthorized(ctx, event.account ?? null);
      return;
    case "capability.updated":
      await handleCapabilityUpdated(ctx, event.data.object as Stripe.Capability);
      return;
    default:
      return;
  }
}
