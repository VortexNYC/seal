/**
 * Developer Settings - API Keys
 *
 * Core Vortex surfaces removed. API keys are managed in Vortex Auth.
 * Route: /{slug}/settings/developer/api-keys
 */

import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Text } from "@cloudflare/kumo/components/text";
import { createFileRoute } from "@tanstack/react-router";

import { FeatureGate } from "@/components/feature-gate";
import { PageWrapper } from "@/components/page-wrapper";
import { FormSkeleton } from "@/components/skeletons";

export const Route = createFileRoute(
  "/_authenticated/$slug/settings/developer/api-keys"
)({
  component: ApiKeysPage,
  pendingComponent: FormSkeleton,
});

function ApiKeysPage() {
  return (
    <PageWrapper
      description="Manage API keys for programmatic access to Seal"
      title="API Keys"
    >
      <FeatureGate
        description="Create API keys to integrate Seal with your systems."
        feature="API access"
        tier="pro"
      >
        <LayerCard>
          <LayerCard.Secondary>
            <Text as="h2" variant="heading">
              API keys
            </Text>
            <Text variant="secondary">
              Workspace API keys are currently managed in Vortex Auth. Product
              API keys for the Seal REST API will be available here once the
              auth surface is fully migrated.
            </Text>
          </LayerCard.Secondary>
          <LayerCard.Primary>
            <Text variant="secondary" as="p">
              No API keys to display.
            </Text>
          </LayerCard.Primary>
        </LayerCard>
      </FeatureGate>
    </PageWrapper>
  );
}
