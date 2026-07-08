import { ConvexError } from "convex/values";
import { describe, expect, test } from "vitest";

import { rejectRetiredMerchantSurface } from "./merchant_account_actions";

describe("merchant account provider guard", () => {
  test("blocks retired merchant onboarding surfaces for every organization", () => {
    expect(() => rejectRetiredMerchantSurface("OAuth merchant onboarding")).toThrow(ConvexError);
    expect(() => rejectRetiredMerchantSurface("OAuth merchant onboarding")).toThrow(
      "OAuth merchant onboarding is retired; use Vortex hosted merchant onboarding",
    );
  });
});
