/**
 * Audit Log Settings Page
 *
 * Route: /{slug}/settings/audit-log
 */

import { Button } from "@cloudflare/kumo/components/button";
import { Empty } from "@cloudflare/kumo/components/empty";
import { Input } from "@cloudflare/kumo/components/input";
import { Label } from "@cloudflare/kumo/components/label";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Table } from "@cloudflare/kumo/components/table";
import { Text } from "@cloudflare/kumo/components/text";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { PageWrapper } from "@/components/page-wrapper";
import { FormSkeleton } from "@/components/skeletons";
import { useOrganization } from "@/hooks/use-organization";
import { getAuditLogs, type AuditLogList } from "@/lib/api-client";

export const Route = createFileRoute(
  "/_authenticated/$slug/settings/audit-log"
)({
  component: AuditLogPage,
  pendingComponent: FormSkeleton,
});

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString();
}

function AuditLogPage() {
  const { slug } = Route.useParams();
  const { data: organization } = useOrganization(slug);

  const [action, setAction] = useState("");
  const [resourceType, setResourceType] = useState("");
  const [limit] = useState(25);

  const { data, isPending, isError, error } = useQuery<AuditLogList>({
    queryKey: ["audit-logs", slug, action, resourceType],
    queryFn: () =>
      getAuditLogs(slug, {
        action: action || undefined,
        resourceType: resourceType || undefined,
        limit,
      }),
  });

  const isAdmin =
    organization?.userRole === "owner" || organization?.userRole === "admin";

  if (!isAdmin) {
    return (
      <PageWrapper title="Audit Log">
        <Text variant="secondary">
          You need admin access to view audit logs.
        </Text>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper
      description="Review workspace activity and audit events."
      title="Audit Log"
    >
      <LayerCard>
        <LayerCard.Secondary>
          <Text as="h2" variant="heading">
            Audit events
          </Text>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-2">
              <Label htmlFor="audit-action">Action</Label>
              <Input
                id="audit-action"
                placeholder="e.g. api_token.create"
                value={action}
                onChange={(e) => setAction(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="audit-resource-type">Resource type</Label>
              <Input
                id="audit-resource-type"
                placeholder="e.g. api_token"
                value={resourceType}
                onChange={(e) => setResourceType(e.target.value)}
              />
            </div>
          </div>
        </LayerCard.Secondary>
        <LayerCard.Primary>
          {isPending ? (
            <Text variant="secondary">Loading audit events…</Text>
          ) : isError ? (
            <Text as="p" variant="error">
              {error instanceof Error
                ? error.message
                : "Failed to load audit log"}
            </Text>
          ) : data?.entries.length ? (
            <Table>
              <Table.Header>
                <Table.Row>
                  <Table.Head>Time</Table.Head>
                  <Table.Head>Actor</Table.Head>
                  <Table.Head>Action</Table.Head>
                  <Table.Head>Resource</Table.Head>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {data.entries.map((entry) => (
                  <Table.Row key={entry.id}>
                    <Table.Cell>{formatDate(entry.createdAt)}</Table.Cell>
                    <Table.Cell>
                      <Text as="span" variant="mono-secondary">
                        {entry.actorType}:{entry.actorId.slice(0, 8)}
                      </Text>
                    </Table.Cell>
                    <Table.Cell>{entry.action}</Table.Cell>
                    <Table.Cell>
                      {entry.resourceType}
                      {entry.resourceId ? (
                        <>
                          {" "}
                          <Text as="span" variant="mono-secondary">
                            {entry.resourceId.slice(0, 8)}
                          </Text>
                        </>
                      ) : null}
                    </Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table>
          ) : (
            <Empty
              title="No events"
              description="No audit events match your filters."
            />
          )}
          {data?.has_more ? (
            <div className="mt-4 flex justify-end">
              <Button
                onClick={() => {
                  // Pagination can be wired with next_cursor when needed.
                }}
                variant="secondary"
              >
                Load more
              </Button>
            </div>
          ) : null}
        </LayerCard.Primary>
      </LayerCard>
    </PageWrapper>
  );
}
