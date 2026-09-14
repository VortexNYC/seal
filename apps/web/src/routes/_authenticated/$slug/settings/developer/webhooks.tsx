/**
 * Developer Settings - Webhooks
 *
 * Core Vortex surfaces removed. Webhooks are managed in Vortex Auth.
 * Route: /{slug}/settings/developer/webhooks
 */

import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Text } from "@cloudflare/kumo/components/text";
import { createFileRoute } from "@tanstack/react-router";

import { FeatureGate } from "@/components/feature-gate";
import { PageWrapper } from "@/components/page-wrapper";
import { FormSkeleton } from "@/components/skeletons";

export const Route = createFileRoute(
  "/_authenticated/$slug/settings/developer/webhooks"
)({
  component: WebhooksPage,
  pendingComponent: FormSkeleton,
});

function WebhooksPage() {
  return (
    <PageWrapper
      description="Receive real-time HTTPS events and optional Slack notifications."
      title="Webhooks"
    >
      <FeatureGate
        description="Outbound webhook endpoints and delivery history require Professional."
        feature="Webhooks"
        tier="pro"
      >
        <LayerCard>
          <LayerCard.Secondary>
            <Text as="h2" variant="heading">
              Webhooks
            </Text>
            <Text variant="secondary">
              HTTPS webhook endpoints, delivery history, and Slack notifications
              are currently managed in Vortex Auth.
            </Text>
          </LayerCard.Secondary>
          <LayerCard.Primary>
            <Text variant="secondary" as="p">
              No webhook endpoints to display.
            </Text>
          </LayerCard.Primary>
        </LayerCard>
      </FeatureGate>
    </PageWrapper>
  );
}
