/**
 * Billing Settings Page
 *
 * Manage organization billing and subscription.
 * - Free plan: single card with current plan + Pro upgrade side by side
 * - Pro plan: single card with plan details and feature list
 * - Upgrade: Vortex hosted checkout redirect
 *
 * Route: /{slug}/settings/billing
 */

import { api } from "@seal/backend/convex/_generated/api";
import { createFileRoute } from "@tanstack/react-router";
import { useAction, useQuery } from "convex/react";
import { Check, CreditCard, Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { PageWrapper } from "@/components/page-wrapper";
import { BillingSkeleton } from "@/components/skeletons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";

export const Route = createFileRoute("/_authenticated/$slug/settings/billing")({
  component: BillingSettingsPage,
  pendingComponent: BillingSkeleton,
});

type SubscriptionStatus =
  | "active"
  | "canceled"
  | "past_due"
  | "incomplete"
  | "incomplete_expired"
  | "unpaid";

function getStatusBadge(status: SubscriptionStatus, cancelAtPeriodEnd: boolean) {
  if (cancelAtPeriodEnd) {
    return <Badge variant="outline">Canceling</Badge>;
  }

  switch (status) {
    case "active":
      return <Badge>Active</Badge>;
    case "past_due":
      return <Badge variant="destructive">Past Due</Badge>;
    case "canceled":
      return <Badge variant="outline">Canceled</Badge>;
    case "incomplete":
    case "incomplete_expired":
    case "unpaid":
      return <Badge variant="destructive">{status.replace("_", " ")}</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function formatPrice(amount: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatInterval(interval: string, intervalCount: number) {
  if (intervalCount === 1) {
    return `/${interval}`;
  }
  return `/ ${intervalCount} ${interval}s`;
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

function formatDate(timestamp: number) {
  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
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

  async function handleUpgrade(lookupKey: string) {
    setCheckoutLookupKey(lookupKey);
    try {
      if (checkoutProvider === undefined) {
        throw new Error("Billing provider is still loading");
      }
      if (checkoutProvider.provider === "vortex_billing") {
        const { checkoutUrl } = await createVortexCheckout({ lookupKey });
        window.location.href = checkoutUrl;
        return;
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

  const proPlan = plans?.find((p: { tier: string | null }) => p.tier === "pro");
  const proMonthlyLookupKey = proPlan?.pricing.monthly?.lookupKey;
  const proFeatures = proPlan?.features
    ? proPlan.features.split(",").map((f: string) => f.trim())
    : [];
  // For Pro plan, use the subscription's own features if available, fallback to product features
  const currentFeatures = subscription?.features
    ? subscription.features.split(",").map((f: string) => f.trim())
    : proFeatures;

  return (
    <PageWrapper title="Billing">
      <div className="space-y-6">
        <p className="text-muted-foreground text-sm">
          Manage your subscription and billing information
        </p>

        {/* Plan Card — merged current plan + upgrade (free) or current plan + features (pro) */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CreditCard className="text-muted-foreground h-5 w-5" />
                <CardTitle>{isFreePlan ? "Plan" : "Current Plan"}</CardTitle>
              </div>
              {subscription &&
                getStatusBadge(
                  subscription.status as SubscriptionStatus,
                  subscription.cancelAtPeriodEnd,
                )}
            </div>
            <CardDescription>
              {isFreePlan
                ? "You are on the Free plan"
                : `You are on the ${subscription?.planName ?? "Pro"} plan`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Past due warning */}
            {subscription?.status === "past_due" && (
              <div className="bg-destructive/10 text-destructive mb-6 rounded-md p-3 text-sm">
                Your payment is past due. Please update your payment method to avoid service
                interruption.
              </div>
            )}

            {isFreePlan && proPlan ? (
              /* Free plan: two-column layout — current plan left, upgrade right */
              <div className="grid gap-6 md:grid-cols-2">
                {/* Left: Current Free plan */}
                <div className="space-y-4">
                  <h3 className="text-muted-foreground text-sm font-medium">Current</h3>
                  <div>
                    <p className="text-lg font-semibold">Free</p>
                    <div className="mt-1 flex items-baseline gap-1">
                      <span className="text-3xl font-bold">$0</span>
                      <span className="text-muted-foreground">/month</span>
                    </div>
                  </div>
                  {subscription && isActiveSubscription && (
                    <p className="text-muted-foreground text-sm">
                      {subscription.cancelAtPeriodEnd
                        ? `Access until ${formatDate(subscription.currentPeriodEnd)}`
                        : `Renews ${formatDate(subscription.currentPeriodEnd)}`}
                    </p>
                  )}
                </div>

                {/* Right: Pro upgrade */}
                <div className="space-y-4">
                  <h3 className="text-muted-foreground text-sm font-medium">Upgrade</h3>
                  <div>
                    <p className="text-lg font-semibold">{proPlan.name}</p>
                    {proPlan.pricing.monthly && (
                      <div className="mt-1 flex items-baseline gap-1">
                        <span className="text-3xl font-bold">
                          {formatPrice(
                            proPlan.pricing.monthly.amount,
                            proPlan.pricing.monthly.currency,
                          )}
                        </span>
                        <span className="text-muted-foreground">/month</span>
                      </div>
                    )}
                  </div>
                  {proFeatures.length > 0 && (
                    <ul className="space-y-2 text-sm">
                      {proFeatures.map((feature: string) => (
                        <li
                          key={feature}
                          className="text-muted-foreground flex items-center gap-2"
                        >
                          <Check className="text-primary h-3.5 w-3.5 shrink-0" />
                          {formatFeatureLabel(feature)}
                        </li>
                      ))}
                    </ul>
                  )}
                  {proMonthlyLookupKey && (
                    <Button
                      className="w-full"
                      onClick={() => void handleUpgrade(proMonthlyLookupKey)}
                      disabled={checkoutLookupKey !== null || checkoutProvider === undefined}
                    >
                      {checkoutLookupKey === proMonthlyLookupKey ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="mr-2 h-4 w-4" />
                      )}
                      Upgrade to Professional
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              /* Professional plan (or paid): single column with details + features */
              <div className="space-y-6">
                <div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold">
                      {subscription
                        ? formatPrice(subscription.unitAmount / 100, subscription.currency)
                        : "$0"}
                    </span>
                    <span className="text-muted-foreground">
                      {subscription
                        ? formatInterval(subscription.interval, subscription.intervalCount)
                        : "/month"}
                    </span>
                  </div>

                  {subscription && subscription.status !== "canceled" && (
                    <p className="text-muted-foreground mt-1 text-sm">
                      {subscription.cancelAtPeriodEnd
                        ? `Access until ${formatDate(subscription.currentPeriodEnd)}`
                        : `Next billing date: ${formatDate(subscription.currentPeriodEnd)}`}
                    </p>
                  )}
                </div>

                {currentFeatures.length > 0 && (
                  <>
                    <Separator />
                    <div className="space-y-3">
                      <p className="text-sm font-medium">Included features</p>
                      <ul className="grid gap-2 text-sm sm:grid-cols-2">
                        {currentFeatures.map((feature: string) => (
                          <li
                            key={feature}
                            className="text-muted-foreground flex items-center gap-2"
                          >
                            <Check className="text-primary h-3.5 w-3.5 shrink-0" />
                            {formatFeatureLabel(feature)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PageWrapper>
  );
}
