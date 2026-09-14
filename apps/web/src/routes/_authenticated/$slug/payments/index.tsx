import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Text } from "@cloudflare/kumo/components/text";
import { createFileRoute } from "@tanstack/react-router";

import { PageWrapper } from "@/components/page-wrapper";

export const Route = createFileRoute("/_authenticated/$slug/payments/")({
  component: PaymentsOverviewPage,
});

function PaymentsOverviewPage() {
  return (
    <PageWrapper
      title="Payments Overview"
      description="Revenue summary and recent transactions."
    >
      <LayerCard>
        <LayerCard.Primary>
          <Text as="h2" size="lg" variant="heading">
            Revenue and transactions
          </Text>
          <Text as="p" size="sm" variant="secondary">
            Payment revenue, transactions, and subscription data are managed in
            Vortex Payments. This overview will be rewired to Seal's Cloudflare
            Worker backend once payment data is available there.
          </Text>
        </LayerCard.Primary>
        <LayerCard.Primary>
          <p className="text-kumo-secondary text-sm">No data to display.</p>
        </LayerCard.Primary>
      </LayerCard>
    </PageWrapper>
  );
}
