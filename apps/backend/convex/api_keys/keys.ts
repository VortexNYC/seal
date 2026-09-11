/**
 * Component-backed API keys (P5). The betterAuth component is the source of
 * truth for these API keys. Tokens are shown once at creation/rotation; only a
 * prefix + hash are stored.
 */
import {
  createApiKeyPrefix,
  createApiKeySecret,
  formatApiKeyToken,
  hashApiKeySecret,
} from "@vortexnyc/auth/convex";
import { ConvexError, v } from "convex/values";

import { internalQuery, mutation, query } from "../_generated/server";
import { getAuthContext } from "../auth";
import { rotateBetterAuthApiKey } from "../lib/betterAuthApiKeyRotate";
import {
  createBetterAuthApiKey,
  revokeBetterAuthApiKey,
} from "../lib/betterAuthOrganizations";
import {
  getComponentApiKeyByPrefix,
  listComponentApiKeysByOrganization,
  type ComponentResolvedApiKey,
} from "../lib/componentOrgReads";

const SEAL_API_TOKEN_PREFIX = "seal";

const apiScopeValidator = v.union(
  v.literal("seal:documents:read"),
  v.literal("seal:documents:write"),
  v.literal("seal:templates:read"),
  v.literal("seal:templates:write"),
  v.literal("seal:recipients:read"),
  v.literal("seal:recipients:write"),
  v.literal("seal:signatures:read"),
  v.literal("seal:webhooks:manage"),
  v.literal("seal:members:read"),
  v.literal("seal:settings:read"),
  v.literal("seal:settings:write"),
  v.literal("seal:audit:read"),
  v.literal("seal:contacts:read"),
  v.literal("seal:contacts:write")
);

export const createApiKey = mutation({
  args: {
    name: v.string(),
    scopes: v.array(apiScopeValidator),
    allowedIpRanges: v.optional(v.array(v.string())),
    expiresAt: v.optional(v.number()),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ id: string; secret: string; scopes: string[] }> => {
    const auth = await getAuthContext(ctx);
    if (!auth.hasPermission("api:create")) {
      throw new ConvexError("You do not have permission to create API keys");
    }
    const name = args.name.trim();
    if (!name) {
      throw new ConvexError("API key name is required");
    }
    if (args.scopes.length === 0) {
      throw new ConvexError("At least one scope is required");
    }

    const keyPrefix = createApiKeyPrefix({
      tokenPrefix: SEAL_API_TOKEN_PREFIX,
      randomUUID: () => crypto.randomUUID(),
    });
    const secret = createApiKeySecret({
      randomUUID: () => crypto.randomUUID(),
    });
    const token = formatApiKeyToken({ keyPrefix, secret });
    const keyHash = await hashApiKeySecret(secret);

    const id = await createBetterAuthApiKey(ctx, {
      betterAuthOrganizationId: auth.betterAuthOrganizationId,
      betterAuthUserId: auth.betterAuthUserId,
      name,
      keyPrefix,
      keyHash,
      scopes: args.scopes,
      allowedIpRanges: args.allowedIpRanges,
      expiresAt: args.expiresAt,
    });

    // Full token is returned ONCE; only prefix + hash are stored.
    return { id, secret: token, scopes: args.scopes };
  },
});

export const listApiKeys = query({
  args: {},
  handler: async (ctx) => {
    const auth = await getAuthContext(ctx);
    const keys = await listComponentApiKeysByOrganization(
      ctx,
      auth.organization
    );
    return Promise.all(
      keys.map(async (k: ComponentResolvedApiKey) => {
        const creator = await ctx.db.get("users", k.userId);
        return {
          _id: k._id,
          name: k.name,
          keyPrefix: k.keyPrefix,
          scopes: k.scopes,
          allowedIpRanges: k.allowedIpRanges ?? [],
          expiresAt: k.expiresAt,
          status: k.status,
          lastUsedAt: k.lastUsedAt,
          lastUsedIp: k.lastUsedIp,
          createdAt: k.createdAt,
          updatedAt: k.updatedAt,
          createdBy: creator
            ? {
                _id: creator._id,
                name: creator.name ?? undefined,
                email: creator.email,
              }
            : null,
        };
      })
    );
  },
});

/**
 * Internal: resolve a component API key by its key prefix, plus the owner's
 * auth subject (needed by the API auth-context builder). Returns the
 * StoredApiKeyCredential-compatible shape for the package's
 * resolveStoredApiKeyCredential verifier, or null when not found.
 */
export const getApiKeyByPrefix = internalQuery({
  args: { keyPrefix: v.string() },
  handler: async (ctx, args) => {
    const apiKey = await getComponentApiKeyByPrefix(ctx, args.keyPrefix);
    if (apiKey === null) {
      return null;
    }
    const user = await ctx.db.get("users", apiKey.userId);
    return {
      _id: apiKey._id,
      name: apiKey.name,
      keyPrefix: apiKey.keyPrefix,
      keyHash: apiKey.keyHash,
      status: apiKey.status,
      expiresAt: apiKey.expiresAt ?? null,
      scopes: apiKey.scopes,
      organizationId: apiKey.organizationId,
      userId: apiKey.userId,
      authSubject: user?.authSubject ?? "",
    };
  },
});

export const revokeApiKey = mutation({
  args: {
    apiKeyId: v.string(),
  },
  handler: async (ctx, args): Promise<{ success: boolean }> => {
    const auth = await getAuthContext(ctx);
    if (!auth.hasPermission("api:delete")) {
      throw new ConvexError("You do not have permission to revoke API keys");
    }
    // Ensure the key belongs to the caller's organization before revoking.
    const keys = await listComponentApiKeysByOrganization(
      ctx,
      auth.organization
    );
    if (!keys.some((k) => k._id === args.apiKeyId)) {
      throw new ConvexError("API key not found in this organization");
    }
    await revokeBetterAuthApiKey(ctx, {
      apiKeyId: args.apiKeyId,
      betterAuthOrganizationId: auth.betterAuthOrganizationId,
    });
    return { success: true };
  },
});

export const rotateApiKey = mutation({
  args: {
    apiKeyId: v.string(),
  },
  handler: async (
    ctx,
    args
  ): Promise<{ id: string; secret: string; scopes: string[] }> => {
    const auth = await getAuthContext(ctx);
    if (!auth.hasPermission("api:create")) {
      throw new ConvexError("You do not have permission to rotate API keys");
    }
    const keys = await listComponentApiKeysByOrganization(
      ctx,
      auth.organization
    );
    const existing = keys.find((k) => k._id === args.apiKeyId);
    if (!existing) {
      throw new ConvexError("API key not found in this organization");
    }
    if (existing.status === "revoked") {
      throw new ConvexError("Cannot rotate a revoked API key");
    }

    const keyPrefix = createApiKeyPrefix({
      tokenPrefix: SEAL_API_TOKEN_PREFIX,
      randomUUID: () => crypto.randomUUID(),
    });
    const secret = createApiKeySecret({
      randomUUID: () => crypto.randomUUID(),
    });
    const token = formatApiKeyToken({ keyPrefix, secret });
    const keyHash = await hashApiKeySecret(secret);

    await rotateBetterAuthApiKey(ctx, {
      apiKeyId: args.apiKeyId,
      betterAuthOrganizationId: auth.betterAuthOrganizationId,
      keyPrefix,
      keyHash,
    });

    return { id: args.apiKeyId, secret: token, scopes: existing.scopes };
  },
});
