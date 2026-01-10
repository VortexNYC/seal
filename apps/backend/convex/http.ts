/**
 * @fileoverview HTTP endpoint definitions for Seal.
 * Includes webhook receivers (Clerk, Stripe) and public REST API endpoints.
 *
 * @module http
 *
 * API Base URL: https://<deployment>.convex.site/api/v1
 *
 * @example
 * ```
 * // Health check
 * GET /api/v1/health
 *
 * // List documents (requires authentication)
 * GET /api/v1/documents
 * Authorization: Bearer <api_key_or_jwt>
 * ```
 */

import { httpRouter } from "convex/server";
import Stripe from "stripe";
import { Webhook } from "svix";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { httpAction } from "./_generated/server";
import {
	API_SCOPES,
	apiHttpAction,
	apiResponse,
	listApiVersions,
	paginatedResponse,
	parseJsonBody,
	parsePagination,
	publicApiHttpAction,
	validateRequiredFields,
} from "./api";
import { ApiError } from "./api/errors";
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

					await ctx.runMutation(api.clerk_webhooks.syncUser, {
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
					await ctx.runMutation(api.clerk_webhooks.deleteUser, {
						clerkId: data.id,
					});
					console.log(`[Clerk Webhook] User deleted: ${data.id}`);
					break;

				case "organization.created":
				case "organization.updated":
					await ctx.runMutation(api.clerk_webhooks.syncOrganization, {
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
					await ctx.runMutation(api.clerk_webhooks.deleteOrganization, {
						clerkId: data.id,
					});
					console.log(`[Clerk Webhook] Organization deleted: ${data.id}`);
					break;

				case "organizationMembership.created":
					// Use enhanced upsert with retry logic and clerkMembershipId tracking
					if (data.organization?.id && data.public_user_data?.user_id) {
						await ctx.runMutation(
							internal.clerk_webhooks.upsertMembershipFromClerk,
							{
								clerkUserId: data.public_user_data.user_id,
								clerkOrgId: data.organization.id,
								clerkMembershipId: data.id, // Track the membership ID
								role: data.role || "member",
							},
						);
						console.log(
							`[Clerk Webhook] Membership created: ${data.public_user_data.user_id} -> ${data.organization.id} (${data.id})`,
						);
					}
					break;

				case "organizationMembership.updated":
					// For updates, just sync without creating new records
					if (data.id) {
						await ctx.runMutation(
							internal.clerk_webhooks.syncMembershipFromClerk,
							{
								clerkMembershipId: data.id,
							},
						);
						console.log(`[Clerk Webhook] Membership updated: ${data.id}`);
					}
					break;

				case "organizationMembership.deleted":
					// Use enhanced delete with clerkMembershipId
					if (data.id) {
						await ctx.runMutation(
							internal.clerk_webhooks.deleteMembershipFromClerk,
							{
								clerkMembershipId: data.id,
							},
						);
						console.log(`[Clerk Webhook] Membership deleted: ${data.id}`);
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
							const result = await ctx.runMutation(
								internal.clerk_webhooks.handleInvitationCreated,
								{
									clerkInvitationId: data.id,
									clerkOrganizationId: data.organization_id,
									emailAddress: data.email_address,
									role: data.role,
									publicMetadata: data.public_metadata,
									createdAt: data.created_at,
								},
							);
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
							{
								hasOrgId: !!data.organization_id,
								hasEmail: !!data.email_address,
							},
						);
					}
					break;

				case "organizationInvitation.accepted":
					// Create membership when invitation is accepted
					if (data.organization_id) {
						await ctx.runMutation(
							internal.clerk_webhooks.handleInvitationAccepted,
							{
								clerkInvitationId: data.id,
								clerkOrganizationId: data.organization_id,
								clerkUserId: data.public_user_data?.user_id,
							},
						);
						console.log(`[Clerk Webhook] Invitation accepted: ${data.id}`);
					}
					break;

				case "organizationInvitation.revoked":
					// Remove invitation from database
					await ctx.runMutation(
						internal.clerk_webhooks.handleInvitationRevoked,
						{
							clerkInvitationId: data.id,
						},
					);
					console.log(`[Clerk Webhook] Invitation revoked: ${data.id}`);
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
			apiVersion: "2025-12-15.clover",
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

// =============================================================================
// PUBLIC REST API ENDPOINTS
// =============================================================================

/**
 * API Health Check
 *
 * @route GET /api/v1/health
 * @public
 *
 * @returns Health status with API version info
 *
 * @example Response
 * ```json
 * {
 *   "status": "ok",
 *   "timestamp": "2025-01-15T10:00:00.000Z",
 *   "version": "2025-01-01",
 *   "versions": [...]
 * }
 * ```
 */
http.route({
	path: "/api/v1/health",
	method: "GET",
	handler: publicApiHttpAction(async () => {
		return apiResponse(200, {
			status: "ok",
			timestamp: new Date().toISOString(),
			version: "2025-01-01",
			versions: listApiVersions(),
		});
	}),
});

/**
 * API Root - Returns available endpoints
 *
 * @route GET /api/v1
 * @public
 */
http.route({
	path: "/api/v1",
	method: "GET",
	handler: publicApiHttpAction(async () => {
		return apiResponse(200, {
			name: "Seal API",
			version: "2025-01-01",
			documentation: "https://docs.seal.app/api",
			endpoints: {
				health: "/api/v1/health",
				documents: "/api/v1/documents",
				templates: "/api/v1/templates",
				webhooks: "/api/v1/webhooks",
			},
		});
	}),
});

// =============================================================================
// DOCUMENTS API
// =============================================================================

/**
 * List Documents
 *
 * @route GET /api/v1/documents
 * @scope seal:documents:read
 *
 * @queryparam {number} [limit=20] - Maximum results (1-100)
 * @queryparam {string} [cursor] - Pagination cursor
 * @queryparam {string} [status] - Filter by workflow status
 *
 * @returns Paginated list of documents
 */
http.route({
	path: "/api/v1/documents",
	method: "GET",
	handler: apiHttpAction(
		async ({ ctx, auth, query }) => {
			const { limit, cursor } = parsePagination(query);

			const result = await ctx.runQuery(
				internal.api.v1.documents.listDocuments,
				{
					userId: auth.userId,
					organizationId: auth.organizationId,
					limit,
					cursor,
					status: query.status,
				},
			);

			return paginatedResponse(
				result.documents,
				result.hasMore,
				result.nextCursor,
			);
		},
		{ scope: API_SCOPES.DOCUMENTS_READ },
	),
});

/**
 * Create Document
 *
 * @route POST /api/v1/documents
 * @scope seal:documents:write
 *
 * @bodyparam {string} title - Document title (required)
 * @bodyparam {string} [description] - Document description
 * @bodyparam {string} storage_id - Convex storage ID for uploaded PDF (required)
 * @bodyparam {number} file_size - File size in bytes (required)
 * @bodyparam {string} [file_type=application/pdf] - MIME type
 * @bodyparam {number} [page_count] - Number of pages
 * @bodyparam {string} [deadline] - ISO 8601 deadline for signing
 *
 * @returns Created document with ID
 */
http.route({
	path: "/api/v1/documents",
	method: "POST",
	handler: apiHttpAction(
		async ({ ctx, auth, request }) => {
			const body = await parseJsonBody<{
				title?: string;
				description?: string;
				storage_id?: string;
				file_size?: number;
				file_type?: string;
				page_count?: number;
				deadline?: string;
			}>(request);

			validateRequiredFields(body, ["title", "storage_id", "file_size"]);

			const deadline = body.deadline
				? new Date(body.deadline).getTime()
				: undefined;

			const documentId = await ctx.runMutation(
				internal.api.v1.documents.createDocument,
				{
					userId: auth.userId,
					organizationId: auth.organizationId,
					title: body.title as string,
					description: body.description,
					storageId: body.storage_id as string,
					fileSize: body.file_size as number,
					fileType: body.file_type ?? "application/pdf",
					pageCount: body.page_count,
					deadline,
				},
			);

			// Fetch the created document
			const document = await ctx.runQuery(
				internal.api.v1.documents.getDocument,
				{
					userId: auth.userId,
					organizationId: auth.organizationId,
					documentId: documentId as Id<"documents">,
					includeRecipients: false,
				},
			);

			return apiResponse(201, document, {
				Location: `/api/v1/documents/${documentId}`,
			});
		},
		{ scope: API_SCOPES.DOCUMENTS_WRITE },
	),
});

/**
 * Get Document by ID
 *
 * @route GET /api/v1/documents/{id}
 * @scope seal:documents:read
 *
 * Note: Convex HTTP router doesn't support path params, so we use query params.
 * Alternative: Pass document ID via query param: ?id=xxx
 *
 * @queryparam {string} id - Document ID (required)
 * @queryparam {boolean} [include_recipients=false] - Include recipient details
 *
 * @returns Document details
 */
http.route({
	path: "/api/v1/documents/get",
	method: "GET",
	handler: apiHttpAction(
		async ({ ctx, auth, query }) => {
			if (!query.id) {
				throw new ApiError(400, "Document ID is required", "VALIDATION_ERROR");
			}

			const document = await ctx.runQuery(
				internal.api.v1.documents.getDocument,
				{
					userId: auth.userId,
					organizationId: auth.organizationId,
					documentId: query.id as Id<"documents">,
					includeRecipients: query.include_recipients === "true",
				},
			);

			if (!document) {
				throw new ApiError(404, "Document not found", "DOCUMENT_NOT_FOUND");
			}

			return apiResponse(200, document);
		},
		{ scope: API_SCOPES.DOCUMENTS_READ },
	),
});

/**
 * Update Document
 *
 * @route PUT /api/v1/documents/update
 * @scope seal:documents:write
 *
 * @queryparam {string} id - Document ID (required)
 * @bodyparam {string} [title] - New title
 * @bodyparam {string} [description] - New description
 * @bodyparam {string} [deadline] - New deadline (ISO 8601)
 *
 * @returns Updated document
 */
http.route({
	path: "/api/v1/documents/update",
	method: "PUT",
	handler: apiHttpAction(
		async ({ ctx, auth, query, request }) => {
			if (!query.id) {
				throw new ApiError(400, "Document ID is required", "VALIDATION_ERROR");
			}

			const body = await parseJsonBody<{
				title?: string;
				description?: string;
				deadline?: string;
			}>(request);

			const deadline = body.deadline
				? new Date(body.deadline).getTime()
				: undefined;

			const result = await ctx.runMutation(
				internal.api.v1.documents.updateDocument,
				{
					userId: auth.userId,
					organizationId: auth.organizationId,
					documentId: query.id as Id<"documents">,
					title: body.title,
					description: body.description,
					deadline,
				},
			);

			if (!result.success) {
				throw new ApiError(
					404,
					result.error ?? "Document not found",
					"DOCUMENT_NOT_FOUND",
				);
			}

			// Fetch the updated document
			const document = await ctx.runQuery(
				internal.api.v1.documents.getDocument,
				{
					userId: auth.userId,
					organizationId: auth.organizationId,
					documentId: query.id as Id<"documents">,
					includeRecipients: false,
				},
			);

			return apiResponse(200, document);
		},
		{ scope: API_SCOPES.DOCUMENTS_WRITE },
	),
});

/**
 * Delete Document
 *
 * @route DELETE /api/v1/documents/delete
 * @scope seal:documents:write
 *
 * Only draft documents can be deleted.
 *
 * @queryparam {string} id - Document ID (required)
 *
 * @returns Success confirmation
 */
http.route({
	path: "/api/v1/documents/delete",
	method: "DELETE",
	handler: apiHttpAction(
		async ({ ctx, auth, query }) => {
			if (!query.id) {
				throw new ApiError(400, "Document ID is required", "VALIDATION_ERROR");
			}

			const result = await ctx.runMutation(
				internal.api.v1.documents.deleteDocument,
				{
					userId: auth.userId,
					organizationId: auth.organizationId,
					documentId: query.id as Id<"documents">,
				},
			);

			if (!result.success) {
				if (result.error?.includes("Only draft")) {
					throw new ApiError(400, result.error, "RESOURCE_CONFLICT");
				}
				throw new ApiError(
					404,
					result.error ?? "Document not found",
					"DOCUMENT_NOT_FOUND",
				);
			}

			return apiResponse(200, { deleted: true });
		},
		{ scope: API_SCOPES.DOCUMENTS_WRITE },
	),
});

/**
 * Send Document for Signing
 *
 * @route POST /api/v1/documents/send
 * @scope seal:documents:write
 *
 * @queryparam {string} id - Document ID (required)
 * @bodyparam {string} [message] - Custom message for recipients
 *
 * @returns Updated document with sent status
 */
http.route({
	path: "/api/v1/documents/send",
	method: "POST",
	handler: apiHttpAction(
		async ({ ctx, auth, query, request }) => {
			if (!query.id) {
				throw new ApiError(400, "Document ID is required", "VALIDATION_ERROR");
			}

			const body = await parseJsonBody<{ message?: string }>(request);

			const result = await ctx.runMutation(
				internal.api.v1.documents.sendDocument,
				{
					userId: auth.userId,
					organizationId: auth.organizationId,
					documentId: query.id as Id<"documents">,
					message: body.message,
				},
			);

			if (!result.success) {
				if (result.error?.includes("at least one recipient")) {
					throw new ApiError(400, result.error, "VALIDATION_ERROR");
				}
				if (result.error?.includes("Cannot send")) {
					throw new ApiError(409, result.error, "DOCUMENT_ALREADY_SENT");
				}
				throw new ApiError(
					404,
					result.error ?? "Document not found",
					"DOCUMENT_NOT_FOUND",
				);
			}

			// Fetch the updated document
			const document = await ctx.runQuery(
				internal.api.v1.documents.getDocument,
				{
					userId: auth.userId,
					organizationId: auth.organizationId,
					documentId: query.id as Id<"documents">,
					includeRecipients: true,
				},
			);

			return apiResponse(200, document);
		},
		{ scope: API_SCOPES.DOCUMENTS_WRITE },
	),
});

/**
 * Void/Cancel Document
 *
 * @route POST /api/v1/documents/void
 * @scope seal:documents:write
 *
 * @queryparam {string} id - Document ID (required)
 * @bodyparam {string} reason - Reason for voiding (required)
 *
 * @returns Updated document with cancelled status
 */
http.route({
	path: "/api/v1/documents/void",
	method: "POST",
	handler: apiHttpAction(
		async ({ ctx, auth, query, request }) => {
			if (!query.id) {
				throw new ApiError(400, "Document ID is required", "VALIDATION_ERROR");
			}

			const body = await parseJsonBody<{ reason?: string }>(request);

			validateRequiredFields(body, ["reason"]);

			const result = await ctx.runMutation(
				internal.api.v1.documents.voidDocument,
				{
					userId: auth.userId,
					organizationId: auth.organizationId,
					documentId: query.id as Id<"documents">,
					reason: body.reason as string,
				},
			);

			if (!result.success) {
				if (result.error?.includes("Cannot void")) {
					throw new ApiError(409, result.error, "DOCUMENT_ALREADY_COMPLETED");
				}
				if (result.error?.includes("already cancelled")) {
					throw new ApiError(409, result.error, "RESOURCE_CONFLICT");
				}
				throw new ApiError(
					404,
					result.error ?? "Document not found",
					"DOCUMENT_NOT_FOUND",
				);
			}

			// Fetch the updated document
			const document = await ctx.runQuery(
				internal.api.v1.documents.getDocument,
				{
					userId: auth.userId,
					organizationId: auth.organizationId,
					documentId: query.id as Id<"documents">,
					includeRecipients: false,
				},
			);

			return apiResponse(200, document);
		},
		{ scope: API_SCOPES.DOCUMENTS_WRITE },
	),
});

/**
 * Download Document PDF
 *
 * @route GET /api/v1/documents/download
 * @scope seal:documents:read
 *
 * Returns a redirect to the PDF download URL.
 *
 * @queryparam {string} id - Document ID (required)
 *
 * @returns Redirect to PDF URL
 */
http.route({
	path: "/api/v1/documents/download",
	method: "GET",
	handler: apiHttpAction(
		async ({ ctx, auth, query }) => {
			if (!query.id) {
				throw new ApiError(400, "Document ID is required", "VALIDATION_ERROR");
			}

			const result = await ctx.runQuery(
				internal.api.v1.documents.getDocumentDownloadUrl,
				{
					userId: auth.userId,
					organizationId: auth.organizationId,
					documentId: query.id as Id<"documents">,
				},
			);

			if (!result) {
				throw new ApiError(404, "Document not found", "DOCUMENT_NOT_FOUND");
			}

			// Return the download URL
			return apiResponse(200, { download_url: result.url });
		},
		{ scope: API_SCOPES.DOCUMENTS_READ },
	),
});

// =============================================================================
// RECIPIENTS API
// =============================================================================

/**
 * List Document Recipients
 *
 * @route GET /api/v1/recipients
 * @scope seal:recipients:read
 *
 * @queryparam {string} document_id - Document ID (required)
 *
 * @returns List of recipients for the document
 */
http.route({
	path: "/api/v1/recipients",
	method: "GET",
	handler: apiHttpAction(
		async ({ ctx, auth, query }) => {
			if (!query.document_id) {
				throw new ApiError(400, "document_id is required", "VALIDATION_ERROR");
			}

			const recipients = await ctx.runQuery(
				internal.api.v1.recipients.listRecipients,
				{
					userId: auth.userId,
					organizationId: auth.organizationId,
					documentId: query.document_id as Id<"documents">,
				},
			);

			if (recipients === null) {
				throw new ApiError(404, "Document not found", "DOCUMENT_NOT_FOUND");
			}

			return apiResponse(200, { data: recipients });
		},
		{ scope: API_SCOPES.RECIPIENTS_READ },
	),
});

/**
 * Add Recipient to Document
 *
 * @route POST /api/v1/recipients
 * @scope seal:recipients:write
 *
 * @queryparam {string} document_id - Document ID (required)
 * @bodyparam {string} email - Recipient email (required)
 * @bodyparam {string} name - Recipient name (required)
 * @bodyparam {string} role - Role: signer, approver, or viewer (required)
 * @bodyparam {number} [order] - Signing order for sequential signing
 * @bodyparam {string} [message] - Custom message for this recipient
 *
 * @returns Created recipient
 */
http.route({
	path: "/api/v1/recipients",
	method: "POST",
	handler: apiHttpAction(
		async ({ ctx, auth, query, request }) => {
			if (!query.document_id) {
				throw new ApiError(400, "document_id is required", "VALIDATION_ERROR");
			}

			const body = await parseJsonBody<{
				email?: string;
				name?: string;
				role?: "signer" | "approver" | "viewer";
				order?: number;
				message?: string;
			}>(request);

			validateRequiredFields(body, ["email", "name", "role"]);

			// Validate role
			if (!["signer", "approver", "viewer"].includes(body.role as string)) {
				throw new ApiError(
					400,
					"role must be one of: signer, approver, viewer",
					"VALIDATION_ERROR",
				);
			}

			const result = await ctx.runMutation(
				internal.api.v1.recipients.addRecipient,
				{
					userId: auth.userId,
					organizationId: auth.organizationId,
					documentId: query.document_id as Id<"documents">,
					email: body.email as string,
					name: body.name as string,
					role: body.role as "signer" | "approver" | "viewer",
					order: body.order,
					customMessage: body.message,
				},
			);

			if (!result.success) {
				if (result.error?.includes("already exists")) {
					throw new ApiError(409, result.error, "RESOURCE_CONFLICT");
				}
				if (result.error?.includes("Cannot add")) {
					throw new ApiError(400, result.error, "RESOURCE_CONFLICT");
				}
				throw new ApiError(
					404,
					result.error ?? "Document not found",
					"DOCUMENT_NOT_FOUND",
				);
			}

			// Fetch the created recipient
			const recipient = await ctx.runQuery(
				internal.api.v1.recipients.getRecipient,
				{
					userId: auth.userId,
					organizationId: auth.organizationId,
					documentId: query.document_id as Id<"documents">,
					recipientId: result.recipientId as Id<"document_recipients">,
				},
			);

			return apiResponse(201, recipient);
		},
		{ scope: API_SCOPES.RECIPIENTS_WRITE },
	),
});

/**
 * Get Recipient Details
 *
 * @route GET /api/v1/recipients/get
 * @scope seal:recipients:read
 *
 * @queryparam {string} document_id - Document ID (required)
 * @queryparam {string} id - Recipient ID (required)
 *
 * @returns Recipient details with signing URL
 */
http.route({
	path: "/api/v1/recipients/get",
	method: "GET",
	handler: apiHttpAction(
		async ({ ctx, auth, query }) => {
			if (!query.document_id) {
				throw new ApiError(400, "document_id is required", "VALIDATION_ERROR");
			}
			if (!query.id) {
				throw new ApiError(400, "Recipient ID is required", "VALIDATION_ERROR");
			}

			const recipient = await ctx.runQuery(
				internal.api.v1.recipients.getRecipient,
				{
					userId: auth.userId,
					organizationId: auth.organizationId,
					documentId: query.document_id as Id<"documents">,
					recipientId: query.id as Id<"document_recipients">,
				},
			);

			if (!recipient) {
				throw new ApiError(404, "Recipient not found", "RECIPIENT_NOT_FOUND");
			}

			return apiResponse(200, recipient);
		},
		{ scope: API_SCOPES.RECIPIENTS_READ },
	),
});

/**
 * Update Recipient
 *
 * @route PUT /api/v1/recipients/update
 * @scope seal:recipients:write
 *
 * @queryparam {string} document_id - Document ID (required)
 * @queryparam {string} id - Recipient ID (required)
 * @bodyparam {string} [name] - New name
 * @bodyparam {string} [role] - New role
 * @bodyparam {number} [order] - New signing order
 * @bodyparam {string} [message] - New custom message
 *
 * @returns Updated recipient
 */
http.route({
	path: "/api/v1/recipients/update",
	method: "PUT",
	handler: apiHttpAction(
		async ({ ctx, auth, query, request }) => {
			if (!query.document_id) {
				throw new ApiError(400, "document_id is required", "VALIDATION_ERROR");
			}
			if (!query.id) {
				throw new ApiError(400, "Recipient ID is required", "VALIDATION_ERROR");
			}

			const body = await parseJsonBody<{
				name?: string;
				role?: "signer" | "approver" | "viewer";
				order?: number;
				message?: string;
			}>(request);

			// Validate role if provided
			if (body.role && !["signer", "approver", "viewer"].includes(body.role)) {
				throw new ApiError(
					400,
					"role must be one of: signer, approver, viewer",
					"VALIDATION_ERROR",
				);
			}

			const result = await ctx.runMutation(
				internal.api.v1.recipients.updateRecipient,
				{
					userId: auth.userId,
					organizationId: auth.organizationId,
					documentId: query.document_id as Id<"documents">,
					recipientId: query.id as Id<"document_recipients">,
					name: body.name,
					role: body.role,
					order: body.order,
					customMessage: body.message,
				},
			);

			if (!result.success) {
				if (result.error?.includes("Cannot update")) {
					throw new ApiError(400, result.error, "RESOURCE_CONFLICT");
				}
				if (result.error?.includes("not found")) {
					throw new ApiError(404, result.error, "RECIPIENT_NOT_FOUND");
				}
				throw new ApiError(
					400,
					result.error ?? "Update failed",
					"VALIDATION_ERROR",
				);
			}

			// Fetch the updated recipient
			const recipient = await ctx.runQuery(
				internal.api.v1.recipients.getRecipient,
				{
					userId: auth.userId,
					organizationId: auth.organizationId,
					documentId: query.document_id as Id<"documents">,
					recipientId: query.id as Id<"document_recipients">,
				},
			);

			return apiResponse(200, recipient);
		},
		{ scope: API_SCOPES.RECIPIENTS_WRITE },
	),
});

/**
 * Remove Recipient
 *
 * @route DELETE /api/v1/recipients/delete
 * @scope seal:recipients:write
 *
 * @queryparam {string} document_id - Document ID (required)
 * @queryparam {string} id - Recipient ID (required)
 *
 * @returns Success confirmation
 */
http.route({
	path: "/api/v1/recipients/delete",
	method: "DELETE",
	handler: apiHttpAction(
		async ({ ctx, auth, query }) => {
			if (!query.document_id) {
				throw new ApiError(400, "document_id is required", "VALIDATION_ERROR");
			}
			if (!query.id) {
				throw new ApiError(400, "Recipient ID is required", "VALIDATION_ERROR");
			}

			const result = await ctx.runMutation(
				internal.api.v1.recipients.removeRecipient,
				{
					userId: auth.userId,
					organizationId: auth.organizationId,
					documentId: query.document_id as Id<"documents">,
					recipientId: query.id as Id<"document_recipients">,
				},
			);

			if (!result.success) {
				if (result.error?.includes("Cannot remove")) {
					throw new ApiError(400, result.error, "RESOURCE_CONFLICT");
				}
				if (result.error?.includes("not found")) {
					throw new ApiError(404, result.error, "RECIPIENT_NOT_FOUND");
				}
				throw new ApiError(
					400,
					result.error ?? "Delete failed",
					"VALIDATION_ERROR",
				);
			}

			return apiResponse(200, { deleted: true });
		},
		{ scope: API_SCOPES.RECIPIENTS_WRITE },
	),
});

/**
 * Send Reminder to Recipient
 *
 * @route POST /api/v1/recipients/remind
 * @scope seal:recipients:write
 *
 * @queryparam {string} document_id - Document ID (required)
 * @queryparam {string} id - Recipient ID (required)
 * @bodyparam {string} [message] - Custom reminder message
 *
 * @returns Success confirmation
 */
http.route({
	path: "/api/v1/recipients/remind",
	method: "POST",
	handler: apiHttpAction(
		async ({ ctx, auth, query, request }) => {
			if (!query.document_id) {
				throw new ApiError(400, "document_id is required", "VALIDATION_ERROR");
			}
			if (!query.id) {
				throw new ApiError(400, "Recipient ID is required", "VALIDATION_ERROR");
			}

			const body = await parseJsonBody<{ message?: string }>(request);

			const result = await ctx.runMutation(
				internal.api.v1.recipients.sendReminder,
				{
					userId: auth.userId,
					organizationId: auth.organizationId,
					documentId: query.document_id as Id<"documents">,
					recipientId: query.id as Id<"document_recipients">,
					message: body.message,
				},
			);

			if (!result.success) {
				if (result.error?.includes("Cannot send")) {
					throw new ApiError(400, result.error, "RESOURCE_CONFLICT");
				}
				if (result.error?.includes("not found")) {
					throw new ApiError(404, result.error, "RECIPIENT_NOT_FOUND");
				}
				if (result.error?.includes("Can only")) {
					throw new ApiError(400, result.error, "RESOURCE_CONFLICT");
				}
				throw new ApiError(
					400,
					result.error ?? "Reminder failed",
					"VALIDATION_ERROR",
				);
			}

			return apiResponse(200, { reminder_sent: true });
		},
		{ scope: API_SCOPES.RECIPIENTS_WRITE },
	),
});

// =============================================================================
// TEMPLATES API
// =============================================================================

/**
 * List Templates
 *
 * @route GET /api/v1/templates
 * @scope seal:templates:read
 *
 * @queryparam {number} [limit=20] - Maximum results (1-100)
 * @queryparam {string} [cursor] - Pagination cursor
 * @queryparam {string} [status] - Filter by status (active, archived)
 *
 * @returns Paginated list of templates
 */
http.route({
	path: "/api/v1/templates",
	method: "GET",
	handler: apiHttpAction(
		async ({ ctx, auth, query }) => {
			const { limit, cursor } = parsePagination(query);

			const result = await ctx.runQuery(
				internal.api.v1.templates.listTemplates,
				{
					userId: auth.userId,
					organizationId: auth.organizationId,
					limit,
					cursor,
					status: query.status,
				},
			);

			return paginatedResponse(
				result.templates,
				result.hasMore,
				result.nextCursor,
			);
		},
		{ scope: API_SCOPES.TEMPLATES_READ },
	),
});

/**
 * Create Template from Document
 *
 * @route POST /api/v1/templates
 * @scope seal:templates:write
 *
 * @bodyparam {string} document_id - Source document ID (required)
 * @bodyparam {string} name - Template name (required)
 * @bodyparam {string} [description] - Template description
 *
 * @returns Created template
 */
http.route({
	path: "/api/v1/templates",
	method: "POST",
	handler: apiHttpAction(
		async ({ ctx, auth, request }) => {
			const body = await parseJsonBody<{
				document_id?: string;
				name?: string;
				description?: string;
			}>(request);

			validateRequiredFields(body, ["document_id", "name"]);

			const result = await ctx.runMutation(
				internal.api.v1.templates.createFromDocument,
				{
					userId: auth.userId,
					organizationId: auth.organizationId,
					documentId: body.document_id as Id<"documents">,
					name: body.name as string,
					description: body.description,
				},
			);

			if (!result.success) {
				if (result.error?.includes("not found")) {
					throw new ApiError(404, result.error, "DOCUMENT_NOT_FOUND");
				}
				throw new ApiError(
					400,
					result.error ?? "Failed to create template",
					"VALIDATION_ERROR",
				);
			}

			// Fetch the created template
			const template = await ctx.runQuery(
				internal.api.v1.templates.getTemplate,
				{
					userId: auth.userId,
					organizationId: auth.organizationId,
					templateId: result.templateId as Id<"templates">,
					includeFields: true,
				},
			);

			return apiResponse(201, template, {
				Location: `/api/v1/templates?id=${result.templateId}`,
			});
		},
		{ scope: API_SCOPES.TEMPLATES_WRITE },
	),
});

/**
 * Get Template by ID
 *
 * @route GET /api/v1/templates/get
 * @scope seal:templates:read
 *
 * @queryparam {string} id - Template ID (required)
 * @queryparam {boolean} [include_fields=false] - Include field definitions
 *
 * @returns Template details
 */
http.route({
	path: "/api/v1/templates/get",
	method: "GET",
	handler: apiHttpAction(
		async ({ ctx, auth, query }) => {
			if (!query.id) {
				throw new ApiError(400, "Template ID is required", "VALIDATION_ERROR");
			}

			const template = await ctx.runQuery(
				internal.api.v1.templates.getTemplate,
				{
					userId: auth.userId,
					organizationId: auth.organizationId,
					templateId: query.id as Id<"templates">,
					includeFields: query.include_fields === "true",
				},
			);

			if (!template) {
				throw new ApiError(404, "Template not found", "TEMPLATE_NOT_FOUND");
			}

			return apiResponse(200, template);
		},
		{ scope: API_SCOPES.TEMPLATES_READ },
	),
});

/**
 * Get Template Fields
 *
 * @route GET /api/v1/templates/fields
 * @scope seal:templates:read
 *
 * @queryparam {string} id - Template ID (required)
 *
 * @returns List of template fields
 */
http.route({
	path: "/api/v1/templates/fields",
	method: "GET",
	handler: apiHttpAction(
		async ({ ctx, auth, query }) => {
			if (!query.id) {
				throw new ApiError(400, "Template ID is required", "VALIDATION_ERROR");
			}

			const fields = await ctx.runQuery(
				internal.api.v1.templates.getTemplateFields,
				{
					userId: auth.userId,
					organizationId: auth.organizationId,
					templateId: query.id as Id<"templates">,
				},
			);

			if (fields === null) {
				throw new ApiError(404, "Template not found", "TEMPLATE_NOT_FOUND");
			}

			return apiResponse(200, { data: fields });
		},
		{ scope: API_SCOPES.TEMPLATES_READ },
	),
});

/**
 * Update Template
 *
 * @route PUT /api/v1/templates/update
 * @scope seal:templates:write
 *
 * @queryparam {string} id - Template ID (required)
 * @bodyparam {string} [name] - New name
 * @bodyparam {string} [description] - New description
 * @bodyparam {string} [status] - New status (active, archived)
 *
 * @returns Updated template
 */
http.route({
	path: "/api/v1/templates/update",
	method: "PUT",
	handler: apiHttpAction(
		async ({ ctx, auth, query, request }) => {
			if (!query.id) {
				throw new ApiError(400, "Template ID is required", "VALIDATION_ERROR");
			}

			const body = await parseJsonBody<{
				name?: string;
				description?: string;
				status?: "active" | "archived";
			}>(request);

			// Validate status if provided
			if (body.status && !["active", "archived"].includes(body.status)) {
				throw new ApiError(
					400,
					"status must be one of: active, archived",
					"VALIDATION_ERROR",
				);
			}

			const result = await ctx.runMutation(
				internal.api.v1.templates.updateTemplate,
				{
					userId: auth.userId,
					organizationId: auth.organizationId,
					templateId: query.id as Id<"templates">,
					name: body.name,
					description: body.description,
					status: body.status,
				},
			);

			if (!result.success) {
				if (result.error?.includes("not found")) {
					throw new ApiError(404, result.error, "TEMPLATE_NOT_FOUND");
				}
				throw new ApiError(
					400,
					result.error ?? "Update failed",
					"VALIDATION_ERROR",
				);
			}

			// Fetch the updated template
			const template = await ctx.runQuery(
				internal.api.v1.templates.getTemplate,
				{
					userId: auth.userId,
					organizationId: auth.organizationId,
					templateId: query.id as Id<"templates">,
					includeFields: false,
				},
			);

			return apiResponse(200, template);
		},
		{ scope: API_SCOPES.TEMPLATES_WRITE },
	),
});

/**
 * Delete Template
 *
 * @route DELETE /api/v1/templates/delete
 * @scope seal:templates:write
 *
 * @queryparam {string} id - Template ID (required)
 *
 * @returns Success confirmation
 */
http.route({
	path: "/api/v1/templates/delete",
	method: "DELETE",
	handler: apiHttpAction(
		async ({ ctx, auth, query }) => {
			if (!query.id) {
				throw new ApiError(400, "Template ID is required", "VALIDATION_ERROR");
			}

			const result = await ctx.runMutation(
				internal.api.v1.templates.deleteTemplate,
				{
					userId: auth.userId,
					organizationId: auth.organizationId,
					templateId: query.id as Id<"templates">,
				},
			);

			if (!result.success) {
				if (result.error?.includes("not found")) {
					throw new ApiError(404, result.error, "TEMPLATE_NOT_FOUND");
				}
				throw new ApiError(
					400,
					result.error ?? "Delete failed",
					"VALIDATION_ERROR",
				);
			}

			return apiResponse(200, { deleted: true });
		},
		{ scope: API_SCOPES.TEMPLATES_WRITE },
	),
});

/**
 * Create Document from Template
 *
 * @route POST /api/v1/templates/use
 * @scope seal:templates:read, seal:documents:write
 *
 * @queryparam {string} id - Template ID (required)
 * @bodyparam {string} [title] - Document title (defaults to template name)
 * @bodyparam {string} [description] - Document description
 *
 * @returns Created document with template fields for field assignment
 */
http.route({
	path: "/api/v1/templates/use",
	method: "POST",
	handler: apiHttpAction(
		async ({ ctx, auth, query, request }) => {
			if (!query.id) {
				throw new ApiError(400, "Template ID is required", "VALIDATION_ERROR");
			}

			const body = await parseJsonBody<{
				title?: string;
				description?: string;
			}>(request);

			const result = await ctx.runMutation(
				internal.api.v1.templates.useTemplate,
				{
					userId: auth.userId,
					organizationId: auth.organizationId,
					templateId: query.id as Id<"templates">,
					documentName: body.title,
					description: body.description,
				},
			);

			if (!result.success) {
				if (result.error?.includes("not found")) {
					throw new ApiError(404, result.error, "TEMPLATE_NOT_FOUND");
				}
				if (result.error?.includes("archived")) {
					throw new ApiError(400, result.error, "RESOURCE_CONFLICT");
				}
				throw new ApiError(
					400,
					result.error ?? "Failed to use template",
					"VALIDATION_ERROR",
				);
			}

			// Fetch the created document
			const document = await ctx.runQuery(
				internal.api.v1.documents.getDocument,
				{
					userId: auth.userId,
					organizationId: auth.organizationId,
					documentId: result.documentId as Id<"documents">,
					includeRecipients: false,
				},
			);

			return apiResponse(
				201,
				{
					...document,
					template_fields: result.templateFields,
				},
				{
					Location: `/api/v1/documents?id=${result.documentId}`,
				},
			);
		},
		{ scope: API_SCOPES.TEMPLATES_READ }, // Also requires documents:write but uses template context
	),
});

// =============================================================================
// SIGNATURES API
// =============================================================================

/**
 * List Signatures for Document
 *
 * @route GET /api/v1/signatures
 * @scope seal:signatures:read
 *
 * @queryparam {string} document_id - Document ID (required)
 *
 * @returns List of signatures for the document
 */
http.route({
	path: "/api/v1/signatures",
	method: "GET",
	handler: apiHttpAction(
		async ({ ctx, auth, query }) => {
			if (!query.document_id) {
				throw new ApiError(400, "document_id is required", "VALIDATION_ERROR");
			}

			const signatures = await ctx.runQuery(
				internal.api.v1.signatures.listSignatures,
				{
					userId: auth.userId,
					organizationId: auth.organizationId,
					documentId: query.document_id as Id<"documents">,
				},
			);

			if (signatures === null) {
				throw new ApiError(404, "Document not found", "DOCUMENT_NOT_FOUND");
			}

			return apiResponse(200, { data: signatures });
		},
		{ scope: API_SCOPES.SIGNATURES_READ },
	),
});

/**
 * Get Signature Details
 *
 * @route GET /api/v1/signatures/get
 * @scope seal:signatures:read
 *
 * @queryparam {string} document_id - Document ID (required)
 * @queryparam {string} id - Signature ID (required)
 *
 * @returns Signature details
 */
http.route({
	path: "/api/v1/signatures/get",
	method: "GET",
	handler: apiHttpAction(
		async ({ ctx, auth, query }) => {
			if (!query.document_id) {
				throw new ApiError(400, "document_id is required", "VALIDATION_ERROR");
			}
			if (!query.id) {
				throw new ApiError(400, "Signature ID is required", "VALIDATION_ERROR");
			}

			const signature = await ctx.runQuery(
				internal.api.v1.signatures.getSignature,
				{
					userId: auth.userId,
					organizationId: auth.organizationId,
					documentId: query.document_id as Id<"documents">,
					signatureId: query.id as Id<"signatures">,
				},
			);

			if (!signature) {
				throw new ApiError(404, "Signature not found", "SIGNATURE_NOT_FOUND");
			}

			return apiResponse(200, signature);
		},
		{ scope: API_SCOPES.SIGNATURES_READ },
	),
});

/**
 * Verify Document Integrity and Signatures
 *
 * @route GET /api/v1/signatures/verify
 * @scope seal:signatures:read
 *
 * @queryparam {string} document_id - Document ID (required)
 *
 * @returns Comprehensive verification report
 */
http.route({
	path: "/api/v1/signatures/verify",
	method: "GET",
	handler: apiHttpAction(
		async ({ ctx, auth, query }) => {
			if (!query.document_id) {
				throw new ApiError(400, "document_id is required", "VALIDATION_ERROR");
			}

			const result = await ctx.runQuery(
				internal.api.v1.signatures.verifyDocument,
				{
					userId: auth.userId,
					organizationId: auth.organizationId,
					documentId: query.document_id as Id<"documents">,
				},
			);

			if (!result) {
				throw new ApiError(404, "Document not found", "DOCUMENT_NOT_FOUND");
			}

			return apiResponse(200, result);
		},
		{ scope: API_SCOPES.SIGNATURES_READ },
	),
});

/**
 * Get Audit Trail for Document
 *
 * @route GET /api/v1/signatures/audit
 * @scope seal:signatures:read
 *
 * @queryparam {string} document_id - Document ID (required)
 * @queryparam {number} [limit=100] - Maximum events to return (max 500)
 *
 * @returns Document audit trail events
 */
http.route({
	path: "/api/v1/signatures/audit",
	method: "GET",
	handler: apiHttpAction(
		async ({ ctx, auth, query }) => {
			if (!query.document_id) {
				throw new ApiError(400, "document_id is required", "VALIDATION_ERROR");
			}

			const limit = query.limit ? Number.parseInt(query.limit, 10) : 100;

			const result = await ctx.runQuery(
				internal.api.v1.signatures.getAuditTrail,
				{
					userId: auth.userId,
					organizationId: auth.organizationId,
					documentId: query.document_id as Id<"documents">,
					limit,
				},
			);

			if (!result) {
				throw new ApiError(404, "Document not found", "DOCUMENT_NOT_FOUND");
			}

			return apiResponse(200, result);
		},
		{ scope: API_SCOPES.SIGNATURES_READ },
	),
});

export default http;
