import { v } from "convex/values";

import { internalAction } from "../_generated/server";
import { readVortexBillingEnvFromProcess } from "../vortex_billing/payable_env.helpers";
import {
  createVortexBillingClient,
  readVortexProductAccess,
  resolveVortexBillingCustomerExternalId,
} from "./vortex_billing_processor.helpers";

/**
 * Read a Vortex product entitlement for an organization (VOR-67).
 *
 * COLD-PATH, CROSS-PRODUCT reader. Product access is owned by Vortex Payments (billing-derived);
 * Seal reads it live through its existing Vortex Connect client.
 *
 * Do NOT route hot within-Sign tier gates through this — those stay on Seal's local subscription
 * mirror (`auth/subscription_guards.ts`), which is cheaper and already billing-derived. The live
 * read earns its keep for OTHER products the org may hold that Seal has no local mirror for
 * (e.g. `vortex.invoice`, `vortex.finance`): cross-product unlocks and upsell surfaces.
 *
 * Returns the product-entitlement dimension only — money-in readiness (sub-merchant onboarding)
 * is a separate Payments read; money movement gates on `entitled AND moneyInReady`.
 */
export const readOrganizationVortexProductAccess = internalAction({
  args: { organizationId: v.id("organizations"), product: v.string() },
  handler: async (_ctx, { organizationId, product }) => {
    const env = readVortexBillingEnvFromProcess();
    const customerExternalId = resolveVortexBillingCustomerExternalId(
      organizationId,
      process.env
    );
    const client = createVortexBillingClient({
      apiBaseUrl: env.apiBaseUrl,
      apiKey: env.apiKey,
    });
    return await readVortexProductAccess({
      client,
      customerExternalId,
      product,
    });
  },
});
