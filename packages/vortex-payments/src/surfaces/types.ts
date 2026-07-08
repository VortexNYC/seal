export type VortexPaymentsEnvironment = "development" | "test" | "staging" | "production";

export type VortexSurfaceMode = "hosted_redirect" | "embedded_component" | "operator_console";

export type VortexSurfaceId =
  | "checkout"
  | "embedded_checkout"
  | "promo_code_control"
  | "balance_wallet_panel"
  | "recovery_summary"
  | "entitlement_summary"
  | "payment_timeline_summary"
  | "billing_status_banner"
  | "subscription_action_summary"
  | "payment_method_summary"
  | "invoice_list"
  | "plan_comparison"
  | "usage_meter_summary"
  | "receipt_download_button"
  | "pay_link"
  | "customer_portal"
  | "payment_methods"
  | "payment_recovery"
  | "subscription_manager"
  | "invoice_receipt_center"
  | "merchant_onboarding"
  | "merchant_account_panel"
  | "payout_readiness"
  | "fee_policy_panel"
  | "merchant_action_queue"
  | "merchant_ops_dashboard"
  | "collections_queue"
  | "billing_inspector"
  | "webhook_replay_console"
  | "provider_exit_console";

export type VortexSurfaceStatus = "proved" | "ready_to_build" | "missing_product" | "operator_only";

export type VortexSurfaceBranding = {
  readonly showVortexBrand?: boolean;
  readonly brandName?: string;
  readonly logoUrl?: string;
  readonly accentColor?: string;
};

export type VortexSurfaceProviderConfig = {
  readonly baseUrl: string;
  readonly environment: VortexPaymentsEnvironment;
  readonly organizationId?: string;
  readonly publishableKey?: string;
  readonly branding?: VortexSurfaceBranding;
};

export type VortexHostedSurfaceRequest = {
  readonly surface: VortexSurfaceId;
  readonly token?: string;
  readonly id?: string;
  readonly path?: string;
  readonly query?: Readonly<Record<string, string | number | boolean | undefined>>;
};

export type VortexSurfaceDefinition = {
  readonly id: VortexSurfaceId;
  readonly label: string;
  readonly mode: VortexSurfaceMode;
  readonly status: VortexSurfaceStatus;
  readonly packageExport: string;
  readonly proofTarget: string;
};

export type VortexSurfaceLaunch = {
  readonly surface: VortexSurfaceId;
  readonly url: string;
  readonly mode: VortexSurfaceMode;
};
