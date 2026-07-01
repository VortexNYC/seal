import { afterEach, describe, expect, test, vi } from "vitest";

import type { Doc, Id } from "../_generated/dataModel";
import type { ActionCtx } from "../_generated/server";
import { createCheckoutSession, createCustomerPortalSession } from "./subscription_actions";

const stripeProcessorMocks = vi.hoisted(() => ({
  cancelProcessorSubscription: vi.fn(),
  createCustomerPortalUrl: vi.fn(async (): Promise<string> => "https://billing.stripe.test/session"),
  createHostedCheckoutSession: vi.fn(async (): Promise<string> => "https://checkout.stripe.test/session"),
  getOrCreateBillingCustomerId: vi.fn(async (): Promise<string> => "cus_created"),
  pauseProcessorSubscription: vi.fn(),
  resumeProcessorSubscription: vi.fn(),
}));

vi.mock("../stripe/subscription_processor", () => stripeProcessorMocks);

type CheckoutArgs = {
  readonly lookupKey: string;
  readonly successUrl: string;
  readonly cancelUrl: string;
};

type CheckoutHandler = (
  ctx: ActionCtx,
  args: CheckoutArgs,
) => Promise<{ checkoutUrl: string }>;

const checkoutHandler = (
  createCheckoutSession as unknown as { readonly _handler: CheckoutHandler }
)._handler;

type PortalHandler = (ctx: ActionCtx, args: { readonly returnUrl: string }) => Promise<{ url: string }>;

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

  test("lets Vortex Billing checkout succeed without a local Stripe price row", async () => {
    process.env.VORTEX_BILLING_SAAS_ORGANIZATION_IDS = JSON.stringify([organizationId]);
    process.env.VORTEX_BILLING_API_BASE_URL = "https://billing.vortex.test";
    process.env.VORTEX_BILLING_API_KEY = "vb_test";
    process.env.VORTEX_BILLING_ACCOUNT_ID = "bacc_seal_123";
    process.env.VORTEX_BILLING_SAAS_PRICE_MAP = JSON.stringify({
      "pro:monthly:v2": "vtx_price_pro",
    });

    const mockFetch: typeof fetch = Object.assign(
      async (): Promise<Response> =>
        new Response(
          JSON.stringify({
            data: {
              checkoutSession: {
                checkoutUrl: "https://pay.vortex.test/checkout",
              },
            },
          }),
          { status: 201, headers: { "content-type": "application/json" } },
        ),
      { preconnect: fetch.preconnect },
    );
    vi.stubGlobal("fetch", mockFetch);

    const ctx = createCheckoutActionCtx({ priceLookupResult: null });

    await expect(checkoutHandler(ctx, baseCheckoutArgs)).resolves.toEqual({
      checkoutUrl: "https://pay.vortex.test/checkout",
    });
    expect(ctx.runMutation).not.toHaveBeenCalled();
  });

  test("keeps Stripe checkout closed when the local price row is missing", async () => {
    const ctx = createCheckoutActionCtx({ priceLookupResult: null });

    await expect(checkoutHandler(ctx, baseCheckoutArgs)).rejects.toThrow(
      "Price not found for lookup key: pro:monthly:v2",
    );
    expect(ctx.runMutation).toHaveBeenCalledOnce();
  });

  test("fails closed on Vortex Billing when the lookup key is not in the Vortex price map", async () => {
    process.env.VORTEX_BILLING_SAAS_ORGANIZATION_IDS = JSON.stringify([organizationId]);
    process.env.VORTEX_BILLING_API_BASE_URL = "https://billing.vortex.test";
    process.env.VORTEX_BILLING_API_KEY = "vb_test";
    process.env.VORTEX_BILLING_ACCOUNT_ID = "bacc_seal_123";
    process.env.VORTEX_BILLING_SAAS_PRICE_MAP = JSON.stringify({
      "pro:monthly:v2": "vtx_price_pro",
    });

    const ctx = createCheckoutActionCtx({ priceLookupResult: null });

    await expect(
      checkoutHandler(ctx, { ...baseCheckoutArgs, lookupKey: "unknown:monthly:v2" }),
    ).rejects.toThrow("Vortex Billing price missing for lookup key: unknown:monthly:v2");
    expect(ctx.runMutation).not.toHaveBeenCalled();
  });
});

function createCheckoutActionCtx(args: {
  readonly priceLookupResult: unknown;
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

  const queryResults: readonly unknown[] = [user, organization, 3];

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

  test("returns a Vortex billing portal for Vortex-billed orgs without a stray Stripe customer", async () => {
    process.env.VORTEX_BILLING_SAAS_ORGANIZATION_IDS = JSON.stringify([organizationId]);
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
    // The Stripe-customer resolution mutation must never run for a Vortex org.
    expect(ctx.runMutation).not.toHaveBeenCalled();
    expect(stripeProcessorMocks.getOrCreateBillingCustomerId).not.toHaveBeenCalled();
    expect(stripeProcessorMocks.createCustomerPortalUrl).not.toHaveBeenCalled();
  });

  test("keeps non-allowlisted orgs on the Stripe billing portal path", async () => {
    const ctx = createCheckoutActionCtx({
      priceLookupResult: null,
      organizationOverrides: { stripeCustomerId: "cus_existing" },
    });

    await expect(portalHandler(ctx, { returnUrl: "https://seal.test/billing" })).resolves.toEqual({
      url: "https://billing.stripe.test/session",
    });
    expect(stripeProcessorMocks.createCustomerPortalUrl).toHaveBeenCalledWith({
      customerId: "cus_existing",
      returnUrl: "https://seal.test/billing",
    });
    expect(stripeProcessorMocks.getOrCreateBillingCustomerId).not.toHaveBeenCalled();
    expect(ctx.runMutation).not.toHaveBeenCalled();
  });
});
