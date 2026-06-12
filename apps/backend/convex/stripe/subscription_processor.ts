"use node";

import Stripe from "stripe";

import type { Id } from "../_generated/dataModel";
import { getOrCreateStripeCustomer } from "./helpers";

function initializeStripe(): Stripe {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    throw new Error("STRIPE_SECRET_KEY not configured");
  }

  return new Stripe(stripeSecretKey, {
    apiVersion: "2026-02-25.clover",
  });
}

export async function getOrCreateBillingCustomerId(args: {
  organizationId: Id<"organizations">;
  adminEmail: string;
  organizationName: string;
}): Promise<string> {
  const stripe = initializeStripe();
  return await getOrCreateStripeCustomer(
    stripe,
    args.organizationId,
    args.adminEmail,
    args.organizationName,
    undefined,
  );
}

export async function createHostedCheckoutSession(args: {
  customerId: string;
  externalPriceId: string;
  quantity: number;
  successUrl: string;
  cancelUrl: string;
  organizationId: Id<"organizations">;
  lookupKey: string;
}): Promise<string> {
  const stripe = initializeStripe();
  const session = await stripe.checkout.sessions.create({
    customer: args.customerId,
    mode: "subscription",
    line_items: [
      {
        price: args.externalPriceId,
        quantity: args.quantity,
      },
    ],
    success_url: args.successUrl,
    cancel_url: args.cancelUrl,
    subscription_data: {
      metadata: {
        organizationId: args.organizationId,
        lookupKey: args.lookupKey,
      },
    },
  });

  if (!session.url) {
    throw new Error("Failed to create checkout session");
  }

  return session.url;
}

export async function createCustomerPortalUrl(args: {
  customerId: string;
  returnUrl: string;
}): Promise<string> {
  const stripe = initializeStripe();
  const session = await stripe.billingPortal.sessions.create({
    customer: args.customerId,
    return_url: args.returnUrl,
  });

  return session.url;
}

export async function pauseProcessorSubscription(args: {
  processorSubscriptionId: string;
  processorAccountId: string;
}): Promise<void> {
  const stripe = initializeStripe();
  await stripe.subscriptions.update(
    args.processorSubscriptionId,
    { pause_collection: { behavior: "void" } },
    { stripeAccount: args.processorAccountId },
  );
}

export async function resumeProcessorSubscription(args: {
  processorSubscriptionId: string;
  processorAccountId: string;
}): Promise<void> {
  const stripe = initializeStripe();
  await stripe.subscriptions.update(
    args.processorSubscriptionId,
    { pause_collection: null },
    { stripeAccount: args.processorAccountId },
  );
}

export async function cancelProcessorSubscription(args: {
  processorSubscriptionId: string;
  processorAccountId: string;
}): Promise<void> {
  const stripe = initializeStripe();
  await stripe.subscriptions.update(
    args.processorSubscriptionId,
    { cancel_at_period_end: true },
    { stripeAccount: args.processorAccountId },
  );
}
