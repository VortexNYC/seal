/**
 * Billing Settings Page
 *
 * Manage organization billing and subscription.
 * - Subscription summary: Vortex package surface
 * - Plan comparison: Vortex package surface
 * - Upgrade: Vortex hosted checkout redirect
 *
 * Route: /{slug}/settings/billing
 */

import { api } from "@seal/backend/convex/_generated/api";
import { createFileRoute } from "@tanstack/react-router";
import {
  VortexPlanComparison,
  VortexPaymentsProvider,
  VortexSubscriptionActionSummary,
  type VortexEmbeddedComponentClassNames,
  type VortexPlanComparisonPlan,
  type VortexPlanComparisonState,
  type VortexSubscriptionActionSummaryState,
  type VortexSurfaceLaunch,
} from "@vortex/payments/react";
import { useAction, useQuery } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";

import { PageWrapper } from "@/components/page-wrapper";
import { BillingSkeleton } from "@/components/skeletons";

export const Route = createFileRoute("/_authenticated/$slug/settings/billing")({
  component: BillingSettingsPage,
  pendingComponent: BillingSkeleton,
});

type SubscriptionStatus =
  | "active"
  | "trialing"
  | "canceled"
  | "past_due"
  | "incomplete"
  | "incomplete_expired"
  | "unpaid";

function toVortexSubscriptionStatus(
  status: SubscriptionStatus,
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
    default:
      return "none";
  }
}

function toCadence(interval: string): VortexPlanComparisonPlan["cadence"] {
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

function formatFeatureLabel(raw: string): string {
  const trimmed = raw.trim();
  return (
    featureLabels[trimmed] ?? trimmed.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function buildClassNames(): VortexEmbeddedComponentClassNames {
  return {
    root: "rounded-lg border bg-card p-6 text-card-foreground shadow-sm",
    header: "space-y-1.5",
    title: "text-lg font-semibold text-balance",
    description: "text-muted-foreground text-sm text-pretty",
    metrics: "mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4",
    metricLabel: "text-muted-foreground block text-xs font-medium",
    metricValue: "mt-1 block font-medium tabular-nums",
    list: "mt-4 grid gap-3 md:grid-cols-2",
    item: "rounded-md border bg-background p-4",
    itemTitle: "font-medium text-balance",
    itemDescription: "text-muted-foreground mt-1 text-sm text-pretty",
    status: "text-muted-foreground mt-2 text-sm text-pretty",
    actions: "mt-4 flex flex-wrap gap-2",
    button:
      "inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
    empty: "bg-muted text-muted-foreground mt-4 rounded-md p-4 text-sm",
    loading: "text-muted-foreground mt-4 flex items-center gap-2 text-sm",
    error: "text-destructive bg-destructive/10 mt-4 rounded-md p-3 text-sm",
  };
}

function BillingSettingsPage() {
  const subscription = useQuery(api.stripe.queries.getSubscriptionDetails);
  const plans = useQuery(api.stripe.queries.getAvailablePlans);
  const checkoutProvider = useQuery(api.vortex_billing.subscription_actions.getCheckoutProvider);
  const createVortexCheckout = useAction(
    api.vortex_billing.subscription_actions.createCheckoutSession,
  );
  const createStripeCheckout = useAction(api.stripe.actions.createCheckoutSession);
  const { slug } = Route.useParams();

  const [checkoutLookupKey, setCheckoutLookupKey] = useState<string | null>(null);

  const isActiveSubscription = subscription?.status === "active";
  const isFreePlan = !subscription || subscription.tier === "free" || !isActiveSubscription;

  async function createVortexCheckoutSession({ lookupKey }: { readonly lookupKey: string }) {
    setCheckoutLookupKey(lookupKey);
    try {
      return await createVortexCheckout({ lookupKey });
    } catch (err) {
      setCheckoutLookupKey(null);
      throw err;
    }
  }

  function handleVortexCheckoutError(err: unknown) {
    toast.error(
      err instanceof Error && err.message
        ? err.message
        : "Failed to start checkout. Please try again.",
    );
    setCheckoutLookupKey(null);
  }

  function navigateToVortexCheckout(launch: VortexSurfaceLaunch) {
    window.location.href = launch.url;
  }

  async function handleStripeUpgrade(lookupKey: string) {
    setCheckoutLookupKey(lookupKey);
    try {
      if (checkoutProvider === undefined) {
        throw new Error("Billing provider is still loading");
      }

      const returnUrl = `${window.location.origin}/${slug}/settings/billing`;
      const { url } = await createStripeCheckout({
        lookupKey,
        successUrl: `${returnUrl}?checkout=success`,
        cancelUrl: `${returnUrl}?checkout=canceled`,
      });
      window.location.href = url;
    } catch (err) {
      toast.error(
        err instanceof Error && err.message
          ? err.message
          : "Failed to start checkout. Please try again.",
      );
      setCheckoutLookupKey(null);
    }
  }

  const checkoutLoading = checkoutLookupKey !== null || checkoutProvider === undefined;
  const proPlan = plans?.find((plan) => plan.tier === "pro");
  const vortexPaymentsConfig = {
    baseUrl: window.location.origin,
    environment: "production" as const,
    organizationId: slug,
    branding: {
      brandName: "Seal",
      showVortexBrand: true,
    },
  };
  const vortexClassNames = buildClassNames();
  const customerId = `seal:${slug}`;
  const returnPath = `/${slug}/settings/billing`;
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
            .map((feature: string) => feature.trim())
            .filter((feature: string) => feature.length > 0)
            .map(formatFeatureLabel),
        };

  const currentSubscriptionSummary: VortexSubscriptionActionSummaryState = subscription
    ? {
        customerId,
        status: toVortexSubscriptionStatus(
          subscription.status as SubscriptionStatus,
          subscription.cancelAtPeriodEnd,
        ),
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
            ? formatDate(subscription.currentPeriodEnd)
            : undefined,
        trialEndsAt: subscription.trialEnd ? formatDate(subscription.trialEnd) : undefined,
        scheduledCancelAt: subscription.cancelAtPeriodEnd
          ? formatDate(subscription.currentPeriodEnd)
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
      }
    : {
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

  const planComparison: VortexPlanComparisonState = {
    customerId,
    status: plans === undefined ? "empty" : plans.length === 0 ? "empty" : "ready",
    currentPlanId: isFreePlan ? "free" : (subscription?.tier ?? undefined),
    recommendedPlanId: "pro",
    selectedPlanId: checkoutLookupKey ?? undefined,
    checkoutReturnPath: returnPath,
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

  async function handlePlanSelect(plan: VortexPlanComparisonPlan) {
    if (!plan.lookupKey || plan.status === "current" || plan.status === "disabled") {
      return;
    }
    if (checkoutProvider?.provider === "vortex_billing") {
      try {
        const launch = await createVortexCheckoutSession({ lookupKey: plan.lookupKey });
        navigateToVortexCheckout({
          surface: "checkout",
          url: launch.checkoutUrl,
          mode: "hosted_redirect",
        });
      } catch (err) {
        handleVortexCheckoutError(err);
      }
      return;
    }
    await handleStripeUpgrade(plan.lookupKey);
  }

  return (
    <PageWrapper title="Billing">
      <div className="space-y-6">
        <p className="text-muted-foreground text-sm">
          Manage your subscription and billing information
        </p>

        <VortexPaymentsProvider config={vortexPaymentsConfig} navigate={navigateToVortexCheckout}>
          <div className="grid gap-6">
            <VortexSubscriptionActionSummary
              subscription={currentSubscriptionSummary}
              classNames={vortexClassNames}
              loading={subscription === undefined}
              disabled={checkoutLoading}
            />
            <VortexPlanComparison
              comparison={planComparison}
              classNames={vortexClassNames}
              loading={plans === undefined || checkoutProvider === undefined}
              disabled={checkoutLoading}
              onPlanSelect={(plan) => {
                void handlePlanSelect(plan);
              }}
            />
          </div>
        </VortexPaymentsProvider>
      </div>
    </PageWrapper>
  );
}
