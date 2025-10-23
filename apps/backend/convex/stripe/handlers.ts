/**
 * Stripe Webhook Handler
 *
 * Processes Stripe webhook events to sync subscription data with Convex.
 *
 * Events handled:
 * - customer.subscription.created: Create subscription record
 * - customer.subscription.updated: Update subscription status/dates
 * - customer.subscription.deleted: Mark subscription as canceled
 * - invoice.payment_succeeded: Confirm payment received
 * - invoice.payment_failed: Handle failed payments
 */

/* eslint-disable max-lines */

import { v } from "convex/values";
import Stripe from "stripe";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import {
	internalAction,
	internalMutation,
	type MutationCtx,
} from "../_generated/server";

type SubscriptionStatus =
	| "active"
	| "canceled"
	| "past_due"
	| "trialing"
	| "incomplete"
	| "incomplete_expired"
	| "unpaid";

/**
 * Validators for Stripe webhook data
 * We validate only the fields we actually use
 *
 * Note: As of Stripe API 2025-03-31, period dates are in items.data[], not at subscription root
 * Note: We use Stripe's actual types and extract fields in handlers for validation
 */

/**
 * Helper: Convert unix timestamp to milliseconds
 */
function timestampToMs(
	timestamp: number | null | undefined,
): number | undefined {
	return timestamp ? timestamp * 1000 : undefined;
}

/**
 * Extract and validate subscription data from Stripe webhook
 * Stripe API 2025-03-31: period dates are in items.data[], not at subscription root
 */
function extractSubscriptionData(subscription: Stripe.Subscription) {
	// Access customer as string (it's expanded in some contexts, but webhooks send ID)
	const customerId =
		typeof subscription.customer === "string"
			? subscription.customer
			: subscription.customer.id;

	// Get first subscription item for period dates
	const firstItem = subscription.items.data[0];
	if (!firstItem) {
		// Structured error logging for Axiom analytics
		console.error(
			JSON.stringify({
				topic: "stripe_webhook_errors",
				event: "subscription_missing_items",
				operation: "extractSubscriptionData",
				stripeSubscriptionId: subscription.id,
				customerId,
				status: subscription.status,
				itemsCount: subscription.items.data.length,
				severity: "critical",
				timestamp: Date.now(),
			}),
		);
		throw new Error("Subscription has no items");
	}

	// Extract period dates from subscription item (Stripe API 2025-03-31)
	const currentPeriodStart = firstItem.current_period_start;
	const currentPeriodEnd = firstItem.current_period_end;

	if (!currentPeriodStart || !currentPeriodEnd) {
		// Structured error logging for Axiom analytics
		console.error(
			JSON.stringify({
				topic: "stripe_webhook_errors",
				event: "subscription_missing_period_dates",
				operation: "extractSubscriptionData",
				stripeSubscriptionId: subscription.id,
				customerId,
				priceId: firstItem.price.id,
				hasPeriodStart: !!currentPeriodStart,
				hasPeriodEnd: !!currentPeriodEnd,
				severity: "critical",
				timestamp: Date.now(),
			}),
		);
		throw new Error("Subscription item missing period dates");
	}

	return {
		id: subscription.id,
		customer: customerId,
		status: subscription.status as SubscriptionStatus,
		cancelAtPeriodEnd: subscription.cancel_at_period_end,
		canceledAt: timestampToMs(subscription.canceled_at),
		cancelReason: subscription.cancellation_details?.reason || undefined,
		trialStart: timestampToMs(subscription.trial_start),
		trialEnd: timestampToMs(subscription.trial_end),
		latestInvoiceId:
			typeof subscription.latest_invoice === "string"
				? subscription.latest_invoice
				: subscription.latest_invoice?.id,
		userId: subscription.metadata?.userId as Id<"users">,
		priceId: firstItem.price.id,
		currentPeriodStart: currentPeriodStart * 1000, // Convert to ms
		currentPeriodEnd: currentPeriodEnd * 1000, // Convert to ms
	};
}

/**
 * Extract and validate invoice data from Stripe webhook
 */
function extractInvoiceData(invoice: Stripe.Invoice) {
	// Access customer as string (it's expanded in some contexts, but webhooks send ID)
	const customerId =
		typeof invoice.customer === "string"
			? invoice.customer
			: (invoice.customer?.id ?? null);

	// In Stripe API 2025, subscription is in parent.subscription_details.subscription
	const parent = invoice.parent as
		| { subscription_details?: { subscription?: string } }
		| null
		| undefined;
	const subscriptionId = parent?.subscription_details?.subscription;

	return {
		customer: customerId,
		amountPaid: invoice.amount_paid,
		amountDue: invoice.amount_due,
		currency: invoice.currency,
		subscription: subscriptionId,
	};
}

/**
 * Cancel old Stripe subscriptions for a user
 * Helper action to cancel subscriptions in Stripe
 */
export const cancelOldStripeSubscriptions = internalAction({
	args: {
		subscriptionIds: v.array(v.string()),
		userId: v.string(),
	},
	handler: async (_ctx, args) => {
		const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
		if (!stripeSecretKey) {
			console.error(
				"STRIPE_SECRET_KEY not configured for canceling old subscriptions",
			);
			return;
		}

		const stripe = new Stripe(stripeSecretKey, {
			apiVersion: "2025-09-30.clover",
		});

		for (const subscriptionId of args.subscriptionIds) {
			try {
				await stripe.subscriptions.cancel(subscriptionId);
				console.warn(
					`Cancelled old Stripe subscription ${subscriptionId} for user ${args.userId}`,
				);
			} catch (err) {
				console.error(
					`Failed to cancel Stripe subscription ${subscriptionId}`,
					{
						error: err instanceof Error ? err.message : String(err),
						userId: args.userId,
					},
				);
			}
		}
	},
});

/**
 * Helper: Get product metadata for credits calculation
 */
async function getCreditsForPrice(
	ctx: MutationCtx,
	stripePriceId: string,
	userId: Id<"users">,
	subscriptionId: string,
): Promise<number> {
	const now = Date.now();
	const price = await ctx.db
		.query("subscription_prices")
		.withIndex("by_external_price_id", (q) =>
			q.eq("externalPriceId", stripePriceId),
		)
		.first();

	if (!price) {
		console.error("Price not found for new subscription", {
			operation: "getCreditsForPrice",
			stripePriceId,
			userId,
			stripeSubscriptionId: subscriptionId,
			timestamp: now,
		});
		throw new Error(
			`Price not found for new subscription - stripePriceId: ${stripePriceId}`,
		);
	}

	const product = await ctx.db
		.query("subscription_products")
		.withIndex("by_external_product_id", (q) =>
			q.eq("externalProductId", price.externalProductId),
		)
		.first();

	if (!product) {
		console.error("Product not found for new subscription", {
			operation: "getCreditsForPrice",
			stripePriceId,
			stripeProductId: price.externalProductId,
			userId,
			stripeSubscriptionId: subscriptionId,
			timestamp: now,
		});
		throw new Error(
			`Product not found for new subscription - stripePriceId: ${stripePriceId}, stripeProductId: ${price.externalProductId}`,
		);
	}

	if (!product.metadata?.includedCredits) {
		console.error("Product missing includedCredits metadata", {
			operation: "getCreditsForPrice",
			stripeProductId: product.externalProductId,
			productName: product.name,
			metadata: product.metadata,
			stripePriceId,
			userId,
			timestamp: now,
		});
		throw new Error(
			`Product missing includedCredits metadata - stripeProductId: ${product.externalProductId}, productName: ${product.name}`,
		);
	}

	return product.metadata.includedCredits;
}

/**
 * Helper: Log trial conversion events for Axiom analytics
 */
function logTrialConversionIfNeeded(
	existingStatus: SubscriptionStatus,
	subscription: {
		id: string;
		userId: Id<"users"> | undefined;
		customer: string;
		status: SubscriptionStatus;
		trialStart: number | undefined;
		trialEnd: number | undefined;
		cancelReason: string | undefined;
		priceId: string;
	},
): void {
	const wasTrialing = existingStatus === "trialing";
	const nowActive = subscription.status === "active";
	const nowCanceled = subscription.status === "canceled";

	// Trial converted to paid
	if (wasTrialing && nowActive) {
		const trialDurationDays =
			subscription.trialStart && subscription.trialEnd
				? Math.round(
						(subscription.trialEnd - subscription.trialStart) /
							(1000 * 60 * 60 * 24),
					)
				: null;

		console.warn(
			JSON.stringify({
				topic: "trial_conversion",
				event: "trial_converted",
				operation: "handleSubscriptionUpdated",
				stripeSubscriptionId: subscription.id,
				userId: subscription.userId,
				customerId: subscription.customer,
				trialStart: subscription.trialStart,
				trialEnd: subscription.trialEnd,
				trialDurationDays,
				stripePriceId: subscription.priceId,
				timestamp: Date.now(),
			}),
		);
	}

	// Trial ended without conversion
	if (wasTrialing && nowCanceled) {
		console.warn(
			JSON.stringify({
				topic: "trial_conversion",
				event: "trial_not_converted",
				operation: "handleSubscriptionUpdated",
				stripeSubscriptionId: subscription.id,
				userId: subscription.userId,
				customerId: subscription.customer,
				trialStart: subscription.trialStart,
				trialEnd: subscription.trialEnd,
				cancelReason: subscription.cancelReason,
				timestamp: Date.now(),
			}),
		);
	}
}

/**
 * Helper: Cancel other active subscriptions for a user
 */
async function cancelOtherSubscriptions(
	ctx: MutationCtx,
	userId: Id<"users">,
	now: number,
): Promise<void> {
	const otherActiveSubscriptions = await ctx.db
		.query("subscriptions")
		.withIndex("by_user_id", (q) => q.eq("userId", userId))
		.filter((q) => q.eq(q.field("status"), "active"))
		.collect();

	if (otherActiveSubscriptions.length === 0) {
		return;
	}

	const oldSubscriptionIds = otherActiveSubscriptions.map(
		(sub) => sub.externalSubscriptionId,
	);

	console.warn(
		`Found ${otherActiveSubscriptions.length} old active subscription(s) for user ${userId}, canceling them`,
	);

	// Cancel old subscriptions in Convex first
	for (const oldSubscription of otherActiveSubscriptions) {
		await ctx.db.patch(oldSubscription._id, {
			status: "canceled",
			updatedAt: now,
		});
	}

	// Schedule cancellation in Stripe (via action)
	await ctx.scheduler.runAfter(
		0,
		internal.stripe.handlers.cancelOldStripeSubscriptions,
		{
			subscriptionIds: oldSubscriptionIds,
			userId,
		},
	);
}

/**
 * Handle customer.subscription.created event
 * Creates a new subscription record in Convex
 */
export const handleSubscriptionCreated = internalMutation({
	args: { subscription: v.any() },
	handler: async (ctx, args: { subscription: Stripe.Subscription }) => {
		const subscription = extractSubscriptionData(args.subscription);

		if (!subscription.userId) {
			throw new Error("No userId in subscription metadata");
		}

		const now = Date.now();

		// Check if subscription already exists (prevent duplicates from webhook retries)
		const existingSubscription = await ctx.db
			.query("subscriptions")
			.withIndex("by_external_subscription_id", (q) =>
				q.eq("externalSubscriptionId", subscription.id),
			)
			.first();

		if (existingSubscription) {
			console.warn(
				`Subscription ${subscription.id} already exists, updating instead`,
			);

			await ctx.db.patch(existingSubscription._id, {
				externalPriceId: subscription.priceId,
				status: subscription.status,
				currentPeriodStart: subscription.currentPeriodStart,
				currentPeriodEnd: subscription.currentPeriodEnd,
				cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
				canceledAt: subscription.canceledAt,
				cancelReason: subscription.cancelReason,
				trialStart: subscription.trialStart,
				trialEnd: subscription.trialEnd,
				latestInvoiceId: subscription.latestInvoiceId,
				updatedAt: now,
			});
			return;
		}

		// Cancel any other active subscriptions for this user
		await cancelOtherSubscriptions(ctx, subscription.userId, now);

		// Get product metadata to determine included credits
		const creditsIncluded = await getCreditsForPrice(
			ctx,
			subscription.priceId,
			subscription.userId,
			subscription.id,
		);

		await ctx.db.insert("subscriptions", {
			userId: subscription.userId,
			externalCustomerId: subscription.customer,
			externalSubscriptionId: subscription.id,
			externalPriceId: subscription.priceId,
			status: subscription.status,
			currentPeriodStart: subscription.currentPeriodStart,
			currentPeriodEnd: subscription.currentPeriodEnd,
			cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
			// Cancellation tracking
			canceledAt: subscription.canceledAt,
			cancelReason: subscription.cancelReason,
			// Trial period tracking
			trialStart: subscription.trialStart,
			trialEnd: subscription.trialEnd,
			// Latest invoice tracking
			latestInvoiceId: subscription.latestInvoiceId,
			// Credit balances (hybrid billing)
			creditsIncluded,
			creditsUsed: 0,
			creditsRemaining: creditsIncluded,
			topupCreditsRemaining: 0,
			overageEnabled: false,
			overageUsedThisCycle: 0,
			createdAt: now,
			updatedAt: now,
		});

		console.warn(
			`Created subscription for user ${subscription.userId}: ${subscription.id} with ${creditsIncluded} credits`,
		);
	},
});

/**
 * Handle customer.subscription.updated event
 * Updates subscription record in Convex
 * Handles plan changes (upgrade/downgrade) while preserving usage history
 */
export const handleSubscriptionUpdated = internalMutation({
	args: { subscription: v.any() },
	handler: async (ctx, args: { subscription: Stripe.Subscription }) => {
		const subscription = extractSubscriptionData(args.subscription);

		const existingSubscription = await ctx.db
			.query("subscriptions")
			.withIndex("by_external_subscription_id", (q) =>
				q.eq("externalSubscriptionId", subscription.id),
			)
			.first();

		if (!existingSubscription) {
			console.error("Subscription not found for update", {
				operation: "handleSubscriptionUpdated",
				stripeSubscriptionId: subscription.id,
				userId: subscription.userId,
				stripePriceId: subscription.priceId,
				status: subscription.status,
				currentPeriodStart: subscription.currentPeriodStart,
				currentPeriodEnd: subscription.currentPeriodEnd,
				cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
				timestamp: Date.now(),
			});
			throw new Error(
				`Subscription not found for update - stripeSubscriptionId: ${subscription.id}`,
			);
		}

		// Check if the plan changed (price ID is different)
		const planChanged =
			existingSubscription.externalPriceId !== subscription.priceId;

		let updateData: Record<string, unknown> = {
			status: subscription.status,
			currentPeriodStart: subscription.currentPeriodStart,
			currentPeriodEnd: subscription.currentPeriodEnd,
			cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
			canceledAt: subscription.canceledAt,
			cancelReason: subscription.cancelReason,
			trialStart: subscription.trialStart,
			trialEnd: subscription.trialEnd,
			latestInvoiceId: subscription.latestInvoiceId,
			updatedAt: Date.now(),
		};

		// If plan changed, update credits accordingly
		if (planChanged) {
			// Get new plan's included credits
			const price = await ctx.db
				.query("subscription_prices")
				.withIndex("by_external_price_id", (q) =>
					q.eq("externalPriceId", subscription.priceId),
				)
				.first();

			if (!price) {
				console.error("Price not found for subscription update", {
					operation: "handleSubscriptionUpdated.planChange",
					stripePriceId: subscription.priceId,
					stripeSubscriptionId: subscription.id,
				});
				// Continue with other updates but skip credit changes
			} else {
				const product = await ctx.db
					.query("subscription_products")
					.withIndex("by_external_product_id", (q) =>
						q.eq("externalProductId", price.externalProductId),
					)
					.first();

				if (!product) {
					console.error(
						"Product not found for price - skipping credit update",
						{
							operation: "handleSubscriptionUpdated.planChange",
							stripePriceId: subscription.priceId,
							stripeProductId: price.externalProductId,
						},
					);
					// Skip credit update entirely if product is missing
				} else if (!product.metadata?.includedCredits) {
					console.error(
						"Product missing includedCredits metadata - skipping credit update",
						{
							operation: "handleSubscriptionUpdated.planChange",
							stripeProductId: product.externalProductId,
							productName: product.name,
							metadata: product.metadata,
						},
					);
					// Skip credit update if metadata is missing
				} else {
					const newCreditsIncluded = product.metadata.includedCredits;

					// Keep creditsUsed as-is (preserve usage history) - DO NOT update it
					const creditsUsed = existingSubscription.creditsUsed ?? 0;
					const newCreditsRemaining = Math.max(
						0,
						newCreditsIncluded - creditsUsed,
					);

					updateData = {
						...updateData,
						stripePriceId: subscription.priceId,
						creditsIncluded: newCreditsIncluded,
						creditsRemaining: newCreditsRemaining,
						// Explicitly NOT setting creditsUsed - it should remain unchanged
					};

					console.warn(
						`Plan changed for subscription ${subscription.id}: ${existingSubscription.creditsIncluded} -> ${newCreditsIncluded} credits (${creditsUsed} used, ${newCreditsRemaining} remaining)`,
					);
				}
			}
		}

		await ctx.db.patch(existingSubscription._id, updateData);

		// Log trial conversion events for Axiom analytics
		logTrialConversionIfNeeded(existingSubscription.status, subscription);

		console.warn(`Updated subscription: ${subscription.id}`);
	},
});

/**
 * Handle customer.subscription.deleted event
 * Marks subscription as canceled in Convex
 */
export const handleSubscriptionDeleted = internalMutation({
	args: { subscription: v.any() },
	handler: async (ctx, args: { subscription: Stripe.Subscription }) => {
		const subscription = extractSubscriptionData(args.subscription);

		const existingSubscription = await ctx.db
			.query("subscriptions")
			.withIndex("by_external_subscription_id", (q) =>
				q.eq("externalSubscriptionId", subscription.id),
			)
			.first();

		if (!existingSubscription) {
			console.error("Subscription not found for deletion", {
				operation: "handleSubscriptionDeleted",
				stripeSubscriptionId: subscription.id,
				userId: subscription.userId,
				stripePriceId: subscription.priceId,
				status: subscription.status,
				timestamp: Date.now(),
			});
			throw new Error(
				`Subscription not found for deletion - stripeSubscriptionId: ${subscription.id}`,
			);
		}

		const now = Date.now();
		await ctx.db.patch(existingSubscription._id, {
			status: "canceled",
			canceledAt: subscription.canceledAt || now,
			cancelReason: subscription.cancelReason,
			updatedAt: now,
		});

		// Structured logging for Axiom analytics
		console.warn(
			JSON.stringify({
				topic: "subscription_lifecycle",
				event: "subscription_canceled",
				operation: "handleSubscriptionDeleted",
				stripeSubscriptionId: subscription.id,
				userId: subscription.userId,
				customerId: subscription.customer,
				cancelReason: subscription.cancelReason,
				canceledAt: subscription.canceledAt || now,
				cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
				timestamp: now,
			}),
		);

		console.warn(`Deleted subscription: ${subscription.id}`);
	},
});

/**
 * Handle invoice.payment_succeeded event
 * Resets monthly credits on subscription renewal (but NOT on plan changes)
 */
export const handlePaymentSucceeded = internalMutation({
	args: { invoice: v.any() },
	handler: async (ctx, args: { invoice: Stripe.Invoice }) => {
		const invoice = extractInvoiceData(args.invoice);
		const fullInvoice = args.invoice as Stripe.Invoice;

		console.warn(
			`Payment succeeded for customer ${invoice.customer}: ${invoice.amountPaid / 100} ${invoice.currency}`,
		);

		// Structured logging for Axiom analytics
		console.warn(
			JSON.stringify({
				topic: "payment_events",
				event: "payment_succeeded",
				operation: "handlePaymentSucceeded",
				stripeInvoiceId: fullInvoice.id,
				invoiceStatus: fullInvoice.status,
				subscriptionId: invoice.subscription,
				customerId: invoice.customer,
				amountPaid: invoice.amountPaid,
				amountCents: invoice.amountPaid, // For easier revenue calculations
				currency: invoice.currency,
				billingReason: fullInvoice.billing_reason,
				timestamp: Date.now(),
			}),
		);

		// If this is a subscription invoice, check if we should reset monthly credits
		if (invoice.subscription) {
			const subscription = await ctx.db
				.query("subscriptions")
				.withIndex("by_external_subscription_id", (q) =>
					q.eq("externalSubscriptionId", invoice.subscription as string),
				)
				.first();

			if (subscription) {
				// Get the invoice object to check billing_reason
				const billingReason = fullInvoice.billing_reason;

				// Only reset credits on actual subscription renewals, not on:
				// - subscription_create (initial subscription)
				// - subscription_update (plan change)
				// - subscription_cycle (this IS a renewal - reset credits)
				const isRenewal = billingReason === "subscription_cycle";

				if (!isRenewal) {
					console.warn(
						`Payment succeeded but not a renewal (billing_reason: ${billingReason}), skipping credit reset`,
					);
					return;
				}

				// Get product metadata to determine included credits
				const price = await ctx.db
					.query("subscription_prices")
					.withIndex("by_external_price_id", (q) =>
						q.eq("externalPriceId", subscription.externalPriceId),
					)
					.first();

				let creditsIncluded = subscription.creditsIncluded ?? 0;

				// Early return if price not found
				if (!price) {
					console.error("Price not found for subscription renewal", {
						operation: "handlePaymentSucceeded.renewal",
						stripePriceId: subscription.externalPriceId,
					});
				}

				// Lookup product if price exists
				if (price) {
					const product = await ctx.db
						.query("subscription_products")
						.withIndex("by_external_product_id", (q) =>
							q.eq("externalProductId", price.externalProductId),
						)
						.first();

					// eslint-disable-next-line max-depth
					if (!product) {
						console.error("Product not found for subscription renewal", {
							operation: "handlePaymentSucceeded.renewal",
							stripePriceId: subscription.externalPriceId,
							stripeProductId: price.externalProductId,
						});
					} else if (product.metadata?.includedCredits) {
						creditsIncluded = product.metadata.includedCredits;
					} else {
						console.error(
							"Product missing includedCredits metadata for renewal",
							{
								operation: "handlePaymentSucceeded.renewal",
								stripeProductId: product.externalProductId,
								productName: product.name,
								metadata: product.metadata,
							},
						);
					}
				}

				// Reset monthly credits (keep topup credits)
				await ctx.db.patch(subscription._id, {
					creditsIncluded,
					creditsUsed: 0,
					creditsRemaining: creditsIncluded,
					overageUsedThisCycle: 0,
					latestInvoiceId: fullInvoice.id,
					latestInvoiceStatus: fullInvoice.status || undefined,
					updatedAt: Date.now(),
				});

				console.warn(
					`Reset monthly credits for subscription ${invoice.subscription}: ${creditsIncluded} credits (billing_reason: ${billingReason})`,
				);
			}
		}
	},
});

/**
 * Handle invoice.payment_failed event
 * Logs failed payment and potentially notifies user
 */
export const handlePaymentFailed = internalMutation({
	args: { invoice: v.any() },
	handler: async (ctx, args: { invoice: Stripe.Invoice }) => {
		const invoice = extractInvoiceData(args.invoice);
		const fullInvoice = args.invoice as Stripe.Invoice;

		// Structured logging for Axiom analytics
		console.error(
			JSON.stringify({
				topic: "payment_events",
				event: "payment_failed",
				operation: "handlePaymentFailed",
				stripeInvoiceId: fullInvoice.id,
				invoiceStatus: fullInvoice.status,
				subscriptionId: invoice.subscription,
				customerId: invoice.customer,
				amountDue: invoice.amountDue,
				currency: invoice.currency,
				attemptCount: fullInvoice.attempt_count,
				severity: "critical",
				timestamp: Date.now(),
			}),
		);

		// Update subscription status if it exists
		if (invoice.subscription) {
			const subscription = await ctx.db
				.query("subscriptions")
				.withIndex("by_external_subscription_id", (q) =>
					q.eq("externalSubscriptionId", invoice.subscription as string),
				)
				.first();

			if (subscription) {
				await ctx.db.patch(subscription._id, {
					status: "past_due",
					latestInvoiceId: fullInvoice.id,
					latestInvoiceStatus: fullInvoice.status || undefined,
					updatedAt: Date.now(),
				});
			}
		}
	},
});

/**
 * Handle checkout.session.completed event
 * Processes one-time top-up purchases
 */
export const handleCheckoutCompleted = internalMutation({
	args: { session: v.any() },
	handler: async (ctx, args: { session: Stripe.Checkout.Session }) => {
		const session = args.session;

		// Only handle payment mode (one-time purchases)
		if (session.mode !== "payment") {
			return;
		}

		// Check if this is a top-up purchase (has credits_amount in metadata)
		const creditsAmount = session.metadata?.credits_amount;
		const userId = session.metadata?.user_id as Id<"users">;

		if (!creditsAmount || !userId) {
			console.warn(
				`Checkout session ${session.id} completed but missing metadata`,
			);
			return;
		}

		const credits = parseInt(creditsAmount, 10);
		if (Number.isNaN(credits)) {
			console.error(`Invalid credits amount: ${creditsAmount}`);
			return;
		}

		// Find user's active subscription
		const subscription = await ctx.db
			.query("subscriptions")
			.withIndex("by_user_id", (q) => q.eq("userId", userId))
			.filter((q) => q.eq(q.field("status"), "active"))
			.first();

		if (!subscription) {
			console.error(`No active subscription found for user ${userId}`);
			return;
		}

		// Add top-up credits
		const newBalance = (subscription.topupCreditsRemaining ?? 0) + credits;
		await ctx.db.patch(subscription._id, {
			topupCreditsRemaining: newBalance,
			updatedAt: Date.now(),
		});

		console.warn(
			`Added ${credits} top-up credits to user ${userId}. New balance: ${newBalance}`,
		);
	},
});

/**
 * Helper: Get subscriptions that need status checking
 */
export const getSubscriptionsToCheck = internalMutation({
	args: {},
	handler: async (ctx) => {
		const active = await ctx.db
			.query("subscriptions")
			.withIndex("by_status", (q) => q.eq("status", "active"))
			.collect();

		const pastDue = await ctx.db
			.query("subscriptions")
			.withIndex("by_status", (q) => q.eq("status", "past_due"))
			.collect();

		const trialing = await ctx.db
			.query("subscriptions")
			.withIndex("by_status", (q) => q.eq("status", "trialing"))
			.collect();

		const subscriptions = [...active, ...pastDue, ...trialing];

		return subscriptions.map((sub) => ({
			id: sub._id,
			stripeSubscriptionId: sub.externalSubscriptionId,
			status: sub.status,
		}));
	},
});

/**
 * Helper: Update subscription from Stripe data
 */
export const updateSubscriptionFromStripe = internalMutation({
	args: {
		subscriptionId: v.id("subscriptions"),
		status: v.string(),
		currentPeriodStart: v.number(),
		currentPeriodEnd: v.number(),
		cancelAtPeriodEnd: v.boolean(),
	},
	handler: async (ctx, args) => {
		await ctx.db.patch(args.subscriptionId, {
			status: args.status as SubscriptionStatus,
			currentPeriodStart: args.currentPeriodStart,
			currentPeriodEnd: args.currentPeriodEnd,
			cancelAtPeriodEnd: args.cancelAtPeriodEnd,
			updatedAt: Date.now(),
		});
	},
});

/**
 * Check Subscription Status
 *
 * Periodically verify that subscription states are in sync with Stripe.
 * Called by daily cron job to catch any missed webhooks.
 */
export const checkSubscriptionStatus = internalAction({
	args: {},
	handler: async (ctx): Promise<void> => {
		const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
		if (!stripeSecretKey) {
			console.error(
				"STRIPE_SECRET_KEY not configured for checkSubscriptionStatus",
				{
					operation: "checkSubscriptionStatus",
					cronJob: true,
					requiredConfig: "STRIPE_SECRET_KEY",
					timestamp: Date.now(),
				},
			);
			throw new Error(
				"STRIPE_SECRET_KEY not configured - checkSubscriptionStatus cron job cannot run",
			);
		}

		const stripe = new Stripe(stripeSecretKey, {
			apiVersion: "2025-09-30.clover",
		});

		// Get all active or past_due subscriptions
		const subscriptions = await ctx.runMutation(
			internal.stripe.handlers.getSubscriptionsToCheck,
			{},
		);

		console.warn(`Checking status for ${subscriptions.length} subscriptions`);

		for (const subscription of subscriptions) {
			try {
				const stripeSubscription = await stripe.subscriptions.retrieve(
					subscription.stripeSubscriptionId,
				);

				// Period dates are stored in the subscription item, not the subscription itself
				const item = stripeSubscription.items?.data?.[0] as unknown as
					| Record<string, unknown>
					| undefined;
				const currentPeriodStart = item?.current_period_start as
					| number
					| undefined;
				const currentPeriodEnd = item?.current_period_end as number | undefined;

				if (!currentPeriodStart || !currentPeriodEnd) {
					console.error("Missing period dates for subscription", {
						operation: "checkSubscriptionStatus.missingDates",
						stripeSubscriptionId: subscription.stripeSubscriptionId,
						willContinue: true,
					});
					continue;
				}

				console.warn(
					`Syncing subscription ${subscription.stripeSubscriptionId}: ${subscription.status} -> ${stripeSubscription.status}`,
				);

				await ctx.runMutation(
					internal.stripe.handlers.updateSubscriptionFromStripe,
					{
						subscriptionId: subscription.id,
						status: stripeSubscription.status,
						currentPeriodStart: currentPeriodStart * 1000,
						currentPeriodEnd: currentPeriodEnd * 1000,
						cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
					},
				);
			} catch (err) {
				console.error("Failed to check subscription status", {
					operation: "checkSubscriptionStatus",
					stripeSubscriptionId: subscription.stripeSubscriptionId,
					error: err instanceof Error ? err.message : String(err),
					stack: err instanceof Error ? err.stack : undefined,
					willContinue: true,
				});
			}
		}

		console.warn("Subscription status check complete");
	},
});
