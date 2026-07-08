import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type ButtonHTMLAttributes,
  type FormEvent,
  type ReactNode,
} from "react";
import type { MerchantAccountStateSnapshot } from "../application/state/contracts";
import {
  createVortexSurfaceProvider,
  type VortexHostedSurfaceRequest,
  type VortexSurfaceLaunch,
  type VortexSurfaceProviderConfig,
  type VortexSurfaceProviderRuntime,
} from "../surfaces";
import type { MerchantAccount } from "../domain/merchant";
import type {
  MerchantSellerPayoutProfileSnapshot,
  SettlementPayoutReadinessDetail,
} from "../application/payouts/contracts";

export type VortexPaymentsNavigationTarget = "_self" | "_blank";

function cx(...values: Array<string | false | null | undefined>): string {
  return values
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .join(" ");
}

export type VortexPaymentsProviderProps = {
  readonly config: VortexSurfaceProviderConfig;
  readonly children: ReactNode;
  readonly navigate?: (launch: VortexSurfaceLaunch) => void;
};

export type VortexHostedSurfaceButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "children" | "onClick" | "type"
> & {
  readonly request: VortexHostedSurfaceRequest;
  readonly children?: ReactNode;
  readonly loadingLabel?: ReactNode;
  readonly navigate?: (launch: VortexSurfaceLaunch) => void;
  readonly navigationTarget?: VortexPaymentsNavigationTarget;
  readonly onLaunch?: (launch: VortexSurfaceLaunch) => void;
  readonly onError?: (error: unknown) => void;
};

export type VortexCheckoutButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "children" | "onClick" | "type"
> & {
  readonly lookupKey: string;
  readonly createCheckoutSession: (args: { readonly lookupKey: string }) => Promise<{
    readonly checkoutUrl: string;
  }>;
  readonly children?: ReactNode;
  readonly loadingLabel?: ReactNode;
  readonly navigate?: (launch: VortexSurfaceLaunch) => void;
  readonly navigationTarget?: VortexPaymentsNavigationTarget;
  readonly onCheckoutCreated?: (launch: VortexSurfaceLaunch) => void;
  readonly onError?: (error: unknown) => void;
};

export type VortexCustomerPortalButtonProps = Omit<VortexHostedSurfaceButtonProps, "request"> & {
  readonly token: string;
};

export type VortexPaymentMethodsButtonProps = Omit<VortexHostedSurfaceButtonProps, "request"> & {
  readonly token: string;
};

export type VortexMerchantActionSeverity = "critical" | "warning" | "info";

export type VortexMerchantActionKind =
  | "merchant_status"
  | "onboarding_requirement"
  | "capability"
  | "payout_readiness"
  | "payment_readiness";

export type VortexMerchantActionQueueItem = {
  readonly id: string;
  readonly kind: VortexMerchantActionKind;
  readonly title: string;
  readonly description?: string;
  readonly severity: VortexMerchantActionSeverity;
  readonly status: "open" | "in_progress" | "blocked";
  readonly primaryActionLabel?: string;
  readonly primaryAction?: VortexHostedSurfaceRequest;
  readonly secondaryActionLabel?: string;
  readonly secondaryAction?: VortexHostedSurfaceRequest;
};

export type VortexEmbeddedComponentAppearance = {
  readonly colorScheme?: "light" | "dark" | "system";
  readonly density?: "compact" | "comfortable";
  readonly radius?: "none" | "sm" | "md";
  readonly accentColor?: string;
};

export type VortexEmbeddedComponentClassNames = {
  readonly root?: string;
  readonly header?: string;
  readonly title?: string;
  readonly description?: string;
  readonly metrics?: string;
  readonly metricLabel?: string;
  readonly metricValue?: string;
  readonly list?: string;
  readonly item?: string;
  readonly itemTitle?: string;
  readonly itemDescription?: string;
  readonly status?: string;
  readonly actions?: string;
  readonly button?: string;
  readonly empty?: string;
  readonly error?: string;
  readonly loading?: string;
};

export type VortexEmbeddedComponentReadyEvent = {
  readonly component: string;
  readonly surface: VortexSurfaceLaunch["surface"];
  readonly merchantAccountId?: string;
};

export type VortexEmbeddedComponentErrorEvent = {
  readonly component: string;
  readonly surface: VortexSurfaceLaunch["surface"];
  readonly error: unknown;
};

export type VortexMerchantActionQueueCopy = {
  readonly title?: ReactNode;
  readonly readyDescription?: ReactNode;
  readonly blockedDescription?: ReactNode;
  readonly loadingTitle?: ReactNode;
  readonly errorTitle?: ReactNode;
  readonly emptyTitle?: ReactNode;
  readonly emptyDescription?: ReactNode;
  readonly statusLabel?: ReactNode;
  readonly onboardingLabel?: ReactNode;
  readonly paymentCollectionLabel?: ReactNode;
  readonly payoutsLabel?: ReactNode;
};

export type VortexMerchantAccountPanelAction =
  | "open_onboarding"
  | "open_actions"
  | "open_payout_readiness";

export type VortexMerchantAccountPanelCopy = {
  readonly title?: ReactNode;
  readonly readyDescription?: ReactNode;
  readonly blockedDescription?: ReactNode;
  readonly loadingTitle?: ReactNode;
  readonly errorTitle?: ReactNode;
  readonly stateUnavailableTitle?: ReactNode;
  readonly stateUnavailableDescription?: ReactNode;
  readonly businessLabel?: ReactNode;
  readonly merchantModeLabel?: ReactNode;
  readonly merchantStatusLabel?: ReactNode;
  readonly paymentCollectionLabel?: ReactNode;
  readonly payoutReadinessLabel?: ReactNode;
  readonly defaultCurrencyLabel?: ReactNode;
  readonly activeCapabilitiesLabel?: ReactNode;
  readonly restrictedCapabilitiesLabel?: ReactNode;
  readonly openRequirementsLabel?: ReactNode;
  readonly openOnboardingLabel?: ReactNode;
  readonly openActionsLabel?: ReactNode;
  readonly openPayoutReadinessLabel?: ReactNode;
};

export type VortexMerchantAccountPanelProps = {
  readonly merchantAccount: MerchantAccount;
  readonly merchantState?: MerchantAccountStateSnapshot;
  readonly appearance?: VortexEmbeddedComponentAppearance;
  readonly classNames?: VortexEmbeddedComponentClassNames;
  readonly copy?: VortexMerchantAccountPanelCopy;
  readonly loading?: boolean;
  readonly error?: ReactNode;
  readonly disabled?: boolean;
  readonly readOnly?: boolean;
  readonly navigate?: (launch: VortexSurfaceLaunch) => void;
  readonly onActionLaunch?: (
    action: VortexMerchantAccountPanelAction,
    launch: VortexSurfaceLaunch,
  ) => void;
  readonly onAction?: (action: VortexMerchantAccountPanelAction) => void;
  readonly onReady?: (event: VortexEmbeddedComponentReadyEvent) => void;
  readonly onError?: (event: VortexEmbeddedComponentErrorEvent) => void;
  readonly className?: string;
};

export type VortexPayoutReadinessPanelAction = "open_merchant_account" | "open_actions";

export type VortexPayoutReadinessPanelCopy = {
  readonly title?: ReactNode;
  readonly readyDescription?: ReactNode;
  readonly blockedDescription?: ReactNode;
  readonly loadingTitle?: ReactNode;
  readonly errorTitle?: ReactNode;
  readonly profileUnavailableTitle?: ReactNode;
  readonly profileUnavailableDescription?: ReactNode;
  readonly payoutReadinessLabel?: ReactNode;
  readonly payoutModeLabel?: ReactNode;
  readonly payoutRailLabel?: ReactNode;
  readonly payoutScheduleLabel?: ReactNode;
  readonly currencyLabel?: ReactNode;
  readonly fundingRequirementLabel?: ReactNode;
  readonly latestSettlementLabel?: ReactNode;
  readonly latestPayoutLabel?: ReactNode;
  readonly settlementReadinessLabel?: ReactNode;
  readonly nextActionLabel?: ReactNode;
  readonly capabilitiesLabel?: ReactNode;
  readonly openMerchantAccountLabel?: ReactNode;
  readonly openActionsLabel?: ReactNode;
};

export type VortexPayoutReadinessPanelProps = {
  readonly merchantState: MerchantAccountStateSnapshot;
  readonly payoutProfile?: MerchantSellerPayoutProfileSnapshot;
  readonly settlementReadiness?: SettlementPayoutReadinessDetail;
  readonly appearance?: VortexEmbeddedComponentAppearance;
  readonly classNames?: VortexEmbeddedComponentClassNames;
  readonly copy?: VortexPayoutReadinessPanelCopy;
  readonly loading?: boolean;
  readonly error?: ReactNode;
  readonly disabled?: boolean;
  readonly readOnly?: boolean;
  readonly navigate?: (launch: VortexSurfaceLaunch) => void;
  readonly onActionLaunch?: (
    action: VortexPayoutReadinessPanelAction,
    launch: VortexSurfaceLaunch,
  ) => void;
  readonly onAction?: (action: VortexPayoutReadinessPanelAction) => void;
  readonly onReady?: (event: VortexEmbeddedComponentReadyEvent) => void;
  readonly onError?: (event: VortexEmbeddedComponentErrorEvent) => void;
  readonly className?: string;
};

export type VortexFeePolicyOwnerMode =
  | "merchant_pays"
  | "customer_pays"
  | "platform_absorbs"
  | "platform_fee_deducted";

export type VortexFeePolicyOption = {
  readonly ownerMode: VortexFeePolicyOwnerMode;
  readonly title: ReactNode;
  readonly description?: ReactNode;
  readonly disabled?: boolean;
};

export type VortexFeePolicyState = {
  readonly merchantAccountId: string;
  readonly ownerMode: VortexFeePolicyOwnerMode;
  readonly platformFeeLabel?: ReactNode;
  readonly settlementLabel?: ReactNode;
  readonly options: readonly VortexFeePolicyOption[];
  readonly note?: ReactNode;
};

export type VortexFeePolicyPanelCopy = {
  readonly title?: ReactNode;
  readonly description?: ReactNode;
  readonly loadingTitle?: ReactNode;
  readonly errorTitle?: ReactNode;
  readonly ownerModeLabel?: ReactNode;
  readonly platformFeeLabel?: ReactNode;
  readonly settlementLabel?: ReactNode;
  readonly policyOptionsLabel?: ReactNode;
};

export type VortexFeePolicyPanelProps = {
  readonly feePolicy: VortexFeePolicyState;
  readonly appearance?: VortexEmbeddedComponentAppearance;
  readonly classNames?: VortexEmbeddedComponentClassNames;
  readonly copy?: VortexFeePolicyPanelCopy;
  readonly loading?: boolean;
  readonly error?: ReactNode;
  readonly disabled?: boolean;
  readonly readOnly?: boolean;
  readonly onPolicyChange?: (
    ownerMode: VortexFeePolicyOwnerMode,
    policy: VortexFeePolicyState,
  ) => void | Promise<void>;
  readonly onReady?: (event: VortexEmbeddedComponentReadyEvent) => void;
  readonly onError?: (event: VortexEmbeddedComponentErrorEvent) => void;
  readonly className?: string;
};

export type VortexEmbeddedCheckoutLineItem = {
  readonly id: string;
  readonly label: ReactNode;
  readonly amount: number;
  readonly currency: string;
  readonly description?: ReactNode;
};

export type VortexEmbeddedCheckoutState = {
  readonly paymentRequestId: string;
  readonly status: "open" | "paid" | "canceled" | "expired";
  readonly amountRemaining: number;
  readonly currency: string;
  readonly customerLabel?: ReactNode;
  readonly merchantLabel?: ReactNode;
  readonly dueAt?: string;
  readonly expiresAt?: string;
  readonly lastAttemptStatus?: "succeeded" | "partial" | "failed" | "pending";
  readonly lastAttemptError?: ReactNode;
  readonly lineItems?: readonly VortexEmbeddedCheckoutLineItem[];
  readonly hostedCheckoutUrl?: string;
  readonly hostedRecoveryToken?: string;
};

export type VortexEmbeddedCheckoutCopy = {
  readonly title?: ReactNode;
  readonly readyDescription?: ReactNode;
  readonly paidDescription?: ReactNode;
  readonly blockedDescription?: ReactNode;
  readonly loadingTitle?: ReactNode;
  readonly errorTitle?: ReactNode;
  readonly emptyTitle?: ReactNode;
  readonly emptyDescription?: ReactNode;
  readonly amountDueLabel?: ReactNode;
  readonly statusLabel?: ReactNode;
  readonly customerLabel?: ReactNode;
  readonly merchantLabel?: ReactNode;
  readonly dueAtLabel?: ReactNode;
  readonly expiresAtLabel?: ReactNode;
  readonly startPaymentMethodSetupLabel?: ReactNode;
  readonly submitTokenizedPaymentMethodLabel?: ReactNode;
  readonly openHostedCheckoutLabel?: ReactNode;
  readonly secureEntryReadyLabel?: ReactNode;
};

export type VortexEmbeddedCheckoutProps = {
  readonly checkout: VortexEmbeddedCheckoutState;
  readonly appearance?: VortexEmbeddedComponentAppearance;
  readonly classNames?: VortexEmbeddedComponentClassNames;
  readonly copy?: VortexEmbeddedCheckoutCopy;
  readonly loading?: boolean;
  readonly error?: ReactNode;
  readonly disabled?: boolean;
  readonly readOnly?: boolean;
  readonly tokenizedPaymentMethodReady?: boolean;
  readonly navigate?: (launch: VortexSurfaceLaunch) => void;
  readonly onStartPaymentMethodSetup?: (
    checkout: VortexEmbeddedCheckoutState,
  ) => void | Promise<void>;
  readonly onSubmitTokenizedPaymentMethod?: (
    checkout: VortexEmbeddedCheckoutState,
  ) => void | Promise<void>;
  readonly onHostedCheckoutLaunch?: (launch: VortexSurfaceLaunch) => void;
  readonly onReady?: (event: VortexEmbeddedComponentReadyEvent) => void;
  readonly onError?: (event: VortexEmbeddedComponentErrorEvent) => void;
  readonly className?: string;
};

export type VortexPromoCodeDiscountPreview = {
  readonly label: ReactNode;
  readonly amount: number;
  readonly currency: string;
  readonly description?: ReactNode;
};

export type VortexPromoCodeControlState = {
  readonly checkoutId?: string;
  readonly customerId?: string;
  readonly status: "idle" | "validating" | "applied" | "rejected";
  readonly code?: string;
  readonly appliedCouponId?: string;
  readonly discount?: VortexPromoCodeDiscountPreview;
  readonly message?: ReactNode;
};

export type VortexPromoCodeControlCopy = {
  readonly title?: ReactNode;
  readonly readyDescription?: ReactNode;
  readonly appliedDescription?: ReactNode;
  readonly rejectedDescription?: ReactNode;
  readonly loadingTitle?: ReactNode;
  readonly errorTitle?: ReactNode;
  readonly emptyTitle?: ReactNode;
  readonly emptyDescription?: ReactNode;
  readonly codeLabel?: ReactNode;
  readonly codePlaceholder?: string;
  readonly applyLabel?: ReactNode;
  readonly applyingLabel?: ReactNode;
  readonly removeLabel?: ReactNode;
  readonly appliedCodeLabel?: ReactNode;
  readonly discountLabel?: ReactNode;
};

export type VortexPromoCodeControlProps = {
  readonly promoCode: VortexPromoCodeControlState;
  readonly appearance?: VortexEmbeddedComponentAppearance;
  readonly classNames?: VortexEmbeddedComponentClassNames;
  readonly copy?: VortexPromoCodeControlCopy;
  readonly loading?: boolean;
  readonly error?: ReactNode;
  readonly disabled?: boolean;
  readonly readOnly?: boolean;
  readonly initialCode?: string;
  readonly onApplyPromoCode?: (
    code: string,
    state: VortexPromoCodeControlState,
  ) => void | Promise<void>;
  readonly onRemovePromoCode?: (state: VortexPromoCodeControlState) => void | Promise<void>;
  readonly onReady?: (event: VortexEmbeddedComponentReadyEvent) => void;
  readonly onError?: (event: VortexEmbeddedComponentErrorEvent) => void;
  readonly className?: string;
};

export type VortexBalanceWalletEntryType = "grant" | "consume" | "expire" | "reverse";

export type VortexBalanceWalletLineType = "fixed" | "usage" | "credit" | "adjustment" | "tax";

export type VortexBalanceWalletTargets = {
  readonly lineTypes?: readonly VortexBalanceWalletLineType[];
  readonly priceIds?: readonly string[];
  readonly meterIds?: readonly string[];
};

export type VortexBalanceWalletFundingSettlement = {
  readonly paymentId: string;
  readonly settled: boolean;
  readonly settlementEntryCount: number;
  readonly settlementCount: number;
  readonly latestSettledAt?: string;
  readonly nextAction: "none" | "sync_funding_settlement";
};

export type VortexBalanceWalletEntry = {
  readonly entryId: string;
  readonly entryType: VortexBalanceWalletEntryType;
  readonly amount: number;
  readonly currency: string;
  readonly remainingAmount?: number;
  readonly description?: ReactNode;
  readonly effectiveAt: string;
  readonly expiresAt?: string;
  readonly sourceEntryId?: string;
  readonly sourceEntryType?: VortexBalanceWalletEntryType;
  readonly grantEntryId?: string;
  readonly invoiceNumber?: string;
  readonly paymentId?: string;
  readonly targets?: VortexBalanceWalletTargets;
  readonly fundingSettlement?: VortexBalanceWalletFundingSettlement;
};

export type VortexBalanceWalletState = {
  readonly customerId: string;
  readonly billingAccountId?: string;
  readonly status: "ready" | "empty" | "blocked";
  readonly currency: string;
  readonly availableAmount: number;
  readonly pendingAmount?: number;
  readonly entries: readonly VortexBalanceWalletEntry[];
  readonly nextAction?: ReactNode;
  readonly message?: ReactNode;
};

export type VortexBalanceWalletPanelCopy = {
  readonly title?: ReactNode;
  readonly readyDescription?: ReactNode;
  readonly emptyDescription?: ReactNode;
  readonly blockedDescription?: ReactNode;
  readonly loadingTitle?: ReactNode;
  readonly errorTitle?: ReactNode;
  readonly availableBalanceLabel?: ReactNode;
  readonly pendingBalanceLabel?: ReactNode;
  readonly entryCountLabel?: ReactNode;
  readonly nextActionLabel?: ReactNode;
  readonly emptyTitle?: ReactNode;
  readonly emptyStateDescription?: ReactNode;
  readonly addFundsLabel?: ReactNode;
  readonly viewEntryLabel?: ReactNode;
  readonly settlementLabel?: ReactNode;
  readonly targetLabel?: ReactNode;
};

export type VortexBalanceWalletPanelProps = {
  readonly balance: VortexBalanceWalletState;
  readonly appearance?: VortexEmbeddedComponentAppearance;
  readonly classNames?: VortexEmbeddedComponentClassNames;
  readonly copy?: VortexBalanceWalletPanelCopy;
  readonly loading?: boolean;
  readonly error?: ReactNode;
  readonly disabled?: boolean;
  readonly readOnly?: boolean;
  readonly onAddFunds?: (balance: VortexBalanceWalletState) => void | Promise<void>;
  readonly onEntrySelect?: (
    entry: VortexBalanceWalletEntry,
    balance: VortexBalanceWalletState,
  ) => void | Promise<void>;
  readonly onReady?: (event: VortexEmbeddedComponentReadyEvent) => void;
  readonly onError?: (event: VortexEmbeddedComponentErrorEvent) => void;
  readonly className?: string;
};

export type VortexRecoverySummaryReason =
  | "payment_failed"
  | "payment_method_required"
  | "dunning_active"
  | "invoice_past_due"
  | "wallet_funding_failed";

export type VortexRecoverySummaryAttempt = {
  readonly id: string;
  readonly status: "failed" | "pending" | "retrying" | "recovered";
  readonly amount?: number;
  readonly currency?: string;
  readonly occurredAt: string;
  readonly message?: ReactNode;
};

export type VortexRecoverySummaryState = {
  readonly customerId: string;
  readonly billingAccountId?: string;
  readonly status:
    | "healthy"
    | "needs_payment_method"
    | "retry_scheduled"
    | "past_due"
    | "blocked"
    | "recovered";
  readonly reason?: VortexRecoverySummaryReason;
  readonly amountDue?: number;
  readonly currency?: string;
  readonly nextRetryAt?: string;
  readonly hostedRecoveryToken?: string;
  readonly paymentRequestId?: string;
  readonly invoiceId?: string;
  readonly invoiceNumber?: string;
  readonly dunningCampaignId?: string;
  readonly message?: ReactNode;
  readonly attempts?: readonly VortexRecoverySummaryAttempt[];
};

export type VortexRecoverySummaryCopy = {
  readonly title?: ReactNode;
  readonly healthyDescription?: ReactNode;
  readonly actionRequiredDescription?: ReactNode;
  readonly recoveredDescription?: ReactNode;
  readonly loadingTitle?: ReactNode;
  readonly errorTitle?: ReactNode;
  readonly statusLabel?: ReactNode;
  readonly reasonLabel?: ReactNode;
  readonly amountDueLabel?: ReactNode;
  readonly nextRetryLabel?: ReactNode;
  readonly invoiceLabel?: ReactNode;
  readonly attemptsLabel?: ReactNode;
  readonly emptyAttemptsTitle?: ReactNode;
  readonly openHostedRecoveryLabel?: ReactNode;
  readonly retryPaymentLabel?: ReactNode;
};

export type VortexRecoverySummaryProps = {
  readonly recovery: VortexRecoverySummaryState;
  readonly appearance?: VortexEmbeddedComponentAppearance;
  readonly classNames?: VortexEmbeddedComponentClassNames;
  readonly copy?: VortexRecoverySummaryCopy;
  readonly loading?: boolean;
  readonly error?: ReactNode;
  readonly disabled?: boolean;
  readonly readOnly?: boolean;
  readonly navigate?: (launch: VortexSurfaceLaunch) => void;
  readonly onHostedRecoveryLaunch?: (launch: VortexSurfaceLaunch) => void;
  readonly onRetryPayment?: (recovery: VortexRecoverySummaryState) => void | Promise<void>;
  readonly onAttemptSelect?: (
    attempt: VortexRecoverySummaryAttempt,
    recovery: VortexRecoverySummaryState,
  ) => void | Promise<void>;
  readonly onReady?: (event: VortexEmbeddedComponentReadyEvent) => void;
  readonly onError?: (event: VortexEmbeddedComponentErrorEvent) => void;
  readonly className?: string;
};

export type VortexEntitlementSummaryStatus =
  | "active"
  | "trialing"
  | "limited"
  | "past_due"
  | "blocked"
  | "expired"
  | "none";

export type VortexEntitlementFeatureStatus = "enabled" | "limited" | "disabled";

export type VortexEntitlementSummaryFeature = {
  readonly id: string;
  readonly key: string;
  readonly label: ReactNode;
  readonly status: VortexEntitlementFeatureStatus;
  readonly description?: ReactNode;
  readonly limitLabel?: ReactNode;
  readonly usageLabel?: ReactNode;
  readonly renewsAt?: string;
};

export type VortexEntitlementSummaryState = {
  readonly customerId: string;
  readonly billingAccountId?: string;
  readonly subscriptionId?: string;
  readonly planLabel?: ReactNode;
  readonly status: VortexEntitlementSummaryStatus;
  readonly activeUntil?: string;
  readonly trialEndsAt?: string;
  readonly renewsAt?: string;
  readonly portalToken?: string;
  readonly message?: ReactNode;
  readonly features: readonly VortexEntitlementSummaryFeature[];
};

export type VortexEntitlementSummaryCopy = {
  readonly title?: ReactNode;
  readonly activeDescription?: ReactNode;
  readonly limitedDescription?: ReactNode;
  readonly blockedDescription?: ReactNode;
  readonly emptyDescription?: ReactNode;
  readonly loadingTitle?: ReactNode;
  readonly errorTitle?: ReactNode;
  readonly statusLabel?: ReactNode;
  readonly planLabel?: ReactNode;
  readonly featureCountLabel?: ReactNode;
  readonly renewalLabel?: ReactNode;
  readonly trialLabel?: ReactNode;
  readonly emptyFeaturesTitle?: ReactNode;
  readonly openPortalLabel?: ReactNode;
  readonly viewFeatureLabel?: ReactNode;
};

export type VortexEntitlementSummaryProps = {
  readonly access: VortexEntitlementSummaryState;
  readonly appearance?: VortexEmbeddedComponentAppearance;
  readonly classNames?: VortexEmbeddedComponentClassNames;
  readonly copy?: VortexEntitlementSummaryCopy;
  readonly loading?: boolean;
  readonly error?: ReactNode;
  readonly disabled?: boolean;
  readonly readOnly?: boolean;
  readonly navigate?: (launch: VortexSurfaceLaunch) => void;
  readonly onPortalLaunch?: (launch: VortexSurfaceLaunch) => void;
  readonly onFeatureSelect?: (
    feature: VortexEntitlementSummaryFeature,
    access: VortexEntitlementSummaryState,
  ) => void | Promise<void>;
  readonly onReady?: (event: VortexEmbeddedComponentReadyEvent) => void;
  readonly onError?: (event: VortexEmbeddedComponentErrorEvent) => void;
  readonly className?: string;
};

export type VortexPaymentTimelineStatus = "current" | "attention_required" | "empty";

export type VortexPaymentTimelineEntryType =
  | "invoice"
  | "payment"
  | "refund"
  | "credit_note"
  | "receipt";

export type VortexPaymentTimelineEntryStatus =
  | "pending"
  | "requires_action"
  | "succeeded"
  | "failed"
  | "refunded"
  | "credited"
  | "voided";

export type VortexPaymentTimelineEntry = {
  readonly id: string;
  readonly type: VortexPaymentTimelineEntryType;
  readonly status: VortexPaymentTimelineEntryStatus;
  readonly title: ReactNode;
  readonly description?: ReactNode;
  readonly amount?: number;
  readonly currency?: string;
  readonly occurredAt: string;
  readonly invoiceId?: string;
  readonly invoiceNumber?: string;
  readonly paymentRequestId?: string;
  readonly receiptId?: string;
};

export type VortexPaymentTimelineState = {
  readonly customerId: string;
  readonly billingAccountId?: string;
  readonly status: VortexPaymentTimelineStatus;
  readonly amountDue?: number;
  readonly currency?: string;
  readonly nextAction?: ReactNode;
  readonly portalToken?: string;
  readonly message?: ReactNode;
  readonly entries: readonly VortexPaymentTimelineEntry[];
};

export type VortexPaymentTimelineSummaryCopy = {
  readonly title?: ReactNode;
  readonly currentDescription?: ReactNode;
  readonly attentionRequiredDescription?: ReactNode;
  readonly emptyDescription?: ReactNode;
  readonly loadingTitle?: ReactNode;
  readonly errorTitle?: ReactNode;
  readonly statusLabel?: ReactNode;
  readonly amountDueLabel?: ReactNode;
  readonly entryCountLabel?: ReactNode;
  readonly nextActionLabel?: ReactNode;
  readonly emptyEntriesTitle?: ReactNode;
  readonly emptyEntriesDescription?: ReactNode;
  readonly openPortalLabel?: ReactNode;
  readonly viewEntryLabel?: ReactNode;
};

export type VortexPaymentTimelineSummaryProps = {
  readonly timeline: VortexPaymentTimelineState;
  readonly appearance?: VortexEmbeddedComponentAppearance;
  readonly classNames?: VortexEmbeddedComponentClassNames;
  readonly copy?: VortexPaymentTimelineSummaryCopy;
  readonly loading?: boolean;
  readonly error?: ReactNode;
  readonly disabled?: boolean;
  readonly readOnly?: boolean;
  readonly navigate?: (launch: VortexSurfaceLaunch) => void;
  readonly onPortalLaunch?: (launch: VortexSurfaceLaunch) => void;
  readonly onEntrySelect?: (
    entry: VortexPaymentTimelineEntry,
    timeline: VortexPaymentTimelineState,
  ) => void | Promise<void>;
  readonly onReady?: (event: VortexEmbeddedComponentReadyEvent) => void;
  readonly onError?: (event: VortexEmbeddedComponentErrorEvent) => void;
  readonly className?: string;
};

export type VortexInvoiceListStatus = "current" | "attention_required" | "empty";

export type VortexInvoiceListInvoiceStatus =
  | "draft"
  | "open"
  | "paid"
  | "past_due"
  | "payment_action_required"
  | "voided"
  | "refunded"
  | "credited";

export type VortexInvoiceListRowAction =
  | "open_invoice"
  | "open_receipt"
  | "open_payment"
  | "custom";

export type VortexInvoiceListRow = {
  readonly id: string;
  readonly invoiceNumber?: string;
  readonly status: VortexInvoiceListInvoiceStatus;
  readonly title: ReactNode;
  readonly description?: ReactNode;
  readonly amount: number;
  readonly currency: string;
  readonly issuedAt?: string;
  readonly dueAt?: string;
  readonly paidAt?: string;
  readonly receiptId?: string;
  readonly paymentRequestId?: string;
  readonly action: VortexInvoiceListRowAction;
  readonly actionDisabledReason?: ReactNode;
};

export type VortexInvoiceListState = {
  readonly customerId: string;
  readonly billingAccountId?: string;
  readonly status: VortexInvoiceListStatus;
  readonly amountDue?: number;
  readonly currency?: string;
  readonly overdueCount?: number;
  readonly actionRequiredCount?: number;
  readonly nextAction?: ReactNode;
  readonly portalToken?: string;
  readonly rowLimit?: number;
  readonly hasMore?: boolean;
  readonly nextPageToken?: string;
  readonly message?: ReactNode;
  readonly invoices: readonly VortexInvoiceListRow[];
};

export type VortexInvoiceListCopy = {
  readonly title?: ReactNode;
  readonly currentDescription?: ReactNode;
  readonly attentionRequiredDescription?: ReactNode;
  readonly emptyDescription?: ReactNode;
  readonly loadingTitle?: ReactNode;
  readonly errorTitle?: ReactNode;
  readonly statusLabel?: ReactNode;
  readonly amountDueLabel?: ReactNode;
  readonly invoiceCountLabel?: ReactNode;
  readonly overdueCountLabel?: ReactNode;
  readonly actionRequiredCountLabel?: ReactNode;
  readonly rowLimitLabel?: ReactNode;
  readonly nextActionLabel?: ReactNode;
  readonly emptyInvoicesTitle?: ReactNode;
  readonly emptyInvoicesDescription?: ReactNode;
  readonly openPortalLabel?: ReactNode;
  readonly viewInvoiceLabel?: ReactNode;
  readonly viewReceiptLabel?: ReactNode;
  readonly payInvoiceLabel?: ReactNode;
  readonly customActionLabel?: ReactNode;
  readonly loadMoreLabel?: ReactNode;
};

export type VortexInvoiceListProps = {
  readonly invoiceList: VortexInvoiceListState;
  readonly appearance?: VortexEmbeddedComponentAppearance;
  readonly classNames?: VortexEmbeddedComponentClassNames;
  readonly copy?: VortexInvoiceListCopy;
  readonly loading?: boolean;
  readonly error?: ReactNode;
  readonly disabled?: boolean;
  readonly readOnly?: boolean;
  readonly navigate?: (launch: VortexSurfaceLaunch) => void;
  readonly onPortalLaunch?: (launch: VortexSurfaceLaunch) => void;
  readonly onInvoiceSelect?: (
    invoice: VortexInvoiceListRow,
    invoiceList: VortexInvoiceListState,
  ) => void | Promise<void>;
  readonly onLoadMore?: (invoiceList: VortexInvoiceListState) => void | Promise<void>;
  readonly onReady?: (event: VortexEmbeddedComponentReadyEvent) => void;
  readonly onError?: (event: VortexEmbeddedComponentErrorEvent) => void;
  readonly className?: string;
};

export type VortexPlanComparisonStatus = "ready" | "empty" | "blocked";

export type VortexPlanComparisonPlanStatus = "available" | "current" | "recommended" | "disabled";

export type VortexPlanComparisonCadence =
  | "one_time"
  | "monthly"
  | "quarterly"
  | "yearly"
  | "custom";

export type VortexPlanComparisonPlan = {
  readonly id: string;
  readonly lookupKey?: string;
  readonly status: VortexPlanComparisonPlanStatus;
  readonly title: ReactNode;
  readonly description?: ReactNode;
  readonly priceAmount: number;
  readonly currency: string;
  readonly cadence: VortexPlanComparisonCadence;
  readonly cadenceLabel?: ReactNode;
  readonly featureHighlights: readonly ReactNode[];
  readonly checkoutToken?: string;
  readonly disabledReason?: ReactNode;
};

export type VortexPlanComparisonState = {
  readonly customerId?: string;
  readonly billingAccountId?: string;
  readonly status: VortexPlanComparisonStatus;
  readonly currentPlanId?: string;
  readonly recommendedPlanId?: string;
  readonly selectedPlanId?: string;
  readonly checkoutReturnPath?: string;
  readonly message?: ReactNode;
  readonly plans: readonly VortexPlanComparisonPlan[];
};

export type VortexPlanComparisonCopy = {
  readonly title?: ReactNode;
  readonly readyDescription?: ReactNode;
  readonly emptyDescription?: ReactNode;
  readonly blockedDescription?: ReactNode;
  readonly loadingTitle?: ReactNode;
  readonly errorTitle?: ReactNode;
  readonly statusLabel?: ReactNode;
  readonly planCountLabel?: ReactNode;
  readonly selectedPlanLabel?: ReactNode;
  readonly currentPlanLabel?: ReactNode;
  readonly recommendedPlanLabel?: ReactNode;
  readonly priceLabel?: ReactNode;
  readonly cadenceLabel?: ReactNode;
  readonly featureCountLabel?: ReactNode;
  readonly emptyPlansTitle?: ReactNode;
  readonly emptyPlansDescription?: ReactNode;
  readonly openCheckoutLabel?: ReactNode;
  readonly currentButtonLabel?: ReactNode;
  readonly disabledButtonLabel?: ReactNode;
  readonly selectPlanLabel?: ReactNode;
};

export type VortexPlanComparisonProps = {
  readonly comparison: VortexPlanComparisonState;
  readonly appearance?: VortexEmbeddedComponentAppearance;
  readonly classNames?: VortexEmbeddedComponentClassNames;
  readonly copy?: VortexPlanComparisonCopy;
  readonly loading?: boolean;
  readonly error?: ReactNode;
  readonly disabled?: boolean;
  readonly readOnly?: boolean;
  readonly navigate?: (launch: VortexSurfaceLaunch) => void;
  readonly onCheckoutLaunch?: (plan: VortexPlanComparisonPlan, launch: VortexSurfaceLaunch) => void;
  readonly onPlanSelect?: (
    plan: VortexPlanComparisonPlan,
    comparison: VortexPlanComparisonState,
  ) => void | Promise<void>;
  readonly onReady?: (event: VortexEmbeddedComponentReadyEvent) => void;
  readonly onError?: (event: VortexEmbeddedComponentErrorEvent) => void;
  readonly className?: string;
};

export type VortexUsageMeterSummaryStatus = "current" | "attention_required" | "empty" | "blocked";

export type VortexUsageMeterSummaryMeterStatus =
  | "within_limit"
  | "near_limit"
  | "over_limit"
  | "unlimited"
  | "blocked";

export type VortexUsageMeterSummaryMeter = {
  readonly id: string;
  readonly usageKey?: string;
  readonly status: VortexUsageMeterSummaryMeterStatus;
  readonly title: ReactNode;
  readonly description?: ReactNode;
  readonly unitLabel?: ReactNode;
  readonly usedAmount: number;
  readonly includedAmount?: number;
  readonly billableAmount?: number;
  readonly usagePercent?: number;
  readonly periodStart?: string;
  readonly periodEnd?: string;
  readonly resetAt?: string;
  readonly limitLabel?: ReactNode;
  readonly nextAction?: ReactNode;
};

export type VortexUsageMeterSummaryState = {
  readonly customerId: string;
  readonly billingAccountId?: string;
  readonly subscriptionId?: string;
  readonly planLabel?: ReactNode;
  readonly status: VortexUsageMeterSummaryStatus;
  readonly periodStart?: string;
  readonly periodEnd?: string;
  readonly nextResetAt?: string;
  readonly portalToken?: string;
  readonly portalReturnPath?: string;
  readonly message?: ReactNode;
  readonly meters: readonly VortexUsageMeterSummaryMeter[];
};

export type VortexUsageMeterSummaryCopy = {
  readonly title?: ReactNode;
  readonly currentDescription?: ReactNode;
  readonly attentionRequiredDescription?: ReactNode;
  readonly emptyDescription?: ReactNode;
  readonly blockedDescription?: ReactNode;
  readonly loadingTitle?: ReactNode;
  readonly errorTitle?: ReactNode;
  readonly statusLabel?: ReactNode;
  readonly planLabel?: ReactNode;
  readonly periodLabel?: ReactNode;
  readonly nextResetLabel?: ReactNode;
  readonly meterCountLabel?: ReactNode;
  readonly usedLabel?: ReactNode;
  readonly includedLabel?: ReactNode;
  readonly billableLabel?: ReactNode;
  readonly usagePercentLabel?: ReactNode;
  readonly resetLabel?: ReactNode;
  readonly nextActionLabel?: ReactNode;
  readonly emptyMetersTitle?: ReactNode;
  readonly emptyMetersDescription?: ReactNode;
  readonly openPortalLabel?: ReactNode;
  readonly viewMeterLabel?: ReactNode;
};

export type VortexUsageMeterSummaryProps = {
  readonly usage: VortexUsageMeterSummaryState;
  readonly appearance?: VortexEmbeddedComponentAppearance;
  readonly classNames?: VortexEmbeddedComponentClassNames;
  readonly copy?: VortexUsageMeterSummaryCopy;
  readonly loading?: boolean;
  readonly error?: ReactNode;
  readonly disabled?: boolean;
  readonly readOnly?: boolean;
  readonly navigate?: (launch: VortexSurfaceLaunch) => void;
  readonly onPortalLaunch?: (launch: VortexSurfaceLaunch) => void;
  readonly onMeterSelect?: (
    meter: VortexUsageMeterSummaryMeter,
    usage: VortexUsageMeterSummaryState,
  ) => void | Promise<void>;
  readonly onReady?: (event: VortexEmbeddedComponentReadyEvent) => void;
  readonly onError?: (event: VortexEmbeddedComponentErrorEvent) => void;
  readonly className?: string;
};

export type VortexReceiptDownloadButtonStatus = "ready" | "generating" | "missing" | "blocked";

export type VortexReceiptDownloadButtonArtifactKind = "receipt" | "invoice";

export type VortexReceiptDownloadButtonArtifact = {
  readonly id: string;
  readonly kind: VortexReceiptDownloadButtonArtifactKind;
  readonly status: VortexReceiptDownloadButtonStatus;
  readonly title?: ReactNode;
  readonly description?: ReactNode;
  readonly receiptId?: string;
  readonly invoiceId?: string;
  readonly invoiceNumber?: string;
  readonly amount?: number;
  readonly currency?: string;
  readonly issuedAt?: string;
  readonly paidAt?: string;
  readonly generatedAt?: string;
  readonly disabledReason?: ReactNode;
  readonly portalToken?: string;
  readonly portalReturnPath?: string;
};

export type VortexReceiptDownloadButtonCopy = {
  readonly readyLabel?: ReactNode;
  readonly generatingLabel?: ReactNode;
  readonly missingLabel?: ReactNode;
  readonly blockedLabel?: ReactNode;
  readonly loadingLabel?: ReactNode;
  readonly errorTitle?: ReactNode;
  readonly statusLabel?: ReactNode;
  readonly artifactLabel?: ReactNode;
  readonly invoiceLabel?: ReactNode;
  readonly amountLabel?: ReactNode;
  readonly issuedLabel?: ReactNode;
  readonly paidLabel?: ReactNode;
  readonly generatedLabel?: ReactNode;
  readonly openCenterLabel?: ReactNode;
};

export type VortexReceiptDownloadButtonProps = {
  readonly artifact: VortexReceiptDownloadButtonArtifact;
  readonly appearance?: VortexEmbeddedComponentAppearance;
  readonly classNames?: VortexEmbeddedComponentClassNames;
  readonly copy?: VortexReceiptDownloadButtonCopy;
  readonly loading?: boolean;
  readonly error?: ReactNode;
  readonly disabled?: boolean;
  readonly readOnly?: boolean;
  readonly navigate?: (launch: VortexSurfaceLaunch) => void;
  readonly onDownloadLaunch?: (
    artifact: VortexReceiptDownloadButtonArtifact,
    launch: VortexSurfaceLaunch,
  ) => void;
  readonly onDownload?: (artifact: VortexReceiptDownloadButtonArtifact) => void | Promise<void>;
  readonly onReady?: (event: VortexEmbeddedComponentReadyEvent) => void;
  readonly onError?: (event: VortexEmbeddedComponentErrorEvent) => void;
  readonly className?: string;
};

type ReceiptDownloadButtonViewState = {
  readonly canDownload: boolean;
  readonly canOpenHostedArtifact: boolean;
  readonly isDisabled: boolean;
  readonly resolvedCopy: Required<VortexReceiptDownloadButtonCopy>;
};

const DEFAULT_RECEIPT_DOWNLOAD_BUTTON_COPY: Required<VortexReceiptDownloadButtonCopy> = {
  readyLabel: "Download receipt",
  generatingLabel: "Receipt generating",
  missingLabel: "Receipt unavailable",
  blockedLabel: "Download blocked",
  loadingLabel: "Loading receipt...",
  errorTitle: "Unable to load receipt.",
  statusLabel: "Status",
  artifactLabel: "Artifact",
  invoiceLabel: "Invoice",
  amountLabel: "Amount",
  issuedLabel: "Issued",
  paidLabel: "Paid",
  generatedLabel: "Generated",
  openCenterLabel: "Open receipt",
};

export type VortexBillingStatusBannerStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "payment_action_required"
  | "blocked"
  | "canceled"
  | "none";

export type VortexBillingStatusBannerSeverity = "success" | "info" | "warning" | "critical";

export type VortexBillingStatusBannerAction = "open_portal" | "open_recovery" | "custom";

export type VortexBillingStatusBannerState = {
  readonly customerId: string;
  readonly billingAccountId?: string;
  readonly subscriptionId?: string;
  readonly status: VortexBillingStatusBannerStatus;
  readonly severity: VortexBillingStatusBannerSeverity;
  readonly title: ReactNode;
  readonly description?: ReactNode;
  readonly planLabel?: ReactNode;
  readonly amountDue?: number;
  readonly currency?: string;
  readonly nextAction?: ReactNode;
  readonly portalToken?: string;
  readonly recoveryToken?: string;
  readonly action: VortexBillingStatusBannerAction;
};

export type VortexBillingStatusBannerCopy = {
  readonly loadingTitle?: ReactNode;
  readonly errorTitle?: ReactNode;
  readonly statusLabel?: ReactNode;
  readonly planLabel?: ReactNode;
  readonly amountDueLabel?: ReactNode;
  readonly nextActionLabel?: ReactNode;
  readonly openPortalLabel?: ReactNode;
  readonly openRecoveryLabel?: ReactNode;
  readonly customActionLabel?: ReactNode;
};

export type VortexBillingStatusBannerProps = {
  readonly billingStatus: VortexBillingStatusBannerState;
  readonly appearance?: VortexEmbeddedComponentAppearance;
  readonly classNames?: VortexEmbeddedComponentClassNames;
  readonly copy?: VortexBillingStatusBannerCopy;
  readonly loading?: boolean;
  readonly error?: ReactNode;
  readonly disabled?: boolean;
  readonly readOnly?: boolean;
  readonly navigate?: (launch: VortexSurfaceLaunch) => void;
  readonly onPortalLaunch?: (launch: VortexSurfaceLaunch) => void;
  readonly onRecoveryLaunch?: (launch: VortexSurfaceLaunch) => void;
  readonly onAction?: (billingStatus: VortexBillingStatusBannerState) => void | Promise<void>;
  readonly onReady?: (event: VortexEmbeddedComponentReadyEvent) => void;
  readonly onError?: (event: VortexEmbeddedComponentErrorEvent) => void;
  readonly className?: string;
};

export type VortexSubscriptionActionSummaryStatus =
  | "active"
  | "trialing"
  | "scheduled_cancellation"
  | "paused"
  | "past_due"
  | "payment_action_required"
  | "canceled"
  | "none";

export type VortexSubscriptionActionSummaryAction =
  | "open_portal"
  | "change_plan"
  | "pause"
  | "resume"
  | "cancel"
  | "custom";

export type VortexSubscriptionActionSummaryState = {
  readonly customerId: string;
  readonly billingAccountId?: string;
  readonly subscriptionId?: string;
  readonly status: VortexSubscriptionActionSummaryStatus;
  readonly title: ReactNode;
  readonly description?: ReactNode;
  readonly planLabel?: ReactNode;
  readonly cadenceLabel?: ReactNode;
  readonly renewalAt?: string;
  readonly trialEndsAt?: string;
  readonly scheduledCancelAt?: string;
  readonly pausedUntil?: string;
  readonly amountDue?: number;
  readonly currency?: string;
  readonly nextAction?: ReactNode;
  readonly portalToken?: string;
  readonly action: VortexSubscriptionActionSummaryAction;
  readonly actionDisabledReason?: ReactNode;
};

export type VortexSubscriptionActionSummaryCopy = {
  readonly title?: ReactNode;
  readonly activeDescription?: ReactNode;
  readonly trialingDescription?: ReactNode;
  readonly scheduledCancellationDescription?: ReactNode;
  readonly pausedDescription?: ReactNode;
  readonly pastDueDescription?: ReactNode;
  readonly canceledDescription?: ReactNode;
  readonly emptyDescription?: ReactNode;
  readonly loadingTitle?: ReactNode;
  readonly errorTitle?: ReactNode;
  readonly statusLabel?: ReactNode;
  readonly planLabel?: ReactNode;
  readonly cadenceLabel?: ReactNode;
  readonly renewalLabel?: ReactNode;
  readonly trialLabel?: ReactNode;
  readonly scheduledCancelLabel?: ReactNode;
  readonly pausedUntilLabel?: ReactNode;
  readonly amountDueLabel?: ReactNode;
  readonly nextActionLabel?: ReactNode;
  readonly openPortalLabel?: ReactNode;
  readonly changePlanLabel?: ReactNode;
  readonly pauseLabel?: ReactNode;
  readonly resumeLabel?: ReactNode;
  readonly cancelLabel?: ReactNode;
  readonly customActionLabel?: ReactNode;
};

export type VortexSubscriptionActionSummaryProps = {
  readonly subscription: VortexSubscriptionActionSummaryState;
  readonly appearance?: VortexEmbeddedComponentAppearance;
  readonly classNames?: VortexEmbeddedComponentClassNames;
  readonly copy?: VortexSubscriptionActionSummaryCopy;
  readonly loading?: boolean;
  readonly error?: ReactNode;
  readonly disabled?: boolean;
  readonly readOnly?: boolean;
  readonly navigate?: (launch: VortexSurfaceLaunch) => void;
  readonly onPortalLaunch?: (launch: VortexSurfaceLaunch) => void;
  readonly onAction?: (subscription: VortexSubscriptionActionSummaryState) => void | Promise<void>;
  readonly onReady?: (event: VortexEmbeddedComponentReadyEvent) => void;
  readonly onError?: (event: VortexEmbeddedComponentErrorEvent) => void;
  readonly className?: string;
};

export type VortexPaymentMethodSummaryStatus =
  | "ready"
  | "missing"
  | "expired"
  | "disabled"
  | "action_required"
  | "blocked";

export type VortexPaymentMethodSummaryKind = "card" | "bank_account" | "unknown";

export type VortexPaymentMethodSummaryAction =
  | "open_payment_methods"
  | "add_payment_method"
  | "update_payment_method"
  | "custom";

export type VortexPaymentMethodSummaryState = {
  readonly customerId: string;
  readonly billingAccountId?: string;
  readonly paymentMethodId?: string;
  readonly status: VortexPaymentMethodSummaryStatus;
  readonly kind: VortexPaymentMethodSummaryKind;
  readonly title: ReactNode;
  readonly description?: ReactNode;
  readonly brandLabel?: ReactNode;
  readonly last4?: string;
  readonly expiryLabel?: ReactNode;
  readonly bankLabel?: ReactNode;
  readonly accountTypeLabel?: ReactNode;
  readonly readinessLabel?: ReactNode;
  readonly nextAction?: ReactNode;
  readonly portalToken?: string;
  readonly action: VortexPaymentMethodSummaryAction;
  readonly actionDisabledReason?: ReactNode;
};

export type VortexPaymentMethodSummaryCopy = {
  readonly title?: ReactNode;
  readonly readyDescription?: ReactNode;
  readonly missingDescription?: ReactNode;
  readonly expiredDescription?: ReactNode;
  readonly disabledDescription?: ReactNode;
  readonly actionRequiredDescription?: ReactNode;
  readonly blockedDescription?: ReactNode;
  readonly loadingTitle?: ReactNode;
  readonly errorTitle?: ReactNode;
  readonly statusLabel?: ReactNode;
  readonly kindLabel?: ReactNode;
  readonly methodLabel?: ReactNode;
  readonly expiryLabel?: ReactNode;
  readonly bankLabel?: ReactNode;
  readonly accountTypeLabel?: ReactNode;
  readonly readinessLabel?: ReactNode;
  readonly nextActionLabel?: ReactNode;
  readonly openPaymentMethodsLabel?: ReactNode;
  readonly addPaymentMethodLabel?: ReactNode;
  readonly updatePaymentMethodLabel?: ReactNode;
  readonly customActionLabel?: ReactNode;
};

export type VortexPaymentMethodSummaryProps = {
  readonly paymentMethod: VortexPaymentMethodSummaryState;
  readonly appearance?: VortexEmbeddedComponentAppearance;
  readonly classNames?: VortexEmbeddedComponentClassNames;
  readonly copy?: VortexPaymentMethodSummaryCopy;
  readonly loading?: boolean;
  readonly error?: ReactNode;
  readonly disabled?: boolean;
  readonly readOnly?: boolean;
  readonly navigate?: (launch: VortexSurfaceLaunch) => void;
  readonly onPaymentMethodsLaunch?: (launch: VortexSurfaceLaunch) => void;
  readonly onAction?: (paymentMethod: VortexPaymentMethodSummaryState) => void | Promise<void>;
  readonly onReady?: (event: VortexEmbeddedComponentReadyEvent) => void;
  readonly onError?: (event: VortexEmbeddedComponentErrorEvent) => void;
  readonly className?: string;
};

export type VortexMerchantActionQueueProps = {
  readonly merchantState: MerchantAccountStateSnapshot;
  readonly actions?: readonly VortexMerchantActionQueueItem[];
  readonly appearance?: VortexEmbeddedComponentAppearance;
  readonly classNames?: VortexEmbeddedComponentClassNames;
  readonly copy?: VortexMerchantActionQueueCopy;
  readonly loading?: boolean;
  readonly error?: ReactNode;
  readonly disabled?: boolean;
  readonly readOnly?: boolean;
  readonly navigate?: (launch: VortexSurfaceLaunch) => void;
  readonly onActionLaunch?: (
    action: VortexMerchantActionQueueItem,
    launch: VortexSurfaceLaunch,
  ) => void;
  readonly onAction?: (action: VortexMerchantActionQueueItem) => void;
  readonly onReady?: (event: VortexEmbeddedComponentReadyEvent) => void;
  readonly onError?: (event: VortexEmbeddedComponentErrorEvent) => void;
  readonly className?: string;
};

type VortexPaymentsContextValue = {
  readonly runtime: VortexSurfaceProviderRuntime;
  readonly navigate: (launch: VortexSurfaceLaunch) => void;
};

const VortexPaymentsContext = createContext<VortexPaymentsContextValue | null>(null);

export function VortexPaymentsProvider({
  config,
  children,
  navigate,
}: VortexPaymentsProviderProps): ReactNode {
  const runtime = useMemo(() => createVortexSurfaceProvider(config), [config]);
  const contextValue = useMemo<VortexPaymentsContextValue>(
    () => ({
      runtime,
      navigate: navigate ?? defaultNavigate,
    }),
    [navigate, runtime],
  );

  return createElement(VortexPaymentsContext.Provider, { value: contextValue }, children);
}

export function useVortexPayments(): VortexPaymentsContextValue {
  const value = useContext(VortexPaymentsContext);
  if (value === null) {
    throw new Error("useVortexPayments must be used inside VortexPaymentsProvider.");
  }
  return value;
}

export function VortexHostedSurfaceButton({
  request,
  children,
  loadingLabel,
  navigate,
  navigationTarget,
  onLaunch,
  onError,
  disabled,
  ...buttonProps
}: VortexHostedSurfaceButtonProps): ReactNode {
  const { runtime, navigate: contextNavigate } = useVortexPayments();
  const [isLaunching, setIsLaunching] = useState(false);
  const handleClick = useCallback(() => {
    try {
      setIsLaunching(true);
      const launch = runtime.createHostedLink(request);
      onLaunch?.(launch);
      const selectedNavigate =
        navigate ?? (navigationTarget === "_blank" ? openInNewTab : contextNavigate);
      selectedNavigate(launch);
    } catch (error) {
      setIsLaunching(false);
      onError?.(error);
    }
  }, [contextNavigate, navigate, navigationTarget, onError, onLaunch, request, runtime]);

  return createElement(
    "button",
    {
      ...buttonProps,
      type: "button",
      disabled: disabled === true || isLaunching,
      onClick: handleClick,
    },
    isLaunching ? (loadingLabel ?? children ?? "Opening...") : (children ?? "Open"),
  );
}

export function VortexCheckoutButton({
  lookupKey,
  createCheckoutSession,
  children,
  loadingLabel,
  navigate,
  navigationTarget,
  onCheckoutCreated,
  onError,
  disabled,
  ...buttonProps
}: VortexCheckoutButtonProps): ReactNode {
  const { navigate: contextNavigate } = useVortexPayments();
  const [isLaunching, setIsLaunching] = useState(false);
  const handleClick = useCallback(async () => {
    setIsLaunching(true);
    try {
      const session = await createCheckoutSession({ lookupKey });
      const launch: VortexSurfaceLaunch = {
        surface: "checkout",
        url: session.checkoutUrl,
        mode: "hosted_redirect",
      };
      onCheckoutCreated?.(launch);
      const selectedNavigate =
        navigate ?? (navigationTarget === "_blank" ? openInNewTab : contextNavigate);
      selectedNavigate(launch);
    } catch (error) {
      setIsLaunching(false);
      onError?.(error);
    }
  }, [
    contextNavigate,
    createCheckoutSession,
    lookupKey,
    navigate,
    navigationTarget,
    onCheckoutCreated,
    onError,
  ]);

  return createElement(
    "button",
    {
      ...buttonProps,
      type: "button",
      disabled: disabled === true || isLaunching,
      onClick: () => {
        void handleClick();
      },
    },
    isLaunching ? (loadingLabel ?? children ?? "Opening checkout...") : (children ?? "Checkout"),
  );
}

export function VortexCustomerPortalButton({
  token,
  children,
  ...props
}: VortexCustomerPortalButtonProps): ReactNode {
  return createElement(
    VortexHostedSurfaceButton,
    {
      ...props,
      request: { surface: "customer_portal", token },
    },
    children ?? "Manage billing",
  );
}

export function VortexPaymentMethodsButton({
  token,
  children,
  ...props
}: VortexPaymentMethodsButtonProps): ReactNode {
  return createElement(
    VortexHostedSurfaceButton,
    {
      ...props,
      request: { surface: "payment_methods", token },
    },
    children ?? "Manage payment methods",
  );
}

export function VortexEmbeddedCheckout({
  checkout,
  appearance,
  classNames,
  copy,
  loading,
  error,
  disabled,
  readOnly,
  tokenizedPaymentMethodReady,
  navigate,
  onStartPaymentMethodSetup,
  onSubmitTokenizedPaymentMethod,
  onHostedCheckoutLaunch,
  onReady,
  onError,
  className,
}: VortexEmbeddedCheckoutProps): ReactNode {
  const { runtime, navigate: contextNavigate } = useVortexPayments();
  const selectedNavigate = navigate ?? contextNavigate;
  const resolvedCopy = resolveEmbeddedCheckoutCopy(copy);
  const isDisabled = disabled === true || readOnly === true || loading === true;
  const canCollect = checkout.status === "open" && checkout.amountRemaining > 0;
  const hasFailedAttempt = checkout.lastAttemptStatus === "failed";
  const hostedCheckoutUrl =
    checkout.hostedCheckoutUrl === undefined || checkout.hostedCheckoutUrl.trim().length === 0
      ? undefined
      : checkout.hostedCheckoutUrl;
  const hostedRecoveryRequest: VortexHostedSurfaceRequest | null =
    checkout.hostedRecoveryToken === undefined
      ? null
      : {
          surface: "payment_recovery",
          token: checkout.hostedRecoveryToken,
          query: { view: "payment_recovery" },
        };

  useEffect(() => {
    onReady?.({
      component: "VortexEmbeddedCheckout",
      surface: "embedded_checkout",
    });
  }, [onReady]);

  useEffect(() => {
    if (error !== undefined) {
      onError?.({
        component: "VortexEmbeddedCheckout",
        surface: "embedded_checkout",
        error,
      });
    }
  }, [error, onError]);

  const startSetup = (): void => {
    void onStartPaymentMethodSetup?.(checkout);
  };
  const submitTokenizedMethod = (): void => {
    void onSubmitTokenizedPaymentMethod?.(checkout);
  };
  const openHostedCheckout = (): void => {
    const launch =
      hostedCheckoutUrl === undefined
        ? hostedRecoveryRequest === null
          ? null
          : runtime.createHostedLink(hostedRecoveryRequest)
        : {
            surface: "pay_link" as const,
            url: hostedCheckoutUrl,
            mode: "hosted_redirect" as const,
          };
    if (launch === null) return;
    onHostedCheckoutLaunch?.(launch);
    selectedNavigate(launch);
  };
  const usesHostedCheckout = hostedCheckoutUrl !== undefined;

  return createElement(
    "section",
    {
      className: cx("vortex-payments-embedded-checkout", className, classNames?.root),
      "data-vortex-surface": "embedded-checkout",
      "data-vortex-component": "VortexEmbeddedCheckout",
      "data-vortex-payment-request-id": checkout.paymentRequestId,
      "data-vortex-checkout-status": checkout.status,
      "data-vortex-amount-remaining": String(checkout.amountRemaining),
      "data-vortex-hosted-checkout-url-present": String(usesHostedCheckout),
      "data-vortex-tokenized-payment-method-ready": String(tokenizedPaymentMethodReady === true),
      "data-vortex-appearance-color-scheme": appearance?.colorScheme ?? "system",
      "data-vortex-appearance-density": appearance?.density ?? "comfortable",
      "data-vortex-appearance-radius": appearance?.radius ?? "md",
      style:
        appearance?.accentColor === undefined
          ? undefined
          : ({ "--vortex-payments-accent-color": appearance.accentColor } as Record<
              string,
              string
            >),
    },
    createElement(
      "header",
      { className: classNames?.header },
      createElement("h2", { className: classNames?.title }, resolvedCopy.title),
      createElement(
        "p",
        { className: classNames?.description },
        checkout.status === "paid"
          ? resolvedCopy.paidDescription
          : canCollect
            ? resolvedCopy.readyDescription
            : resolvedCopy.blockedDescription,
      ),
    ),
    loading === true
      ? createElement(
          "div",
          { className: classNames?.loading, role: "status" },
          resolvedCopy.loadingTitle,
        )
      : null,
    error === undefined
      ? null
      : createElement(
          "div",
          { className: classNames?.error, role: "alert" },
          resolvedCopy.errorTitle,
          error,
        ),
    hasFailedAttempt && checkout.lastAttemptError !== undefined
      ? createElement(
          "div",
          { className: classNames?.error, role: "alert" },
          checkout.lastAttemptError,
        )
      : null,
    createElement(
      "dl",
      { className: classNames?.metrics },
      createMetric(
        resolvedCopy.amountDueLabel,
        formatMinorUnitAmount(checkout.amountRemaining, checkout.currency),
        classNames,
      ),
      createMetric(resolvedCopy.statusLabel, checkout.status, classNames),
      createMetric(resolvedCopy.customerLabel, checkout.customerLabel ?? "customer", classNames),
      createMetric(resolvedCopy.merchantLabel, checkout.merchantLabel ?? "merchant", classNames),
      createMetric(resolvedCopy.dueAtLabel, checkout.dueAt ?? "not_set", classNames),
      createMetric(resolvedCopy.expiresAtLabel, checkout.expiresAt ?? "not_set", classNames),
    ),
    (checkout.lineItems ?? []).length === 0
      ? createElement(
          "div",
          { className: classNames?.empty, role: "status" },
          createElement("p", null, resolvedCopy.emptyTitle),
          createElement("p", null, resolvedCopy.emptyDescription),
        )
      : createElement(
          "ul",
          { className: classNames?.list },
          (checkout.lineItems ?? []).map((lineItem) =>
            createEmbeddedCheckoutLineItem(lineItem, classNames),
          ),
        ),
    createElement(
      "div",
      { className: classNames?.actions },
      usesHostedCheckout
        ? createElement(
            "button",
            {
              className: classNames?.button,
              type: "button",
              disabled: isDisabled || !canCollect,
              onClick: openHostedCheckout,
              "data-vortex-checkout-action": "open_hosted_checkout",
            },
            resolvedCopy.openHostedCheckoutLabel,
          )
        : [
            createElement(
              "button",
              {
                className: classNames?.button,
                type: "button",
                disabled: isDisabled || !canCollect,
                onClick: startSetup,
                "data-vortex-checkout-action": "start_payment_method_setup",
                key: "start_payment_method_setup",
              },
              resolvedCopy.startPaymentMethodSetupLabel,
            ),
            createElement(
              "button",
              {
                className: classNames?.button,
                type: "button",
                disabled: isDisabled || !canCollect || tokenizedPaymentMethodReady !== true,
                onClick: submitTokenizedMethod,
                "data-vortex-checkout-action": "submit_tokenized_payment_method",
                key: "submit_tokenized_payment_method",
              },
              tokenizedPaymentMethodReady === true
                ? resolvedCopy.submitTokenizedPaymentMethodLabel
                : resolvedCopy.secureEntryReadyLabel,
            ),
            hostedRecoveryRequest === null
              ? null
              : createElement(
                  "button",
                  {
                    className: classNames?.button,
                    type: "button",
                    disabled: isDisabled,
                    onClick: openHostedCheckout,
                    "data-vortex-checkout-action": "open_hosted_checkout",
                    key: "open_hosted_checkout",
                  },
                  resolvedCopy.openHostedCheckoutLabel,
                ),
          ],
    ),
  );
}

export function VortexPromoCodeControl({
  promoCode,
  appearance,
  classNames,
  copy,
  loading,
  error,
  disabled,
  readOnly,
  initialCode,
  onApplyPromoCode,
  onRemovePromoCode,
  onReady,
  onError,
  className,
}: VortexPromoCodeControlProps): ReactNode {
  const resolvedCopy = resolvePromoCodeControlCopy(copy);
  const [code, setCode] = useState(initialCode ?? promoCode.code ?? "");
  const isValidating = loading === true || promoCode.status === "validating";
  const isDisabled = disabled === true || readOnly === true || isValidating;
  const trimmedCode = code.trim();
  const hasAppliedCode = promoCode.status === "applied" && promoCode.code !== undefined;

  useEffect(() => {
    onReady?.({
      component: "VortexPromoCodeControl",
      surface: "promo_code_control",
    });
  }, [onReady]);

  useEffect(() => {
    if (error !== undefined) {
      onError?.({
        component: "VortexPromoCodeControl",
        surface: "promo_code_control",
        error,
      });
    }
  }, [error, onError]);

  const applyPromoCode = (event: FormEvent<HTMLFormElement>): void => {
    event.preventDefault();
    if (trimmedCode.length === 0 || isDisabled) {
      return;
    }
    void onApplyPromoCode?.(trimmedCode, promoCode);
  };
  const removePromoCode = (): void => {
    if (isDisabled) {
      return;
    }
    void onRemovePromoCode?.(promoCode);
  };
  const updateCode = (event: ChangeEvent<HTMLInputElement>): void => {
    setCode(event.target.value);
  };

  return createElement(
    "section",
    {
      className: cx("vortex-payments-promo-code-control", className, classNames?.root),
      "data-vortex-surface": "promo-code-control",
      "data-vortex-component": "VortexPromoCodeControl",
      "data-vortex-promo-status": promoCode.status,
      "data-vortex-checkout-id": promoCode.checkoutId,
      "data-vortex-customer-id": promoCode.customerId,
      "data-vortex-applied-coupon-id": promoCode.appliedCouponId,
      "data-vortex-appearance-color-scheme": appearance?.colorScheme ?? "system",
      "data-vortex-appearance-density": appearance?.density ?? "comfortable",
      "data-vortex-appearance-radius": appearance?.radius ?? "md",
      style:
        appearance?.accentColor === undefined
          ? undefined
          : ({ "--vortex-payments-accent-color": appearance.accentColor } as Record<
              string,
              string
            >),
    },
    createElement(
      "header",
      { className: classNames?.header },
      createElement("h2", { className: classNames?.title }, resolvedCopy.title),
      createElement(
        "p",
        { className: classNames?.description },
        promoCodeDescription(promoCode, resolvedCopy),
      ),
    ),
    isValidating
      ? createElement(
          "div",
          { className: classNames?.loading, role: "status" },
          resolvedCopy.loadingTitle,
        )
      : null,
    error === undefined
      ? null
      : createElement(
          "div",
          { className: classNames?.error, role: "alert" },
          resolvedCopy.errorTitle,
          error,
        ),
    promoCode.status === "rejected" && promoCode.message !== undefined
      ? createElement("div", { className: classNames?.error, role: "alert" }, promoCode.message)
      : null,
    createElement(
      "form",
      {
        className: classNames?.actions,
        onSubmit: applyPromoCode,
        "data-vortex-promo-code-form": "true",
      },
      createElement(
        "label",
        { className: classNames?.itemTitle },
        resolvedCopy.codeLabel,
        createElement("input", {
          "aria-label": stringFromReactNode(resolvedCopy.codeLabel, "Promo code"),
          autoComplete: "off",
          className: classNames?.item,
          disabled: isDisabled || hasAppliedCode,
          name: "vortex-promo-code",
          onChange: updateCode,
          placeholder: resolvedCopy.codePlaceholder,
          readOnly: readOnly === true || hasAppliedCode,
          type: "text",
          value: code,
          "data-vortex-promo-code-input": "true",
        }),
      ),
      createElement(
        "button",
        {
          className: classNames?.button,
          disabled: isDisabled || hasAppliedCode || trimmedCode.length === 0,
          type: "submit",
          "data-vortex-promo-code-action": "apply",
        },
        isValidating ? resolvedCopy.applyingLabel : resolvedCopy.applyLabel,
      ),
      hasAppliedCode
        ? createElement(
            "button",
            {
              className: classNames?.button,
              disabled: isDisabled,
              onClick: removePromoCode,
              type: "button",
              "data-vortex-promo-code-action": "remove",
            },
            resolvedCopy.removeLabel,
          )
        : null,
    ),
    hasAppliedCode
      ? createElement(
          "dl",
          { className: classNames?.metrics },
          createMetric(resolvedCopy.appliedCodeLabel, promoCode.code, classNames),
          promoCode.discount === undefined
            ? createMetric(resolvedCopy.discountLabel, resolvedCopy.emptyTitle, classNames)
            : createMetric(
                resolvedCopy.discountLabel,
                formatMinorUnitAmount(promoCode.discount.amount, promoCode.discount.currency),
                classNames,
              ),
        )
      : createElement(
          "div",
          { className: classNames?.empty, role: "status" },
          createElement("p", null, resolvedCopy.emptyTitle),
          createElement("p", null, resolvedCopy.emptyDescription),
        ),
    promoCode.discount === undefined
      ? null
      : createElement(
          "div",
          {
            className: classNames?.item,
            "data-vortex-promo-code-discount": "true",
          },
          createElement("strong", { className: classNames?.itemTitle }, promoCode.discount.label),
          promoCode.discount.description === undefined
            ? null
            : createElement(
                "p",
                { className: classNames?.itemDescription },
                promoCode.discount.description,
              ),
          createElement(
            "span",
            { className: classNames?.status },
            formatMinorUnitAmount(promoCode.discount.amount, promoCode.discount.currency),
          ),
        ),
  );
}

export function VortexBalanceWalletPanel({
  balance,
  appearance,
  classNames,
  copy,
  loading,
  error,
  disabled,
  readOnly,
  onAddFunds,
  onEntrySelect,
  onReady,
  onError,
  className,
}: VortexBalanceWalletPanelProps): ReactNode {
  const resolvedCopy = resolveBalanceWalletPanelCopy(copy);
  const isDisabled = disabled === true || readOnly === true || loading === true;
  const hasEntries = balance.entries.length > 0;
  const blocked = balance.status === "blocked";

  useEffect(() => {
    onReady?.({
      component: "VortexBalanceWalletPanel",
      surface: "balance_wallet_panel",
    });
  }, [onReady]);

  useEffect(() => {
    if (error !== undefined) {
      onError?.({
        component: "VortexBalanceWalletPanel",
        surface: "balance_wallet_panel",
        error,
      });
    }
  }, [error, onError]);

  const addFunds = (): void => {
    if (isDisabled) {
      return;
    }
    void onAddFunds?.(balance);
  };

  return createElement(
    "section",
    {
      className: cx("vortex-payments-balance-wallet-panel", className, classNames?.root),
      "data-vortex-surface": "balance-wallet-panel",
      "data-vortex-component": "VortexBalanceWalletPanel",
      "data-vortex-customer-id": balance.customerId,
      "data-vortex-billing-account-id": balance.billingAccountId,
      "data-vortex-wallet-status": balance.status,
      "data-vortex-available-amount": String(balance.availableAmount),
      "data-vortex-currency": balance.currency,
      "data-vortex-appearance-color-scheme": appearance?.colorScheme ?? "system",
      "data-vortex-appearance-density": appearance?.density ?? "comfortable",
      "data-vortex-appearance-radius": appearance?.radius ?? "md",
      style:
        appearance?.accentColor === undefined
          ? undefined
          : ({ "--vortex-payments-accent-color": appearance.accentColor } as Record<
              string,
              string
            >),
    },
    createElement(
      "header",
      { className: classNames?.header },
      createElement("h2", { className: classNames?.title }, resolvedCopy.title),
      createElement(
        "p",
        { className: classNames?.description },
        balanceWalletDescription(balance, resolvedCopy),
      ),
    ),
    loading === true
      ? createElement(
          "div",
          { className: classNames?.loading, role: "status" },
          resolvedCopy.loadingTitle,
        )
      : null,
    error === undefined
      ? null
      : createElement(
          "div",
          { className: classNames?.error, role: "alert" },
          resolvedCopy.errorTitle,
          error,
        ),
    blocked && balance.message !== undefined
      ? createElement("div", { className: classNames?.error, role: "alert" }, balance.message)
      : null,
    createElement(
      "dl",
      { className: classNames?.metrics },
      createMetric(
        resolvedCopy.availableBalanceLabel,
        formatMinorUnitAmount(balance.availableAmount, balance.currency),
        classNames,
      ),
      createMetric(
        resolvedCopy.pendingBalanceLabel,
        formatMinorUnitAmount(balance.pendingAmount ?? 0, balance.currency),
        classNames,
      ),
      createMetric(resolvedCopy.entryCountLabel, String(balance.entries.length), classNames),
      createMetric(resolvedCopy.nextActionLabel, balance.nextAction ?? "none", classNames),
    ),
    hasEntries
      ? createElement(
          "ul",
          { className: classNames?.list },
          balance.entries.map((entry) =>
            createBalanceWalletEntryItem(
              entry,
              balance,
              resolvedCopy,
              classNames,
              isDisabled,
              onEntrySelect,
            ),
          ),
        )
      : createElement(
          "div",
          { className: classNames?.empty, role: "status" },
          createElement("p", null, resolvedCopy.emptyTitle),
          createElement("p", null, resolvedCopy.emptyStateDescription),
        ),
    createElement(
      "div",
      { className: classNames?.actions },
      createElement(
        "button",
        {
          className: classNames?.button,
          disabled: isDisabled || blocked,
          onClick: addFunds,
          type: "button",
          "data-vortex-wallet-action": "add_funds",
        },
        resolvedCopy.addFundsLabel,
      ),
    ),
  );
}

export function VortexRecoverySummary({
  recovery,
  appearance,
  classNames,
  copy,
  loading,
  error,
  disabled,
  readOnly,
  navigate,
  onHostedRecoveryLaunch,
  onRetryPayment,
  onAttemptSelect,
  onReady,
  onError,
  className,
}: VortexRecoverySummaryProps): ReactNode {
  const { runtime, navigate: contextNavigate } = useVortexPayments();
  const selectedNavigate = navigate ?? contextNavigate;
  const resolvedCopy = resolveRecoverySummaryCopy(copy);
  const isDisabled = disabled === true || readOnly === true || loading === true;
  const attempts = recovery.attempts ?? [];
  const hasAttempts = attempts.length > 0;
  const canOpenHostedRecovery =
    recovery.hostedRecoveryToken !== undefined &&
    recovery.status !== "healthy" &&
    recovery.status !== "recovered";
  const canRetryPayment =
    recovery.paymentRequestId !== undefined &&
    recovery.status !== "healthy" &&
    recovery.status !== "recovered";

  useEffect(() => {
    onReady?.({
      component: "VortexRecoverySummary",
      surface: "recovery_summary",
    });
  }, [onReady]);

  useEffect(() => {
    if (error !== undefined) {
      onError?.({
        component: "VortexRecoverySummary",
        surface: "recovery_summary",
        error,
      });
    }
  }, [error, onError]);

  const openHostedRecovery = (): void => {
    if (!canOpenHostedRecovery || recovery.hostedRecoveryToken === undefined) {
      return;
    }
    const launch = runtime.createHostedLink({
      surface: "payment_recovery",
      token: recovery.hostedRecoveryToken,
      query: { view: "payment_recovery" },
    });
    onHostedRecoveryLaunch?.(launch);
    selectedNavigate(launch);
  };

  const retryPayment = (): void => {
    if (!canRetryPayment) {
      return;
    }
    void onRetryPayment?.(recovery);
  };

  return createElement(
    "section",
    {
      className: cx("vortex-payments-recovery-summary", className, classNames?.root),
      "data-vortex-surface": "recovery-summary",
      "data-vortex-component": "VortexRecoverySummary",
      "data-vortex-customer-id": recovery.customerId,
      "data-vortex-billing-account-id": recovery.billingAccountId,
      "data-vortex-recovery-status": recovery.status,
      "data-vortex-recovery-reason": recovery.reason,
      "data-vortex-payment-request-id": recovery.paymentRequestId,
      "data-vortex-invoice-id": recovery.invoiceId,
      "data-vortex-dunning-campaign-id": recovery.dunningCampaignId,
      "data-vortex-hosted-recovery-ready": String(canOpenHostedRecovery),
      "data-vortex-appearance-color-scheme": appearance?.colorScheme ?? "system",
      "data-vortex-appearance-density": appearance?.density ?? "comfortable",
      "data-vortex-appearance-radius": appearance?.radius ?? "md",
      style:
        appearance?.accentColor === undefined
          ? undefined
          : ({ "--vortex-payments-accent-color": appearance.accentColor } as Record<
              string,
              string
            >),
    },
    createElement(
      "header",
      { className: classNames?.header },
      createElement("h2", { className: classNames?.title }, resolvedCopy.title),
      createElement(
        "p",
        { className: classNames?.description },
        recoverySummaryDescription(recovery, resolvedCopy),
      ),
    ),
    loading === true
      ? createElement(
          "div",
          { className: classNames?.loading, role: "status" },
          resolvedCopy.loadingTitle,
        )
      : null,
    error === undefined
      ? null
      : createElement(
          "div",
          { className: classNames?.error, role: "alert" },
          resolvedCopy.errorTitle,
          error,
        ),
    recovery.message === undefined
      ? null
      : createElement("p", { className: classNames?.status }, recovery.message),
    createElement(
      "dl",
      { className: classNames?.metrics },
      createMetric(resolvedCopy.statusLabel, recovery.status, classNames),
      createMetric(resolvedCopy.reasonLabel, recovery.reason ?? "none", classNames),
      createMetric(
        resolvedCopy.amountDueLabel,
        recovery.amountDue === undefined || recovery.currency === undefined
          ? "none"
          : formatMinorUnitAmount(recovery.amountDue, recovery.currency),
        classNames,
      ),
      createMetric(resolvedCopy.nextRetryLabel, recovery.nextRetryAt ?? "none", classNames),
      createMetric(
        resolvedCopy.invoiceLabel,
        recovery.invoiceNumber ?? recovery.invoiceId ?? "none",
        classNames,
      ),
      createMetric(resolvedCopy.attemptsLabel, String(attempts.length), classNames),
    ),
    hasAttempts
      ? createElement(
          "ul",
          { className: classNames?.list },
          attempts.map((attempt) =>
            createRecoveryAttemptItem(attempt, recovery, classNames, isDisabled, onAttemptSelect),
          ),
        )
      : createElement(
          "div",
          { className: classNames?.empty, role: "status" },
          createElement("p", null, resolvedCopy.emptyAttemptsTitle),
        ),
    createElement(
      "div",
      { className: classNames?.actions },
      createElement(
        "button",
        {
          className: classNames?.button,
          disabled: isDisabled || !canOpenHostedRecovery,
          onClick: openHostedRecovery,
          type: "button",
          "data-vortex-recovery-action": "open_hosted_recovery",
        },
        resolvedCopy.openHostedRecoveryLabel,
      ),
      createElement(
        "button",
        {
          className: classNames?.button,
          disabled: isDisabled || !canRetryPayment,
          onClick: retryPayment,
          type: "button",
          "data-vortex-recovery-action": "retry_payment",
        },
        resolvedCopy.retryPaymentLabel,
      ),
    ),
  );
}

export function VortexEntitlementSummary({
  access,
  appearance,
  classNames,
  copy,
  loading,
  error,
  disabled,
  readOnly,
  navigate,
  onPortalLaunch,
  onFeatureSelect,
  onReady,
  onError,
  className,
}: VortexEntitlementSummaryProps): ReactNode {
  const { runtime, navigate: contextNavigate } = useVortexPayments();
  const selectedNavigate = navigate ?? contextNavigate;
  const resolvedCopy = resolveEntitlementSummaryCopy(copy);
  const isDisabled = disabled === true || readOnly === true || loading === true;
  const hasFeatures = access.features.length > 0;
  const canOpenPortal = access.portalToken !== undefined;

  useEffect(() => {
    onReady?.({
      component: "VortexEntitlementSummary",
      surface: "entitlement_summary",
    });
  }, [onReady]);

  useEffect(() => {
    if (error !== undefined) {
      onError?.({
        component: "VortexEntitlementSummary",
        surface: "entitlement_summary",
        error,
      });
    }
  }, [error, onError]);

  const openPortal = (): void => {
    if (!canOpenPortal || access.portalToken === undefined) {
      return;
    }
    const launch = runtime.createHostedLink({
      surface: "customer_portal",
      token: access.portalToken,
      query: { view: "access" },
    });
    onPortalLaunch?.(launch);
    selectedNavigate(launch);
  };

  return createElement(
    "section",
    {
      className: cx("vortex-payments-entitlement-summary", className, classNames?.root),
      "data-vortex-surface": "entitlement-summary",
      "data-vortex-component": "VortexEntitlementSummary",
      "data-vortex-customer-id": access.customerId,
      "data-vortex-billing-account-id": access.billingAccountId,
      "data-vortex-subscription-id": access.subscriptionId,
      "data-vortex-access-status": access.status,
      "data-vortex-feature-count": String(access.features.length),
      "data-vortex-customer-portal-ready": String(canOpenPortal),
      "data-vortex-appearance-color-scheme": appearance?.colorScheme ?? "system",
      "data-vortex-appearance-density": appearance?.density ?? "comfortable",
      "data-vortex-appearance-radius": appearance?.radius ?? "md",
      style:
        appearance?.accentColor === undefined
          ? undefined
          : ({ "--vortex-payments-accent-color": appearance.accentColor } as Record<
              string,
              string
            >),
    },
    createElement(
      "header",
      { className: classNames?.header },
      createElement("h2", { className: classNames?.title }, resolvedCopy.title),
      createElement(
        "p",
        { className: classNames?.description },
        entitlementSummaryDescription(access, resolvedCopy),
      ),
    ),
    loading === true
      ? createElement(
          "div",
          { className: classNames?.loading, role: "status" },
          resolvedCopy.loadingTitle,
        )
      : null,
    error === undefined
      ? null
      : createElement(
          "div",
          { className: classNames?.error, role: "alert" },
          resolvedCopy.errorTitle,
          error,
        ),
    access.message === undefined
      ? null
      : createElement("p", { className: classNames?.status }, access.message),
    createElement(
      "dl",
      { className: classNames?.metrics },
      createMetric(resolvedCopy.statusLabel, access.status, classNames),
      createMetric(resolvedCopy.planLabel, access.planLabel ?? "none", classNames),
      createMetric(resolvedCopy.featureCountLabel, String(access.features.length), classNames),
      createMetric(
        resolvedCopy.renewalLabel,
        access.renewsAt ?? access.activeUntil ?? "none",
        classNames,
      ),
      createMetric(resolvedCopy.trialLabel, access.trialEndsAt ?? "none", classNames),
    ),
    hasFeatures
      ? createElement(
          "ul",
          { className: classNames?.list },
          access.features.map((feature) =>
            createEntitlementFeatureItem(
              feature,
              access,
              resolvedCopy,
              classNames,
              isDisabled,
              onFeatureSelect,
            ),
          ),
        )
      : createElement(
          "div",
          { className: classNames?.empty, role: "status" },
          createElement("p", null, resolvedCopy.emptyFeaturesTitle),
        ),
    createElement(
      "div",
      { className: classNames?.actions },
      createElement(
        "button",
        {
          className: classNames?.button,
          disabled: isDisabled || !canOpenPortal,
          onClick: openPortal,
          type: "button",
          "data-vortex-entitlement-action": "open_customer_portal",
        },
        resolvedCopy.openPortalLabel,
      ),
    ),
  );
}

export function VortexPaymentTimelineSummary({
  timeline,
  appearance,
  classNames,
  copy,
  loading,
  error,
  disabled,
  readOnly,
  navigate,
  onPortalLaunch,
  onEntrySelect,
  onReady,
  onError,
  className,
}: VortexPaymentTimelineSummaryProps): ReactNode {
  const { runtime, navigate: contextNavigate } = useVortexPayments();
  const selectedNavigate = navigate ?? contextNavigate;
  const resolvedCopy = resolvePaymentTimelineSummaryCopy(copy);
  const isDisabled = disabled === true || readOnly === true || loading === true;
  const hasEntries = timeline.entries.length > 0;
  const canOpenPortal = timeline.portalToken !== undefined;

  useEffect(() => {
    onReady?.({
      component: "VortexPaymentTimelineSummary",
      surface: "payment_timeline_summary",
    });
  }, [onReady]);

  useEffect(() => {
    if (error !== undefined) {
      onError?.({
        component: "VortexPaymentTimelineSummary",
        surface: "payment_timeline_summary",
        error,
      });
    }
  }, [error, onError]);

  const openPortal = (): void => {
    if (!canOpenPortal || timeline.portalToken === undefined) {
      return;
    }
    const launch = runtime.createHostedLink({
      surface: "customer_portal",
      token: timeline.portalToken,
      query: { view: "invoices" },
    });
    onPortalLaunch?.(launch);
    selectedNavigate(launch);
  };

  return createElement(
    "section",
    {
      className: cx("vortex-payments-payment-timeline-summary", className, classNames?.root),
      "data-vortex-surface": "payment-timeline-summary",
      "data-vortex-component": "VortexPaymentTimelineSummary",
      "data-vortex-customer-id": timeline.customerId,
      "data-vortex-billing-account-id": timeline.billingAccountId,
      "data-vortex-timeline-status": timeline.status,
      "data-vortex-timeline-entry-count": String(timeline.entries.length),
      "data-vortex-customer-portal-ready": String(canOpenPortal),
      "data-vortex-appearance-color-scheme": appearance?.colorScheme ?? "system",
      "data-vortex-appearance-density": appearance?.density ?? "comfortable",
      "data-vortex-appearance-radius": appearance?.radius ?? "md",
      style:
        appearance?.accentColor === undefined
          ? undefined
          : ({ "--vortex-payments-accent-color": appearance.accentColor } as Record<
              string,
              string
            >),
    },
    createElement(
      "header",
      { className: classNames?.header },
      createElement("h2", { className: classNames?.title }, resolvedCopy.title),
      createElement(
        "p",
        { className: classNames?.description },
        paymentTimelineDescription(timeline, resolvedCopy),
      ),
    ),
    loading === true
      ? createElement(
          "div",
          { className: classNames?.loading, role: "status" },
          resolvedCopy.loadingTitle,
        )
      : null,
    error === undefined
      ? null
      : createElement(
          "div",
          { className: classNames?.error, role: "alert" },
          resolvedCopy.errorTitle,
          error,
        ),
    timeline.message === undefined
      ? null
      : createElement("p", { className: classNames?.status }, timeline.message),
    createElement(
      "dl",
      { className: classNames?.metrics },
      createMetric(resolvedCopy.statusLabel, timeline.status, classNames),
      createMetric(
        resolvedCopy.amountDueLabel,
        timeline.amountDue === undefined || timeline.currency === undefined
          ? "none"
          : formatMinorUnitAmount(timeline.amountDue, timeline.currency),
        classNames,
      ),
      createMetric(resolvedCopy.entryCountLabel, String(timeline.entries.length), classNames),
      createMetric(resolvedCopy.nextActionLabel, timeline.nextAction ?? "none", classNames),
    ),
    hasEntries
      ? createElement(
          "ul",
          { className: classNames?.list },
          timeline.entries.map((entry) =>
            createPaymentTimelineEntryItem(
              entry,
              timeline,
              resolvedCopy,
              classNames,
              isDisabled,
              onEntrySelect,
            ),
          ),
        )
      : createElement(
          "div",
          { className: classNames?.empty, role: "status" },
          createElement("p", null, resolvedCopy.emptyEntriesTitle),
          createElement("p", null, resolvedCopy.emptyEntriesDescription),
        ),
    createElement(
      "div",
      { className: classNames?.actions },
      createElement(
        "button",
        {
          className: classNames?.button,
          disabled: isDisabled || !canOpenPortal,
          onClick: openPortal,
          type: "button",
          "data-vortex-payment-timeline-action": "open_customer_portal",
        },
        resolvedCopy.openPortalLabel,
      ),
    ),
  );
}

export function VortexInvoiceList({
  invoiceList,
  appearance,
  classNames,
  copy,
  loading,
  error,
  disabled,
  readOnly,
  navigate,
  onPortalLaunch,
  onInvoiceSelect,
  onLoadMore,
  onReady,
  onError,
  className,
}: VortexInvoiceListProps): ReactNode {
  const { runtime, navigate: contextNavigate } = useVortexPayments();
  const selectedNavigate = navigate ?? contextNavigate;
  const resolvedCopy = resolveInvoiceListCopy(copy);
  const isDisabled = disabled === true || readOnly === true || loading === true;
  const hasInvoices = invoiceList.invoices.length > 0;
  const canOpenPortal = invoiceList.portalToken !== undefined;
  const canLoadMore = invoiceList.hasMore === true && invoiceList.nextPageToken !== undefined;

  useEffect(() => {
    onReady?.({
      component: "VortexInvoiceList",
      surface: "invoice_list",
    });
  }, [onReady]);

  useEffect(() => {
    if (error !== undefined) {
      onError?.({
        component: "VortexInvoiceList",
        surface: "invoice_list",
        error,
      });
    }
  }, [error, onError]);

  const openPortal = (): void => {
    if (!canOpenPortal || invoiceList.portalToken === undefined) {
      return;
    }
    const launch = runtime.createHostedLink({
      surface: "invoice_receipt_center",
      token: invoiceList.portalToken,
      query: { view: "invoices" },
    });
    onPortalLaunch?.(launch);
    selectedNavigate(launch);
  };

  return createElement(
    "section",
    {
      className: cx("vortex-payments-invoice-list", className, classNames?.root),
      "data-vortex-surface": "invoice-list",
      "data-vortex-component": "VortexInvoiceList",
      "data-vortex-customer-id": invoiceList.customerId,
      "data-vortex-billing-account-id": invoiceList.billingAccountId,
      "data-vortex-invoice-list-status": invoiceList.status,
      "data-vortex-invoice-count": String(invoiceList.invoices.length),
      "data-vortex-invoice-row-limit": String(invoiceList.rowLimit ?? invoiceList.invoices.length),
      "data-vortex-invoice-has-more": String(invoiceList.hasMore === true),
      "data-vortex-customer-portal-ready": String(canOpenPortal),
      "data-vortex-appearance-color-scheme": appearance?.colorScheme ?? "system",
      "data-vortex-appearance-density": appearance?.density ?? "comfortable",
      "data-vortex-appearance-radius": appearance?.radius ?? "md",
      style:
        appearance?.accentColor === undefined
          ? undefined
          : ({ "--vortex-payments-accent-color": appearance.accentColor } as Record<
              string,
              string
            >),
    },
    createElement(
      "header",
      { className: classNames?.header },
      createElement("h2", { className: classNames?.title }, resolvedCopy.title),
      createElement(
        "p",
        { className: classNames?.description },
        invoiceListDescription(invoiceList, resolvedCopy),
      ),
    ),
    loading === true
      ? createElement(
          "div",
          { className: classNames?.loading, role: "status" },
          resolvedCopy.loadingTitle,
        )
      : null,
    error === undefined
      ? null
      : createElement(
          "div",
          { className: classNames?.error, role: "alert" },
          resolvedCopy.errorTitle,
          error,
        ),
    invoiceList.message === undefined
      ? null
      : createElement("p", { className: classNames?.status }, invoiceList.message),
    createElement(
      "dl",
      { className: classNames?.metrics },
      createMetric(resolvedCopy.statusLabel, invoiceList.status, classNames),
      createMetric(
        resolvedCopy.amountDueLabel,
        invoiceList.amountDue === undefined || invoiceList.currency === undefined
          ? "none"
          : formatMinorUnitAmount(invoiceList.amountDue, invoiceList.currency),
        classNames,
      ),
      createMetric(resolvedCopy.invoiceCountLabel, String(invoiceList.invoices.length), classNames),
      createMetric(
        resolvedCopy.overdueCountLabel,
        String(invoiceList.overdueCount ?? 0),
        classNames,
      ),
      createMetric(
        resolvedCopy.actionRequiredCountLabel,
        String(invoiceList.actionRequiredCount ?? 0),
        classNames,
      ),
      createMetric(
        resolvedCopy.rowLimitLabel,
        String(invoiceList.rowLimit ?? invoiceList.invoices.length),
        classNames,
      ),
      createMetric(resolvedCopy.nextActionLabel, invoiceList.nextAction ?? "none", classNames),
    ),
    hasInvoices
      ? createElement(
          "ul",
          { className: classNames?.list },
          invoiceList.invoices.map((invoice) =>
            createInvoiceListRowItem(
              invoice,
              invoiceList,
              resolvedCopy,
              classNames,
              isDisabled,
              onInvoiceSelect,
            ),
          ),
        )
      : createElement(
          "div",
          { className: classNames?.empty, role: "status" },
          createElement("p", null, resolvedCopy.emptyInvoicesTitle),
          createElement("p", null, resolvedCopy.emptyInvoicesDescription),
        ),
    createElement(
      "div",
      { className: classNames?.actions },
      createElement(
        "button",
        {
          className: classNames?.button,
          disabled: isDisabled || !canOpenPortal,
          onClick: openPortal,
          type: "button",
          "data-vortex-invoice-list-action": "open_invoice_receipt_center",
        },
        resolvedCopy.openPortalLabel,
      ),
      createElement(
        "button",
        {
          className: classNames?.button,
          disabled: isDisabled || !canLoadMore,
          onClick: () => {
            void onLoadMore?.(invoiceList);
          },
          type: "button",
          "data-vortex-invoice-list-action": "load_more",
          "data-vortex-invoice-next-page-token": invoiceList.nextPageToken,
        },
        resolvedCopy.loadMoreLabel,
      ),
    ),
  );
}

export function VortexPlanComparison({
  comparison,
  appearance,
  classNames,
  copy,
  loading,
  error,
  disabled,
  readOnly,
  navigate,
  onCheckoutLaunch,
  onPlanSelect,
  onReady,
  onError,
  className,
}: VortexPlanComparisonProps): ReactNode {
  const { runtime, navigate: contextNavigate } = useVortexPayments();
  const selectedNavigate = navigate ?? contextNavigate;
  const resolvedCopy = resolvePlanComparisonCopy(copy);
  const isDisabled = disabled === true || readOnly === true || loading === true;
  const hasPlans = comparison.plans.length > 0;

  useEffect(() => {
    onReady?.({
      component: "VortexPlanComparison",
      surface: "plan_comparison",
    });
  }, [onReady]);

  useEffect(() => {
    if (error !== undefined) {
      onError?.({
        component: "VortexPlanComparison",
        surface: "plan_comparison",
        error,
      });
    }
  }, [error, onError]);

  const launchPlan = (plan: VortexPlanComparisonPlan): void => {
    if (
      plan.status === "disabled" ||
      plan.status === "current" ||
      plan.disabledReason !== undefined
    ) {
      return;
    }
    if (plan.checkoutToken !== undefined) {
      const launch = runtime.createHostedLink({
        surface: "checkout",
        token: plan.checkoutToken,
        query: {
          lookup_key: plan.lookupKey,
          return_to: comparison.checkoutReturnPath,
        },
      });
      onCheckoutLaunch?.(plan, launch);
      selectedNavigate(launch);
      return;
    }
    void onPlanSelect?.(plan, comparison);
  };

  return createElement(
    "section",
    {
      className: cx("vortex-payments-plan-comparison", className, classNames?.root),
      "data-vortex-surface": "plan-comparison",
      "data-vortex-component": "VortexPlanComparison",
      "data-vortex-customer-id": comparison.customerId,
      "data-vortex-billing-account-id": comparison.billingAccountId,
      "data-vortex-plan-comparison-status": comparison.status,
      "data-vortex-plan-count": String(comparison.plans.length),
      "data-vortex-current-plan-id": comparison.currentPlanId,
      "data-vortex-recommended-plan-id": comparison.recommendedPlanId,
      "data-vortex-selected-plan-id": comparison.selectedPlanId,
      "data-vortex-appearance-color-scheme": appearance?.colorScheme ?? "system",
      "data-vortex-appearance-density": appearance?.density ?? "comfortable",
      "data-vortex-appearance-radius": appearance?.radius ?? "md",
      style:
        appearance?.accentColor === undefined
          ? undefined
          : ({ "--vortex-payments-accent-color": appearance.accentColor } as Record<
              string,
              string
            >),
    },
    createElement(
      "header",
      { className: classNames?.header },
      createElement("h2", { className: classNames?.title }, resolvedCopy.title),
      createElement(
        "p",
        { className: classNames?.description },
        planComparisonDescription(comparison, resolvedCopy),
      ),
    ),
    loading === true
      ? createElement(
          "div",
          { className: classNames?.loading, role: "status" },
          resolvedCopy.loadingTitle,
        )
      : null,
    error === undefined
      ? null
      : createElement(
          "div",
          { className: classNames?.error, role: "alert" },
          resolvedCopy.errorTitle,
          error,
        ),
    comparison.message === undefined
      ? null
      : createElement("p", { className: classNames?.status }, comparison.message),
    createElement(
      "dl",
      { className: classNames?.metrics },
      createMetric(resolvedCopy.statusLabel, comparison.status, classNames),
      createMetric(resolvedCopy.planCountLabel, String(comparison.plans.length), classNames),
      createMetric(resolvedCopy.selectedPlanLabel, comparison.selectedPlanId ?? "none", classNames),
      createMetric(resolvedCopy.currentPlanLabel, comparison.currentPlanId ?? "none", classNames),
      createMetric(
        resolvedCopy.recommendedPlanLabel,
        comparison.recommendedPlanId ?? "none",
        classNames,
      ),
    ),
    hasPlans
      ? createElement(
          "ul",
          { className: classNames?.list },
          comparison.plans.map((plan) =>
            createPlanComparisonItem(
              plan,
              comparison,
              resolvedCopy,
              classNames,
              isDisabled,
              launchPlan,
            ),
          ),
        )
      : createElement(
          "div",
          { className: classNames?.empty, role: "status" },
          createElement("p", null, resolvedCopy.emptyPlansTitle),
          createElement("p", null, resolvedCopy.emptyPlansDescription),
        ),
  );
}

export function VortexUsageMeterSummary({
  usage,
  appearance,
  classNames,
  copy,
  loading,
  error,
  disabled,
  readOnly,
  navigate,
  onPortalLaunch,
  onMeterSelect,
  onReady,
  onError,
  className,
}: VortexUsageMeterSummaryProps): ReactNode {
  const { runtime, navigate: contextNavigate } = useVortexPayments();
  const selectedNavigate = navigate ?? contextNavigate;
  const resolvedCopy = resolveUsageMeterSummaryCopy(copy);
  const isDisabled = disabled === true || readOnly === true || loading === true;
  const hasMeters = usage.meters.length > 0;
  const canOpenPortal = usage.portalToken !== undefined;

  useEffect(() => {
    onReady?.({
      component: "VortexUsageMeterSummary",
      surface: "usage_meter_summary",
    });
  }, [onReady]);

  useEffect(() => {
    if (error !== undefined) {
      onError?.({
        component: "VortexUsageMeterSummary",
        surface: "usage_meter_summary",
        error,
      });
    }
  }, [error, onError]);

  const openPortal = (): void => {
    if (!canOpenPortal || usage.portalToken === undefined) {
      return;
    }
    const launch = runtime.createHostedLink({
      surface: "customer_portal",
      token: usage.portalToken,
      query: {
        view: "usage",
        return_to: usage.portalReturnPath,
      },
    });
    onPortalLaunch?.(launch);
    selectedNavigate(launch);
  };

  return createElement(
    "section",
    {
      className: cx("vortex-payments-usage-meter-summary", className, classNames?.root),
      "data-vortex-surface": "usage-meter-summary",
      "data-vortex-component": "VortexUsageMeterSummary",
      "data-vortex-customer-id": usage.customerId,
      "data-vortex-billing-account-id": usage.billingAccountId,
      "data-vortex-subscription-id": usage.subscriptionId,
      "data-vortex-usage-meter-summary-status": usage.status,
      "data-vortex-meter-count": String(usage.meters.length),
      "data-vortex-usage-period-start": usage.periodStart,
      "data-vortex-usage-period-end": usage.periodEnd,
      "data-vortex-usage-next-reset-at": usage.nextResetAt,
      "data-vortex-customer-portal-ready": String(canOpenPortal),
      "data-vortex-appearance-color-scheme": appearance?.colorScheme ?? "system",
      "data-vortex-appearance-density": appearance?.density ?? "comfortable",
      "data-vortex-appearance-radius": appearance?.radius ?? "md",
      style:
        appearance?.accentColor === undefined
          ? undefined
          : ({ "--vortex-payments-accent-color": appearance.accentColor } as Record<
              string,
              string
            >),
    },
    createElement(
      "header",
      { className: classNames?.header },
      createElement("h2", { className: classNames?.title }, resolvedCopy.title),
      createElement(
        "p",
        { className: classNames?.description },
        usageMeterSummaryDescription(usage, resolvedCopy),
      ),
    ),
    loading === true
      ? createElement(
          "div",
          { className: classNames?.loading, role: "status" },
          resolvedCopy.loadingTitle,
        )
      : null,
    error === undefined
      ? null
      : createElement(
          "div",
          { className: classNames?.error, role: "alert" },
          resolvedCopy.errorTitle,
          error,
        ),
    usage.message === undefined
      ? null
      : createElement("p", { className: classNames?.status }, usage.message),
    createElement(
      "dl",
      { className: classNames?.metrics },
      createMetric(resolvedCopy.statusLabel, usage.status, classNames),
      createMetric(resolvedCopy.planLabel, usage.planLabel ?? "none", classNames),
      createMetric(
        resolvedCopy.periodLabel,
        formatDateRange(usage.periodStart, usage.periodEnd),
        classNames,
      ),
      createMetric(resolvedCopy.nextResetLabel, usage.nextResetAt ?? "none", classNames),
      createMetric(resolvedCopy.meterCountLabel, String(usage.meters.length), classNames),
    ),
    hasMeters
      ? createElement(
          "ul",
          { className: classNames?.list },
          usage.meters.map((meter) =>
            createUsageMeterSummaryItem(
              meter,
              usage,
              resolvedCopy,
              classNames,
              isDisabled,
              onMeterSelect,
            ),
          ),
        )
      : createElement(
          "div",
          { className: classNames?.empty, role: "status" },
          createElement("p", null, resolvedCopy.emptyMetersTitle),
          createElement("p", null, resolvedCopy.emptyMetersDescription),
        ),
    createElement(
      "div",
      { className: classNames?.actions },
      createElement(
        "button",
        {
          className: classNames?.button,
          disabled: isDisabled || !canOpenPortal,
          onClick: openPortal,
          type: "button",
          "data-vortex-usage-meter-summary-action": "open_customer_portal",
        },
        resolvedCopy.openPortalLabel,
      ),
    ),
  );
}

export function VortexReceiptDownloadButton({
  artifact,
  appearance,
  classNames,
  copy,
  loading,
  error,
  disabled,
  readOnly,
  navigate,
  onDownloadLaunch,
  onDownload,
  onReady,
  onError,
  className,
}: VortexReceiptDownloadButtonProps): ReactNode {
  const { runtime, navigate: contextNavigate } = useVortexPayments();
  const selectedNavigate = navigate ?? contextNavigate;
  const viewState = createReceiptDownloadButtonViewState({
    artifact,
    copy,
    disabled,
    loading,
    readOnly,
  });

  useEffect(() => {
    onReady?.({
      component: "VortexReceiptDownloadButton",
      surface: "receipt_download_button",
    });
  }, [onReady]);

  useEffect(() => {
    if (error !== undefined) {
      onError?.({
        component: "VortexReceiptDownloadButton",
        surface: "receipt_download_button",
        error,
      });
    }
  }, [error, onError]);

  const launchDownload = createReceiptDownloadLauncher({
    artifact,
    canDownload: viewState.canDownload,
    onDownload,
    onDownloadLaunch,
    runtime,
    selectedNavigate,
  });

  return createElement(
    "section",
    createReceiptDownloadButtonSectionProps({
      appearance,
      artifact,
      canOpenHostedArtifact: viewState.canOpenHostedArtifact,
      className,
      classNames,
    }),
    createReceiptDownloadHeader(artifact, classNames),
    createReceiptDownloadFeedback({ artifact, classNames, error, loading, viewState }),
    createReceiptDownloadMetrics(artifact, viewState.resolvedCopy, classNames),
    createReceiptDownloadAction({
      artifact,
      canDownload: viewState.canDownload,
      classNames,
      isDisabled: viewState.isDisabled,
      launchDownload,
      onDownload,
      resolvedCopy: viewState.resolvedCopy,
    }),
  );
}

function createReceiptDownloadButtonViewState({
  artifact,
  copy,
  disabled,
  loading,
  readOnly,
}: {
  readonly artifact: VortexReceiptDownloadButtonArtifact;
  readonly copy: VortexReceiptDownloadButtonCopy | undefined;
  readonly disabled: boolean | undefined;
  readonly loading: boolean | undefined;
  readonly readOnly: boolean | undefined;
}): ReceiptDownloadButtonViewState {
  return {
    canDownload: artifact.status === "ready" && artifact.disabledReason === undefined,
    canOpenHostedArtifact: artifact.portalToken !== undefined,
    isDisabled: disabled === true || readOnly === true || loading === true,
    resolvedCopy: resolveReceiptDownloadButtonCopy(copy),
  };
}

function createReceiptDownloadButtonSectionProps({
  appearance,
  artifact,
  canOpenHostedArtifact,
  className,
  classNames,
}: {
  readonly appearance: VortexEmbeddedComponentAppearance | undefined;
  readonly artifact: VortexReceiptDownloadButtonArtifact;
  readonly canOpenHostedArtifact: boolean;
  readonly className: string | undefined;
  readonly classNames: VortexEmbeddedComponentClassNames | undefined;
}) {
  return {
    className: cx("vortex-payments-receipt-download-button", className, classNames?.root),
    "data-vortex-surface": "receipt-download-button",
    "data-vortex-component": "VortexReceiptDownloadButton",
    "data-vortex-artifact-id": artifact.id,
    "data-vortex-artifact-kind": artifact.kind,
    "data-vortex-artifact-status": artifact.status,
    "data-vortex-receipt-id": artifact.receiptId,
    "data-vortex-invoice-id": artifact.invoiceId,
    "data-vortex-invoice-number": artifact.invoiceNumber,
    "data-vortex-invoice-receipt-center-ready": String(canOpenHostedArtifact),
    "data-vortex-appearance-color-scheme": appearance?.colorScheme ?? "system",
    "data-vortex-appearance-density": appearance?.density ?? "comfortable",
    "data-vortex-appearance-radius": appearance?.radius ?? "md",
    style: createAppearanceAccentStyle(appearance),
  };
}

function createAppearanceAccentStyle(
  appearance: VortexEmbeddedComponentAppearance | undefined,
): Record<string, string> | undefined {
  if (appearance?.accentColor === undefined) {
    return undefined;
  }
  return { "--vortex-payments-accent-color": appearance.accentColor };
}

function createReceiptDownloadHeader(
  artifact: VortexReceiptDownloadButtonArtifact,
  classNames: VortexEmbeddedComponentClassNames | undefined,
): ReactNode {
  if (artifact.title === undefined && artifact.description === undefined) {
    return null;
  }
  return createElement(
    "header",
    { className: classNames?.header },
    artifact.title === undefined
      ? null
      : createElement("h2", { className: classNames?.title }, artifact.title),
    artifact.description === undefined
      ? null
      : createElement("p", { className: classNames?.description }, artifact.description),
  );
}

function createReceiptDownloadFeedback({
  artifact,
  classNames,
  error,
  loading,
  viewState,
}: {
  readonly artifact: VortexReceiptDownloadButtonArtifact;
  readonly classNames: VortexEmbeddedComponentClassNames | undefined;
  readonly error: ReactNode | undefined;
  readonly loading: boolean | undefined;
  readonly viewState: ReceiptDownloadButtonViewState;
}): ReactNode {
  return [
    loading === true
      ? createElement(
          "div",
          { className: classNames?.loading, role: "status" },
          viewState.resolvedCopy.loadingLabel,
        )
      : null,
    error === undefined
      ? null
      : createElement(
          "div",
          { className: classNames?.error, role: "alert" },
          viewState.resolvedCopy.errorTitle,
          error,
        ),
    artifact.disabledReason === undefined
      ? null
      : createElement(
          "p",
          { className: classNames?.status, "data-vortex-artifact-disabled-reason": true },
          artifact.disabledReason,
        ),
  ];
}

function createReceiptDownloadMetrics(
  artifact: VortexReceiptDownloadButtonArtifact,
  copy: Required<VortexReceiptDownloadButtonCopy>,
  classNames: VortexEmbeddedComponentClassNames | undefined,
): ReactNode {
  return createElement(
    "dl",
    { className: classNames?.metrics },
    createMetric(copy.statusLabel, artifact.status, classNames),
    createMetric(copy.artifactLabel, artifact.kind, classNames),
    createMetric(
      copy.invoiceLabel,
      artifact.invoiceNumber ?? artifact.invoiceId ?? "none",
      classNames,
    ),
    createMetric(copy.amountLabel, receiptDownloadAmountValue(artifact), classNames),
    createMetric(copy.issuedLabel, artifact.issuedAt ?? "none", classNames),
    createMetric(copy.paidLabel, artifact.paidAt ?? "none", classNames),
    createMetric(copy.generatedLabel, artifact.generatedAt ?? "none", classNames),
  );
}

function receiptDownloadAmountValue(artifact: VortexReceiptDownloadButtonArtifact): ReactNode {
  if (artifact.amount === undefined || artifact.currency === undefined) {
    return "none";
  }
  return formatMinorUnitAmount(artifact.amount, artifact.currency);
}

function createReceiptDownloadAction({
  artifact,
  canDownload,
  classNames,
  isDisabled,
  launchDownload,
  onDownload,
  resolvedCopy,
}: {
  readonly artifact: VortexReceiptDownloadButtonArtifact;
  readonly canDownload: boolean;
  readonly classNames: VortexEmbeddedComponentClassNames | undefined;
  readonly isDisabled: boolean;
  readonly launchDownload: () => void;
  readonly onDownload: VortexReceiptDownloadButtonProps["onDownload"] | undefined;
  readonly resolvedCopy: Required<VortexReceiptDownloadButtonCopy>;
}): ReactNode {
  return createElement(
    "button",
    {
      className: classNames?.button,
      disabled: isDisabled || !canDownload || !hasReceiptDownloadHandler(artifact, onDownload),
      onClick: launchDownload,
      type: "button",
      "data-vortex-receipt-download-action": receiptDownloadActionName(artifact),
    },
    receiptDownloadButtonLabel(artifact, resolvedCopy),
  );
}

function hasReceiptDownloadHandler(
  artifact: VortexReceiptDownloadButtonArtifact,
  onDownload: VortexReceiptDownloadButtonProps["onDownload"] | undefined,
): boolean {
  return artifact.portalToken !== undefined || onDownload !== undefined;
}

function receiptDownloadActionName(artifact: VortexReceiptDownloadButtonArtifact) {
  return artifact.portalToken === undefined ? "download_artifact" : "open_invoice_receipt_center";
}

function createReceiptDownloadLauncher({
  artifact,
  canDownload,
  onDownload,
  onDownloadLaunch,
  runtime,
  selectedNavigate,
}: {
  readonly artifact: VortexReceiptDownloadButtonArtifact;
  readonly canDownload: boolean;
  readonly onDownload: VortexReceiptDownloadButtonProps["onDownload"] | undefined;
  readonly onDownloadLaunch: VortexReceiptDownloadButtonProps["onDownloadLaunch"] | undefined;
  readonly runtime: VortexSurfaceProviderRuntime;
  readonly selectedNavigate: (launch: VortexSurfaceLaunch) => void;
}) {
  return (): void => {
    if (!canDownload) {
      return;
    }
    if (artifact.portalToken === undefined) {
      void onDownload?.(artifact);
      return;
    }
    const launch = createReceiptHostedLaunch(runtime, artifact);
    onDownloadLaunch?.(artifact, launch);
    selectedNavigate(launch);
  };
}

function createReceiptHostedLaunch(
  runtime: VortexSurfaceProviderRuntime,
  artifact: VortexReceiptDownloadButtonArtifact,
) {
  return runtime.createHostedLink({
    surface: "invoice_receipt_center",
    token: artifact.portalToken ?? "",
    query: {
      view: artifact.kind === "receipt" ? "receipts" : "invoices",
      artifact_id: artifact.id,
      receipt_id: artifact.receiptId,
      invoice_id: artifact.invoiceId,
      download: true,
      return_to: artifact.portalReturnPath,
    },
  });
}

export function VortexBillingStatusBanner({
  billingStatus,
  appearance,
  classNames,
  copy,
  loading,
  error,
  disabled,
  readOnly,
  navigate,
  onPortalLaunch,
  onRecoveryLaunch,
  onAction,
  onReady,
  onError,
  className,
}: VortexBillingStatusBannerProps): ReactNode {
  const { runtime, navigate: contextNavigate } = useVortexPayments();
  const selectedNavigate = navigate ?? contextNavigate;
  const resolvedCopy = resolveBillingStatusBannerCopy(copy);
  const isDisabled = disabled === true || readOnly === true || loading === true;
  const canOpenPortal =
    billingStatus.action === "open_portal" && billingStatus.portalToken !== undefined;
  const canOpenRecovery =
    billingStatus.action === "open_recovery" && billingStatus.recoveryToken !== undefined;
  const canRunCustomAction = billingStatus.action === "custom";

  useEffect(() => {
    onReady?.({
      component: "VortexBillingStatusBanner",
      surface: "billing_status_banner",
    });
  }, [onReady]);

  useEffect(() => {
    if (error !== undefined) {
      onError?.({
        component: "VortexBillingStatusBanner",
        surface: "billing_status_banner",
        error,
      });
    }
  }, [error, onError]);

  const runPrimaryAction = (): void => {
    if (canOpenPortal && billingStatus.portalToken !== undefined) {
      const launch = runtime.createHostedLink({
        surface: "customer_portal",
        token: billingStatus.portalToken,
        query: { view: "billing_status" },
      });
      onPortalLaunch?.(launch);
      selectedNavigate(launch);
      return;
    }
    if (canOpenRecovery && billingStatus.recoveryToken !== undefined) {
      const launch = runtime.createHostedLink({
        surface: "payment_recovery",
        token: billingStatus.recoveryToken,
        query: { view: "payment_recovery" },
      });
      onRecoveryLaunch?.(launch);
      selectedNavigate(launch);
      return;
    }
    if (canRunCustomAction) {
      void onAction?.(billingStatus);
    }
  };

  return createElement(
    "section",
    {
      className: cx("vortex-payments-billing-status-banner", className, classNames?.root),
      "data-vortex-surface": "billing-status-banner",
      "data-vortex-component": "VortexBillingStatusBanner",
      "data-vortex-customer-id": billingStatus.customerId,
      "data-vortex-billing-account-id": billingStatus.billingAccountId,
      "data-vortex-subscription-id": billingStatus.subscriptionId,
      "data-vortex-billing-status": billingStatus.status,
      "data-vortex-billing-severity": billingStatus.severity,
      "data-vortex-billing-action": billingStatus.action,
      "data-vortex-customer-portal-ready": String(canOpenPortal),
      "data-vortex-recovery-ready": String(canOpenRecovery),
      "data-vortex-appearance-color-scheme": appearance?.colorScheme ?? "system",
      "data-vortex-appearance-density": appearance?.density ?? "comfortable",
      "data-vortex-appearance-radius": appearance?.radius ?? "md",
      style:
        appearance?.accentColor === undefined
          ? undefined
          : ({ "--vortex-payments-accent-color": appearance.accentColor } as Record<
              string,
              string
            >),
    },
    createElement(
      "header",
      { className: classNames?.header },
      createElement("h2", { className: classNames?.title }, billingStatus.title),
      billingStatus.description === undefined
        ? null
        : createElement("p", { className: classNames?.description }, billingStatus.description),
    ),
    loading === true
      ? createElement(
          "div",
          { className: classNames?.loading, role: "status" },
          resolvedCopy.loadingTitle,
        )
      : null,
    error === undefined
      ? null
      : createElement(
          "div",
          { className: classNames?.error, role: "alert" },
          resolvedCopy.errorTitle,
          error,
        ),
    createElement(
      "dl",
      { className: classNames?.metrics },
      createMetric(resolvedCopy.statusLabel, billingStatus.status, classNames),
      createMetric(resolvedCopy.planLabel, billingStatus.planLabel ?? "none", classNames),
      createMetric(
        resolvedCopy.amountDueLabel,
        billingStatus.amountDue === undefined || billingStatus.currency === undefined
          ? "none"
          : formatMinorUnitAmount(billingStatus.amountDue, billingStatus.currency),
        classNames,
      ),
      createMetric(resolvedCopy.nextActionLabel, billingStatus.nextAction ?? "none", classNames),
    ),
    createElement(
      "div",
      { className: classNames?.actions },
      createElement(
        "button",
        {
          className: classNames?.button,
          disabled: isDisabled || (!canOpenPortal && !canOpenRecovery && !canRunCustomAction),
          onClick: runPrimaryAction,
          type: "button",
          "data-vortex-billing-status-action": billingStatus.action,
        },
        billingStatusActionLabel(billingStatus.action, resolvedCopy),
      ),
    ),
  );
}

export function VortexSubscriptionActionSummary({
  subscription,
  appearance,
  classNames,
  copy,
  loading,
  error,
  disabled,
  readOnly,
  navigate,
  onPortalLaunch,
  onAction,
  onReady,
  onError,
  className,
}: VortexSubscriptionActionSummaryProps): ReactNode {
  const { runtime, navigate: contextNavigate } = useVortexPayments();
  const selectedNavigate = navigate ?? contextNavigate;
  const resolvedCopy = resolveSubscriptionActionSummaryCopy(copy);
  const isDisabled = disabled === true || readOnly === true || loading === true;
  const canOpenPortal = subscription.action !== "custom" && subscription.portalToken !== undefined;
  const canRunCustomAction = subscription.action === "custom";
  const actionDisabledReason = subscription.actionDisabledReason;

  useEffect(() => {
    onReady?.({
      component: "VortexSubscriptionActionSummary",
      surface: "subscription_action_summary",
    });
  }, [onReady]);

  useEffect(() => {
    if (error !== undefined) {
      onError?.({
        component: "VortexSubscriptionActionSummary",
        surface: "subscription_action_summary",
        error,
      });
    }
  }, [error, onError]);

  const runPrimaryAction = (): void => {
    if (canOpenPortal && subscription.portalToken !== undefined) {
      const launch = runtime.createHostedLink({
        surface: "customer_portal",
        token: subscription.portalToken,
        query: subscriptionActionPortalQuery(subscription.action),
      });
      onPortalLaunch?.(launch);
      selectedNavigate(launch);
      return;
    }
    if (canRunCustomAction) {
      void onAction?.(subscription);
    }
  };

  return createElement(
    "section",
    {
      className: cx("vortex-payments-subscription-action-summary", className, classNames?.root),
      "data-vortex-surface": "subscription-action-summary",
      "data-vortex-component": "VortexSubscriptionActionSummary",
      "data-vortex-customer-id": subscription.customerId,
      "data-vortex-billing-account-id": subscription.billingAccountId,
      "data-vortex-subscription-id": subscription.subscriptionId,
      "data-vortex-subscription-status": subscription.status,
      "data-vortex-subscription-action": subscription.action,
      "data-vortex-customer-portal-ready": String(canOpenPortal),
      "data-vortex-appearance-color-scheme": appearance?.colorScheme ?? "system",
      "data-vortex-appearance-density": appearance?.density ?? "comfortable",
      "data-vortex-appearance-radius": appearance?.radius ?? "md",
      style:
        appearance?.accentColor === undefined
          ? undefined
          : ({ "--vortex-payments-accent-color": appearance.accentColor } as Record<
              string,
              string
            >),
    },
    createElement(
      "header",
      { className: classNames?.header },
      createElement(
        "h2",
        { className: classNames?.title },
        subscription.title ?? resolvedCopy.title,
      ),
      subscription.description === undefined
        ? createElement(
            "p",
            { className: classNames?.description },
            subscriptionActionDescription(subscription, resolvedCopy),
          )
        : createElement("p", { className: classNames?.description }, subscription.description),
    ),
    loading === true
      ? createElement(
          "div",
          { className: classNames?.loading, role: "status" },
          resolvedCopy.loadingTitle,
        )
      : null,
    error === undefined
      ? null
      : createElement(
          "div",
          { className: classNames?.error, role: "alert" },
          resolvedCopy.errorTitle,
          error,
        ),
    actionDisabledReason === undefined
      ? null
      : createElement(
          "p",
          {
            className: classNames?.status,
            "data-vortex-subscription-action-disabled-reason": true,
          },
          actionDisabledReason,
        ),
    createElement(
      "dl",
      { className: classNames?.metrics },
      createMetric(resolvedCopy.statusLabel, subscription.status, classNames),
      createMetric(resolvedCopy.planLabel, subscription.planLabel ?? "none", classNames),
      createMetric(resolvedCopy.cadenceLabel, subscription.cadenceLabel ?? "none", classNames),
      createMetric(resolvedCopy.renewalLabel, subscription.renewalAt ?? "none", classNames),
      createMetric(resolvedCopy.trialLabel, subscription.trialEndsAt ?? "none", classNames),
      createMetric(
        resolvedCopy.scheduledCancelLabel,
        subscription.scheduledCancelAt ?? "none",
        classNames,
      ),
      createMetric(resolvedCopy.pausedUntilLabel, subscription.pausedUntil ?? "none", classNames),
      createMetric(
        resolvedCopy.amountDueLabel,
        subscription.amountDue === undefined || subscription.currency === undefined
          ? "none"
          : formatMinorUnitAmount(subscription.amountDue, subscription.currency),
        classNames,
      ),
      createMetric(resolvedCopy.nextActionLabel, subscription.nextAction ?? "none", classNames),
    ),
    createElement(
      "div",
      { className: classNames?.actions },
      createElement(
        "button",
        {
          className: classNames?.button,
          disabled:
            isDisabled ||
            actionDisabledReason !== undefined ||
            (!canOpenPortal && !canRunCustomAction),
          onClick: runPrimaryAction,
          type: "button",
          "data-vortex-subscription-action-summary-action": subscription.action,
        },
        subscriptionActionLabel(subscription.action, resolvedCopy),
      ),
    ),
  );
}

export function VortexPaymentMethodSummary({
  paymentMethod,
  appearance,
  classNames,
  copy,
  loading,
  error,
  disabled,
  readOnly,
  navigate,
  onPaymentMethodsLaunch,
  onAction,
  onReady,
  onError,
  className,
}: VortexPaymentMethodSummaryProps): ReactNode {
  const { runtime, navigate: contextNavigate } = useVortexPayments();
  const selectedNavigate = navigate ?? contextNavigate;
  const resolvedCopy = resolvePaymentMethodSummaryCopy(copy);
  const isDisabled = disabled === true || readOnly === true || loading === true;
  const canOpenPaymentMethods =
    paymentMethod.action !== "custom" && paymentMethod.portalToken !== undefined;
  const canRunCustomAction = paymentMethod.action === "custom";
  const actionDisabledReason = paymentMethod.actionDisabledReason;

  useEffect(() => {
    onReady?.({
      component: "VortexPaymentMethodSummary",
      surface: "payment_method_summary",
    });
  }, [onReady]);

  useEffect(() => {
    if (error !== undefined) {
      onError?.({
        component: "VortexPaymentMethodSummary",
        surface: "payment_method_summary",
        error,
      });
    }
  }, [error, onError]);

  const runPrimaryAction = (): void => {
    if (canOpenPaymentMethods && paymentMethod.portalToken !== undefined) {
      const launch = runtime.createHostedLink({
        surface: "payment_methods",
        token: paymentMethod.portalToken,
        query: paymentMethodSummaryPortalQuery(paymentMethod.action),
      });
      onPaymentMethodsLaunch?.(launch);
      selectedNavigate(launch);
      return;
    }
    if (canRunCustomAction) {
      void onAction?.(paymentMethod);
    }
  };

  return createElement(
    "section",
    {
      className: cx("vortex-payments-payment-method-summary", className, classNames?.root),
      "data-vortex-surface": "payment-method-summary",
      "data-vortex-component": "VortexPaymentMethodSummary",
      "data-vortex-customer-id": paymentMethod.customerId,
      "data-vortex-billing-account-id": paymentMethod.billingAccountId,
      "data-vortex-payment-method-id": paymentMethod.paymentMethodId,
      "data-vortex-payment-method-status": paymentMethod.status,
      "data-vortex-payment-method-kind": paymentMethod.kind,
      "data-vortex-payment-method-action": paymentMethod.action,
      "data-vortex-payment-methods-ready": String(canOpenPaymentMethods),
      "data-vortex-appearance-color-scheme": appearance?.colorScheme ?? "system",
      "data-vortex-appearance-density": appearance?.density ?? "comfortable",
      "data-vortex-appearance-radius": appearance?.radius ?? "md",
      style:
        appearance?.accentColor === undefined
          ? undefined
          : ({ "--vortex-payments-accent-color": appearance.accentColor } as Record<
              string,
              string
            >),
    },
    createElement(
      "header",
      { className: classNames?.header },
      createElement(
        "h2",
        { className: classNames?.title },
        paymentMethod.title ?? resolvedCopy.title,
      ),
      paymentMethod.description === undefined
        ? createElement(
            "p",
            { className: classNames?.description },
            paymentMethodSummaryDescription(paymentMethod, resolvedCopy),
          )
        : createElement("p", { className: classNames?.description }, paymentMethod.description),
    ),
    loading === true
      ? createElement(
          "div",
          { className: classNames?.loading, role: "status" },
          resolvedCopy.loadingTitle,
        )
      : null,
    error === undefined
      ? null
      : createElement(
          "div",
          { className: classNames?.error, role: "alert" },
          resolvedCopy.errorTitle,
          error,
        ),
    actionDisabledReason === undefined
      ? null
      : createElement(
          "p",
          {
            className: classNames?.status,
            "data-vortex-payment-method-action-disabled-reason": true,
          },
          actionDisabledReason,
        ),
    createElement(
      "dl",
      { className: classNames?.metrics },
      createMetric(resolvedCopy.statusLabel, paymentMethod.status, classNames),
      createMetric(resolvedCopy.kindLabel, paymentMethod.kind, classNames),
      createMetric(resolvedCopy.methodLabel, paymentMethodLabel(paymentMethod), classNames),
      createMetric(resolvedCopy.expiryLabel, paymentMethod.expiryLabel ?? "none", classNames),
      createMetric(resolvedCopy.bankLabel, paymentMethod.bankLabel ?? "none", classNames),
      createMetric(
        resolvedCopy.accountTypeLabel,
        paymentMethod.accountTypeLabel ?? "none",
        classNames,
      ),
      createMetric(resolvedCopy.readinessLabel, paymentMethod.readinessLabel ?? "none", classNames),
      createMetric(resolvedCopy.nextActionLabel, paymentMethod.nextAction ?? "none", classNames),
    ),
    createElement(
      "div",
      { className: classNames?.actions },
      createElement(
        "button",
        {
          className: classNames?.button,
          disabled:
            isDisabled ||
            actionDisabledReason !== undefined ||
            (!canOpenPaymentMethods && !canRunCustomAction),
          onClick: runPrimaryAction,
          type: "button",
          "data-vortex-payment-method-summary-action": paymentMethod.action,
        },
        paymentMethodActionLabel(paymentMethod.action, resolvedCopy),
      ),
    ),
  );
}

export function VortexMerchantActionQueue({
  merchantState,
  actions,
  appearance,
  classNames,
  copy,
  loading,
  error,
  disabled,
  readOnly,
  navigate,
  onActionLaunch,
  onAction,
  onReady,
  onError,
  className,
}: VortexMerchantActionQueueProps): ReactNode {
  const { runtime, navigate: contextNavigate } = useVortexPayments();
  const resolvedActions = actions ?? deriveMerchantActions(merchantState);
  const selectedNavigate = navigate ?? contextNavigate;
  const isDisabled = disabled === true || readOnly === true;
  const resolvedCopy = resolveMerchantActionQueueCopy(copy);

  useEffect(() => {
    onReady?.({
      component: "VortexMerchantActionQueue",
      surface: "merchant_action_queue",
      merchantAccountId: merchantState.merchantAccountId,
    });
  }, [merchantState.merchantAccountId, onReady]);

  useEffect(() => {
    if (error !== undefined) {
      onError?.({
        component: "VortexMerchantActionQueue",
        surface: "merchant_action_queue",
        error,
      });
    }
  }, [error, onError]);

  return createElement(
    "section",
    {
      className: cx("vortex-payments-merchant-action-queue", className, classNames?.root),
      "data-vortex-surface": "merchant-action-queue",
      "data-vortex-component": "VortexMerchantActionQueue",
      "data-vortex-merchant-status": merchantState.merchantStatus,
      "data-vortex-can-accept-payments": String(merchantState.canAcceptPayments),
      "data-vortex-appearance-color-scheme": appearance?.colorScheme ?? "system",
      "data-vortex-appearance-density": appearance?.density ?? "comfortable",
      "data-vortex-appearance-radius": appearance?.radius ?? "md",
      style:
        appearance?.accentColor === undefined
          ? undefined
          : ({ "--vortex-payments-accent-color": appearance.accentColor } as Record<
              string,
              string
            >),
    },
    createElement(
      "header",
      { className: classNames?.header },
      createElement("h2", { className: classNames?.title }, resolvedCopy.title),
      createElement(
        "p",
        { className: classNames?.description },
        merchantState.canAcceptPayments
          ? resolvedCopy.readyDescription
          : resolvedCopy.blockedDescription,
      ),
    ),
    loading === true
      ? createElement(
          "div",
          { className: classNames?.loading, role: "status" },
          resolvedCopy.loadingTitle,
        )
      : null,
    error === undefined
      ? null
      : createElement(
          "div",
          { className: classNames?.error, role: "alert" },
          resolvedCopy.errorTitle,
          error,
        ),
    createElement(
      "dl",
      { className: classNames?.metrics },
      createMetric(resolvedCopy.statusLabel, merchantState.merchantStatus, classNames),
      createMetric(
        resolvedCopy.onboardingLabel,
        merchantState.onboardingStatus ?? "not_started",
        classNames,
      ),
      createMetric(
        resolvedCopy.paymentCollectionLabel,
        merchantState.canAcceptPayments ? "ready" : "blocked",
        classNames,
      ),
      createMetric(resolvedCopy.payoutsLabel, merchantState.payoutReadiness, classNames),
    ),
    loading === true || error !== undefined
      ? null
      : resolvedActions.length === 0
        ? createElement(
            "div",
            { className: classNames?.empty, role: "status" },
            createElement("p", null, resolvedCopy.emptyTitle),
            createElement("p", null, resolvedCopy.emptyDescription),
          )
        : createElement(
            "ul",
            { className: classNames?.list },
            resolvedActions.map((action) =>
              createElement(
                "li",
                {
                  key: action.id,
                  className: classNames?.item,
                  "data-vortex-action-kind": action.kind,
                  "data-vortex-action-severity": action.severity,
                  "data-vortex-action-status": action.status,
                },
                createElement("strong", { className: classNames?.itemTitle }, action.title),
                action.description === undefined
                  ? null
                  : createElement(
                      "p",
                      { className: classNames?.itemDescription },
                      action.description,
                    ),
                createElement("span", { className: classNames?.status }, action.status),
                createElement(
                  "div",
                  { className: classNames?.actions },
                  action.primaryAction === undefined
                    ? null
                    : createElement(
                        "button",
                        {
                          className: classNames?.button,
                          type: "button",
                          disabled: isDisabled,
                          onClick: () => {
                            const launch = runtime.createHostedLink(
                              action.primaryAction as VortexHostedSurfaceRequest,
                            );
                            onAction?.(action);
                            onActionLaunch?.(action, launch);
                            selectedNavigate(launch);
                          },
                        },
                        action.primaryActionLabel ?? "Open action",
                      ),
                  action.secondaryAction === undefined
                    ? null
                    : createElement(
                        "button",
                        {
                          className: classNames?.button,
                          type: "button",
                          disabled: isDisabled,
                          onClick: () => {
                            const launch = runtime.createHostedLink(
                              action.secondaryAction as VortexHostedSurfaceRequest,
                            );
                            onAction?.(action);
                            onActionLaunch?.(action, launch);
                            selectedNavigate(launch);
                          },
                        },
                        action.secondaryActionLabel ?? "View details",
                      ),
                ),
              ),
            ),
          ),
  );
}

export function VortexMerchantAccountPanel({
  merchantAccount,
  merchantState,
  appearance,
  classNames,
  copy,
  loading,
  error,
  disabled,
  readOnly,
  navigate,
  onActionLaunch,
  onAction,
  onReady,
  onError,
  className,
}: VortexMerchantAccountPanelProps): ReactNode {
  const { runtime, navigate: contextNavigate } = useVortexPayments();
  const selectedNavigate = navigate ?? contextNavigate;
  const isDisabled = disabled === true || readOnly === true;
  const resolvedCopy = resolveMerchantAccountPanelCopy(copy);
  const canAcceptPayments = merchantState?.canAcceptPayments ?? false;
  const payoutReadiness = merchantState?.payoutReadiness ?? "unknown";
  const openRequirementCount = merchantState?.openRequirementIds.length ?? 0;
  const activeCapabilities = merchantState?.activeCapabilityKeys ?? [];
  const restrictedCapabilities = merchantState?.restrictedCapabilityKeys ?? [];

  useEffect(() => {
    onReady?.({
      component: "VortexMerchantAccountPanel",
      surface: "merchant_account_panel",
      merchantAccountId: merchantAccount.id,
    });
  }, [merchantAccount.id, onReady]);

  useEffect(() => {
    if (error !== undefined) {
      onError?.({
        component: "VortexMerchantAccountPanel",
        surface: "merchant_account_panel",
        error,
      });
    }
  }, [error, onError]);

  const launchAction = (
    action: VortexMerchantAccountPanelAction,
    request: VortexHostedSurfaceRequest,
  ): void => {
    const launch = runtime.createHostedLink(request);
    onAction?.(action);
    onActionLaunch?.(action, launch);
    selectedNavigate(launch);
  };

  return createElement(
    "section",
    {
      className: cx("vortex-payments-merchant-account-panel", className, classNames?.root),
      "data-vortex-surface": "merchant-account-panel",
      "data-vortex-component": "VortexMerchantAccountPanel",
      "data-vortex-merchant-account-id": merchantAccount.id,
      "data-vortex-merchant-status": merchantState?.merchantStatus ?? merchantAccount.status,
      "data-vortex-can-accept-payments": String(canAcceptPayments),
      "data-vortex-payout-readiness": payoutReadiness,
      "data-vortex-appearance-color-scheme": appearance?.colorScheme ?? "system",
      "data-vortex-appearance-density": appearance?.density ?? "comfortable",
      "data-vortex-appearance-radius": appearance?.radius ?? "md",
      style:
        appearance?.accentColor === undefined
          ? undefined
          : ({ "--vortex-payments-accent-color": appearance.accentColor } as Record<
              string,
              string
            >),
    },
    createElement(
      "header",
      { className: classNames?.header },
      createElement("h2", { className: classNames?.title }, resolvedCopy.title),
      createElement(
        "p",
        { className: classNames?.description },
        canAcceptPayments ? resolvedCopy.readyDescription : resolvedCopy.blockedDescription,
      ),
    ),
    loading === true
      ? createElement(
          "div",
          { className: classNames?.loading, role: "status" },
          resolvedCopy.loadingTitle,
        )
      : null,
    error === undefined
      ? null
      : createElement(
          "div",
          { className: classNames?.error, role: "alert" },
          resolvedCopy.errorTitle,
          error,
        ),
    merchantState === undefined
      ? createElement(
          "div",
          { className: classNames?.empty, role: "status" },
          createElement("p", null, resolvedCopy.stateUnavailableTitle),
          createElement("p", null, resolvedCopy.stateUnavailableDescription),
        )
      : null,
    createElement(
      "dl",
      { className: classNames?.metrics },
      createMetric(resolvedCopy.businessLabel, merchantAccount.displayName, classNames),
      createMetric(resolvedCopy.merchantModeLabel, merchantAccount.merchantMode, classNames),
      createMetric(
        resolvedCopy.merchantStatusLabel,
        merchantState?.merchantStatus ?? merchantAccount.status,
        classNames,
      ),
      createMetric(
        resolvedCopy.paymentCollectionLabel,
        canAcceptPayments ? "ready" : "blocked",
        classNames,
      ),
      createMetric(resolvedCopy.payoutReadinessLabel, payoutReadiness, classNames),
      createMetric(resolvedCopy.defaultCurrencyLabel, merchantAccount.defaultCurrency, classNames),
      createMetric(
        resolvedCopy.activeCapabilitiesLabel,
        String(activeCapabilities.length),
        classNames,
      ),
      createMetric(
        resolvedCopy.restrictedCapabilitiesLabel,
        String(restrictedCapabilities.length),
        classNames,
      ),
      createMetric(resolvedCopy.openRequirementsLabel, String(openRequirementCount), classNames),
    ),
    createElement(
      "ul",
      { className: classNames?.list },
      createMerchantAccountListItem(
        resolvedCopy.activeCapabilitiesLabel,
        activeCapabilities.length === 0 ? "none" : activeCapabilities.join(", "),
        "active-capabilities",
        classNames,
      ),
      createMerchantAccountListItem(
        resolvedCopy.restrictedCapabilitiesLabel,
        restrictedCapabilities.length === 0 ? "none" : restrictedCapabilities.join(", "),
        "restricted-capabilities",
        classNames,
      ),
      createMerchantAccountListItem(
        "Account type",
        `${merchantAccount.legalEntityType} / ${merchantAccount.country}`,
        "account-type",
        classNames,
      ),
    ),
    createElement(
      "div",
      { className: classNames?.actions },
      merchantState?.onboardingSessionId === undefined
        ? null
        : createElement(
            "button",
            {
              className: classNames?.button,
              type: "button",
              disabled: isDisabled,
              onClick: () => {
                launchAction("open_onboarding", {
                  surface: "merchant_onboarding",
                  token: merchantState.onboardingSessionId as string,
                });
              },
            },
            resolvedCopy.openOnboardingLabel,
          ),
      createElement(
        "button",
        {
          className: classNames?.button,
          type: "button",
          disabled: isDisabled,
          onClick: () => {
            launchAction("open_actions", {
              surface: "merchant_action_queue",
              id: merchantAccount.id,
            });
          },
        },
        resolvedCopy.openActionsLabel,
      ),
      createElement(
        "button",
        {
          className: classNames?.button,
          type: "button",
          disabled: isDisabled,
          onClick: () => {
            launchAction("open_payout_readiness", {
              surface: "payout_readiness",
              id: merchantAccount.id,
            });
          },
        },
        resolvedCopy.openPayoutReadinessLabel,
      ),
    ),
  );
}

export function VortexPayoutReadinessPanel({
  merchantState,
  payoutProfile,
  settlementReadiness,
  appearance,
  classNames,
  copy,
  loading,
  error,
  disabled,
  readOnly,
  navigate,
  onActionLaunch,
  onAction,
  onReady,
  onError,
  className,
}: VortexPayoutReadinessPanelProps): ReactNode {
  const { runtime, navigate: contextNavigate } = useVortexPayments();
  const selectedNavigate = navigate ?? contextNavigate;
  const isDisabled = disabled === true || readOnly === true;
  const resolvedCopy = resolvePayoutReadinessPanelCopy(copy);
  const payoutReadiness = merchantState.payoutReadiness;
  const capabilityCount = payoutProfile?.capabilities.length ?? 0;
  const enabledCapabilityCount =
    payoutProfile?.capabilities.filter((capability) => capability.status === "enabled").length ?? 0;
  const blocked = payoutReadiness === "blocked" || payoutReadiness === "paused";

  useEffect(() => {
    onReady?.({
      component: "VortexPayoutReadinessPanel",
      surface: "payout_readiness",
      merchantAccountId: merchantState.merchantAccountId,
    });
  }, [merchantState.merchantAccountId, onReady]);

  useEffect(() => {
    if (error !== undefined) {
      onError?.({
        component: "VortexPayoutReadinessPanel",
        surface: "payout_readiness",
        error,
      });
    }
  }, [error, onError]);

  const launchAction = (
    action: VortexPayoutReadinessPanelAction,
    request: VortexHostedSurfaceRequest,
  ): void => {
    const launch = runtime.createHostedLink(request);
    onAction?.(action);
    onActionLaunch?.(action, launch);
    selectedNavigate(launch);
  };

  return createElement(
    "section",
    {
      className: cx("vortex-payments-payout-readiness-panel", className, classNames?.root),
      "data-vortex-surface": "payout-readiness",
      "data-vortex-component": "VortexPayoutReadinessPanel",
      "data-vortex-merchant-account-id": merchantState.merchantAccountId,
      "data-vortex-payout-readiness": payoutReadiness,
      "data-vortex-payout-rail": payoutProfile?.payoutRail ?? "unknown",
      "data-vortex-payout-schedule": payoutProfile?.payoutSchedule ?? "unknown",
      "data-vortex-appearance-color-scheme": appearance?.colorScheme ?? "system",
      "data-vortex-appearance-density": appearance?.density ?? "comfortable",
      "data-vortex-appearance-radius": appearance?.radius ?? "md",
      style:
        appearance?.accentColor === undefined
          ? undefined
          : ({ "--vortex-payments-accent-color": appearance.accentColor } as Record<
              string,
              string
            >),
    },
    createElement(
      "header",
      { className: classNames?.header },
      createElement("h2", { className: classNames?.title }, resolvedCopy.title),
      createElement(
        "p",
        { className: classNames?.description },
        blocked ? resolvedCopy.blockedDescription : resolvedCopy.readyDescription,
      ),
    ),
    loading === true
      ? createElement(
          "div",
          { className: classNames?.loading, role: "status" },
          resolvedCopy.loadingTitle,
        )
      : null,
    error === undefined
      ? null
      : createElement(
          "div",
          { className: classNames?.error, role: "alert" },
          resolvedCopy.errorTitle,
          error,
        ),
    payoutProfile === undefined
      ? createElement(
          "div",
          { className: classNames?.empty, role: "status" },
          createElement("p", null, resolvedCopy.profileUnavailableTitle),
          createElement("p", null, resolvedCopy.profileUnavailableDescription),
        )
      : null,
    createElement(
      "dl",
      { className: classNames?.metrics },
      createMetric(resolvedCopy.payoutReadinessLabel, payoutReadiness, classNames),
      createMetric(resolvedCopy.payoutModeLabel, payoutProfile?.mode ?? "unknown", classNames),
      createMetric(
        resolvedCopy.payoutRailLabel,
        payoutProfile?.payoutRail ?? "unknown",
        classNames,
      ),
      createMetric(
        resolvedCopy.payoutScheduleLabel,
        payoutProfile?.payoutSchedule ?? "unknown",
        classNames,
      ),
      createMetric(resolvedCopy.currencyLabel, payoutProfile?.currency ?? "unknown", classNames),
      createMetric(
        resolvedCopy.fundingRequirementLabel,
        payoutProfile?.fundingRequirement ?? "standard",
        classNames,
      ),
      createMetric(
        resolvedCopy.latestSettlementLabel,
        merchantState.latestSettlementStatus ?? "unknown",
        classNames,
      ),
      createMetric(
        resolvedCopy.latestPayoutLabel,
        merchantState.latestPayoutStatus ?? "unknown",
        classNames,
      ),
      createMetric(
        resolvedCopy.settlementReadinessLabel,
        settlementReadiness?.status ?? "unknown",
        classNames,
      ),
      createMetric(
        resolvedCopy.nextActionLabel,
        settlementReadiness?.nextAction ?? merchantState.payoutBlockReason ?? "monitor",
        classNames,
      ),
      createMetric(
        resolvedCopy.capabilitiesLabel,
        `${enabledCapabilityCount}/${capabilityCount} enabled`,
        classNames,
      ),
    ),
    createElement(
      "ul",
      { className: classNames?.list },
      (payoutProfile?.capabilities ?? []).map((capability) =>
        createPayoutCapabilityItem(
          capability.key,
          capability.reason,
          capability.status,
          classNames,
        ),
      ),
      settlementReadiness === null || settlementReadiness?.blockers.length === 0
        ? null
        : createPayoutCapabilityItem(
            "settlement_blockers",
            settlementReadiness?.blockers.join(", ") ??
              "No settlement readiness snapshot was provided.",
            settlementReadiness === undefined ? "unknown" : "disabled",
            classNames,
          ),
    ),
    createElement(
      "div",
      { className: classNames?.actions },
      createElement(
        "button",
        {
          className: classNames?.button,
          type: "button",
          disabled: isDisabled,
          onClick: () => {
            launchAction("open_merchant_account", {
              surface: "merchant_account_panel",
              id: merchantState.merchantAccountId,
            });
          },
        },
        resolvedCopy.openMerchantAccountLabel,
      ),
      createElement(
        "button",
        {
          className: classNames?.button,
          type: "button",
          disabled: isDisabled,
          onClick: () => {
            launchAction("open_actions", {
              surface: "merchant_action_queue",
              id: merchantState.merchantAccountId,
            });
          },
        },
        resolvedCopy.openActionsLabel,
      ),
    ),
  );
}

export function VortexFeePolicyPanel({
  feePolicy,
  appearance,
  classNames,
  copy,
  loading,
  error,
  disabled,
  readOnly,
  onPolicyChange,
  onReady,
  onError,
  className,
}: VortexFeePolicyPanelProps): ReactNode {
  const resolvedCopy = resolveFeePolicyPanelCopy(copy);
  const isDisabled = disabled === true || readOnly === true || loading === true;

  useEffect(() => {
    onReady?.({
      component: "VortexFeePolicyPanel",
      surface: "fee_policy_panel",
      merchantAccountId: feePolicy.merchantAccountId,
    });
  }, [feePolicy.merchantAccountId, onReady]);

  useEffect(() => {
    if (error !== undefined) {
      onError?.({
        component: "VortexFeePolicyPanel",
        surface: "fee_policy_panel",
        error,
      });
    }
  }, [error, onError]);

  const changePolicy = (event: ChangeEvent<HTMLInputElement>): void => {
    const ownerMode = event.currentTarget.value as VortexFeePolicyOwnerMode;
    void onPolicyChange?.(ownerMode, feePolicy);
  };

  return createElement(
    "section",
    {
      className: cx("vortex-payments-fee-policy-panel", className, classNames?.root),
      "data-vortex-surface": "fee-policy-panel",
      "data-vortex-component": "VortexFeePolicyPanel",
      "data-vortex-merchant-account-id": feePolicy.merchantAccountId,
      "data-vortex-fee-policy-owner-mode": feePolicy.ownerMode,
      "data-vortex-appearance-color-scheme": appearance?.colorScheme ?? "system",
      "data-vortex-appearance-density": appearance?.density ?? "comfortable",
      "data-vortex-appearance-radius": appearance?.radius ?? "md",
      style:
        appearance?.accentColor === undefined
          ? undefined
          : ({ "--vortex-payments-accent-color": appearance.accentColor } as Record<
              string,
              string
            >),
    },
    createElement(
      "header",
      { className: classNames?.header },
      createElement("h2", { className: classNames?.title }, resolvedCopy.title),
      createElement("p", { className: classNames?.description }, resolvedCopy.description),
    ),
    loading === true
      ? createElement(
          "div",
          { className: classNames?.loading, role: "status" },
          resolvedCopy.loadingTitle,
        )
      : null,
    error === undefined
      ? null
      : createElement(
          "div",
          { className: classNames?.error, role: "alert" },
          resolvedCopy.errorTitle,
          error,
        ),
    createElement(
      "dl",
      { className: classNames?.metrics },
      createMetric(resolvedCopy.ownerModeLabel, feePolicy.ownerMode, classNames),
      createMetric(resolvedCopy.platformFeeLabel, feePolicy.platformFeeLabel ?? "none", classNames),
      createMetric(resolvedCopy.settlementLabel, feePolicy.settlementLabel ?? "none", classNames),
    ),
    createElement(
      "fieldset",
      {
        className: classNames?.list,
        disabled: isDisabled,
      },
      createElement("legend", { className: classNames?.status }, resolvedCopy.policyOptionsLabel),
      feePolicy.options.map((option) =>
        createElement(
          "label",
          {
            key: option.ownerMode,
            className: classNames?.item,
            "data-vortex-fee-policy-option": option.ownerMode,
            "data-vortex-fee-policy-option-selected": String(
              option.ownerMode === feePolicy.ownerMode,
            ),
          },
          createElement("input", {
            checked: option.ownerMode === feePolicy.ownerMode,
            disabled: isDisabled || option.disabled === true,
            name: `vortex-fee-policy-${feePolicy.merchantAccountId}`,
            onChange: changePolicy,
            type: "radio",
            value: option.ownerMode,
          }),
          createElement("strong", { className: classNames?.itemTitle }, option.title),
          option.description === undefined
            ? null
            : createElement("p", { className: classNames?.itemDescription }, option.description),
        ),
      ),
    ),
    feePolicy.note === undefined
      ? null
      : createElement(
          "p",
          { className: classNames?.status, "data-vortex-fee-policy-note": true },
          feePolicy.note,
        ),
  );
}

function defaultNavigate(launch: VortexSurfaceLaunch): void {
  if (typeof window === "undefined") {
    return;
  }
  window.location.assign(launch.url);
}

function openInNewTab(launch: VortexSurfaceLaunch): void {
  if (typeof window === "undefined") {
    return;
  }
  window.open(launch.url, "_blank", "noopener,noreferrer");
}

function createMetric(
  label: ReactNode,
  value: ReactNode,
  classNames: VortexEmbeddedComponentClassNames | undefined,
): ReactNode {
  return [
    createElement(
      "dt",
      { key: `${String(label)}:label`, className: classNames?.metricLabel },
      label,
    ),
    createElement(
      "dd",
      { key: `${String(label)}:value`, className: classNames?.metricValue },
      value,
    ),
  ];
}

function formatMinorUnitAmount(amount: number, currency: string): string {
  return `${currency} ${(amount / 100).toFixed(2)}`;
}

function resolveEmbeddedCheckoutCopy(
  copy: VortexEmbeddedCheckoutCopy | undefined,
): Required<VortexEmbeddedCheckoutCopy> {
  return {
    title: copy?.title ?? "Checkout",
    readyDescription:
      copy?.readyDescription ?? "Complete payment with a Vortex-secured payment method.",
    paidDescription: copy?.paidDescription ?? "This payment request is paid.",
    blockedDescription: copy?.blockedDescription ?? "This checkout is not currently collectible.",
    loadingTitle: copy?.loadingTitle ?? "Loading checkout...",
    errorTitle: copy?.errorTitle ?? "Unable to complete checkout.",
    emptyTitle: copy?.emptyTitle ?? "No line items were provided.",
    emptyDescription:
      copy?.emptyDescription ?? "Checkout can still continue from the payment request total.",
    amountDueLabel: copy?.amountDueLabel ?? "Amount due",
    statusLabel: copy?.statusLabel ?? "Status",
    customerLabel: copy?.customerLabel ?? "Customer",
    merchantLabel: copy?.merchantLabel ?? "Merchant",
    dueAtLabel: copy?.dueAtLabel ?? "Due",
    expiresAtLabel: copy?.expiresAtLabel ?? "Expires",
    startPaymentMethodSetupLabel:
      copy?.startPaymentMethodSetupLabel ?? "Start secure payment entry",
    submitTokenizedPaymentMethodLabel:
      copy?.submitTokenizedPaymentMethodLabel ?? "Complete payment",
    openHostedCheckoutLabel: copy?.openHostedCheckoutLabel ?? "Open hosted checkout",
    secureEntryReadyLabel: copy?.secureEntryReadyLabel ?? "Waiting for secure entry",
  };
}

function resolvePromoCodeControlCopy(
  copy: VortexPromoCodeControlCopy | undefined,
): Required<VortexPromoCodeControlCopy> {
  return {
    title: copy?.title ?? "Promo code",
    readyDescription: copy?.readyDescription ?? "Apply a Vortex promo code to this checkout.",
    appliedDescription: copy?.appliedDescription ?? "This checkout has an active promo code.",
    rejectedDescription: copy?.rejectedDescription ?? "The promo code could not be applied.",
    loadingTitle: copy?.loadingTitle ?? "Checking promo code...",
    errorTitle: copy?.errorTitle ?? "Unable to apply promo code.",
    emptyTitle: copy?.emptyTitle ?? "No promo code applied",
    emptyDescription: copy?.emptyDescription ?? "Enter a code to preview and apply a discount.",
    codeLabel: copy?.codeLabel ?? "Code",
    codePlaceholder: copy?.codePlaceholder ?? "Enter code",
    applyLabel: copy?.applyLabel ?? "Apply",
    applyingLabel: copy?.applyingLabel ?? "Checking...",
    removeLabel: copy?.removeLabel ?? "Remove",
    appliedCodeLabel: copy?.appliedCodeLabel ?? "Applied code",
    discountLabel: copy?.discountLabel ?? "Discount",
  };
}

function resolveBalanceWalletPanelCopy(
  copy: VortexBalanceWalletPanelCopy | undefined,
): Required<VortexBalanceWalletPanelCopy> {
  return {
    title: copy?.title ?? "Balance and credits",
    readyDescription:
      copy?.readyDescription ?? "Review available credits and wallet ledger activity.",
    emptyDescription: copy?.emptyDescription ?? "No prepaid balance is currently available.",
    blockedDescription:
      copy?.blockedDescription ?? "This balance needs attention before it can be used.",
    loadingTitle: copy?.loadingTitle ?? "Loading balance...",
    errorTitle: copy?.errorTitle ?? "Unable to load balance.",
    availableBalanceLabel: copy?.availableBalanceLabel ?? "Available",
    pendingBalanceLabel: copy?.pendingBalanceLabel ?? "Pending",
    entryCountLabel: copy?.entryCountLabel ?? "Ledger rows",
    nextActionLabel: copy?.nextActionLabel ?? "Next action",
    emptyTitle: copy?.emptyTitle ?? "No balance activity",
    emptyStateDescription:
      copy?.emptyStateDescription ?? "Add credits to create the first wallet ledger row.",
    addFundsLabel: copy?.addFundsLabel ?? "Add credits",
    viewEntryLabel: copy?.viewEntryLabel ?? "View row",
    settlementLabel: copy?.settlementLabel ?? "Funding settlement",
    targetLabel: copy?.targetLabel ?? "Targets",
  };
}

function resolveRecoverySummaryCopy(
  copy: VortexRecoverySummaryCopy | undefined,
): Required<VortexRecoverySummaryCopy> {
  return {
    title: copy?.title ?? "Payment recovery",
    healthyDescription:
      copy?.healthyDescription ?? "No payment recovery action is currently required.",
    actionRequiredDescription:
      copy?.actionRequiredDescription ??
      "Review the payment issue and recover collection through Vortex.",
    recoveredDescription: copy?.recoveredDescription ?? "The payment issue has been recovered.",
    loadingTitle: copy?.loadingTitle ?? "Loading recovery state...",
    errorTitle: copy?.errorTitle ?? "Unable to load recovery state.",
    statusLabel: copy?.statusLabel ?? "Status",
    reasonLabel: copy?.reasonLabel ?? "Reason",
    amountDueLabel: copy?.amountDueLabel ?? "Amount due",
    nextRetryLabel: copy?.nextRetryLabel ?? "Next retry",
    invoiceLabel: copy?.invoiceLabel ?? "Invoice",
    attemptsLabel: copy?.attemptsLabel ?? "Attempts",
    emptyAttemptsTitle: copy?.emptyAttemptsTitle ?? "No recovery attempts yet",
    openHostedRecoveryLabel: copy?.openHostedRecoveryLabel ?? "Update payment method",
    retryPaymentLabel: copy?.retryPaymentLabel ?? "Retry payment",
  };
}

function resolveEntitlementSummaryCopy(
  copy: VortexEntitlementSummaryCopy | undefined,
): Required<VortexEntitlementSummaryCopy> {
  return {
    title: copy?.title ?? "Access",
    activeDescription: copy?.activeDescription ?? "This customer has active access through Vortex.",
    limitedDescription:
      copy?.limitedDescription ??
      "This customer has limited access and may need billing attention.",
    blockedDescription:
      copy?.blockedDescription ?? "This customer does not currently have full access.",
    emptyDescription: copy?.emptyDescription ?? "No customer access is currently enabled.",
    loadingTitle: copy?.loadingTitle ?? "Loading access...",
    errorTitle: copy?.errorTitle ?? "Unable to load access.",
    statusLabel: copy?.statusLabel ?? "Status",
    planLabel: copy?.planLabel ?? "Plan",
    featureCountLabel: copy?.featureCountLabel ?? "Features",
    renewalLabel: copy?.renewalLabel ?? "Renews",
    trialLabel: copy?.trialLabel ?? "Trial ends",
    emptyFeaturesTitle: copy?.emptyFeaturesTitle ?? "No entitlements are active.",
    openPortalLabel: copy?.openPortalLabel ?? "Manage billing",
    viewFeatureLabel: copy?.viewFeatureLabel ?? "View feature",
  };
}

function resolvePaymentTimelineSummaryCopy(
  copy: VortexPaymentTimelineSummaryCopy | undefined,
): Required<VortexPaymentTimelineSummaryCopy> {
  return {
    title: copy?.title ?? "Payments",
    currentDescription:
      copy?.currentDescription ??
      "Recent invoice, payment, refund, and receipt activity is current.",
    attentionRequiredDescription:
      copy?.attentionRequiredDescription ??
      "Review billing activity that needs customer attention.",
    emptyDescription: copy?.emptyDescription ?? "No billing activity is available yet.",
    loadingTitle: copy?.loadingTitle ?? "Loading payment timeline...",
    errorTitle: copy?.errorTitle ?? "Unable to load payment timeline.",
    statusLabel: copy?.statusLabel ?? "Status",
    amountDueLabel: copy?.amountDueLabel ?? "Amount due",
    entryCountLabel: copy?.entryCountLabel ?? "Rows",
    nextActionLabel: copy?.nextActionLabel ?? "Next action",
    emptyEntriesTitle: copy?.emptyEntriesTitle ?? "No payment activity",
    emptyEntriesDescription:
      copy?.emptyEntriesDescription ??
      "Invoices, payments, refunds, credits, and receipts will appear here.",
    openPortalLabel: copy?.openPortalLabel ?? "View billing history",
    viewEntryLabel: copy?.viewEntryLabel ?? "View row",
  };
}

function resolveInvoiceListCopy(
  copy: VortexInvoiceListCopy | undefined,
): Required<VortexInvoiceListCopy> {
  return {
    title: copy?.title ?? "Invoices",
    currentDescription: copy?.currentDescription ?? "Invoice history is current.",
    attentionRequiredDescription:
      copy?.attentionRequiredDescription ?? "Review invoices that need customer action.",
    emptyDescription: copy?.emptyDescription ?? "No invoices are available yet.",
    loadingTitle: copy?.loadingTitle ?? "Loading invoices...",
    errorTitle: copy?.errorTitle ?? "Unable to load invoices.",
    statusLabel: copy?.statusLabel ?? "Status",
    amountDueLabel: copy?.amountDueLabel ?? "Amount due",
    invoiceCountLabel: copy?.invoiceCountLabel ?? "Invoices",
    overdueCountLabel: copy?.overdueCountLabel ?? "Overdue",
    actionRequiredCountLabel: copy?.actionRequiredCountLabel ?? "Needs action",
    rowLimitLabel: copy?.rowLimitLabel ?? "Rows shown",
    nextActionLabel: copy?.nextActionLabel ?? "Next action",
    emptyInvoicesTitle: copy?.emptyInvoicesTitle ?? "No invoices",
    emptyInvoicesDescription:
      copy?.emptyInvoicesDescription ??
      "Invoices and receipts will appear here when billing starts.",
    openPortalLabel: copy?.openPortalLabel ?? "View invoice center",
    viewInvoiceLabel: copy?.viewInvoiceLabel ?? "View invoice",
    viewReceiptLabel: copy?.viewReceiptLabel ?? "View receipt",
    payInvoiceLabel: copy?.payInvoiceLabel ?? "Pay invoice",
    customActionLabel: copy?.customActionLabel ?? "Open",
    loadMoreLabel: copy?.loadMoreLabel ?? "Load more",
  };
}

function resolvePlanComparisonCopy(
  copy: VortexPlanComparisonCopy | undefined,
): Required<VortexPlanComparisonCopy> {
  return {
    title: copy?.title ?? "Plans",
    readyDescription:
      copy?.readyDescription ?? "Compare available plans and continue to Vortex checkout.",
    emptyDescription: copy?.emptyDescription ?? "No plans are currently available.",
    blockedDescription: copy?.blockedDescription ?? "Plan changes are not currently available.",
    loadingTitle: copy?.loadingTitle ?? "Loading plans...",
    errorTitle: copy?.errorTitle ?? "Unable to load plans.",
    statusLabel: copy?.statusLabel ?? "Status",
    planCountLabel: copy?.planCountLabel ?? "Plans",
    selectedPlanLabel: copy?.selectedPlanLabel ?? "Selected",
    currentPlanLabel: copy?.currentPlanLabel ?? "Current",
    recommendedPlanLabel: copy?.recommendedPlanLabel ?? "Recommended",
    priceLabel: copy?.priceLabel ?? "Price",
    cadenceLabel: copy?.cadenceLabel ?? "Cadence",
    featureCountLabel: copy?.featureCountLabel ?? "Features",
    emptyPlansTitle: copy?.emptyPlansTitle ?? "No plans",
    emptyPlansDescription:
      copy?.emptyPlansDescription ?? "Plans will appear here when product pricing is available.",
    openCheckoutLabel: copy?.openCheckoutLabel ?? "Continue to checkout",
    currentButtonLabel: copy?.currentButtonLabel ?? "Current plan",
    disabledButtonLabel: copy?.disabledButtonLabel ?? "Unavailable",
    selectPlanLabel: copy?.selectPlanLabel ?? "Select plan",
  };
}

function resolveUsageMeterSummaryCopy(
  copy: VortexUsageMeterSummaryCopy | undefined,
): Required<VortexUsageMeterSummaryCopy> {
  return {
    title: copy?.title ?? "Usage",
    currentDescription: copy?.currentDescription ?? "Usage is current for this billing period.",
    attentionRequiredDescription:
      copy?.attentionRequiredDescription ?? "Review usage that may affect the next invoice.",
    emptyDescription: copy?.emptyDescription ?? "No usage meters are active for this customer.",
    blockedDescription: copy?.blockedDescription ?? "Usage is not currently available.",
    loadingTitle: copy?.loadingTitle ?? "Loading usage...",
    errorTitle: copy?.errorTitle ?? "Unable to load usage.",
    statusLabel: copy?.statusLabel ?? "Status",
    planLabel: copy?.planLabel ?? "Plan",
    periodLabel: copy?.periodLabel ?? "Period",
    nextResetLabel: copy?.nextResetLabel ?? "Next reset",
    meterCountLabel: copy?.meterCountLabel ?? "Meters",
    usedLabel: copy?.usedLabel ?? "Used",
    includedLabel: copy?.includedLabel ?? "Included",
    billableLabel: copy?.billableLabel ?? "Billable",
    usagePercentLabel: copy?.usagePercentLabel ?? "Usage",
    resetLabel: copy?.resetLabel ?? "Resets",
    nextActionLabel: copy?.nextActionLabel ?? "Next action",
    emptyMetersTitle: copy?.emptyMetersTitle ?? "No usage meters",
    emptyMetersDescription:
      copy?.emptyMetersDescription ??
      "Metered usage will appear here when this plan records usage.",
    openPortalLabel: copy?.openPortalLabel ?? "View billing usage",
    viewMeterLabel: copy?.viewMeterLabel ?? "View meter",
  };
}

function resolveReceiptDownloadButtonCopy(
  copy: VortexReceiptDownloadButtonCopy | undefined,
): Required<VortexReceiptDownloadButtonCopy> {
  return { ...DEFAULT_RECEIPT_DOWNLOAD_BUTTON_COPY, ...copy };
}

function resolveBillingStatusBannerCopy(
  copy: VortexBillingStatusBannerCopy | undefined,
): Required<VortexBillingStatusBannerCopy> {
  return {
    loadingTitle: copy?.loadingTitle ?? "Loading billing status...",
    errorTitle: copy?.errorTitle ?? "Unable to load billing status.",
    statusLabel: copy?.statusLabel ?? "Status",
    planLabel: copy?.planLabel ?? "Plan",
    amountDueLabel: copy?.amountDueLabel ?? "Amount due",
    nextActionLabel: copy?.nextActionLabel ?? "Next action",
    openPortalLabel: copy?.openPortalLabel ?? "Manage billing",
    openRecoveryLabel: copy?.openRecoveryLabel ?? "Update payment method",
    customActionLabel: copy?.customActionLabel ?? "Continue",
  };
}

function resolveSubscriptionActionSummaryCopy(
  copy: VortexSubscriptionActionSummaryCopy | undefined,
): Required<VortexSubscriptionActionSummaryCopy> {
  return {
    title: copy?.title ?? "Subscription",
    activeDescription:
      copy?.activeDescription ?? "This subscription is active and ready for customer self-service.",
    trialingDescription:
      copy?.trialingDescription ??
      "This subscription is in trial and can be managed through Vortex.",
    scheduledCancellationDescription:
      copy?.scheduledCancellationDescription ?? "This subscription is scheduled to cancel.",
    pausedDescription:
      copy?.pausedDescription ?? "This subscription is paused and can be resumed through Vortex.",
    pastDueDescription:
      copy?.pastDueDescription ??
      "This subscription needs billing attention before it is fully current.",
    canceledDescription: copy?.canceledDescription ?? "This subscription is canceled.",
    emptyDescription: copy?.emptyDescription ?? "No active subscription action is available.",
    loadingTitle: copy?.loadingTitle ?? "Loading subscription...",
    errorTitle: copy?.errorTitle ?? "Unable to load subscription.",
    statusLabel: copy?.statusLabel ?? "Status",
    planLabel: copy?.planLabel ?? "Plan",
    cadenceLabel: copy?.cadenceLabel ?? "Billing cadence",
    renewalLabel: copy?.renewalLabel ?? "Renews",
    trialLabel: copy?.trialLabel ?? "Trial ends",
    scheduledCancelLabel: copy?.scheduledCancelLabel ?? "Cancels",
    pausedUntilLabel: copy?.pausedUntilLabel ?? "Paused until",
    amountDueLabel: copy?.amountDueLabel ?? "Amount due",
    nextActionLabel: copy?.nextActionLabel ?? "Next action",
    openPortalLabel: copy?.openPortalLabel ?? "Manage subscription",
    changePlanLabel: copy?.changePlanLabel ?? "Change plan",
    pauseLabel: copy?.pauseLabel ?? "Pause subscription",
    resumeLabel: copy?.resumeLabel ?? "Resume subscription",
    cancelLabel: copy?.cancelLabel ?? "Cancel subscription",
    customActionLabel: copy?.customActionLabel ?? "Continue",
  };
}

function resolvePaymentMethodSummaryCopy(
  copy: VortexPaymentMethodSummaryCopy | undefined,
): Required<VortexPaymentMethodSummaryCopy> {
  return {
    title: copy?.title ?? "Payment method",
    readyDescription: copy?.readyDescription ?? "A default payment method is ready for collection.",
    missingDescription:
      copy?.missingDescription ?? "Add a payment method before automatic collection can continue.",
    expiredDescription:
      copy?.expiredDescription ?? "The default payment method needs to be updated.",
    disabledDescription: copy?.disabledDescription ?? "The default payment method is disabled.",
    actionRequiredDescription:
      copy?.actionRequiredDescription ??
      "Review the payment method before the next collection attempt.",
    blockedDescription:
      copy?.blockedDescription ??
      "Payment collection is blocked until this payment method is fixed.",
    loadingTitle: copy?.loadingTitle ?? "Loading payment method...",
    errorTitle: copy?.errorTitle ?? "Unable to load payment method.",
    statusLabel: copy?.statusLabel ?? "Status",
    kindLabel: copy?.kindLabel ?? "Type",
    methodLabel: copy?.methodLabel ?? "Default method",
    expiryLabel: copy?.expiryLabel ?? "Expires",
    bankLabel: copy?.bankLabel ?? "Bank",
    accountTypeLabel: copy?.accountTypeLabel ?? "Account type",
    readinessLabel: copy?.readinessLabel ?? "Readiness",
    nextActionLabel: copy?.nextActionLabel ?? "Next action",
    openPaymentMethodsLabel: copy?.openPaymentMethodsLabel ?? "Manage payment methods",
    addPaymentMethodLabel: copy?.addPaymentMethodLabel ?? "Add payment method",
    updatePaymentMethodLabel: copy?.updatePaymentMethodLabel ?? "Update payment method",
    customActionLabel: copy?.customActionLabel ?? "Continue",
  };
}

function balanceWalletDescription(
  balance: VortexBalanceWalletState,
  copy: Required<VortexBalanceWalletPanelCopy>,
): ReactNode {
  if (balance.status === "blocked") {
    return copy.blockedDescription;
  }
  if (balance.status === "empty") {
    return copy.emptyDescription;
  }
  return copy.readyDescription;
}

function recoverySummaryDescription(
  recovery: VortexRecoverySummaryState,
  copy: Required<VortexRecoverySummaryCopy>,
): ReactNode {
  if (recovery.status === "healthy") {
    return copy.healthyDescription;
  }
  if (recovery.status === "recovered") {
    return copy.recoveredDescription;
  }
  return copy.actionRequiredDescription;
}

function entitlementSummaryDescription(
  access: VortexEntitlementSummaryState,
  copy: Required<VortexEntitlementSummaryCopy>,
): ReactNode {
  if (access.status === "active" || access.status === "trialing") {
    return copy.activeDescription;
  }
  if (access.status === "limited" || access.status === "past_due") {
    return copy.limitedDescription;
  }
  if (access.status === "none") {
    return copy.emptyDescription;
  }
  return copy.blockedDescription;
}

function paymentTimelineDescription(
  timeline: VortexPaymentTimelineState,
  copy: Required<VortexPaymentTimelineSummaryCopy>,
): ReactNode {
  if (timeline.status === "current") {
    return copy.currentDescription;
  }
  if (timeline.status === "empty") {
    return copy.emptyDescription;
  }
  return copy.attentionRequiredDescription;
}

function invoiceListDescription(
  invoiceList: VortexInvoiceListState,
  copy: Required<VortexInvoiceListCopy>,
): ReactNode {
  if (invoiceList.status === "current") {
    return copy.currentDescription;
  }
  if (invoiceList.status === "empty") {
    return copy.emptyDescription;
  }
  return copy.attentionRequiredDescription;
}

function invoiceListRowActionLabel(
  action: VortexInvoiceListRowAction,
  copy: Required<VortexInvoiceListCopy>,
): ReactNode {
  if (action === "open_receipt") {
    return copy.viewReceiptLabel;
  }
  if (action === "open_payment") {
    return copy.payInvoiceLabel;
  }
  if (action === "custom") {
    return copy.customActionLabel;
  }
  return copy.viewInvoiceLabel;
}

function planComparisonDescription(
  comparison: VortexPlanComparisonState,
  copy: Required<VortexPlanComparisonCopy>,
): ReactNode {
  if (comparison.status === "ready") {
    return copy.readyDescription;
  }
  if (comparison.status === "empty") {
    return copy.emptyDescription;
  }
  return copy.blockedDescription;
}

function planComparisonActionLabel(
  plan: VortexPlanComparisonPlan,
  copy: Required<VortexPlanComparisonCopy>,
): ReactNode {
  if (plan.status === "current") {
    return copy.currentButtonLabel;
  }
  if (plan.status === "disabled" || plan.disabledReason !== undefined) {
    return copy.disabledButtonLabel;
  }
  if (plan.checkoutToken === undefined) {
    return copy.selectPlanLabel;
  }
  return copy.openCheckoutLabel;
}

function usageMeterSummaryDescription(
  usage: VortexUsageMeterSummaryState,
  copy: Required<VortexUsageMeterSummaryCopy>,
): ReactNode {
  if (usage.status === "current") {
    return copy.currentDescription;
  }
  if (usage.status === "empty") {
    return copy.emptyDescription;
  }
  if (usage.status === "blocked") {
    return copy.blockedDescription;
  }
  return copy.attentionRequiredDescription;
}

function receiptDownloadButtonLabel(
  artifact: VortexReceiptDownloadButtonArtifact,
  copy: Required<VortexReceiptDownloadButtonCopy>,
): ReactNode {
  if (artifact.status === "generating") {
    return copy.generatingLabel;
  }
  if (artifact.status === "missing") {
    return copy.missingLabel;
  }
  if (artifact.status === "blocked" || artifact.disabledReason !== undefined) {
    return copy.blockedLabel;
  }
  if (artifact.portalToken !== undefined) {
    return copy.openCenterLabel;
  }
  return copy.readyLabel;
}

function formatUsageMeterAmount(amount: number, unitLabel: ReactNode | undefined): ReactNode {
  if (unitLabel === undefined) {
    return String(amount);
  }
  return createElement("span", null, String(amount), " ", unitLabel);
}

function formatUsageMeterPercent(percent: number | undefined): string {
  if (percent === undefined) {
    return "none";
  }
  return `${Math.round(percent)}%`;
}

function formatDateRange(start: string | undefined, end: string | undefined): string {
  if (start === undefined && end === undefined) {
    return "none";
  }
  if (start === undefined) {
    return `through ${end}`;
  }
  if (end === undefined) {
    return `from ${start}`;
  }
  return `${start} - ${end}`;
}

function billingStatusActionLabel(
  action: VortexBillingStatusBannerAction,
  copy: Required<VortexBillingStatusBannerCopy>,
): ReactNode {
  if (action === "open_recovery") {
    return copy.openRecoveryLabel;
  }
  if (action === "custom") {
    return copy.customActionLabel;
  }
  return copy.openPortalLabel;
}

function subscriptionActionDescription(
  subscription: VortexSubscriptionActionSummaryState,
  copy: Required<VortexSubscriptionActionSummaryCopy>,
): ReactNode {
  if (subscription.status === "active") {
    return copy.activeDescription;
  }
  if (subscription.status === "trialing") {
    return copy.trialingDescription;
  }
  if (subscription.status === "scheduled_cancellation") {
    return copy.scheduledCancellationDescription;
  }
  if (subscription.status === "paused") {
    return copy.pausedDescription;
  }
  if (subscription.status === "past_due" || subscription.status === "payment_action_required") {
    return copy.pastDueDescription;
  }
  if (subscription.status === "canceled") {
    return copy.canceledDescription;
  }
  return copy.emptyDescription;
}

function subscriptionActionLabel(
  action: VortexSubscriptionActionSummaryAction,
  copy: Required<VortexSubscriptionActionSummaryCopy>,
): ReactNode {
  if (action === "change_plan") {
    return copy.changePlanLabel;
  }
  if (action === "pause") {
    return copy.pauseLabel;
  }
  if (action === "resume") {
    return copy.resumeLabel;
  }
  if (action === "cancel") {
    return copy.cancelLabel;
  }
  if (action === "custom") {
    return copy.customActionLabel;
  }
  return copy.openPortalLabel;
}

function subscriptionActionPortalQuery(
  action: VortexSubscriptionActionSummaryAction,
): Readonly<Record<string, string>> {
  if (action === "change_plan") {
    return { view: "subscription", action: "change_plan" };
  }
  if (action === "pause") {
    return { view: "subscription", action: "pause" };
  }
  if (action === "resume") {
    return { view: "subscription", action: "resume" };
  }
  if (action === "cancel") {
    return { view: "subscription", action: "cancel" };
  }
  return { view: "subscription" };
}

function paymentMethodSummaryDescription(
  paymentMethod: VortexPaymentMethodSummaryState,
  copy: Required<VortexPaymentMethodSummaryCopy>,
): ReactNode {
  if (paymentMethod.status === "ready") {
    return copy.readyDescription;
  }
  if (paymentMethod.status === "missing") {
    return copy.missingDescription;
  }
  if (paymentMethod.status === "expired") {
    return copy.expiredDescription;
  }
  if (paymentMethod.status === "disabled") {
    return copy.disabledDescription;
  }
  if (paymentMethod.status === "action_required") {
    return copy.actionRequiredDescription;
  }
  return copy.blockedDescription;
}

function paymentMethodActionLabel(
  action: VortexPaymentMethodSummaryAction,
  copy: Required<VortexPaymentMethodSummaryCopy>,
): ReactNode {
  if (action === "add_payment_method") {
    return copy.addPaymentMethodLabel;
  }
  if (action === "update_payment_method") {
    return copy.updatePaymentMethodLabel;
  }
  if (action === "custom") {
    return copy.customActionLabel;
  }
  return copy.openPaymentMethodsLabel;
}

function paymentMethodSummaryPortalQuery(
  action: VortexPaymentMethodSummaryAction,
): Readonly<Record<string, string>> {
  if (action === "add_payment_method") {
    return { view: "payment_methods", action: "add" };
  }
  if (action === "update_payment_method") {
    return { view: "payment_methods", action: "update_default" };
  }
  return { view: "payment_methods" };
}

function paymentMethodLabel(paymentMethod: VortexPaymentMethodSummaryState): ReactNode {
  if (paymentMethod.brandLabel === undefined && paymentMethod.last4 === undefined) {
    return "none";
  }
  if (paymentMethod.brandLabel === undefined) {
    return `ending in ${paymentMethod.last4}`;
  }
  if (paymentMethod.last4 === undefined) {
    return paymentMethod.brandLabel;
  }
  return `${stringFromReactNode(paymentMethod.brandLabel, "Payment method")} ending in ${paymentMethod.last4}`;
}

function promoCodeDescription(
  promoCode: VortexPromoCodeControlState,
  copy: Required<VortexPromoCodeControlCopy>,
): ReactNode {
  if (promoCode.status === "applied") {
    return copy.appliedDescription;
  }
  if (promoCode.status === "rejected") {
    return copy.rejectedDescription;
  }
  return copy.readyDescription;
}

function stringFromReactNode(value: ReactNode, fallback: string): string {
  return typeof value === "string" ? value : fallback;
}

function createBalanceWalletEntryItem(
  entry: VortexBalanceWalletEntry,
  balance: VortexBalanceWalletState,
  copy: Required<VortexBalanceWalletPanelCopy>,
  classNames: VortexEmbeddedComponentClassNames | undefined,
  isDisabled: boolean,
  onEntrySelect:
    | ((entry: VortexBalanceWalletEntry, balance: VortexBalanceWalletState) => void | Promise<void>)
    | undefined,
): ReactNode {
  const settlement =
    entry.fundingSettlement === undefined
      ? "not_funded"
      : entry.fundingSettlement.settled
        ? "settled"
        : entry.fundingSettlement.nextAction;
  const targets = formatBalanceWalletTargets(entry.targets);
  return createElement(
    "li",
    {
      key: entry.entryId,
      className: classNames?.item,
      "data-vortex-wallet-entry-id": entry.entryId,
      "data-vortex-wallet-entry-type": entry.entryType,
      "data-vortex-wallet-entry-amount": String(entry.amount),
      "data-vortex-wallet-entry-remaining": String(entry.remainingAmount ?? 0),
    },
    createElement(
      "strong",
      { className: classNames?.itemTitle },
      `${entry.entryType} ${formatMinorUnitAmount(entry.amount, entry.currency)}`,
    ),
    entry.description === undefined
      ? null
      : createElement("p", { className: classNames?.itemDescription }, entry.description),
    createElement("span", { className: classNames?.status }, entry.effectiveAt),
    createElement(
      "dl",
      { className: classNames?.metrics },
      createMetric(
        "Remaining",
        formatMinorUnitAmount(entry.remainingAmount ?? 0, entry.currency),
        classNames,
      ),
      createMetric("Invoice", entry.invoiceNumber ?? "none", classNames),
      createMetric("Payment", entry.paymentId ?? "none", classNames),
      createMetric(copy.settlementLabel, settlement, classNames),
      createMetric(copy.targetLabel, targets, classNames),
    ),
    createElement(
      "button",
      {
        className: classNames?.button,
        disabled: isDisabled,
        onClick: () => {
          void onEntrySelect?.(entry, balance);
        },
        type: "button",
        "data-vortex-wallet-action": "view_entry",
      },
      copy.viewEntryLabel,
    ),
  );
}

function createRecoveryAttemptItem(
  attempt: VortexRecoverySummaryAttempt,
  recovery: VortexRecoverySummaryState,
  classNames: VortexEmbeddedComponentClassNames | undefined,
  isDisabled: boolean,
  onAttemptSelect:
    | ((
        attempt: VortexRecoverySummaryAttempt,
        recovery: VortexRecoverySummaryState,
      ) => void | Promise<void>)
    | undefined,
): ReactNode {
  const amount =
    attempt.amount === undefined || attempt.currency === undefined
      ? "none"
      : formatMinorUnitAmount(attempt.amount, attempt.currency);
  return createElement(
    "li",
    {
      key: attempt.id,
      className: classNames?.item,
      "data-vortex-recovery-attempt-id": attempt.id,
      "data-vortex-recovery-attempt-status": attempt.status,
    },
    createElement("strong", { className: classNames?.itemTitle }, attempt.status),
    attempt.message === undefined
      ? null
      : createElement("p", { className: classNames?.itemDescription }, attempt.message),
    createElement("span", { className: classNames?.status }, attempt.occurredAt),
    createElement(
      "dl",
      { className: classNames?.metrics },
      createMetric("Amount", amount, classNames),
      createMetric("Payment request", recovery.paymentRequestId ?? "none", classNames),
    ),
    createElement(
      "button",
      {
        className: classNames?.button,
        disabled: isDisabled,
        onClick: () => {
          void onAttemptSelect?.(attempt, recovery);
        },
        type: "button",
        "data-vortex-recovery-action": "view_attempt",
      },
      "View attempt",
    ),
  );
}

function createEntitlementFeatureItem(
  feature: VortexEntitlementSummaryFeature,
  access: VortexEntitlementSummaryState,
  copy: Required<VortexEntitlementSummaryCopy>,
  classNames: VortexEmbeddedComponentClassNames | undefined,
  isDisabled: boolean,
  onFeatureSelect:
    | ((
        feature: VortexEntitlementSummaryFeature,
        access: VortexEntitlementSummaryState,
      ) => void | Promise<void>)
    | undefined,
): ReactNode {
  return createElement(
    "li",
    {
      key: feature.id,
      className: classNames?.item,
      "data-vortex-entitlement-id": feature.id,
      "data-vortex-entitlement-key": feature.key,
      "data-vortex-entitlement-status": feature.status,
    },
    createElement("strong", { className: classNames?.itemTitle }, feature.label),
    feature.description === undefined
      ? null
      : createElement("p", { className: classNames?.itemDescription }, feature.description),
    createElement("span", { className: classNames?.status }, feature.status),
    createElement(
      "dl",
      { className: classNames?.metrics },
      createMetric("Limit", feature.limitLabel ?? "none", classNames),
      createMetric("Usage", feature.usageLabel ?? "none", classNames),
      createMetric("Renews", feature.renewsAt ?? "none", classNames),
    ),
    createElement(
      "button",
      {
        className: classNames?.button,
        disabled: isDisabled,
        onClick: () => {
          void onFeatureSelect?.(feature, access);
        },
        type: "button",
        "data-vortex-entitlement-action": "view_feature",
      },
      copy.viewFeatureLabel,
    ),
  );
}

function createPaymentTimelineEntryItem(
  entry: VortexPaymentTimelineEntry,
  timeline: VortexPaymentTimelineState,
  copy: Required<VortexPaymentTimelineSummaryCopy>,
  classNames: VortexEmbeddedComponentClassNames | undefined,
  isDisabled: boolean,
  onEntrySelect:
    | ((
        entry: VortexPaymentTimelineEntry,
        timeline: VortexPaymentTimelineState,
      ) => void | Promise<void>)
    | undefined,
): ReactNode {
  const amount =
    entry.amount === undefined || entry.currency === undefined
      ? "none"
      : formatMinorUnitAmount(entry.amount, entry.currency);
  return createElement(
    "li",
    {
      key: entry.id,
      className: classNames?.item,
      "data-vortex-payment-timeline-entry-id": entry.id,
      "data-vortex-payment-timeline-entry-type": entry.type,
      "data-vortex-payment-timeline-entry-status": entry.status,
      "data-vortex-invoice-id": entry.invoiceId,
      "data-vortex-payment-request-id": entry.paymentRequestId,
      "data-vortex-receipt-id": entry.receiptId,
    },
    createElement("strong", { className: classNames?.itemTitle }, entry.title),
    entry.description === undefined
      ? null
      : createElement("p", { className: classNames?.itemDescription }, entry.description),
    createElement("span", { className: classNames?.status }, entry.status),
    createElement(
      "dl",
      { className: classNames?.metrics },
      createMetric("Type", entry.type, classNames),
      createMetric("Amount", amount, classNames),
      createMetric("Date", entry.occurredAt, classNames),
      createMetric("Invoice", entry.invoiceNumber ?? entry.invoiceId ?? "none", classNames),
    ),
    createElement(
      "button",
      {
        className: classNames?.button,
        disabled: isDisabled,
        onClick: () => {
          void onEntrySelect?.(entry, timeline);
        },
        type: "button",
        "data-vortex-payment-timeline-action": "view_entry",
      },
      copy.viewEntryLabel,
    ),
  );
}

function createInvoiceListRowItem(
  invoice: VortexInvoiceListRow,
  invoiceList: VortexInvoiceListState,
  copy: Required<VortexInvoiceListCopy>,
  classNames: VortexEmbeddedComponentClassNames | undefined,
  isDisabled: boolean,
  onInvoiceSelect:
    | ((invoice: VortexInvoiceListRow, invoiceList: VortexInvoiceListState) => void | Promise<void>)
    | undefined,
): ReactNode {
  const actionDisabledReason = invoice.actionDisabledReason;
  return createElement(
    "li",
    {
      key: invoice.id,
      className: classNames?.item,
      "data-vortex-invoice-id": invoice.id,
      "data-vortex-invoice-number": invoice.invoiceNumber,
      "data-vortex-invoice-status": invoice.status,
      "data-vortex-invoice-action": invoice.action,
      "data-vortex-receipt-id": invoice.receiptId,
      "data-vortex-payment-request-id": invoice.paymentRequestId,
    },
    createElement("strong", { className: classNames?.itemTitle }, invoice.title),
    invoice.description === undefined
      ? null
      : createElement("p", { className: classNames?.itemDescription }, invoice.description),
    createElement("span", { className: classNames?.status }, invoice.status),
    actionDisabledReason === undefined
      ? null
      : createElement(
          "p",
          { className: classNames?.status, "data-vortex-invoice-action-disabled-reason": true },
          actionDisabledReason,
        ),
    createElement(
      "dl",
      { className: classNames?.metrics },
      createMetric("Amount", formatMinorUnitAmount(invoice.amount, invoice.currency), classNames),
      createMetric("Issued", invoice.issuedAt ?? "none", classNames),
      createMetric("Due", invoice.dueAt ?? "none", classNames),
      createMetric("Paid", invoice.paidAt ?? "none", classNames),
      createMetric("Invoice", invoice.invoiceNumber ?? invoice.id, classNames),
    ),
    createElement(
      "button",
      {
        className: classNames?.button,
        disabled: isDisabled || actionDisabledReason !== undefined,
        onClick: () => {
          void onInvoiceSelect?.(invoice, invoiceList);
        },
        type: "button",
        "data-vortex-invoice-row-action": invoice.action,
      },
      invoiceListRowActionLabel(invoice.action, copy),
    ),
  );
}

function createPlanComparisonItem(
  plan: VortexPlanComparisonPlan,
  comparison: VortexPlanComparisonState,
  copy: Required<VortexPlanComparisonCopy>,
  classNames: VortexEmbeddedComponentClassNames | undefined,
  isDisabled: boolean,
  launchPlan: (plan: VortexPlanComparisonPlan) => void,
): ReactNode {
  const isCurrent = plan.status === "current" || comparison.currentPlanId === plan.id;
  const isRecommended = plan.status === "recommended" || comparison.recommendedPlanId === plan.id;
  const actionDisabledReason = plan.disabledReason;
  return createElement(
    "li",
    {
      key: plan.id,
      className: classNames?.item,
      "data-vortex-plan-id": plan.id,
      "data-vortex-plan-lookup-key": plan.lookupKey,
      "data-vortex-plan-status": plan.status,
      "data-vortex-plan-current": String(isCurrent),
      "data-vortex-plan-recommended": String(isRecommended),
      "data-vortex-plan-cadence": plan.cadence,
    },
    createElement("strong", { className: classNames?.itemTitle }, plan.title),
    plan.description === undefined
      ? null
      : createElement("p", { className: classNames?.itemDescription }, plan.description),
    createElement(
      "span",
      { className: classNames?.status },
      isCurrent ? copy.currentPlanLabel : plan.status,
    ),
    isRecommended
      ? createElement(
          "span",
          { className: classNames?.status, "data-vortex-plan-badge": "recommended" },
          copy.recommendedPlanLabel,
        )
      : null,
    actionDisabledReason === undefined
      ? null
      : createElement(
          "p",
          { className: classNames?.status, "data-vortex-plan-disabled-reason": true },
          actionDisabledReason,
        ),
    createElement(
      "dl",
      { className: classNames?.metrics },
      createMetric(
        copy.priceLabel,
        formatMinorUnitAmount(plan.priceAmount, plan.currency),
        classNames,
      ),
      createMetric(copy.cadenceLabel, plan.cadenceLabel ?? plan.cadence, classNames),
      createMetric(copy.featureCountLabel, String(plan.featureHighlights.length), classNames),
    ),
    plan.featureHighlights.length === 0
      ? null
      : createElement(
          "ul",
          { className: classNames?.list, "data-vortex-plan-feature-list": plan.id },
          plan.featureHighlights.map((feature, index) =>
            createElement(
              "li",
              {
                key: `${plan.id}:feature:${index}`,
                className: classNames?.itemDescription,
                "data-vortex-plan-feature-index": String(index),
              },
              feature,
            ),
          ),
        ),
    createElement(
      "button",
      {
        className: classNames?.button,
        disabled:
          isDisabled ||
          isCurrent ||
          actionDisabledReason !== undefined ||
          plan.status === "disabled",
        onClick: () => {
          launchPlan(plan);
        },
        type: "button",
        "data-vortex-plan-action":
          plan.checkoutToken === undefined ? "select_plan" : "open_checkout",
      },
      planComparisonActionLabel(plan, copy),
    ),
  );
}

function createUsageMeterSummaryItem(
  meter: VortexUsageMeterSummaryMeter,
  usage: VortexUsageMeterSummaryState,
  copy: Required<VortexUsageMeterSummaryCopy>,
  classNames: VortexEmbeddedComponentClassNames | undefined,
  isDisabled: boolean,
  onMeterSelect:
    | ((
        meter: VortexUsageMeterSummaryMeter,
        usage: VortexUsageMeterSummaryState,
      ) => void | Promise<void>)
    | undefined,
): ReactNode {
  return createElement(
    "li",
    {
      key: meter.id,
      className: classNames?.item,
      "data-vortex-meter-id": meter.id,
      "data-vortex-meter-usage-key": meter.usageKey,
      "data-vortex-meter-status": meter.status,
      "data-vortex-meter-used-amount": String(meter.usedAmount),
      "data-vortex-meter-included-amount":
        meter.includedAmount === undefined ? undefined : String(meter.includedAmount),
      "data-vortex-meter-billable-amount":
        meter.billableAmount === undefined ? undefined : String(meter.billableAmount),
      "data-vortex-meter-usage-percent":
        meter.usagePercent === undefined ? undefined : String(meter.usagePercent),
      "data-vortex-meter-period-start": meter.periodStart,
      "data-vortex-meter-period-end": meter.periodEnd,
      "data-vortex-meter-reset-at": meter.resetAt,
    },
    createElement("strong", { className: classNames?.itemTitle }, meter.title),
    meter.description === undefined
      ? null
      : createElement("p", { className: classNames?.itemDescription }, meter.description),
    createElement("span", { className: classNames?.status }, meter.status),
    meter.limitLabel === undefined
      ? null
      : createElement(
          "span",
          { className: classNames?.status, "data-vortex-meter-limit-label": true },
          meter.limitLabel,
        ),
    createElement(
      "dl",
      { className: classNames?.metrics },
      createMetric(
        copy.usedLabel,
        formatUsageMeterAmount(meter.usedAmount, meter.unitLabel),
        classNames,
      ),
      createMetric(
        copy.includedLabel,
        meter.includedAmount === undefined
          ? "none"
          : formatUsageMeterAmount(meter.includedAmount, meter.unitLabel),
        classNames,
      ),
      createMetric(
        copy.billableLabel,
        meter.billableAmount === undefined
          ? "none"
          : formatUsageMeterAmount(meter.billableAmount, meter.unitLabel),
        classNames,
      ),
      createMetric(copy.usagePercentLabel, formatUsageMeterPercent(meter.usagePercent), classNames),
      createMetric(
        copy.periodLabel,
        formatDateRange(meter.periodStart, meter.periodEnd),
        classNames,
      ),
      createMetric(copy.resetLabel, meter.resetAt ?? "none", classNames),
      createMetric(copy.nextActionLabel, meter.nextAction ?? "none", classNames),
    ),
    createElement(
      "button",
      {
        className: classNames?.button,
        disabled: isDisabled || onMeterSelect === undefined,
        onClick: () => {
          void onMeterSelect?.(meter, usage);
        },
        type: "button",
        "data-vortex-meter-action": "select_meter",
      },
      copy.viewMeterLabel,
    ),
  );
}

function formatBalanceWalletTargets(targets: VortexBalanceWalletTargets | undefined): string {
  if (targets === undefined) {
    return "all";
  }
  const values = [
    ...(targets.lineTypes ?? []),
    ...(targets.priceIds ?? []),
    ...(targets.meterIds ?? []),
  ];
  return values.length === 0 ? "all" : values.join(", ");
}

function createEmbeddedCheckoutLineItem(
  lineItem: VortexEmbeddedCheckoutLineItem,
  classNames: VortexEmbeddedComponentClassNames | undefined,
): ReactNode {
  return createElement(
    "li",
    {
      key: lineItem.id,
      className: classNames?.item,
      "data-vortex-checkout-line-item-id": lineItem.id,
    },
    createElement("strong", { className: classNames?.itemTitle }, lineItem.label),
    lineItem.description === undefined
      ? null
      : createElement("p", { className: classNames?.itemDescription }, lineItem.description),
    createElement(
      "span",
      { className: classNames?.status },
      formatMinorUnitAmount(lineItem.amount, lineItem.currency),
    ),
  );
}

function resolveMerchantActionQueueCopy(
  copy: VortexMerchantActionQueueCopy | undefined,
): Required<VortexMerchantActionQueueCopy> {
  return {
    title: copy?.title ?? "Vortex Connect actions",
    readyDescription: copy?.readyDescription ?? "Vortex Connect is ready for this merchant.",
    blockedDescription:
      copy?.blockedDescription ??
      "Resolve the open Vortex Connect actions before this merchant can accept payments.",
    loadingTitle: copy?.loadingTitle ?? "Loading Vortex Connect actions...",
    errorTitle: copy?.errorTitle ?? "Unable to load Vortex Connect actions.",
    emptyTitle: copy?.emptyTitle ?? "No merchant actions are open.",
    emptyDescription:
      copy?.emptyDescription ??
      "This merchant has no current Vortex Connect payment, onboarding, or payout blockers.",
    statusLabel: copy?.statusLabel ?? "Status",
    onboardingLabel: copy?.onboardingLabel ?? "Onboarding",
    paymentCollectionLabel: copy?.paymentCollectionLabel ?? "Payment collection",
    payoutsLabel: copy?.payoutsLabel ?? "Payouts",
  };
}

function resolveMerchantAccountPanelCopy(
  copy: VortexMerchantAccountPanelCopy | undefined,
): Required<VortexMerchantAccountPanelCopy> {
  return {
    title: copy?.title ?? "Vortex Connect",
    readyDescription:
      copy?.readyDescription ?? "This merchant can accept payments through Vortex Connect.",
    blockedDescription:
      copy?.blockedDescription ??
      "This merchant needs Vortex Connect review before all payment flows are ready.",
    loadingTitle: copy?.loadingTitle ?? "Loading Vortex Connect...",
    errorTitle: copy?.errorTitle ?? "Unable to load Vortex Connect.",
    stateUnavailableTitle: copy?.stateUnavailableTitle ?? "Readiness state is unavailable.",
    stateUnavailableDescription:
      copy?.stateUnavailableDescription ??
      "Profile data is loaded, but live readiness has not been provided.",
    businessLabel: copy?.businessLabel ?? "Business",
    merchantModeLabel: copy?.merchantModeLabel ?? "Mode",
    merchantStatusLabel: copy?.merchantStatusLabel ?? "Status",
    paymentCollectionLabel: copy?.paymentCollectionLabel ?? "Payment collection",
    payoutReadinessLabel: copy?.payoutReadinessLabel ?? "Payouts",
    defaultCurrencyLabel: copy?.defaultCurrencyLabel ?? "Currency",
    activeCapabilitiesLabel: copy?.activeCapabilitiesLabel ?? "Active capabilities",
    restrictedCapabilitiesLabel: copy?.restrictedCapabilitiesLabel ?? "Restricted capabilities",
    openRequirementsLabel: copy?.openRequirementsLabel ?? "Open requirements",
    openOnboardingLabel: copy?.openOnboardingLabel ?? "Open Vortex Connect onboarding",
    openActionsLabel: copy?.openActionsLabel ?? "Review actions",
    openPayoutReadinessLabel: copy?.openPayoutReadinessLabel ?? "Review payouts",
  };
}

function createMerchantAccountListItem(
  title: ReactNode,
  description: ReactNode,
  id: string,
  classNames: VortexEmbeddedComponentClassNames | undefined,
): ReactNode {
  return createElement(
    "li",
    {
      key: id,
      className: classNames?.item,
      "data-vortex-account-detail": id,
    },
    createElement("strong", { className: classNames?.itemTitle }, title),
    createElement("p", { className: classNames?.itemDescription }, description),
  );
}

function resolvePayoutReadinessPanelCopy(
  copy: VortexPayoutReadinessPanelCopy | undefined,
): Required<VortexPayoutReadinessPanelCopy> {
  return {
    title: copy?.title ?? "Payout readiness",
    readyDescription:
      copy?.readyDescription ??
      "Payout configuration is readable and currently not blocking this merchant.",
    blockedDescription:
      copy?.blockedDescription ?? "Payouts need review before funds can move normally.",
    loadingTitle: copy?.loadingTitle ?? "Loading payout readiness...",
    errorTitle: copy?.errorTitle ?? "Unable to load payout readiness.",
    profileUnavailableTitle: copy?.profileUnavailableTitle ?? "Payout profile is unavailable.",
    profileUnavailableDescription:
      copy?.profileUnavailableDescription ??
      "Merchant readiness is loaded, but payout profile details were not provided.",
    payoutReadinessLabel: copy?.payoutReadinessLabel ?? "Readiness",
    payoutModeLabel: copy?.payoutModeLabel ?? "Mode",
    payoutRailLabel: copy?.payoutRailLabel ?? "Rail",
    payoutScheduleLabel: copy?.payoutScheduleLabel ?? "Schedule",
    currencyLabel: copy?.currencyLabel ?? "Currency",
    fundingRequirementLabel: copy?.fundingRequirementLabel ?? "Funding requirement",
    latestSettlementLabel: copy?.latestSettlementLabel ?? "Latest settlement",
    latestPayoutLabel: copy?.latestPayoutLabel ?? "Latest payout",
    settlementReadinessLabel: copy?.settlementReadinessLabel ?? "Settlement readiness",
    nextActionLabel: copy?.nextActionLabel ?? "Next action",
    capabilitiesLabel: copy?.capabilitiesLabel ?? "Capabilities",
    openMerchantAccountLabel: copy?.openMerchantAccountLabel ?? "Open merchant account",
    openActionsLabel: copy?.openActionsLabel ?? "Review actions",
  };
}

function resolveFeePolicyPanelCopy(
  copy: VortexFeePolicyPanelCopy | undefined,
): Required<VortexFeePolicyPanelCopy> {
  return {
    title: copy?.title ?? "Fee policy",
    description:
      copy?.description ??
      "Control how platform fees are assigned for merchant payment collection.",
    loadingTitle: copy?.loadingTitle ?? "Loading fee policy...",
    errorTitle: copy?.errorTitle ?? "Unable to load fee policy.",
    ownerModeLabel: copy?.ownerModeLabel ?? "Fee owner",
    platformFeeLabel: copy?.platformFeeLabel ?? "Platform fee",
    settlementLabel: copy?.settlementLabel ?? "Settlement",
    policyOptionsLabel: copy?.policyOptionsLabel ?? "Policy options",
  };
}

function createPayoutCapabilityItem(
  title: ReactNode,
  description: ReactNode,
  status: string,
  classNames: VortexEmbeddedComponentClassNames | undefined,
): ReactNode {
  return createElement(
    "li",
    {
      key: `${String(title)}:${status}`,
      className: classNames?.item,
      "data-vortex-payout-capability": String(title),
      "data-vortex-payout-capability-status": status,
    },
    createElement("strong", { className: classNames?.itemTitle }, title),
    createElement("p", { className: classNames?.itemDescription }, description),
    createElement("span", { className: classNames?.status }, status),
  );
}

function deriveMerchantActions(
  merchantState: MerchantAccountStateSnapshot,
): readonly VortexMerchantActionQueueItem[] {
  const actions: VortexMerchantActionQueueItem[] = [];

  if (merchantState.merchantStatus !== "active") {
    actions.push({
      id: "merchant-status",
      kind: "merchant_status",
      title: "Vortex Connect is not active",
      description: `Current merchant status is ${merchantState.merchantStatus}.`,
      severity: merchantState.merchantStatus === "rejected" ? "critical" : "warning",
      status: "open",
      primaryActionLabel: "Open Vortex Connect",
      primaryAction: { surface: "merchant_account_panel", id: merchantState.merchantAccountId },
    });
  }

  if (merchantState.openRequirementIds.length > 0) {
    actions.push({
      id: "open-requirements",
      kind: "onboarding_requirement",
      title: "Onboarding requirements need attention",
      description: `${merchantState.openRequirementIds.length} requirement${merchantState.openRequirementIds.length === 1 ? "" : "s"} open.`,
      severity: "critical",
      status: "open",
      primaryActionLabel: "Open onboarding",
      primaryAction:
        merchantState.onboardingSessionId === undefined
          ? { surface: "merchant_action_queue", id: merchantState.merchantAccountId }
          : { surface: "merchant_onboarding", token: merchantState.onboardingSessionId },
    });
  }

  if (merchantState.restrictedCapabilityKeys.length > 0) {
    actions.push({
      id: "restricted-capabilities",
      kind: "capability",
      title: "Capabilities are restricted",
      description: merchantState.restrictedCapabilityKeys.join(", "),
      severity: "warning",
      status: "open",
      primaryActionLabel: "Review merchant actions",
      primaryAction: { surface: "merchant_action_queue", id: merchantState.merchantAccountId },
    });
  }

  if (merchantState.payoutReadiness === "blocked" || merchantState.payoutReadiness === "paused") {
    actions.push({
      id: "payout-readiness",
      kind: "payout_readiness",
      title: "Payout readiness needs review",
      description:
        merchantState.payoutBlockReason ?? `Payout readiness is ${merchantState.payoutReadiness}.`,
      severity: merchantState.payoutReadiness === "blocked" ? "critical" : "warning",
      status: "open",
      primaryActionLabel: "Open payout readiness",
      primaryAction: { surface: "payout_readiness", id: merchantState.merchantAccountId },
    });
  }

  if (!merchantState.canAcceptPayments && actions.length === 0) {
    actions.push({
      id: "payment-readiness",
      kind: "payment_readiness",
      title: "Payment collection is blocked",
      description: "Merchant state does not currently allow payment collection.",
      severity: "warning",
      status: "open",
      primaryActionLabel: "Review merchant account",
      primaryAction: { surface: "merchant_account_panel", id: merchantState.merchantAccountId },
    });
  }

  return actions;
}
