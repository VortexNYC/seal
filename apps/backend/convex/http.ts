import { httpRouter } from "convex/server";
import Stripe from "stripe";
import { Webhook } from "svix";
import { internal } from "./_generated/api";
import { api } from "./_generated/api";
import { httpAction } from "./_generated/server";
import { processStripeWebhookEvent } from "./stripe/webhook_handlers";

interface ClerkWebhookEvent {
	type:
		| "user.created"
		| "user.updated"
		| "user.deleted"
		| "organization.created"
		| "organization.updated"
		| "organization.deleted"
		| "organizationMembership.created"
		| "organizationMembership.updated"
		| "organizationMembership.deleted"
		| "organizationInvitation.created"
		| "organizationInvitation.accepted"
		| "organizationInvitation.revoked";
	data: {
		id: string;
		first_name?: string;
		last_name?: string;
		email_addresses?: Array<{
			email_address: string;
			verification?: { status: string };
		}>;
		image_url?: string;
		name?: string;
		slug?: string;
		logo_url?: string;
		public_metadata?: Record<string, unknown>;
		private_metadata?: Record<string, unknown>;
		// For membership events
		organization?: { id: string };
		public_user_data?: { user_id: string };
		role?: string;
		// For invitation events (organization_id is a direct field, not nested)
		organization_id?: string;
		email_address?: string;
		status?: string;
		created_at?: number;
		updated_at?: number;
	};
}

const http = httpRouter();

http.route({
	path: "/clerk-webhooks",
	method: "POST",
	handler: httpAction(async (ctx, request) => {
		const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;

		if (!webhookSecret) {
			console.error("CLERK_WEBHOOK_SECRET not configured");
			return new Response("Webhook secret not configured", { status: 500 });
		}

		// Get Svix headers for webhook verification
		const svixId = request.headers.get("svix-id");
		const svixTimestamp = request.headers.get("svix-timestamp");
		const svixSignature = request.headers.get("svix-signature");

		if (!svixId || !svixTimestamp || !svixSignature) {
			console.error("Missing svix headers");
			return new Response("Missing webhook headers", { status: 400 });
		}

		const payload = await request.text();

		// Verify webhook signature using Svix
		const wh = new Webhook(webhookSecret);

		let evt: ClerkWebhookEvent;
		try {
			evt = wh.verify(payload, {
				"svix-id": svixId,
				"svix-timestamp": svixTimestamp,
				"svix-signature": svixSignature,
			}) as ClerkWebhookEvent;
		} catch (err) {
			console.error("Webhook verification failed:", err);
			return new Response("Webhook verification failed", { status: 400 });
		}

		const { type, data } = evt;
		console.log(`[Clerk Webhook] Received: ${type}`, { id: data.id });

		try {
			switch (type) {
				case "user.created":
				case "user.updated": {
					const firstName = data.first_name || "";
					const lastName = data.last_name || "";
					const fullName = `${firstName} ${lastName}`.trim();

					await ctx.runMutation(api.webhooks.syncUser, {
						clerkId: data.id,
						name: fullName || undefined,
						email: data.email_addresses?.[0]?.email_address || "",
						avatar: data.image_url || undefined,
						isEmailVerified:
							data.email_addresses?.[0]?.verification?.status === "verified",
					});
					console.log(`[Clerk Webhook] User synced: ${data.id}`);
					break;
				}

				case "user.deleted":
					await ctx.runMutation(api.webhooks.deleteUser, {
						clerkId: data.id,
					});
					console.log(`[Clerk Webhook] User deleted: ${data.id}`);
					break;

				case "organization.created":
				case "organization.updated":
					await ctx.runMutation(api.webhooks.syncOrganization, {
						clerkId: data.id,
						name: data.name || "",
						slug: data.slug || undefined,
						logo: data.logo_url || undefined,
						metadata: data.public_metadata
							? JSON.stringify(data.public_metadata)
							: undefined,
					});
					console.log(`[Clerk Webhook] Organization synced: ${data.id}`);
					break;

				case "organization.deleted":
					await ctx.runMutation(api.webhooks.deleteOrganization, {
						clerkId: data.id,
					});
					console.log(`[Clerk Webhook] Organization deleted: ${data.id}`);
					break;

				case "organizationMembership.created":
					// Use enhanced upsert with retry logic and clerkMembershipId tracking
					if (data.organization?.id && data.public_user_data?.user_id) {
						await ctx.runMutation(internal.webhooks.upsertMembershipFromClerk, {
							clerkUserId: data.public_user_data.user_id,
							clerkOrgId: data.organization.id,
							clerkMembershipId: data.id, // Track the membership ID
							role: data.role || "member",
						});
						console.log(
							`[Clerk Webhook] Membership created: ${data.public_user_data.user_id} -> ${data.organization.id} (${data.id})`,
						);
					}
					break;

				case "organizationMembership.updated":
					// For updates, just sync without creating new records
					if (data.id) {
						await ctx.runMutation(internal.webhooks.syncMembershipFromClerk, {
							clerkMembershipId: data.id,
						});
						console.log(
							`[Clerk Webhook] Membership updated: ${data.id}`,
						);
					}
					break;

				case "organizationMembership.deleted":
					// Use enhanced delete with clerkMembershipId
					if (data.id) {
						await ctx.runMutation(internal.webhooks.deleteMembershipFromClerk, {
							clerkMembershipId: data.id,
						});
						console.log(
							`[Clerk Webhook] Membership deleted: ${data.id}`,
						);
					}
					break;

				case "organizationInvitation.created":
					// Store invitation in database
					console.log(`[Clerk Webhook] Processing invitation.created`, {
						hasOrgId: !!data.organization_id,
						hasEmail: !!data.email_address,
						orgId: data.organization_id,
						email: data.email_address,
					});

					if (data.organization_id && data.email_address) {
						try {
							const result = await ctx.runMutation(internal.webhooks.handleInvitationCreated, {
								clerkInvitationId: data.id,
								clerkOrganizationId: data.organization_id,
								emailAddress: data.email_address,
								role: data.role,
								publicMetadata: data.public_metadata,
								createdAt: data.created_at,
							});
							console.log(
								`[Clerk Webhook] Invitation created successfully: ${data.email_address} -> ${data.organization_id}`,
								result,
							);
						} catch (error) {
							console.error(
								`[Clerk Webhook] Error handling invitation.created:`,
								error,
							);
							throw error;
						}
					} else {
						console.warn(
							`[Clerk Webhook] Missing required data for invitation.created`,
							{ hasOrgId: !!data.organization_id, hasEmail: !!data.email_address },
						);
					}
					break;

				case "organizationInvitation.accepted":
					// Create membership when invitation is accepted
					if (data.organization_id) {
						await ctx.runMutation(internal.webhooks.handleInvitationAccepted, {
							clerkInvitationId: data.id,
							clerkOrganizationId: data.organization_id,
							clerkUserId: data.public_user_data?.user_id,
						});
						console.log(
							`[Clerk Webhook] Invitation accepted: ${data.id}`,
						);
					}
					break;

				case "organizationInvitation.revoked":
					// Remove invitation from database
					await ctx.runMutation(internal.webhooks.handleInvitationRevoked, {
						clerkInvitationId: data.id,
					});
					console.log(
						`[Clerk Webhook] Invitation revoked: ${data.id}`,
					);
					break;

				default:
					console.log(`[Clerk Webhook] Unhandled event type: ${type}`);
					break;
			}

			return new Response("Webhook processed successfully", { status: 200 });
		} catch (error) {
			console.error("[Clerk Webhook] Processing error:", error);
			return new Response("Webhook processing failed", { status: 500 });
		}
	}),
});

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
