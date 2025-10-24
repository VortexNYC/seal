/**
 * Stripe Helper Functions
 *
 * Shared utilities for Stripe operations across webhooks and mutations.
 */

import type Stripe from "stripe";

/**
 * Get or create a Stripe customer for a user
 *
 * This function prevents duplicate customer creation by:
 * 1. Checking if user already has a stripeCustomerId
 * 2. Searching Stripe for existing customers with the same email
 * 3. Only creating a new customer if none exists
 *
 * @param stripe - Stripe client instance
 * @param userId - Auth0 user ID
 * @param email - User's email address
 * @param name - User's display name
 * @param existingStripeCustomerId - Optional existing customer ID from user record
 * @returns Stripe customer ID
 */
export async function getOrCreateStripeCustomer(
	stripe: Stripe,
	userId: string,
	email: string,
	name: string,
	existingStripeCustomerId?: string,
): Promise<string> {
	// 1. If user already has a customer ID, verify it exists and return it
	if (existingStripeCustomerId) {
		try {
			const customer = await stripe.customers.retrieve(
				existingStripeCustomerId,
			);
			if (!customer.deleted) {
				console.warn(
					`Using existing Stripe customer ${existingStripeCustomerId} for user ${userId}`,
				);
				return existingStripeCustomerId;
			}
		} catch (err) {
			console.error(
				"Failed to retrieve existing Stripe customer, will search/create",
				{
					operation: "getOrCreateStripeCustomer.retrieve",
					userId,
					stripeCustomerId: existingStripeCustomerId,
					error: err instanceof Error ? err.message : String(err),
				},
			);
		}
	}

	// 2. Search for existing customers by email
	try {
		const searchResults = await stripe.customers.search({
			query: `email:'${email.replace(/'/g, "\\'")}' AND metadata['userId']:'${userId.replace(/'/g, "\\'")}'`,
			limit: 1,
		});

		if (searchResults.data.length > 0) {
			const existingCustomer = searchResults.data[0];
			if (existingCustomer) {
				console.warn(
					`Found existing Stripe customer ${existingCustomer.id} for user ${userId}, reusing instead of creating duplicate`,
				);
				return existingCustomer.id;
			}
		}
	} catch (err) {
		console.error("Stripe customer search failed, will attempt to create", {
			operation: "getOrCreateStripeCustomer.search",
			userId,
			email,
			error: err instanceof Error ? err.message : String(err),
			stack: err instanceof Error ? err.stack : undefined,
		});
	}

	// 3. No existing customer found - create new one
	try {
		const idempotencyKey = `customer:create:${userId}`;
		const customer = await stripe.customers.create(
			{
				email,
				name,
				metadata: {
					userId,
				},
			},
			{
				idempotencyKey,
			},
		);

		console.warn(
			`Created new Stripe customer ${customer.id} for user ${userId}`,
		);
		return customer.id;
	} catch (err) {
		console.error("Stripe customer creation failed", {
			operation: "getOrCreateStripeCustomer.create",
			userId,
			email,
			name,
			error: err instanceof Error ? err.message : String(err),
			stack: err instanceof Error ? err.stack : undefined,
		});
		throw err;
	}
}
