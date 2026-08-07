"use node";

import { randomUUID } from "node:crypto";

import {
  buildMcpOAuthPublicJwks,
  createMcpOAuthSigningKeyRecord,
  ensureMcpOAuthSigningKey,
  MCP_OAUTH_RETIRED_SIGNING_KEY_RETENTION_MS,
  rotateMcpOAuthSigningKey,
  shouldPublishMcpOAuthSigningKey,
  signMcpOAuthAccessTokenWithStoredKey,
  verifyMcpOAuthAccessTokenWithStoredKeys,
  type McpOAuthSignedAccessToken,
  type McpOAuthSigningKeyRecord,
} from "@vortexnyc/auth/mcp";
import { parse } from "@vortexnyc/convex/helpers";
import { ConvexError, v } from "convex/values";

import { internal } from "./_generated/api";
import { internalAction, type ActionCtx } from "./_generated/server";
import { API_SCOPES } from "./api/context";
import {
  MCP_OAUTH_AUDIENCE,
  MCP_OAUTH_DEFAULT_CLIENT,
  MCP_OAUTH_RESOURCE_ID,
} from "./mcpOAuth";

const supportedScopeValidator = v.union(
  v.literal(API_SCOPES.DOCUMENTS_READ),
  v.literal(API_SCOPES.TEMPLATES_READ),
  v.literal(API_SCOPES.MEMBERS_READ),
  v.literal(API_SCOPES.CONTACTS_READ),
  v.literal(API_SCOPES.AUDIT_READ)
);

type SigningKeyRecord = McpOAuthSigningKeyRecord;
type SignedAccessToken = McpOAuthSignedAccessToken;

export const RETIRED_SIGNING_KEY_RETENTION_MS =
  MCP_OAUTH_RETIRED_SIGNING_KEY_RETENTION_MS;
export const shouldPublishSigningKey = shouldPublishMcpOAuthSigningKey;

const MCP_OAUTH_ISSUER_SUFFIX = "/oauth/seal-mcp";

function resolveIssuer(): string {
  const siteUrl = process.env.CONVEX_SITE_URL;
  if (!siteUrl) {
    throw new ConvexError({
      code: "INTERNAL_ERROR",
      message: "CONVEX_SITE_URL missing",
    });
  }
  return `${siteUrl}${MCP_OAUTH_ISSUER_SUFFIX}`;
}

async function createSigningKeyRecord(): Promise<SigningKeyRecord> {
  return await createMcpOAuthSigningKeyRecord({
    keyId: `seal-mcp-${randomUUID()}`,
    algorithm: "ES256",
  });
}

async function ensureSigningKeyRecord(
  ctx: ActionCtx
): Promise<SigningKeyRecord> {
  return await ensureMcpOAuthSigningKey({
    loadActiveSigningKey: async () =>
      await ctx.runQuery(internal.mcpOAuthAuth.getSigningKey, {}),
    persistSigningKey: async (signingKey) => {
      await ctx.runMutation(internal.mcpOAuthAuth.upsertSigningKey, signingKey);
    },
    createSigningKey: createSigningKeyRecord,
  });
}

export const ensureSigningKey = internalAction({
  args: {},
  handler: async (ctx): Promise<SigningKeyRecord> => {
    return await ensureSigningKeyRecord(ctx);
  },
});

export const getPublicJwks = internalAction({
  args: {},
  handler: async (ctx): Promise<{ keys: Record<string, unknown>[] }> => {
    return await buildMcpOAuthPublicJwks({
      ensureSigningKey: async () => {
        await ensureSigningKeyRecord(ctx);
      },
      listSigningKeys: async () =>
        await ctx.runQuery(internal.mcpOAuthAuth.listSigningKeys, {
          includeRetired: true,
        }),
      now: Date.now(),
    });
  },
});

export const verifyAccessToken = internalAction({
  args: {
    accessToken: v.string(),
    audience: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args
  ): Promise<{
    azp: string | null;
    betterAuthUserId: string | null;
    orgId: string | null;
    scope: string;
    subject: string | null;
  }> => {
    await ensureSigningKeyRecord(ctx);

    const keys = await ctx.runQuery(internal.mcpOAuthAuth.listSigningKeys, {
      includeRetired: true,
    });

    try {
      const verified = await verifyMcpOAuthAccessTokenWithStoredKeys({
        accessToken: args.accessToken,
        issuer: resolveIssuer(),
        audience: args.audience ?? MCP_OAUTH_AUDIENCE,
        listSigningKeys: () => keys,
      });

      return {
        azp: verified.clientId,
        betterAuthUserId: verified.betterAuthUserId,
        orgId: verified.organizationId,
        scope: verified.scope,
        subject: verified.subject,
      };
    } catch (error) {
      throw new ConvexError({
        code: "UNAUTHORIZED",
        message:
          error instanceof Error ? error.message : "Token verification failed",
      });
    }
  },
});

async function signAccessTokenWithClaims(
  ctx: ActionCtx,
  args: {
    audience?: string;
    betterAuthUserId: string;
    clientId?: string;
    expiresInSeconds?: number;
    organizationId?: string;
    scopes: string[];
    omitOrgId?: boolean;
  }
): Promise<SignedAccessToken> {
  let organizationSlug: string | undefined;
  if (args.organizationId !== undefined) {
    const organization = await ctx.runQuery(
      internal.organizations.helpers.getOrganizationById,
      {
        organizationId: parse(v.id("organizations"), args.organizationId),
      }
    );
    if (organization === null) {
      throw new ConvexError({
        code: "NOT_FOUND",
        message: "Organization not found",
      });
    }
    organizationSlug = organization.slug;
  }

  return await signMcpOAuthAccessTokenWithStoredKey({
    loadActiveSigningKey: async () =>
      await ctx.runQuery(internal.mcpOAuthAuth.getSigningKey, {}),
    persistSigningKey: async (signingKey) => {
      await ctx.runMutation(internal.mcpOAuthAuth.upsertSigningKey, signingKey);
    },
    createSigningKey: createSigningKeyRecord,
    issuer: resolveIssuer(),
    audience: args.audience ?? MCP_OAUTH_AUDIENCE,
    subject: args.betterAuthUserId,
    claims: {
      clientId: args.clientId ?? MCP_OAUTH_DEFAULT_CLIENT.clientId,
      betterAuthUserId: args.betterAuthUserId,
      resourceId: MCP_OAUTH_RESOURCE_ID,
      scopes: args.scopes,
      ...(args.omitOrgId || args.organizationId === undefined
        ? {}
        : { organizationId: args.organizationId }),
      ...(organizationSlug === undefined ? {} : { organizationSlug }),
    },
    expiresInSeconds: args.expiresInSeconds,
  });
}

export const signAccessToken = internalAction({
  args: {
    betterAuthUserId: v.string(),
    organizationId: v.id("organizations"),
    scopes: v.array(supportedScopeValidator),
    audience: v.optional(v.string()),
    clientId: v.optional(v.string()),
    expiresInSeconds: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<SignedAccessToken> => {
    return await signAccessTokenWithClaims(ctx, {
      audience: args.audience,
      betterAuthUserId: args.betterAuthUserId,
      clientId: args.clientId,
      expiresInSeconds: args.expiresInSeconds,
      organizationId: args.organizationId,
      scopes: args.scopes,
    });
  },
});

export const rotateSigningKey = internalAction({
  args: {},
  handler: async (ctx): Promise<SigningKeyRecord> => {
    const rotated = await rotateMcpOAuthSigningKey({
      listSigningKeys: async () =>
        await ctx.runQuery(internal.mcpOAuthAuth.listSigningKeys, {
          includeRetired: true,
        }),
      persistSigningKey: async (signingKey) => {
        await ctx.runMutation(
          internal.mcpOAuthAuth.upsertSigningKey,
          signingKey
        );
      },
      retireSigningKey: async ({ keyId, retiredAt }) => {
        await ctx.runMutation(internal.mcpOAuthAuth.updateSigningKeyStatus, {
          keyId,
          status: "retired",
          retiredAt,
        });
      },
      createSigningKey: createSigningKeyRecord,
    });

    return rotated.signingKey;
  },
});

export const signTestingAccessToken = internalAction({
  args: {
    betterAuthUserId: v.string(),
    organizationId: v.optional(v.id("organizations")),
    scopes: v.array(supportedScopeValidator),
    clientId: v.optional(v.string()),
    expiresInSeconds: v.optional(v.number()),
    omitOrgId: v.optional(v.boolean()),
  },
  handler: async (ctx, args): Promise<SignedAccessToken> => {
    return await signAccessTokenWithClaims(ctx, {
      betterAuthUserId: args.betterAuthUserId,
      clientId: args.clientId,
      expiresInSeconds: args.expiresInSeconds,
      omitOrgId: args.omitOrgId,
      organizationId: args.organizationId,
      scopes: args.scopes,
    });
  },
});
