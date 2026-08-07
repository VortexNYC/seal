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
} from "@vortexnyc/payments-react";
import { useAction, useMutation, useQuery } from "convex/react";
import { ExternalLink, Loader2, PlugZap } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { PageWrapper } from "@/components/page-wrapper";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useSubscriptionLimits } from "@/hooks/use-subscription-limits";

export const Route = createFileRoute("/_authenticated/$slug/settings/payments")(
  {
    component: PaymentsSettingsPage,
  }
);

type ConnectionStatus =
  | "not_connected"
  | "pending"
  | "restricted"
  | "connected";

type FeeHandling = "absorb" | "pass_to_recipient";
type VortexMerchantAccount = VortexMerchantAccountPanelProps["merchantAccount"];
type VortexMerchantState = NonNullable<
  VortexMerchantAccountPanelProps["merchantState"]
>;
type MerchantAccountRecord = NonNullable<MerchantAccountResult["account"]>;

type PaymentsSettingsState = {
  readonly canManage: boolean;
  readonly feeHandling: FeeHandling;
  readonly feePolicy: VortexFeePolicyState | null;
  readonly hasMerchantAccount: boolean;
  readonly merchantAccount: VortexMerchantAccount | null;
  readonly merchantChargesEnabled: boolean;
  readonly merchantState: VortexMerchantState | null;
  readonly orgId: Id<"organizations"> | undefined;
  readonly status: ConnectionStatus;
};

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
  metrics:
    "mt-4 grid gap-3 rounded-md border bg-muted/30 p-4 text-sm sm:grid-cols-2",
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
  const organization = useQuery(api.organizations.queries.getOrganization, {
    slug,
  });
  const merchantAccountResult = useQuery(
    api.payments.merchant_account_queries.getMerchantAccount,
    {
      slug,
    }
  ) as MerchantAccountResult | undefined;
  const createMerchantAccount = useAction(
    api.payments.merchant_account_actions.createMerchantAccount
  );
  const createMerchantOnboardingLink = useAction(
    api.payments.merchant_account_actions.createMerchantOnboardingLink
  );
  const refreshMerchantAccount = useAction(
    api.payments.merchant_account_actions.refreshMerchantAccount
  );

  const updateFeeHandling = useMutation(
    api.payments.merchant_account_mutations.updateFeeHandling
  );
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [isCreatingOnboardingLink, setIsCreatingOnboardingLink] =
    useState(false);
  const [isSavingFeeHandling, setIsSavingFeeHandling] = useState(false);
  const settingsState = buildPaymentsSettingsState({
    merchantAccountResult,
    organizationId: organization?._id,
    organizationName: organization?.name ?? slug,
    slug,
  });

  useEffect(() => {
    return subscribeToMerchantRefresh({
      canManage: settingsState.canManage,
      orgId: settingsState.orgId,
      refreshMerchantAccount,
    });
  }, [refreshMerchantAccount, settingsState.canManage, settingsState.orgId]);

  async function handleCreateAccount() {
    if (!settingsState.orgId) return;

    setIsCreatingAccount(true);
    try {
      await createMerchantAccount({ organizationId: settingsState.orgId });
      toast.success(
        "Vortex Connect account created. Review onboarding status below."
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Failed to create merchant account"
      );
    } finally {
      setIsCreatingAccount(false);
    }
  }

  async function handleCreateOnboardingLink() {
    if (!settingsState.orgId) return;

    setIsCreatingOnboardingLink(true);
    try {
      await openMerchantOnboardingLink({
        createMerchantOnboardingLink,
        organizationId: settingsState.orgId,
      });
      toast.success("Verification opened in a new tab.");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to start verification"
      );
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
      toast.error(
        error instanceof Error ? error.message : "Failed to update fee handling"
      );
    } finally {
      setIsSavingFeeHandling(false);
    }
  }

  async function handleVortexFeePolicyChange(
    ownerMode: VortexFeePolicyOwnerMode
  ) {
    if (ownerMode !== "merchant_pays" && ownerMode !== "customer_pays") {
      return;
    }

    await handleUpdateFeeHandling(
      ownerMode === "customer_pays" ? "pass_to_recipient" : "absorb"
    );
  }

  if (!organization) {
    return null;
  }

  return (
    <PageWrapper title="Vortex Connect">
      <PaymentsSettingsContent
        isCreatingAccount={isCreatingAccount}
        isCreatingOnboardingLink={isCreatingOnboardingLink}
        isLoadingPlan={isLoadingPlan}
        isPro={isPro}
        isSavingFeeHandling={isSavingFeeHandling}
        settingsState={settingsState}
        slug={slug}
        onCreateAccount={handleCreateAccount}
        onCreateOnboardingLink={handleCreateOnboardingLink}
        onFeePolicyChange={handleVortexFeePolicyChange}
      />
    </PageWrapper>
  );
}

function subscribeToMerchantRefresh({
  canManage,
  orgId,
  refreshMerchantAccount,
}: {
  readonly canManage: boolean;
  readonly orgId: Id<"organizations"> | undefined;
  readonly refreshMerchantAccount: (args: {
    readonly organizationId: Id<"organizations">;
  }) => Promise<unknown>;
}): (() => void) | undefined {
  if (!orgId || !canManage) return undefined;
  const organizationId = orgId;

  async function refresh() {
    try {
      await refreshMerchantAccount({ organizationId });
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
}

async function openMerchantOnboardingLink({
  createMerchantOnboardingLink,
  organizationId,
}: {
  readonly createMerchantOnboardingLink: (args: {
    readonly organizationId: Id<"organizations">;
    readonly returnUrl: string;
    readonly refreshUrl: string;
  }) => Promise<{ readonly url: string }>;
  readonly organizationId: Id<"organizations">;
}) {
  const popup = window.open("", "_blank");
  try {
    const currentUrl = window.location.href;
    const result = await createMerchantOnboardingLink({
      organizationId,
      returnUrl: currentUrl,
      refreshUrl: currentUrl,
    });
    openOnboardingPopup(popup, result.url);
  } catch (error) {
    popup?.close();
    throw error;
  }
}

function openOnboardingPopup(popup: Window | null, url: string) {
  if (popup) {
    popup.opener = null;
    popup.location.href = url;
    return;
  }

  window.open(url, "_blank", "noopener,noreferrer");
}

function PaymentsSettingsContent({
  isCreatingAccount,
  isCreatingOnboardingLink,
  isLoadingPlan,
  isPro,
  isSavingFeeHandling,
  settingsState,
  slug,
  onCreateAccount,
  onCreateOnboardingLink,
  onFeePolicyChange,
}: {
  readonly isCreatingAccount: boolean;
  readonly isCreatingOnboardingLink: boolean;
  readonly isLoadingPlan: boolean;
  readonly isPro: boolean;
  readonly isSavingFeeHandling: boolean;
  readonly settingsState: PaymentsSettingsState;
  readonly slug: string;
  readonly onCreateAccount: () => void;
  readonly onCreateOnboardingLink: () => void;
  readonly onFeePolicyChange: (ownerMode: VortexFeePolicyOwnerMode) => void;
}) {
  return (
    <div className="space-y-6">
      <PaymentsIntro isLoadingPlan={isLoadingPlan} isPro={isPro} />
      <MerchantAccountSection
        isCreatingAccount={isCreatingAccount}
        isCreatingOnboardingLink={isCreatingOnboardingLink}
        isLoadingPlan={isLoadingPlan}
        isPro={isPro}
        settingsState={settingsState}
        slug={slug}
        onCreateAccount={onCreateAccount}
        onCreateOnboardingLink={onCreateOnboardingLink}
      />
      <FeePolicySection
        isPro={isPro}
        isSavingFeeHandling={isSavingFeeHandling}
        settingsState={settingsState}
        onFeePolicyChange={onFeePolicyChange}
      />
    </div>
  );
}

function PaymentsIntro({
  isLoadingPlan,
  isPro,
}: {
  readonly isLoadingPlan: boolean;
  readonly isPro: boolean;
}) {
  return (
    <p className="text-muted-foreground text-sm">
      Configure the Vortex Payments merchant account that accepts document
      payments. Only workspace owners and admins can manage payment settings.
      {!isPro && !isLoadingPlan && (
        <span className="text-warning mt-1 block">
          Merchant payment collection requires a Professional plan.
        </span>
      )}
    </p>
  );
}

function MerchantAccountSection({
  isCreatingAccount,
  isCreatingOnboardingLink,
  isLoadingPlan,
  isPro,
  settingsState,
  slug,
  onCreateAccount,
  onCreateOnboardingLink,
}: {
  readonly isCreatingAccount: boolean;
  readonly isCreatingOnboardingLink: boolean;
  readonly isLoadingPlan: boolean;
  readonly isPro: boolean;
  readonly settingsState: PaymentsSettingsState;
  readonly slug: string;
  readonly onCreateAccount: () => void;
  readonly onCreateOnboardingLink: () => void;
}) {
  if (
    settingsState.hasMerchantAccount &&
    settingsState.merchantAccount &&
    settingsState.merchantState
  ) {
    return (
      <ConnectedMerchantAccountSection
        isCreatingOnboardingLink={isCreatingOnboardingLink}
        isPro={isPro}
        settingsState={settingsState}
        slug={slug}
        onCreateOnboardingLink={onCreateOnboardingLink}
      />
    );
  }

  return (
    <CreateMerchantAccountCard
      isCreatingAccount={isCreatingAccount}
      isLoadingPlan={isLoadingPlan}
      isPro={isPro}
      settingsState={settingsState}
      slug={slug}
      onCreateAccount={onCreateAccount}
    />
  );
}

function ConnectedMerchantAccountSection({
  isCreatingOnboardingLink,
  isPro,
  settingsState,
  slug,
  onCreateOnboardingLink,
}: {
  readonly isCreatingOnboardingLink: boolean;
  readonly isPro: boolean;
  readonly settingsState: PaymentsSettingsState;
  readonly slug: string;
  readonly onCreateOnboardingLink: () => void;
}) {
  if (!settingsState.merchantAccount || !settingsState.merchantState)
    return null;

  return (
    <VortexPaymentsProvider
      config={{
        baseUrl: window.location.origin,
        environment: "test",
        organizationId: settingsState.orgId ?? slug,
        branding: { brandName: "Seal", showVortexBrand: true },
      }}
    >
      <VortexMerchantAccountPanel
        merchantAccount={settingsState.merchantAccount}
        merchantState={settingsState.merchantState}
        classNames={vortexPaymentsClassNames}
        copy={{ title: "Vortex Connect" }}
        disabled={!settingsState.canManage}
      />
      <VortexMerchantActionQueue
        merchantState={settingsState.merchantState}
        classNames={vortexPaymentsClassNames}
        copy={{ title: "Vortex Connect actions" }}
        disabled={!settingsState.canManage}
      />
      {!settingsState.merchantChargesEnabled && isPro && (
        <VerificationRequiredCallout
          canManage={settingsState.canManage}
          isCreatingOnboardingLink={isCreatingOnboardingLink}
          onCreateOnboardingLink={onCreateOnboardingLink}
        />
      )}
    </VortexPaymentsProvider>
  );
}

function VerificationRequiredCallout({
  canManage,
  isCreatingOnboardingLink,
  onCreateOnboardingLink,
}: {
  readonly canManage: boolean;
  readonly isCreatingOnboardingLink: boolean;
  readonly onCreateOnboardingLink: () => void;
}) {
  return (
    <div className="bg-background mt-4 flex flex-col gap-3 rounded-md border p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-sm font-medium">Verification required</p>
        <p className="text-muted-foreground text-sm">
          Complete verification before document payments route to this merchant.
        </p>
      </div>
      <Button
        onClick={onCreateOnboardingLink}
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
  );
}

function CreateMerchantAccountCard({
  isCreatingAccount,
  isLoadingPlan,
  isPro,
  settingsState,
  slug,
  onCreateAccount,
}: {
  readonly isCreatingAccount: boolean;
  readonly isLoadingPlan: boolean;
  readonly isPro: boolean;
  readonly settingsState: PaymentsSettingsState;
  readonly slug: string;
  readonly onCreateAccount: () => void;
}) {
  return (
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
        {!settingsState.canManage && (
          <div className="bg-muted text-muted-foreground rounded-md p-3 text-sm">
            You can view payment status, but only owners and admins can update
            payment settings.
          </div>
        )}

        {settingsState.status === "not_connected" && isPro && (
          <CreateMerchantAccountPrompt
            canManage={settingsState.canManage}
            isCreatingAccount={isCreatingAccount}
            onCreateAccount={onCreateAccount}
          />
        )}

        {settingsState.status === "not_connected" &&
          !isPro &&
          !isLoadingPlan && <PlanUpgradePrompt slug={slug} />}
      </CardContent>
    </Card>
  );
}

function CreateMerchantAccountPrompt({
  canManage,
  isCreatingAccount,
  onCreateAccount,
}: {
  readonly canManage: boolean;
  readonly isCreatingAccount: boolean;
  readonly onCreateAccount: () => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm">
        No Vortex Connect account is ready. Create one to start accepting
        payments through your documents.
      </p>
      <Button
        onClick={onCreateAccount}
        disabled={!canManage || isCreatingAccount}
      >
        {isCreatingAccount ? (
          <Loader2 className="mr-2 size-4 animate-spin" />
        ) : (
          <PlugZap className="mr-2 size-4" />
        )}
        Create Vortex Connect account
      </Button>
    </div>
  );
}

function PlanUpgradePrompt({ slug }: { readonly slug: string }) {
  return (
    <div className="space-y-4">
      <p className="text-sm">
        Vortex Connect payment collection is available on the Professional plan.
      </p>
      <Button asChild>
        <a href={`/${slug}/settings/billing`}>Upgrade to Professional</a>
      </Button>
    </div>
  );
}

function FeePolicySection({
  isPro,
  isSavingFeeHandling,
  settingsState,
  onFeePolicyChange,
}: {
  readonly isPro: boolean;
  readonly isSavingFeeHandling: boolean;
  readonly settingsState: PaymentsSettingsState;
  readonly onFeePolicyChange: (ownerMode: VortexFeePolicyOwnerMode) => void;
}) {
  if (
    settingsState.status !== "connected" ||
    !isPro ||
    settingsState.feePolicy === null
  ) {
    return null;
  }

  return (
    <VortexFeePolicyPanel
      feePolicy={settingsState.feePolicy}
      classNames={vortexPaymentsClassNames}
      disabled={!settingsState.canManage || isSavingFeeHandling}
      loading={isSavingFeeHandling}
      onPolicyChange={onFeePolicyChange}
    />
  );
}

function buildPaymentsSettingsState({
  merchantAccountResult,
  organizationId,
  organizationName,
  slug,
}: {
  readonly merchantAccountResult: MerchantAccountResult | undefined;
  readonly organizationId: Id<"organizations"> | undefined;
  readonly organizationName: string;
  readonly slug: string;
}): PaymentsSettingsState {
  const account = merchantAccountResult?.account ?? null;
  const status = merchantAccountResult?.status ?? "not_connected";

  return {
    canManage: merchantAccountResult?.canManage ?? false,
    feeHandling: account?.feeHandling ?? "absorb",
    feePolicy: buildNullableFeePolicy(account),
    hasMerchantAccount: account !== null,
    merchantAccount: buildNullableMerchantAccount(
      account,
      organizationName,
      organizationId,
      slug
    ),
    merchantChargesEnabled: account?.chargesEnabled ?? false,
    merchantState: buildNullableMerchantState(account, status),
    orgId: organizationId,
    status,
  };
}

function buildNullableFeePolicy(
  account: MerchantAccountRecord | null
): VortexFeePolicyState | null {
  if (account === null) return null;
  return buildFeePolicy(account.processorAccountId, account.feeHandling);
}

function buildNullableMerchantAccount(
  account: MerchantAccountRecord | null,
  organizationName: string,
  organizationId: Id<"organizations"> | undefined,
  slug: string
): VortexMerchantAccount | null {
  if (account === null) return null;
  return buildMerchantAccount(
    account,
    organizationName || slug,
    organizationId
  );
}

function buildNullableMerchantState(
  account: MerchantAccountRecord | null,
  status: ConnectionStatus
): VortexMerchantState | null {
  if (account === null) return null;
  return buildMerchantState(account, status);
}

function buildMerchantAccount(
  account: NonNullable<MerchantAccountResult["account"]>,
  organizationName: string,
  organizationId: Id<"organizations"> | undefined
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
        account.requirements?.disabledReason === undefined
          ? undefined
          : "restricted",
      routeStatus: undefined,
    }),
    capabilityStatus:
      account.chargesEnabled && account.payoutsEnabled
        ? "active"
        : "restricted",
    associatedIdentities: [],
    metadata: {},
    processorAccountRefs: [],
    createdAt: toIsoTimestamp(account.createdAt) ?? updatedAt,
    updatedAt,
  };
}

function buildMerchantState(
  account: NonNullable<MerchantAccountResult["account"]>,
  status: ConnectionStatus
): VortexMerchantState {
  return {
    merchantAccountId: account.processorAccountId,
    environment: "sandbox",
    merchantStatus: mapMerchantAccountStatus({
      chargesEnabled: account.chargesEnabled,
      detailsSubmitted: account.detailsSubmitted,
      connectionStatus:
        account.requirements?.disabledReason === undefined
          ? undefined
          : "restricted",
      routeStatus: status,
    }),
    onboardingStatus: account.detailsSubmitted ? "approved" : "action_required",
    openRequirementIds: buildOpenRequirementIds(account),
    activeCapabilityKeys: buildActiveCapabilityKeys(account),
    restrictedCapabilityKeys: buildRestrictedCapabilityKeys(account),
    canAcceptPayments: account.chargesEnabled,
    payoutReadiness: account.payoutsEnabled ? "ready" : "blocked",
    payoutBlockReason: account.payoutsEnabled
      ? undefined
      : account.requirements?.disabledReason,
    capabilitySnapshots: [],
    generatedAt: toIsoTimestamp(account.updatedAt),
  };
}

function buildOpenRequirementIds(
  account: MerchantAccountRecord
): readonly string[] {
  return [
    ...(account.requirements?.currentlyDue ?? []),
    ...(account.requirements?.pastDue ?? []),
  ];
}

function buildActiveCapabilityKeys(
  account: MerchantAccountRecord
): readonly string[] {
  return [
    capabilityKeyWhenActive(
      "card_payments",
      account.capabilities?.cardPayments
    ),
    capabilityKeyWhenActive("transfers", account.capabilities?.transfers),
    capabilityKeyWhenActive(
      "us_bank_account_ach_payments",
      account.capabilities?.usBankAccountAchPayments
    ),
  ].filter((capability): capability is string => capability !== null);
}

function buildRestrictedCapabilityKeys(
  account: MerchantAccountRecord
): readonly string[] {
  return [
    capabilityKeyWhenRestricted(
      "card_payments",
      account.capabilities?.cardPayments
    ),
    capabilityKeyWhenRestricted("transfers", account.capabilities?.transfers),
    capabilityKeyWhenRestricted(
      "us_bank_account_ach_payments",
      account.capabilities?.usBankAccountAchPayments
    ),
  ].filter((capability): capability is string => capability !== null);
}

function capabilityKeyWhenActive(
  key: string,
  status: string | undefined
): string | null {
  return status === "active" ? key : null;
}

function capabilityKeyWhenRestricted(
  key: string,
  status: string | undefined
): string | null {
  if (status === undefined || status === "active") return null;
  return key;
}

function buildFeePolicy(
  merchantAccountId: string,
  feeHandling: FeeHandling
): VortexFeePolicyState {
  return {
    merchantAccountId,
    ownerMode:
      feeHandling === "pass_to_recipient" ? "customer_pays" : "merchant_pays",
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
  if (
    input.routeStatus === "restricted" ||
    input.connectionStatus === "restricted"
  ) {
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
