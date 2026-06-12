/// <reference types="react" />

declare module "@vortex/payments/react" {
  import type { ReactNode, ComponentType } from "react";

  // -- shared types --

  export type VortexEmbeddedComponentClassNames = Record<string, string>;

  export type VortexPaymentsEnvironment = "development" | "test" | "production";

  export interface VortexPaymentsProviderProps {
    config: {
      baseUrl: string;
      environment: VortexPaymentsEnvironment;
      organizationId?: string;
      branding?: {
        brandName?: string;
        showVortexBrand?: boolean;
      };
    };
    navigate?: () => undefined;
    children?: ReactNode;
  }

  export const VortexPaymentsProvider: ComponentType<VortexPaymentsProviderProps>;

  // -- merchant account / action --

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
    capabilityStatus: string;
    associatedIdentities: unknown[];
    metadata: Record<string, unknown>;
    processorAccountRefs: unknown[];
    createdAt: string;
    updatedAt: string;
  }

  export interface VortexMerchantState {
    merchantAccountId: string;
    environment: string;
    merchantStatus: string;
    onboardingStatus: string;
    openRequirementIds: string[];
    activeCapabilityKeys: string[];
    restrictedCapabilityKeys: string[];
    canAcceptPayments: boolean;
    payoutReadiness: string;
    payoutBlockReason?: string;
    capabilitySnapshots: unknown[];
    generatedAt?: string;
  }

  export interface VortexMerchantAccountPanelProps {
    merchantAccount: VortexMerchantAccount;
    merchantState: VortexMerchantState;
    classNames?: VortexEmbeddedComponentClassNames;
    readOnly?: boolean;
    disabled?: boolean;
    copy?: { title?: string };
  }

  export const VortexMerchantAccountPanel: ComponentType<VortexMerchantAccountPanelProps>;

  export interface VortexMerchantActionQueueProps {
    merchantState: VortexMerchantState;
    classNames?: VortexEmbeddedComponentClassNames;
    copy?: { title?: string };
    disabled?: boolean;
    readOnly?: boolean;
  }

  export const VortexMerchantActionQueue: ComponentType<VortexMerchantActionQueueProps>;

  // -- balance / payouts / timeline --

  export interface VortexBalanceWalletState {
    customerId: string;
    billingAccountId: string;
    status: string;
    currency: string;
    availableAmount: number;
    pendingAmount: number;
    entries: unknown[];
    nextAction?: string;
  }

  export interface VortexBalanceWalletPanelProps {
    balance: VortexBalanceWalletState;
    classNames?: VortexEmbeddedComponentClassNames;
    readOnly?: boolean;
    copy?: Record<string, string>;
  }

  export const VortexBalanceWalletPanel: ComponentType<VortexBalanceWalletPanelProps>;

  export interface VortexPayoutReadinessPanelProps {
    merchantState: VortexMerchantState;
    classNames?: VortexEmbeddedComponentClassNames;
    readOnly?: boolean;
    copy?: Record<string, string>;
  }

  export const VortexPayoutReadinessPanel: ComponentType<VortexPayoutReadinessPanelProps>;

  export interface VortexPaymentTimelineState {
    customerId: string;
    billingAccountId: string;
    status: string;
    currency: string;
    entries: unknown[];
    nextAction?: string;
  }

  export interface VortexPaymentTimelineSummaryProps {
    timeline: VortexPaymentTimelineState;
    classNames?: VortexEmbeddedComponentClassNames;
    readOnly?: boolean;
    copy?: Record<string, string>;
  }

  export const VortexPaymentTimelineSummary: ComponentType<VortexPaymentTimelineSummaryProps>;

  // -- billing / plan comparison --

  export type VortexSubscriptionActionSummaryStatus =
    | "none"
    | "active"
    | "trialing"
    | "past_due"
    | "scheduled_cancellation"
    | "canceled";

  export type VortexSubscriptionActionSummaryAction = "change_plan" | "custom";

  export interface VortexSubscriptionActionSummaryState {
    action: VortexSubscriptionActionSummaryAction;
    actionDisabledReason?: string;
    amountDue?: number;
    cadenceLabel?: string;
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

  export interface VortexSubscriptionActionSummaryProps {
    subscription: VortexSubscriptionActionSummaryState;
    classNames?: VortexEmbeddedComponentClassNames;
    copy?: Record<string, string>;
    onAction?: (actionSummary: VortexSubscriptionActionSummaryState) => void;
  }

  export const VortexSubscriptionActionSummary: ComponentType<VortexSubscriptionActionSummaryProps>;

  export type VortexPlanComparisonPlan = {
    id: string;
    title: string;
    description: string;
    priceAmount: number;
    currency: string;
    cadence: string;
    cadenceLabel: string;
    featureHighlights: readonly string[];
    status: "current" | "available" | "recommended";
    disabledReason?: string;
  };

  export interface VortexPlanComparisonState {
    currentPlanId: string;
    customerId: string;
    message?: string;
    plans: VortexPlanComparisonPlan[];
    recommendedPlanId?: string;
    status: string;
  }

  export interface VortexPlanComparisonProps {
    comparison: VortexPlanComparisonState;
    classNames?: VortexEmbeddedComponentClassNames;
    disabled?: boolean;
    loading?: boolean;
    copy?: Record<string, string>;
    onPlanSelect?: (plan: VortexPlanComparisonPlan) => void;
  }

  export const VortexPlanComparison: ComponentType<VortexPlanComparisonProps>;

  // -- fee policy --

  export type VortexFeePolicyOwnerMode = "merchant_pays" | "customer_pays";

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

  export interface VortexFeePolicyPanelProps {
    feePolicy: VortexFeePolicyState;
    classNames?: VortexEmbeddedComponentClassNames;
    disabled?: boolean;
    loading?: boolean;
    onPolicyChange?: (ownerMode: VortexFeePolicyOwnerMode) => void;
  }

  export const VortexFeePolicyPanel: ComponentType<VortexFeePolicyPanelProps>;
}
