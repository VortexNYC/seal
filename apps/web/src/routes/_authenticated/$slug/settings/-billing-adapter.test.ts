import { describe, expect, it } from "vitest";

import {
  buildVortexPlanComparison,
  buildVortexSubscriptionSummary,
  formatFeatureLabel,
  toCadence,
  toVortexSubscriptionStatus,
  type SealBillingPlan,
  type SealBillingSubscription,
} from "./-billing-adapter";

const periodEnd = Date.UTC(2026, 5, 30);

const activeProSubscription: SealBillingSubscription = {
  status: "active",
  currentPeriodEnd: periodEnd,
  cancelAtPeriodEnd: false,
  tier: "pro",
  planName: "Professional",
  unitAmount: 2900,
  currency: "usd",
  interval: "month",
  intervalCount: 1,
};

const proPlan: SealBillingPlan = {
  name: "Professional",
  description: "Advanced workspace features.",
  tier: "pro",
  features: "api_access, custom_branding, unknown_feature",
  pricing: {
    monthly: {
      amount: 29,
      currency: "usd",
      lookupKey: "seal_pro_monthly",
    },
    yearly: null,
  },
};

describe("Seal billing Vortex adapter", () => {
  it("maps subscription statuses into Vortex subscription statuses", () => {
    expect(toVortexSubscriptionStatus("active", false)).toBe("active");
    expect(toVortexSubscriptionStatus("active", true)).toBe("scheduled_cancellation");
    expect(toVortexSubscriptionStatus("past_due", false)).toBe("past_due");
    expect(toVortexSubscriptionStatus("incomplete", false)).toBe("payment_action_required");
    expect(toVortexSubscriptionStatus("unpaid", false)).toBe("payment_action_required");
    expect(toVortexSubscriptionStatus("canceled", true)).toBe("canceled");
  });

  it("maps Stripe recurring intervals to Vortex cadences", () => {
    expect(toCadence("month")).toBe("monthly");
    expect(toCadence("year")).toBe("yearly");
    expect(toCadence("week")).toBe("custom");
    expect(toCadence("unknown")).toBe("custom");
  });

  it("normalizes known and unknown feature labels", () => {
    expect(formatFeatureLabel("api_access")).toBe("Full API access");
    expect(formatFeatureLabel("custom_limit")).toBe("Custom Limit");
  });

  it("builds a free subscription summary when no subscription exists", () => {
    const summary = buildVortexSubscriptionSummary({
      customerId: "seal:acme",
      subscription: null,
    });

    expect(summary.status).toBe("none");
    expect(summary.title).toBe("Free plan");
    expect(summary.action).toBe("change_plan");
    expect(summary.actionDisabledReason).toBe("Choose a Professional plan below.");
  });

  it("builds an active subscription summary without provider ids", () => {
    const summary = buildVortexSubscriptionSummary({
      customerId: "seal:acme",
      subscription: activeProSubscription,
    });

    expect(summary.status).toBe("active");
    expect(summary.title).toBe("Professional plan");
    expect(summary.planLabel).toBe("Professional");
    expect(summary.amountDue).toBe(2900);
    expect(summary.currency).toBe("usd");
    expect(summary.action).toBe("open_portal");
    expect(summary.subscriptionId).toBeUndefined();
  });

  it("builds a plan comparison from Seal plan snapshots", () => {
    const comparison = buildVortexPlanComparison({
      customerId: "seal:acme",
      plans: [proPlan],
      subscription: null,
      selectedLookupKey: "seal_pro_monthly",
      checkoutReturnPath: "/acme/settings/billing",
    });

    expect(comparison.status).toBe("ready");
    expect(comparison.currentPlanId).toBe("free");
    expect(comparison.selectedPlanId).toBe("seal_pro_monthly");
    expect(comparison.plans).toHaveLength(2);
    expect(comparison.plans[1]).toMatchObject({
      id: "pro",
      lookupKey: "seal_pro_monthly",
      status: "recommended",
      priceAmount: 2900,
      currency: "usd",
      featureHighlights: ["Full API access", "Custom branding", "Unknown Feature"],
    });
  });

  it("marks the pro plan current for active pro subscriptions", () => {
    const comparison = buildVortexPlanComparison({
      customerId: "seal:acme",
      plans: [proPlan],
      subscription: activeProSubscription,
      selectedLookupKey: null,
      checkoutReturnPath: "/acme/settings/billing",
    });

    expect(comparison.currentPlanId).toBe("pro");
    expect(comparison.plans[0]?.status).toBe("available");
    expect(comparison.plans[1]?.status).toBe("current");
  });
});
