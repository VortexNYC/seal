import { afterEach, describe, expect, test, vi } from "vitest";

import type { Doc, Id } from "../_generated/dataModel";
import type { ActionCtx } from "../_generated/server";
import { createCheckoutSession, createCustomerPortalSession } from "./subscription_actions";

type CheckoutArgs = {
  readonly lookupKey: string;
  readonly successUrl: string;
  readonly cancelUrl: string;
};

type CheckoutHandler = (ctx: ActionCtx, args: CheckoutArgs) => Promise<{ checkoutUrl: string }>;

const checkoutHandler = (createCheckoutSession as unknown as { readonly _handler: CheckoutHandler })
  ._handler;

type PortalHandler = (
  ctx: ActionCtx,
  args: { readonly returnUrl: string },
) => Promise<{ url: string }>;

const portalHandler = (
  createCustomerPortalSession as unknown as { readonly _handler: PortalHandler }
)._handler;

const organizationId = "org_seal_123" as Id<"organizations">;
const baseCheckoutArgs = {
  lookupKey: "pro:monthly:v2",
  successUrl: "https://seal.test/success",
  cancelUrl: "https://seal.test/cancel",
} as const;

const managedEnvKeys = [
  "VORTEX_BILLING_SAAS_ORGANIZATION_IDS",
  "VORTEX_BILLING_API_BASE_URL",
  "VORTEX_BILLING_API_KEY",
  "VORTEX_BILLING_ACCOUNT_ID",
  "VORTEX_BILLING_ACCOUNT_MAP",
  "VORTEX_BILLING_CUSTOMER_MAP",
  "VORTEX_BILLING_SAAS_PRICE_MAP",
] as const;

describe("payments/subscription_actions.createCheckoutSession", () => {
  afterEach(() => {
    for (const key of managedEnvKeys) {
      delete process.env[key];
    }
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  test("uses the synced Vortex catalog without a local legacy price row", async () => {
    process.env.VORTEX_BILLING_API_BASE_URL = "https://billing.vortex.test";
    process.env.VORTEX_BILLING_API_KEY = "vb_test";
    process.env.VORTEX_BILLING_ACCOUNT_ID = "bacc_seal_123";

    let captured: Request | undefined;
    const mockFetch: typeof fetch = Object.assign(
      async (
        input: Parameters<typeof fetch>[0],
        init?: Parameters<typeof fetch>[1],
      ): Promise<Response> => {
        captured = input instanceof Request ? input : new Request(String(input), init);
        return new Response(
          JSON.stringify({
            data: {
              checkoutSession: {
                checkoutUrl: "https://pay.vortex.test/checkout",
                amountTotal: 8700,
                amountRemaining: 8700,
                invoiceNumbers: ["INV-1"],
              },
            },
          }),
          { status: 201, headers: { "content-type": "application/json" } },
        );
      },
      { preconnect: fetch.preconnect },
    );
    vi.stubGlobal("fetch", mockFetch);

    const ctx = createCheckoutActionCtx({
      priceLookupResult: null,
      catalogPriceLookupResult: {
        subscriptionPriceId: "subprice_vortex" as Id<"subscription_prices">,
        subscriptionProductId: "subprod_vortex" as Id<"subscription_products">,
        externalPriceId: "vtx_price_pro",
        vortexPriceId: "vtx_price_pro",
        externalProductId: "vtx_prod_pro",
        vortexProductId: "vtx_prod_pro",
        status: "active",
        unitAmount: 2900,
      },
    });

    await expect(checkoutHandler(ctx, baseCheckoutArgs)).resolves.toEqual({
      checkoutUrl: "https://pay.vortex.test/checkout",
    });
    expect(ctx.runMutation).not.toHaveBeenCalled();
    expect(captured).toBeInstanceOf(Request);
    if (captured === undefined) {
      throw new Error("Expected Vortex checkout request to be captured");
    }
    const body = JSON.parse(await captured.clone().text()) as {
      lineItems: readonly [{ priceId: string }];
    };
    expect(body.lineItems[0].priceId).toBe("vtx_price_pro");
  });

  test("fails closed on Vortex Billing when the local catalog price is missing", async () => {
    process.env.VORTEX_BILLING_API_BASE_URL = "https://billing.vortex.test";
    process.env.VORTEX_BILLING_API_KEY = "vb_test";
    process.env.VORTEX_BILLING_ACCOUNT_ID = "bacc_seal_123";
    const ctx = createCheckoutActionCtx({
      priceLookupResult: null,
      catalogPriceLookupResult: null,
    });

    await expect(checkoutHandler(ctx, baseCheckoutArgs)).rejects.toThrow(
      "Seal subscription price not found for Vortex checkout lookupKey: pro:monthly:v2",
    );
    expect(ctx.runMutation).not.toHaveBeenCalled();
  });

  test("fails closed on Vortex Billing when the lookup key is not in the Vortex price map", async () => {
    process.env.VORTEX_BILLING_API_BASE_URL = "https://billing.vortex.test";
    process.env.VORTEX_BILLING_API_KEY = "vb_test";
    process.env.VORTEX_BILLING_ACCOUNT_ID = "bacc_seal_123";
    const ctx = createCheckoutActionCtx({
      priceLookupResult: null,
      catalogPriceLookupResult: null,
    });

    await expect(
      checkoutHandler(ctx, { ...baseCheckoutArgs, lookupKey: "unknown:monthly:v2" }),
    ).rejects.toThrow(
      "Seal subscription price not found for Vortex checkout lookupKey: unknown:monthly:v2",
    );
    expect(ctx.runMutation).not.toHaveBeenCalled();
  });
});

function createCheckoutActionCtx(args: {
  readonly priceLookupResult: unknown;
  readonly catalogPriceLookupResult?: unknown;
  readonly organizationOverrides?: Partial<Doc<"organizations">>;
}): ActionCtx {
  const user = {
    _id: "user_seal_123" as Id<"users">,
    _creationTime: 1,
    email: "owner@seal.test",
    name: "Seal Owner",
    authSubject: "auth_subject_123",
    isEmailVerified: true,
    timezone: "UTC",
    locale: "en-US",
    activeOrganizationId: organizationId,
  } as Doc<"users">;

  const organization = {
    _id: organizationId,
    _creationTime: 1,
    name: "Seal Test Org",
    slug: "seal-test-org",
    type: "company",
    isActive: true,
    timezone: "UTC",
    updatedAt: 1,
    ...args.organizationOverrides,
  } as Doc<"organizations">;

  const queryResults: readonly unknown[] =
    args.catalogPriceLookupResult === undefined
      ? [user, organization, 3]
      : [user, organization, 3, args.catalogPriceLookupResult];

  const auth = {
    getUserIdentity: vi.fn(async () => ({
      subject: "auth_subject_123",
      tokenIdentifier: "token_123",
      issuer: "https://auth.test",
    })),
  };
  const runQuery = vi.fn(async (): Promise<unknown> => {
    const next = queryResults[runQuery.mock.calls.length - 1];
    if (next === undefined) {
      throw new Error("Unexpected query call");
    }
    return next;
  });
  const runMutation = vi.fn(async (): Promise<unknown> => args.priceLookupResult);

  return {
    auth,
    runQuery,
    runMutation,
  } as unknown as ActionCtx;
}

describe("payments/subscription_actions.createCustomerPortalSession", () => {
  afterEach(() => {
    for (const key of managedEnvKeys) {
      delete process.env[key];
    }
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  test("returns a Vortex billing portal without a local legacy customer", async () => {
    process.env.VORTEX_BILLING_API_BASE_URL = "https://billing.vortex.test";
    process.env.VORTEX_BILLING_API_KEY = "vb_test";
    process.env.VORTEX_BILLING_CUSTOMER_MAP = JSON.stringify({
      [organizationId]: "vtx_cust_mapped",
    });
    const mockFetch: typeof fetch = Object.assign(
      async (): Promise<Response> =>
        new Response(
          JSON.stringify({
            data: {
              link: {
                url: "https://pay.vortex.test/portal/plink_123",
              },
            },
          }),
          { status: 201, headers: { "content-type": "application/json" } },
        ),
      { preconnect: fetch.preconnect },
    );
    vi.stubGlobal("fetch", mockFetch);

    const ctx = createCheckoutActionCtx({ priceLookupResult: null });

    await expect(portalHandler(ctx, { returnUrl: "https://seal.test/billing" })).resolves.toEqual({
      url: "https://pay.vortex.test/portal/plink_123",
    });
    expect(ctx.runMutation).not.toHaveBeenCalled();
  });

  test("uses Vortex portal even when no billing allowlist is configured", async () => {
    process.env.VORTEX_BILLING_API_BASE_URL = "https://billing.vortex.test";
    process.env.VORTEX_BILLING_API_KEY = "vb_test";
    process.env.VORTEX_BILLING_CUSTOMER_MAP = JSON.stringify({
      [organizationId]: "vtx_cust_mapped",
    });
    const mockFetch: typeof fetch = Object.assign(
      async (): Promise<Response> =>
        new Response(
          JSON.stringify({
            data: {
              link: {
                url: "https://pay.vortex.test/portal/default",
              },
            },
          }),
          { status: 201, headers: { "content-type": "application/json" } },
        ),
      { preconnect: fetch.preconnect },
    );
    vi.stubGlobal("fetch", mockFetch);

    const ctx = createCheckoutActionCtx({
      priceLookupResult: null,
      organizationOverrides: { stripeCustomerId: "cus_existing" },
    });

    await expect(portalHandler(ctx, { returnUrl: "https://seal.test/billing" })).resolves.toEqual({
      url: "https://pay.vortex.test/portal/default",
    });
    expect(ctx.runMutation).not.toHaveBeenCalled();
  });
});
