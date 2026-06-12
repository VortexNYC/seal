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
  type VortexBalanceWalletState,
  type VortexEmbeddedComponentClassNames,
  type VortexMerchantAccountPanelProps,
  type VortexPaymentTimelineState,
} from "@vortex/payments/react";
import { useQuery } from "convex/react";
import type { LucideIcon } from "lucide-react";
import { AlertTriangle, ArrowRight, FileText, WalletCards } from "lucide-react";

import { PageWrapper } from "@/components/page-wrapper";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type {
  MerchantAccountResult,
  MerchantConnectionStatus,
} from "@/types/vortex-payments";

type VortexMerchantAccount = VortexMerchantAccountPanelProps["merchantAccount"];
type VortexMerchantState = NonNullable<
  VortexMerchantAccountPanelProps["merchantState"]
>;

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
    },
  ) as MerchantAccountResult | undefined;

  if (organization === undefined || merchantAccountResult === undefined) {
    return null;
  }

  const copy = surfaceCopy[surface];
  const orgId = organization?._id as Id<"organizations"> | undefined;
  const account = merchantAccountResult.account;
  const merchantAccount =
    account === null
      ? null
      : buildMerchantAccount(account, organization?.name ?? slug, orgId);
  const merchantState =
    account === null
      ? null
      : buildMerchantState(account, merchantAccountResult.status);

  if (
    merchantAccountResult.status !== "connected" ||
    account === null ||
    merchantAccount === null ||
    merchantState === null
  ) {
    return <NoVortexMerchantAccountState slug={slug} title={copy.title} />;
  }

  return (
    <PageWrapper title={copy.title} description={copy.description}>
      <VortexPaymentsProvider
        config={{
          baseUrl: window.location.origin,
          environment: "test",
          organizationId: String(orgId ?? slug),
          branding: { brandName: "Seal", showVortexBrand: true },
        }}
      >
        <div className="mt-6 space-y-6">
          {surface === "balances" && (
            <VortexBalanceWalletPanel
              balance={buildBalanceWalletState(
                merchantState,
                account.defaultCurrency,
              )}
              classNames={vortexPaymentsClassNames}
              readOnly
              copy={{
                title: "Balance ledger",
                emptyDescription:
                  "Merchant balance projection is owned by Vortex Payments.",
                emptyStateDescription:
                  "Settlement entries will appear here after Seal writes merchant balance events into Vortex.",
              }}
            />
          )}

          {surface === "payouts" && (
            <>
              <VortexPayoutReadinessPanel
                merchantState={merchantState}
                classNames={vortexPaymentsClassNames}
                readOnly
                copy={{
                  title: "Payout readiness",
                  readyDescription:
                    "This merchant account is ready for payouts through Vortex Payments.",
                  blockedDescription:
                    "This merchant account still has payout requirements to resolve.",
                }}
              />
              <VortexMerchantActionQueue
                merchantState={merchantState}
                classNames={vortexPaymentsClassNames}
                readOnly
              />
            </>
          )}

          {surface === "history" && (
            <VortexPaymentTimelineSummary
              timeline={buildPaymentTimelineState(
                merchantState,
                account.defaultCurrency,
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
          )}

          {surface === "disputes" && (
            <VortexOperationalPlaceholder
              title="Dispute operations"
              description="Vortex Payments will own dispute intake, evidence, and resolution. No embedded provider dispute console remains in Seal."
              icon={AlertTriangle}
              slug={slug}
              surface="merchant-disputes-replacement"
            />
          )}

          {surface === "tax" && (
            <VortexOperationalPlaceholder
              title="Tax document operations"
              description="Vortex Payments will own tax document delivery when this merchant surface is needed. Seal no longer mounts an embedded provider document console."
              icon={FileText}
              slug={slug}
              surface="merchant-tax-documents-replacement"
            />
          )}

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
  status: MerchantConnectionStatus,
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
        account.requirements?.disabledReason === undefined
          ? undefined
          : "restricted",
      routeStatus: status,
    }),
    onboardingStatus: account.detailsSubmitted ? "approved" : "action_required",
    openRequirementIds,
    activeCapabilityKeys,
    restrictedCapabilityKeys,
    canAcceptPayments: account.chargesEnabled,
    payoutReadiness: account.payoutsEnabled ? "ready" : "blocked",
    payoutBlockReason: account.payoutsEnabled
      ? undefined
      : account.requirements?.disabledReason,
    capabilitySnapshots: [],
    generatedAt: toIsoTimestamp(account.updatedAt),
  };
}

function buildBalanceWalletState(
  merchantState: VortexMerchantState,
  defaultCurrency: string | undefined,
): VortexBalanceWalletState {
  return {
    customerId: merchantState.merchantAccountId,
    billingAccountId: merchantState.merchantAccountId,
    status: "empty",
    currency: defaultCurrency?.toUpperCase() ?? "USD",
    availableAmount: 0,
    pendingAmount: 0,
    entries: [],
    nextAction: "Project settlement balance events from Vortex Payments.",
  };
}

function buildPaymentTimelineState(
  merchantState: VortexMerchantState,
  defaultCurrency: string | undefined,
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
  routeStatus: MerchantConnectionStatus | undefined;
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
