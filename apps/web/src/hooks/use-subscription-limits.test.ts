import { renderHook } from "@testing-library/react";
import { vi, describe, test, expect, beforeEach } from "vitest";

const mockUseQuery = vi.fn();
vi.mock("@tanstack/react-query", () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
}));

import { useSubscriptionLimits } from "./use-subscription-limits";

describe("useSubscriptionLimits", () => {
  beforeEach(() => {
    mockUseQuery.mockReset();
  });

  test("returns isLoading: true while loading", () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: true });

    const { result } = renderHook(() => useSubscriptionLimits());

    expect(result.current.isLoading).toBe(true);
  });

  test('returns tier: "free" and isPro: false when no subscription', () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: false });

    const { result } = renderHook(() => useSubscriptionLimits());

    expect(result.current.isLoading).toBe(false);
    expect(result.current.tier).toBe("free");
    expect(result.current.isPro).toBe(false);
    expect(result.current.isEnterprise).toBe(false);
  });

  test("returns isPro: true when plan is pro", () => {
    mockUseQuery.mockReturnValue({ data: { plan: "pro" }, isLoading: false });

    const { result } = renderHook(() => useSubscriptionLimits());

    expect(result.current.isPro).toBe(true);
    expect(result.current.isEnterprise).toBe(false);
    expect(result.current.tier).toBe("pro");
    expect(result.current.isLoading).toBe(false);
  });

  test("returns isPro: true and isEnterprise: true for enterprise plan", () => {
    mockUseQuery.mockReturnValue({
      data: { plan: "enterprise" },
      isLoading: false,
    });

    const { result } = renderHook(() => useSubscriptionLimits());

    expect(result.current.isPro).toBe(true);
    expect(result.current.isEnterprise).toBe(true);
    expect(result.current.tier).toBe("enterprise");
  });

  test('returns isPro: true for any "pro" plan string', () => {
    mockUseQuery.mockReturnValue({ data: { plan: "pro" }, isLoading: false });

    const { result } = renderHook(() => useSubscriptionLimits());

    expect(result.current.isPro).toBe(true);
  });

  test("returns isPro: false when plan is free", () => {
    mockUseQuery.mockReturnValue({ data: { plan: "free" }, isLoading: false });

    const { result } = renderHook(() => useSubscriptionLimits());

    expect(result.current.isPro).toBe(false);
    expect(result.current.tier).toBe("free");
  });

  test("free tier includes api and webhooks per public pricing", () => {
    mockUseQuery.mockReturnValue({ data: { plan: "free" }, isLoading: false });

    const { result } = renderHook(() => useSubscriptionLimits());

    expect(result.current.canCreateTemplates).toBe(false);
    expect(result.current.canBrand).toBe(false);
    expect(result.current.canUseAPI).toBe(true);
    expect(result.current.canUseWebhooks).toBe(true);
    expect(result.current.canUseSSO).toBe(false);
    expect(result.current.maxSeats).toBe(1);
  });

  test("pro tier enables templates, branding, api, webhooks but not SSO", () => {
    mockUseQuery.mockReturnValue({ data: { plan: "pro" }, isLoading: false });

    const { result } = renderHook(() => useSubscriptionLimits());

    expect(result.current.canCreateTemplates).toBe(true);
    expect(result.current.canBrand).toBe(true);
    expect(result.current.canUseAPI).toBe(true);
    expect(result.current.canUseWebhooks).toBe(true);
    expect(result.current.canUseSSO).toBe(false);
    expect(result.current.maxSeats).toBe(20);
  });

  test("enterprise tier enables everything including SSO", () => {
    mockUseQuery.mockReturnValue({
      data: { plan: "enterprise" },
      isLoading: false,
    });

    const { result } = renderHook(() => useSubscriptionLimits());

    expect(result.current.canCreateTemplates).toBe(true);
    expect(result.current.canBrand).toBe(true);
    expect(result.current.canUseAPI).toBe(true);
    expect(result.current.canUseWebhooks).toBe(true);
    expect(result.current.canUseSSO).toBe(true);
    expect(result.current.maxSeats).toBe(Infinity);
  });
});
