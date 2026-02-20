/**
 * Exposed search queries and actions for the frontend.
 *
 * quickSearch — lightweight hybrid search for command palette (Cmd+K)
 * fullSearch — filtered search for the dedicated search page
 */

import { ConvexError, v } from "convex/values";

import { internal } from "../_generated/api";
import { action, internalQuery } from "../_generated/server";
import type { SearchResult } from "./search";

/**
 * Internal query: resolve a Clerk user's active organization.
 * Used by search actions that need auth context without the authAction wrapper.
 */
export const getCurrentUserOrg = internalQuery({
  args: { clerkUserId: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkUserId))
      .first();

    if (!user?.activeOrganizationId) return null;

    return { organizationId: user.activeOrganizationId };
  },
});

/**
 * Quick search for command palette (Cmd+K).
 * Returns top 5 results without going through the agent.
 * Optimized for low latency — no agent, no streaming, just ranked results.
 */
export const quickSearch = action({
  args: {
    query: v.string(),
  },
  handler: async (ctx, args): Promise<SearchResult[]> => {
    // Manual auth check (no authAction wrapper available)
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new ConvexError("Not authenticated");

    if (args.query.trim().length < 2) return [];

    // Look up the user's organization
    const result = await ctx.runQuery(internal.ai.search_queries.getCurrentUserOrg, {
      clerkUserId: identity.subject,
    });
    if (!result) return [];

    return ctx.runAction(internal.ai.search.hybridSearchDocuments, {
      organizationId: result.organizationId,
      query: args.query.trim(),
      limit: 5,
    });
  },
});

/**
 * Full search with filters for the dedicated search page.
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
      clerkUserId: identity.subject,
    });
    if (!result) return [];

    return ctx.runAction(internal.ai.search.hybridSearchDocuments, {
      organizationId: result.organizationId,
      query: args.query.trim(),
      limit: args.limit ?? 20,
      workflowStatus: args.workflowStatus,
      dateFrom: args.dateFrom,
      dateTo: args.dateTo,
    });
  },
});
