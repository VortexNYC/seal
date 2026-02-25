/**
 * AI Rate Limiting
 *
 * Prevents abuse and controls costs for AI chat.
 * Uses @convex-dev/rate-limiter component (same pattern as Plasma).
 *
 * Limits:
 * - sendMessage: 1 msg / 3s per user (burst of 3) — anti-spam
 * - globalSendMessage: 500 msgs / min globally — system protection
 */

import { MINUTE, RateLimiter, SECOND } from "@convex-dev/rate-limiter";

import { components } from "../_generated/api";

export const aiRateLimiter = new RateLimiter(components.rateLimiter, {
  // Per-user message rate limiting (anti-spam)
  sendMessage: {
    kind: "fixed window",
    period: 3 * SECOND,
    rate: 1,
    capacity: 3,
  },

  // Global message limit — protects overall API costs
  globalSendMessage: {
    kind: "token bucket",
    period: MINUTE,
    rate: 500,
  },
});
