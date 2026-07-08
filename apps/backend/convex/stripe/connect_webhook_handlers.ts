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
type RecurringInvoiceStatus = "draft" | "open" | "paid" | "void" | "uncollectible";
type StripeConnectWebhookHandler = (ctx: HttpActionCtx, event: Stripe.Event) => Promise<void>;

const recurringInvoiceStatusMap: Record<string, RecurringInvoiceStatus> = {
  draft: "draft",
  open: "open",
  paid: "paid",
  void: "void",
  uncollectible: "uncollectible",
};

function getRecurringInvoiceSubscriptionId(invoice: Stripe.Invoice): string | undefined {
  const subDetails = invoice.parent?.subscription_details;
  return typeof subDetails?.subscription === "string"
    ? subDetails.subscription
    : subDetails?.subscription?.id;
}

function getRecurringInvoiceStatus(invoice: Stripe.Invoice): RecurringInvoiceStatus {
  return recurringInvoiceStatusMap[invoice.status ?? ""] ?? "draft";
}

function getInvoiceCustomerId(invoice: Stripe.Invoice): string | undefined {
  return typeof invoice.customer === "string"
    ? invoice.customer
    : (invoice.customer?.id ?? undefined);
}

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
 * Looks up the config by providerInvoiceId. Returns the config ID if found, null otherwise.
 */
async function updatePaymentFieldFromInvoice(
  ctx: HttpActionCtx,
  invoice: Stripe.Invoice,
  paymentStatus: PaymentStatus,
): Promise<{ configId?: string; documentId?: string; invoiceRecordId?: string } | null> {
  const result = await ctx.runMutation(
    internal.payment_fields.mutations.updatePaymentStatusFromProviderInvoice,
    {
      providerInvoiceId: invoice.id,
      paymentStatus,
    },
  );

  if (result) {
    console.info("Payment field config status updated", {
      operation: "stripeConnect.paymentFieldUpdate",
      providerInvoiceId: invoice.id,
      paymentStatus,
      configId: result.configId,
      documentId: result.documentId,
    });
  }

  return result;
}

/**
 * Upsert a document_invoices record for a subscription invoice.
 * Called on invoice.created and invoice.finalized for recurring billing.
 * Skips non-subscription invoices (one-time invoices are handled by storeProviderPaymentIds).
 */
async function syncRecurringInvoice(
  ctx: HttpActionCtx,
  invoice: Stripe.Invoice,
  stripeAccountId: string,
): Promise<void> {
  const subscriptionId = getRecurringInvoiceSubscriptionId(invoice);
  if (!subscriptionId) {
    // Not a subscription invoice — skip (one-time invoices handled elsewhere)
    return;
  }

  const status = getRecurringInvoiceStatus(invoice);

  await ctx.runMutation(internal.payment_fields.mutations.upsertRecurringInvoice, {
    providerInvoiceId: invoice.id,
    providerSubscriptionId: subscriptionId,
    providerCustomerId: getInvoiceCustomerId(invoice),
    providerAccountId: stripeAccountId,
    status,
    customerEmail: invoice.customer_email ?? "",
    customerName: invoice.customer_name ?? undefined,
    amountDue: invoice.amount_due,
    currency: invoice.currency,
    hostedInvoiceUrl: invoice.hosted_invoice_url ?? undefined,
    invoicePdf: invoice.invoice_pdf ?? undefined,
  });

  console.info("Recurring invoice synced", {
    operation: "stripeConnect.recurringInvoiceSync",
    providerInvoiceId: invoice.id,
    providerSubscriptionId: subscriptionId,
    status,
  });
}

async function handleInvoiceCreated(
  ctx: HttpActionCtx,
  invoice: Stripe.Invoice,
  stripeAccountId: string,
): Promise<void> {
  await syncRecurringInvoice(ctx, invoice, stripeAccountId);
}

async function handleInvoiceFinalized(
  ctx: HttpActionCtx,
  invoice: Stripe.Invoice,
  stripeAccountId: string,
): Promise<void> {
  await syncRecurringInvoice(ctx, invoice, stripeAccountId);
}

async function handleInvoicePaid(ctx: HttpActionCtx, invoice: Stripe.Invoice): Promise<void> {
  console.info("Processing invoice.paid webhook", {
    operation: "stripeConnect.invoicePaid",
    providerInvoiceId: invoice.id,
    status: invoice.status,
    amountPaid: invoice.amount_paid,
  });

  // Update payment_field_configs (new system)
  const result = await updatePaymentFieldFromInvoice(ctx, invoice, "paid");

  // Cancel any active dunning sequence
  if (result?.invoiceRecordId) {
    await ctx.runMutation(internal.payment_fields.dunning.cancelDunning, {
      invoiceId: result.invoiceRecordId as Id<"document_invoices">,
    });
  }

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
    providerInvoiceId: invoice.id,
  });

  // Update payment_field_configs (new system)
  const result = await updatePaymentFieldFromInvoice(ctx, invoice, "failed");

  // Start dunning sequence and send immediate first email
  if (result?.invoiceRecordId) {
    const dunningResult = await ctx.runMutation(internal.payment_fields.dunning.startDunning, {
      invoiceId: result.invoiceRecordId as Id<"document_invoices">,
    });

    if (dunningResult?.started) {
      await ctx.runAction(internal.payment_fields.dunning_email_action.sendDunningEmail, {
        invoiceId: result.invoiceRecordId as Id<"document_invoices">,
        step: 0,
      });
    }
  }
}

async function handleInvoiceVoided(ctx: HttpActionCtx, invoice: Stripe.Invoice): Promise<void> {
  // Update payment_field_configs (new system)
  const result = await updatePaymentFieldFromInvoice(ctx, invoice, "cancelled");

  // Cancel any active dunning sequence
  if (result?.invoiceRecordId) {
    await ctx.runMutation(internal.payment_fields.dunning.cancelDunning, {
      invoiceId: result.invoiceRecordId as Id<"document_invoices">,
    });
  }
}

async function handleInvoiceMarkedUncollectible(
  ctx: HttpActionCtx,
  invoice: Stripe.Invoice,
): Promise<void> {
  // Update payment_field_configs (new system)
  const result = await updatePaymentFieldFromInvoice(ctx, invoice, "failed");

  // Cancel dunning — invoice is already written off
  if (result?.invoiceRecordId) {
    await ctx.runMutation(internal.payment_fields.dunning.cancelDunning, {
      invoiceId: result.invoiceRecordId as Id<"document_invoices">,
    });
  }
}

async function handleInvoiceDeleted(ctx: HttpActionCtx, invoice: Stripe.Invoice): Promise<void> {
  // Update payment_field_configs (new system)
  const result = await updatePaymentFieldFromInvoice(ctx, invoice, "cancelled");

  // Cancel dunning — invoice no longer exists
  if (result?.invoiceRecordId) {
    await ctx.runMutation(internal.payment_fields.dunning.cancelDunning, {
      invoiceId: result.invoiceRecordId as Id<"document_invoices">,
    });
  }
}

/**
 * Update payment_field_configs status from a Stripe subscription event.
 * Looks up the config by providerSubscriptionId.
 */
async function updatePaymentFieldFromSubscription(
  ctx: HttpActionCtx,
  subscription: Stripe.Subscription,
  paymentStatus: PaymentStatus,
): Promise<string | null> {
  const result = await ctx.runMutation(
    internal.payment_fields.mutations.updatePaymentStatusFromProviderSubscription,
    {
      providerSubscriptionId: subscription.id,
      paymentStatus,
    },
  );

  if (result) {
    console.info("Payment field config status updated from subscription event", {
      operation: "stripeConnect.subscriptionPaymentFieldUpdate",
      providerSubscriptionId: subscription.id,
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
    providerSubscriptionId: subscription.id,
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
    providerSubscriptionId: subscription.id,
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

const stripeConnectWebhookHandlers: Record<string, StripeConnectWebhookHandler> = {
  "account.updated": async (ctx, event) => {
    await handleAccountUpdated(ctx, event.data.object as Stripe.Account);
  },
  "capability.updated": async (ctx, event) => {
    await handleCapabilityUpdated(ctx, event.data.object as Stripe.Capability);
  },
  "invoice.created": async (ctx, event) => {
    await handleInvoiceCreated(ctx, event.data.object as Stripe.Invoice, event.account ?? "");
  },
  "invoice.finalized": async (ctx, event) => {
    await handleInvoiceFinalized(ctx, event.data.object as Stripe.Invoice, event.account ?? "");
  },
  "invoice.paid": async (ctx, event) => {
    await handleInvoicePaid(ctx, event.data.object as Stripe.Invoice);
  },
  "invoice.payment_failed": async (ctx, event) => {
    await handleInvoicePaymentFailed(ctx, event.data.object as Stripe.Invoice);
  },
  "invoice.voided": async (ctx, event) => {
    await handleInvoiceVoided(ctx, event.data.object as Stripe.Invoice);
  },
  "invoice.marked_uncollectible": async (ctx, event) => {
    await handleInvoiceMarkedUncollectible(ctx, event.data.object as Stripe.Invoice);
  },
  "invoice.deleted": async (ctx, event) => {
    await handleInvoiceDeleted(ctx, event.data.object as Stripe.Invoice);
  },
  "customer.subscription.updated": async (ctx, event) => {
    await handleSubscriptionUpdated(ctx, event.data.object as Stripe.Subscription);
  },
  "customer.subscription.deleted": async (ctx, event) => {
    await handleSubscriptionDeleted(ctx, event.data.object as Stripe.Subscription);
  },
  "payout.paid": async (ctx, event) => {
    await handlePayoutPaid(ctx, event.data.object as Stripe.Payout);
  },
  "payout.failed": async (ctx, event) => {
    await handlePayoutFailed(ctx, event.data.object as Stripe.Payout);
  },
};

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

  const handler = stripeConnectWebhookHandlers[event.type];
  if (!handler) {
    console.info("Unhandled Connect webhook event type", {
      operation: "stripeConnect.webhookUnhandled",
      eventType: event.type,
      eventId: event.id,
    });
    return;
  }

  await handler(ctx, event);

  // Mark event as processed for idempotency
  await ctx.runMutation(internal.stripe.webhook_idempotency.markEventProcessed, {
    eventId: event.id,
    eventType: event.type,
    source: "connect",
  });
}
