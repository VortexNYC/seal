import { afterEach, describe, expect, test, vi } from "vitest";

import {
  createVortexBillingCheckoutSession,
  createVortexBillingPortalSession,
  readVortexProductAccess,
  resolveVortexBillingConfig,
  resolveVortexBillingPortalConfig,
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

  test("selects Vortex Billing regardless of the legacy allowlist", () => {
    expect(selectSaasBillingProvider("org_1", {})).toBe("vortex_billing");
    expect(selectSaasBillingProvider("org_1", { VORTEX_BILLING_SAAS_ORGANIZATION_IDS: "[]" })).toBe(
      "vortex_billing",
    );
    expect(
      selectSaasBillingProvider("org_1", {
        VORTEX_BILLING_SAAS_ORGANIZATION_IDS: JSON.stringify(["org_2"]),
      }),
    ).toBe("vortex_billing");
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

  test("uses a direct Vortex price id as the checkout key when no price map exists", () => {
    const config = resolveVortexBillingConfig(
      {
        ...checkoutArgs,
        lookupKey: "vtx_price_seal_pro_monthly",
      },
      {
        VORTEX_BILLING_API_BASE_URL: "https://payments.vortex.test",
        VORTEX_BILLING_API_KEY: "vb_test",
        VORTEX_BILLING_ACCOUNT_MAP: JSON.stringify({ org_seal_123: "bacc_seal_123" }),
      },
    );

    expect(config).toEqual({
      apiBaseUrl: "https://payments.vortex.test",
      apiKey: "vb_test",
      billingAccountId: "bacc_seal_123",
      priceId: "vtx_price_seal_pro_monthly",
      customerExternalId: "vtx_cust_seal_org_org_seal_123",
      subscriptionExternalId: "vtx_sub_seal_org_org_seal_123_vtx_price_seal_pro_monthly",
    });
  });

  test("prefers the synced catalog price id over the legacy price-map selector", () => {
    const config = resolveVortexBillingConfig(
      {
        ...checkoutArgs,
        priceId: "vtx_price_from_catalog",
      },
      {
        VORTEX_BILLING_API_BASE_URL: "https://payments.vortex.test",
        VORTEX_BILLING_API_KEY: "vb_test",
        VORTEX_BILLING_ACCOUNT_MAP: JSON.stringify({ org_seal_123: "bacc_seal_123" }),
        VORTEX_BILLING_SAAS_PRICE_MAP: JSON.stringify({
          "pro:monthly:v2": "vtx_price_from_env",
        }),
      },
    );

    expect(config.priceId).toBe("vtx_price_from_catalog");
  });

  test("resolves Vortex portal configuration without checkout-only price or account env", () => {
    expect(
      resolveVortexBillingPortalConfig(
        { organizationId: "org_seal_123" },
        {
          VORTEX_BILLING_API_BASE_URL: "https://payments.vortex.test",
          VORTEX_BILLING_API_KEY: "vb_test",
          VORTEX_BILLING_CUSTOMER_MAP: JSON.stringify({ org_seal_123: "vtx_cust_mapped" }),
        },
      ),
    ).toEqual({
      apiBaseUrl: "https://payments.vortex.test",
      apiKey: "vb_test",
      customerExternalId: "vtx_cust_mapped",
    });

    expect(
      resolveVortexBillingPortalConfig(
        { organizationId: "org_without_map" },
        {
          VORTEX_BILLING_API_BASE_URL: "https://payments.vortex.test",
          VORTEX_BILLING_API_KEY: "vb_test",
        },
      ).customerExternalId,
    ).toBe("vtx_cust_seal_org_org_without_map");
  });

  test("fails closed when checkout has no Vortex account mapping", () => {
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
                amountTotal: 8700,
                amountRemaining: 8700,
                invoiceNumbers: ["INV-1"],
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
    expect(capturedRequest.headers.get("content-type")).toBe("application/json");
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

  test("applies and verifies a Vortex coupon before returning checkout", async () => {
    const capturedRequests: Request[] = [];
    const mockFetch: typeof fetch = Object.assign(
      async (
        input: Parameters<typeof fetch>[0],
        init?: Parameters<typeof fetch>[1],
      ): Promise<Response> => {
        const request = input instanceof Request ? input : new Request(String(input), init);
        capturedRequests.push(request);

        if (request.url === "https://billing.vortex.test/v1/coupons?status=active") {
          return jsonResponse({
            data: [
              {
                couponId: "coupon_25",
                code: "SAVE25",
                status: "active",
                expiresAt: "2999-01-01T00:00:00.000Z",
                targets: { priceIds: ["vtx_price_pro"] },
              },
            ],
          });
        }
        if (request.url === "https://billing.vortex.test/v1/coupons/coupon_25/apply") {
          return jsonResponse({
            data: {
              appliedCoupon: {
                appliedCouponId: "seal-saas-coupon:org_seal_123:pro_monthly_v2:coupon_25",
              },
            },
          });
        }
        if (request.url === "https://billing.vortex.test/v1/checkout/sessions") {
          return jsonResponse(
            {
              data: {
                checkoutSession: {
                  checkoutUrl: "https://pay.vortex.test/discounted",
                  amountTotal: 6525,
                  amountRemaining: 6525,
                  invoiceNumbers: ["INV-DISCOUNTED"],
                },
              },
            },
            201,
          );
        }

        return jsonResponse({ error: { message: "unexpected request" } }, 500);
      },
      { preconnect: fetch.preconnect },
    );

    const checkoutUrl = await createVortexBillingCheckoutSession(
      {
        ...checkoutArgs,
        promoCode: " SAVE25 ",
        priceUnitAmount: 2900,
      },
      {
        VORTEX_BILLING_API_BASE_URL: "https://billing.vortex.test",
        VORTEX_BILLING_API_KEY: "vb_test",
        VORTEX_BILLING_ACCOUNT_MAP: JSON.stringify({ org_seal_123: "bacc_seal_123" }),
        VORTEX_BILLING_SAAS_PRICE_MAP: JSON.stringify({ "pro:monthly:v2": "vtx_price_pro" }),
      },
      mockFetch,
    );

    expect(checkoutUrl).toBe("https://pay.vortex.test/discounted");
    expect(capturedRequests.map((request) => `${request.method} ${request.url}`)).toEqual([
      "GET https://billing.vortex.test/v1/coupons?status=active",
      "POST https://billing.vortex.test/v1/coupons/coupon_25/apply",
      "POST https://billing.vortex.test/v1/checkout/sessions",
    ]);

    const applyBody = JSON.parse(await capturedRequests[1].clone().text()) as Record<
      string,
      unknown
    >;
    expect(applyBody).toMatchObject({
      appliedCouponId: "seal-saas-coupon:org_seal_123:pro_monthly_v2:coupon_25",
      customerExternalId: "vtx_cust_seal_org_org_seal_123",
      billingAccountId: "bacc_seal_123",
    });
    expect("subscriptionExternalId" in applyBody).toBe(false);
  });

  test("fails closed before checkout when a Vortex coupon code is invalid", async () => {
    const capturedRequests: Request[] = [];
    const mockFetch: typeof fetch = Object.assign(
      async (
        input: Parameters<typeof fetch>[0],
        init?: Parameters<typeof fetch>[1],
      ): Promise<Response> => {
        const request = input instanceof Request ? input : new Request(String(input), init);
        capturedRequests.push(request);
        return jsonResponse({
          data: [
            {
              couponId: "coupon_25",
              code: "SAVE25",
              status: "active",
              targets: { priceIds: ["vtx_price_pro"] },
            },
          ],
        });
      },
      { preconnect: fetch.preconnect },
    );

    await expect(
      createVortexBillingCheckoutSession(
        {
          ...checkoutArgs,
          promoCode: "NOPE",
          priceUnitAmount: 2900,
        },
        {
          VORTEX_BILLING_API_BASE_URL: "https://billing.vortex.test",
          VORTEX_BILLING_API_KEY: "vb_test",
          VORTEX_BILLING_ACCOUNT_MAP: JSON.stringify({ org_seal_123: "bacc_seal_123" }),
          VORTEX_BILLING_SAAS_PRICE_MAP: JSON.stringify({ "pro:monthly:v2": "vtx_price_pro" }),
        },
        mockFetch,
      ),
    ).rejects.toThrow("Vortex Billing coupon code is invalid or inactive");
    expect(capturedRequests.map((request) => `${request.method} ${request.url}`)).toEqual([
      "GET https://billing.vortex.test/v1/coupons?status=active",
    ]);
  });

  test("terminates an applied Vortex coupon when checkout creation fails", async () => {
    const capturedRequests: Request[] = [];
    const mockFetch = createCouponCheckoutMock(capturedRequests, {
      checkoutStatus: 500,
      checkoutBody: { error: { message: "checkout unavailable" } },
    });

    await expect(
      createVortexBillingCheckoutSession(
        {
          ...checkoutArgs,
          promoCode: "SAVE25",
          priceUnitAmount: 2900,
        },
        {
          VORTEX_BILLING_API_BASE_URL: "https://billing.vortex.test",
          VORTEX_BILLING_API_KEY: "vb_test",
          VORTEX_BILLING_ACCOUNT_MAP: JSON.stringify({ org_seal_123: "bacc_seal_123" }),
          VORTEX_BILLING_SAAS_PRICE_MAP: JSON.stringify({ "pro:monthly:v2": "vtx_price_pro" }),
        },
        mockFetch,
      ),
    ).rejects.toThrow(/Vortex Billing checkout failed \(500\):/);

    expect(capturedRequests.map((request) => `${request.method} ${request.url}`)).toEqual([
      "GET https://billing.vortex.test/v1/coupons?status=active",
      "POST https://billing.vortex.test/v1/coupons/coupon_25/apply",
      "POST https://billing.vortex.test/v1/checkout/sessions",
      "POST https://billing.vortex.test/v1/applied-coupons/seal-saas-coupon%3Aorg_seal_123%3Apro_monthly_v2%3Acoupon_25/terminate",
    ]);
  });

  test("terminates an applied Vortex coupon when checkout does not reflect the discount", async () => {
    const capturedRequests: Request[] = [];
    const mockFetch = createCouponCheckoutMock(capturedRequests, {
      checkoutStatus: 201,
      checkoutBody: {
        data: {
          checkoutSession: {
            checkoutUrl: "https://pay.vortex.test/full-price",
            amountTotal: 8700,
            amountRemaining: 8700,
            invoiceNumbers: ["INV-FULL"],
          },
        },
      },
    });

    await expect(
      createVortexBillingCheckoutSession(
        {
          ...checkoutArgs,
          promoCode: "SAVE25",
          priceUnitAmount: 2900,
        },
        {
          VORTEX_BILLING_API_BASE_URL: "https://billing.vortex.test",
          VORTEX_BILLING_API_KEY: "vb_test",
          VORTEX_BILLING_ACCOUNT_MAP: JSON.stringify({ org_seal_123: "bacc_seal_123" }),
          VORTEX_BILLING_SAAS_PRICE_MAP: JSON.stringify({ "pro:monthly:v2": "vtx_price_pro" }),
        },
        mockFetch,
      ),
    ).rejects.toThrow("Vortex Billing checkout did not reflect applied coupon");

    expect(capturedRequests.map((request) => `${request.method} ${request.url}`)).toEqual([
      "GET https://billing.vortex.test/v1/coupons?status=active",
      "POST https://billing.vortex.test/v1/coupons/coupon_25/apply",
      "POST https://billing.vortex.test/v1/checkout/sessions",
      "POST https://billing.vortex.test/v1/applied-coupons/seal-saas-coupon%3Aorg_seal_123%3Apro_monthly_v2%3Acoupon_25/terminate",
    ]);
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

  test("creates a hosted customer portal link through the Vortex API", async () => {
    let captured: Request | undefined;
    const mockFetch: typeof fetch = Object.assign(
      async (input: Parameters<typeof fetch>[0]): Promise<Response> => {
        captured = input instanceof Request ? input : new Request(String(input));

        return new Response(
          JSON.stringify({
            data: {
              link: {
                linkId: "plink_123",
                customerExternalId: "vtx_cust_mapped",
                status: "active",
                url: "https://pay.vortex.test/portal/plink_123",
                expiresAt: "2026-07-01T00:00:00.000Z",
                createdAt: "2026-06-30T00:00:00.000Z",
              },
            },
            requestId: "req_1",
          }),
          { status: 201, headers: { "content-type": "application/json" } },
        );
      },
      { preconnect: fetch.preconnect },
    );

    const portalUrl = await createVortexBillingPortalSession(
      { organizationId: "org_seal_123" },
      {
        VORTEX_BILLING_API_BASE_URL: "https://billing.vortex.test",
        VORTEX_BILLING_API_KEY: "vb_test",
        VORTEX_BILLING_CUSTOMER_MAP: JSON.stringify({ org_seal_123: "vtx_cust_mapped" }),
      },
      mockFetch,
    );

    expect(portalUrl).toBe("https://pay.vortex.test/portal/plink_123");
    expect(captured).toBeInstanceOf(Request);

    const capturedRequest = captured;
    if (capturedRequest === undefined) {
      throw new Error("Expected Vortex Billing portal request to be captured");
    }

    expect(capturedRequest.url).toBe(
      "https://billing.vortex.test/v1/customers/vtx_cust_mapped/portal-links",
    );
    expect(capturedRequest.method).toBe("POST");
    expect(capturedRequest.headers.get("authorization")).toBe("Bearer vb_test");
    expect(capturedRequest.headers.get("x-vortex-service")).toBe("billing");
    expect(capturedRequest.headers.get("content-type")).toBe("application/json");
    expect(capturedRequest.headers.get("idempotency-key")).toBe("seal-saas-portal:org_seal_123");

    const sentBody = JSON.parse(await capturedRequest.clone().text()) as unknown;
    expect(sentBody).toEqual({
      createdByRef: "seal-saas-billing-settings",
    });
  });

  test("raises a ConvexError when the Vortex API rejects portal creation", async () => {
    const mockFetch: typeof fetch = Object.assign(
      async (): Promise<Response> =>
        new Response(
          JSON.stringify({
            error: {
              code: "portal_unavailable",
              message: "customer is archived",
            },
          }),
          { status: 409, headers: { "content-type": "application/json" } },
        ),
      { preconnect: fetch.preconnect },
    );

    await expect(
      createVortexBillingPortalSession(
        { organizationId: "org_seal_123" },
        {
          VORTEX_BILLING_API_BASE_URL: "https://billing.vortex.test",
          VORTEX_BILLING_API_KEY: "vb_test",
        },
        mockFetch,
      ),
    ).rejects.toThrow(/Vortex Billing portal failed \(409\):/);
  });

  test("raises a clear ConvexError when the portal response omits the URL", async () => {
    const mockFetch: typeof fetch = Object.assign(
      async (): Promise<Response> =>
        new Response(
          JSON.stringify({
            data: {
              link: {
                linkId: "plink_123",
              },
            },
          }),
          { status: 201, headers: { "content-type": "application/json" } },
        ),
      { preconnect: fetch.preconnect },
    );

    await expect(
      createVortexBillingPortalSession(
        { organizationId: "org_seal_123" },
        {
          VORTEX_BILLING_API_BASE_URL: "https://billing.vortex.test",
          VORTEX_BILLING_API_KEY: "vb_test",
        },
        mockFetch,
      ),
    ).rejects.toThrow("Vortex Billing portal response did not include link.url");
  });
});

describe("readVortexProductAccess (VOR-67)", () => {
  const input = {
    apiBaseUrl: "https://payments.vortex.test",
    apiKey: "vb_test",
    customerExternalId: "vtx_cust_seal_org_org_seal_123",
  } as const;

  test("entitled=true when the namespaced key is in the customer's active keys", async () => {
    const result = await readVortexProductAccess({ ...input, product: "invoice" }, async () =>
      jsonResponse({ data: { entitlements: { activeKeys: ["vortex.invoice", "vortex.sign"] } } }),
    );
    expect(result).toEqual({ product: "invoice", entitlementKey: "vortex.invoice", entitled: true });
  });

  test("entitled=false when the key is absent from active keys", async () => {
    const result = await readVortexProductAccess({ ...input, product: "finance" }, async () =>
      jsonResponse({ data: { entitlements: { activeKeys: ["vortex.sign"] } } }),
    );
    expect(result).toEqual({ product: "finance", entitlementKey: "vortex.finance", entitled: false });
  });

  test("entitled=false (fail-closed) on a malformed/empty response body", async () => {
    for (const body of [{}, { data: {} }, { data: { entitlements: {} } }, null]) {
      const result = await readVortexProductAccess({ ...input, product: "invoice" }, async () =>
        jsonResponse(body),
      );
      expect(result.entitled).toBe(false);
    }
  });

  test("namespaces the product into the entitlements request path", async () => {
    let capturedUrl = "";
    await readVortexProductAccess({ ...input, product: "invoice" }, async (url) => {
      capturedUrl = url;
      return jsonResponse({ data: { entitlements: { activeKeys: [] } } });
    });
    expect(capturedUrl).toBe(
      "https://payments.vortex.test/v1/customers/vtx_cust_seal_org_org_seal_123/entitlements?key=vortex.invoice",
    );
  });
});

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function createCouponCheckoutMock(
  capturedRequests: Request[],
  checkout: {
    readonly checkoutStatus: number;
    readonly checkoutBody: unknown;
  },
): typeof fetch {
  return Object.assign(
    async (
      input: Parameters<typeof fetch>[0],
      init?: Parameters<typeof fetch>[1],
    ): Promise<Response> => {
      const request = input instanceof Request ? input : new Request(String(input), init);
      capturedRequests.push(request);

      if (request.url === "https://billing.vortex.test/v1/coupons?status=active") {
        return jsonResponse({
          data: [
            {
              couponId: "coupon_25",
              code: "SAVE25",
              status: "active",
              expiresAt: "2999-01-01T00:00:00.000Z",
              targets: { priceIds: ["vtx_price_pro"] },
            },
          ],
        });
      }
      if (request.url === "https://billing.vortex.test/v1/coupons/coupon_25/apply") {
        return jsonResponse({
          data: {
            appliedCoupon: {
              appliedCouponId: "seal-saas-coupon:org_seal_123:pro_monthly_v2:coupon_25",
            },
          },
        });
      }
      if (request.url === "https://billing.vortex.test/v1/checkout/sessions") {
        return jsonResponse(checkout.checkoutBody, checkout.checkoutStatus);
      }
      if (
        request.url ===
        "https://billing.vortex.test/v1/applied-coupons/seal-saas-coupon%3Aorg_seal_123%3Apro_monthly_v2%3Acoupon_25/terminate"
      ) {
        return jsonResponse({
          data: {
            appliedCoupon: {
              appliedCouponId: "seal-saas-coupon:org_seal_123:pro_monthly_v2:coupon_25",
              status: "terminated",
            },
          },
        });
      }

      return jsonResponse({ error: { message: "unexpected request" } }, 500);
    },
    { preconnect: fetch.preconnect },
  );
}
