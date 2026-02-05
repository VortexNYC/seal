/**
 * Payments Settings Page
 *
 * Stripe Connect onboarding and account status.
 * Route: /{slug}/settings/payments
 */

import { createFileRoute } from "@tanstack/react-router";
import { useAction, useMutation, useQuery } from "convex/react";
import {
  AlertTriangle,
  BadgeCheck,
  BadgeX,
  ExternalLink,
  Link2,
  Loader2,
  PlugZap,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { PageWrapper } from "@/components/page-wrapper";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useSubscriptionLimits } from "@/hooks/use-subscription-limits";
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
      return <BadgeCheck className="h-4 w-4 text-emerald-500" />;
    case "pending":
      return <AlertTriangle className="h-4 w-4 text-amber-500" />;
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
  const createAccountLink = useAction(api.stripe.connect_actions.createAccountLink);
  const createConnectOAuthUrl = useAction(api.stripe.connect_actions.createConnectOAuthUrl);
  const exchangeConnectOAuthCode = useAction(api.stripe.connect_actions.exchangeConnectOAuthCode);
  const refreshConnectedAccount = useAction(api.stripe.connect_actions.refreshConnectedAccount);

  const updateFeeHandling = useMutation(api.stripe.connect_public_mutations.updateFeeHandling);

  const [isConnecting, setIsConnecting] = useState(false);
  const [isContinuing, setIsContinuing] = useState(false);
  const [isOAuthConnecting, setIsOAuthConnecting] = useState(false);
  const [isSavingFeeHandling, setIsSavingFeeHandling] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const orgId = organization?._id as Id<"organizations"> | undefined;

  const status = connectedAccount?.status ?? "not_connected";
  const canManage = connectedAccount?.canManage ?? false;

  const feeHandling = connectedAccount?.account?.feeHandling ?? "absorb";

  const requirementsSummary = useMemo(() => {
    const requirements = connectedAccount?.account?.requirements;
    if (!requirements) {
      return null;
    }

    const currentlyDue = requirements.currentlyDue?.length ?? 0;
    const pastDue = requirements.pastDue?.length ?? 0;

    if (currentlyDue === 0 && pastDue === 0) {
      return null;
    }

    return {
      currentlyDue,
      pastDue,
      disabledReason: requirements.disabledReason,
    };
  }, [connectedAccount]);

  // Refresh account status when returning from Stripe onboarding
  useEffect(() => {
    if (!orgId) {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const connected = params.get("connected");
    const refresh = params.get("refresh");

    if (!connected && !refresh) {
      return;
    }

    setIsRefreshing(true);

    refreshConnectedAccount({ organizationId: orgId })
      .then(() => {
        if (connected) {
          toast.success("Stripe account status updated");
        }
      })
      .catch((error) => {
        console.error("Failed to refresh account status:", error);
      })
      .finally(() => {
        setIsRefreshing(false);
        const cleanUrl = `${window.location.pathname}`;
        window.history.replaceState({}, "", cleanUrl);
      });
  }, [refreshConnectedAccount, orgId]);

  // Handle OAuth code exchange
  useEffect(() => {
    if (!orgId) {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");

    if (!code || !state) {
      return;
    }

    setIsOAuthConnecting(true);

    exchangeConnectOAuthCode({
      organizationId: orgId,
      code,
      state,
    })
      .then(() => {
        toast.success("Stripe account connected successfully");
      })
      .catch((error) => {
        toast.error(error instanceof Error ? error.message : "Failed to connect Stripe account");
      })
      .finally(() => {
        setIsOAuthConnecting(false);
        const cleanUrl = `${window.location.pathname}`;
        window.history.replaceState({}, "", cleanUrl);
      });
  }, [exchangeConnectOAuthCode, orgId]);

  async function handleConnectNewAccount() {
    if (!orgId) {
      return;
    }

    setIsConnecting(true);

    try {
      const { stripeAccountId } = await createConnectedAccount({
        organizationId: orgId,
      });

      if (!stripeAccountId) {
        throw new Error("Stripe account was not created");
      }

      const baseUrl = `${window.location.origin}/${slug}/settings/payments`;

      const { url } = await createAccountLink({
        organizationId: orgId,
        returnUrl: `${baseUrl}?connected=true`,
        refreshUrl: `${baseUrl}?refresh=true`,
      });

      window.location.href = url;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to start Stripe onboarding");
      setIsConnecting(false);
    }
  }

  async function handleContinueSetup() {
    if (!orgId) {
      return;
    }

    setIsContinuing(true);

    try {
      const baseUrl = `${window.location.origin}/${slug}/settings/payments`;
      const { url } = await createAccountLink({
        organizationId: orgId,
        returnUrl: `${baseUrl}?connected=true`,
        refreshUrl: `${baseUrl}?refresh=true`,
      });

      window.location.href = url;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to continue Stripe setup");
      setIsContinuing(false);
    }
  }

  async function handleConnectExistingAccount() {
    if (!orgId) {
      return;
    }

    setIsOAuthConnecting(true);

    try {
      const baseUrl = `${window.location.origin}/${slug}/settings/payments`;
      const { url } = await createConnectOAuthUrl({
        organizationId: orgId,
        redirectUri: baseUrl,
      });
      window.location.href = url;
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to start Stripe OAuth connection",
      );
      setIsOAuthConnecting(false);
    }
  }

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
          {!isPro && !isLoadingPlan && (
            <span className="mt-1 block text-amber-600 dark:text-amber-400">
              Stripe Connect requires a Pro plan.
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
                {isRefreshing ? "Refreshing…" : isPro ? getStatusLabel(status) : "Pro Required"}
              </span>
            </CardTitle>
            <CardDescription>
              Manage onboarding status, required actions, and connection health.
              {!isPro && !isLoadingPlan && (
                <span className="mt-1 block text-amber-600 dark:text-amber-400">
                  Upgrade to Pro to connect Stripe and accept payments.
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

            {status === "not_connected" && isPro && (
              <div className="space-y-3">
                <p className="text-sm">
                  No Stripe account connected. Connect a new Stripe account or authorize an existing
                  account to enable payment fields.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    onClick={handleConnectNewAccount}
                    disabled={!canManage || isConnecting || isOAuthConnecting}
                  >
                    {isConnecting ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <PlugZap className="mr-2 h-4 w-4" />
                    )}
                    Connect with Stripe
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleConnectExistingAccount}
                    disabled={!canManage || isOAuthConnecting || isConnecting}
                  >
                    {isOAuthConnecting ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Link2 className="mr-2 h-4 w-4" />
                    )}
                    Connect existing account
                  </Button>
                </div>
              </div>
            )}

            {status === "not_connected" && !isPro && !isLoadingPlan && (
              <div className="space-y-3">
                <p className="text-sm">
                  Stripe Connect is available on the Pro plan. Upgrade to accept payments through
                  your documents.
                </p>
                <Button asChild>
                  <a href={`/${slug}/settings/billing`}>Upgrade to Pro</a>
                </Button>
              </div>
            )}

            {(status === "pending" || status === "restricted") && isPro && (
              <div className="space-y-3">
                <p className="text-sm">
                  Your Stripe account needs additional setup before you can accept payments.
                </p>
                {requirementsSummary && (
                  <div className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">
                    {requirementsSummary.currentlyDue > 0 && (
                      <p>{requirementsSummary.currentlyDue} items currently due.</p>
                    )}
                    {requirementsSummary.pastDue > 0 && (
                      <p>{requirementsSummary.pastDue} items past due.</p>
                    )}
                    {requirementsSummary.disabledReason && (
                      <p>Reason: {requirementsSummary.disabledReason}</p>
                    )}
                  </div>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button onClick={handleContinueSetup} disabled={!canManage || isContinuing}>
                    {isContinuing ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <PlugZap className="mr-2 h-4 w-4" />
                    )}
                    Continue setup
                  </Button>
                  <Button variant="outline" asChild>
                    <a href="https://dashboard.stripe.com/" target="_blank" rel="noreferrer">
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Open Stripe Dashboard
                    </a>
                  </Button>
                </div>
              </div>
            )}

            {status === "connected" && isPro && (
              <div className="space-y-3">
                <p className="text-sm">
                  Stripe is connected and ready for payments. You can manage account details in the
                  Stripe dashboard.
                </p>
                <Button variant="outline" asChild>
                  <a href="https://dashboard.stripe.com/" target="_blank" rel="noreferrer">
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Manage in Stripe
                  </a>
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {status === "connected" && isPro && connectedAccount?.account && (
          <Card>
            <CardHeader>
              <CardTitle>Platform Fee</CardTitle>
              <CardDescription>
                Seal charges a 0.25% platform fee on Pro plans for each invoice payment. Choose who
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
