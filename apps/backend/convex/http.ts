/**
 * @fileoverview HTTP endpoint definitions for Seal.
 * Includes webhook receivers, Better Auth routes, MCP OAuth handlers, and
 * internal-only development/evaluation endpoints. Public product API routes
 * live in the Cloudflare Worker (apps/api).
 *
 * @module http
 */

import {
  createMcpOAuthAccessRuntime,
  createMcpOAuthHttpHandlers,
} from "@vortexnyc/auth/mcp";
import { parse } from "@vortexnyc/convex/helpers";
import { httpRouter } from "convex/server";
import { v } from "convex/values";

import { internal } from "./_generated/api";
import { httpAction } from "./_generated/server";
import { registerAuthRoutes } from "./betterAuth";
import {
  buildBetterAuthTokenIdentifier,
  getBetterAuthIdentityIssuer,
  getBetterAuthIdentityProvider,
} from "./lib/authIdentities";
import {
  MCP_OAUTH_ALLOWED_SCOPES,
  MCP_OAUTH_AUDIENCE,
  MCP_OAUTH_AUTHORIZE_PATH,
  MCP_OAUTH_AUTHORIZATION_SERVER_METADATA_PATH,
  MCP_OAUTH_JWKS_PATH,
  MCP_OAUTH_PROTECTED_RESOURCE_METADATA_PATH,
  MCP_OAUTH_REGISTRATION_PATH,
  MCP_OAUTH_RESOURCE_ID,
  MCP_OAUTH_TOKEN_PATH,
  buildAuthorizationServerMetadata,
  buildProtectedResourceMetadata,
  resolveMcpOAuthOrigin,
} from "./mcpOAuth";
import {
  requireAccessibleOrganization,
  requireAllowedRedirectUri,
  requireAllowedScopes,
  requireKnownClient,
} from "./mcpOAuthAuth";
import { validateRequestedOAuthScopes } from "./mcpOAuthAuthorization";
import { handleVortexBillingWebhookRequest } from "./vortex_billing/webhook_handlers";

const http = httpRouter();

// Mount Better-Auth routes (/api/auth/*) from vortex-auth.
registerAuthRoutes(http);

// ===========================================================================
// MCP OAuth (Better-Auth) authorization server — ADDITIVE
//
// Stands up the Better-Auth-backed MCP OAuth server (metadata, JWKS, authorize,
// token, dynamic client registration, and the /mcp tool endpoint). Runs in
// PARALLEL with the existing API-key/JWT path; nothing else in this file is
// touched. Mirrors crm's wiring, adapted to Seal's scopes + tools.
// ===========================================================================

type McpHttpActionCtx = Parameters<Parameters<typeof httpAction>[0]>[0];

function mcpJson(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function createMcpOAuthAccessRuntimeForCtx(ctx: McpHttpActionCtx) {
  return createMcpOAuthAccessRuntime({
    resolveIdentityForUser: async (betterAuthUserId) => {
      const issuer = getBetterAuthIdentityIssuer();
      return await ctx.runQuery(internal.apiAuth.getUserByIdentityForApiAuth, {
        provider: getBetterAuthIdentityProvider(),
        issuer,
        subject: betterAuthUserId,
        tokenIdentifier: buildBetterAuthTokenIdentifier(
          betterAuthUserId,
          issuer
        ),
      });
    },
    getAccessibleOrganizations: async (userId) =>
      await ctx.runQuery(
        internal.apiAuth.getAccessibleOrganizationsForApiAuth,
        { userId }
      ),
    getOrganizationAccess: async ({
      userId,
      requestedOrganizationId,
      organizationHintId,
    }) =>
      await ctx.runQuery(internal.apiAuth.getOrganizationAccessForApiAuth, {
        userId,
        requestedOrganizationId: requestedOrganizationId
          ? parse(v.id("organizations"), requestedOrganizationId)
          : null,
        organizationHintId: organizationHintId
          ? parse(v.id("organizations"), organizationHintId)
          : null,
      }),
    normalizeScopes: (requestedScopes) => requireAllowedScopes(requestedScopes),
    validateScopes: ({ permissions, requestedScopes }) =>
      validateRequestedOAuthScopes({
        permissions: [...permissions],
        requestedScopes: requireAllowedScopes(requestedScopes),
      }),
    requireAccessibleOrganization: (organizationId) =>
      requireAccessibleOrganization(
        organizationId ? parse(v.id("organizations"), organizationId) : null
      ),
    signAccessToken: async ({
      betterAuthUserId,
      clientId,
      organizationId,
      scopes,
      audience,
    }) =>
      await ctx.runAction(internal.mcpOAuthNode.signAccessToken, {
        betterAuthUserId,
        clientId,
        organizationId: parse(v.id("organizations"), organizationId),
        scopes: [...requireAllowedScopes(scopes)],
        audience,
      }),
  });
}

async function createStoredMcpAuthorizationCode(
  ctx: McpHttpActionCtx,
  input: {
    code: string;
    clientId: string;
    redirectUri: string;
    betterAuthUserId: string;
    organizationId: string;
    scopes: readonly string[];
    codeChallenge: string;
    codeChallengeMethod: "S256";
    state?: string;
    audience: string;
    resourceId: string;
    expiresAt: number;
  }
): Promise<void> {
  await ctx.runMutation(internal.mcpOAuthAuth.createAuthorizationCode, {
    code: input.code,
    clientId: input.clientId,
    redirectUri: input.redirectUri,
    betterAuthUserId: input.betterAuthUserId,
    organizationId: parse(v.id("organizations"), input.organizationId),
    scopes: requireAllowedScopes(input.scopes),
    codeChallenge: input.codeChallenge,
    codeChallengeMethod: input.codeChallengeMethod,
    state: input.state,
    audience: input.audience,
    resourceId: input.resourceId,
    expiresAt: input.expiresAt,
  });
}

function createBoundMcpOAuthHttpHandlers(ctx: McpHttpActionCtx) {
  const accessRuntime = createMcpOAuthAccessRuntimeForCtx(ctx);
  return createMcpOAuthHttpHandlers({
    authorize: {
      defaultAudience: MCP_OAUTH_AUDIENCE,
      defaultResourceId: MCP_OAUTH_RESOURCE_ID,
      allowTestingExpiresInMs:
        process.env.ENABLE_DEVELOPMENT_TESTING_MUTATIONS === "true",
      resolveClient: async (clientId) => {
        return requireKnownClient(
          await ctx.runQuery(internal.mcpOAuthAuth.resolveClient, { clientId })
        );
      },
      requireAllowedRedirectUri,
      resolveRequestedScopes: (scope) =>
        requireAllowedScopes(scope.split(" ").filter(Boolean)),
      resolveSessionFromToken: async (sessionToken) => {
        return await ctx.runQuery(
          internal.mcpOAuthAuth.resolveBetterAuthSessionFromToken,
          {
            sessionToken,
          }
        );
      },
      resolveIdentityForSession: accessRuntime.resolveIdentityForSession,
      authorize: accessRuntime.authorize,
      createAuthorizationCode: async (input) => {
        await createStoredMcpAuthorizationCode(ctx, input);
      },
    },
    clientRegistration: {
      supportedScopes: MCP_OAUTH_ALLOWED_SCOPES,
      createDynamicClient: async (input) => {
        return await ctx.runMutation(
          internal.mcpOAuthAuth.createDynamicClient,
          {
            clientName: input.clientName,
            redirectUris: [...input.redirectUris],
            scope: input.scope ?? undefined,
            tokenEndpointAuthMethod: input.tokenEndpointAuthMethod ?? undefined,
            grantTypes: input.grantTypes ? [...input.grantTypes] : undefined,
            responseTypes: input.responseTypes
              ? [...input.responseTypes]
              : undefined,
            softwareId: input.softwareId ?? undefined,
            softwareVersion: input.softwareVersion ?? undefined,
          }
        );
      },
    },
    token: {
      resolveClient: async (clientId) => {
        return await ctx.runQuery(internal.mcpOAuthAuth.resolveClient, {
          clientId,
        });
      },
      consumeAuthorizationCode: async (input) => {
        return await ctx.runMutation(
          internal.mcpOAuthAuth.consumeAuthorizationCode,
          input
        );
      },
      redeemRefreshToken: async ({ client, refreshGrant }) => {
        return await ctx.runMutation(internal.mcpOAuthAuth.redeemRefreshToken, {
          clientId: client.clientId,
          refreshToken: refreshGrant.refreshToken,
          requestedScopes:
            refreshGrant.requestedScopes.length > 0
              ? requireAllowedScopes(refreshGrant.requestedScopes)
              : undefined,
        });
      },
      signAccessToken: accessRuntime.signAccessToken,
      issueRefreshToken: async (input) => {
        return await ctx.runMutation(internal.mcpOAuthAuth.issueRefreshToken, {
          clientId: input.clientId,
          betterAuthUserId: input.betterAuthUserId,
          organizationId: parse(v.id("organizations"), input.organizationId),
          scopes: requireAllowedScopes(input.scopes),
          audience: input.audience,
          resourceId: input.resourceId,
        });
      },
    },
  });
}

http.route({
  path: MCP_OAUTH_AUTHORIZATION_SERVER_METADATA_PATH,
  method: "GET",
  handler: httpAction(async (_ctx, request) => {
    const origin = resolveMcpOAuthOrigin(request);
    return mcpJson(200, buildAuthorizationServerMetadata(origin));
  }),
});

http.route({
  path: MCP_OAUTH_PROTECTED_RESOURCE_METADATA_PATH,
  method: "GET",
  handler: httpAction(async (_ctx, request) => {
    const origin = resolveMcpOAuthOrigin(request);
    return mcpJson(200, buildProtectedResourceMetadata(origin));
  }),
});

http.route({
  path: MCP_OAUTH_JWKS_PATH,
  method: "GET",
  handler: httpAction(async (ctx) =>
    mcpJson(200, await ctx.runAction(internal.mcpOAuthNode.getPublicJwks, {}))
  ),
});

http.route({
  path: MCP_OAUTH_AUTHORIZE_PATH,
  method: "GET",
  handler: httpAction(
    async (ctx, request) =>
      await createBoundMcpOAuthHttpHandlers(ctx).handleAuthorizeRequest(request)
  ),
});

http.route({
  path: MCP_OAUTH_REGISTRATION_PATH,
  method: "POST",
  handler: httpAction(
    async (ctx, request) =>
      await createBoundMcpOAuthHttpHandlers(
        ctx
      ).handleClientRegistrationRequest(request)
  ),
});

http.route({
  path: MCP_OAUTH_TOKEN_PATH,
  method: "POST",
  handler: httpAction(
    async (ctx, request) =>
      await createBoundMcpOAuthHttpHandlers(ctx).handleTokenRequest(request)
  ),
});

// MCP tool calls ride the standard /api/v1 resource server (auth via
// resolveMcpApiAuth in api/context.ts). This deployment only hosts the MCP
// OAuth *authorization* server (metadata, JWKS, authorize, token, register).

http.route({
  path: "/vortex-billing-webhook",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    const webhookSecret = process.env.VORTEX_BILLING_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error("Vortex Billing webhook configuration missing", {
        operation: "vortexBillingWebhook.configCheck",
        requiredConfig: "VORTEX_BILLING_WEBHOOK_SECRET",
      });
      return new Response("Webhook configuration error", { status: 500 });
    }

    return await handleVortexBillingWebhookRequest(ctx, request, webhookSecret);
  }),
});
// =============================================================================

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
    const result = await ctx.runMutation(
      internal.documents.download_tokens.validateAndUseToken,
      {
        token,
      }
    );

    if (!result.valid) {
      return new Response(JSON.stringify({ error: result.error }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Get the document to find its storage ID
    const document = await ctx.runQuery(
      internal.documents.document_reads.getDocumentInternal,
      {
        documentId: result.documentId,
      }
    );

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
// Gated on DEV_EVAL_SECRET (set only on dev/test deployments) — never runs in prod.
// ---------------------------------------------------------------------------

http.route({
  path: "/dev/ai-eval",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!process.env.DEV_EVAL_SECRET) {
      return new Response(JSON.stringify({ error: "Only available in dev" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    const body = parse(
      v.object({
        prompt: v.optional(v.string()),
        messages: v.optional(v.array(v.string())),
        documentId: v.optional(v.string()),
      }),
      await request.json()
    );
    const messages = body.messages ?? (body.prompt ? [body.prompt] : []);
    if (messages.length === 0) {
      return new Response(
        JSON.stringify({ error: "prompt or messages is required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
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
    if (!process.env.DEV_EVAL_SECRET) {
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
// DEV-only: payment extraction eval endpoint.
// Accepts raw contract text, runs extraction, returns PaymentExtractionResult.
// Used by evals/scripts/score-extraction.ts — bypasses PDF storage requirement.
// ---------------------------------------------------------------------------

http.route({
  path: "/dev/eval/extract-payment",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!process.env.DEV_EVAL_SECRET) {
      return new Response(JSON.stringify({ error: "Only available in dev" }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    const body = parse(
      v.object({ contractText: v.optional(v.string()) }),
      await request.json()
    );
    if (!body.contractText) {
      return new Response(
        JSON.stringify({ error: "contractText is required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    const result = await ctx.runAction(
      internal.ai.evalExtraction.extractPaymentFromText,
      {
        contractText: body.contractText,
      }
    );

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }),
});

export default http;
