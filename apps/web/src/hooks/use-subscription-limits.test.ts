import { renderHook } from "@testing-library/react";
import { vi, describe, test, expect, beforeEach } from "vitest";

const mockUseQuery = vi.fn();
vi.mock("convex/react", () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
}));

import { useSubscriptionLimits } from "./use-subscription-limits";

describe("useSubscriptionLimits", () => {
  beforeEach(() => {
    mockUseQuery.mockReset();
  });

  test("returns isLoading: true when query returns undefined", () => {
    mockUseQuery.mockReturnValue(undefined);

    const { result } = renderHook(() => useSubscriptionLimits());

    expect(result.current.isLoading).toBe(true);
  });

  test('returns tier: "free" and isPro: false when no subscription', () => {
    mockUseQuery.mockReturnValue(null);

    const { result } = renderHook(() => useSubscriptionLimits());

    expect(result.current.isLoading).toBe(false);
    expect(result.current.tier).toBe("free");
    expect(result.current.isPro).toBe(false);
    expect(result.current.isEnterprise).toBe(false);
  });

  test("returns isPro: true when status is active and tier is pro", () => {
    mockUseQuery.mockReturnValue({ status: "active", tier: "pro" });

    const { result } = renderHook(() => useSubscriptionLimits());

    expect(result.current.isPro).toBe(true);
    expect(result.current.isEnterprise).toBe(false);
    expect(result.current.tier).toBe("pro");
    expect(result.current.isLoading).toBe(false);
  });

  test("returns isPro: true and isEnterprise: true for enterprise tier", () => {
    mockUseQuery.mockReturnValue({ status: "active", tier: "enterprise" });

    const { result } = renderHook(() => useSubscriptionLimits());

    expect(result.current.isPro).toBe(true);
    expect(result.current.isEnterprise).toBe(true);
    expect(result.current.tier).toBe("enterprise");
  });

  test("returns isPro: true for trialing subscription", () => {
    mockUseQuery.mockReturnValue({ status: "trialing", tier: "pro" });

    const { result } = renderHook(() => useSubscriptionLimits());

    expect(result.current.isPro).toBe(true);
  });

  test("returns isPro: false when status is active but tier is free", () => {
    mockUseQuery.mockReturnValue({ status: "active", tier: "free" });

    const { result } = renderHook(() => useSubscriptionLimits());

    expect(result.current.isPro).toBe(false);
    expect(result.current.tier).toBe("free");
  });

  test("returns isPro: false when tier is pro but status is not active", () => {
    mockUseQuery.mockReturnValue({ status: "canceled", tier: "pro" });

    const { result } = renderHook(() => useSubscriptionLimits());

    expect(result.current.isPro).toBe(false);
    expect(result.current.tier).toBe("pro");
  });

  test("free tier feature flags are all false", () => {
    mockUseQuery.mockReturnValue(null);

    const { result } = renderHook(() => useSubscriptionLimits());

    expect(result.current.canCreateTemplates).toBe(false);
    expect(result.current.canBrand).toBe(false);
    expect(result.current.canUseAPI).toBe(false);
    expect(result.current.canUseWebhooks).toBe(false);
    expect(result.current.canUseSSO).toBe(false);
    expect(result.current.maxSeats).toBe(1);
  });

  test("pro tier enables templates, branding, api, webhooks but not SSO", () => {
    mockUseQuery.mockReturnValue({ status: "active", tier: "pro" });

    const { result } = renderHook(() => useSubscriptionLimits());

    expect(result.current.canCreateTemplates).toBe(true);
    expect(result.current.canBrand).toBe(true);
    expect(result.current.canUseAPI).toBe(true);
    expect(result.current.canUseWebhooks).toBe(true);
    expect(result.current.canUseSSO).toBe(false);
    expect(result.current.maxSeats).toBe(20);
  });

  test("enterprise tier enables everything including SSO", () => {
    mockUseQuery.mockReturnValue({ status: "active", tier: "enterprise" });

    const { result } = renderHook(() => useSubscriptionLimits());

    expect(result.current.canCreateTemplates).toBe(true);
    expect(result.current.canBrand).toBe(true);
    expect(result.current.canUseAPI).toBe(true);
    expect(result.current.canUseWebhooks).toBe(true);
    expect(result.current.canUseSSO).toBe(true);
    expect(result.current.maxSeats).toBe(Infinity);
  });
});
