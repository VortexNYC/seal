import type { ComponentPropsWithoutRef, FC, ReactNode } from "react";

export type VortexEmbeddedComponentClassNames = Partial<{
  actions: string;
  button: string;
  description: string;
  empty: string;
  error: string;
  header: string;
  item: string;
  itemDescription: string;
  itemTitle: string;
  list: string;
  loading: string;
  metricLabel: string;
  metrics: string;
  metricValue: string;
  root: string;
  status: string;
  title: string;
}>;

export type VortexBalanceWalletState = {
  customerId: string;
  billingAccountId: string;
  status: string;
  currency: string;
  availableAmount: number;
  pendingAmount: number;
  entries: readonly unknown[];
  nextAction: string;
};

export type VortexPaymentTimelineState = {
  customerId: string;
  billingAccountId: string;
  status: string;
  currency: string;
  entries: readonly unknown[];
  nextAction: string;
};

export type VortexMerchantAccount = {
  id: string;
  environment: string;
  tenantId: string;
  displayName: string;
  legalEntityType: string;
  country: string;
  merchantMode: string;
  defaultCurrency: string;
  status: "draft" | "pending_review" | "active" | "restricted" | "disabled";
  capabilityStatus: string;
  associatedIdentities: readonly unknown[];
  metadata: Record<string, unknown>;
  processorAccountRefs: readonly unknown[];
  createdAt: string;
  updatedAt: string;
};

export type VortexMerchantState = {
  merchantAccountId: string;
  environment: string;
  merchantStatus: VortexMerchantAccount["status"];
  onboardingStatus: string;
  openRequirementIds: readonly string[];
  activeCapabilityKeys: readonly string[];
  restrictedCapabilityKeys: readonly string[];
  canAcceptPayments: boolean;
  payoutReadiness: string;
  payoutBlockReason?: string;
  capabilitySnapshots: readonly unknown[];
  generatedAt: string;
};

export type VortexMerchantAccountPanelProps = {
  merchantAccount: VortexMerchantAccount;
  merchantState: VortexMerchantState;
};

export type VortexPaymentsEnvironment = "development" | "production" | "test";

type VortexPaymentsProviderConfig = {
  baseUrl: string;
  environment: VortexPaymentsEnvironment;
  organizationId?: string;
  branding?: {
    brandName?: string;
    showVortexBrand?: boolean;
  };
};

export type VortexPaymentsProviderProps = ComponentPropsWithoutRef<"div"> & {
  config: VortexPaymentsProviderConfig;
  navigate?: () => void;
};

export const VortexPaymentsProvider: FC<VortexPaymentsProviderProps> = () => null;

type VortexPanelCopy = Partial<{
  title: string;
  emptyDescription: string;
  emptyStateDescription: string;
  readyDescription: string;
  blockedDescription: string;
  customActionLabel: string;
  currentButtonLabel: string;
  loadingTitle: string;
  openCheckoutLabel: string;
  selectPlanLabel: string;
  emptyEntriesDescription: string;
}>;

type VortexBalanceWalletPanelProps = {
  balance: VortexBalanceWalletState;
  classNames?: VortexEmbeddedComponentClassNames;
  readOnly?: boolean;
  copy?: VortexPanelCopy;
};

export const VortexBalanceWalletPanel: FC<VortexBalanceWalletPanelProps> = () => null;

type VortexMerchantAccountPanelOwnProps = {
  merchantAccount: VortexMerchantAccount;
  merchantState: VortexMerchantState;
  classNames?: VortexEmbeddedComponentClassNames;
  copy?: VortexPanelCopy;
  disabled?: boolean;
  readOnly?: boolean;
};

export const VortexMerchantAccountPanel: FC<VortexMerchantAccountPanelOwnProps> = () => null;

type VortexMerchantActionQueueProps = {
  merchantState: VortexMerchantState;
  classNames?: VortexEmbeddedComponentClassNames;
  copy?: VortexPanelCopy;
  disabled?: boolean;
  readOnly?: boolean;
};

export const VortexMerchantActionQueue: FC<VortexMerchantActionQueueProps> = () => null;

type VortexPayoutReadinessPanelProps = {
  merchantState: VortexMerchantState;
  classNames?: VortexEmbeddedComponentClassNames;
  readOnly?: boolean;
  copy?: VortexPanelCopy;
};

export const VortexPayoutReadinessPanel: FC<VortexPayoutReadinessPanelProps> = () => null;

type VortexPaymentTimelineSummaryProps = {
  timeline: VortexPaymentTimelineState;
  classNames?: VortexEmbeddedComponentClassNames;
  readOnly?: boolean;
  copy?: VortexPanelCopy;
};

export const VortexPaymentTimelineSummary: FC<VortexPaymentTimelineSummaryProps> = () => null;

export type VortexSubscriptionActionSummaryAction = "change_plan" | "custom" | "cancel" | "reactivate";

export type VortexSubscriptionActionSummaryStatus =
  | "none"
  | "active"
  | "past_due"
  | "canceled"
  | "scheduled_cancellation"
  | "trialing";

export type VortexSubscriptionActionSummaryState = {
  action: VortexSubscriptionActionSummaryAction;
  actionDisabledReason?: string;
  amountDue?: number;
  cadenceLabel: string;
  currency: string;
  customerId: string;
  description?: string;
  planLabel: string;
  renewalAt?: string;
  scheduledCancelAt?: string;
  status: VortexSubscriptionActionSummaryStatus;
  title: string;
  trialEndsAt?: string;
};

type VortexSubscriptionActionSummaryProps = {
  subscription: VortexSubscriptionActionSummaryState;
  classNames?: VortexEmbeddedComponentClassNames;
  copy?: VortexPanelCopy;
  onAction: (state: VortexSubscriptionActionSummaryState) => void;
};

export const VortexSubscriptionActionSummary: FC<
  VortexSubscriptionActionSummaryProps
> = () => null;

export type VortexPlanComparisonPlan = {
  cadence: string;
  cadenceLabel: string;
  currency: string;
  description?: string;
  disabledReason?: string;
  featureHighlights?: readonly string[];
  id: string;
  priceAmount: number;
  status: "current" | "recommended" | "available";
  title: string;
};

export type VortexPlanComparisonState = {
  currentPlanId: string;
  customerId: string;
  message?: string;
  plans: readonly VortexPlanComparisonPlan[];
  recommendedPlanId?: string;
  status: "ready" | "empty";
};

type VortexPlanComparisonProps = {
  comparison: VortexPlanComparisonState;
  classNames?: VortexEmbeddedComponentClassNames;
  disabled?: boolean;
  loading?: boolean;
  copy?: VortexPanelCopy;
  onPlanSelect: (plan: VortexPlanComparisonPlan) => void;
};

export const VortexPlanComparison: FC<VortexPlanComparisonProps> = () => null;

export type VortexFeePolicyOwnerMode = "merchant_pays" | "customer_pays";

export type VortexFeePolicyState = {
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

type VortexFeePolicyPanelProps = {
  feePolicy: VortexFeePolicyState;
  classNames?: VortexEmbeddedComponentClassNames;
  disabled?: boolean;
  loading?: boolean;
  onPolicyChange: (ownerMode: VortexFeePolicyOwnerMode) => void;
};

export const VortexFeePolicyPanel: FC<VortexFeePolicyPanelProps> = () => null;
