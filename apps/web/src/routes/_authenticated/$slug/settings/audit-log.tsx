/**
 * Audit Log Settings Page
 *
 * Route: /{slug}/settings/audit-log
 */

import { createFileRoute } from "@tanstack/react-router";

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
  "/_authenticated/$slug/settings/audit-log"
)({
  component: AuditLogPage,
  pendingComponent: FormSkeleton,
});

function AuditLogPage() {
  return (
    <PageWrapper title="Audit Log">
      <Card>
        <CardHeader>
          <CardTitle>Audit events</CardTitle>
          <CardDescription>
            The organization audit trail is managed in the legacy backend while
            it is migrated to the Cloudflare Worker data layer. This view will
            be restored once audit events are available through the Worker API.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">No events to display.</p>
        </CardContent>
      </Card>
    </PageWrapper>
  );
}
