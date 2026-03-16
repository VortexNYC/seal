import { createClerkClient } from "@clerk/backend";
import { ConvexError, v } from "convex/values";

import { internal } from "../_generated/api";
import { action } from "../_generated/server";

function getClerkClient() {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    throw new ConvexError("CLERK_SECRET_KEY not configured");
  }
  return createClerkClient({ secretKey });
}

type ClerkApiKey = {
  id: string;
  name: string;
  secret: string;
  createdAt: number;
  lastUsedAt?: number;
  scopes?: string[];
  revoked: boolean;
};

const clerkApiScopeValidator = v.union(
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
  v.literal("seal:contacts:write"),
);

export const createClerkApiKey = action({
  args: {
    name: v.string(),
    scopes: v.array(clerkApiScopeValidator),
  },
  handler: async (ctx, args): Promise<{ id: string; secret: string }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required");
    }

    if (!args.name.trim()) {
      throw new ConvexError("API key name is required");
    }

    if (args.scopes.length === 0) {
      throw new ConvexError("At least one scope is required");
    }

    const user = await ctx.runQuery(internal.organizations.helpers.getUserByClerkId, {
      clerkId: identity.subject,
    });

    if (!user) {
      throw new ConvexError("User not found");
    }

    if (!user.activeOrganizationId) {
      throw new ConvexError("No active organization");
    }

    const organization = await ctx.runQuery(internal.organizations.helpers.getOrganizationById, {
      organizationId: user.activeOrganizationId,
    });

    if (!organization?.clerkId) {
      throw new ConvexError("Organization not synced with Clerk");
    }

    // Check Pro plan requirement for API access
    const { isPro } = await ctx.runQuery(internal.auth.subscription_helpers.checkProFeature, {
      organizationId: user.activeOrganizationId,
    });
    if (!isPro) {
      throw new ConvexError("API access requires a Pro plan. Please upgrade to continue.");
    }

    try {
      const clerk = getClerkClient();

      const apiKeysApi = clerk.apiKeys as unknown as {
        create: (params: {
          name: string;
          subject: string;
          scopes?: string[];
          claims?: Record<string, unknown>;
        }) => Promise<ClerkApiKey>;
      };

      const apiKey = await apiKeysApi.create({
        name: args.name.trim(),
        subject: organization.clerkId,
        scopes: args.scopes,
        claims: {
          creator_user_id: identity.subject,
        },
      });

      return {
        id: apiKey.id,
        secret: apiKey.secret,
      };
    } catch (error) {
      console.error("[createClerkApiKey] Error:", error);
      throw new ConvexError(error instanceof Error ? error.message : "Failed to create API key");
    }
  },
});

export const listClerkApiKeys = action({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required");
    }

    const user = await ctx.runQuery(internal.organizations.helpers.getUserByClerkId, {
      clerkId: identity.subject,
    });

    if (!user?.activeOrganizationId) {
      return [];
    }

    const organization = await ctx.runQuery(internal.organizations.helpers.getOrganizationById, {
      organizationId: user.activeOrganizationId,
    });

    if (!organization?.clerkId) {
      return [];
    }

    try {
      const secretKey = process.env.CLERK_SECRET_KEY;
      if (!secretKey) {
        return [];
      }

      type ApiKeyData = {
        id: string;
        name: string;
        created_at: number;
        last_used_at?: number;
        scopes?: string[];
        revoked: boolean;
      };

      const response = await fetch(
        `https://api.clerk.com/v1/api_keys?subject=${encodeURIComponent(organization.clerkId)}`,
        {
          headers: {
            Authorization: `Bearer ${secretKey}`,
            "Content-Type": "application/json",
          },
        },
      );

      if (!response.ok) {
        console.error("[listClerkApiKeys] API error:", response.status, await response.text());
        return [];
      }

      const data = (await response.json()) as { data: ApiKeyData[] };

      return data.data.map((key) => ({
        id: key.id,
        name: key.name,
        createdAt: key.created_at,
        lastUsedAt: key.last_used_at,
        scopes: key.scopes ?? [],
        revoked: key.revoked,
      }));
    } catch (error) {
      console.error("[listClerkApiKeys] Error:", error);
      return [];
    }
  },
});

export const revokeClerkApiKey = action({
  args: {
    apiKeyId: v.string(),
  },
  handler: async (ctx, args): Promise<{ success: boolean }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new ConvexError("Authentication required");
    }

    try {
      const secretKey = process.env.CLERK_SECRET_KEY;
      if (!secretKey) {
        throw new ConvexError("CLERK_SECRET_KEY not configured");
      }

      const response = await fetch(`https://api.clerk.com/v1/api_keys/${args.apiKeyId}/revoke`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${secretKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        const body = await response.text();
        console.error("[revokeClerkApiKey] API error:", response.status, body);
        throw new ConvexError(`Failed to revoke API key: ${response.status}`);
      }

      return { success: true };
    } catch (error) {
      console.error("[revokeClerkApiKey] Error:", error);
      throw new ConvexError(error instanceof Error ? error.message : "Failed to revoke API key");
    }
  },
});
