import { renderHook } from "@testing-library/react";
import { describe, expect, test } from "vitest";

import { useSubscriptionLimits } from "./use-subscription-limits";

describe("useSubscriptionLimits", () => {
  test("unlocks all tiers while org billing is rebuilt", () => {
    const { result } = renderHook(() => useSubscriptionLimits());

    expect(result.current.isLoading).toBe(false);
    expect(result.current.tier).toBe("enterprise");
    expect(result.current.isPro).toBe(true);
    expect(result.current.isEnterprise).toBe(true);
    expect(result.current.canCreateTemplates).toBe(true);
    expect(result.current.canBrand).toBe(true);
    expect(result.current.canUseAPI).toBe(true);
    expect(result.current.canUseWebhooks).toBe(true);
    expect(result.current.canUseSSO).toBe(true);
    expect(result.current.maxSeats).toBe(Infinity);
  });
});
