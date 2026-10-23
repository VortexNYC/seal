import { describe, expect, it, vi } from "vitest";

import {
  attachConnectedAccount,
  connectIdempotencyKey,
  mintSignToPayCheckoutSession,
  presentVortexConnect,
  provisionConnectedAccount,
  readUserVortexMerchants,
  readUserVortexOrganizations,
  readVortexConnect,
  SEAL_CONNECT_RATE_PLAN_ID,
  SEAL_PLATFORM_MERCHANT_ACCOUNT_ID,
  VortexConnectError,
  withVortexConnect,
} from "./vortex-connect.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const env = {
  VORTEX_API_KEY: "vp_test",
  VORTEX_API_BASE_URL: "https://api.vortex.test",
};

describe("readVortexConnect", () => {
  it("is disconnected when the org has no pointer", () => {
    expect(readVortexConnect(null).connected).toBe(false);
  });

  it("reads the stored pointer", () => {
    const metadata = withVortexConnect(JSON.stringify({ timezone: "UTC" }), {
      merchantAccountId: "ma_sub",
      claimUrl: "https://app.vortex.nyc/claim/abc",
      claimExpiresAt: "2026-10-14T00:00:00.000Z",
      status: "draft",
      environment: "production",
      ratePlanId: SEAL_CONNECT_RATE_PLAN_ID,
      onboardingSessionId: "onb_1",
    });
    const view = readVortexConnect(metadata);
    expect(view.connected).toBe(true);
    expect(view.merchantAccountId).toBe("ma_sub");
    expect(JSON.parse(metadata)).toMatchObject({ timezone: "UTC" });
  });
});

describe("presentVortexConnect", () => {
  it("hides a used claim link and says Finix has not approved charges", async () => {
    const metadata = withVortexConnect(null, {
      merchantAccountId: "ma_sub",
      claimUrl: "https://app.vortex.nyc/claim/org_1#token=secret",
      claimExpiresAt: "2026-10-18T00:00:00.000Z",
      status: "draft",
      environment: "production",
      ratePlanId: SEAL_CONNECT_RATE_PLAN_ID,
      onboardingSessionId: null,
    });
    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input);
      if (url.includes("/signup/claim/lookup")) {
        return new Response(JSON.stringify({ code: "claim_invalid" }), {
          status: 400,
        });
      }
      return new Response(
        JSON.stringify({
          data: { status: "draft", capabilityStatus: "unknown" },
        }),
        { status: 200 }
      );
    };
    const view = await presentVortexConnect(env, metadata, fetchImpl);
    expect(view.claimUrl).toBeNull();
    expect(view.chargesApproved).toBe(false);
    expect(view.summary).toBe(
      "draft. Finix has not approved this account for charges."
    );
  });
});

describe("provisionConnectedAccount", () => {
  it("refuses to call Vortex without a key", async () => {
    const fetchImpl = vi.fn();
    await expect(
      provisionConnectedAccount(
        {},
        {
          organizationId: "org_1",
          displayName: "Acme",
          legalEntityType: "CORPORATION",
          country: "USA",
          defaultCurrency: "USD",
        },
        fetchImpl
      )
    ).rejects.toBeInstanceOf(VortexConnectError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("creates a production sub-merchant on the Seal rate plan", async () => {
    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input);
      if (url.includes("/onboarding-link")) {
        return new Response(
          JSON.stringify({ data: { onboardingSessionId: "onb_1" } }),
          { status: 201 }
        );
      }
      return new Response(
        JSON.stringify({
          data: {
            id: "ma_sub",
            status: "draft",
            claimUrl: "https://app.vortex.nyc/claim/abc",
            claimExpiresAt: "2026-10-14T00:00:00.000Z",
          },
        }),
        { status: 201 }
      );
    };
    const fetchSpy = vi.fn(fetchImpl);

    const record = await provisionConnectedAccount(
      env,
      {
        organizationId: "org_1",
        displayName: "Acme",
        legalEntityType: "CORPORATION",
        country: "USA",
        defaultCurrency: "USD",
      },
      fetchSpy
    );

    expect(record.merchantAccountId).toBe("ma_sub");
    expect(record.onboardingSessionId).toBe("onb_1");
    expect(record.ratePlanId).toBe(SEAL_CONNECT_RATE_PLAN_ID);

    const firstCall = fetchSpy.mock.calls[0];
    expect(String(firstCall?.[0])).toBe(
      "https://api.vortex.test/v1/merchant-accounts?environment=production"
    );
    const requestInit = firstCall?.[1];
    const rawBody =
      requestInit && typeof requestInit === "object" && "body" in requestInit
        ? requestInit.body
        : undefined;
    const parsed: unknown = JSON.parse(String(rawBody));
    if (!isRecord(parsed)) {
      throw new Error("create body was not an object");
    }
    const recordBody = parsed;
    expect(recordBody.platformMerchantAccountId).toBe(
      SEAL_PLATFORM_MERCHANT_ACCOUNT_ID
    );
    expect(recordBody.ratePlanId).toBe(SEAL_CONNECT_RATE_PLAN_ID);
    expect(recordBody.environment).toBe("production");
    expect(recordBody.idempotencyKey).toBe(connectIdempotencyKey("org_1"));
    expect(recordBody.merchantMode).toBe("processing");
  });

  it("keeps the merchant when the onboarding draft fails", async () => {
    const fetchImpl: typeof fetch = async (input) => {
      const url = String(input);
      if (url.includes("/onboarding-link")) {
        return new Response(JSON.stringify({ message: "not ready" }), {
          status: 400,
        });
      }
      return new Response(
        JSON.stringify({ data: { id: "ma_sub", status: "draft" } }),
        { status: 201 }
      );
    };
    const record = await provisionConnectedAccount(
      env,
      {
        organizationId: "org_1",
        displayName: "Acme",
        legalEntityType: "CORPORATION",
        country: "USA",
        defaultCurrency: "USD",
      },
      fetchImpl
    );
    expect(record.merchantAccountId).toBe("ma_sub");
    expect(record.onboardingSessionId).toBeNull();
  });

  it("mints a sign-to-pay checkout session on Vortex (SEA-123 / SEA-124)", async () => {
    let seenUrl = "";
    let seenBody: Record<string, unknown> = {};
    const fetchImpl: typeof fetch = async (input, init) => {
      seenUrl = String(input);
      seenBody = JSON.parse(String(init?.body ?? "{}")) as Record<
        string,
        unknown
      >;
      return new Response(
        JSON.stringify({
          data: {
            checkoutSession: {
              checkoutSessionId: "plink_123",
              paymentRequestId: "preq_123",
              checkoutUrl: "https://pay.vortex.nyc/pay/ptok_123",
              invoiceNumbers: ["inv_123"],
            },
          },
        }),
        { status: 201 }
      );
    };
    const result = await mintSignToPayCheckoutSession(
      env,
      {
        merchantAccountId: "ma_sub",
        idempotencyKey: "seal-pay-doc_1-cfg_1",
        amountCents: 25000,
        currency: "usd",
        payerEmail: "signer@example.com",
        dueDate: "2026-11-15T00:00:00.000Z",
        description: "Service Agreement",
      },
      fetchImpl
    );
    expect(seenUrl).toBe(
      "https://api.vortex.test/v1/checkout/sessions?environment=sandbox"
    );
    expect(seenBody.environment).toBe("sandbox");
    expect(seenBody.amountCents).toBe(25000);
    expect(seenBody.payerEmail).toBe("signer@example.com");
    expect(result).toEqual({
      checkoutSessionId: "plink_123",
      paymentRequestId: "preq_123",
      checkoutUrl: "https://pay.vortex.nyc/pay/ptok_123",
      providerInvoiceId: "inv_123",
    });

    await mintSignToPayCheckoutSession(
      { ...env, VORTEX_API_KEY: "vp_live_123" },
      {
        merchantAccountId: "ma_sub",
        idempotencyKey: "seal-pay-doc_1-cfg_1",
        amountCents: 25000,
        currency: "usd",
        payerEmail: "signer@example.com",
        description: "Service Agreement",
      },
      fetchImpl
    );
    expect(seenUrl).toBe(
      "https://api.vortex.test/v1/checkout/sessions?environment=production"
    );
    expect(seenBody.environment).toBe("production");
  });

  it("attaches an existing Vortex merchant without assigning seal_fleet_standard (SEA-121)", async () => {
    let seenUrl = "";
    const fetchImpl: typeof fetch = async (input) => {
      seenUrl = String(input);
      return new Response(
        JSON.stringify({
          data: {
            id: "ma_existing_1",
            status: "active",
            capabilityStatus: "enabled",
          },
        }),
        { status: 200 }
      );
    };
    const record = await attachConnectedAccount(
      env,
      { merchantAccountId: "ma_existing_1" },
      fetchImpl
    );
    expect(seenUrl).toBe(
      "https://api.vortex.test/v1/merchant-accounts/ma_existing_1?environment=sandbox"
    );
    expect(record.merchantAccountId).toBe("ma_existing_1");
    expect(record.ratePlanId).toBeNull();
    expect(record.claimUrl).toBeNull();
  });

  it("parses OAuth-verified Vortex organizations and merchants with Zod (SEA-120 / SEA-121)", () => {
    const metadata = JSON.stringify({
      vortexOrganizations: [
        {
          organizationId: "org_vx_1",
          name: "Acme Corp",
          slug: "acme-corp",
          role: "owner",
          merchants: [
            {
              merchantAccountId: "ma_live_1",
              displayName: "Acme Corp",
              environment: "production",
              status: "active",
              chargesApproved: true,
            },
          ],
        },
      ],
    });
    expect(readUserVortexOrganizations(metadata)).toHaveLength(1);
    expect(readUserVortexMerchants(metadata)).toEqual([
      {
        merchantAccountId: "ma_live_1",
        displayName: "Acme Corp",
        environment: "production",
        status: "active",
        chargesApproved: true,
      },
    ]);
    expect(readUserVortexOrganizations("{invalid")).toEqual([]);
  });
});
