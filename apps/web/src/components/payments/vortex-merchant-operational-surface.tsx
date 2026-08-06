import { api } from "@seal/backend/convex/_generated/api";
import type { Id } from "@seal/backend/convex/_generated/dataModel";
import { Link } from "@tanstack/react-router";
import {
  VortexBalanceWalletPanel,
  VortexMerchantActionQueue,
  VortexMerchantAccountPanel,
  VortexPaymentTimelineSummary,
  VortexPaymentsProvider,
  VortexPayoutReadinessPanel,
  type VortexBalanceWalletEntry,
  type VortexBalanceWalletState,
  type VortexEmbeddedComponentClassNames,
  type VortexMerchantAccountPanelProps,
  type VortexPaymentTimelineState,
  type VortexPayoutReadinessPanelProps,
} from "@vortexnyc/payments-react";
import { useAction, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import type { LucideIcon } from "lucide-react";
import { AlertTriangle, ArrowRight, FileText, WalletCards } from "lucide-react";
import { useEffect, useState } from "react";

import { PageWrapper } from "@/components/page-wrapper";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { parseSelectValue } from "@/lib/select-values";

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
type VortexMerchantPayoutData = FunctionReturnType<
  typeof api.payments.vortex_merchant_actions.getVortexMerchantPayoutData
>;
type SettlementSnapshot = VortexMerchantPayoutData["settlements"][number];
type PayoutSnapshot = VortexMerchantPayoutData["payouts"][number];
type DerivedCurrencyBalance =
  VortexMerchantPayoutData["derivedBalance"]["currencies"][number];
type MoneyDirection = SettlementSnapshot["direction"];
type PanelPayoutProfile = NonNullable<
  VortexPayoutReadinessPanelProps["payoutProfile"]
>;

const PANEL_ENVIRONMENTS = [
  "sandbox",
  "production",
] as const satisfies readonly PanelPayoutProfile["environment"][];
const PANEL_PAYOUT_MODES = [
  "net",
  "gross",
  "unknown",
] as const satisfies readonly PanelPayoutProfile["mode"][];
const PANEL_PAYOUT_RAILS = [
  "next_day_ach",
  "same_day_ach",
  "instant_card",
  "unknown",
] as const satisfies readonly PanelPayoutProfile["payoutRail"][];
const PANEL_PAYOUT_SCHEDULES = [
  "daily",
  "monthly",
  "manual",
  "unknown",
] as const satisfies readonly PanelPayoutProfile["payoutSchedule"][];
const PANEL_CURRENCY_CODES = [
  "USD",
  "CAD",
] as const satisfies readonly NonNullable<PanelPayoutProfile["currency"]>[];
const PANEL_CAPABILITY_KEYS = [
  "standard_next_day_ach",
  "same_day_ach",
  "instant_card_push",
  "gross_payout",
  "sub_merchant_payee_payment",
] as const satisfies readonly PanelPayoutProfile["capabilities"][number]["key"][];

/**
 * Parse the validator-typed payout profile from the Convex action into the
 * literal unions the Core payout readiness panel expects, dropping values the
 * panel cannot represent instead of asserting them.
 */
function toPanelPayoutProfile(
  profile: VortexMerchantPayoutData["payoutProfile"]
): PanelPayoutProfile | undefined {
  if (!profile) return undefined;
  const environment = parseSelectValue(profile.environment, PANEL_ENVIRONMENTS);
  if (!environment) return undefined;
  return {
    environment,
    merchantAccountId: profile.merchantAccountId,
    mode: parseSelectValue(profile.mode, PANEL_PAYOUT_MODES) ?? "unknown",
    payoutRail:
      parseSelectValue(profile.payoutRail, PANEL_PAYOUT_RAILS) ?? "unknown",
    payoutSchedule:
      parseSelectValue(profile.payoutSchedule, PANEL_PAYOUT_SCHEDULES) ??
      "unknown",
    currency: profile.currency
      ? (parseSelectValue(profile.currency, PANEL_CURRENCY_CODES) ?? undefined)
      : undefined,
    settlementDelayDays: profile.settlementDelayDays,
    submissionDelayDays: profile.submissionDelayDays,
    fundingRequirement: profile.fundingRequirement,
    sameDayAchEligible: profile.sameDayAchEligible,
    instantPayoutEligible: profile.instantPayoutEligible,
    grossPayoutEnabled: profile.grossPayoutEnabled,
    capabilities: profile.capabilities.flatMap((capability) => {
      const key = parseSelectValue(capability.key, PANEL_CAPABILITY_KEYS);
      return key ? [{ ...capability, key }] : [];
    }),
    fetchedAt: profile.fetchedAt,
  };
}

type MerchantAccountResult = {
  status: ConnectionStatus;
  account: {
    _id: string;
    provider?: "vortex";
    processorAccountId: string;
    vortexMerchantAccountId?: string;
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

type VortexMerchantPayoutDataState = {
  data: VortexMerchantPayoutData | null;
  loading: boolean;
  error: string | undefined;
  shouldFetch: boolean;
};

type OperationalSurfacePanelsProps = {
  account: NonNullable<MerchantAccountResult["account"]>;
  merchantState: VortexMerchantState;
  payoutDataState: VortexMerchantPayoutDataState;
  slug: string;
  surface: VortexMerchantOperationalSurfaceKind;
};

type ConnectedOperationalSurfaceProps = {
  account: NonNullable<MerchantAccountResult["account"]>;
  copy: (typeof surfaceCopy)[VortexMerchantOperationalSurfaceKind];
  organizationId: Id<"organizations"> | undefined;
  organizationName: string;
  payoutDataState: VortexMerchantPayoutDataState;
  slug: string;
  status: ConnectionStatus;
  surface: VortexMerchantOperationalSurfaceKind;
};

export type VortexMerchantOperationalSurfaceKind =
  | "balances"
  | "payouts"
  | "history"
  | "disputes"
  | "tax";

type VortexMerchantOperationalSurfaceProps = {
  slug: string;
  surface: VortexMerchantOperationalSurfaceKind;
};

type NoVortexMerchantAccountStateProps = {
  slug: string;
  title: string;
};

type VortexOperationalPlaceholderProps = {
  title: string;
  description: string;
  icon: LucideIcon;
  slug: string;
  surface: string;
};

const vortexPaymentsClassNames = {
  description: "text-muted-foreground text-sm text-pretty",
  empty:
    "mt-4 rounded-md border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground",
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

const surfaceCopy = {
  balances: {
    title: "Balances",
    description: "Vortex settlement balance status for this merchant account.",
  },
  disputes: {
    title: "Disputes",
    description: "Payment dispute operations for this merchant account.",
  },
  history: {
    title: "Payment History",
    description: "Vortex payment event timeline for this merchant account.",
  },
  payouts: {
    title: "Payouts",
    description: "Vortex payout readiness and required merchant actions.",
  },
  tax: {
    title: "Tax Documents",
    description: "Vortex tax document status for this merchant account.",
  },
} satisfies Record<
  VortexMerchantOperationalSurfaceKind,
  { title: string; description: string }
>;

const derivedBalanceWalletCopy = {
  title: "Derived balance ledger",
  readyDescription:
    "Derived from Vortex settlement and payout snapshots. This is not a provider balance.",
  emptyDescription:
    "No Vortex settlement or payout rows are available for this derived balance yet.",
  errorTitle: "Unable to load Vortex settlement and payout data.",
  availableBalanceLabel: "Available for payout (derived)",
  pendingBalanceLabel: "Pending settlement / payout flight",
  entryCountLabel: "Settlement and payout rows",
  nextActionLabel: "Balance source",
  emptyStateDescription:
    "Settlements and payouts will appear here after Vortex projects them for this merchant.",
  settlementLabel: "Vortex row source",
};

const payoutReadinessCopy = {
  title: "Payout readiness",
  readyDescription:
    "This merchant account is ready for payouts through Vortex Payments.",
  blockedDescription:
    "This merchant account still has payout requirements to resolve.",
  errorTitle: "Unable to load Vortex payout profile.",
  latestSettlementLabel: "Latest Vortex settlement",
  latestPayoutLabel: "Latest Vortex payout",
};

export function VortexMerchantOperationalSurface({
  slug,
  surface,
}: VortexMerchantOperationalSurfaceProps) {
  const organization = useQuery(api.organizations.queries.getOrganization, {
    slug,
  });
  const merchantAccountResult = useQuery(
    api.payments.merchant_account_queries.getMerchantAccount,
    {
      slug,
    }
  ) as MerchantAccountResult | undefined;
  const orgId = organization?._id;
  const account = merchantAccountResult?.account ?? null;
  const payoutDataState = useVortexMerchantPayoutData(
    orgId,
    account,
    merchantAccountResult?.status
  );

  if (organization === undefined || merchantAccountResult === undefined) {
    return null;
  }

  const copy = surfaceCopy[surface];
  if (!hasConnectedMerchantAccount(merchantAccountResult)) {
    return <NoVortexMerchantAccountState slug={slug} title={copy.title} />;
  }

  return (
    <ConnectedOperationalSurface
      account={merchantAccountResult.account}
      copy={copy}
      organizationId={orgId}
      organizationName={organization?.name ?? slug}
      payoutDataState={payoutDataState}
      slug={slug}
      status={merchantAccountResult.status}
      surface={surface}
    />
  );
}

function ConnectedOperationalSurface({
  account,
  copy,
  organizationId,
  organizationName,
  payoutDataState,
  slug,
  status,
  surface,
}: ConnectedOperationalSurfaceProps) {
  const merchantAccount = buildMerchantAccount(
    account,
    organizationName,
    organizationId
  );
  const merchantState = buildMerchantState(
    account,
    status,
    payoutDataState.data ?? undefined
  );

  return (
    <PageWrapper title={copy.title} description={copy.description}>
      <VortexPaymentsProvider
        config={{
          baseUrl: window.location.origin,
          environment: "test",
          organizationId: organizationId ?? slug,
          branding: { brandName: "Seal", showVortexBrand: true },
        }}
      >
        <div className="mt-6 space-y-6">
          <OperationalSurfacePanels
            account={account}
            merchantState={merchantState}
            payoutDataState={payoutDataState}
            slug={slug}
            surface={surface}
          />

          {surface !== "payouts" && (
            <VortexMerchantAccountPanel
              merchantAccount={merchantAccount}
              merchantState={merchantState}
              classNames={vortexPaymentsClassNames}
              readOnly
              copy={{ title: "Vortex Connect" }}
            />
          )}
        </div>
      </VortexPaymentsProvider>
    </PageWrapper>
  );
}

function hasConnectedMerchantAccount(
  merchantAccountResult: MerchantAccountResult
): merchantAccountResult is MerchantAccountResult & {
  account: NonNullable<MerchantAccountResult["account"]>;
  status: "connected";
} {
  return (
    merchantAccountResult.status === "connected" &&
    merchantAccountResult.account !== null
  );
}

function useVortexMerchantPayoutData(
  organizationId: Id<"organizations"> | undefined,
  account: MerchantAccountResult["account"],
  status: ConnectionStatus | undefined
): VortexMerchantPayoutDataState {
  const getVortexMerchantPayoutData = useAction(
    api.payments.vortex_merchant_actions.getVortexMerchantPayoutData
  );
  const [data, setData] = useState<VortexMerchantPayoutData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);
  const shouldFetch =
    organizationId !== undefined && status === "connected" && account !== null;

  useEffect(() => {
    if (!shouldFetch || organizationId === undefined) {
      setData(null);
      setLoading(false);
      setError(undefined);
      return undefined;
    }

    let cancelled = false;
    setLoading(true);
    setError(undefined);

    getVortexMerchantPayoutData({ organizationId })
      .then((result) => {
        if (!cancelled) {
          setData(result);
        }
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setData(null);
          setError(
            caught instanceof Error ? caught.message : "Unable to load payouts"
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    account?.processorAccountId,
    getVortexMerchantPayoutData,
    organizationId,
    shouldFetch,
  ]);

  return { data, loading, error, shouldFetch };
}

function OperationalSurfacePanels({
  account,
  merchantState,
  payoutDataState,
  slug,
  surface,
}: OperationalSurfacePanelsProps) {
  if (surface === "balances") {
    return (
      <VortexBalanceWalletPanel
        balance={buildBalanceWalletState(
          merchantState,
          account.defaultCurrency,
          payoutDataState.data ?? undefined
        )}
        classNames={vortexPaymentsClassNames}
        loading={payoutDataState.loading && payoutDataState.shouldFetch}
        error={payoutDataState.error}
        readOnly
        copy={derivedBalanceWalletCopy}
      />
    );
  }

  if (surface === "payouts") {
    return (
      <>
        <VortexPayoutReadinessPanel
          merchantState={merchantState}
          payoutProfile={toPanelPayoutProfile(
            payoutDataState.data?.payoutProfile ?? null
          )}
          classNames={vortexPaymentsClassNames}
          loading={payoutDataState.loading && payoutDataState.shouldFetch}
          error={payoutDataState.error}
          readOnly
          copy={payoutReadinessCopy}
        />
        <VortexMerchantActionQueue
          merchantState={merchantState}
          classNames={vortexPaymentsClassNames}
          readOnly
        />
      </>
    );
  }

  if (surface === "history") {
    return (
      <VortexPaymentTimelineSummary
        timeline={buildPaymentTimelineState(
          merchantState,
          account.defaultCurrency
        )}
        classNames={vortexPaymentsClassNames}
        readOnly
        copy={{
          title: "Payment timeline",
          emptyDescription:
            "Payment event projection is owned by Vortex Payments.",
          emptyEntriesDescription:
            "Receipts, refunds, and invoice events will appear here after Seal writes them into Vortex.",
        }}
      />
    );
  }

  if (surface === "disputes") {
    return (
      <VortexOperationalPlaceholder
        title="Dispute operations"
        description="Vortex Payments will own dispute intake, evidence, and resolution. No embedded provider dispute console remains in Seal."
        icon={AlertTriangle}
        slug={slug}
        surface="merchant-disputes-replacement"
      />
    );
  }

  return (
    <VortexOperationalPlaceholder
      title="Tax document operations"
      description="Vortex Payments will own tax document delivery when this merchant surface is needed. Seal no longer mounts an embedded provider document console."
      icon={FileText}
      slug={slug}
      surface="merchant-tax-documents-replacement"
    />
  );
}

export function NoVortexMerchantAccountState({
  slug,
  title,
}: NoVortexMerchantAccountStateProps) {
  return (
    <PageWrapper title={title}>
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <WalletCards className="text-muted-foreground mb-4 size-12" />
          <h3 className="mb-2 text-lg font-semibold text-balance">
            Vortex Connect not ready
          </h3>
          <p className="text-muted-foreground mb-6 max-w-sm text-center text-sm text-pretty">
            Create or finish Vortex Connect setup before using payment
            operations.
          </p>
          <Button asChild>
            <Link to="/$slug/settings/payments" params={{ slug }}>
              Open Vortex Connect settings
              <ArrowRight className="ml-2 size-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    </PageWrapper>
  );
}

function VortexOperationalPlaceholder({
  title,
  description,
  icon: Icon,
  slug,
  surface,
}: VortexOperationalPlaceholderProps) {
  return (
    <Card data-vortex-surface={surface}>
      <CardHeader>
        <div className="bg-muted/30 mb-3 flex size-10 items-center justify-center rounded-md border">
          <Icon className="text-muted-foreground size-5" />
        </div>
        <CardTitle className="text-balance">{title}</CardTitle>
        <CardDescription className="text-pretty">{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button variant="outline" asChild>
          <Link to="/$slug/settings/payments" params={{ slug }}>
            Review Vortex Connect
            <ArrowRight className="ml-2 size-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
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
  status: ConnectionStatus,
  payoutData: VortexMerchantPayoutData | undefined
): VortexMerchantState {
  const openRequirementIds = [
    ...(account.requirements?.currentlyDue ?? []),
    ...(account.requirements?.pastDue ?? []),
  ];

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
    openRequirementIds,
    activeCapabilityKeys: buildActiveCapabilityKeys(account.capabilities),
    restrictedCapabilityKeys: buildRestrictedCapabilityKeys(
      account.capabilities
    ),
    canAcceptPayments: account.chargesEnabled,
    payoutReadiness: account.payoutsEnabled ? "ready" : "blocked",
    payoutBlockReason: account.payoutsEnabled
      ? undefined
      : account.requirements?.disabledReason,
    latestSettlementStatus: payoutData?.settlements[0]?.status,
    latestPayoutStatus: payoutData?.payouts[0]?.status,
    capabilitySnapshots: [],
    generatedAt: toIsoTimestamp(account.updatedAt),
  };
}

function buildActiveCapabilityKeys(
  capabilities: NonNullable<MerchantAccountResult["account"]>["capabilities"]
): string[] {
  return compactCapabilities([
    capabilityWhenActive(capabilities?.cardPayments, "card_payments"),
    capabilityWhenActive(capabilities?.transfers, "transfers"),
    capabilityWhenActive(
      capabilities?.usBankAccountAchPayments,
      "us_bank_account_ach_payments"
    ),
  ]);
}

function buildRestrictedCapabilityKeys(
  capabilities: NonNullable<MerchantAccountResult["account"]>["capabilities"]
): string[] {
  return compactCapabilities([
    capabilityWhenRestricted(capabilities?.cardPayments, "card_payments"),
    capabilityWhenRestricted(capabilities?.transfers, "transfers"),
    capabilityWhenRestricted(
      capabilities?.usBankAccountAchPayments,
      "us_bank_account_ach_payments"
    ),
  ]);
}

function capabilityWhenActive(
  status: string | undefined,
  capability: string
): string | null {
  return status === "active" ? capability : null;
}

function capabilityWhenRestricted(
  status: string | undefined,
  capability: string
): string | null {
  return status !== undefined && status !== "active" ? capability : null;
}

function compactCapabilities(
  capabilities: readonly (string | null)[]
): string[] {
  return capabilities.filter(
    (capability): capability is string => capability !== null
  );
}

function buildBalanceWalletState(
  merchantState: VortexMerchantState,
  defaultCurrency: string | undefined,
  payoutData: VortexMerchantPayoutData | undefined
): VortexBalanceWalletState {
  const fallbackCurrency = defaultCurrency?.toUpperCase() ?? "USD";
  const selectedBalance =
    findDerivedCurrencyBalance(
      payoutData?.derivedBalance.currencies,
      fallbackCurrency
    ) ?? payoutData?.derivedBalance.currencies[0];
  const currency = selectedBalance?.currency ?? fallbackCurrency;
  const entries =
    payoutData === undefined
      ? []
      : buildBalanceWalletEntries({
          currency,
          settlements: payoutData.settlements,
          payouts: payoutData.payouts,
        });
  const pendingAmount =
    selectedBalance === undefined
      ? 0
      : selectedBalance.pendingSettlement - selectedBalance.payoutInFlight;

  return {
    customerId: merchantState.merchantAccountId,
    billingAccountId: merchantState.merchantAccountId,
    status:
      entries.length > 0 || selectedBalance !== undefined ? "ready" : "empty",
    currency,
    availableAmount: selectedBalance?.availableForPayout ?? 0,
    pendingAmount,
    entries,
    nextAction:
      "DERIVED from Vortex public settlements and payouts. Not a provider balance endpoint.",
    message:
      "Derived balance: Vortex snapshots only, not direct provider balance.",
  };
}

function findDerivedCurrencyBalance(
  balances: readonly DerivedCurrencyBalance[] | undefined,
  fallbackCurrency: string
): DerivedCurrencyBalance | undefined {
  return balances?.find(
    (balance) => balance.currency.toUpperCase() === fallbackCurrency
  );
}

function buildBalanceWalletEntries(input: {
  currency: string;
  settlements: readonly SettlementSnapshot[];
  payouts: readonly PayoutSnapshot[];
}): VortexBalanceWalletEntry[] {
  return [
    ...input.settlements
      .filter((settlement) => settlement.currency === input.currency)
      .map(toSettlementWalletEntry),
    ...input.payouts
      .filter((payout) => payout.currency === input.currency)
      .map(toPayoutWalletEntry),
  ].toSorted((left, right) =>
    right.effectiveAt.localeCompare(left.effectiveAt)
  );
}

function toSettlementWalletEntry(
  settlement: SettlementSnapshot
): VortexBalanceWalletEntry {
  const amount = signedAmount(settlement.direction, settlement.netAmount);
  return {
    entryId: settlement.id,
    entryType: amount >= 0 ? "grant" : "consume",
    amount: Math.abs(amount),
    currency: settlement.currency,
    remainingAmount:
      settlement.status === "closed" || settlement.status === "approved"
        ? Math.abs(amount)
        : 0,
    description: `Derived settlement row: ${settlement.status}. Gross ${settlement.grossAmount}, fee ${settlement.feeAmount}, refund ${settlement.refundAmount}, adjustment ${settlement.adjustmentAmount}.`,
    effectiveAt:
      settlement.approvedAt ?? settlement.closedAt ?? settlement.updatedAt,
    sourceEntryId: settlement.id,
    targets: { lineTypes: ["adjustment"] },
  };
}

function toPayoutWalletEntry(payout: PayoutSnapshot): VortexBalanceWalletEntry {
  return {
    entryId: payout.id,
    entryType:
      payout.status === "returned" || payout.status === "failed"
        ? "reverse"
        : "consume",
    amount: Math.abs(signedAmount(payout.direction, payout.amount)),
    currency: payout.currency,
    remainingAmount: 0,
    description:
      payout.settlementId === undefined
        ? `Derived payout row: ${payout.status}.`
        : `Derived payout row: ${payout.status}; settlement ${payout.settlementId}.`,
    effectiveAt: payout.expectedArrivalAt ?? payout.updatedAt,
    sourceEntryId: payout.id,
    grantEntryId: payout.settlementId,
    targets: { lineTypes: ["adjustment"] },
  };
}

function signedAmount(direction: MoneyDirection, amount: number): number {
  return direction === "debit" ? -amount : amount;
}

function buildPaymentTimelineState(
  merchantState: VortexMerchantState,
  defaultCurrency: string | undefined
): VortexPaymentTimelineState {
  return {
    customerId: merchantState.merchantAccountId,
    billingAccountId: merchantState.merchantAccountId,
    status: "empty",
    currency: defaultCurrency?.toUpperCase() ?? "USD",
    entries: [],
    nextAction: "Project payment events from Vortex Payments.",
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
