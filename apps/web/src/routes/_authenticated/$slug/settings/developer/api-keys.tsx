/**
 * Developer Settings - API Keys
 *
 * Core Vortex surfaces removed. API keys are managed in Vortex Auth.
 * Route: /{slug}/settings/developer/api-keys
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
        <Card>
          <CardHeader>
            <CardTitle>API keys</CardTitle>
            <CardDescription>
              Workspace API keys are currently managed in Vortex Auth. Product
              API keys for the Seal REST API will be available here once the
              auth surface is fully migrated.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">
              No API keys to display.
            </p>
          </CardContent>
        </Card>
      </FeatureGate>
    </PageWrapper>
  );
}
