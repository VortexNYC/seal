declare module "@vortex/payments/react" {
  import type { ComponentType, ReactNode } from "react";

  export type VortexEmbeddedComponentClassNames = Record<string, string>;

  export type VortexFeePolicyOwnerMode = "merchant_pays" | "customer_pays";

  export type VortexPaymentsEnvironment = "production" | "development" | "test";

  export type VortexSubscriptionActionSummaryAction = "change_plan" | "custom";

  export type VortexSubscriptionActionSummaryStatus =
    | "none"
    | "scheduled_cancellation"
    | "past_due"
    | "canceled"
    | "trialing"
    | "active";

  export interface VortexFeePolicyState {
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
  }

  export interface VortexMerchantAccount {
    id: string;
    environment: string;
    tenantId: string;
    displayName: string;
    legalEntityType: string;
    country: string;
    merchantMode: string;
    defaultCurrency: string;
    status: "active" | "restricted" | "pending_review" | "draft";
    capabilityStatus: "active" | "restricted";
    associatedIdentities: readonly unknown[];
    metadata: Record<string, unknown>;
    processorAccountRefs: readonly unknown[];
    createdAt: string;
    updatedAt: string;
  }

  export interface VortexMerchantState {
    merchantAccountId: string;
    environment: string;
    merchantStatus: "active" | "restricted" | "pending_review" | "draft";
    onboardingStatus: "approved" | "action_required";
    openRequirementIds: readonly string[];
    activeCapabilityKeys: readonly string[];
    restrictedCapabilityKeys: readonly string[];
    canAcceptPayments: boolean;
    payoutReadiness: "ready" | "blocked";
    payoutBlockReason?: string;
    capabilitySnapshots: readonly unknown[];
    generatedAt: string;
  }

  export interface VortexMerchantAccountPanelProps {
    merchantAccount: VortexMerchantAccount;
    merchantState?: VortexMerchantState;
  }

  export interface VortexPlanComparisonPlan {
    cadence: string;
    cadenceLabel: string;
    currency: string;
    description: string;
    disabledReason?: string;
    featureHighlights: readonly string[];
    id: string;
    priceAmount: number;
    status: string;
    title: string;
  }

  export interface VortexPlanComparisonState {
    currentPlanId: string;
    customerId: string;
    message?: string;
    plans: readonly VortexPlanComparisonPlan[];
    recommendedPlanId?: string;
    status: string;
  }

  export interface VortexSubscriptionActionSummaryState {
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
  }

  export interface VortexBalanceWalletState {
    customerId: string;
    billingAccountId: string;
    status: string;
    currency: string;
    availableAmount: number;
    pendingAmount: number;
    entries: readonly unknown[];
    nextAction: string;
  }

  export interface VortexPaymentTimelineState {
    customerId: string;
    billingAccountId: string;
    status: string;
    currency: string;
    entries: readonly unknown[];
    nextAction: string;
  }

  export interface VortexPaymentsProviderProps {
    config: {
      baseUrl: string;
      environment: VortexPaymentsEnvironment;
      organizationId?: string;
      branding?: {
        brandName: string;
        showVortexBrand?: boolean;
      };
    };
    navigate?: () => void;
    children?: ReactNode;
  }

  export const VortexPaymentsProvider: ComponentType<VortexPaymentsProviderProps>;

  export const VortexBalanceWalletPanel: ComponentType<{
    balance: VortexBalanceWalletState;
    classNames?: VortexEmbeddedComponentClassNames;
    readOnly?: boolean;
    copy?: {
      title?: string;
      emptyDescription?: string;
      emptyStateDescription?: string;
      emptyEntriesDescription?: string;
    };
  }>;

  export const VortexFeePolicyPanel: ComponentType<{
    feePolicy: VortexFeePolicyState;
    classNames?: VortexEmbeddedComponentClassNames;
    disabled?: boolean;
    loading?: boolean;
    onPolicyChange: (ownerMode: VortexFeePolicyOwnerMode) => void;
  }>;

  export const VortexMerchantAccountPanel: ComponentType<{
    merchantAccount: VortexMerchantAccount;
    merchantState: VortexMerchantState;
    classNames?: VortexEmbeddedComponentClassNames;
    copy?: { title?: string };
    disabled?: boolean;
    readOnly?: boolean;
  }>;

  export const VortexMerchantActionQueue: ComponentType<{
    merchantState: VortexMerchantState;
    classNames?: VortexEmbeddedComponentClassNames;
    copy?: { title?: string };
    disabled?: boolean;
    readOnly?: boolean;
  }>;

  export const VortexPaymentTimelineSummary: ComponentType<{
    timeline: VortexPaymentTimelineState;
    classNames?: VortexEmbeddedComponentClassNames;
    readOnly?: boolean;
    copy?: {
      title?: string;
      emptyDescription?: string;
      emptyEntriesDescription?: string;
    };
  }>;

  export const VortexPayoutReadinessPanel: ComponentType<{
    merchantState: VortexMerchantState;
    classNames?: VortexEmbeddedComponentClassNames;
    readOnly?: boolean;
    copy?: {
      title?: string;
      readyDescription?: string;
      blockedDescription?: string;
    };
  }>;

  export const VortexPlanComparison: ComponentType<{
    comparison: VortexPlanComparisonState;
    classNames?: VortexEmbeddedComponentClassNames;
    disabled?: boolean;
    loading?: boolean;
    copy?: {
      currentButtonLabel?: string;
      loadingTitle?: string;
      openCheckoutLabel?: string;
      selectPlanLabel?: string;
      title?: string;
    };
    onPlanSelect: (plan: VortexPlanComparisonPlan) => void;
  }>;

  export const VortexSubscriptionActionSummary: ComponentType<{
    subscription: VortexSubscriptionActionSummaryState;
    classNames?: VortexEmbeddedComponentClassNames;
    copy?: {
      customActionLabel?: string;
      title?: string;
    };
    onAction: (actionSummary: VortexSubscriptionActionSummaryState) => void;
  }>;
}
