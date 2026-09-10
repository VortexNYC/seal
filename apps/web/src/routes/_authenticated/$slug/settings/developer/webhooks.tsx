/**
 * Developer Settings - Webhooks
 *
 * Core Vortex surfaces removed. Webhooks are managed in Vortex Auth.
 * Route: /{slug}/settings/developer/webhooks
 */

import { createFileRoute } from "@tanstack/react-router";

import { FeatureGate } from "@/components/feature-gate";
import { PageWrapper } from "@/components/page-wrapper";
import { FormSkeleton } from "@/components/skeletons";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

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
        <Card>
          <CardHeader>
            <CardTitle>Webhooks</CardTitle>
            <CardDescription>
              HTTPS webhook endpoints, delivery history, and Slack notifications
              are currently managed in Vortex Auth.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">
              No webhook endpoints to display.
            </p>
          </CardContent>
        </Card>
      </FeatureGate>
    </PageWrapper>
  );
}
