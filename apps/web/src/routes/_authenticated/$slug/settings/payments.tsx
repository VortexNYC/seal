/**
 * Payments Settings Page
 *
 * Merchant payment onboarding and account management.
 * Route: /{slug}/settings/payments
 */

import { api } from "@seal/backend/convex/_generated/api";
import type { Id } from "@seal/backend/convex/_generated/dataModel";
import { createFileRoute } from "@tanstack/react-router";
import {
  VortexFeePolicyPanel,
  VortexMerchantAccountPanel,
  VortexMerchantActionQueue,
  VortexPaymentsProvider,
  type VortexEmbeddedComponentClassNames,
  type VortexFeePolicyOwnerMode,
  type VortexFeePolicyState,
  type VortexMerchantAccountPanelProps,
} from "@vortex/payments/react";
import { useAction, useMutation, useQuery } from "convex/react";
import { ExternalLink, Loader2, PlugZap } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { PageWrapper } from "@/components/page-wrapper";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useSubscriptionLimits } from "@/hooks/use-subscription-limits";

export const Route = createFileRoute("/_authenticated/$slug/settings/payments")({
  component: PaymentsSettingsPage,
});

type ConnectionStatus = "not_connected" | "pending" | "restricted" | "connected";

type FeeHandling = "absorb" | "pass_to_recipient";
type VortexMerchantAccount = VortexMerchantAccountPanelProps["merchantAccount"];
type VortexMerchantState = NonNullable<VortexMerchantAccountPanelProps["merchantState"]>;

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

type MerchantAccountResult = {
  status: ConnectionStatus;
  account: {
    _id: string;
    processorAccountId: string;
    accountType: "standard" | "express";
    chargesEnabled: boolean;
    payoutsEnabled: boolean;
    detailsSubmitted: boolean;
    feeHandling: FeeHandling;
    defaultCurrency?: string;
    createdAt?: number;
    updatedAt?: number;
    capabilities?: {
      cardPayments: string;
      transfers: string;
      usBankAccountAchPayments?: string;
    };
    requirements?: {
      currentlyDue: string[];
      eventuallyDue: string[];
      pastDue: string[];
      disabledReason?: string;
    };
  } | null;
  canManage: boolean;
};

function PaymentsSettingsPage() {
  const { slug } = Route.useParams();

  const { isPro, isLoading: isLoadingPlan } = useSubscriptionLimits();

  const organization = useQuery(api.organizations.queries.getOrganization, { slug });

  const merchantAccountResult = useQuery(api.payments.merchant_account_queries.getMerchantAccount, {
    slug,
  }) as MerchantAccountResult | undefined;

  const createMerchantAccount = useAction(
    api.payments.merchant_account_actions.createMerchantAccount,
  );
  const createMerchantOnboardingLink = useAction(
    api.payments.merchant_account_actions.createMerchantOnboardingLink,
  );
  const refreshMerchantAccount = useAction(
    api.payments.merchant_account_actions.refreshMerchantAccount,
  );

  const updateFeeHandling = useMutation(api.payments.merchant_account_mutations.updateFeeHandling);

  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [isCreatingOnboardingLink, setIsCreatingOnboardingLink] = useState(false);
  const [isSavingFeeHandling, setIsSavingFeeHandling] = useState(false);

  const orgId = organization?._id as Id<"organizations"> | undefined;

  const status = merchantAccountResult?.status ?? "not_connected";
  const canManage = merchantAccountResult?.canManage ?? false;
  const hasMerchantAccount =
    merchantAccountResult?.account !== null && merchantAccountResult?.account !== undefined;
  const merchantChargesEnabled = merchantAccountResult?.account?.chargesEnabled ?? false;

  const feeHandling = merchantAccountResult?.account?.feeHandling ?? "absorb";
  const feePolicy =
    merchantAccountResult?.account === undefined || merchantAccountResult.account === null
      ? null
      : buildFeePolicy(merchantAccountResult.account.processorAccountId, feeHandling);
  const merchantAccount =
    merchantAccountResult?.account === undefined || merchantAccountResult.account === null
      ? null
      : buildMerchantAccount(merchantAccountResult.account, organization?.name ?? slug, orgId);
  const merchantState =
    merchantAccountResult?.account === undefined || merchantAccountResult.account === null
      ? null
      : buildMerchantState(merchantAccountResult.account, status);

  useEffect(() => {
    if (!orgId || !canManage) return;

    async function refresh() {
      if (!orgId) return;
      try {
        await refreshMerchantAccount({ organizationId: orgId });
      } catch (error) {
        console.warn("Failed to refresh merchant account", error);
      }
    }

    void refresh();
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);

    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [canManage, orgId, refreshMerchantAccount]);

  async function handleCreateAccount() {
    if (!orgId) return;

    setIsCreatingAccount(true);
    try {
      await createMerchantAccount({ organizationId: orgId });
      toast.success("Vortex Connect account created. Review onboarding status below.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create merchant account");
    } finally {
      setIsCreatingAccount(false);
    }
  }

  async function handleCreateOnboardingLink() {
    if (!orgId) return;

    const popup = window.open("", "_blank");
    setIsCreatingOnboardingLink(true);
    try {
      const currentUrl = window.location.href;
      const result = await createMerchantOnboardingLink({
        organizationId: orgId,
        returnUrl: currentUrl,
        refreshUrl: currentUrl,
      });
      if (popup) {
        popup.opener = null;
        popup.location.href = result.url;
      } else {
        window.open(result.url, "_blank", "noopener,noreferrer");
      }
      toast.success("Verification opened in a new tab.");
    } catch (error) {
      popup?.close();
      toast.error(error instanceof Error ? error.message : "Failed to start verification");
    } finally {
      setIsCreatingOnboardingLink(false);
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
    <PageWrapper title="Vortex Connect">
      <div className="space-y-6">
        <p className="text-muted-foreground text-sm">
          Configure the Vortex Payments merchant account that accepts document payments. Only
          workspace owners and admins can manage payment settings.
          {!isPro && !isLoadingPlan && (
            <span className="text-warning mt-1 block">
              Merchant payment collection requires a Professional plan.
            </span>
          )}
        </p>

        {hasMerchantAccount && merchantAccount !== null && merchantState !== null ? (
          <VortexPaymentsProvider
            config={{
              baseUrl: window.location.origin,
              environment: "test",
              organizationId: String(orgId ?? slug),
              branding: { brandName: "Seal", showVortexBrand: true },
            }}
          >
            <VortexMerchantAccountPanel
              merchantAccount={merchantAccount}
              merchantState={merchantState}
              classNames={vortexPaymentsClassNames}
              copy={{ title: "Vortex Connect" }}
              disabled={!canManage}
            />
            <VortexMerchantActionQueue
              merchantState={merchantState}
              classNames={vortexPaymentsClassNames}
              copy={{ title: "Vortex Connect actions" }}
              disabled={!canManage}
            />
            {!merchantChargesEnabled && isPro && (
              <div className="mt-4 flex flex-col gap-3 rounded-md border bg-background p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-medium">Verification required</p>
                  <p className="text-muted-foreground text-sm">
                    Complete verification before document payments route to this merchant.
                  </p>
                </div>
                <Button
                  onClick={handleCreateOnboardingLink}
                  disabled={!canManage || isCreatingOnboardingLink}
                  className="shrink-0"
                >
                  {isCreatingOnboardingLink ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : (
                    <ExternalLink className="mr-2 size-4" />
                  )}
                  Complete verification
                </Button>
              </div>
            )}
          </VortexPaymentsProvider>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Vortex Connect</CardTitle>
              <CardDescription>
                Manage onboarding status, required actions, and payment readiness.
                {!isPro && !isLoadingPlan && (
                  <span className="text-warning mt-1 block">
                    Upgrade to Professional to accept document payments.
                  </span>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!canManage && (
                <div className="bg-muted text-muted-foreground rounded-md p-3 text-sm">
                  You can view payment status, but only owners and admins can update payment
                  settings.
                </div>
              )}

              {status === "not_connected" && isPro && (
                <div className="space-y-3">
                  <p className="text-sm">
                    No Vortex Connect account is ready. Create one to start accepting payments
                    through your documents.
                  </p>
                  <Button onClick={handleCreateAccount} disabled={!canManage || isCreatingAccount}>
                    {isCreatingAccount ? (
                      <Loader2 className="mr-2 size-4 animate-spin" />
                    ) : (
                      <PlugZap className="mr-2 size-4" />
                    )}
                    Create Vortex Connect account
                  </Button>
                </div>
              )}

              {status === "not_connected" && !isPro && !isLoadingPlan && (
                <div className="space-y-4">
                  <p className="text-sm">
                    Vortex Connect payment collection is available on the Professional plan.
                  </p>
                  <Button asChild>
                    <a href={`/${slug}/settings/billing`}>Upgrade to Professional</a>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

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

function buildMerchantAccount(
  account: NonNullable<MerchantAccountResult["account"]>,
  organizationName: string,
  organizationId: Id<"organizations"> | undefined,
): VortexMerchantAccount {
  const updatedAt = toIsoTimestamp(account.updatedAt);

  return {
    id: account.processorAccountId,
    environment: "sandbox",
    tenantId: String(organizationId ?? "unknown"),
    displayName: organizationName,
    legalEntityType: account.accountType,
    country: "USA",
    merchantMode: "processing",
    defaultCurrency: account.defaultCurrency?.toUpperCase() ?? "USD",
    status: mapMerchantAccountStatus({
      chargesEnabled: account.chargesEnabled,
      detailsSubmitted: account.detailsSubmitted,
      connectionStatus:
        account.requirements?.disabledReason === undefined ? undefined : "restricted",
      routeStatus: undefined,
    }),
    capabilityStatus: account.chargesEnabled && account.payoutsEnabled ? "active" : "restricted",
    associatedIdentities: [],
    metadata: {},
    processorAccountRefs: [],
    createdAt: toIsoTimestamp(account.createdAt) ?? updatedAt,
    updatedAt,
  };
}

function buildMerchantState(
  account: NonNullable<MerchantAccountResult["account"]>,
  status: ConnectionStatus,
): VortexMerchantState {
  const openRequirementIds = [
    ...(account.requirements?.currentlyDue ?? []),
    ...(account.requirements?.pastDue ?? []),
  ];
  const activeCapabilityKeys = [
    account.capabilities?.cardPayments === "active" ? "card_payments" : null,
    account.capabilities?.transfers === "active" ? "transfers" : null,
    account.capabilities?.usBankAccountAchPayments === "active"
      ? "us_bank_account_ach_payments"
      : null,
  ].filter((capability): capability is string => capability !== null);
  const restrictedCapabilityKeys = [
    account.capabilities?.cardPayments !== "active" ? "card_payments" : null,
    account.capabilities?.transfers !== "active" ? "transfers" : null,
    account.capabilities?.usBankAccountAchPayments !== undefined &&
    account.capabilities.usBankAccountAchPayments !== "active"
      ? "us_bank_account_ach_payments"
      : null,
  ].filter((capability): capability is string => capability !== null);

  return {
    merchantAccountId: account.processorAccountId,
    environment: "sandbox",
    merchantStatus: mapMerchantAccountStatus({
      chargesEnabled: account.chargesEnabled,
      detailsSubmitted: account.detailsSubmitted,
      connectionStatus:
        account.requirements?.disabledReason === undefined ? undefined : "restricted",
      routeStatus: status,
    }),
    onboardingStatus: account.detailsSubmitted ? "approved" : "action_required",
    openRequirementIds,
    activeCapabilityKeys,
    restrictedCapabilityKeys,
    canAcceptPayments: account.chargesEnabled,
    payoutReadiness: account.payoutsEnabled ? "ready" : "blocked",
    payoutBlockReason: account.payoutsEnabled ? undefined : account.requirements?.disabledReason,
    capabilitySnapshots: [],
    generatedAt: toIsoTimestamp(account.updatedAt),
  };
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

function mapMerchantAccountStatus(input: {
  chargesEnabled: boolean;
  detailsSubmitted: boolean;
  connectionStatus: "restricted" | undefined;
  routeStatus: ConnectionStatus | undefined;
}): VortexMerchantAccount["status"] {
  if (input.routeStatus === "restricted" || input.connectionStatus === "restricted") {
    return "restricted";
  }

  if (input.chargesEnabled) {
    return "active";
  }

  if (input.detailsSubmitted) {
    return "pending_review";
  }

  return "draft";
}

function toIsoTimestamp(timestamp: number | undefined): string {
  return new Date(timestamp ?? Date.now()).toISOString();
}
