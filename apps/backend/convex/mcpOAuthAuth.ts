import type { McpOAuthClient } from "@vortexnyc/auth/mcp";
/**
 * MCP OAuth internal queries/mutations that delegate to the vortexAuth
 * component (authorization codes, dynamic clients, refresh tokens, signing
 * keys) and to the betterAuth component (session → user lookup).
 *
 * ADDITIVE: mirrors crm's `convex/mcpOAuthAuth.ts`, adapted to Seal's scopes.
 * Component table ids cross the query boundary as opaque strings.
 */
import { parse } from "@vortexnyc/convex/helpers";
import type { FunctionReference } from "convex/server";
import { ConvexError, v } from "convex/values";

import { components } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  internalMutation,
  internalQuery,
  type MutationCtx,
  type QueryCtx,
} from "./_generated/server";
import { API_SCOPES } from "./api/context";
import {
  MCP_OAUTH_ALLOWED_SCOPES,
  getMcpOAuthClient,
  type McpOAuthClientFixture,
} from "./mcpOAuth";

const supportedScopeValidator = v.union(
  v.literal(API_SCOPES.DOCUMENTS_READ),
  v.literal(API_SCOPES.TEMPLATES_READ),
  v.literal(API_SCOPES.MEMBERS_READ),
  v.literal(API_SCOPES.CONTACTS_READ),
  v.literal(API_SCOPES.AUDIT_READ)
);

const resolveSessionArgsValidator = v.object({
  sessionToken: v.string(),
});

const createAuthorizationCodeArgsValidator = v.object({
  code: v.string(),
  clientId: v.string(),
  redirectUri: v.string(),
  betterAuthUserId: v.string(),
  organizationId: v.id("organizations"),
  scopes: v.array(supportedScopeValidator),
  codeChallenge: v.string(),
  codeChallengeMethod: v.literal("S256"),
  state: v.optional(v.string()),
  audience: v.string(),
  resourceId: v.string(),
  expiresAt: v.number(),
});

const consumeAuthorizationCodeArgsValidator = v.object({
  code: v.string(),
  clientId: v.string(),
  redirectUri: v.string(),
});

const issueRefreshTokenArgsValidator = v.object({
  clientId: v.string(),
  betterAuthUserId: v.string(),
  organizationId: v.id("organizations"),
  scopes: v.array(supportedScopeValidator),
  audience: v.string(),
  resourceId: v.string(),
});

const redeemRefreshTokenArgsValidator = v.object({
  clientId: v.string(),
  refreshToken: v.string(),
  requestedScopes: v.optional(v.array(supportedScopeValidator)),
});

const signingKeyDocValidator = v.object({
  keyId: v.string(),
  algorithm: v.literal("ES256"),
  publicJwkJson: v.string(),
  privateJwkJson: v.string(),
});

const signingKeyStatusValidator = v.union(
  v.literal("active"),
  v.literal("retired")
);

type StoredMcpOAuthClient = {
  clientId: string;
  name: string;
  redirectUris: string[];
  allowedScopes: string[];
  tokenEndpointAuthMethod: "none";
  pkceRequired: boolean;
  grantTypes: string[];
  responseTypes: string[];
  softwareId: string | null;
  softwareVersion: string | null;
} | null;

type VortexAuthMcpRefs = {
  mcp: {
    createAuthorizationCode: FunctionReference<
      "mutation",
      "internal",
      {
        code: string;
        clientId: string;
        redirectUri: string;
        betterAuthUserId: string;
        organizationId: string;
        scopes: string[];
        codeChallenge: string;
        codeChallengeMethod: "S256";
        state?: string;
        audience: string;
        resourceId: string;
        expiresAt: number;
      },
      { code: string }
    >;
    consumeAuthorizationCode: FunctionReference<
      "mutation",
      "internal",
      {
        code: string;
        clientId: string;
        redirectUri: string;
      },
      {
        clientId: string;
        betterAuthUserId: string;
        organizationId: string;
        scopes: string[];
        codeChallenge: string;
        codeChallengeMethod: "S256";
        audience: string;
        resourceId: string;
        expiresAt: number;
      } | null
    >;
    resolveClient: FunctionReference<
      "query",
      "internal",
      {
        clientId: string;
      },
      StoredMcpOAuthClient
    >;
    registerDynamicClient: FunctionReference<
      "mutation",
      "internal",
      {
        clientId: string;
        clientName: string;
        redirectUris: string[];
        scope?: string;
        softwareId?: string;
        softwareVersion?: string;
        supportedScopes: string[];
      },
      string
    >;
    createDynamicClient: FunctionReference<
      "mutation",
      "internal",
      {
        clientName: string;
        redirectUris: string[];
        scope?: string;
        tokenEndpointAuthMethod?: string;
        grantTypes?: string[];
        responseTypes?: string[];
        softwareId?: string;
        softwareVersion?: string;
        clientIdPrefix?: string;
        supportedScopes: string[];
      },
      {
        clientId: string;
        clientIdIssuedAt: number;
        name: string;
        redirectUris: string[];
        allowedScopes: string[];
        tokenEndpointAuthMethod?: "none";
        pkceRequired?: boolean;
        grantTypes?: string[];
        responseTypes?: string[];
        softwareId: string | null;
        softwareVersion: string | null;
        registrationClientUri: string | null;
        registrationAccessToken: string | null;
      }
    >;
    issueRefreshToken: FunctionReference<
      "mutation",
      "internal",
      {
        clientId: string;
        betterAuthUserId: string;
        organizationId: string;
        scopes: string[];
        audience: string;
        resourceId: string;
      },
      {
        refreshToken: string;
        expiresAt: number;
        inactivityExpiresAt: number | null;
      }
    >;
    redeemRefreshToken: FunctionReference<
      "mutation",
      "internal",
      {
        client: {
          clientId: string;
          name: string;
          redirectUris: string[];
          allowedScopes: string[];
          tokenEndpointAuthMethod?: "none";
          pkceRequired?: boolean;
          grantTypes?: string[];
          responseTypes?: string[];
          softwareId?: string | null;
          softwareVersion?: string | null;
        };
        refreshToken: string;
        requestedScopes?: string[];
      },
      | {
          ok: true;
          betterAuthUserId: string;
          organizationId: string;
          audience: string;
          resourceId: string;
          scopes: string[];
          refreshToken: string;
          expiresAt: number;
          inactivityExpiresAt: number | null;
        }
      | {
          ok: false;
          status: number;
          body: {
            error: string;
            error_description?: string;
          };
          reason: string;
        }
    >;
    getSigningKey: FunctionReference<
      "query",
      "internal",
      {},
      {
        keyId: string;
        algorithm: "ES256";
        publicJwkJson: string;
        privateJwkJson: string;
      } | null
    >;
    listSigningKeys: FunctionReference<
      "query",
      "internal",
      {
        includeRetired?: boolean;
      },
      Array<{
        keyId: string;
        algorithm: "ES256";
        publicJwkJson: string;
        privateJwkJson: string;
        status: "active" | "retired";
        retiredAt: number | null;
        updatedAt: number;
      }>
    >;
    upsertSigningKey: FunctionReference<
      "mutation",
      "internal",
      {
        keyId: string;
        algorithm: "ES256";
        publicJwkJson: string;
        privateJwkJson: string;
      },
      string
    >;
    updateSigningKeyStatus: FunctionReference<
      "mutation",
      "internal",
      {
        keyId: string;
        status: "active" | "retired";
        retiredAt?: number;
      },
      string
    >;
  };
};

/**
 * The vortexAuth component proxy carries the mcp function refs at runtime,
 * but the generated component types cannot express them. Structural
 * predicate documents the seam without an assertion; the refs resolve
 * lazily through the codegen proxy.
 */
function hasMcpRefs(value: unknown): value is VortexAuthMcpRefs {
  return typeof value === "object" && value !== null;
}

const vortexAuthComponent: unknown = components.vortexAuth;
if (!hasMcpRefs(vortexAuthComponent)) {
  throw new Error("vortexAuth component is not registered");
}
const vortexAuthMcp = vortexAuthComponent.mcp;

type QueryRunner = Pick<QueryCtx | MutationCtx, "runQuery">;

export const resolveBetterAuthSessionFromToken = internalQuery({
  args: resolveSessionArgsValidator,
  handler: async (ctx, args) => {
    const now = Date.now();
    const session = parse(
      v.union(
        v.null(),
        v.object({
          _id: v.string(),
          userId: v.string(),
          token: v.string(),
          expiresAt: v.number(),
        })
      ),
      await ctx.runQuery(components.betterAuth.adapter.findOne, {
        model: "session",
        where: [
          { field: "token", value: args.sessionToken },
          { field: "expiresAt", operator: "gt", value: now },
        ],
      })
    );

    if (session === null) {
      return null;
    }

    const user = parse(
      v.union(
        v.null(),
        v.object({
          _id: v.string(),
          email: v.optional(v.string()),
          name: v.optional(v.string()),
        })
      ),
      await ctx.runQuery(components.betterAuth.adapter.findOne, {
        model: "user",
        where: [{ field: "_id", value: session.userId }],
      })
    );

    if (user === null) {
      return null;
    }

    return {
      betterAuthUserId: user._id,
      email: user.email ?? null,
      name: user.name ?? null,
      sessionId: session._id,
    };
  },
});

export const createAuthorizationCode = internalMutation({
  args: createAuthorizationCodeArgsValidator,
  handler: async (ctx, args) => {
    return await ctx.runMutation(vortexAuthMcp.createAuthorizationCode, {
      code: args.code,
      clientId: args.clientId,
      redirectUri: args.redirectUri,
      betterAuthUserId: args.betterAuthUserId,
      organizationId: String(args.organizationId),
      scopes: [...args.scopes],
      codeChallenge: args.codeChallenge,
      codeChallengeMethod: args.codeChallengeMethod,
      state: args.state,
      audience: args.audience,
      resourceId: args.resourceId,
      expiresAt: args.expiresAt,
    });
  },
});

export const consumeAuthorizationCode = internalMutation({
  args: consumeAuthorizationCodeArgsValidator,
  handler: async (ctx, args) => {
    const consumed = await ctx.runMutation(
      vortexAuthMcp.consumeAuthorizationCode,
      args
    );
    if (consumed === null) {
      return null;
    }

    return {
      ...consumed,
      organizationId: parse(v.id("organizations"), consumed.organizationId),
      scopes: requireAllowedScopes(consumed.scopes),
    };
  },
});

export const issueRefreshToken = internalMutation({
  args: issueRefreshTokenArgsValidator,
  handler: async (ctx, args) => {
    return await ctx.runMutation(vortexAuthMcp.issueRefreshToken, {
      clientId: args.clientId,
      betterAuthUserId: args.betterAuthUserId,
      organizationId: String(args.organizationId),
      scopes: [...args.scopes],
      audience: args.audience,
      resourceId: args.resourceId,
    });
  },
});

export const redeemRefreshToken = internalMutation({
  args: redeemRefreshTokenArgsValidator,
  handler: async (ctx, args) => {
    const client = await resolveClientInternal(ctx, args.clientId);
    if (client === null) {
      return {
        ok: false as const,
        status: 400,
        body: {
          error: "invalid_client",
          error_description: "Unknown OAuth client",
        },
        reason: "not_found" as const,
      };
    }

    const redeemed = await ctx.runMutation(vortexAuthMcp.redeemRefreshToken, {
      client: serializeClient(client),
      refreshToken: args.refreshToken,
      requestedScopes: args.requestedScopes
        ? [...args.requestedScopes]
        : undefined,
    });

    if (!redeemed.ok) {
      return redeemed;
    }

    return {
      ok: true as const,
      betterAuthUserId: redeemed.betterAuthUserId,
      organizationId: parse(v.id("organizations"), redeemed.organizationId),
      audience: redeemed.audience,
      resourceId: redeemed.resourceId,
      scopes: requireAllowedScopes(redeemed.scopes),
      refreshToken: redeemed.refreshToken,
      expiresAt: redeemed.expiresAt,
      inactivityExpiresAt: redeemed.inactivityExpiresAt,
    };
  },
});

async function resolveClientInternal(
  ctx: QueryRunner,
  clientId: string
): Promise<McpOAuthClient | null> {
  const stored: StoredMcpOAuthClient = await ctx.runQuery(
    vortexAuthMcp.resolveClient,
    {
      clientId,
    }
  );
  if (stored !== null) {
    return {
      clientId: stored.clientId,
      name: stored.name,
      redirectUris: stored.redirectUris,
      allowedScopes: stored.allowedScopes,
      tokenEndpointAuthMethod: stored.tokenEndpointAuthMethod,
      pkceRequired: stored.pkceRequired,
      grantTypes: stored.grantTypes,
      responseTypes: stored.responseTypes,
      softwareId: stored.softwareId,
      softwareVersion: stored.softwareVersion,
    } satisfies McpOAuthClient;
  }

  return getMcpOAuthClient(clientId);
}

function serializeClient(client: McpOAuthClient) {
  return {
    clientId: client.clientId,
    name: client.name,
    redirectUris: [...client.redirectUris],
    allowedScopes: [...client.allowedScopes],
    tokenEndpointAuthMethod: "none" as const,
    pkceRequired: client.pkceRequired,
    grantTypes: client.grantTypes ? [...client.grantTypes] : undefined,
    responseTypes: client.responseTypes ? [...client.responseTypes] : undefined,
    softwareId: client.softwareId ?? null,
    softwareVersion: client.softwareVersion ?? null,
  };
}

export const resolveClient = internalQuery({
  args: { clientId: v.string() },
  handler: async (ctx, args) => {
    return await resolveClientInternal(ctx, args.clientId);
  },
});

export const registerDynamicClient = internalMutation({
  args: {
    clientId: v.string(),
    clientName: v.string(),
    redirectUris: v.array(v.string()),
    scope: v.optional(v.string()),
    softwareId: v.optional(v.string()),
    softwareVersion: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.runMutation(vortexAuthMcp.registerDynamicClient, {
      ...args,
      supportedScopes: [...MCP_OAUTH_ALLOWED_SCOPES],
    });
  },
});

export const createDynamicClient = internalMutation({
  args: {
    clientName: v.string(),
    redirectUris: v.array(v.string()),
    scope: v.optional(v.string()),
    tokenEndpointAuthMethod: v.optional(v.string()),
    grantTypes: v.optional(v.array(v.string())),
    responseTypes: v.optional(v.array(v.string())),
    softwareId: v.optional(v.string()),
    softwareVersion: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.runMutation(vortexAuthMcp.createDynamicClient, {
      ...args,
      clientIdPrefix: "seal-mcp",
      supportedScopes: [...MCP_OAUTH_ALLOWED_SCOPES],
    });
  },
});

export const getSigningKey = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.runQuery(vortexAuthMcp.getSigningKey, {});
  },
});

export const listSigningKeys = internalQuery({
  args: {
    includeRetired: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    return await ctx.runQuery(vortexAuthMcp.listSigningKeys, args);
  },
});

export const upsertSigningKey = internalMutation({
  args: signingKeyDocValidator,
  handler: async (ctx, args) => {
    return await ctx.runMutation(vortexAuthMcp.upsertSigningKey, args);
  },
});

export const updateSigningKeyStatus = internalMutation({
  args: {
    keyId: v.string(),
    status: signingKeyStatusValidator,
    retiredAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.runMutation(vortexAuthMcp.updateSigningKeyStatus, args);
  },
});

type SupportedScope = (typeof MCP_OAUTH_ALLOWED_SCOPES)[number];

export function requireAllowedScopes(
  scopes: readonly string[]
): SupportedScope[] {
  const filtered = scopes.filter((scope): scope is SupportedScope =>
    (MCP_OAUTH_ALLOWED_SCOPES as readonly string[]).includes(scope)
  );

  if (filtered.length === 0) {
    throw new ConvexError({
      code: "BAD_REQUEST",
      message: "No allowed scopes requested",
    });
  }

  return filtered;
}

export function requireKnownClient(client: McpOAuthClient | null) {
  if (client === null) {
    throw new ConvexError({
      code: "BAD_REQUEST",
      message: "Unknown OAuth client",
    });
  }
  return client;
}

export function requireAllowedRedirectUri(
  client: McpOAuthClientFixture | McpOAuthClient,
  redirectUri: string
): string {
  if (!client.redirectUris.includes(redirectUri)) {
    throw new ConvexError({
      code: "BAD_REQUEST",
      message: "Invalid redirect URI",
    });
  }
  return redirectUri;
}

export function requireAccessibleOrganization(
  organizationId: Id<"organizations"> | null
): Id<"organizations"> {
  if (organizationId === null) {
    throw new ConvexError({
      code: "FORBIDDEN",
      message: "No accessible organization",
    });
  }
  return organizationId;
}
