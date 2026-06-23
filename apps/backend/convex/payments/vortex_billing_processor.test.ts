import { afterEach, describe, expect, test, vi } from "vitest";

import {
  createVortexBillingCheckoutSession,
  resolveVortexBillingConfig,
  selectSaasBillingProvider,
} from "./vortex_billing_processor";

const checkoutArgs = {
  organizationId: "org_seal_123",
  lookupKey: "pro:monthly:v2",
  quantity: 3,
} as const;

describe("Vortex Billing SaaS processor", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("selects Stripe unless the organization is allowlisted", () => {
    expect(selectSaasBillingProvider("org_1", {})).toBe("stripe");
    expect(selectSaasBillingProvider("org_1", { VORTEX_BILLING_SAAS_ORGANIZATION_IDS: "[]" })).toBe(
      "stripe",
    );
    expect(
      selectSaasBillingProvider("org_1", {
        VORTEX_BILLING_SAAS_ORGANIZATION_IDS: JSON.stringify(["org_2"]),
      }),
    ).toBe("stripe");
    expect(
      selectSaasBillingProvider("org_1", {
        VORTEX_BILLING_SAAS_ORGANIZATION_IDS: JSON.stringify(["org_1"]),
      }),
    ).toBe("vortex_billing");
    expect(selectSaasBillingProvider("org_1", { VORTEX_BILLING_SAAS_ORGANIZATION_IDS: "*" })).toBe(
      "vortex_billing",
    );
  });

  test("resolves mapped Vortex account and price configuration", () => {
    const config = resolveVortexBillingConfig(checkoutArgs, {
      VORTEX_BILLING_API_BASE_URL: "https://payments.vortex.test",
      VORTEX_BILLING_API_KEY: "vb_test",
      VORTEX_BILLING_ACCOUNT_MAP: JSON.stringify({ org_seal_123: "bacc_seal_123" }),
      VORTEX_BILLING_SAAS_PRICE_MAP: JSON.stringify({ "pro:monthly:v2": "vtx_price_pro" }),
    });

    expect(config).toEqual({
      apiBaseUrl: "https://payments.vortex.test",
      apiKey: "vb_test",
      billingAccountId: "bacc_seal_123",
      priceId: "vtx_price_pro",
      customerExternalId: "vtx_cust_seal_org_org_seal_123",
      subscriptionExternalId: "vtx_sub_seal_org_org_seal_123_pro_monthly_v2",
    });
  });

  test("fails closed when an allowlisted checkout has no Vortex account mapping", () => {
    expect(() =>
      resolveVortexBillingConfig(checkoutArgs, {
        VORTEX_BILLING_API_BASE_URL: "https://payments.vortex.test",
        VORTEX_BILLING_API_KEY: "vb_test",
        VORTEX_BILLING_SAAS_PRICE_MAP: JSON.stringify({ "pro:monthly:v2": "vtx_price_pro" }),
      }),
    ).toThrow(/Vortex Billing account missing/);
  });

  test("creates a hosted checkout session through the Vortex API", async () => {
    const calls: Array<{ readonly url: string; readonly init: RequestInit | undefined }> = [];
    const fetcher = async (input: string, init: RequestInit): Promise<Response> => {
      calls.push({ url: String(input), init });
      return new Response(
        JSON.stringify({
          data: {
            checkoutSession: {
              checkoutUrl: "https://payments.vortex.test/pay/token_123",
            },
          },
          requestId: "req_123",
        }),
        { status: 201 },
      );
    };

    const checkoutUrl = await createVortexBillingCheckoutSession(
      checkoutArgs,
      {
        VORTEX_BILLING_API_BASE_URL: "https://payments.vortex.test/",
        VORTEX_BILLING_API_KEY: "vb_test",
        VORTEX_BILLING_ACCOUNT_MAP: JSON.stringify({ org_seal_123: "bacc_seal_123" }),
        VORTEX_BILLING_SAAS_PRICE_MAP: JSON.stringify({ "pro:monthly:v2": "vtx_price_pro" }),
      },
      fetcher,
    );

    expect(checkoutUrl).toBe("https://payments.vortex.test/pay/token_123");
    expect(calls).toHaveLength(1);

    const call = calls[0];
    expect(call?.url).toBe("https://payments.vortex.test/v1/checkout/sessions");
    expect(call?.init?.method).toBe("POST");
    expect(call?.init?.headers).toMatchObject({
      authorization: "Bearer vb_test",
      "content-type": "application/json",
      "idempotency-key": "seal-saas-checkout:org_seal_123:pro_monthly_v2",
      "x-vortex-service": "billing",
    });
    expect(JSON.parse(String(call?.init?.body))).toEqual({
      mode: "subscription",
      customerExternalId: "vtx_cust_seal_org_org_seal_123",
      billingAccountId: "bacc_seal_123",
      subscriptionExternalId: "vtx_sub_seal_org_org_seal_123_pro_monthly_v2",
      collectionMode: "automatic",
      lineItems: [{ priceId: "vtx_price_pro", quantity: 3 }],
      createdByRef: "seal-saas-billing-settings",
      metadata: {
        sourceSystem: "seal",
        sealOrganizationId: "org_seal_123",
        lookupKey: "pro:monthly:v2",
      },
    });
  });
});
