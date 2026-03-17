/**
 * Payments Settings Page
 *
 * Stripe Connect embedded onboarding and account management.
 * Route: /{slug}/settings/payments
 */

import {
  ConnectAccountManagement,
  ConnectAccountOnboarding,
  ConnectNotificationBanner,
} from "@stripe/react-connect-js";
import { createFileRoute } from "@tanstack/react-router";
import { useAction, useMutation, useQuery } from "convex/react";
import { AlertTriangle, BadgeCheck, BadgeX, Loader2, PlugZap } from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";

import { PageWrapper } from "@/components/page-wrapper";
import { StripeConnectProvider } from "@/components/stripe/connect-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { api } from "@seal/backend/convex/_generated/api";
import type { Id } from "@seal/backend/convex/_generated/dataModel";

export const Route = createFileRoute("/_authenticated/$slug/settings/payments")({
  component: PaymentsSettingsPage,
});

type ConnectionStatus = "not_connected" | "pending" | "restricted" | "connected";

type FeeHandling = "absorb" | "pass_to_recipient";

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

  // Payments are available on all tiers — no plan gating needed

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

  if (!organization) {
    return null;
  }

  return (
    <PageWrapper title="Payments">
      <div className="space-y-6">
        <p className="text-muted-foreground text-sm">
          Connect Stripe to accept payments through documents. Only workspace owners and admins can
          manage payment settings.
        </p>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                Stripe Connection
                {isRefreshing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  getStatusIcon(status)
                )}
              </span>
              <span className="text-sm font-medium">
                {isRefreshing ? "Refreshing…" : getStatusLabel(status)}
              </span>
            </CardTitle>
            <CardDescription>
              Manage onboarding status, required actions, and connection health.
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
            {status === "not_connected" && !hasStripeAccount && (
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

            {/* Connected → show account management inline */}
            {status === "connected" && orgId && (
              <StripeConnectProvider organizationId={orgId}>
                <div className="space-y-4">
                  <ConnectNotificationBanner />
                  <ConnectAccountManagement />
                </div>
              </StripeConnectProvider>
            )}
          </CardContent>
        </Card>

        {status === "connected" && connectedAccount?.account && (
          <Card>
            <CardHeader>
              <CardTitle>Platform Fee</CardTitle>
              <CardDescription>
                Seal charges a 0.25% platform fee on Professional plans for each invoice payment. Choose who
                pays this fee.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Who pays the platform fee?</Label>
                <RadioGroup
                  value={feeHandling}
                  onValueChange={(value) => handleUpdateFeeHandling(value as FeeHandling)}
                  className="space-y-2"
                  disabled={!canManage || isSavingFeeHandling}
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="absorb" id="fee-absorb" />
                    <Label htmlFor="fee-absorb">
                      I'll absorb the fee (deducted from my payout)
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="pass_to_recipient" id="fee-pass" />
                    <Label htmlFor="fee-pass">Add fee to invoice total (recipient pays)</Label>
                  </div>
                </RadioGroup>
                {isSavingFeeHandling && (
                  <p className="text-muted-foreground text-xs">Saving fee preference…</p>
                )}
                <p className="text-muted-foreground text-xs">
                  Note: Stripe's payment processing fees are separate and handled by Stripe.
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </PageWrapper>
  );
}
