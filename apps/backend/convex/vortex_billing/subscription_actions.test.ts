import { ConvexError } from "convex/values";
import { describe, expect, test } from "vitest";

import type { Id } from "../_generated/dataModel";
import {
  assertVortexSaasCheckoutEnabled,
  buildVortexCustomerId,
  buildVortexSubscriptionId,
  parseVortexBillingSaasOrganizationIds,
  readVortexBillingSaasEnv,
  readVortexCheckoutSessionResult,
  resolveSaasCheckoutProviderForOrganization,
  resolveVortexSaasPriceId,
} from "./subscription_actions";

const organizationId = "org_seal_vortex_saas" as Id<"organizations">;

describe("Vortex Billing SaaS subscription actions", () => {
  test("builds Vortex-owned customer and subscription ids from Seal organization state", () => {
    expect(buildVortexCustomerId(organizationId)).toBe(
      "vtx_cust_seal_org_org_seal_vortex_saas",
    );
    expect(buildVortexSubscriptionId(organizationId, "pro:monthly:v2")).toBe(
      "vtx_sub_seal_org_org_seal_vortex_saas_pro_monthly_v2",
    );
  });

  test("parses Vortex Billing SaaS environment mappings", () => {
    const env = readVortexBillingSaasEnv({
      apiBaseUrl: "https://billing.vortex.test/",
      apiKey: "vb_test_123",
      defaultBillingAccountId: "acct_default",
      billingAccountMapJson: JSON.stringify({ [organizationId]: "acct_org" }),
      priceMapJson: JSON.stringify({ "pro:monthly:v2": "vtx_price_pro_monthly" }),
    });

    expect(env.apiBaseUrl).toBe("https://billing.vortex.test");
    expect(env.apiKey).toBe("vb_test_123");
    expect(env.defaultBillingAccountId).toBe("acct_default");
    expect(env.billingAccountMap.get(organizationId)).toBe("acct_org");
    expect(env.priceMap.get("pro:monthly:v2")).toBe("vtx_price_pro_monthly");
  });

  test("rejects missing Vortex Billing SaaS credentials", () => {
    expect(() =>
      readVortexBillingSaasEnv({
        apiBaseUrl: "",
        apiKey: "vb_test_123",
      }),
    ).toThrow(ConvexError);
  });

  test("resolves Vortex SaaS checkout only for explicitly enabled organizations", () => {
    expect(parseVortexBillingSaasOrganizationIds(`${organizationId}, other_org`).has(organizationId)).toBe(
      true,
    );
    expect(
      parseVortexBillingSaasOrganizationIds(JSON.stringify([organizationId])).has(organizationId),
    ).toBe(true);
    expect(resolveSaasCheckoutProviderForOrganization(organizationId, organizationId)).toBe(
      "vortex_billing",
    );
    expect(resolveSaasCheckoutProviderForOrganization(organizationId, "different_org")).toBe(
      "stripe",
    );
    expect(resolveSaasCheckoutProviderForOrganization(organizationId, "*")).toBe(
      "vortex_billing",
    );
    expect(resolveSaasCheckoutProviderForOrganization(organizationId, undefined)).toBe("stripe");
  });

  test("blocks direct Vortex SaaS checkout when the organization is not enabled", () => {
    expect(() => assertVortexSaasCheckoutEnabled(organizationId, undefined)).toThrow(ConvexError);
    expect(() => assertVortexSaasCheckoutEnabled(organizationId, "different_org")).toThrow(ConvexError);
    expect(() => assertVortexSaasCheckoutEnabled(organizationId, organizationId)).not.toThrow();
  });

  test("resolves Vortex SaaS price ids without corrupting Stripe catalog ids", () => {
    const env = { priceMap: new Map([["pro:monthly:v2", "vtx_price_pro_monthly"]]) };

    expect(resolveVortexSaasPriceId(env, "pro:monthly:v2", "price_stripe_monthly")).toBe(
      "vtx_price_pro_monthly",
    );
    expect(resolveVortexSaasPriceId({ priceMap: new Map() }, "pro:monthly:v2", "vtx_price_legacy")).toBe(
      "vtx_price_legacy",
    );
    expect(() =>
      resolveVortexSaasPriceId({ priceMap: new Map() }, "pro:monthly:v2", "price_stripe_monthly"),
    ).toThrow(ConvexError);
  });

  test("reads hosted checkout session results", () => {
    expect(
      readVortexCheckoutSessionResult({
        data: {
          checkoutSession: {
            checkoutSessionId: "plink_123",
            checkoutUrl: "https://billing.vortex.test/pay/pay_123",
            subscriptionExternalId: "vtx_sub_123",
          },
        },
      }),
    ).toEqual({
      checkoutSessionId: "plink_123",
      checkoutUrl: "https://billing.vortex.test/pay/pay_123",
      subscriptionExternalId: "vtx_sub_123",
    });
  });

  test("rejects malformed hosted checkout responses", () => {
    expect(() => readVortexCheckoutSessionResult({ data: {} })).toThrow(ConvexError);
  });
});
