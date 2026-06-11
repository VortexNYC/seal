import type { Id } from "@seal/backend/convex/_generated/dataModel";
import { describe, expect, it } from "vitest";

import {
  buildPayoutProfile,
  buildVortexMerchantAccount,
  buildVortexMerchantState,
  getRequirementIds,
  toMerchantStatus,
} from "./payments";

const stripeAccountId = "stripe_account_1" as Id<"stripe_accounts">;
const restrictedStripeAccountId = "stripe_account_2" as Id<"stripe_accounts">;

describe("payments settings Vortex merchant adapters", () => {
  it("maps Seal connection status into Vortex merchant status", () => {
    expect(toMerchantStatus("not_connected")).toBe("draft");
    expect(toMerchantStatus("pending")).toBe("pending_review");
    expect(toMerchantStatus("restricted")).toBe("restricted");
    expect(toMerchantStatus("connected")).toBe("active");
  });

  it("deduplicates open Stripe requirement ids for Vortex action surfaces", () => {
    expect(
      getRequirementIds({
        _id: stripeAccountId,
        stripeAccountId: "acct_123",
        accountType: "express",
        chargesEnabled: false,
        payoutsEnabled: false,
        detailsSubmitted: true,
        feeHandling: "absorb",
        requirements: {
          currentlyDue: ["external_account", "representative.first_name"],
          eventuallyDue: ["external_account"],
          pastDue: ["business_profile.url"],
          disabledReason: "requirements.past_due",
        },
      }),
    ).toEqual(["external_account", "representative.first_name", "business_profile.url"]);
  });

  it("keeps legacy Stripe ids as processor refs without exposing Stripe UI state", () => {
    const merchantAccount = buildVortexMerchantAccount({
      slug: "acme",
      organizationName: "Acme",
      status: "connected",
      account: {
        _id: stripeAccountId,
        stripeAccountId: "acct_123",
        accountType: "express",
        chargesEnabled: true,
        payoutsEnabled: true,
        detailsSubmitted: true,
        feeHandling: "pass_to_recipient",
      },
    });
    const merchantState = buildVortexMerchantState({
      merchantAccountId: merchantAccount.id,
      status: "connected",
      account: {
        _id: stripeAccountId,
        stripeAccountId: "acct_123",
        accountType: "express",
        chargesEnabled: true,
        payoutsEnabled: true,
        detailsSubmitted: true,
        feeHandling: "pass_to_recipient",
      },
    });
    const payoutProfile = buildPayoutProfile(merchantState);

    expect(merchantAccount).toMatchObject({
      id: "acct_123",
      tenantId: "seal:acme",
      externalMerchantRef: "acme",
      displayName: "Acme",
      status: "active",
      capabilityStatus: "active",
      processorAccountRefs: [{
        provider: "stripe",
        objectType: "account",
        objectId: "acct_123",
        relationship: "legacy_processor_account",
      }],
    });
    expect(merchantState).toMatchObject({
      merchantAccountId: "acct_123",
      merchantStatus: "active",
      onboardingStatus: "approved",
      activeCapabilityKeys: ["card_payments", "payouts"],
      restrictedCapabilityKeys: [],
      canAcceptPayments: true,
      payoutReadiness: "ready",
    });
    expect(payoutProfile).toMatchObject({
      merchantAccountId: "acct_123",
      mode: "net",
      payoutRail: "next_day_ach",
      payoutSchedule: "daily",
      fundingRequirement: "standard",
    });
  });

  it("marks restricted accounts as blocked for payments and payouts", () => {
    const merchantState = buildVortexMerchantState({
      merchantAccountId: "acct_restricted",
      status: "restricted",
      account: {
        _id: restrictedStripeAccountId,
        stripeAccountId: "acct_restricted",
        accountType: "express",
        chargesEnabled: false,
        payoutsEnabled: false,
        detailsSubmitted: true,
        feeHandling: "absorb",
        requirements: {
          currentlyDue: ["external_account"],
          eventuallyDue: [],
          pastDue: [],
          disabledReason: "requirements.currently_due",
        },
      },
    });
    const payoutProfile = buildPayoutProfile(merchantState);

    expect(merchantState).toMatchObject({
      merchantStatus: "restricted",
      onboardingStatus: "action_required",
      openRequirementIds: ["external_account"],
      restrictedCapabilityKeys: ["card_payments", "payouts"],
      canAcceptPayments: false,
      payoutReadiness: "blocked",
      payoutBlockReason: "requirements.currently_due",
    });
    expect(payoutProfile).toMatchObject({
      payoutRail: "unknown",
      fundingRequirement: "requirements_due",
      capabilities: [{
        key: "standard_next_day_ach",
        status: "disabled",
        reason: "requirements.currently_due",
        source: "operator_policy",
      }, {
        key: "sub_merchant_payee_payment",
        status: "disabled",
        reason: "Payment collection is not ready.",
        source: "operator_policy",
      }],
    });
  });
});
