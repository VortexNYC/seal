import { createFileRoute } from "@tanstack/react-router";

import { VortexMerchantOperationalSurface } from "@/components/payments/vortex-merchant-operational-surface";

export const Route = createFileRoute("/_authenticated/$slug/payments/history")({
  component: PaymentHistoryPage,
});

function PaymentHistoryPage() {
  const { slug } = Route.useParams();

  return <VortexMerchantOperationalSurface slug={slug} surface="history" />;
}
