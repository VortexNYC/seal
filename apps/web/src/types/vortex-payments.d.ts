declare module "@vortex/payments/react" {
  import type { FC, ReactNode } from "react";

  export type VortexEmbeddedComponentClassNames = {
    readonly actions?: string;
    readonly button?: string;
    readonly description?: string;
    readonly empty?: string;
    readonly error?: string;
    readonly header?: string;
    readonly item?: string;
    readonly itemDescription?: string;
    readonly itemTitle?: string;
    readonly list?: string;
    readonly loading?: string;
    readonly metricLabel?: string;
    readonly metrics?: string;
    readonly metricValue?: string;
    readonly root?: string;
    readonly status?: string;
    readonly title?: string;
  };

  export type VortexPaymentsEnvironment = "production" | "development" | "test" | "sandbox";

  export type VortexFeePolicyOwnerMode = "merchant_pays" | "customer_pays";

  export type VortexFeePolicyState = {
    readonly merchantAccountId: string;
    ownerMode: VortexFeePolicyOwnerMode;
    readonly platformFeeLabel: string;
    readonly settlementLabel: string;
    readonly options: ReadonlyArray<{
      readonly ownerMode: VortexFeePolicyOwnerMode;
      readonly title: string;
      readonly description: string;
    }>;
    readonly note: string;
  };

  export type VortexMerchantAccount = {
    readonly id: string;
    readonly environment: string;
    readonly tenantId: string;
    readonly displayName: string;
    readonly legalEntityType: string;
    readonly country: string;
    readonly merchantMode: string;
    readonly defaultCurrency: string;
    status: "active" | "draft" | "pending_review" | "restricted" | "suspended";
    readonly capabilityStatus: "active" | "restricted";
    readonly associatedIdentities: readonly string[];
    readonly metadata: Record<string, unknown>;
    readonly processorAccountRefs: readonly string[];
    readonly createdAt: string;
    readonly updatedAt: string;
  };

  export type VortexMerchantState = {
    readonly merchantAccountId: string;
    readonly environment: string;
    readonly merchantStatus: VortexMerchantAccount["status"];
    readonly onboardingStatus: string;
    readonly openRequirementIds: readonly string[];
    readonly activeCapabilityKeys: readonly string[];
    readonly restrictedCapabilityKeys: readonly string[];
    readonly canAcceptPayments: boolean;
    readonly payoutReadiness: "ready" | "blocked";
    readonly payoutBlockReason?: string;
    readonly capabilitySnapshots: readonly unknown[];
    readonly generatedAt: string;
  };

  export interface VortexMerchantAccountPanelProps {
    readonly merchantAccount: VortexMerchantAccount;
    readonly merchantState: VortexMerchantState;
    readonly classNames: VortexEmbeddedComponentClassNames;
    readonly readOnly?: boolean;
    readonly disabled?: boolean;
    readonly copy?: { readonly title?: string };
  }

  export type VortexBalanceWalletState = {
    readonly customerId: string;
    readonly billingAccountId: string;
    readonly status: string;
    readonly currency: string;
    readonly availableAmount: number;
    readonly pendingAmount: number;
    readonly entries: readonly unknown[];
    readonly nextAction: string;
  };

  export type VortexPaymentTimelineState = {
    readonly customerId: string;
    readonly billingAccountId: string;
    readonly status: string;
    readonly currency: string;
    readonly entries: readonly unknown[];
    readonly nextAction: string;
  };

  export type VortexSubscriptionActionSummaryAction = "change_plan" | "custom";

  export type VortexSubscriptionActionSummaryStatus =
    | "active"
    | "none"
    | "scheduled_cancellation"
    | "past_due"
    | "canceled"
    | "trialing";

  export type VortexSubscriptionActionSummaryState = {
    readonly action: VortexSubscriptionActionSummaryAction;
    readonly actionDisabledReason?: string;
    readonly amountDue?: number;
    readonly cadenceLabel: string;
    readonly currency: string;
    readonly customerId: string;
    readonly description: string;
    readonly planLabel: string;
    readonly renewalAt?: string;
    readonly scheduledCancelAt?: string;
    readonly status: VortexSubscriptionActionSummaryStatus;
    readonly title: string;
    readonly trialEndsAt?: string;
  };

  export type VortexPlanComparisonPlan = {
    readonly cadence: string;
    readonly cadenceLabel: string;
    readonly currency: string;
    readonly description: string;
    readonly disabledReason?: string;
    readonly featureHighlights: readonly string[];
    readonly id: string;
    readonly priceAmount: number;
    readonly status: string;
    readonly title: string;
  };

  export type VortexPlanComparisonState = {
    readonly currentPlanId: string;
    readonly customerId: string;
    readonly message?: string;
    readonly plans: readonly VortexPlanComparisonPlan[];
    readonly recommendedPlanId?: string;
    readonly status: string;
  };

  export const VortexPaymentsProvider: FC<{
    readonly config: {
      readonly baseUrl: string;
      readonly environment: VortexPaymentsEnvironment;
      readonly organizationId?: string;
      readonly branding: { readonly brandName: string; readonly showVortexBrand?: boolean };
    };
    readonly navigate?: () => undefined;
    readonly children?: ReactNode;
  }>;

  export const VortexMerchantAccountPanel: FC<VortexMerchantAccountPanelProps>;

  export const VortexMerchantActionQueue: FC<{
    readonly merchantState: VortexMerchantState;
    readonly classNames: VortexEmbeddedComponentClassNames;
    readonly readOnly?: boolean;
    readonly disabled?: boolean;
    readonly copy?: { readonly title?: string };
  }>;

  export const VortexBalanceWalletPanel: FC<{
    readonly balance: VortexBalanceWalletState;
    readonly classNames: VortexEmbeddedComponentClassNames;
    readonly readOnly?: boolean;
    readonly copy?: {
      readonly title?: string;
      readonly emptyDescription?: string;
      readonly emptyStateDescription?: string;
    };
  }>;

  export const VortexPaymentTimelineSummary: FC<{
    readonly timeline: VortexPaymentTimelineState;
    readonly classNames: VortexEmbeddedComponentClassNames;
    readonly readOnly?: boolean;
    readonly copy?: {
      readonly title?: string;
      readonly emptyDescription?: string;
      readonly emptyEntriesDescription?: string;
    };
  }>;

  export const VortexPayoutReadinessPanel: FC<{
    readonly merchantState: VortexMerchantState;
    readonly classNames: VortexEmbeddedComponentClassNames;
    readonly readOnly?: boolean;
    readonly copy?: {
      readonly title?: string;
      readonly readyDescription?: string;
      readonly blockedDescription?: string;
    };
  }>;

  export const VortexFeePolicyPanel: FC<{
    readonly feePolicy: VortexFeePolicyState;
    readonly classNames: VortexEmbeddedComponentClassNames;
    readonly disabled?: boolean;
    readonly loading?: boolean;
    readonly onPolicyChange?: (ownerMode: VortexFeePolicyOwnerMode) => void;
  }>;

  export const VortexPlanComparison: FC<{
    readonly comparison: VortexPlanComparisonState;
    readonly classNames: VortexEmbeddedComponentClassNames;
    readonly disabled?: boolean;
    readonly loading?: boolean;
    readonly copy?: {
      readonly currentButtonLabel?: string;
      readonly loadingTitle?: string;
      readonly openCheckoutLabel?: string;
      readonly selectPlanLabel?: string;
      readonly title?: string;
    };
    readonly onPlanSelect?: (plan: VortexPlanComparisonPlan) => void;
  }>;

  export const VortexSubscriptionActionSummary: FC<{
    readonly subscription: VortexSubscriptionActionSummaryState;
    readonly classNames: VortexEmbeddedComponentClassNames;
    readonly copy?: { readonly customActionLabel?: string; readonly title?: string };
    readonly onAction?: (action: VortexSubscriptionActionSummaryState) => void;
  }>;
}
