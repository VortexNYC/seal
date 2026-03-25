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

import { type GenericActionCtx, httpRouter } from "convex/server";
import Stripe from "stripe";
import { Webhook } from "svix";

import { api, internal } from "./_generated/api";
import type { DataModel, Id } from "./_generated/dataModel";
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
import { resendComponent } from "./emails/resend_component";
import {
  createAuthorizationCode as mcpCreateAuthorizationCode,
  createRefreshToken as mcpCreateRefreshToken,
  deleteAuthorizationCode as mcpDeleteAuthorizationCode,
  deleteRefreshToken as mcpDeleteRefreshToken,
  getAuthorizationCode as mcpGetAuthorizationCode,
  getClient as mcpGetClient,
  getRefreshToken as mcpGetRefreshToken,
  registerClient as mcpRegisterClient,
  updateRefreshToken as mcpUpdateRefreshToken,
  validateRedirectUri as mcpValidateRedirectUri,
} from "./mcp_oauth/http";
import { processStripeConnectWebhookEvent } from "./stripe/connect_webhook_handlers";
import { processStripeWebhookEvent } from "./stripe/webhook_handlers";

/**
 * Extract client IP address from request headers
 * Checks standard proxy headers used by Vercel, Cloudflare, and other CDNs
 */
function extractClientIp(request: Request): string {
  // Vercel / generic proxy
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    // x-forwarded-for can contain multiple IPs: "client, proxy1, proxy2"
    const firstIp = forwarded.split(",")[0]?.trim();
    if (firstIp) return firstIp;
  }

  // Cloudflare
  const cfIp = request.headers.get("cf-connecting-ip");
  if (cfIp) return cfIp;

  // Vercel-specific
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp;

  return "unknown";
}

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
    | "organizationInvitation.revoked"
    | "session.created"
    | "session.ended"
    | "session.removed"
    | "session.revoked";
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
    // For session events
    user_id?: string;
    client_id?: string;
    last_active_at?: number;
  };
}

type HttpActionCtx = GenericActionCtx<DataModel>;

type SvixHeaders = {
  "svix-id": string;
  "svix-signature": string;
  "svix-timestamp": string;
};

type ClerkSessionAction = "user.login" | "user.logout";

type ClerkEventHandler = (ctx: HttpActionCtx, data: ClerkWebhookEvent["data"]) => Promise<void>;

function getClerkWebhookSecret(): string | null {
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("CLERK_WEBHOOK_SECRET not configured");
    return null;
  }

  return webhookSecret;
}

function getSvixHeaders(request: Request): SvixHeaders | null {
  const svixId = request.headers.get("svix-id");
  const svixTimestamp = request.headers.get("svix-timestamp");
  const svixSignature = request.headers.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    console.error("Missing svix headers");
    return null;
  }

  return {
    "svix-id": svixId,
    "svix-signature": svixSignature,
    "svix-timestamp": svixTimestamp,
  };
}

async function verifyClerkWebhookEvent(
  request: Request,
  webhookSecret: string,
  headers: SvixHeaders,
): Promise<ClerkWebhookEvent | null> {
  const payload = await request.text();
  const webhook = new Webhook(webhookSecret);

  try {
    return webhook.verify(payload, headers) as ClerkWebhookEvent;
  } catch (err) {
    console.error("Webhook verification failed:", err);
    return null;
  }
}

function getClerkUserProfile(data: ClerkWebhookEvent["data"]) {
  const firstName = data.first_name || "";
  const lastName = data.last_name || "";
  const fullName = `${firstName} ${lastName}`.trim();
  const primaryEmail = data.email_addresses?.[0];

  return {
    avatar: data.image_url || undefined,
    email: primaryEmail?.email_address || "",
    isEmailVerified: primaryEmail?.verification?.status === "verified",
    name: fullName || undefined,
  };
}

async function handleClerkUserCreated(
  ctx: HttpActionCtx,
  data: ClerkWebhookEvent["data"],
): Promise<void> {
  const profile = getClerkUserProfile(data);
  const result = await ctx.runMutation(api.clerk_webhooks.syncUser, {
    clerkId: data.id,
    name: profile.name,
    email: profile.email,
    avatar: profile.avatar,
    isEmailVerified: profile.isEmailVerified,
  });
  console.info(`[Clerk Webhook] User synced: ${data.id}`);

  if (!result.isNewUser || !result.userId) {
    return;
  }

  try {
    await ctx.runAction(internal.stripe.subscription_actions.handleNewUserSignup, {
      userId: result.userId,
      email: profile.email,
      name: profile.name,
    });
    console.info(`[Clerk Webhook] Stripe customer created for user: ${data.id}`);
  } catch (err) {
    console.error(`[Clerk Webhook] Failed to setup Stripe for user ${data.id}:`, err);
  }
}

async function handleClerkUserUpdated(
  ctx: HttpActionCtx,
  data: ClerkWebhookEvent["data"],
): Promise<void> {
  const profile = getClerkUserProfile(data);
  await ctx.runMutation(api.clerk_webhooks.syncUser, {
    clerkId: data.id,
    name: profile.name,
    email: profile.email,
    avatar: profile.avatar,
    isEmailVerified: profile.isEmailVerified,
  });
  console.info(`[Clerk Webhook] User synced: ${data.id}`);
}

async function handleClerkUserDeleted(
  ctx: HttpActionCtx,
  data: ClerkWebhookEvent["data"],
): Promise<void> {
  await ctx.runMutation(api.clerk_webhooks.deleteUser, {
    clerkId: data.id,
  });
  console.info(`[Clerk Webhook] User deleted: ${data.id}`);
}

async function handleClerkOrganizationSynced(
  ctx: HttpActionCtx,
  data: ClerkWebhookEvent["data"],
): Promise<void> {
  await ctx.runMutation(api.clerk_webhooks.syncOrganization, {
    clerkId: data.id,
    name: data.name || "",
    slug: data.slug || undefined,
    logo: data.logo_url || undefined,
    metadata: data.public_metadata ? JSON.stringify(data.public_metadata) : undefined,
  });
  console.info(`[Clerk Webhook] Organization synced: ${data.id}`);
}

async function handleClerkOrganizationDeleted(
  ctx: HttpActionCtx,
  data: ClerkWebhookEvent["data"],
): Promise<void> {
  await ctx.runMutation(api.clerk_webhooks.deleteOrganization, {
    clerkId: data.id,
  });
  console.info(`[Clerk Webhook] Organization deleted: ${data.id}`);
}

async function handleClerkMembershipCreated(
  ctx: HttpActionCtx,
  data: ClerkWebhookEvent["data"],
): Promise<void> {
  if (!data.organization?.id || !data.public_user_data?.user_id) {
    return;
  }

  await ctx.runMutation(internal.clerk_webhooks.upsertMembershipFromClerk, {
    clerkUserId: data.public_user_data.user_id,
    clerkOrgId: data.organization.id,
    clerkMembershipId: data.id,
    role: data.role || "member",
  });
  console.info(
    `[Clerk Webhook] Membership created: ${data.public_user_data.user_id} -> ${data.organization.id} (${data.id})`,
  );
}

async function handleClerkMembershipUpdated(
  ctx: HttpActionCtx,
  data: ClerkWebhookEvent["data"],
): Promise<void> {
  if (!data.id) {
    return;
  }

  await ctx.runMutation(internal.clerk_webhooks.syncMembershipFromClerk, {
    clerkMembershipId: data.id,
  });
  console.info(`[Clerk Webhook] Membership updated: ${data.id}`);
}

async function handleClerkMembershipDeleted(
  ctx: HttpActionCtx,
  data: ClerkWebhookEvent["data"],
): Promise<void> {
  if (!data.id) {
    return;
  }

  await ctx.runMutation(internal.clerk_webhooks.deleteMembershipFromClerk, {
    clerkMembershipId: data.id,
  });
  console.info(`[Clerk Webhook] Membership deleted: ${data.id}`);
}

async function handleClerkInvitationCreated(
  ctx: HttpActionCtx,
  data: ClerkWebhookEvent["data"],
): Promise<void> {
  console.info(`[Clerk Webhook] Processing invitation.created`, {
    hasOrgId: !!data.organization_id,
    hasEmail: !!data.email_address,
    orgId: data.organization_id,
    email: data.email_address,
  });

  if (!data.organization_id || !data.email_address) {
    console.warn(`[Clerk Webhook] Missing required data for invitation.created`, {
      hasOrgId: !!data.organization_id,
      hasEmail: !!data.email_address,
    });
    return;
  }

  try {
    const result = await ctx.runMutation(internal.clerk_webhooks.handleInvitationCreated, {
      clerkInvitationId: data.id,
      clerkOrganizationId: data.organization_id,
      emailAddress: data.email_address,
      role: data.role,
      publicMetadata: data.public_metadata,
      createdAt: data.created_at,
    });
    console.info(
      `[Clerk Webhook] Invitation created successfully: ${data.email_address} -> ${data.organization_id}`,
      result,
    );
  } catch (error) {
    console.error(`[Clerk Webhook] Error handling invitation.created:`, error);
    throw error;
  }
}

async function handleClerkInvitationAccepted(
  ctx: HttpActionCtx,
  data: ClerkWebhookEvent["data"],
): Promise<void> {
  if (!data.organization_id) {
    return;
  }

  await ctx.runMutation(internal.clerk_webhooks.handleInvitationAccepted, {
    clerkInvitationId: data.id,
    clerkOrganizationId: data.organization_id,
    clerkUserId: data.public_user_data?.user_id,
  });
  console.info(`[Clerk Webhook] Invitation accepted: ${data.id}`);
}

async function handleClerkInvitationRevoked(
  ctx: HttpActionCtx,
  data: ClerkWebhookEvent["data"],
): Promise<void> {
  await ctx.runMutation(internal.clerk_webhooks.handleInvitationRevoked, {
    clerkInvitationId: data.id,
  });
  console.info(`[Clerk Webhook] Invitation revoked: ${data.id}`);
}

async function logClerkSessionEvent(
  ctx: HttpActionCtx,
  data: ClerkWebhookEvent["data"],
  action: ClerkSessionAction,
  logMessage: string,
): Promise<void> {
  if (!data.user_id) {
    return;
  }

  await ctx.runMutation(internal.clerk_webhooks.logSessionEvent, {
    clerkUserId: data.user_id,
    sessionId: data.id,
    action,
  });
  console.info(`${logMessage}: ${data.user_id}`);
}

const clerkWebhookHandlers: Partial<Record<ClerkWebhookEvent["type"], ClerkEventHandler>> = {
  "user.created": handleClerkUserCreated,
  "user.updated": handleClerkUserUpdated,
  "user.deleted": handleClerkUserDeleted,
  "organization.created": handleClerkOrganizationSynced,
  "organization.updated": handleClerkOrganizationSynced,
  "organization.deleted": handleClerkOrganizationDeleted,
  "organizationMembership.created": handleClerkMembershipCreated,
  "organizationMembership.updated": handleClerkMembershipUpdated,
  "organizationMembership.deleted": handleClerkMembershipDeleted,
  "organizationInvitation.created": handleClerkInvitationCreated,
  "organizationInvitation.accepted": handleClerkInvitationAccepted,
  "organizationInvitation.revoked": handleClerkInvitationRevoked,
  "session.created": (ctx, data) =>
    logClerkSessionEvent(ctx, data, "user.login", "[Clerk Webhook] Session logged"),
  "session.ended": (ctx, data) =>
    logClerkSessionEvent(ctx, data, "user.logout", "[Clerk Webhook] Session end logged"),
  "session.removed": (ctx, data) =>
    logClerkSessionEvent(ctx, data, "user.logout", "[Clerk Webhook] Session end logged"),
  "session.revoked": (ctx, data) =>
    logClerkSessionEvent(ctx, data, "user.logout", "[Clerk Webhook] Session end logged"),
};

async function handleClerkWebhookEvent(
  ctx: HttpActionCtx,
  event: ClerkWebhookEvent,
): Promise<void> {
  const handler = clerkWebhookHandlers[event.type];
  if (!handler) {
    console.info(`[Clerk Webhook] Unhandled event type: ${event.type}`);
    return;
  }

  await handler(ctx, event.data);
}

const http = httpRouter();

http.route({
  path: "/clerk-webhooks",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const webhookSecret = getClerkWebhookSecret();
    if (!webhookSecret) {
      return new Response("Webhook secret not configured", { status: 500 });
    }

    const headers = getSvixHeaders(request);
    if (!headers) {
      return new Response("Missing webhook headers", { status: 400 });
    }

    const evt = await verifyClerkWebhookEvent(request, webhookSecret, headers);
    if (!evt) {
      return new Response("Webhook verification failed", { status: 400 });
    }

    const { type, data } = evt;
    console.info(`[Clerk Webhook] Received: ${type}`, { id: data.id });

    try {
      await handleClerkWebhookEvent(ctx, evt);
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
        requiredConfig: !webhookSecret ? "STRIPE_WEBHOOK_SECRET" : "STRIPE_SECRET_KEY",
      });
      return new Response("Webhook configuration error", { status: 500 });
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2026-02-25.clover",
    });

    const signature = request.headers.get("stripe-signature");
    if (!signature) {
      return new Response("Missing stripe-signature header", { status: 400 });
    }

    const body = await request.text();

    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
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

http.route({
  path: "/stripe-connect-webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const webhookSecret = process.env.STRIPE_CONNECT_WEBHOOK_SECRET;
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

    if (!webhookSecret || !stripeSecretKey) {
      console.error("Stripe Connect webhook configuration missing", {
        operation: "stripeConnectWebhook.configCheck",
        requiredConfig: !webhookSecret ? "STRIPE_CONNECT_WEBHOOK_SECRET" : "STRIPE_SECRET_KEY",
      });
      return new Response("Webhook configuration error", { status: 500 });
    }

    const stripe = new Stripe(stripeSecretKey, {
      apiVersion: "2026-02-25.clover",
    });

    const signature = request.headers.get("stripe-signature");
    if (!signature) {
      return new Response("Missing stripe-signature header", { status: 400 });
    }

    const body = await request.text();

    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
    } catch (err) {
      console.error("Stripe Connect webhook signature verification failed", {
        operation: "stripeConnectWebhook.signatureVerification",
        hasSignature: !!signature,
        error: err instanceof Error ? err.message : String(err),
      });
      return new Response("Invalid signature", { status: 400 });
    }

    await processStripeConnectWebhookEvent(ctx, event);

    return new Response("Webhook processed", { status: 200 });
  }),
});

// =============================================================================
// MCP OAUTH ENDPOINTS (Internal - secured by MCP_INTERNAL_SECRET)
// =============================================================================

// Client operations
http.route({
  path: "/mcp-oauth/clients",
  method: "POST",
  handler: mcpRegisterClient,
});

http.route({
  path: "/mcp-oauth/clients",
  method: "GET",
  handler: mcpGetClient,
});

// Authorization code operations
http.route({
  path: "/mcp-oauth/codes",
  method: "POST",
  handler: mcpCreateAuthorizationCode,
});

http.route({
  path: "/mcp-oauth/codes",
  method: "GET",
  handler: mcpGetAuthorizationCode,
});

http.route({
  path: "/mcp-oauth/codes",
  method: "DELETE",
  handler: mcpDeleteAuthorizationCode,
});

// Refresh token operations
http.route({
  path: "/mcp-oauth/refresh-tokens",
  method: "POST",
  handler: mcpCreateRefreshToken,
});

http.route({
  path: "/mcp-oauth/refresh-tokens",
  method: "GET",
  handler: mcpGetRefreshToken,
});

http.route({
  path: "/mcp-oauth/refresh-tokens",
  method: "PUT",
  handler: mcpUpdateRefreshToken,
});

http.route({
  path: "/mcp-oauth/refresh-tokens",
  method: "DELETE",
  handler: mcpDeleteRefreshToken,
});

// Validation operations
http.route({
  path: "/mcp-oauth/validate-redirect",
  method: "GET",
  handler: mcpValidateRedirectUri,
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
 * Client IP endpoint - Returns the caller's IP address
 * Used by the signing page to capture IP for audit trail compliance
 *
 * @route GET /api/v1/ip
 * @public
 */
http.route({
  path: "/api/v1/ip",
  method: "GET",
  handler: httpAction(async (_ctx, request) => {
    const ip = extractClientIp(request);
    return new Response(JSON.stringify({ ip }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": process.env.CLIENT_ORIGIN ?? "*",
        "Cache-Control": "no-store",
      },
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
// ACCOUNT API
// =============================================================================

/**
 * Get Account Info
 *
 * @route GET /api/v1/account
 * @scope Authenticated (any valid API key)
 *
 * @returns Organization details, member counts, document counts, and settings
 */
http.route({
  path: "/api/v1/account",
  method: "GET",
  handler: apiHttpAction(async ({ ctx, auth }) => {
    const info = await ctx.runQuery(internal.api.v1.account.getAccountInfo, {
      userId: auth.userId,
      organizationId: auth.organizationId,
    });
    return apiResponse(200, info);
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
 * @queryparam {string} [title_search] - Case-insensitive substring match on document title
 * @queryparam {string} [created_after] - ISO 8601 timestamp — return documents created after this date
 * @queryparam {string} [created_before] - ISO 8601 timestamp — return documents created before this date
 *
 * @returns Paginated list of documents
 */
http.route({
  path: "/api/v1/documents",
  method: "GET",
  handler: apiHttpAction(
    async ({ ctx, auth, query }) => {
      const { limit, cursor } = parsePagination(query);

      const result = await ctx.runQuery(internal.api.v1.documents.listDocuments, {
        userId: auth.userId,
        organizationId: auth.organizationId,
        limit,
        cursor,
        status: query.status,
        title_search: query.title_search,
        created_after: query.created_after,
        created_before: query.created_before,
      });

      return paginatedResponse(result.documents, result.hasMore, result.nextCursor);
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

      const deadline = body.deadline ? new Date(body.deadline).getTime() : undefined;

      const documentId = await ctx.runMutation(internal.api.v1.documents.createDocument, {
        userId: auth.userId,
        organizationId: auth.organizationId,
        title: body.title as string,
        description: body.description,
        storageId: body.storage_id as string,
        fileSize: body.file_size as number,
        fileType: body.file_type ?? "application/pdf",
        pageCount: body.page_count,
        deadline,
      });

      // Fetch the created document
      const document = await ctx.runQuery(internal.api.v1.documents.getDocument, {
        userId: auth.userId,
        organizationId: auth.organizationId,
        documentId: documentId as Id<"documents">,
        includeRecipients: false,
      });

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

      const document = await ctx.runQuery(internal.api.v1.documents.getDocument, {
        userId: auth.userId,
        organizationId: auth.organizationId,
        documentId: query.id as Id<"documents">,
        includeRecipients: query.include_recipients === "true",
      });

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

      const deadline = body.deadline ? new Date(body.deadline).getTime() : undefined;

      const result = await ctx.runMutation(internal.api.v1.documents.updateDocument, {
        userId: auth.userId,
        organizationId: auth.organizationId,
        documentId: query.id as Id<"documents">,
        title: body.title,
        description: body.description,
        deadline,
      });

      if (!result.success) {
        throw new ApiError(404, result.error ?? "Document not found", "DOCUMENT_NOT_FOUND");
      }

      // Fetch the updated document
      const document = await ctx.runQuery(internal.api.v1.documents.getDocument, {
        userId: auth.userId,
        organizationId: auth.organizationId,
        documentId: query.id as Id<"documents">,
        includeRecipients: false,
      });

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

      const result = await ctx.runMutation(internal.api.v1.documents.deleteDocument, {
        userId: auth.userId,
        organizationId: auth.organizationId,
        documentId: query.id as Id<"documents">,
      });

      if (!result.success) {
        if (result.error?.includes("Only draft")) {
          throw new ApiError(400, result.error, "RESOURCE_CONFLICT");
        }
        throw new ApiError(404, result.error ?? "Document not found", "DOCUMENT_NOT_FOUND");
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

      const result = await ctx.runMutation(internal.api.v1.documents.sendDocument, {
        userId: auth.userId,
        organizationId: auth.organizationId,
        documentId: query.id as Id<"documents">,
        message: body.message,
      });

      if (!result.success) {
        if (result.error?.includes("at least one recipient")) {
          throw new ApiError(400, result.error, "VALIDATION_ERROR");
        }
        if (result.error?.includes("Cannot send")) {
          throw new ApiError(409, result.error, "DOCUMENT_ALREADY_SENT");
        }
        throw new ApiError(404, result.error ?? "Document not found", "DOCUMENT_NOT_FOUND");
      }

      // Fetch the updated document
      const document = await ctx.runQuery(internal.api.v1.documents.getDocument, {
        userId: auth.userId,
        organizationId: auth.organizationId,
        documentId: query.id as Id<"documents">,
        includeRecipients: true,
      });

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

      const result = await ctx.runMutation(internal.api.v1.documents.voidDocument, {
        userId: auth.userId,
        organizationId: auth.organizationId,
        documentId: query.id as Id<"documents">,
        reason: body.reason as string,
      });

      if (!result.success) {
        if (result.error?.includes("Cannot void")) {
          throw new ApiError(409, result.error, "DOCUMENT_ALREADY_COMPLETED");
        }
        if (result.error?.includes("already cancelled")) {
          throw new ApiError(409, result.error, "RESOURCE_CONFLICT");
        }
        throw new ApiError(404, result.error ?? "Document not found", "DOCUMENT_NOT_FOUND");
      }

      // Fetch the updated document
      const document = await ctx.runQuery(internal.api.v1.documents.getDocument, {
        userId: auth.userId,
        organizationId: auth.organizationId,
        documentId: query.id as Id<"documents">,
        includeRecipients: false,
      });

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

      const result = await ctx.runQuery(internal.api.v1.documents.getDocumentDownloadUrl, {
        userId: auth.userId,
        organizationId: auth.organizationId,
        documentId: query.id as Id<"documents">,
      });

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

      const recipients = await ctx.runQuery(internal.api.v1.recipients.listRecipients, {
        userId: auth.userId,
        organizationId: auth.organizationId,
        documentId: query.document_id as Id<"documents">,
      });

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

      const result = await ctx.runMutation(internal.api.v1.recipients.addRecipient, {
        userId: auth.userId,
        organizationId: auth.organizationId,
        documentId: query.document_id as Id<"documents">,
        email: body.email as string,
        name: body.name as string,
        role: body.role as "signer" | "approver" | "viewer",
        order: body.order,
        customMessage: body.message,
      });

      if (!result.success) {
        if (result.error?.includes("already exists")) {
          throw new ApiError(409, result.error, "RESOURCE_CONFLICT");
        }
        if (result.error?.includes("Cannot add")) {
          throw new ApiError(400, result.error, "RESOURCE_CONFLICT");
        }
        throw new ApiError(404, result.error ?? "Document not found", "DOCUMENT_NOT_FOUND");
      }

      // Fetch the created recipient
      const recipient = await ctx.runQuery(internal.api.v1.recipients.getRecipient, {
        userId: auth.userId,
        organizationId: auth.organizationId,
        documentId: query.document_id as Id<"documents">,
        recipientId: result.recipientId as Id<"document_recipients">,
      });

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

      const recipient = await ctx.runQuery(internal.api.v1.recipients.getRecipient, {
        userId: auth.userId,
        organizationId: auth.organizationId,
        documentId: query.document_id as Id<"documents">,
        recipientId: query.id as Id<"document_recipients">,
      });

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

      const result = await ctx.runMutation(internal.api.v1.recipients.updateRecipient, {
        userId: auth.userId,
        organizationId: auth.organizationId,
        documentId: query.document_id as Id<"documents">,
        recipientId: query.id as Id<"document_recipients">,
        name: body.name,
        role: body.role,
        order: body.order,
        customMessage: body.message,
      });

      if (!result.success) {
        if (result.error?.includes("Cannot update")) {
          throw new ApiError(400, result.error, "RESOURCE_CONFLICT");
        }
        if (result.error?.includes("not found")) {
          throw new ApiError(404, result.error, "RECIPIENT_NOT_FOUND");
        }
        throw new ApiError(400, result.error ?? "Update failed", "VALIDATION_ERROR");
      }

      // Fetch the updated recipient
      const recipient = await ctx.runQuery(internal.api.v1.recipients.getRecipient, {
        userId: auth.userId,
        organizationId: auth.organizationId,
        documentId: query.document_id as Id<"documents">,
        recipientId: query.id as Id<"document_recipients">,
      });

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

      const result = await ctx.runMutation(internal.api.v1.recipients.removeRecipient, {
        userId: auth.userId,
        organizationId: auth.organizationId,
        documentId: query.document_id as Id<"documents">,
        recipientId: query.id as Id<"document_recipients">,
      });

      if (!result.success) {
        if (result.error?.includes("Cannot remove")) {
          throw new ApiError(400, result.error, "RESOURCE_CONFLICT");
        }
        if (result.error?.includes("not found")) {
          throw new ApiError(404, result.error, "RECIPIENT_NOT_FOUND");
        }
        throw new ApiError(400, result.error ?? "Delete failed", "VALIDATION_ERROR");
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

      const result = await ctx.runMutation(internal.api.v1.recipients.sendReminder, {
        userId: auth.userId,
        organizationId: auth.organizationId,
        documentId: query.document_id as Id<"documents">,
        recipientId: query.id as Id<"document_recipients">,
        message: body.message,
      });

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
        throw new ApiError(400, result.error ?? "Reminder failed", "VALIDATION_ERROR");
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

      const result = await ctx.runQuery(internal.api.v1.templates.listTemplates, {
        userId: auth.userId,
        organizationId: auth.organizationId,
        limit,
        cursor,
        status: query.status,
      });

      return paginatedResponse(result.templates, result.hasMore, result.nextCursor);
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

      const result = await ctx.runMutation(internal.api.v1.templates.createFromDocument, {
        userId: auth.userId,
        organizationId: auth.organizationId,
        documentId: body.document_id as Id<"documents">,
        name: body.name as string,
        description: body.description,
      });

      if (!result.success) {
        if (result.error?.includes("not found")) {
          throw new ApiError(404, result.error, "DOCUMENT_NOT_FOUND");
        }
        throw new ApiError(400, result.error ?? "Failed to create template", "VALIDATION_ERROR");
      }

      // Fetch the created template
      const template = await ctx.runQuery(internal.api.v1.templates.getTemplate, {
        userId: auth.userId,
        organizationId: auth.organizationId,
        templateId: result.templateId as Id<"templates">,
        includeFields: true,
      });

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

      const template = await ctx.runQuery(internal.api.v1.templates.getTemplate, {
        userId: auth.userId,
        organizationId: auth.organizationId,
        templateId: query.id as Id<"templates">,
        includeFields: query.include_fields === "true",
      });

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

      const fields = await ctx.runQuery(internal.api.v1.templates.getTemplateFields, {
        userId: auth.userId,
        organizationId: auth.organizationId,
        templateId: query.id as Id<"templates">,
      });

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
        throw new ApiError(400, "status must be one of: active, archived", "VALIDATION_ERROR");
      }

      const result = await ctx.runMutation(internal.api.v1.templates.updateTemplate, {
        userId: auth.userId,
        organizationId: auth.organizationId,
        templateId: query.id as Id<"templates">,
        name: body.name,
        description: body.description,
        status: body.status,
      });

      if (!result.success) {
        if (result.error?.includes("not found")) {
          throw new ApiError(404, result.error, "TEMPLATE_NOT_FOUND");
        }
        throw new ApiError(400, result.error ?? "Update failed", "VALIDATION_ERROR");
      }

      // Fetch the updated template
      const template = await ctx.runQuery(internal.api.v1.templates.getTemplate, {
        userId: auth.userId,
        organizationId: auth.organizationId,
        templateId: query.id as Id<"templates">,
        includeFields: false,
      });

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

      const result = await ctx.runMutation(internal.api.v1.templates.deleteTemplate, {
        userId: auth.userId,
        organizationId: auth.organizationId,
        templateId: query.id as Id<"templates">,
      });

      if (!result.success) {
        if (result.error?.includes("not found")) {
          throw new ApiError(404, result.error, "TEMPLATE_NOT_FOUND");
        }
        throw new ApiError(400, result.error ?? "Delete failed", "VALIDATION_ERROR");
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

      const result = await ctx.runMutation(internal.api.v1.templates.useTemplate, {
        userId: auth.userId,
        organizationId: auth.organizationId,
        templateId: query.id as Id<"templates">,
        documentName: body.title,
        description: body.description,
      });

      if (!result.success) {
        if (result.error?.includes("not found")) {
          throw new ApiError(404, result.error, "TEMPLATE_NOT_FOUND");
        }
        if (result.error?.includes("archived")) {
          throw new ApiError(400, result.error, "RESOURCE_CONFLICT");
        }
        throw new ApiError(400, result.error ?? "Failed to use template", "VALIDATION_ERROR");
      }

      // Fetch the created document
      const document = await ctx.runQuery(internal.api.v1.documents.getDocument, {
        userId: auth.userId,
        organizationId: auth.organizationId,
        documentId: result.documentId as Id<"documents">,
        includeRecipients: false,
      });

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

      const signatures = await ctx.runQuery(internal.api.v1.signatures.listSignatures, {
        userId: auth.userId,
        organizationId: auth.organizationId,
        documentId: query.document_id as Id<"documents">,
      });

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

      const signature = await ctx.runQuery(internal.api.v1.signatures.getSignature, {
        userId: auth.userId,
        organizationId: auth.organizationId,
        documentId: query.document_id as Id<"documents">,
        signatureId: query.id as Id<"signatures">,
      });

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

      const result = await ctx.runQuery(internal.api.v1.signatures.verifyDocument, {
        userId: auth.userId,
        organizationId: auth.organizationId,
        documentId: query.document_id as Id<"documents">,
      });

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

      const result = await ctx.runQuery(internal.api.v1.signatures.getAuditTrail, {
        userId: auth.userId,
        organizationId: auth.organizationId,
        documentId: query.document_id as Id<"documents">,
        limit,
      });

      if (!result) {
        throw new ApiError(404, "Document not found", "DOCUMENT_NOT_FOUND");
      }

      return apiResponse(200, result);
    },
    { scope: API_SCOPES.SIGNATURES_READ },
  ),
});

// =============================================================================
// UPLOADS API
// =============================================================================

/**
 * Generate Upload URL
 *
 * @route POST /api/v1/uploads/generate-url
 * @scope seal:documents:write
 *
 * Generates a temporary URL for uploading a file to Convex storage.
 * The returned URL can be used to POST a file directly.
 *
 * @returns Temporary upload URL
 *
 * @example Response
 * ```json
 * {
 *   "upload_url": "https://..."
 * }
 * ```
 */
http.route({
  path: "/api/v1/uploads/generate-url",
  method: "POST",
  handler: apiHttpAction(
    async ({ ctx }) => {
      const uploadUrl = await ctx.runMutation(internal.api.v1.uploads.generateUploadUrl, {});
      return apiResponse(200, { upload_url: uploadUrl });
    },
    { scope: API_SCOPES.DOCUMENTS_WRITE },
  ),
});

// =============================================================================
// WEBHOOKS API
// =============================================================================

/**
 * List Webhook Endpoints
 *
 * @route GET /api/v1/webhooks
 * @scope seal:webhooks:manage
 *
 * @returns List of webhook endpoints for the organization
 */
http.route({
  path: "/api/v1/webhooks",
  method: "GET",
  handler: apiHttpAction(
    async ({ ctx, auth }) => {
      const endpoints = await ctx.runQuery(internal.api.v1.webhooks.listEndpoints, {
        userId: auth.userId,
        organizationId: auth.organizationId,
      });

      return apiResponse(200, { data: endpoints });
    },
    { scope: API_SCOPES.WEBHOOKS_MANAGE },
  ),
});

/**
 * Get Webhook Endpoint
 *
 * @route GET /api/v1/webhooks/get
 * @scope seal:webhooks:manage
 *
 * @queryparam {string} id - Webhook endpoint ID (required)
 *
 * @returns Webhook endpoint details
 */
http.route({
  path: "/api/v1/webhooks/get",
  method: "GET",
  handler: apiHttpAction(
    async ({ ctx, auth, query }) => {
      if (!query.id) {
        throw new ApiError(400, "Webhook endpoint ID is required", "VALIDATION_ERROR");
      }

      const endpoint = await ctx.runQuery(internal.api.v1.webhooks.getEndpoint, {
        userId: auth.userId,
        organizationId: auth.organizationId,
        endpointId: query.id as Id<"webhook_endpoints">,
      });

      if (!endpoint) {
        throw new ApiError(404, "Webhook endpoint not found", "WEBHOOK_NOT_FOUND");
      }

      return apiResponse(200, endpoint);
    },
    { scope: API_SCOPES.WEBHOOKS_MANAGE },
  ),
});

/**
 * Create Webhook Endpoint
 *
 * @route POST /api/v1/webhooks
 * @scope seal:webhooks:manage
 *
 * @bodyparam {string} name - Endpoint name (required)
 * @bodyparam {string} url - HTTPS URL for webhook delivery (required)
 * @bodyparam {string[]} events - Event types to subscribe to (required)
 * @bodyparam {string} [description] - Optional description
 *
 * @returns Created endpoint with signing secret (shown only once)
 */
http.route({
  path: "/api/v1/webhooks",
  method: "POST",
  handler: apiHttpAction(
    async ({ ctx, auth, request }) => {
      const body = await parseJsonBody<{
        name?: string;
        url?: string;
        events?: string[];
        description?: string;
      }>(request);

      validateRequiredFields(body, ["name", "url", "events"]);

      const result = await ctx.runMutation(internal.api.v1.webhooks.createEndpoint, {
        userId: auth.userId,
        organizationId: auth.organizationId,
        name: body.name as string,
        url: body.url as string,
        events: body.events as string[],
        description: body.description,
      });

      if (!result.success) {
        throw new ApiError(
          400,
          result.error ?? "Failed to create webhook endpoint",
          "VALIDATION_ERROR",
        );
      }

      // Fetch the created endpoint
      const endpoint = await ctx.runQuery(internal.api.v1.webhooks.getEndpoint, {
        userId: auth.userId,
        organizationId: auth.organizationId,
        endpointId: result.endpointId as Id<"webhook_endpoints">,
      });

      return apiResponse(201, {
        ...endpoint,
        secret: result.secret,
      });
    },
    { scope: API_SCOPES.WEBHOOKS_MANAGE },
  ),
});

/**
 * Update Webhook Endpoint
 *
 * @route PUT /api/v1/webhooks/update
 * @scope seal:webhooks:manage
 *
 * @queryparam {string} id - Webhook endpoint ID (required)
 * @bodyparam {string} [name] - New name
 * @bodyparam {string} [url] - New HTTPS URL
 * @bodyparam {string[]} [events] - New event subscriptions
 * @bodyparam {string} [description] - New description
 * @bodyparam {string} [status] - New status (active, paused, disabled)
 *
 * @returns Updated endpoint
 */
http.route({
  path: "/api/v1/webhooks/update",
  method: "PUT",
  handler: apiHttpAction(
    async ({ ctx, auth, query, request }) => {
      if (!query.id) {
        throw new ApiError(400, "Webhook endpoint ID is required", "VALIDATION_ERROR");
      }

      const body = await parseJsonBody<{
        name?: string;
        url?: string;
        events?: string[];
        description?: string;
        status?: "active" | "paused" | "disabled";
      }>(request);

      const result = await ctx.runMutation(internal.api.v1.webhooks.updateEndpoint, {
        userId: auth.userId,
        organizationId: auth.organizationId,
        endpointId: query.id as Id<"webhook_endpoints">,
        name: body.name,
        url: body.url,
        events: body.events,
        description: body.description,
        status: body.status,
      });

      if (!result.success) {
        if (result.error?.includes("not found")) {
          throw new ApiError(404, result.error, "WEBHOOK_NOT_FOUND");
        }
        throw new ApiError(400, result.error ?? "Update failed", "VALIDATION_ERROR");
      }

      // Fetch the updated endpoint
      const endpoint = await ctx.runQuery(internal.api.v1.webhooks.getEndpoint, {
        userId: auth.userId,
        organizationId: auth.organizationId,
        endpointId: query.id as Id<"webhook_endpoints">,
      });

      return apiResponse(200, endpoint);
    },
    { scope: API_SCOPES.WEBHOOKS_MANAGE },
  ),
});

/**
 * Delete Webhook Endpoint
 *
 * @route DELETE /api/v1/webhooks/delete
 * @scope seal:webhooks:manage
 *
 * @queryparam {string} id - Webhook endpoint ID (required)
 *
 * @returns Success confirmation
 */
http.route({
  path: "/api/v1/webhooks/delete",
  method: "DELETE",
  handler: apiHttpAction(
    async ({ ctx, auth, query }) => {
      if (!query.id) {
        throw new ApiError(400, "Webhook endpoint ID is required", "VALIDATION_ERROR");
      }

      const result = await ctx.runMutation(internal.api.v1.webhooks.deleteEndpoint, {
        userId: auth.userId,
        organizationId: auth.organizationId,
        endpointId: query.id as Id<"webhook_endpoints">,
      });

      if (!result.success) {
        if (result.error?.includes("not found")) {
          throw new ApiError(404, result.error, "WEBHOOK_NOT_FOUND");
        }
        throw new ApiError(400, result.error ?? "Delete failed", "VALIDATION_ERROR");
      }

      return apiResponse(200, { deleted: true });
    },
    { scope: API_SCOPES.WEBHOOKS_MANAGE },
  ),
});

/**
 * Rotate Webhook Secret
 *
 * @route POST /api/v1/webhooks/rotate-secret
 * @scope seal:webhooks:manage
 *
 * @queryparam {string} id - Webhook endpoint ID (required)
 *
 * @returns New signing secret (shown only once)
 */
http.route({
  path: "/api/v1/webhooks/rotate-secret",
  method: "POST",
  handler: apiHttpAction(
    async ({ ctx, auth, query }) => {
      if (!query.id) {
        throw new ApiError(400, "Webhook endpoint ID is required", "VALIDATION_ERROR");
      }

      const result = await ctx.runMutation(internal.api.v1.webhooks.rotateSecret, {
        userId: auth.userId,
        organizationId: auth.organizationId,
        endpointId: query.id as Id<"webhook_endpoints">,
      });

      if (!result.success) {
        if (result.error?.includes("not found")) {
          throw new ApiError(404, result.error, "WEBHOOK_NOT_FOUND");
        }
        throw new ApiError(400, result.error ?? "Rotation failed", "VALIDATION_ERROR");
      }

      return apiResponse(200, { secret: result.secret });
    },
    { scope: API_SCOPES.WEBHOOKS_MANAGE },
  ),
});

/**
 * Get Available Webhook Event Types
 *
 * @route GET /api/v1/webhooks/event-types
 * @scope seal:webhooks:manage
 *
 * @returns List of available event types with descriptions
 */
http.route({
  path: "/api/v1/webhooks/event-types",
  method: "GET",
  handler: apiHttpAction(
    async ({ ctx }) => {
      const eventTypes = await ctx.runQuery(internal.api.v1.webhooks.getEventTypes, {});

      return apiResponse(200, { data: eventTypes });
    },
    { scope: API_SCOPES.WEBHOOKS_MANAGE },
  ),
});

// =============================================================================
// MEMBERS API
// =============================================================================

/**
 * List Workspace Members
 *
 * @route GET /api/v1/members
 * @scope seal:members:read
 */
http.route({
  path: "/api/v1/members",
  method: "GET",
  handler: apiHttpAction(
    async ({ ctx, auth, query }) => {
      const role = query.role as "owner" | "admin" | "member" | "viewer" | undefined;
      const members = await ctx.runQuery(internal.api.v1.members.listMembers, {
        userId: auth.userId,
        organizationId: auth.organizationId,
        role,
      });
      return apiResponse(200, { data: members });
    },
    { scope: API_SCOPES.MEMBERS_READ },
  ),
});

/**
 * Get Member Details
 *
 * @route GET /api/v1/members/get
 * @scope seal:members:read
 */
http.route({
  path: "/api/v1/members/get",
  method: "GET",
  handler: apiHttpAction(
    async ({ ctx, auth, query }) => {
      if (!query.id) {
        throw new ApiError(400, "Missing required parameter: id", "VALIDATION_ERROR");
      }
      let member = null;
      try {
        member = await ctx.runQuery(internal.api.v1.members.getMember, {
          userId: auth.userId,
          organizationId: auth.organizationId,
          memberId: query.id as Parameters<typeof ctx.runQuery>[1]["memberId"],
        });
      } catch {
        // Invalid ID format — treat as not found
      }
      if (!member) {
        throw new ApiError(404, "Member not found", "RESOURCE_NOT_FOUND");
      }
      return apiResponse(200, member);
    },
    { scope: API_SCOPES.MEMBERS_READ },
  ),
});

// =============================================================================
// SETTINGS API
// =============================================================================

/**
 * Get Organization Settings
 *
 * @route GET /api/v1/settings
 * @scope seal:settings:read
 */
http.route({
  path: "/api/v1/settings",
  method: "GET",
  handler: apiHttpAction(
    async ({ ctx, auth }) => {
      const settings = await ctx.runQuery(internal.api.v1.settings.getSettings, {
        userId: auth.userId,
        organizationId: auth.organizationId,
      });
      return apiResponse(200, settings);
    },
    { scope: API_SCOPES.SETTINGS_READ },
  ),
});

/**
 * Update Organization Settings
 *
 * @route PATCH /api/v1/settings
 * @scope seal:settings:write
 */
http.route({
  path: "/api/v1/settings",
  method: "PATCH",
  handler: apiHttpAction(
    async ({ ctx, auth, request }) => {
      const body = await parseJsonBody<{
        signing?: unknown;
        notifications?: unknown;
        ai?: unknown;
        security?: unknown;
      }>(request);

      await ctx.runMutation(internal.api.v1.settings.updateSettings, {
        userId: auth.userId,
        organizationId: auth.organizationId,
        signing: body.signing as Parameters<typeof ctx.runMutation>[1]["signing"],
        notifications: body.notifications as Parameters<typeof ctx.runMutation>[1]["notifications"],
        ai: body.ai as Parameters<typeof ctx.runMutation>[1]["ai"],
        security: body.security as Parameters<typeof ctx.runMutation>[1]["security"],
      });

      return apiResponse(200, { success: true });
    },
    { scope: API_SCOPES.SETTINGS_WRITE },
  ),
});

// =============================================================================
// AUDIT LOG API
// =============================================================================

/**
 * List Organization Audit Log
 *
 * @route GET /api/v1/audit-log
 * @scope seal:audit:read
 */
http.route({
  path: "/api/v1/audit-log",
  method: "GET",
  handler: apiHttpAction(
    async ({ ctx, auth, query }) => {
      const { limit, cursor } = parsePagination(query);
      const result = await ctx.runQuery(internal.api.v1.audit.listAuditLog, {
        userId: auth.userId,
        organizationId: auth.organizationId,
        limit,
        cursor,
        document_id: query.document_id as Parameters<typeof ctx.runQuery>[1]["document_id"],
        action: query.action,
        created_after: query.created_after ? new Date(query.created_after).getTime() : undefined,
        created_before: query.created_before ? new Date(query.created_before).getTime() : undefined,
      });
      return apiResponse(200, result);
    },
    { scope: API_SCOPES.AUDIT_READ },
  ),
});

// =============================================================================
// CONTACTS API
// =============================================================================

/**
 * List Contacts
 *
 * @route GET /api/v1/contacts
 * @scope seal:contacts:read
 */
http.route({
  path: "/api/v1/contacts",
  method: "GET",
  handler: apiHttpAction(
    async ({ ctx, auth, query }) => {
      const { limit, cursor } = parsePagination(query);
      const result = await ctx.runQuery(internal.api.v1.contacts.listContacts, {
        userId: auth.userId,
        organizationId: auth.organizationId,
        limit,
        cursor,
        status: query.status as Parameters<typeof ctx.runQuery>[1]["status"],
        search: query.search,
      });
      return apiResponse(200, result);
    },
    { scope: API_SCOPES.CONTACTS_READ },
  ),
});

/**
 * Get Contact
 *
 * @route GET /api/v1/contacts/get
 * @scope seal:contacts:read
 */
http.route({
  path: "/api/v1/contacts/get",
  method: "GET",
  handler: apiHttpAction(
    async ({ ctx, auth, query }) => {
      if (!query.id) {
        throw new ApiError(400, "Missing required parameter: id", "VALIDATION_ERROR");
      }
      let contact = null;
      try {
        contact = await ctx.runQuery(internal.api.v1.contacts.getContact, {
          userId: auth.userId,
          organizationId: auth.organizationId,
          contactId: query.id as Parameters<typeof ctx.runQuery>[1]["contactId"],
        });
      } catch {
        // Invalid ID format — treat as not found
      }
      if (!contact) {
        throw new ApiError(404, "Contact not found", "RESOURCE_NOT_FOUND");
      }
      return apiResponse(200, contact);
    },
    { scope: API_SCOPES.CONTACTS_READ },
  ),
});

/**
 * Create Contact
 *
 * @route POST /api/v1/contacts
 * @scope seal:contacts:write
 */
http.route({
  path: "/api/v1/contacts",
  method: "POST",
  handler: apiHttpAction(
    async ({ ctx, auth, request }) => {
      const body = await parseJsonBody<{
        first_name?: string;
        last_name?: string;
        email?: string;
        phone?: string;
        company?: string;
        title?: string;
        status?: string;
        notes?: string;
        tags?: string[];
      }>(request);
      validateRequiredFields(body as Record<string, unknown>, ["first_name", "last_name", "email"]);

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (body.email && !emailRegex.test(body.email)) {
        throw new ApiError(422, "Invalid email address", "VALIDATION_ERROR", {
          email: ["email must be a valid email address"],
        });
      }

      const result = await ctx.runMutation(internal.api.v1.contacts.createContact, {
        userId: auth.userId,
        organizationId: auth.organizationId,
        first_name: body.first_name!,
        last_name: body.last_name!,
        email: body.email!,
        phone: body.phone,
        company: body.company,
        title: body.title,
        status: body.status as Parameters<typeof ctx.runMutation>[1]["status"],
        notes: body.notes,
        tags: body.tags,
      });

      return apiResponse(201, result);
    },
    { scope: API_SCOPES.CONTACTS_WRITE },
  ),
});

/**
 * Delete Contact
 *
 * @route DELETE /api/v1/contacts/delete
 * @scope seal:contacts:write
 */
http.route({
  path: "/api/v1/contacts/delete",
  method: "DELETE",
  handler: apiHttpAction(
    async ({ ctx, auth, query }) => {
      if (!query.id) {
        throw new ApiError(400, "Missing required parameter: id", "VALIDATION_ERROR");
      }
      try {
        await ctx.runMutation(internal.api.v1.contacts.deleteContact, {
          userId: auth.userId,
          organizationId: auth.organizationId,
          contactId: query.id as Parameters<typeof ctx.runMutation>[1]["contactId"],
        });
      } catch {
        throw new ApiError(404, "Contact not found", "RESOURCE_NOT_FOUND");
      }
      return apiResponse(200, { success: true });
    },
    { scope: API_SCOPES.CONTACTS_WRITE },
  ),
});

// =============================================================================
// DOCUMENT ACCESS / SHARING MODE
// =============================================================================

/**
 * Get Document Sharing Mode
 *
 * @route GET /api/v1/documents/access
 * @scope seal:documents:read
 */
http.route({
  path: "/api/v1/documents/access",
  method: "GET",
  handler: apiHttpAction(
    async ({ ctx, auth, query }) => {
      if (!query.id) {
        throw new ApiError(400, "Missing required parameter: id", "VALIDATION_ERROR");
      }
      let access = null;
      try {
        access = await ctx.runQuery(internal.api.v1.documents.getDocumentAccess, {
          userId: auth.userId,
          organizationId: auth.organizationId,
          documentId: query.id as Parameters<typeof ctx.runQuery>[1]["documentId"],
        });
      } catch {
        // Invalid ID format — treat as not found
      }
      if (!access) {
        throw new ApiError(404, "Document not found", "RESOURCE_NOT_FOUND");
      }
      return apiResponse(200, access);
    },
    { scope: API_SCOPES.DOCUMENTS_READ },
  ),
});

/**
 * Update Document Sharing Mode
 *
 * @route PUT /api/v1/documents/access
 * @scope seal:documents:write
 */
http.route({
  path: "/api/v1/documents/access",
  method: "PUT",
  handler: apiHttpAction(
    async ({ ctx, auth, query, request }) => {
      if (!query.id) {
        throw new ApiError(400, "Missing required parameter: id", "VALIDATION_ERROR");
      }
      const body = await parseJsonBody<{ sharing_mode?: string }>(request);
      validateRequiredFields(body as Record<string, unknown>, ["sharing_mode"]);

      await ctx.runMutation(internal.api.v1.documents.updateDocumentAccess, {
        userId: auth.userId,
        organizationId: auth.organizationId,
        documentId: query.id as Parameters<typeof ctx.runMutation>[1]["documentId"],
        sharing_mode: body.sharing_mode as Parameters<typeof ctx.runMutation>[1]["sharing_mode"],
      });
      return apiResponse(200, { success: true });
    },
    { scope: API_SCOPES.DOCUMENTS_WRITE },
  ),
});

// =============================================================================
// BULK DOCUMENT OPERATIONS
// =============================================================================

/**
 * Bulk Void Documents
 *
 * @route POST /api/v1/documents/bulk-void
 * @scope seal:documents:write
 */
http.route({
  path: "/api/v1/documents/bulk-void",
  method: "POST",
  handler: apiHttpAction(
    async ({ ctx, auth, request }) => {
      const body = await parseJsonBody<{ document_ids?: string[]; reason?: string }>(request);
      validateRequiredFields(body as Record<string, unknown>, ["document_ids", "reason"]);

      if (!Array.isArray(body.document_ids) || body.document_ids.length === 0) {
        throw new ApiError(400, "document_ids must be a non-empty array", "VALIDATION_ERROR");
      }
      if (body.document_ids.length > 50) {
        throw new ApiError(400, "Cannot void more than 50 documents at once", "VALIDATION_ERROR");
      }

      const result = await ctx.runMutation(internal.api.v1.documents.bulkVoidDocuments, {
        userId: auth.userId,
        organizationId: auth.organizationId,
        document_ids: body.document_ids as Parameters<typeof ctx.runMutation>[1]["document_ids"],
        reason: body.reason!,
      });
      return apiResponse(200, result);
    },
    { scope: API_SCOPES.DOCUMENTS_WRITE },
  ),
});

/**
 * Bulk Send Documents
 *
 * @route POST /api/v1/documents/bulk-send
 * @scope seal:documents:write
 */
http.route({
  path: "/api/v1/documents/bulk-send",
  method: "POST",
  handler: apiHttpAction(
    async ({ ctx, auth, request }) => {
      const body = await parseJsonBody<{ document_ids?: string[]; message?: string }>(request);
      validateRequiredFields(body as Record<string, unknown>, ["document_ids"]);

      if (!Array.isArray(body.document_ids) || body.document_ids.length === 0) {
        throw new ApiError(400, "document_ids must be a non-empty array", "VALIDATION_ERROR");
      }
      if (body.document_ids.length > 50) {
        throw new ApiError(400, "Cannot send more than 50 documents at once", "VALIDATION_ERROR");
      }

      const result = await ctx.runMutation(internal.api.v1.documents.bulkSendDocuments, {
        userId: auth.userId,
        organizationId: auth.organizationId,
        document_ids: body.document_ids as Parameters<typeof ctx.runMutation>[1]["document_ids"],
        message: body.message,
      });
      return apiResponse(200, result);
    },
    { scope: API_SCOPES.DOCUMENTS_WRITE },
  ),
});

// =============================================================================
// ANALYTICS
// =============================================================================

/**
 * Get Analytics
 *
 * @route GET /api/v1/analytics
 * @scope seal:documents:read
 */
http.route({
  path: "/api/v1/analytics",
  method: "GET",
  handler: apiHttpAction(
    async ({ ctx, auth, query }) => {
      const analytics = await ctx.runQuery(internal.api.v1.analytics.getAnalytics, {
        userId: auth.userId,
        organizationId: auth.organizationId,
        from: query.from ? new Date(query.from).getTime() : undefined,
        to: query.to ? new Date(query.to).getTime() : undefined,
      });
      return apiResponse(200, analytics);
    },
    { scope: API_SCOPES.DOCUMENTS_READ },
  ),
});

// =============================================================================
// PUBLIC DOWNLOAD (Token-Based)
// =============================================================================

/**
 * @route POST /resend-webhooks
 * Resend email delivery webhook handler.
 * Delegates to @convex-dev/resend component for signature verification,
 * event parsing, and delivery tracking. The component calls our
 * `onEmailEvent` mutation for ESIGN audit logging.
 */
http.route({
  path: "/resend-webhooks",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    return await resendComponent.handleResendEventWebhook(ctx, request);
  }),
});

/**
 * Download a completed document using a time-limited token.
 *
 * @route GET /download
 * @queryparam {string} token - Download token (required)
 *
 * No authentication required — the token grants temporary access.
 */
http.route({
  path: "/download",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    const url = new URL(request.url);
    const token = url.searchParams.get("token");

    if (!token) {
      return new Response(JSON.stringify({ error: "Missing download token" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Validate token and get document ID
    const result = await ctx.runMutation(internal.documents.download_tokens.validateAndUseToken, {
      token,
    });

    if (!result.valid) {
      return new Response(JSON.stringify({ error: result.error }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Get the document to find its storage ID
    const document = await ctx.runQuery(internal.documents.queries.getDocumentInternal, {
      documentId: result.documentId,
    });

    if (!document || !document.storageId) {
      return new Response(JSON.stringify({ error: "Document not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Get a temporary URL from Convex Storage
    const downloadUrl = await ctx.storage.getUrl(document.storageId);

    if (!downloadUrl) {
      return new Response(JSON.stringify({ error: "File not available" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Redirect to the time-limited Convex Storage URL
    return Response.redirect(downloadUrl, 302);
  }),
});

// ---------------------------------------------------------------------------
// DEV-only: AI eval endpoint for promptfoo testing
// Gated on CLERK_SECRET_KEY starting with "sk_test_" — never runs in prod.
// ---------------------------------------------------------------------------

http.route({
  path: "/dev/ai-eval",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const clerkSecret = process.env.CLERK_SECRET_KEY;
    if (!clerkSecret || !clerkSecret.startsWith("sk_test_")) {
      return new Response(JSON.stringify({ error: "Only available in dev" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    const body = (await request.json()) as {
      prompt?: string;
      messages?: string[];
      documentId?: string;
    };
    const messages = body.messages ?? (body.prompt ? [body.prompt] : []);
    if (messages.length === 0) {
      return new Response(JSON.stringify({ error: "prompt or messages is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const result = await ctx.runAction(internal.ai.eval.runEval, {
      messages,
      documentId: body.documentId,
    });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

http.route({
  path: "/dev/reset-eval-state",
  method: "POST",
  handler: httpAction(async (ctx) => {
    const clerkSecret = process.env.CLERK_SECRET_KEY;
    if (!clerkSecret || !clerkSecret.startsWith("sk_test_")) {
      return new Response(JSON.stringify({ error: "Only available in dev" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    const result = await ctx.runMutation(internal.ai.eval.resetEvalState, {});

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

// ---------------------------------------------------------------------------
// BUG-11 fix: CORS preflight handler for all /api/v1/* paths.
// Convex HTTP router requires explicit route registration per method — there
// is no wildcard method support, so OPTIONS must be registered separately.
// Using pathPrefix so a single handler covers every API endpoint.
// ---------------------------------------------------------------------------

const corsPreflightHandler = httpAction(async (_ctx, _request) => {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Authorization, Content-Type, X-API-Version",
      "Access-Control-Max-Age": "86400",
    },
  });
});

http.route({ pathPrefix: "/api/v1/", method: "OPTIONS", handler: corsPreflightHandler });

// ---------------------------------------------------------------------------
// BUG-12 fix: RFC 7807 fallback for unmatched /api/v1/* paths.
// Exact-path routes registered above take priority; these prefix handlers
// only fire when no explicit route matches (unknown path or wrong method).
// ---------------------------------------------------------------------------

const apiNotFoundHandler = httpAction(async (_ctx, request) => {
  return new Response(
    JSON.stringify({
      type: "https://api.seal.app/errors/not-found",
      title: "Not Found",
      status: 404,
      detail: `No API endpoint found for ${request.method} ${new URL(request.url).pathname}`,
      code: "ENDPOINT_NOT_FOUND",
      instance: request.url,
    }),
    {
      status: 404,
      headers: {
        "Content-Type": "application/json",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "no-store",
      },
    },
  );
});

for (const method of ["GET", "POST", "PUT", "PATCH", "DELETE"] as const) {
  http.route({ pathPrefix: "/api/v1/", method, handler: apiNotFoundHandler });
}

export default http;
