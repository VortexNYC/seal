import { VORTEX_PAYMENTS_SURFACES } from "./surfaces";
import type { VortexSurfaceDefinition } from "./surfaces";

export type VortexPaymentsPackageBoundaryReport = {
  readonly packageName: "@vortex/payments";
  readonly visibility: "internal";
  readonly surfaceCount: number;
  readonly provedSurfaceCount: number;
  readonly missingProductCount: number;
  readonly reactExports: readonly string[];
};

export function inspectVortexPaymentsPackageBoundary(): VortexPaymentsPackageBoundaryReport {
  const surfaces: readonly VortexSurfaceDefinition[] = VORTEX_PAYMENTS_SURFACES;

  return {
    packageName: "@vortex/payments",
    visibility: "internal",
    surfaceCount: surfaces.length,
    provedSurfaceCount: surfaces.filter((surface) => surface.status === "proved").length,
    missingProductCount: surfaces.filter((surface) => surface.status === "missing_product").length,
    reactExports: [
      "VortexPaymentsProvider",
      "useVortexPayments",
      "VortexBillingStatusBanner",
      "VortexCheckoutButton",
      "VortexBalanceWalletPanel",
      "VortexEmbeddedCheckout",
      "VortexEntitlementSummary",
      "VortexInvoiceList",
      "VortexPromoCodeControl",
      "VortexCustomerPortalButton",
      "VortexPaymentMethodsButton",
      "VortexPaymentMethodSummary",
      "VortexPaymentTimelineSummary",
      "VortexPlanComparison",
      "VortexUsageMeterSummary",
      "VortexReceiptDownloadButton",
      "VortexHostedSurfaceButton",
      "VortexMerchantAccountPanel",
      "VortexMerchantActionQueue",
      "VortexFeePolicyPanel",
      "VortexPayoutReadinessPanel",
      "VortexRecoverySummary",
      "VortexSubscriptionActionSummary",
    ],
  };
}
