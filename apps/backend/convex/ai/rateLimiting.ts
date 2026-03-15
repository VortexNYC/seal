/**
 * AI Rate Limiting
 *
 * Prevents abuse and controls costs for AI chat.
 * Uses @convex-dev/rate-limiter component (same pattern as Plasma).
 *
 * Limits:
 * - sendMessage: 1 msg / 3s per user (burst of 3) — anti-spam
 * - orgSendMessage: 100 msgs / min per org — prevents one org from burning global quota
 * - expensiveOperation: 20 ops / min per org — field analysis + payment extraction are costly
 * - globalSendMessage: 500 msgs / min globally — system protection
 */

import { MINUTE, RateLimiter, SECOND } from "@convex-dev/rate-limiter";
import { v } from "convex/values";

import { components } from "../_generated/api";
import { internalMutation } from "../_generated/server";

export const aiRateLimiter = new RateLimiter(components.rateLimiter, {
  // Per-user message rate limiting (anti-spam)
  sendMessage: {
    kind: "fixed window",
    period: 3 * SECOND,
    rate: 1,
    capacity: 3,
  },

  // Per-org message limit — prevents one org from burning global quota
  orgSendMessage: {
    kind: "token bucket",
    period: MINUTE,
    rate: 100,
  },

  // Per-org expensive operation limit — field analysis + payment extraction
  expensiveOperation: {
    kind: "token bucket",
    period: MINUTE,
    rate: 20,
  },

  // Global message limit — protects overall API costs
  globalSendMessage: {
    kind: "token bucket",
    period: MINUTE,
    rate: 500,
  },
});

// ---------------------------------------------------------------------------
// Internal mutation for checking expensive op limit from action context.
// Tool handlers run inside actions (generateText/streamText), so they can't
// call aiRateLimiter.limit() directly — they need a mutation trampoline.
// ---------------------------------------------------------------------------

export const checkExpensiveOperationLimit = internalMutation({
  args: { organizationId: v.string() },
  handler: async (ctx, args) => {
    await aiRateLimiter.limit(ctx, "expensiveOperation", {
      key: args.organizationId,
      throws: true,
    });
  },
});
