import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Text } from "@cloudflare/kumo/components/text";
import { createFileRoute } from "@tanstack/react-router";

import { PageWrapper } from "@/components/page-wrapper";

export const Route = createFileRoute(
  "/_authenticated/$slug/payments/subscriptions"
)({
  component: SubscriptionsPage,
});

function SubscriptionsPage() {
  return (
    <PageWrapper
      title="Subscriptions"
      description="Manage recurring payments from your documents."
    >
      <LayerCard>
        <LayerCard.Primary>
          <Text as="h2" size="lg" variant="heading">
            Recurring payments
          </Text>
          <Text as="p" size="sm" variant="secondary">
            Subscriptions are managed in Vortex Payments. This list will be
            rewired to Seal's Cloudflare Worker backend once payment data is
            available there.
          </Text>
        </LayerCard.Primary>
        <LayerCard.Primary>
          <p className="text-kumo-secondary text-sm">
            No subscriptions to display.
          </p>
        </LayerCard.Primary>
      </LayerCard>
    </PageWrapper>
  );
}
