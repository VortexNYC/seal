import { vi, describe, test, expect, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

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
  });

  test("returns isPro: true when status is active and tier is pro", () => {
    mockUseQuery.mockReturnValue({ status: "active", tier: "pro" });

    const { result } = renderHook(() => useSubscriptionLimits());

    expect(result.current.isPro).toBe(true);
    expect(result.current.tier).toBe("pro");
    expect(result.current.isLoading).toBe(false);
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
});
