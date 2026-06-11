/**
 * Payments Settings Page
 *
 * Vortex merchant payment settings.
 * Route: /{slug}/settings/payments
 */

import { api } from "@seal/backend/convex/_generated/api";
import type { Id } from "@seal/backend/convex/_generated/dataModel";
import {
  VortexMerchantAccountPanel,
  VortexMerchantActionQueue,
  VortexPaymentsProvider,
  VortexPayoutReadinessPanel,
  type VortexEmbeddedComponentClassNames,
  type VortexMerchantAccountPanelProps,
  type VortexMerchantActionQueueItem,
  type VortexPayoutReadinessPanelProps,
  type VortexSurfaceLaunch,
} from "@vortex/payments/react";
import { createFileRoute } from "@tanstack/react-router";
import { useAction, useMutation, useQuery } from "convex/react";
import { Loader2, RefreshCw } from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";

import { PageWrapper } from "@/components/page-wrapper";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useSubscriptionLimits } from "@/hooks/use-subscription-limits";

export const Route = createFileRoute("/_authenticated/$slug/settings/payments")({
  component: PaymentsSettingsPage,
});

type ConnectionStatus = "not_connected" | "pending" | "restricted" | "connected";

type FeeHandling = "absorb" | "pass_to_recipient";

type VortexMerchantAccount = VortexMerchantAccountPanelProps["merchantAccount"];
type VortexMerchantState = NonNullable<VortexMerchantAccountPanelProps["merchantState"]>;
type VortexPayoutProfile = NonNullable<VortexPayoutReadinessPanelProps["payoutProfile"]>;

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

export function toMerchantStatus(status: ConnectionStatus): VortexMerchantAccount["status"] {
  switch (status) {
    case "connected":
      return "active";
    case "restricted":
      return "restricted";
    case "pending":
      return "pending_review";
    case "not_connected":
    default:
      return "draft";
  }
}

function buildClassNames(): VortexEmbeddedComponentClassNames {
  return {
    root: "rounded-lg border bg-card p-6 text-card-foreground shadow-sm",
    header: "space-y-1.5",
    title: "text-lg font-semibold text-balance",
    description: "text-muted-foreground text-sm text-pretty",
    metrics: "mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3",
    metricLabel: "text-muted-foreground block text-xs font-medium",
    metricValue: "mt-1 block font-medium tabular-nums",
    list: "mt-4 grid gap-3 md:grid-cols-2",
    item: "rounded-md border bg-background p-4",
    itemTitle: "font-medium text-balance",
    itemDescription: "text-muted-foreground mt-1 text-sm text-pretty",
    status: "text-muted-foreground mt-2 block text-sm text-pretty",
    actions: "mt-4 flex flex-wrap gap-2",
    button:
      "inline-flex min-h-11 items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
    empty: "bg-muted text-muted-foreground mt-4 rounded-md p-4 text-sm",
    loading: "text-muted-foreground mt-4 flex items-center gap-2 text-sm",
    error: "text-destructive bg-destructive/10 mt-4 rounded-md p-3 text-sm",
  };
}

function uniqueStrings(values: readonly string[]): readonly string[] {
  return Array.from(new Set(values.filter((value) => value.length > 0)));
}

export function getRequirementIds(account: ConnectedAccountResult["account"]): readonly string[] {
  if (!account?.requirements) {
    return [];
  }
  return uniqueStrings([
    ...account.requirements.currentlyDue,
    ...account.requirements.pastDue,
    ...account.requirements.eventuallyDue,
  ]);
}

export function buildVortexMerchantAccount(args: {
  readonly slug: string;
  readonly organizationName: string;
  readonly status: ConnectionStatus;
  readonly account: ConnectedAccountResult["account"];
}): VortexMerchantAccount {
  const recordedAt = new Date().toISOString();
  const accountId = args.account?.stripeAccountId ?? `seal_${args.slug}_merchant`;
  const merchantStatus = toMerchantStatus(args.status);

  return {
    id: accountId,
    environment: "production",
    tenantId: `seal:${args.slug}`,
    externalMerchantRef: args.slug,
    displayName: args.organizationName,
    legalEntityType: "company",
    country: "US",
    merchantMode: "processing",
    defaultCurrency: "USD",
    status: merchantStatus,
    capabilityStatus: args.account?.chargesEnabled ? "active" : "restricted",
    processorAccountRefs: args.account
      ? [{
          provider: "stripe",
          objectType: "account",
          objectId: args.account.stripeAccountId,
          relationship: "legacy_processor_account",
          recordedAt,
        }]
      : [],
    createdAt: recordedAt,
    updatedAt: recordedAt,
  };
}

export function buildVortexMerchantState(args: {
  readonly merchantAccountId: string;
  readonly status: ConnectionStatus;
  readonly account: ConnectedAccountResult["account"];
}): VortexMerchantState {
  const generatedAt = new Date().toISOString();
  const requirementIds = getRequirementIds(args.account);
  const activeCapabilityKeys = uniqueStrings([
    ...(args.account?.chargesEnabled ? ["card_payments"] : []),
    ...(args.account?.payoutsEnabled ? ["payouts"] : []),
  ]);
  const restrictedCapabilityKeys = uniqueStrings([
    ...(args.account && !args.account.chargesEnabled ? ["card_payments"] : []),
    ...(args.account && !args.account.payoutsEnabled ? ["payouts"] : []),
  ]);

  return {
    merchantAccountId: args.merchantAccountId,
    environment: "production",
    merchantStatus: toMerchantStatus(args.status),
    onboardingStatus:
      args.status === "connected"
        ? "approved"
        : args.status === "restricted"
          ? "action_required"
          : args.status === "pending"
            ? "under_review"
            : "draft",
    openRequirementIds: requirementIds,
    activeCapabilityKeys,
    restrictedCapabilityKeys,
    canAcceptPayments: args.status === "connected" && args.account?.chargesEnabled === true,
    payoutReadiness:
      args.account?.payoutsEnabled === true
        ? "ready"
        : args.account
          ? "blocked"
          : "unknown",
    payoutBlockReason: args.account?.requirements?.disabledReason,
    capabilitySnapshots: [
      {
        id: `${args.merchantAccountId}:card_payments`,
        environment: "production",
        merchantAccountId: args.merchantAccountId,
        capabilityKey: "card_payments",
        status: args.account?.chargesEnabled ? "active" : "restricted",
        restrictedReason: args.account?.chargesEnabled ? undefined : "payment_collection_not_ready",
        effectiveAt: generatedAt,
        updatedByType: "system",
      },
      {
        id: `${args.merchantAccountId}:payouts`,
        environment: "production",
        merchantAccountId: args.merchantAccountId,
        capabilityKey: "payouts",
        status: args.account?.payoutsEnabled ? "active" : "restricted",
        restrictedReason: args.account?.payoutsEnabled ? undefined : "payouts_not_ready",
        effectiveAt: generatedAt,
        updatedByType: "system",
      },
    ],
    generatedAt,
  };
}

export function buildPayoutProfile(merchantState: VortexMerchantState): VortexPayoutProfile {
  return {
    environment: "production",
    merchantAccountId: merchantState.merchantAccountId,
    mode: "net",
    payoutRail: merchantState.payoutReadiness === "ready" ? "next_day_ach" : "unknown",
    payoutSchedule: "daily",
    currency: "USD",
    fundingRequirement: merchantState.payoutReadiness === "ready" ? "standard" : "requirements_due",
    capabilities: [{
      key: "standard_next_day_ach",
      status: merchantState.payoutReadiness === "ready" ? "enabled" : "disabled",
      reason: merchantState.payoutBlockReason ?? "Payout readiness is derived from merchant account state.",
      source: "operator_policy",
    }, {
      key: "sub_merchant_payee_payment",
      status: merchantState.canAcceptPayments ? "enabled" : "disabled",
      reason: merchantState.canAcceptPayments
        ? "Merchant can accept document payments."
        : "Payment collection is not ready.",
      source: "operator_policy",
    }],
    fetchedAt: merchantState.generatedAt,
  };
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

  async function handleCreateAccount() {
    if (!orgId) return;

    setIsCreatingAccount(true);
    try {
      await createConnectedAccount({ organizationId: orgId });
      toast.success("Merchant account created");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create merchant account");
    } finally {
      setIsCreatingAccount(false);
    }
  }

  const handleRefreshAccount = useCallback(async () => {
    if (!orgId) return;

    setIsRefreshing(true);
    try {
      const result = await refreshConnectedAccount({ organizationId: orgId });
      if (result.status === "refreshed") {
        toast.success("Merchant account status updated");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to refresh merchant status");
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

  const account = connectedAccount?.account ?? null;
  const merchantAccount = buildVortexMerchantAccount({
    slug,
    organizationName: organization.name,
    status,
    account,
  });
  const merchantState = buildVortexMerchantState({
    merchantAccountId: merchantAccount.id,
    status,
    account,
  });
  const payoutProfile = buildPayoutProfile(merchantState);
  const vortexClassNames = buildClassNames();
  const vortexPaymentsConfig = {
    baseUrl: window.location.origin,
    environment: "production" as const,
    organizationId: slug,
    branding: {
      brandName: "Seal",
      showVortexBrand: true,
    },
  };
  const canEditMerchant = canManage && isPro && !isLoadingPlan;
  const merchantActions: readonly VortexMerchantActionQueueItem[] = [
    ...(!isPro && !isLoadingPlan
      ? [{
          id: "upgrade-required",
          kind: "merchant_status" as const,
          title: "Professional plan required",
          description: "Upgrade before accepting document payments.",
          severity: "warning" as const,
          status: "blocked" as const,
          primaryActionLabel: "Upgrade to Professional",
          primaryAction: {
            surface: "plan_comparison" as const,
            path: `/${slug}/settings/billing`,
          },
        }]
      : []),
    ...(isPro && !hasStripeAccount
      ? [{
          id: "create-merchant-account",
          kind: "onboarding_requirement" as const,
          title: "Create merchant account",
          description: "Create the merchant account before collecting document payments.",
          severity: "critical" as const,
          status: "open" as const,
          primaryActionLabel: isCreatingAccount ? "Creating..." : "Create account",
          primaryAction: {
            surface: "merchant_action_queue" as const,
            path: `/${slug}/settings/payments`,
            query: { action: "create-merchant-account" },
          },
        }]
      : []),
    ...(isPro && hasStripeAccount && status !== "connected"
      ? [{
          id: "refresh-merchant-account",
          kind: "onboarding_requirement" as const,
          title: "Refresh merchant requirements",
          description: "Check the latest onboarding, capability, and payout readiness state.",
          severity: status === "restricted" ? "critical" as const : "warning" as const,
          status: "open" as const,
          primaryActionLabel: isRefreshing ? "Refreshing..." : "Refresh status",
          primaryAction: {
            surface: "merchant_action_queue" as const,
            path: `/${slug}/settings/payments`,
            query: { action: "refresh-merchant-account" },
          },
        }]
      : []),
  ];

  function handleVortexMerchantAction(action: VortexMerchantActionQueueItem) {
    if (action.id === "create-merchant-account") {
      void handleCreateAccount();
      return;
    }
    if (action.id === "refresh-merchant-account") {
      void handleRefreshAccount();
    }
  }

  function handleVortexMerchantLaunch(launch: VortexSurfaceLaunch) {
    if (launch.url.includes("action=create-merchant-account")) {
      return;
    }
    if (launch.url.includes("action=refresh-merchant-account")) {
      return;
    }
    window.location.href = launch.url;
  }

  return (
    <PageWrapper title="Payments">
      <div className="space-y-6">
        <p className="text-muted-foreground text-sm">
          Manage document payment readiness, merchant requirements, and payout posture. Only
          workspace owners and admins can update payment settings.
          {!isPro && !isLoadingPlan && (
            <span className="text-warning mt-1 block">
              Payment collection requires a Professional plan.
            </span>
          )}
        </p>

        <VortexPaymentsProvider
          config={vortexPaymentsConfig}
          navigate={handleVortexMerchantLaunch}
        >
          <div className="grid gap-6">
            {!canManage && (
              <div className="bg-muted text-muted-foreground rounded-md p-3 text-sm">
                You can view connection status, but only owners and admins can update payment
                settings.
              </div>
            )}

            <VortexMerchantAccountPanel
              merchantAccount={merchantAccount}
              merchantState={merchantState}
              classNames={vortexClassNames}
              loading={connectedAccount === undefined}
              disabled={!canEditMerchant || isCreatingAccount || isRefreshing}
              onActionLaunch={(_action, launch) => handleVortexMerchantLaunch(launch)}
            />

            <VortexMerchantActionQueue
              merchantState={merchantState}
              actions={merchantActions.length > 0 ? merchantActions : undefined}
              classNames={vortexClassNames}
              loading={connectedAccount === undefined}
              disabled={!canEditMerchant || isCreatingAccount || isRefreshing}
              onAction={handleVortexMerchantAction}
              onActionLaunch={(_action, launch) => handleVortexMerchantLaunch(launch)}
            />

            <VortexPayoutReadinessPanel
              merchantState={merchantState}
              payoutProfile={payoutProfile}
              classNames={vortexClassNames}
              loading={connectedAccount === undefined}
              disabled={!canEditMerchant || isRefreshing}
              onActionLaunch={(_action, launch) => handleVortexMerchantLaunch(launch)}
            />

            {status === "not_connected" && !isPro && !isLoadingPlan && (
              <div className="space-y-3">
                <p className="text-sm">
                  Upgrade to accept payments through your documents.
                </p>
                <Button asChild>
                  <a href={`/${slug}/settings/billing`}>Upgrade to Professional</a>
                </Button>
              </div>
            )}

            {isPro && hasStripeAccount && (
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void handleRefreshAccount()}
                  disabled={!canManage || isRefreshing}
                >
                  {isRefreshing ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-2 size-4" />
                  )}
                  Refresh status
                </Button>
              </div>
            )}
          </div>
        </VortexPaymentsProvider>

        {status === "connected" && isPro && connectedAccount?.account && (
          <Card>
            <CardHeader>
              <CardTitle>Platform Fee</CardTitle>
              <CardDescription>
                Seal charges a 0.25% platform fee on Professional plans for each invoice payment.
                Choose who pays this fee.
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
