declare module "@vortex/payments/react" {
  import type { ComponentType, ReactNode } from "react";

  export type VortexPaymentsEnvironment = "development" | "production" | "test";

  export type VortexEmbeddedComponentClassNames = Record<string, string>;

  export type VortexMerchantStatus =
    | "active"
    | "restricted"
    | "pending_review"
    | "draft";

  export type VortexMerchantAccount = {
    id: string;
    environment: string;
    tenantId: string;
    displayName: string;
    legalEntityType: string;
    country: string;
    merchantMode: string;
    defaultCurrency: string;
    status: VortexMerchantStatus;
    capabilityStatus: string;
    associatedIdentities: unknown[];
    metadata: Record<string, unknown>;
    processorAccountRefs: unknown[];
    createdAt: string | undefined;
    updatedAt: string | undefined;
  };

  export type VortexMerchantState = {
    merchantAccountId: string;
    environment: string;
    merchantStatus: VortexMerchantStatus;
    onboardingStatus: "approved" | "action_required";
    openRequirementIds: string[];
    activeCapabilityKeys: string[];
    restrictedCapabilityKeys: string[];
    canAcceptPayments: boolean;
    payoutReadiness: "ready" | "blocked";
    payoutBlockReason: string | undefined;
    capabilitySnapshots: unknown[];
    generatedAt: string | undefined;
  };

  export type VortexMerchantAccountPanelProps = {
    merchantAccount: VortexMerchantAccount | null;
    merchantState: VortexMerchantState | null;
    classNames: VortexEmbeddedComponentClassNames;
    copy?: Record<string, string>;
    disabled?: boolean;
    readOnly?: boolean;
  };

  export type VortexBalanceWalletState = {
    customerId: string;
    billingAccountId: string;
    status: string;
    currency: string;
    availableAmount: number;
    pendingAmount: number;
    entries: unknown[];
    nextAction: string;
  };

  export type VortexPaymentTimelineState = {
    customerId: string;
    billingAccountId: string;
    status: string;
    currency: string;
    entries: unknown[];
    nextAction: string;
  };

  export type VortexSubscriptionActionSummaryStatus =
    | "none"
    | "active"
    | "past_due"
    | "canceled"
    | "scheduled_cancellation"
    | "trialing";

  export type VortexSubscriptionActionSummaryAction = "change_plan" | "custom";

  export type VortexSubscriptionActionSummaryState = {
    action: VortexSubscriptionActionSummaryAction;
    actionDisabledReason?: string;
    amountDue?: number;
    cadenceLabel: string;
    currency: string;
    customerId: string;
    description: string;
    planLabel: string;
    renewalAt?: string;
    scheduledCancelAt?: string;
    status: VortexSubscriptionActionSummaryStatus;
    title: string;
    trialEndsAt?: string;
  };

  export type VortexPlanComparisonPlan = {
    cadence: string;
    cadenceLabel: string;
    currency: string;
    description: string;
    disabledReason?: string;
    featureHighlights: readonly string[];
    id: string;
    priceAmount: number;
    status: "current" | "available" | "recommended";
    title: string;
  };

  export type VortexPlanComparisonState = {
    currentPlanId: string;
    customerId: string;
    message?: string;
    plans: VortexPlanComparisonPlan[];
    recommendedPlanId?: string;
    status: "ready" | "empty";
  };

  export type VortexFeePolicyOwnerMode = "merchant_pays" | "customer_pays";

  export type VortexFeePolicyState = {
    merchantAccountId: string;
    ownerMode: VortexFeePolicyOwnerMode;
    platformFeeLabel: string;
    settlementLabel: string;
    options: {
      ownerMode: VortexFeePolicyOwnerMode;
      title: string;
      description: string;
    }[];
    note: string;
  };

  export type VortexPaymentsProviderConfig = {
    baseUrl: string;
    environment: VortexPaymentsEnvironment;
    organizationId?: string;
    branding?: { brandName: string; showVortexBrand?: boolean };
  };

  export const VortexPaymentsProvider: ComponentType<{
    config: VortexPaymentsProviderConfig;
    navigate?: () => void;
    children?: ReactNode;
  }>;

  export const VortexMerchantAccountPanel: ComponentType<VortexMerchantAccountPanelProps>;

  export const VortexMerchantActionQueue: ComponentType<{
    merchantState: VortexMerchantState;
    classNames: VortexEmbeddedComponentClassNames;
    copy?: Record<string, string>;
    disabled?: boolean;
    readOnly?: boolean;
  }>;

  export const VortexPayoutReadinessPanel: ComponentType<{
    merchantState: VortexMerchantState;
    classNames: VortexEmbeddedComponentClassNames;
    readOnly?: boolean;
    copy?: Record<string, string>;
  }>;

  export const VortexBalanceWalletPanel: ComponentType<{
    balance: VortexBalanceWalletState;
    classNames: VortexEmbeddedComponentClassNames;
    readOnly?: boolean;
    copy?: Record<string, string>;
  }>;

  export const VortexPaymentTimelineSummary: ComponentType<{
    timeline: VortexPaymentTimelineState;
    classNames: VortexEmbeddedComponentClassNames;
    readOnly?: boolean;
    copy?: Record<string, string>;
  }>;

  export const VortexPlanComparison: ComponentType<{
    comparison: VortexPlanComparisonState;
    classNames: VortexEmbeddedComponentClassNames;
    disabled?: boolean;
    loading?: boolean;
    copy?: Record<string, string>;
    onPlanSelect?: (plan: VortexPlanComparisonPlan) => void;
  }>;

  export const VortexSubscriptionActionSummary: ComponentType<{
    subscription: VortexSubscriptionActionSummaryState;
    classNames: VortexEmbeddedComponentClassNames;
    copy?: Record<string, string>;
    onAction?: (state: VortexSubscriptionActionSummaryState) => void;
  }>;

  export const VortexFeePolicyPanel: ComponentType<{
    feePolicy: VortexFeePolicyState;
    classNames: VortexEmbeddedComponentClassNames;
    disabled?: boolean;
    loading?: boolean;
    onPolicyChange?: (ownerMode: VortexFeePolicyOwnerMode) => void;
  }>;
}