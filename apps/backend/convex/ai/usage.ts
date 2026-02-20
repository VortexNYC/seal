/**
 * AI usage tracking — logs every AI action and maintains aggregate counters.
 *
 * Call `logAiUsage` from any AI action/mutation to record usage.
 * Query aggregates via `getOrgUsageSummary` for dashboards.
 */

import { TableAggregate } from "@convex-dev/aggregate";
import { v } from "convex/values";

import { components } from "../_generated/api";
import type { DataModel } from "../_generated/dataModel";
import { internalMutation, internalQuery } from "../_generated/server";

/**
 * Aggregate: count + sum tokens per org, keyed by createdAt for time-range queries.
 * Namespace by organizationId for write throughput isolation.
 */
export const aiUsageAggregate = new TableAggregate<{
  Namespace: string;
  Key: number;
  DataModel: DataModel;
  TableName: "ai_usage_log";
}>(components.aiUsageAggregate, {
  namespace: (doc) => doc.organizationId,
  sortKey: (doc) => doc.createdAt,
  sumValue: (doc) => doc.tokensUsed,
});

/** Estimated cost per 1M tokens by model (input + output blended average). */
const MODEL_COST_PER_MILLION: Record<string, number> = {
  "gemini-2.0-flash": 0.1,
  "gemini-3-flash": 0.1,
  "gemini-3-pro": 1.25,
};

function estimateCost(tokensUsed: number, modelUsed: string): number {
  const costPerMillion = MODEL_COST_PER_MILLION[modelUsed] ?? 0.1;
  return (tokensUsed / 1_000_000) * costPerMillion;
}

/**
 * Log an AI usage event. Call from any AI action after completion.
 */
export const logAiUsage = internalMutation({
  args: {
    organizationId: v.id("organizations"),
    userId: v.id("users"),
    action: v.union(
      v.literal("field_analysis"),
      v.literal("payment_extraction"),
      v.literal("redlining"),
      v.literal("search"),
      v.literal("chat"),
    ),
    tokensUsed: v.number(),
    durationMs: v.number(),
    documentId: v.optional(v.id("documents")),
    modelUsed: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const estimatedCostUsd = estimateCost(args.tokensUsed, args.modelUsed);

    const id = await ctx.db.insert("ai_usage_log", {
      ...args,
      estimatedCostUsd,
      createdAt: now,
    });

    // Keep aggregate in sync
    const doc = await ctx.db.get(id);
    if (doc) {
      await aiUsageAggregate.insert(ctx, doc);
    }
  },
});

/**
 * Get usage summary for an org in a time range.
 * Returns total calls and total tokens.
 */
export const getOrgUsageSummary = internalQuery({
  args: {
    organizationId: v.id("organizations"),
    from: v.number(),
    to: v.number(),
  },
  handler: async (ctx, args) => {
    const bounds = {
      lower: { key: args.from, inclusive: true },
      upper: { key: args.to, inclusive: true },
    };

    const totalCalls = await aiUsageAggregate.count(ctx, {
      namespace: args.organizationId,
      bounds,
    });
    const totalTokens = await aiUsageAggregate.sum(ctx, {
      namespace: args.organizationId,
      bounds,
    });

    return { totalCalls, totalTokens };
  },
});
