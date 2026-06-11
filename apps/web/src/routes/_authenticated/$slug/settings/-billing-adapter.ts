import type {
  VortexPlanComparisonPlan,
  VortexPlanComparisonState,
  VortexSubscriptionActionSummaryState,
} from "@vortex/payments/react";

export type SealBillingSubscriptionStatus =
  | "active"
  | "trialing"
  | "canceled"
  | "past_due"
  | "incomplete"
  | "incomplete_expired"
  | "unpaid";

export type SealBillingSubscription = {
  readonly status: SealBillingSubscriptionStatus;
  readonly currentPeriodEnd: number;
  readonly cancelAtPeriodEnd: boolean;
  readonly trialEnd?: number | null;
  readonly tier?: string | null;
  readonly planName?: string | null;
  readonly unitAmount: number;
  readonly currency: string;
  readonly interval: string;
  readonly intervalCount: number;
};

export type SealBillingPlanPrice = {
  readonly amount: number;
  readonly currency: string;
  readonly lookupKey: string | null;
};

export type SealBillingPlan = {
  readonly name: string;
  readonly description?: string | null;
  readonly tier?: string | null;
  readonly features?: string | null;
  readonly pricing: {
    readonly monthly: SealBillingPlanPrice | null;
    readonly yearly: SealBillingPlanPrice | null;
  };
};

export function toVortexSubscriptionStatus(
  status: SealBillingSubscriptionStatus,
  cancelAtPeriodEnd: boolean,
): VortexSubscriptionActionSummaryState["status"] {
  if (cancelAtPeriodEnd && status !== "canceled") {
    return "scheduled_cancellation";
  }
  switch (status) {
    case "active":
      return "active";
    case "trialing":
      return "trialing";
    case "past_due":
      return "past_due";
    case "canceled":
      return "canceled";
    case "incomplete":
    case "incomplete_expired":
    case "unpaid":
      return "payment_action_required";
  }
}

export function toCadence(interval: string): VortexPlanComparisonPlan["cadence"] {
  switch (interval) {
    case "month":
      return "monthly";
    case "year":
      return "yearly";
    case "week":
    case "day":
      return "custom";
    default:
      return "custom";
  }
}

const featureLabels: Record<string, string> = {
  api_access: "Full API access",
  webhook_access: "Webhooks",
  mcp_access: "MCP integration",
  multi_user: "Unlimited team members",
  priority_support: "Priority support",
  custom_branding: "Custom branding",
  advanced_analytics: "Advanced analytics",
  audit_trail: "Audit trail",
  sso: "Single sign-on (SSO)",
  templates: "Unlimited templates",
};

export function formatFeatureLabel(raw: string): string {
  const trimmed = raw.trim();
  return (
    featureLabels[trimmed] ?? trimmed.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

export function formatBillingDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function buildVortexSubscriptionSummary(args: {
  readonly customerId: string;
  readonly subscription: SealBillingSubscription | null;
}): VortexSubscriptionActionSummaryState {
  const { customerId, subscription } = args;
  if (!subscription) {
    return {
      customerId,
      status: "none",
      title: "Free plan",
      description: "You are on the Free plan.",
      planLabel: "Free",
      cadenceLabel: "monthly",
      nextAction: "Upgrade when you need the Professional workspace limits.",
      action: "change_plan",
      actionDisabledReason: "Choose a Professional plan below.",
    };
  }

  const isActiveSubscription = subscription.status === "active";
  const isFreePlan =
    subscription.tier === "free" || subscription.tier === null || !isActiveSubscription;

  return {
    customerId,
    status: toVortexSubscriptionStatus(subscription.status, subscription.cancelAtPeriodEnd),
    title: isFreePlan ? "Free plan" : `${subscription.planName ?? "Professional"} plan`,
    description: isFreePlan
      ? "You are on the Free plan."
      : "Your workspace subscription is active through Vortex Payments.",
    planLabel: subscription.planName ?? "Free",
    cadenceLabel:
      subscription.intervalCount === 1
        ? subscription.interval
        : `${subscription.intervalCount} ${subscription.interval}s`,
    renewalAt:
      subscription.status !== "canceled" && !subscription.cancelAtPeriodEnd
        ? formatBillingDate(subscription.currentPeriodEnd)
        : undefined,
    trialEndsAt: subscription.trialEnd ? formatBillingDate(subscription.trialEnd) : undefined,
    scheduledCancelAt: subscription.cancelAtPeriodEnd
      ? formatBillingDate(subscription.currentPeriodEnd)
      : undefined,
    amountDue: subscription.unitAmount,
    currency: subscription.currency,
    nextAction:
      subscription.status === "past_due"
        ? "Update payment method to avoid service interruption."
        : isFreePlan
          ? "Upgrade when you need the Professional workspace limits."
          : "Manage plan changes from billing.",
    action: isFreePlan ? "change_plan" : "open_portal",
    actionDisabledReason: isFreePlan
      ? "Choose a Professional plan below."
      : "Hosted subscription management is not enabled for this workspace yet.",
  };
}

export function buildVortexPlanComparison(args: {
  readonly customerId: string;
  readonly plans: readonly SealBillingPlan[] | undefined;
  readonly subscription: SealBillingSubscription | null;
  readonly selectedLookupKey: string | null;
  readonly checkoutReturnPath: string;
}): VortexPlanComparisonState {
  const { customerId, plans, subscription, selectedLookupKey, checkoutReturnPath } = args;
  const isActiveSubscription = subscription?.status === "active";
  const isFreePlan = !subscription || subscription.tier === "free" || !isActiveSubscription;
  const proPlan = plans?.find((plan) => plan.tier === "pro");
  const proMonthlyPrice = proPlan?.pricing.monthly;
  const proPlanComparisonPlan: VortexPlanComparisonPlan | null =
    proPlan === undefined || !proMonthlyPrice?.lookupKey
      ? null
      : {
          id: "pro",
          lookupKey: proMonthlyPrice.lookupKey,
          status: !isFreePlan && subscription?.tier === proPlan.tier ? "current" : "recommended",
          title: proPlan.name,
          description: proPlan.description ?? undefined,
          priceAmount: Math.round(proMonthlyPrice.amount * 100),
          currency: proMonthlyPrice.currency,
          cadence: toCadence("month"),
          cadenceLabel: "month",
          featureHighlights: (proPlan.features ?? "")
            .split(",")
            .map((feature) => feature.trim())
            .filter((feature) => feature.length > 0)
            .map(formatFeatureLabel),
        };

  return {
    customerId,
    status: plans === undefined ? "empty" : plans.length === 0 ? "empty" : "ready",
    currentPlanId: isFreePlan ? "free" : (subscription?.tier ?? undefined),
    recommendedPlanId: "pro",
    selectedPlanId: selectedLookupKey ?? undefined,
    checkoutReturnPath,
    plans: [
      {
        id: "free",
        status: isFreePlan ? "current" : "available",
        title: "Free",
        description: "Start signing documents without paid workspace features.",
        priceAmount: 0,
        currency: "usd",
        cadence: "monthly",
        cadenceLabel: "month",
        featureHighlights: ["Basic document signing", "Starter workspace limits"],
      },
      ...(proPlanComparisonPlan === null ? [] : [proPlanComparisonPlan]),
    ],
  };
}
