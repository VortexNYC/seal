import { describe, expect, test } from "vitest";

import { resolveProcessorAccountId } from "./merchant_account_queries";

describe("merchant account query provider mapping", () => {
  test("uses the Vortex merchant account id for Vortex-backed merchant accounts", () => {
    expect(
      resolveProcessorAccountId({
        provider: "vortex",
        stripeAccountId: "acct_legacy",
        vortexMerchantAccountId: "ma_vortex",
      }),
    ).toBe("ma_vortex");
  });

  test("keeps the Stripe account id for legacy Stripe merchant accounts", () => {
    expect(
      resolveProcessorAccountId({
        provider: "stripe",
        stripeAccountId: "acct_legacy",
        vortexMerchantAccountId: "ma_vortex",
      }),
    ).toBe("acct_legacy");
  });

  test("falls back to the stored processor id when a Vortex account is missing its Vortex id", () => {
    expect(
      resolveProcessorAccountId({
        provider: "vortex",
        stripeAccountId: "ma_fallback",
        vortexMerchantAccountId: undefined,
      }),
    ).toBe("ma_fallback");
  });
});
