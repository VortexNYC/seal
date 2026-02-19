import { v } from "convex/values";

import { internalMutation } from "../_generated/server";
import { authQuery } from "../auth/wrappers";

export const start = internalMutation({
  args: {
    threadId: v.string(),
    totalSteps: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    // Upsert: if progress exists for this thread, reset it
    const existing = await ctx.db
      .query("ai_progress")
      .withIndex("by_thread_id", (q) => q.eq("threadId", args.threadId))
      .first();

    const now = Date.now();

    if (existing) {
      await ctx.db.patch(existing._id, {
        step: 0,
        totalSteps: args.totalSteps,
        completedTools: [],
        tokensUsed: 0,
        status: "in_progress",
        error: undefined,
        startedAt: now,
        updatedAt: now,
        completedAt: undefined,
      });
      return existing._id;
    }

    return await ctx.db.insert("ai_progress", {
      threadId: args.threadId,
      step: 0,
      totalSteps: args.totalSteps,
      completedTools: [],
      tokensUsed: 0,
      status: "in_progress",
      startedAt: now,
      updatedAt: now,
    });
  },
});

export const update = internalMutation({
  args: {
    threadId: v.string(),
    step: v.number(),
    completedTools: v.array(v.string()),
    tokensUsed: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("ai_progress")
      .withIndex("by_thread_id", (q) => q.eq("threadId", args.threadId))
      .first();

    if (!existing) return;

    await ctx.db.patch(existing._id, {
      step: args.step,
      completedTools: args.completedTools,
      tokensUsed: args.tokensUsed,
      updatedAt: Date.now(),
    });
  },
});

export const complete = internalMutation({
  args: {
    threadId: v.string(),
    totalTokens: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("ai_progress")
      .withIndex("by_thread_id", (q) => q.eq("threadId", args.threadId))
      .first();

    if (!existing) return;

    const now = Date.now();
    await ctx.db.patch(existing._id, {
      status: "completed",
      tokensUsed: args.totalTokens,
      updatedAt: now,
      completedAt: now,
    });
  },
});

export const abort = internalMutation({
  args: {
    threadId: v.string(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("ai_progress")
      .withIndex("by_thread_id", (q) => q.eq("threadId", args.threadId))
      .first();

    if (!existing) return;

    const now = Date.now();
    await ctx.db.patch(existing._id, {
      status: "aborted",
      error: args.reason,
      updatedAt: now,
      completedAt: now,
    });
  },
});

export const fail = internalMutation({
  args: {
    threadId: v.string(),
    error: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("ai_progress")
      .withIndex("by_thread_id", (q) => q.eq("threadId", args.threadId))
      .first();

    if (!existing) return;

    const now = Date.now();
    await ctx.db.patch(existing._id, {
      status: "failed",
      error: args.error,
      updatedAt: now,
      completedAt: now,
    });
  },
});

export const get = authQuery({
  args: { threadId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("ai_progress")
      .withIndex("by_thread_id", (q) => q.eq("threadId", args.threadId))
      .first();
  },
});
