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
import type { PaymentStatus } from "../schemas/payment_field_configs";
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

/**
 * Update payment_field_configs status from a Stripe invoice event.
 * Looks up the config by stripeInvoiceId. Returns the config ID if found, null otherwise.
 */
async function updatePaymentFieldFromInvoice(
  ctx: HttpActionCtx,
  invoice: Stripe.Invoice,
  paymentStatus: PaymentStatus,
): Promise<{ configId: string; documentId: string } | null> {
  const result = await ctx.runMutation(
    internal.payment_fields.mutations.updatePaymentStatusFromWebhook,
    {
      stripeInvoiceId: invoice.id,
      paymentStatus,
    },
  );

  if (result) {
    console.info("Payment field config status updated", {
      operation: "stripeConnect.paymentFieldUpdate",
      stripeInvoiceId: invoice.id,
      paymentStatus,
      configId: result.configId,
      documentId: result.documentId,
    });
  }

  return result;
}

async function handleInvoicePaid(ctx: HttpActionCtx, invoice: Stripe.Invoice): Promise<void> {
  console.info("Processing invoice.paid webhook", {
    operation: "stripeConnect.invoicePaid",
    stripeInvoiceId: invoice.id,
    status: invoice.status,
    amountPaid: invoice.amount_paid,
  });

  // Update payment_field_configs (new system)
  const result = await updatePaymentFieldFromInvoice(ctx, invoice, "paid");

  // If a payment config was updated, check if the document can now complete
  if (result?.documentId) {
    await ctx.runMutation(internal.documents.workflow_mutations.checkPaymentCompletionAndFinalize, {
      documentId: result.documentId as Id<"documents">,
    });
  }
}

async function handleInvoicePaymentFailed(
  ctx: HttpActionCtx,
  invoice: Stripe.Invoice,
): Promise<void> {
  console.warn("Invoice payment failed", {
    operation: "stripeConnect.invoicePaymentFailed",
    stripeInvoiceId: invoice.id,
  });

  // Update payment_field_configs (new system)
  await updatePaymentFieldFromInvoice(ctx, invoice, "failed");
}

async function handleInvoiceVoided(ctx: HttpActionCtx, invoice: Stripe.Invoice): Promise<void> {
  // Update payment_field_configs (new system)
  await updatePaymentFieldFromInvoice(ctx, invoice, "cancelled");
}

async function handleInvoiceMarkedUncollectible(
  ctx: HttpActionCtx,
  invoice: Stripe.Invoice,
): Promise<void> {
  // Update payment_field_configs (new system)
  await updatePaymentFieldFromInvoice(ctx, invoice, "failed");
}

async function handleInvoiceDeleted(ctx: HttpActionCtx, invoice: Stripe.Invoice): Promise<void> {
  // Update payment_field_configs (new system)
  await updatePaymentFieldFromInvoice(ctx, invoice, "cancelled");
}

/**
 * Update payment_field_configs status from a Stripe subscription event.
 * Looks up the config by stripeSubscriptionId.
 */
async function updatePaymentFieldFromSubscription(
  ctx: HttpActionCtx,
  subscription: Stripe.Subscription,
  paymentStatus: PaymentStatus,
): Promise<string | null> {
  const result = await ctx.runMutation(
    internal.payment_fields.mutations.updatePaymentStatusFromSubscriptionWebhook,
    {
      stripeSubscriptionId: subscription.id,
      paymentStatus,
    },
  );

  if (result) {
    console.info("Payment field config status updated from subscription event", {
      operation: "stripeConnect.subscriptionPaymentFieldUpdate",
      stripeSubscriptionId: subscription.id,
      paymentStatus,
      configId: result,
    });
  }

  return result;
}

async function handleSubscriptionUpdated(
  ctx: HttpActionCtx,
  subscription: Stripe.Subscription,
): Promise<void> {
  console.info("Processing customer.subscription.updated webhook", {
    operation: "stripeConnect.subscriptionUpdated",
    stripeSubscriptionId: subscription.id,
    status: subscription.status,
  });

  // Map Stripe subscription status to our payment status
  const statusMap: Record<string, PaymentStatus> = {
    active: "awaiting", // Active subscription = awaiting next payment
    past_due: "failed",
    canceled: "cancelled",
    unpaid: "failed",
    incomplete: "awaiting",
    incomplete_expired: "cancelled",
    trialing: "awaiting",
    paused: "awaiting",
  };

  const paymentStatus = statusMap[subscription.status];
  if (paymentStatus) {
    await updatePaymentFieldFromSubscription(ctx, subscription, paymentStatus);
  }
}

async function handleSubscriptionDeleted(
  ctx: HttpActionCtx,
  subscription: Stripe.Subscription,
): Promise<void> {
  console.info("Processing customer.subscription.deleted webhook", {
    operation: "stripeConnect.subscriptionDeleted",
    stripeSubscriptionId: subscription.id,
  });

  // Check if subscription completed all iterations (ended naturally) vs. was cancelled
  // If ended_at is set, it means the subscription ran its course
  const paymentStatus: PaymentStatus =
    subscription.ended_at && subscription.cancel_at_period_end ? "paid" : "cancelled";

  await updatePaymentFieldFromSubscription(ctx, subscription, paymentStatus);
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
    case "customer.subscription.updated":
      await handleSubscriptionUpdated(ctx, event.data.object as Stripe.Subscription);
      break;
    case "customer.subscription.deleted":
      await handleSubscriptionDeleted(ctx, event.data.object as Stripe.Subscription);
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
