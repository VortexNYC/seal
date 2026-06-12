/**
 * Payments Settings Page
 *
 * Stripe Connect embedded onboarding and account management.
 * Route: /{slug}/settings/payments
 */

import { api } from "@seal/backend/convex/_generated/api";
import type { Id } from "@seal/backend/convex/_generated/dataModel";
import {
  ConnectAccountManagement,
  ConnectAccountOnboarding,
  ConnectNotificationBanner,
} from "@stripe/react-connect-js";
import { createFileRoute } from "@tanstack/react-router";
import {
  VortexFeePolicyPanel,
  type VortexEmbeddedComponentClassNames,
  type VortexFeePolicyOwnerMode,
  type VortexFeePolicyState,
} from "@vortex/payments/react";
import { useAction, useMutation, useQuery } from "convex/react";
import { AlertTriangle, BadgeCheck, BadgeX, Loader2, PlugZap } from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";

import { PageWrapper } from "@/components/page-wrapper";
import { StripeConnectProvider } from "@/components/stripe/connect-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useSubscriptionLimits } from "@/hooks/use-subscription-limits";

export const Route = createFileRoute("/_authenticated/$slug/settings/payments")({
  component: PaymentsSettingsPage,
});

type ConnectionStatus = "not_connected" | "pending" | "restricted" | "connected";

type FeeHandling = "absorb" | "pass_to_recipient";

const vortexPaymentsClassNames = {
  description: "text-muted-foreground text-sm text-pretty",
  error:
    "mt-4 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive",
  header: "space-y-1.5",
  item: "flex gap-3 rounded-md border bg-background p-4 has-[:checked]:border-primary has-[:checked]:bg-primary/5",
  itemDescription: "mt-1 text-muted-foreground text-sm text-pretty",
  itemTitle: "block text-sm font-medium text-balance",
  list: "mt-4 grid gap-3",
  loading: "mt-4 rounded-md border p-3 text-sm text-muted-foreground",
  metricLabel: "text-muted-foreground",
  metrics: "mt-4 grid gap-3 rounded-md border bg-muted/30 p-4 text-sm sm:grid-cols-2",
  metricValue: "font-medium tabular-nums",
  root: "rounded-lg border bg-card p-6 text-card-foreground shadow-sm",
  status:
    "mt-2 inline-flex w-fit rounded-md bg-muted px-2 py-1 text-xs font-medium text-muted-foreground",
  title: "text-lg font-semibold text-balance",
} satisfies VortexEmbeddedComponentClassNames;

type ConnectedAccountResult = {
  status: ConnectionStatus;
  account: {
    _id: Id<"stripe_accounts">;
    stripeAccountId: string;
    accountType: "standard" | "express";
    chargesEnabled: boolean;
    payoutsEnabled: boolean;
    detailsSubmitted: boolean;
    feeHandling: FeeHandling;
    requirements?: {
      currentlyDue: string[];
      eventuallyDue: string[];
      pastDue: string[];
      disabledReason?: string;
    };
  } | null;
  canManage: boolean;
};

function getStatusLabel(status: ConnectionStatus) {
  switch (status) {
    case "connected":
      return "Connected";
    case "pending":
      return "Setup Incomplete";
    case "restricted":
      return "Restricted";
    case "not_connected":
    default:
      return "Not Connected";
  }
}

function getStatusIcon(status: ConnectionStatus) {
  switch (status) {
    case "connected":
      return <BadgeCheck className="text-success h-4 w-4" />;
    case "pending":
      return <AlertTriangle className="text-warning h-4 w-4" />;
    case "restricted":
      return <BadgeX className="text-destructive h-4 w-4" />;
    case "not_connected":
    default:
      return <PlugZap className="text-muted-foreground h-4 w-4" />;
  }
}

function PaymentsSettingsPage() {
  const { slug } = Route.useParams();

  const { isPro, isLoading: isLoadingPlan } = useSubscriptionLimits();

  const organization = useQuery(api.organizations.queries.getOrganization, { slug });

  const connectedAccount = useQuery(api.stripe.connect_queries.getConnectedAccount, { slug }) as
    | ConnectedAccountResult
    | undefined;

  const createConnectedAccount = useAction(api.stripe.connect_actions.createConnectedAccount);
  const refreshConnectedAccount = useAction(api.stripe.connect_actions.refreshConnectedAccount);

  const updateFeeHandling = useMutation(api.stripe.connect_public_mutations.updateFeeHandling);

  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [isSavingFeeHandling, setIsSavingFeeHandling] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const orgId = organization?._id as Id<"organizations"> | undefined;

  const status = connectedAccount?.status ?? "not_connected";
  const canManage = connectedAccount?.canManage ?? false;
  const hasStripeAccount =
    connectedAccount?.account !== null && connectedAccount?.account !== undefined;

  const feeHandling = connectedAccount?.account?.feeHandling ?? "absorb";
  const feePolicy =
    connectedAccount?.account === undefined || connectedAccount.account === null
      ? null
      : buildFeePolicy(connectedAccount.account.stripeAccountId, feeHandling);

  // Create a Stripe account (required before embedded onboarding can render)
  async function handleCreateAccount() {
    if (!orgId) return;

    setIsCreatingAccount(true);
    try {
      await createConnectedAccount({ organizationId: orgId });
      toast.success("Stripe account created — complete onboarding below");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create Stripe account");
    } finally {
      setIsCreatingAccount(false);
    }
  }

  // Called when embedded onboarding component exits
  const handleOnboardingExit = useCallback(async () => {
    if (!orgId) return;

    setIsRefreshing(true);
    try {
      const result = await refreshConnectedAccount({ organizationId: orgId });
      if (result.status === "refreshed") {
        toast.success("Stripe account status updated");
      }
    } catch {
      // Refresh failure is non-critical
    } finally {
      setIsRefreshing(false);
    }
  }, [refreshConnectedAccount, orgId]);

  async function handleUpdateFeeHandling(value: FeeHandling) {
    setIsSavingFeeHandling(true);
    try {
      await updateFeeHandling({ feeHandling: value });
      toast.success("Fee handling updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update fee handling");
    } finally {
      setIsSavingFeeHandling(false);
    }
  }

  async function handleVortexFeePolicyChange(ownerMode: VortexFeePolicyOwnerMode) {
    if (ownerMode !== "merchant_pays" && ownerMode !== "customer_pays") {
      return;
    }

    await handleUpdateFeeHandling(ownerMode === "customer_pays" ? "pass_to_recipient" : "absorb");
  }

  if (!organization) {
    return null;
  }

  return (
    <PageWrapper title="Payments">
      <div className="space-y-6">
        <p className="text-muted-foreground text-sm">
          Connect Stripe to accept payments through documents. Only workspace owners and admins can
          manage payment settings.
          {!isPro && !isLoadingPlan && (
            <span className="text-warning mt-1 block">
              Stripe Connect requires a Professional plan.
            </span>
          )}
        </p>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                Stripe Connection
                {isRefreshing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : isPro ? (
                  getStatusIcon(status)
                ) : (
                  getStatusIcon("not_connected")
                )}
              </span>
              <span className="text-sm font-medium">
                {isRefreshing
                  ? "Refreshing…"
                  : isPro
                    ? getStatusLabel(status)
                    : "Professional Required"}
              </span>
            </CardTitle>
            <CardDescription>
              Manage onboarding status, required actions, and connection health.
              {!isPro && !isLoadingPlan && (
                <span className="text-warning mt-1 block">
                  Upgrade to Professional to connect Stripe and accept payments.
                </span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!canManage && (
              <div className="bg-muted text-muted-foreground rounded-md p-3 text-sm">
                You can view connection status, but only owners and admins can update payment
                settings.
              </div>
            )}

            {/* Not connected + no Stripe account yet → create account button */}
            {status === "not_connected" && isPro && !hasStripeAccount && (
              <div className="space-y-3">
                <p className="text-sm">
                  No Stripe account connected. Create a Stripe account to start accepting payments
                  through your documents.
                </p>
                <Button onClick={handleCreateAccount} disabled={!canManage || isCreatingAccount}>
                  {isCreatingAccount ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <PlugZap className="mr-2 h-4 w-4" />
                  )}
                  Connect with Stripe
                </Button>
              </div>
            )}

            {/* Stripe account exists but not fully onboarded → show embedded onboarding */}
            {(status === "not_connected" || status === "pending" || status === "restricted") &&
              isPro &&
              hasStripeAccount &&
              orgId && (
                <StripeConnectProvider organizationId={orgId}>
                  <div className="space-y-4">
                    {(status === "pending" || status === "restricted") && (
                      <ConnectNotificationBanner />
                    )}
                    <ConnectAccountOnboarding onExit={handleOnboardingExit} />
                  </div>
                </StripeConnectProvider>
              )}

            {status === "not_connected" && !isPro && !isLoadingPlan && (
              <div className="space-y-3">
                <p className="text-sm">
                  Stripe Connect is available on the Professional plan. Upgrade to accept payments
                  through your documents.
                </p>
                <Button asChild>
                  <a href={`/${slug}/settings/billing`}>Upgrade to Professional</a>
                </Button>
              </div>
            )}

            {/* Connected → show account management inline */}
            {status === "connected" && isPro && orgId && (
              <StripeConnectProvider organizationId={orgId}>
                <div className="space-y-4">
                  <ConnectNotificationBanner />
                  <ConnectAccountManagement />
                </div>
              </StripeConnectProvider>
            )}
          </CardContent>
        </Card>

        {status === "connected" && isPro && feePolicy !== null && (
          <VortexFeePolicyPanel
            feePolicy={feePolicy}
            classNames={vortexPaymentsClassNames}
            disabled={!canManage || isSavingFeeHandling}
            loading={isSavingFeeHandling}
            onPolicyChange={handleVortexFeePolicyChange}
          />
        )}
      </div>
    </PageWrapper>
  );
}

function buildFeePolicy(merchantAccountId: string, feeHandling: FeeHandling): VortexFeePolicyState {
  return {
    merchantAccountId,
    ownerMode: feeHandling === "pass_to_recipient" ? "customer_pays" : "merchant_pays",
    platformFeeLabel: "0.25%",
    settlementLabel: "Document invoice payments",
    options: [
      {
        ownerMode: "merchant_pays",
        title: "Deduct from workspace payout",
        description: "The workspace pays the platform fee after settlement.",
      },
      {
        ownerMode: "customer_pays",
        title: "Add fee to invoice total",
        description: "The customer pays the platform fee during checkout.",
      },
    ],
    note: "Payment rail fees stay separate from platform fee policy.",
  };
}
