/**
 * Stripe Connect Webhook Event Handlers
 *
 * These update local account state from Stripe Connect events.
 * Source of truth for chargesEnabled, payoutsEnabled, and requirements.
 *
 * Includes idempotency handling to prevent duplicate processing.
 *
 * SEA-170: Stripe Connect Implementation
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
  console.info("Processing invoice.paid webhook", {
    operation: "stripeConnect.invoicePaid",
    stripeInvoiceId: invoice.id,
    status: invoice.status,
    amountPaid: invoice.amount_paid,
  });

  const result = await ctx.runMutation(internal.stripe.invoice_mutations.updateInvoiceStatus, {
    stripeInvoiceId: invoice.id,
    status: "paid",
    paidAt: Date.now(),
    hostedInvoiceUrl: invoice.hosted_invoice_url ?? undefined,
    invoicePdf: invoice.invoice_pdf ?? undefined,
  });

  if (!result) {
    console.warn("Invoice not found in database for paid webhook", {
      operation: "stripeConnect.invoicePaid",
      stripeInvoiceId: invoice.id,
    });
  } else {
    console.info("Invoice status updated to paid", {
      operation: "stripeConnect.invoicePaid",
      stripeInvoiceId: invoice.id,
      documentInvoiceId: result,
    });
  }
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

async function handlePayoutPaid(ctx: HttpActionCtx, payout: Stripe.Payout): Promise<void> {
  // Payout to connected account succeeded
  const stripeAccountId = payout.destination as string | null;

  console.info("Payout paid to connected account", {
    operation: "stripeConnect.payoutPaid",
    payoutId: payout.id,
    stripeAccountId,
    amount: payout.amount,
    currency: payout.currency,
    arrivalDate: payout.arrival_date,
  });

  // Future: Could store payout records or trigger notifications
  // For now, just log for audit trail
}

async function handlePayoutFailed(ctx: HttpActionCtx, payout: Stripe.Payout): Promise<void> {
  // Payout to connected account failed
  const stripeAccountId = payout.destination as string | null;

  console.warn("Payout failed for connected account", {
    operation: "stripeConnect.payoutFailed",
    payoutId: payout.id,
    stripeAccountId,
    amount: payout.amount,
    currency: payout.currency,
    failureCode: payout.failure_code,
    failureMessage: payout.failure_message,
  });

  // If we have the account, we could notify the org owner
  if (stripeAccountId) {
    const account = await ctx.runQuery(internal.stripe.connect_mutations.getAccountByStripeId, {
      stripeAccountId,
    });

    if (account) {
      // Future: Send notification to org admins about failed payout
      console.warn("Payout failed for organization", {
        operation: "stripeConnect.payoutFailed",
        organizationId: account.organizationId,
        payoutId: payout.id,
        failureCode: payout.failure_code,
      });
    }
  }
}

export async function processStripeConnectWebhookEvent(
  ctx: HttpActionCtx,
  event: Stripe.Event,
): Promise<void> {
  // Idempotency check: skip if we've already processed this event
  const alreadyProcessed = await ctx.runQuery(
    internal.stripe.webhook_idempotency.isEventProcessed,
    { eventId: event.id },
  );

  if (alreadyProcessed) {
    console.info("Skipping duplicate webhook event", {
      operation: "stripeConnect.webhookIdempotency",
      eventId: event.id,
      eventType: event.type,
    });
    return;
  }

  // Handle Connect-specific events and invoice lifecycle events.
  switch (event.type) {
    case "account.updated":
      await handleAccountUpdated(ctx, event.data.object as Stripe.Account);
      break;
    case "capability.updated":
      await handleCapabilityUpdated(ctx, event.data.object as Stripe.Capability);
      break;
    case "invoice.paid":
      await handleInvoicePaid(ctx, event.data.object as Stripe.Invoice);
      break;
    case "invoice.payment_failed":
      await handleInvoicePaymentFailed(ctx, event.data.object as Stripe.Invoice);
      break;
    case "invoice.voided":
      await handleInvoiceVoided(ctx, event.data.object as Stripe.Invoice);
      break;
    case "invoice.marked_uncollectible":
      await handleInvoiceMarkedUncollectible(ctx, event.data.object as Stripe.Invoice);
      break;
    case "invoice.deleted":
      await handleInvoiceDeleted(ctx, event.data.object as Stripe.Invoice);
      break;
    case "payout.paid":
      await handlePayoutPaid(ctx, event.data.object as Stripe.Payout);
      break;
    case "payout.failed":
      await handlePayoutFailed(ctx, event.data.object as Stripe.Payout);
      break;
    default:
      // Unknown event type - log but don't fail
      console.info("Unhandled Connect webhook event type", {
        operation: "stripeConnect.webhookUnhandled",
        eventType: event.type,
        eventId: event.id,
      });
      return; // Don't mark as processed since we didn't handle it
  }

  // Mark event as processed for idempotency
  await ctx.runMutation(internal.stripe.webhook_idempotency.markEventProcessed, {
    eventId: event.id,
    eventType: event.type,
    source: "connect",
  });
}
