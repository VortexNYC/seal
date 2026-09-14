/**
 * Audit Log Settings Page
 *
 * Route: /{slug}/settings/audit-log
 */

import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Text } from "@cloudflare/kumo/components/text";
import { createFileRoute } from "@tanstack/react-router";

import { PageWrapper } from "@/components/page-wrapper";
import { FormSkeleton } from "@/components/skeletons";

export const Route = createFileRoute(
  "/_authenticated/$slug/settings/audit-log"
)({
  component: AuditLogPage,
  pendingComponent: FormSkeleton,
});

function AuditLogPage() {
  return (
    <PageWrapper title="Audit Log">
      <LayerCard>
        <LayerCard.Secondary>
          <Text as="h2" variant="heading">
            Audit events
          </Text>
          <Text variant="secondary">
            The organization audit trail is managed in the legacy backend while
            it is migrated to the Cloudflare Worker data layer. This view will
            be restored once audit events are available through the Worker API.
          </Text>
        </LayerCard.Secondary>
        <LayerCard.Primary>
          <Text variant="secondary" as="p">
            No events to display.
          </Text>
        </LayerCard.Primary>
      </LayerCard>
    </PageWrapper>
  );
}
