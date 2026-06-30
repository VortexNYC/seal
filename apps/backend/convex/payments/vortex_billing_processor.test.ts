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
    let captured: Request | undefined;
    const mockFetch: typeof fetch = Object.assign(
      async (input: Parameters<typeof fetch>[0]): Promise<Response> => {
        captured = input instanceof Request ? input : new Request(String(input));

        return new Response(
          JSON.stringify({
            data: {
              checkoutSession: {
                checkoutUrl: "https://pay.vortex.test/abc",
              },
            },
            requestId: "req_1",
          }),
          { status: 201, headers: { "content-type": "application/json" } },
        );
      },
      { preconnect: fetch.preconnect },
    );

    const checkoutUrl = await createVortexBillingCheckoutSession(
      checkoutArgs,
      {
        VORTEX_BILLING_API_BASE_URL: "https://billing.vortex.test",
        VORTEX_BILLING_API_KEY: "vb_test",
        VORTEX_BILLING_ACCOUNT_MAP: JSON.stringify({ org_seal_123: "bacc_seal_123" }),
        VORTEX_BILLING_SAAS_PRICE_MAP: JSON.stringify({ "pro:monthly:v2": "vtx_price_pro" }),
      },
      mockFetch,
    );

    expect(checkoutUrl).toBe("https://pay.vortex.test/abc");
    expect(captured).toBeInstanceOf(Request);

    const capturedRequest = captured;
    if (capturedRequest === undefined) {
      throw new Error("Expected Vortex Billing checkout request to be captured");
    }

    expect(capturedRequest.url).toBe("https://billing.vortex.test/v1/checkout/sessions");
    expect(capturedRequest.method).toBe("POST");
    expect(capturedRequest.headers.get("authorization")).toBe("Bearer vb_test");
    expect(capturedRequest.headers.get("x-vortex-service")).toBe("billing");
    expect(capturedRequest.headers.get("idempotency-key")).toBe(
      "seal-saas-checkout:org_seal_123:pro_monthly_v2",
    );

    const sentBody = JSON.parse(await capturedRequest.clone().text()) as unknown;
    expect(sentBody).toEqual({
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

  test("raises a ConvexError when the Vortex API rejects checkout creation", async () => {
    const mockFetch: typeof fetch = Object.assign(
      async (): Promise<Response> =>
        new Response(
          JSON.stringify({
            error: {
              code: "validation_failed",
              message: "price is inactive",
            },
          }),
          { status: 422, headers: { "content-type": "application/json" } },
        ),
      { preconnect: fetch.preconnect },
    );

    await expect(
      createVortexBillingCheckoutSession(
        checkoutArgs,
        {
          VORTEX_BILLING_API_BASE_URL: "https://billing.vortex.test",
          VORTEX_BILLING_API_KEY: "vb_test",
          VORTEX_BILLING_ACCOUNT_MAP: JSON.stringify({ org_seal_123: "bacc_seal_123" }),
          VORTEX_BILLING_SAAS_PRICE_MAP: JSON.stringify({ "pro:monthly:v2": "vtx_price_pro" }),
        },
        mockFetch,
      ),
    ).rejects.toThrow(/Vortex Billing checkout failed \(422\):/);
  });
});
