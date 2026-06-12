import { createFileRoute } from "@tanstack/react-router";

import { VortexMerchantOperationalSurface } from "@/components/payments/vortex-merchant-operational-surface";

export const Route = createFileRoute("/_authenticated/$slug/payments/disputes")({
  component: DisputesPage,
});

function DisputesPage() {
  const { slug } = Route.useParams();

  return <VortexMerchantOperationalSurface slug={slug} surface="disputes" />;
}
