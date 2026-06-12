import type { ComponentType, ReactNode } from "react";

type VortexEmbeddedComponentClassNames = {
  actions?: string;
  button?: string;
  description?: string;
  empty?: string;
  emptyDescription?: string;
  emptyEntriesDescription?: string;
  emptyStateDescription?: string;
  error?: string;
  header?: string;
  item?: string;
  itemDescription?: string;
  itemTitle?: string;
  list?: string;
  loading?: string;
  metricLabel?: string;
  metrics?: string;
  metricValue?: string;
  readyDescription?: string;
  blockedDescription?: string;
  root?: string;
  status?: string;
  title?: string;
};

type VortexPaymentsEnvironment = "development" | "staging" | "production" | "test";

type VortexPaymentsProviderConfig = {
  baseUrl: string;
  environment?: VortexPaymentsEnvironment;
  organizationId?: string;
  branding?: { brandName: string; showVortexBrand?: boolean };
};

type VortexMerchantAccount = {
  id: string;
  environment: string;
  tenantId: string;
  displayName: string;
  legalEntityType: string;
  country: string;
  merchantMode: string;
  defaultCurrency: string;
  status: "draft" | "pending_review" | "active" | "restricted" | "suspended";
  capabilityStatus: string;
  associatedIdentities: unknown[];
  metadata: Record<string, unknown>;
  processorAccountRefs: unknown[];
  createdAt: string;
  updatedAt: string;
};

type VortexMerchantState = {
  merchantAccountId: string;
  environment: string;
  merchantStatus: "draft" | "pending_review" | "active" | "restricted" | "suspended";
  onboardingStatus: string;
  openRequirementIds: string[];
  activeCapabilityKeys: string[];
  restrictedCapabilityKeys: string[];
  canAcceptPayments: boolean;
  payoutReadiness: "ready" | "blocked";
  payoutBlockReason?: string;
  capabilitySnapshots: unknown[];
  generatedAt?: string;
};

type VortexMerchantAccountPanelProps = {
  merchantAccount: VortexMerchantAccount;
  merchantState?: VortexMerchantState | null;
  classNames?: VortexEmbeddedComponentClassNames;
  copy?: { title?: string };
  disabled?: boolean;
  readOnly?: boolean;
};

type VortexBalanceWalletState = {
  customerId: string;
  billingAccountId: string;
  status: string;
  currency: string;
  availableAmount: number;
  pendingAmount: number;
  entries: unknown[];
  nextAction?: string;
};

type VortexPaymentTimelineState = {
  customerId: string;
  billingAccountId: string;
  status: string;
  currency: string;
  entries: unknown[];
  nextAction?: string;
};

type VortexPlanComparisonPlan = {
  id: string;
  cadence: string;
  cadenceLabel: string;
  currency: string;
  description?: string;
  disabledReason?: string;
  featureHighlights?: readonly string[];
  priceAmount: number;
  status: "current" | "available" | "recommended" | "upcoming";
  title: string;
  lookupKey?: string | null;
};

type VortexPlanComparisonState = {
  currentPlanId: string;
  customerId: string;
  message?: string;
  plans: VortexPlanComparisonPlan[];
  recommendedPlanId?: string;
  selectedPlanId?: string;
  status: "ready" | "empty";
};

type VortexSubscriptionActionSummaryStatus =
  | "none"
  | "active"
  | "past_due"
  | "canceled"
  | "scheduled_cancellation"
  | "trialing"
  | "payment_action_required";

type VortexSubscriptionActionSummaryAction = "change_plan" | "open_portal" | "custom";

type VortexSubscriptionActionSummaryState = {
  action: VortexSubscriptionActionSummaryAction;
  actionDisabledReason?: string;
  amountDue?: number;
  cadenceLabel?: string;
  currency: string;
  customerId: string;
  description?: string;
  planLabel: string;
  renewalAt?: string;
  scheduledCancelAt?: string;
  status: VortexSubscriptionActionSummaryStatus;
  subscriptionId?: string;
  title: string;
  trialEndsAt?: string;
};

type VortexFeePolicyOwnerMode = "merchant_pays" | "customer_pays";

type VortexFeePolicyState = {
  merchantAccountId: string;
  ownerMode: VortexFeePolicyOwnerMode;
  platformFeeLabel: string;
  settlementLabel: string;
  options: readonly {
    ownerMode: VortexFeePolicyOwnerMode;
    title: string;
    description: string;
  }[];
  note?: string;
};

function StubComponent({ children }: { children?: ReactNode }) {
  return <>{children}</>;
}

export const VortexPaymentsProvider = StubComponent as ComponentType<{
  config: VortexPaymentsProviderConfig;
  navigate?: () => void;
  children?: ReactNode;
}>;

export const VortexMerchantAccountPanel =
  StubComponent as ComponentType<VortexMerchantAccountPanelProps>;

export const VortexMerchantActionQueue = StubComponent as ComponentType<{
  merchantState: VortexMerchantState;
  classNames?: VortexEmbeddedComponentClassNames;
  copy?: { title?: string };
  disabled?: boolean;
  readOnly?: boolean;
}>;

export const VortexBalanceWalletPanel = StubComponent as ComponentType<{
  balance: VortexBalanceWalletState;
  classNames?: VortexEmbeddedComponentClassNames;
  readOnly?: boolean;
  copy?: Record<string, string>;
}>;

export const VortexPayoutReadinessPanel = StubComponent as ComponentType<{
  merchantState: VortexMerchantState;
  classNames?: VortexEmbeddedComponentClassNames;
  readOnly?: boolean;
  copy?: Record<string, string>;
}>;

export const VortexPaymentTimelineSummary = StubComponent as ComponentType<{
  timeline: VortexPaymentTimelineState;
  classNames?: VortexEmbeddedComponentClassNames;
  readOnly?: boolean;
  copy?: Record<string, string>;
}>;

export const VortexFeePolicyPanel = StubComponent as ComponentType<{
  feePolicy: VortexFeePolicyState;
  classNames?: VortexEmbeddedComponentClassNames;
  disabled?: boolean;
  loading?: boolean;
  onPolicyChange?: (ownerMode: VortexFeePolicyOwnerMode) => void;
}>;

export const VortexPlanComparison = StubComponent as ComponentType<{
  comparison: VortexPlanComparisonState;
  classNames?: VortexEmbeddedComponentClassNames;
  disabled?: boolean;
  loading?: boolean;
  copy?: Record<string, string>;
  onPlanSelect?: (plan: VortexPlanComparisonPlan) => void;
}>;

export const VortexSubscriptionActionSummary = StubComponent as ComponentType<{
  subscription: VortexSubscriptionActionSummaryState;
  classNames?: VortexEmbeddedComponentClassNames;
  copy?: Record<string, string>;
  onAction?: (actionSummary: VortexSubscriptionActionSummaryState) => void;
}>;

export type {
  VortexEmbeddedComponentClassNames,
  VortexPaymentsEnvironment,
  VortexPlanComparisonPlan,
  VortexPlanComparisonState,
  VortexSubscriptionActionSummaryAction,
  VortexSubscriptionActionSummaryState,
  VortexSubscriptionActionSummaryStatus,
  VortexMerchantAccountPanelProps,
  VortexMerchantAccount,
  VortexMerchantState,
  VortexBalanceWalletState,
  VortexPaymentTimelineState,
  VortexFeePolicyOwnerMode,
  VortexFeePolicyState,
};
