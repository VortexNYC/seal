import { HOUR, MINUTE, RateLimiter } from "@convex-dev/rate-limiter";
import type { GenericActionCtx } from "convex/server";

import { components } from "../_generated/api";
import type { DataModel } from "../_generated/dataModel";
import { ApiError } from "./errors";

export const apiRateLimiter = new RateLimiter(components.rateLimiter, {
  apiPerMinute: { kind: "fixed window", rate: 60, period: MINUTE },
  apiPerHour: { kind: "fixed window", rate: 1000, period: HOUR },
});

export const DEFAULT_RATE_LIMITS = {
  requestsPerMinute: 60,
  requestsPerHour: 1000,
} as const;

export interface RateLimitConfig {
  requestsPerMinute: number;
  requestsPerHour: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remainingMinute: number;
  remainingHour: number;
  resetMinute: number;
  resetHour: number;
  exceededLimit?: "minute" | "hour";
}

export async function checkApiRateLimit(
  ctx: GenericActionCtx<DataModel>,
  key: string,
  _config?: Partial<RateLimitConfig>,
): Promise<RateLimitResult> {
  const now = Date.now();

  const minuteResult = await apiRateLimiter.limit(ctx, "apiPerMinute", {
    key,
    throws: false,
  });

  if (!minuteResult.ok) {
    const retryAfterSec = Math.ceil((minuteResult.retryAfter ?? 0) / 1000);
    return {
      allowed: false,
      remainingMinute: 0,
      remainingHour: DEFAULT_RATE_LIMITS.requestsPerHour,
      resetMinute: Math.floor(now / 1000) + retryAfterSec,
      resetHour: Math.floor(now / 1000) + Math.ceil(HOUR / 1000),
      exceededLimit: "minute",
    };
  }

  const hourResult = await apiRateLimiter.limit(ctx, "apiPerHour", {
    key,
    throws: false,
  });

  if (!hourResult.ok) {
    const retryAfterSec = Math.ceil((hourResult.retryAfter ?? 0) / 1000);
    return {
      allowed: false,
      remainingMinute: DEFAULT_RATE_LIMITS.requestsPerMinute - 1,
      remainingHour: 0,
      resetMinute: Math.floor(now / 1000) + Math.ceil(MINUTE / 1000),
      resetHour: Math.floor(now / 1000) + retryAfterSec,
      exceededLimit: "hour",
    };
  }

  return {
    allowed: true,
    remainingMinute: DEFAULT_RATE_LIMITS.requestsPerMinute - 1,
    remainingHour: DEFAULT_RATE_LIMITS.requestsPerHour - 1,
    resetMinute: Math.floor(now / 1000) + Math.ceil(MINUTE / 1000),
    resetHour: Math.floor(now / 1000) + Math.ceil(HOUR / 1000),
  };
}

export function buildRateLimitHeaders(result: RateLimitResult): Headers {
  const headers = new Headers();

  const remaining = Math.min(result.remainingMinute, result.remainingHour);
  const reset =
    result.remainingMinute < result.remainingHour ? result.resetMinute : result.resetHour;

  headers.set("X-RateLimit-Limit", String(DEFAULT_RATE_LIMITS.requestsPerMinute));
  headers.set("X-RateLimit-Remaining", String(remaining));
  headers.set("X-RateLimit-Reset", String(reset));

  headers.set("X-RateLimit-Limit-Minute", String(DEFAULT_RATE_LIMITS.requestsPerMinute));
  headers.set("X-RateLimit-Remaining-Minute", String(result.remainingMinute));
  headers.set("X-RateLimit-Limit-Hour", String(DEFAULT_RATE_LIMITS.requestsPerHour));
  headers.set("X-RateLimit-Remaining-Hour", String(result.remainingHour));

  return headers;
}

export function throwRateLimitExceeded(result: RateLimitResult): never {
  const retryAfter =
    result.exceededLimit === "minute"
      ? result.resetMinute - Math.floor(Date.now() / 1000)
      : result.resetHour - Math.floor(Date.now() / 1000);

  const limitType = result.exceededLimit === "minute" ? "per-minute" : "per-hour";

  throw new ApiError(
    429,
    `Rate limit exceeded (${limitType}). Try again in ${retryAfter} seconds.`,
    "RATE_LIMIT_EXCEEDED",
  );
}
