import type {
  VortexHostedSurfaceRequest,
  VortexSurfaceLaunch,
  VortexSurfaceProviderConfig,
} from "./types";
import { VORTEX_PAYMENTS_SURFACES } from "./catalog";

const hostedSurfacePaths = {
  checkout: "/pay",
  embedded_checkout: "/embedded-checkout",
  promo_code_control: "/promo-code",
  balance_wallet_panel: "/balance-wallet",
  recovery_summary: "/recovery-summary",
  entitlement_summary: "/entitlement-summary",
  payment_timeline_summary: "/payment-timeline",
  billing_status_banner: "/billing-status",
  subscription_action_summary: "/subscription-action",
  payment_method_summary: "/payment-method-summary",
  invoice_list: "/invoice-list",
  plan_comparison: "/plan-comparison",
  usage_meter_summary: "/usage-meter-summary",
  receipt_download_button: "/receipt-download",
  pay_link: "/pay",
  customer_portal: "/customer-portal",
  payment_methods: "/customer-portal",
  payment_recovery: "/pay",
  subscription_manager: "/customer-portal",
  invoice_receipt_center: "/customer-portal",
  merchant_onboarding: "/merchant-onboarding",
  merchant_account_panel: "/merchant-account",
  payout_readiness: "/merchant-payouts",
  fee_policy_panel: "/merchant-fee-policy",
  merchant_action_queue: "/merchant-actions",
  merchant_ops_dashboard: "/operator/payments/merchant-ops",
  collections_queue: "/operator/billing/collections-queue",
  billing_inspector: "/operator/billing/inspector",
  webhook_replay_console: "/operator/webhooks",
  stripe_exit_console: "/operator/migrations/stripe-exit",
} as const;

export function createVortexHostedLink(
  config: VortexSurfaceProviderConfig,
  request: VortexHostedSurfaceRequest,
): VortexSurfaceLaunch {
  const basePath = request.path ?? hostedSurfacePaths[request.surface];
  const pathParts = [basePath, request.token ?? request.id].filter(
    (part): part is string => part !== undefined && part.length > 0,
  );
  const url = new URL(pathParts.join("/"), normalizeBaseUrl(config.baseUrl));

  for (const [key, value] of Object.entries(request.query ?? {})) {
    if (value !== undefined) {
      url.searchParams.set(key, String(value));
    }
  }

  const definition = VORTEX_PAYMENTS_SURFACES.find((surface) => surface.id === request.surface);

  return {
    surface: request.surface,
    url: url.toString(),
    mode: definition?.mode ?? "hosted_redirect",
  };
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
}
