/**
 * @fileoverview Feedback API for the public API.
 * CRUD operations for workspace feedback entries.
 *
 * @module api/v1/feedback
 */
import { v } from "convex/values";

import { internalMutation, internalQuery } from "../../_generated/server";
import { feedbackTypeTuple } from "../../schemas/feedback";

/** API representation of a feedback entry */
export interface ApiFeedback {
  /** Feedback record ID */
  id: string;
  /** Feedback type */
  type: "bug" | "suggestion";
  /** Feedback message */
  message: string;
  /** Route where feedback was submitted */
  route?: string;
  /** User ID who submitted this feedback */
  created_by: string;
  /** ISO 8601 creation timestamp */
  created_at: string;
}

function mapFeedbackToApi(feedback: {
  _id: string;
  userId: string;
  organizationId: string;
  type: "bug" | "suggestion";
  message: string;
  route?: string;
  createdAt: number;
}): ApiFeedback {
  return {
    id: feedback._id,
    type: feedback.type,
    message: feedback.message,
    route: feedback.route,
    created_by: feedback.userId,
    created_at: new Date(feedback.createdAt).toISOString(),
  };
}

/**
 * Internal query to list feedback entries in the workspace.
 *
 * @internal
 */
export const listFeedback = internalQuery({
  args: {
    userId: v.id("users"),
    organizationId: v.id("organizations"),
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
    type: v.optional(feedbackTypeTuple),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ feedback: ApiFeedback[]; has_more: boolean; next_cursor?: string }> => {
    const limit = Math.min(args.limit ?? 20, 100);

    let raw;
    if (args.type) {
      raw = await ctx.db
        .query("feedback")
        .withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId))
        .filter((q) => q.eq(q.field("type"), args.type!))
        .collect();
    } else {
      raw = await ctx.db
        .query("feedback")
        .withIndex("by_organization", (q) => q.eq("organizationId", args.organizationId))
        .collect();
    }

    // Cursor pagination
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
      feedback: items.map(mapFeedbackToApi),
      has_more,
      next_cursor,
    };
  },
});

/**
 * Internal query to get a single feedback entry by ID.
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
    const doc = await ctx.db.get(args.feedbackId);
    if (!doc || doc.organizationId !== args.organizationId) return null;
    return mapFeedbackToApi(doc);
  },
});

/**
 * Internal mutation to create a new feedback entry.
 *
 * @internal
 */
export const createFeedback = internalMutation({
  args: {
    userId: v.id("users"),
    organizationId: v.id("organizations"),
    type: feedbackTypeTuple,
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

/**
 * Internal mutation to update an existing feedback entry.
 *
 * @internal
 */
export const updateFeedback = internalMutation({
  args: {
    userId: v.id("users"),
    organizationId: v.id("organizations"),
    feedbackId: v.id("feedback"),
    type: v.optional(feedbackTypeTuple),
    message: v.optional(v.string()),
    route: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ success: boolean; error?: string }> => {
    const feedback = await ctx.db.get(args.feedbackId);
    if (!feedback || feedback.organizationId !== args.organizationId) {
      return { success: false, error: "Feedback not found" };
    }

    const patch: Record<string, unknown> = {};
    if (args.type !== undefined) patch.type = args.type;
    if (args.message !== undefined) patch.message = args.message;
    if (args.route !== undefined) patch.route = args.route;

    await ctx.db.patch(args.feedbackId, patch);
    return { success: true };
  },
});

/**
 * Internal mutation to delete a feedback entry.
 *
 * @internal
 */
export const deleteFeedback = internalMutation({
  args: {
    userId: v.id("users"),
    organizationId: v.id("organizations"),
    feedbackId: v.id("feedback"),
  },
  handler: async (ctx, args): Promise<{ success: boolean }> => {
    const feedback = await ctx.db.get(args.feedbackId);
    if (!feedback || feedback.organizationId !== args.organizationId) {
      throw new Error("Feedback not found");
    }

    await ctx.db.delete(args.feedbackId);
    return { success: true };
  },
});
