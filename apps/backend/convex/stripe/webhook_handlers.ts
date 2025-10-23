/**
 * Stripe Webhook Event Handlers
 *
 * Extracted handlers for Stripe subscription and payment events
 */

import type { GenericActionCtx } from "convex/server";
import type Stripe from "stripe";
import { internal } from "../_generated/api";
import type { DataModel } from "../_generated/dataModel";

type HttpActionCtx = GenericActionCtx<DataModel>;

async function handleSubscriptionCreated(
	ctx: HttpActionCtx,
	subscription: Stripe.Subscription,
): Promise<void> {
	await ctx.runMutation(internal.stripe.handlers.handleSubscriptionCreated, {
		subscription,
	});
}

async function handleSubscriptionUpdated(
	ctx: HttpActionCtx,
	subscription: Stripe.Subscription,
): Promise<void> {
	await ctx.runMutation(internal.stripe.handlers.handleSubscriptionUpdated, {
		subscription,
	});
}

async function handleSubscriptionDeleted(
	ctx: HttpActionCtx,
	subscription: Stripe.Subscription,
): Promise<void> {
	await ctx.runMutation(internal.stripe.handlers.handleSubscriptionDeleted, {
		subscription,
	});
}

async function handlePaymentSucceeded(
	ctx: HttpActionCtx,
	invoice: Stripe.Invoice,
): Promise<void> {
	await ctx.runMutation(internal.stripe.handlers.handlePaymentSucceeded, {
		invoice,
	});
}

async function handlePaymentFailed(
	ctx: HttpActionCtx,
	invoice: Stripe.Invoice,
): Promise<void> {
	await ctx.runMutation(internal.stripe.handlers.handlePaymentFailed, {
		invoice,
	});
}

async function handleProductOrPriceChange(ctx: HttpActionCtx): Promise<void> {
	await ctx.runAction(internal.stripe.sync.syncFromStripeWebhook);
}

async function handleProductDeleted(
	ctx: HttpActionCtx,
	obj: Stripe.DeletedProduct,
) {
	try {
		await ctx.runMutation(internal.stripe.sync.setProductStatus, {
			externalProductId: obj.id,
			status: "deleted",
		});
	} catch (err) {
		console.error("Failed to mark product as deleted", {
			operation: "handleProductDeleted",
			productId: obj.id,
			error: err instanceof Error ? err.message : String(err),
			willContinue: true,
		});
	}
}

async function handlePriceDeleted(
	ctx: HttpActionCtx,
	obj: Stripe.DeletedPrice,
) {
	try {
		await ctx.runMutation(internal.stripe.sync.setPriceStatus, {
			externalPriceId: obj.id,
			status: "deleted",
		});
	} catch (err) {
		console.error("Failed to mark price as deleted", {
			operation: "handlePriceDeleted",
			priceId: obj.id,
			error: err instanceof Error ? err.message : String(err),
			willContinue: true,
		});
	}
}

async function handleCheckoutCompleted(
	ctx: HttpActionCtx,
	session: Stripe.Checkout.Session,
): Promise<void> {
	await ctx.runMutation(internal.stripe.handlers.handleCheckoutCompleted, {
		session,
	});
}

type EventHandler = (ctx: HttpActionCtx, data: unknown) => Promise<void>;

const EVENT_HANDLERS: Record<string, EventHandler> = {
	"customer.subscription.created": (ctx, data) =>
		handleSubscriptionCreated(ctx, data as Stripe.Subscription),
	"customer.subscription.updated": (ctx, data) =>
		handleSubscriptionUpdated(ctx, data as Stripe.Subscription),
	"customer.subscription.deleted": (ctx, data) =>
		handleSubscriptionDeleted(ctx, data as Stripe.Subscription),
	"invoice.payment_succeeded": (ctx, data) =>
		handlePaymentSucceeded(ctx, data as Stripe.Invoice),
	"invoice.payment_failed": (ctx, data) =>
		handlePaymentFailed(ctx, data as Stripe.Invoice),
	"checkout.session.completed": (ctx, data) =>
		handleCheckoutCompleted(ctx, data as Stripe.Checkout.Session),
	"product.created": (ctx) => handleProductOrPriceChange(ctx),
	"product.updated": (ctx) => handleProductOrPriceChange(ctx),
	"product.deleted": (ctx, data) =>
		handleProductDeleted(ctx, data as unknown as Stripe.DeletedProduct),
	"price.created": (ctx) => handleProductOrPriceChange(ctx),
	"price.updated": (ctx) => handleProductOrPriceChange(ctx),
	"price.deleted": (ctx, data) =>
		handlePriceDeleted(ctx, data as unknown as Stripe.DeletedPrice),
};

export async function processStripeWebhookEvent(
	ctx: HttpActionCtx,
	event: Stripe.Event,
): Promise<void> {
	const handler = EVENT_HANDLERS[event.type];
	if (handler) {
		await handler(ctx, event.data.object);
	} else {
		console.warn(`Unhandled Stripe event type: ${event.type}`);
	}
}
