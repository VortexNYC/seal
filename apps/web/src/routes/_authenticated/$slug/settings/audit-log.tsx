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

const PAGE_LIMIT = 25;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString();
}

function toIsoString(local: string): string {
  const date = new Date(local);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

export const Route = createFileRoute(
  "/_authenticated/$slug/settings/audit-log"
)({
  component: AuditLogPage,
  pendingComponent: FormSkeleton,
});

function AuditLogPage() {
  const { slug } = Route.useParams();
  const { data: organization } = useOrganization(slug);

  const [action, setAction] = useState("");
  const [resourceType, setResourceType] = useState("");
  const [actor, setActor] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const [filters, setFilters] = useState({
    action: "",
    resourceType: "",
    actor: "",
    from: "",
    to: "",
  });

  const [cursorStack, setCursorStack] = useState<(string | undefined)[]>([
    undefined,
  ]);
  const [pageIndex, setPageIndex] = useState(0);
  const cursor = cursorStack[pageIndex];

  const { data, isPending, isError, error } = useQuery<AuditLogList>({
    queryKey: ["audit-logs", slug, filters, cursor, PAGE_LIMIT],
    queryFn: () =>
      getAuditLogs(slug, {
        action: filters.action || undefined,
        resourceType: filters.resourceType || undefined,
        actor: filters.actor || undefined,
        from: filters.from || undefined,
        to: filters.to || undefined,
        limit: PAGE_LIMIT,
        cursor,
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

  function applyFilters() {
    setFilters({
      action,
      resourceType,
      actor,
      from: from ? toIsoString(from) : "",
      to: to ? toIsoString(to) : "",
    });
    setCursorStack([undefined]);
    setPageIndex(0);
  }

  function clearFilters() {
    setAction("");
    setResourceType("");
    setActor("");
    setFrom("");
    setTo("");
    setFilters({
      action: "",
      resourceType: "",
      actor: "",
      from: "",
      to: "",
    });
    setCursorStack([undefined]);
    setPageIndex(0);
  }

  function goNext() {
    if (data?.has_more && data.next_cursor) {
      const nextStack = cursorStack.slice(0, pageIndex + 1);
      nextStack.push(data.next_cursor);
      setCursorStack(nextStack);
      setPageIndex(pageIndex + 1);
    }
  }

  function goPrevious() {
    if (pageIndex > 0) {
      setPageIndex(pageIndex - 1);
    }
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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="grid gap-2">
              <Label htmlFor="audit-action">Action</Label>
              <Input
                id="audit-action"
                placeholder="e.g. document.sent"
                value={action}
                onChange={(e) => setAction(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="audit-resource-type">Resource type</Label>
              <Input
                id="audit-resource-type"
                placeholder="e.g. document"
                value={resourceType}
                onChange={(e) => setResourceType(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="audit-actor">Actor</Label>
              <Input
                id="audit-actor"
                placeholder="Actor ID"
                value={actor}
                onChange={(e) => setActor(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="audit-from">From</Label>
              <Input
                id="audit-from"
                type="datetime-local"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="audit-to">To</Label>
              <Input
                id="audit-to"
                type="datetime-local"
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={applyFilters}>Apply filters</Button>
            <Button variant="secondary" onClick={clearFilters}>
              Clear
            </Button>
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
          <div className="mt-4 flex items-center justify-between">
            <Button
              variant="secondary"
              onClick={goPrevious}
              disabled={pageIndex === 0 || isPending}
            >
              Previous
            </Button>
            <Text variant="secondary">
              {data ? `Page ${pageIndex + 1}` : ""}
            </Text>
            <Button
              variant="secondary"
              onClick={goNext}
              disabled={!data?.has_more || isPending}
            >
              Next
            </Button>
          </div>
        </LayerCard.Primary>
      </LayerCard>
    </PageWrapper>
  );
}
