import { describe, expect, test } from "vitest";

import { ApiError } from "../errors";
import { buildRateLimitHeaders, DEFAULT_RATE_LIMITS, throwRateLimitExceeded } from "../rate_limit";
import type { RateLimitResult } from "../rate_limit";

describe("DEFAULT_RATE_LIMITS", () => {
  test("has 60 requests per minute", () => {
    expect(DEFAULT_RATE_LIMITS.requestsPerMinute).toBe(60);
  });

  test("has 1000 requests per hour", () => {
    expect(DEFAULT_RATE_LIMITS.requestsPerHour).toBe(1000);
  });
});

describe("buildRateLimitHeaders", () => {
  test("sets X-RateLimit-Limit to 60", () => {
    const result: RateLimitResult = {
      allowed: true,
      remainingMinute: 50,
      remainingHour: 900,
      resetMinute: 1700000100,
      resetHour: 1700003600,
    };

    const headers = buildRateLimitHeaders(result);

    expect(headers.get("X-RateLimit-Limit")).toBe("60");
  });

  test("uses minute remaining when minute is more restrictive", () => {
    const result: RateLimitResult = {
      allowed: true,
      remainingMinute: 5,
      remainingHour: 900,
      resetMinute: 1700000100,
      resetHour: 1700003600,
    };

    const headers = buildRateLimitHeaders(result);

    expect(headers.get("X-RateLimit-Remaining")).toBe("5");
    expect(headers.get("X-RateLimit-Reset")).toBe("1700000100");
  });

  test("uses hour remaining when hour is more restrictive", () => {
    const result: RateLimitResult = {
      allowed: true,
      remainingMinute: 50,
      remainingHour: 10,
      resetMinute: 1700000100,
      resetHour: 1700003600,
    };

    const headers = buildRateLimitHeaders(result);

    expect(headers.get("X-RateLimit-Remaining")).toBe("10");
    expect(headers.get("X-RateLimit-Reset")).toBe("1700003600");
  });

  test("sets detailed minute and hour headers", () => {
    const result: RateLimitResult = {
      allowed: true,
      remainingMinute: 30,
      remainingHour: 800,
      resetMinute: 1700000100,
      resetHour: 1700003600,
    };

    const headers = buildRateLimitHeaders(result);

    expect(headers.get("X-RateLimit-Limit-Minute")).toBe("60");
    expect(headers.get("X-RateLimit-Remaining-Minute")).toBe("30");
    expect(headers.get("X-RateLimit-Limit-Hour")).toBe("1000");
    expect(headers.get("X-RateLimit-Remaining-Hour")).toBe("800");
  });
});

describe("throwRateLimitExceeded", () => {
  test("throws ApiError with status 429", () => {
    const result: RateLimitResult = {
      allowed: false,
      remainingMinute: 0,
      remainingHour: 500,
      resetMinute: 1700000100,
      resetHour: 1700003600,
      exceededLimit: "minute",
    };

    try {
      throwRateLimitExceeded(result);
      expect.fail("Should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as ApiError).status).toBe(429);
    }
  });

  test("message mentions per-minute when exceededLimit is minute", () => {
    const result: RateLimitResult = {
      allowed: false,
      remainingMinute: 0,
      remainingHour: 500,
      resetMinute: 1700000100,
      resetHour: 1700003600,
      exceededLimit: "minute",
    };

    try {
      throwRateLimitExceeded(result);
      expect.fail("Should have thrown");
    } catch (e) {
      expect((e as ApiError).message).toContain("per-minute");
    }
  });

  test("message mentions per-hour when exceededLimit is hour", () => {
    const result: RateLimitResult = {
      allowed: false,
      remainingMinute: 10,
      remainingHour: 0,
      resetMinute: 1700000100,
      resetHour: 1700003600,
      exceededLimit: "hour",
    };

    try {
      throwRateLimitExceeded(result);
      expect.fail("Should have thrown");
    } catch (e) {
      expect((e as ApiError).message).toContain("per-hour");
    }
  });
});
