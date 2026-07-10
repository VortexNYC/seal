/**
 * Billing Settings Page
 *
 * Route: /{slug}/settings/billing
 */

import { api } from "@seal/backend/convex/_generated/api";
import { createFileRoute } from "@tanstack/react-router";
import {
  VortexPaymentsProvider,
  VortexPlanComparison,
  VortexSubscriptionActionSummary,
  type VortexEmbeddedComponentClassNames,
  type VortexPaymentsEnvironment,
  type VortexPlanComparisonPlan,
  type VortexPlanComparisonState,
  type VortexSubscriptionActionSummaryAction,
  type VortexSubscriptionActionSummaryState,
  type VortexSubscriptionActionSummaryStatus,
} from "@vortexnyc/payments-react";
import { useAction, useQuery } from "convex/react";
import { ExternalLink, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { PageWrapper } from "@/components/page-wrapper";
import { BillingSkeleton } from "@/components/skeletons";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/$slug/settings/billing")({
  component: BillingSettingsPage,
  pendingComponent: BillingSkeleton,
});

type BillingSubscription = {
  readonly status: string;
  readonly currentPeriodEnd: number;
  readonly cancelAtPeriodEnd: boolean;
  readonly trialEnd?: number;
  readonly tier: string;
  readonly planName: string;
  readonly features: string | null;
  readonly unitAmount: number;
  readonly currency: string;
  readonly interval: string;
  readonly intervalCount: number;
};

type AvailablePlanPrice = {
  readonly amount: number;
  readonly currency: string;
  readonly lookupKey: string | null;
};

type AvailablePlan = {
  readonly productId: string;
  readonly name: string;
  readonly description: string | null;
  readonly tier: string | null;
  readonly features: string | null;
  readonly pricing: {
    readonly monthly: AvailablePlanPrice | null;
    readonly yearly: AvailablePlanPrice | null;
  };
};

const featureLabels: Record<string, string> = {
  advanced_analytics: "Advanced analytics",
  api_access: "Full API access",
  audit_trail: "Audit trail",
  custom_branding: "Custom branding",
  mcp_access: "MCP integration",
  multi_user: "Unlimited team members",
  priority_support: "Priority support",
  sso: "Single sign-on",
  templates: "Unlimited templates",
  webhook_access: "Webhooks",
};

const vortexBillingClassNames = {
  actions: "mt-5 flex flex-wrap gap-2",
  button:
    "inline-flex h-9 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-xs transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-50",
  description: "text-muted-foreground text-sm text-pretty",
  empty: "mt-4 rounded-md border border-dashed p-4 text-sm text-muted-foreground",
  error:
    "mt-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive",
  header: "space-y-1.5",
  item: "rounded-md border bg-background p-4",
  itemDescription: "mt-1 text-muted-foreground text-sm text-pretty",
  itemTitle: "block text-base font-semibold text-balance",
  list: "mt-4 grid gap-3 sm:grid-cols-2",
  loading: "mt-4 rounded-md border p-3 text-sm text-muted-foreground",
  metricLabel: "text-muted-foreground",
  metrics: "mt-4 grid gap-3 rounded-md border bg-muted/30 p-4 text-sm sm:grid-cols-2",
  metricValue: "font-medium tabular-nums",
  root: "rounded-lg border bg-card p-6 text-card-foreground shadow-sm",
  status:
    "mt-2 inline-flex w-fit rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground",
  title: "text-lg font-semibold text-balance",
} satisfies VortexEmbeddedComponentClassNames;

function BillingSettingsPage() {
  const subscription = useQuery(api.payments.billing_queries.getSubscriptionDetails) as
    | BillingSubscription
    | null
    | undefined;
  const plans = useQuery(api.payments.billing_queries.getAvailablePlans) as
    | AvailablePlan[]
    | undefined;
  const createCheckout = useAction(api.payments.subscription_actions.createCheckoutSession);
  const createPortal = useAction(api.payments.subscription_actions.createCustomerPortalSession);

  const [checkoutLoadingPlanId, setCheckoutLoadingPlanId] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);

  const currentUrl = window.location.href;
  const isActiveSubscription = subscription?.status === "active";
  const isFreePlan = !subscription || subscription.tier === "free" || !isActiveSubscription;
  const proPlan = plans?.find((plan) => plan.tier === "pro");
  const proMonthlyLookupKey = proPlan?.pricing.monthly?.lookupKey;

  const subscriptionSummary = useMemo(
    () => buildSubscriptionActionSummary(subscription, isFreePlan),
    [isFreePlan, subscription],
  );
  const planComparison = useMemo(
    () => buildPlanComparison(plans, subscription, isFreePlan),
    [isFreePlan, plans, subscription],
  );
  const checkoutLookupKeysByPlanId = useMemo<Record<string, string | null | undefined>>(
    () => ({
      [proPlanId]: proMonthlyLookupKey,
    }),
    [proMonthlyLookupKey],
  );
  const environment = useMemo<VortexPaymentsEnvironment>(
    () => (import.meta.env.PROD ? "production" : "development"),
    [],
  );

  async function handleManageBilling() {
    setPortalLoading(true);
    try {
      const { url } = await createPortal({
        returnUrl: currentUrl,
      });
      window.location.href = url;
    } catch {
      toast.error("Failed to open billing portal. Please try again.");
      setPortalLoading(false);
    }
  }

  async function handlePlanSelect(plan: VortexPlanComparisonPlan) {
    const lookupKey = checkoutLookupKeysByPlanId[plan.id];
    if (!lookupKey) {
      toast.error("This plan is not available for checkout yet.");
      return;
    }

    setCheckoutLoadingPlanId(plan.id);
    try {
      const { checkoutUrl } = await createCheckout({
        lookupKey,
        successUrl: `${window.location.origin}${window.location.pathname}?upgraded=true`,
        cancelUrl: currentUrl,
      });
      window.location.href = checkoutUrl;
    } catch (error) {
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : "Failed to start checkout. Please try again.",
      );
      setCheckoutLoadingPlanId(null);
    }
  }

  function handleSubscriptionAction(actionSummary: VortexSubscriptionActionSummaryState) {
    if (actionSummary.action === "custom") {
      void handleManageBilling();
    }
  }

  return (
    <PageWrapper
      title="Billing"
      headerActions={
        <ManageBillingButton portalLoading={portalLoading} onManageBilling={handleManageBilling} />
      }
    >
      <BillingSettingsContent
        checkoutLoading={checkoutLoadingPlanId !== null}
        environment={environment}
        planComparison={planComparison}
        subscriptionSummary={subscriptionSummary}
        onPlanSelect={handlePlanSelect}
        onSubscriptionAction={handleSubscriptionAction}
      />
    </PageWrapper>
  );
}

function ManageBillingButton({
  portalLoading,
  onManageBilling,
}: {
  readonly portalLoading: boolean;
  readonly onManageBilling: () => void;
}) {
  return (
    <Button variant="outline" size="sm" onClick={onManageBilling} disabled={portalLoading}>
      {portalLoading ? (
        <Loader2 className="mr-2 size-4 animate-spin" />
      ) : (
        <ExternalLink className="mr-2 size-4" />
      )}
      Manage Billing
    </Button>
  );
}

function BillingSettingsContent({
  checkoutLoading,
  environment,
  planComparison,
  subscriptionSummary,
  onPlanSelect,
  onSubscriptionAction,
}: {
  readonly checkoutLoading: boolean;
  readonly environment: VortexPaymentsEnvironment;
  readonly planComparison: VortexPlanComparisonState;
  readonly subscriptionSummary: VortexSubscriptionActionSummaryState;
  readonly onPlanSelect: (plan: VortexPlanComparisonPlan) => void;
  readonly onSubscriptionAction: (actionSummary: VortexSubscriptionActionSummaryState) => void;
}) {
  return (
    <div className="space-y-6">
      <p className="text-muted-foreground text-sm text-pretty">
        Manage your subscription and billing information.
      </p>

      <VortexPaymentsProvider
        config={{
          baseUrl: window.location.origin,
          environment,
          branding: { brandName: "Seal" },
        }}
        navigate={() => undefined}
      >
        <div className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.25fr)]">
          <VortexSubscriptionActionSummary
            subscription={subscriptionSummary}
            classNames={vortexBillingClassNames}
            copy={{
              customActionLabel: "Manage billing",
              title: "Current subscription",
            }}
            onAction={onSubscriptionAction}
          />
          <VortexPlanComparison
            comparison={planComparison}
            classNames={vortexBillingClassNames}
            disabled={checkoutLoading}
            loading={checkoutLoading}
            copy={{
              currentButtonLabel: "Current plan",
              loadingTitle: "Opening checkout...",
              openCheckoutLabel: "Upgrade",
              selectPlanLabel: "Select plan",
              title: "Plans",
            }}
            onPlanSelect={onPlanSelect}
          />
        </div>
      </VortexPaymentsProvider>
    </div>
  );
}

const freePlanId = "vortex-plan-free";
const proPlanId = "vortex-plan-professional";

function buildSubscriptionActionSummary(
  subscription: BillingSubscription | null | undefined,
  isFreePlan: boolean,
): VortexSubscriptionActionSummaryState {
  const status = subscriptionActionStatus(subscription, isFreePlan);
  const action = subscriptionAction(status);
  const planLabel = isFreePlan ? "Free" : (subscription?.planName ?? "Professional");
  const renewalAt = subscriptionRenewalAt(subscription);
  const scheduledCancelAt = subscriptionScheduledCancelAt(subscription);

  return {
    action,
    actionDisabledReason: action === "change_plan" ? "Choose a paid plan below." : undefined,
    amountDue: isFreePlan ? undefined : subscription?.unitAmount,
    cadenceLabel: isFreePlan ? "Monthly" : subscriptionCadenceLabel(subscription),
    currency: subscription?.currency ?? "usd",
    customerId: "current-organization",
    description: subscriptionActionMessage(subscription, isFreePlan),
    planLabel,
    renewalAt,
    scheduledCancelAt,
    status,
    title: planLabel,
    trialEndsAt: formatDate(subscription?.trialEnd),
  };
}

function buildPlanComparison(
  plans: readonly AvailablePlan[] | undefined,
  subscription: BillingSubscription | null | undefined,
  isFreePlan: boolean,
): VortexPlanComparisonState {
  const proPlan = plans?.find((plan) => plan.tier === "pro");
  const proMonthly = proPlan?.pricing.monthly;
  const hasProCheckout = Boolean(proMonthly?.lookupKey);
  const planRows: VortexPlanComparisonPlan[] = [freePlanRow(isFreePlan)];

  if (proPlan && proMonthly) {
    planRows.push({
      cadence: "monthly",
      cadenceLabel: "Monthly",
      currency: proMonthly.currency,
      description: proPlan.description ?? "Advanced workspace, API, and automation features.",
      disabledReason: hasProCheckout ? undefined : "Checkout is not configured for this plan.",
      featureHighlights: parseFeatureHighlights(proPlan.features),
      id: proPlanId,
      priceAmount: Math.round(proMonthly.amount * 100),
      status: isFreePlan ? "recommended" : "current",
      title: proPlan.name,
    });
  }

  return {
    currentPlanId: isFreePlan ? freePlanId : proPlanId,
    customerId: "current-organization",
    message:
      subscription?.status === "past_due"
        ? "Your payment is past due. Update billing to avoid service interruption."
        : undefined,
    plans: planRows,
    recommendedPlanId: isFreePlan && proPlan ? proPlanId : undefined,
    status: planRows.length > 1 ? "ready" : "empty",
  };
}

function freePlanRow(isFreePlan: boolean): VortexPlanComparisonPlan {
  return {
    cadence: "monthly",
    cadenceLabel: "Monthly",
    currency: "usd",
    description: "Core signing and document workflows.",
    featureHighlights: ["Document signing", "Basic workspace features"],
    id: freePlanId,
    priceAmount: 0,
    status: isFreePlan ? "current" : "available",
    title: "Free",
  };
}

function subscriptionActionStatus(
  subscription: BillingSubscription | null | undefined,
  isFreePlan: boolean,
): VortexSubscriptionActionSummaryStatus {
  if (isFreePlan) return "none";
  if (subscription?.cancelAtPeriodEnd) return "scheduled_cancellation";
  if (subscription?.status === "past_due" || subscription?.status === "unpaid") return "past_due";
  if (subscription?.status === "canceled") return "canceled";
  if (subscription?.trialEnd && subscription.trialEnd > Date.now()) return "trialing";
  return "active";
}

function subscriptionAction(
  status: VortexSubscriptionActionSummaryStatus,
): VortexSubscriptionActionSummaryAction {
  return status === "none" ? "change_plan" : "custom";
}

function subscriptionActionMessage(
  subscription: BillingSubscription | null | undefined,
  isFreePlan: boolean,
): string {
  if (isFreePlan) return "Upgrade when you need API access, webhooks, and team scale.";
  if (subscription?.cancelAtPeriodEnd) {
    return `Access continues until ${formatDate(subscription.currentPeriodEnd)}.`;
  }
  if (subscription?.status === "past_due") {
    return "Your latest payment needs attention.";
  }
  return "Your paid workspace billing is active.";
}

function subscriptionRenewalAt(
  subscription: BillingSubscription | null | undefined,
): string | undefined {
  if (subscription?.cancelAtPeriodEnd) return undefined;
  return formatDate(subscription?.currentPeriodEnd);
}

function subscriptionScheduledCancelAt(
  subscription: BillingSubscription | null | undefined,
): string | undefined {
  if (!subscription?.cancelAtPeriodEnd) return undefined;
  return formatDate(subscription.currentPeriodEnd);
}

function subscriptionCadenceLabel(subscription: BillingSubscription | null | undefined): string {
  if (!subscription) return "Monthly";
  const interval =
    subscription.intervalCount === 1
      ? subscription.interval
      : `${subscription.intervalCount} ${subscription.interval}s`;
  return interval.charAt(0).toUpperCase() + interval.slice(1);
}

function parseFeatureHighlights(features: string | null): readonly string[] {
  const parsed = features
    ?.split(",")
    .map((feature) => feature.trim())
    .filter((feature) => feature.length > 0)
    .map(formatFeatureLabel);

  return parsed && parsed.length > 0
    ? parsed
    : ["API access", "Webhooks", "MCP integration", "Advanced analytics"];
}

function formatFeatureLabel(raw: string): string {
  return (
    featureLabels[raw] ?? raw.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase())
  );
}

function formatDate(timestamp: number | undefined): string | undefined {
  if (timestamp === undefined) return undefined;
  return new Date(timestamp).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
