/**
 * Audit Log Settings Page
 *
 * Route: /{slug}/settings/audit-log
 */

import { Text } from "@cloudflare/kumo/components/text";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  isOrganizationAdminRole,
  SecurityAuditList,
} from "@vortex-api/better-auth-ui";
import { useState } from "react";

import { PageWrapper } from "@/components/page-wrapper";
import { SettingsBody } from "@/components/settings-body";
import { PageFormSkeleton } from "@/components/skeletons";
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
  pendingComponent: () => <PageFormSkeleton title="Audit Log" />,
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

  const isAdmin = isOrganizationAdminRole(organization?.userRole);

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
      <SettingsBody>
        <SecurityAuditList
          events={(data?.entries ?? []).map((entry) => ({
            id: entry.id,
            createdAt: formatDate(entry.createdAt),
            action: entry.action,
            actor: `${entry.actorType}:${entry.actorId.slice(0, 8)}`,
            target: entry.resourceId
              ? `${entry.resourceType} ${entry.resourceId.slice(0, 8)}`
              : entry.resourceType,
          }))}
          server={{
            action,
            resourceType,
            actor,
            from,
            to,
            onActionChange: setAction,
            onResourceTypeChange: setResourceType,
            onActorChange: setActor,
            onFromChange: setFrom,
            onToChange: setTo,
            onApply: applyFilters,
            onClear: clearFilters,
            pageLabel: `Page ${pageIndex + 1}`,
            hasPrevious: pageIndex > 0,
            hasNext: data?.has_more === true,
            onPrevious: goPrevious,
            onNext: goNext,
            isLoading: isPending,
            error: isError
              ? error instanceof Error
                ? error.message
                : "Failed to load audit log"
              : null,
          }}
        />
      </SettingsBody>
    </PageWrapper>
  );
}
