/**
 * @fileoverview User feedback management for the public API.
 * Submit and list in-app feedback (bug reports, suggestions).
 *
 * @module api/v1/feedback
 * @requires seal:feedback:write for POST, seal:feedback:read for GET
 */
import { v } from "convex/values";

import { internalMutation, internalQuery } from "../../_generated/server";

/** API representation of feedback */
export interface ApiFeedback {
  id: string;
  type: "bug" | "suggestion";
  message: string;
  route?: string;
  created_at: string;
}

/**
 * Internal query to list feedback items in the workspace.
 *
 * @internal
 */
export const listFeedback = internalQuery({
  args: {
    userId: v.id("users"),
    organizationId: v.id("organizations"),
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ items: ApiFeedback[]; has_more: boolean; next_cursor?: string }> => {
    const limit = Math.min(args.limit ?? 20, 100);

    const raw = await ctx.db
      .query("feedback")
      .withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId))
      .order("desc")
      .collect();

    let start = 0;
    if (args.cursor) {
      const idx = raw.findIndex((f) => f._id === args.cursor);
      if (idx !== -1) start = idx + 1;
    }

    const page = raw.slice(start, start + limit + 1);
    const has_more = page.length > limit;
    const items = has_more ? page.slice(0, limit) : page;
    const next_cursor = has_more ? items[items.length - 1]?._id : undefined;

    return {
      items: items.map((f) => ({
        id: f._id,
        type: f.type,
        message: f.message,
        route: f.route,
        created_at: new Date(f.createdAt).toISOString(),
      })),
      has_more,
      next_cursor,
    };
  },
});

/**
 * Internal query to get a single feedback item by ID.
 *
 * @internal
 */
export const getFeedback = internalQuery({
  args: {
    userId: v.id("users"),
    organizationId: v.id("organizations"),
    feedbackId: v.id("feedback"),
  },
  handler: async (ctx, args): Promise<ApiFeedback | null> => {
    const f = await ctx.db.get(args.feedbackId);
    if (!f || f.organizationId !== args.organizationId) return null;

    return {
      id: f._id,
      type: f.type,
      message: f.message,
      route: f.route,
      created_at: new Date(f.createdAt).toISOString(),
    };
  },
});

/**
 * Internal mutation to submit feedback.
 *
 * @internal
 */
export const submitFeedback = internalMutation({
  args: {
    userId: v.id("users"),
    organizationId: v.id("organizations"),
    type: v.union(v.literal("bug"), v.literal("suggestion")),
    message: v.string(),
    route: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ id: string }> => {
    const feedbackId = await ctx.db.insert("feedback", {
      userId: args.userId,
      organizationId: args.organizationId,
      type: args.type,
      message: args.message,
      route: args.route,
      createdAt: Date.now(),
    });
    return { id: feedbackId };
  },
});
