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
  type VortexSurfaceLaunch,
} from "@vortex/payments/react";
import { useAction, useQuery } from "convex/react";
import { useState } from "react";
import { toast } from "sonner";

import { PageWrapper } from "@/components/page-wrapper";
import { BillingSkeleton } from "@/components/skeletons";

import {
  buildVortexPlanComparison,
  buildVortexSubscriptionSummary,
  type SealBillingPlan,
  type SealBillingSubscription,
} from "./-billing-adapter";

export const Route = createFileRoute("/_authenticated/$slug/settings/billing")({
  component: BillingSettingsPage,
  pendingComponent: BillingSkeleton,
});

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

  const typedSubscription = subscription as SealBillingSubscription | null | undefined;
  const typedPlans = plans as readonly SealBillingPlan[] | undefined;

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
  const currentSubscriptionSummary = buildVortexSubscriptionSummary({
    customerId,
    subscription: typedSubscription ?? null,
  });
  const planComparison = buildVortexPlanComparison({
    customerId,
    plans: typedPlans,
    subscription: typedSubscription ?? null,
    selectedLookupKey: checkoutLookupKey,
    checkoutReturnPath: returnPath,
  });

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
