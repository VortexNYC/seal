/**
 * Stripe Connect Webhook Event Handlers
 *
 * These update local account state from Stripe Connect events.
 * Source of truth for chargesEnabled, payoutsEnabled, and requirements.
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
  // Prefer orgId stored in Stripe account metadata when available.
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
  // account.updated is the primary signal for capabilities and requirements.
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

async function handleCapabilityUpdated(
  ctx: HttpActionCtx,
  capability: Stripe.Capability,
): Promise<void> {
  // Capability changes can arrive without full account payloads.
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

async function handleInvoicePaid(ctx: HttpActionCtx, invoice: Stripe.Invoice): Promise<void> {
  // Invoice has been paid - update local status
  await ctx.runMutation(internal.stripe.invoice_mutations.updateInvoiceStatus, {
    stripeInvoiceId: invoice.id,
    status: "paid",
    paidAt: Date.now(),
    hostedInvoiceUrl: invoice.hosted_invoice_url ?? undefined,
    invoicePdf: invoice.invoice_pdf ?? undefined,
  });
}

async function handleInvoicePaymentFailed(
  _ctx: HttpActionCtx,
  invoice: Stripe.Invoice,
): Promise<void> {
  // Payment failed - log but keep status as "open" (Stripe will retry)
  console.warn("Invoice payment failed", {
    operation: "stripeConnect.invoicePaymentFailed",
    stripeInvoiceId: invoice.id,
  });
}

async function handleInvoiceVoided(ctx: HttpActionCtx, invoice: Stripe.Invoice): Promise<void> {
  // Invoice was voided - update local status
  await ctx.runMutation(internal.stripe.invoice_mutations.updateInvoiceStatus, {
    stripeInvoiceId: invoice.id,
    status: "void",
    voidedAt: Date.now(),
  });
}

async function handleInvoiceMarkedUncollectible(
  ctx: HttpActionCtx,
  invoice: Stripe.Invoice,
): Promise<void> {
  // Invoice marked as uncollectible - update local status
  await ctx.runMutation(internal.stripe.invoice_mutations.updateInvoiceStatus, {
    stripeInvoiceId: invoice.id,
    status: "uncollectible",
  });
}

async function handleInvoiceDeleted(ctx: HttpActionCtx, invoice: Stripe.Invoice): Promise<void> {
  // Invoice deleted (e.g., from Stripe dashboard) - sync to our database
  await ctx.runMutation(internal.stripe.invoice_mutations.markInvoiceDeleted, {
    stripeInvoiceId: invoice.id,
  });
}

export async function processStripeConnectWebhookEvent(
  ctx: HttpActionCtx,
  event: Stripe.Event,
): Promise<void> {
  // Handle Connect-specific events and invoice lifecycle events.
  switch (event.type) {
    case "account.updated":
      await handleAccountUpdated(ctx, event.data.object as Stripe.Account);
      return;
    case "capability.updated":
      await handleCapabilityUpdated(ctx, event.data.object as Stripe.Capability);
      return;
    case "invoice.paid":
      await handleInvoicePaid(ctx, event.data.object as Stripe.Invoice);
      return;
    case "invoice.payment_failed":
      await handleInvoicePaymentFailed(ctx, event.data.object as Stripe.Invoice);
      return;
    case "invoice.voided":
      await handleInvoiceVoided(ctx, event.data.object as Stripe.Invoice);
      return;
    case "invoice.marked_uncollectible":
      await handleInvoiceMarkedUncollectible(ctx, event.data.object as Stripe.Invoice);
      return;
    case "invoice.deleted":
      await handleInvoiceDeleted(ctx, event.data.object as Stripe.Invoice);
      return;
    default:
      return;
  }
}
