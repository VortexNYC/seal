import { ConvexError } from "convex/values";
import { describe, expect, test } from "vitest";

import { assertLegacyStripeMerchantSurfaceAllowed } from "./merchant_account_actions";

describe("merchant account provider guard", () => {
  test("blocks legacy Stripe onboarding surfaces for Vortex document-payment orgs", () => {
    const env = {
      VORTEX_BILLING_DOCUMENT_PAYMENT_ORGANIZATION_IDS: JSON.stringify(["org_vortex"]),
    };

    expect(() =>
      assertLegacyStripeMerchantSurfaceAllowed("org_vortex", "OAuth onboarding", env),
    ).toThrow(ConvexError);
    expect(() =>
      assertLegacyStripeMerchantSurfaceAllowed("org_vortex", "OAuth onboarding", env),
    ).toThrow("Legacy Stripe OAuth onboarding is disabled");
  });

  test("keeps legacy Stripe onboarding surfaces available for non-Vortex orgs", () => {
    const env = {
      VORTEX_BILLING_DOCUMENT_PAYMENT_ORGANIZATION_IDS: JSON.stringify(["org_vortex"]),
    };

    expect(() =>
      assertLegacyStripeMerchantSurfaceAllowed("org_stripe", "OAuth onboarding", env),
    ).not.toThrow();
  });
});
