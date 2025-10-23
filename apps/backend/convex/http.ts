import { httpRouter } from "convex/server";
import Stripe from "stripe";
import { httpAction } from "./_generated/server";
import { processStripeWebhookEvent } from "./stripe/webhook_handlers";

const http = httpRouter();

http.route({
	path: "/stripe-webhook",
	method: "POST",
	handler: httpAction(async (ctx, request) => {
		const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
		const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

		if (!webhookSecret || !stripeSecretKey) {
			console.error("Stripe webhook configuration missing", {
				operation: "stripeWebhook.configCheck",
				requiredConfig: !webhookSecret
					? "STRIPE_WEBHOOK_SECRET"
					: "STRIPE_SECRET_KEY",
			});
			return new Response("Webhook configuration error", { status: 500 });
		}

		const stripe = new Stripe(stripeSecretKey, {
			apiVersion: "2025-09-30.clover",
		});

		const signature = request.headers.get("stripe-signature");
		if (!signature) {
			return new Response("Missing stripe-signature header", { status: 400 });
		}

		const body = await request.text();

		let event: Stripe.Event;
		try {
			event = await stripe.webhooks.constructEventAsync(
				body,
				signature,
				webhookSecret,
			);
		} catch (err) {
			console.error("Stripe webhook signature verification failed", {
				operation: "stripeWebhook.signatureVerification",
				hasSignature: !!signature,
				error: err instanceof Error ? err.message : String(err),
			});
			return new Response("Invalid signature", { status: 400 });
		}

		// Handle different event types
		await processStripeWebhookEvent(ctx, event);

		return new Response("Webhook processed", { status: 200 });
	}),
});

export default http;
