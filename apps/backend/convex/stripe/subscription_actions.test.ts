import { afterEach, describe, expect, test } from "vitest";

import type { Id } from "../_generated/dataModel";
import type { ActionCtx } from "../_generated/server";
import { handleNewOrgCreated, syncSeatCount } from "./subscription_actions";

type HandleNewOrgCreatedHandler = (
  ctx: ActionCtx,
  args: {
    readonly organizationId: Id<"organizations">;
    readonly orgName: string;
    readonly adminEmail: string;
  },
) => Promise<{
  readonly enrolled: boolean;
  readonly skippedReason?: "vortex_billing";
  readonly stripeCustomerId?: string;
}>;

type SyncSeatCountHandler = (
  ctx: ActionCtx,
  args: { readonly organizationId: Id<"organizations"> },
) => Promise<void>;

const handleNewOrgCreatedHandler = (
  handleNewOrgCreated as unknown as { readonly _handler: HandleNewOrgCreatedHandler }
)._handler;

const syncSeatCountHandler = (
  syncSeatCount as unknown as { readonly _handler: SyncSeatCountHandler }
)._handler;

const organizationId = "org_seal_123" as Id<"organizations">;

describe("stripe/subscription_actions Vortex Billing guards", () => {
  afterEach(() => {
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.VORTEX_BILLING_SAAS_ORGANIZATION_IDS;
  });

  test("does not create a Stripe customer for Vortex Billing SaaS organizations", async () => {
    process.env.VORTEX_BILLING_SAAS_ORGANIZATION_IDS = JSON.stringify([organizationId]);

    await expect(
      handleNewOrgCreatedHandler({} as ActionCtx, {
        organizationId,
        orgName: "Seal Test Org",
        adminEmail: "admin@seal.test",
      }),
    ).resolves.toEqual({ enrolled: false, skippedReason: "vortex_billing" });
  });

  test("does not initialize Stripe for Vortex Billing seat sync", async () => {
    process.env.VORTEX_BILLING_SAAS_ORGANIZATION_IDS = JSON.stringify([organizationId]);

    await expect(
      syncSeatCountHandler({} as ActionCtx, {
        organizationId,
      }),
    ).resolves.toBeUndefined();
  });
});
