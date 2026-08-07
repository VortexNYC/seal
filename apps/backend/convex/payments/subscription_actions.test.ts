import { parse } from "@vortexnyc/convex/helpers";
import { v } from "convex/values";
import { afterEach, describe, expect, test, vi } from "vitest";

import type { Doc } from "../_generated/dataModel";
import type { ActionCtx } from "../_generated/server";
import {
  cancelSubscription,
  createCheckoutSession,
  createCustomerPortalSession,
  pauseSubscription,
  resumeSubscription,
} from "./subscription_actions";

/**
 * Registered Convex actions carry their raw handler as `_handler` at
 * runtime; the public types do not expose it. Runtime-checked extraction
 * keeps the unit-test seam cast-free: the handler is invoked as-is and its
 * result surfaces as `unknown` for the assertions.
 */
function actionHandler(
  action: unknown
): (ctx: ActionCtx, args: unknown) => Promise<unknown> {
  if (
    (typeof action !== "object" && typeof action !== "function") ||
    action === null ||
    !("_handler" in action) ||
    typeof action._handler !== "function"
  ) {
    throw new Error("Expected a registered Convex action with a _handler");
  }
  const handler = action._handler;
  return async (ctx, args) => {
    const result: unknown = await handler(ctx, args);
    return result;
  };
}

const checkoutHandler = actionHandler(createCheckoutSession);
const portalHandler = actionHandler(createCustomerPortalSession);
const pauseHandler = actionHandler(pauseSubscription);
const resumeHandler = actionHandler(resumeSubscription);
const cancelHandler = actionHandler(cancelSubscription);

const organizationId = parse(v.id("organizations"), "org_seal_123");
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
        init?: Parameters<typeof fetch>[1]
      ): Promise<Response> => {
        captured =
          input instanceof Request ? input : new Request(String(input), init);
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
          { status: 201, headers: { "content-type": "application/json" } }
        );
      },
      { preconnect: () => undefined }
    );
    vi.stubGlobal("fetch", mockFetch);

    const { ctx, runMutation } = createCheckoutActionCtx({
      priceLookupResult: null,
      catalogPriceLookupResult: {
        subscriptionPriceId: parse(
          v.id("subscription_prices"),
          "subprice_vortex"
        ),
        subscriptionProductId: parse(
          v.id("subscription_products"),
          "subprod_vortex"
        ),
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
    expect(runMutation).not.toHaveBeenCalled();
    expect(captured).toBeInstanceOf(Request);
    if (captured === undefined) {
      throw new Error("Expected Vortex checkout request to be captured");
    }
    const body = parse(
      v.object({ lineItems: v.array(v.object({ priceId: v.string() })) }),
      JSON.parse(await captured.clone().text())
    );
    expect(body.lineItems[0]?.priceId).toBe("vtx_price_pro");
  });

  test("fails closed on Vortex Billing when the local catalog price is missing", async () => {
    process.env.VORTEX_BILLING_API_BASE_URL = "https://billing.vortex.test";
    process.env.VORTEX_BILLING_API_KEY = "vb_test";
    process.env.VORTEX_BILLING_ACCOUNT_ID = "bacc_seal_123";
    const { ctx, runMutation } = createCheckoutActionCtx({
      priceLookupResult: null,
      catalogPriceLookupResult: null,
    });

    await expect(checkoutHandler(ctx, baseCheckoutArgs)).rejects.toThrow(
      "Seal subscription price not found for Vortex checkout lookupKey: pro:monthly:v2"
    );
    expect(runMutation).not.toHaveBeenCalled();
  });

  test("fails closed on Vortex Billing when the lookup key is not in the Vortex price map", async () => {
    process.env.VORTEX_BILLING_API_BASE_URL = "https://billing.vortex.test";
    process.env.VORTEX_BILLING_API_KEY = "vb_test";
    process.env.VORTEX_BILLING_ACCOUNT_ID = "bacc_seal_123";
    const { ctx, runMutation } = createCheckoutActionCtx({
      priceLookupResult: null,
      catalogPriceLookupResult: null,
    });

    await expect(
      checkoutHandler(ctx, {
        ...baseCheckoutArgs,
        lookupKey: "unknown:monthly:v2",
      })
    ).rejects.toThrow(
      "Seal subscription price not found for Vortex checkout lookupKey: unknown:monthly:v2"
    );
    expect(runMutation).not.toHaveBeenCalled();
  });
});

/**
 * The unit fakes cover only the ctx surface the actions touch; the real
 * ActionCtx shape (scheduler, storage, vector search) is irrelevant here.
 * Runtime-checked structural narrowing keeps the seam cast-free.
 */
function isTestActionCtx(value: unknown): value is ActionCtx {
  return typeof value === "object" && value !== null;
}

function toTestActionCtx(value: unknown): ActionCtx {
  if (!isTestActionCtx(value)) {
    throw new Error("Expected an object test ctx");
  }
  return value;
}

function createCheckoutActionCtx(args: {
  readonly priceLookupResult: unknown;
  readonly catalogPriceLookupResult?: unknown;
  readonly organizationOverrides?: Partial<Doc<"organizations">>;
}): { ctx: ActionCtx; runMutation: ReturnType<typeof vi.fn> } {
  const user = {
    _id: parse(v.id("users"), "user_seal_123"),
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
  };

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
  const runMutation = vi.fn(
    async (): Promise<unknown> => args.priceLookupResult
  );

  return {
    ctx: toTestActionCtx({ auth, runQuery, runMutation }),
    runMutation,
  };
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
          { status: 201, headers: { "content-type": "application/json" } }
        ),
      { preconnect: () => undefined }
    );
    vi.stubGlobal("fetch", mockFetch);

    const { ctx, runMutation } = createCheckoutActionCtx({
      priceLookupResult: null,
    });

    await expect(
      portalHandler(ctx, { returnUrl: "https://seal.test/billing" })
    ).resolves.toEqual({
      url: "https://pay.vortex.test/portal/plink_123",
    });
    expect(runMutation).not.toHaveBeenCalled();
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
          { status: 201, headers: { "content-type": "application/json" } }
        ),
      { preconnect: () => undefined }
    );
    vi.stubGlobal("fetch", mockFetch);

    const { ctx, runMutation } = createCheckoutActionCtx({
      priceLookupResult: null,
      organizationOverrides: { billingCustomerId: "cus_existing" },
    });

    await expect(
      portalHandler(ctx, { returnUrl: "https://seal.test/billing" })
    ).resolves.toEqual({
      url: "https://pay.vortex.test/portal/default",
    });
    expect(runMutation).not.toHaveBeenCalled();
  });
});

describe("payments/subscription_actions Vortex lifecycle guards", () => {
  const lifecycleCtx = toTestActionCtx({});
  const lifecycleArgs = {
    slug: "seal-test-org",
    subscriptionId: "vtx_sub_seal_org_org_seal_123_pro_monthly_v2",
  };

  test("blocks pause locally until Vortex Billing owns the lifecycle action", async () => {
    await expect(pauseHandler(lifecycleCtx, lifecycleArgs)).rejects.toThrow(
      "Subscription pause must be handled by Vortex Billing"
    );
  });

  test("blocks resume locally until Vortex Billing owns the lifecycle action", async () => {
    await expect(resumeHandler(lifecycleCtx, lifecycleArgs)).rejects.toThrow(
      "Subscription resume must be handled by Vortex Billing"
    );
  });

  test("blocks cancellation locally until Vortex Billing owns the lifecycle action", async () => {
    await expect(cancelHandler(lifecycleCtx, lifecycleArgs)).rejects.toThrow(
      "Subscription cancellation must be handled by Vortex Billing"
    );
  });
});
