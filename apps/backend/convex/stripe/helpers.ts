/**
 * Stripe Helper Functions
 *
 * Shared utilities for Stripe operations across webhooks and mutations.
 */

import type Stripe from "stripe";

/**
 * Get or create a Stripe customer for an organization.
 *
 * Prevents duplicate customer creation by:
 * 1. Checking if org already has a stripeCustomerId
 * 2. Searching Stripe for existing customers by email + organizationId metadata
 * 3. Only creating a new customer if none exists
 */
export async function getOrCreateStripeCustomer(
  stripe: Stripe,
  organizationId: string,
  email: string,
  name: string,
  existingStripeCustomerId?: string,
): Promise<string> {
  // 1. If user already has a customer ID, verify it exists and return it
  if (existingStripeCustomerId) {
    try {
      const customer = await stripe.customers.retrieve(existingStripeCustomerId);
      if (!customer.deleted) {
        console.warn(
          `Using existing Stripe customer ${existingStripeCustomerId} for user ${organizationId}`,
        );
        return existingStripeCustomerId;
      }
    } catch (err) {
      console.error("Failed to retrieve existing Stripe customer, will search/create", {
        operation: "getOrCreateStripeCustomer.retrieve",
        organizationId,
        stripeCustomerId: existingStripeCustomerId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // 2. Search for existing customers by email
  try {
    const searchResults = await stripe.customers.search({
      query: `email:'${email.replace(/'/g, "\\'")}' AND metadata['organizationId']:'${organizationId.replace(/'/g, "\\'")}'`,
      limit: 1,
    });

    if (searchResults.data.length > 0) {
      const existingCustomer = searchResults.data[0];
      if (existingCustomer) {
        console.warn(
          `Found existing Stripe customer ${existingCustomer.id} for user ${organizationId}, reusing instead of creating duplicate`,
        );
        return existingCustomer.id;
      }
    }
  } catch (err) {
    console.error("Stripe customer search failed — aborting to prevent duplicate creation", {
      operation: "getOrCreateStripeCustomer.search",
      organizationId,
      email,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }

  // 3. No existing customer found - create new one
  try {
    const customer = await stripe.customers.create({
      email,
      name,
      metadata: {
        organizationId,
      },
    });

    console.warn(`Created new Stripe customer ${customer.id} for user ${organizationId}`);
    return customer.id;
  } catch (err) {
    console.error("Stripe customer creation failed", {
      operation: "getOrCreateStripeCustomer.create",
      organizationId,
      email,
      name,
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
    throw err;
  }
}
