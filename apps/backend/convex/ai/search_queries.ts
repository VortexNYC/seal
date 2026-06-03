/**
 * Exposed search queries and actions for the frontend.
 *
 * fullSearch — filtered hybrid search for command palette (Cmd+K) and API use
 */

import { ConvexError, v } from "convex/values";

import { internal } from "../_generated/api";
import { action, internalQuery } from "../_generated/server";
import type { SearchResult } from "./search";

/**
 * Internal query: resolve a user's active organization and user ID by auth subject.
 * Used by search actions that need auth context without the authAction wrapper.
 */
export const getCurrentUserOrg = internalQuery({
  args: { authSubject: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_auth_subject", (q) => q.eq("authSubject", args.authSubject))
      .first();

    if (!user?.activeOrganizationId) return null;

    return { organizationId: user.activeOrganizationId, userId: user._id };
  },
});

/**
 * Full search with filters. Used by Cmd+K command palette.
 * Supports workflow status and date range filtering.
 */
export const fullSearch = action({
  args: {
    query: v.string(),
    workflowStatus: v.optional(v.string()),
    dateFrom: v.optional(v.number()),
    dateTo: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<SearchResult[]> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Not authenticated");

    if (args.query.trim().length < 2) return [];

    const result = await ctx.runQuery(internal.ai.search_queries.getCurrentUserOrg, {
      authSubject: identity.subject,
    });
    if (!result) return [];

    const startMs = Date.now();
    const results = await ctx.runAction(internal.ai.search.hybridSearchDocuments, {
      organizationId: result.organizationId,
      query: args.query.trim(),
      limit: args.limit ?? 20,
      workflowStatus: args.workflowStatus,
      dateFrom: args.dateFrom,
      dateTo: args.dateTo,
    });
    const durationMs = Date.now() - startMs;

    // Log search usage
    await ctx.runMutation(internal.ai.usage.logAiUsage, {
      organizationId: result.organizationId,
      userId: result.userId,
      action: "search" as const,
      tokensUsed: Math.ceil(args.query.length * 1.5) + results.length * 100,
      durationMs,
      modelUsed: "text-embedding-005",
    });

    return results;
  },
});
