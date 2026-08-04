/**
 * Audit Log Settings Page
 *
 * Organization-wide activity audit trail — admin/owner only.
 * Route: /{slug}/settings/audit-log
 */

import { api } from "@seal/backend/convex/_generated/api";
import type { AuditAction } from "@seal/backend/convex/schemas/audit_logs";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import {
  DownloadIcon,
  FileTextIcon,
  ShieldCheckIcon,
  UserIcon,
  UsersIcon,
} from "lucide-react";
import { useMemo, useState } from "react";

import { PageWrapper } from "@/components/page-wrapper";
import { FormSkeleton } from "@/components/skeletons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export const Route = createFileRoute(
  "/_authenticated/$slug/settings/audit-log"
)({
  component: AuditLogPage,
  pendingComponent: FormSkeleton,
});

// ─── Action metadata ────────────────────────────────────────────────────────

type ActionCategory =
  | "all"
  | "document"
  | "recipient"
  | "signature"
  | "member"
  | "organization";

const ACTION_CATEGORY_LABELS: Record<ActionCategory, string> = {
  all: "All actions",
  document: "Document events",
  recipient: "Recipient events",
  signature: "Signature events",
  member: "Member events",
  organization: "Organization events",
};

const ACTIONS_BY_CATEGORY: Record<ActionCategory, AuditAction[]> = {
  all: [],
  document: [
    "document.created",
    "document.updated",
    "document.deleted",
    "document.sent",
    "document.viewed",
    "document.completed",
    "document.cancelled",
    "document.expired",
    "document.ownership_transferred",
  ],
  recipient: [
    "recipient.added",
    "recipient.updated",
    "recipient.removed",
    "recipient.viewed",
    "recipient.signed",
    "recipient.declined",
    "recipient.esign_consent",
    "recipient.esign_opt_out",
    "recipient.expired",
    "recipient.dictated",
  ],
  signature: ["signature.created", "signature.updated"],
  member: [
    "member.invited",
    "member.joined",
    "member.removed",
    "member.role_changed",
  ],
  organization: [
    "organization.created",
    "organization.updated",
    "organization.deleted",
    "user.login",
    "user.logout",
    "user.updated",
  ],
};

function getActionLabel(action: AuditAction): string {
  const labels: Record<AuditAction, string> = {
    "document.created": "Document created",
    "document.updated": "Document updated",
    "document.deleted": "Document deleted",
    "document.sent": "Document sent",
    "document.viewed": "Document viewed",
    "document.completed": "Document completed",
    "document.cancelled": "Document cancelled",
    "document.expired": "Document expired",
    "document.ownership_transferred": "Ownership transferred",
    "field.created": "Field created",
    "field.updated": "Field updated",
    "field.deleted": "Field deleted",
    "recipient.added": "Recipient added",
    "recipient.updated": "Recipient updated",
    "recipient.removed": "Recipient removed",
    "recipient.viewed": "Document viewed",
    "recipient.signed": "Document signed",
    "recipient.declined": "Signing declined",
    "recipient.esign_consent": "eSign consent given",
    "recipient.esign_opt_out": "eSign opt-out",
    "recipient.expired": "Signing expired",
    "recipient.dictated": "Signing delegated",
    "signature.created": "Signature created",
    "signature.updated": "Signature updated",
    "organization.created": "Organization created",
    "organization.updated": "Organization updated",
    "organization.deleted": "Organization deleted",
    "member.invited": "Member invited",
    "member.joined": "Member joined",
    "member.removed": "Member removed",
    "member.role_changed": "Role changed",
    "user.login": "Signed in",
    "user.logout": "Signed out",
    "user.updated": "Account updated",
    "email.queued": "Email queued",
    "email.delivered": "Email delivered",
    "email.opened": "Email opened",
    "email.bounced": "Email bounced",
    "email.failed": "Email failed",
    other: "Other",
  };
  return labels[action] ?? action;
}

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

function getActionBadgeVariant(action: AuditAction): BadgeVariant {
  if (
    action === "document.viewed" ||
    action === "recipient.viewed" ||
    action === "recipient.signed" ||
    action === "document.completed" ||
    action === "recipient.esign_consent" ||
    action === "member.joined"
  ) {
    return "default";
  }
  if (
    action === "document.deleted" ||
    action === "document.cancelled" ||
    action === "document.expired" ||
    action === "recipient.declined" ||
    action === "recipient.esign_opt_out" ||
    action === "recipient.expired" ||
    action === "member.removed"
  ) {
    return "destructive";
  }
  return "secondary";
}

// ─── Date preset helpers ────────────────────────────────────────────────────

type DatePreset = "7d" | "30d" | "90d" | "custom";

function presetToRange(
  preset: DatePreset
): { from: number; to: number } | null {
  if (preset === "custom") return null;
  const now = Date.now();
  const days = preset === "7d" ? 7 : preset === "30d" ? 30 : 90;
  return { from: now - days * 24 * 60 * 60 * 1000, to: now };
}

// ─── CSV export ─────────────────────────────────────────────────────────────

type AuditLogRow = {
  _id: string;
  action: AuditAction;
  actorType: string;
  userId?: string;
  createdAt: number;
  ipAddress: string;
  documentId?: string;
  metadata?: { description?: string };
};

function downloadCsv(rows: AuditLogRow[]) {
  const headers = [
    "Date",
    "Action",
    "Actor Type",
    "User ID",
    "Document ID",
    "IP Address",
    "Description",
  ];
  const lines = [
    headers.join(","),
    ...rows.map((r) =>
      [
        new Date(r.createdAt).toISOString(),
        getActionLabel(r.action),
        r.actorType,
        r.userId ?? "",
        r.documentId ?? "",
        r.ipAddress,
        r.metadata?.description ?? "",
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(",")
    ),
  ];
  const blob = new Blob([lines.join("\n")], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Relative time ──────────────────────────────────────────────────────────

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
}

// ─── Page component ──────────────────────────────────────────────────────────

function AuditLogPage() {
  const { slug } = Route.useParams();

  const [datePreset, setDatePreset] = useState<DatePreset>("30d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [actionCategory, setActionCategory] = useState<ActionCategory>("all");
  const [actorUserId, setActorUserId] = useState<string>("all");

  const dateRange = useMemo(() => {
    if (datePreset !== "custom") return presetToRange(datePreset);
    const from = customFrom ? new Date(customFrom).getTime() : undefined;
    const to = customTo ? new Date(customTo).getTime() + 86_400_000 : undefined;
    if (!from && !to) return null;
    return { from: from ?? 0, to: to ?? Date.now() };
  }, [datePreset, customFrom, customTo]);

  const actionsFilter = useMemo(() => {
    if (actionCategory === "all") return undefined;
    return ACTIONS_BY_CATEGORY[actionCategory];
  }, [actionCategory]);

  const organization = useQuery(api.organizations.queries.getOrganization, {
    slug,
  });
  const members = useQuery(
    api.organizations.queries.getOrganizationMembers,
    organization ? { organizationId: organization._id } : "skip"
  );

  const logs = useQuery(api.audit_logs.queries.listOrgAuditLogs, {
    dateFrom: dateRange?.from,
    dateTo: dateRange?.to,
    actions: actionsFilter,
    actorUserId: actorUserId !== "all" ? actorUserId : undefined,
    limit: 200,
  });

  const isAdmin =
    organization?.userRole === "admin" || organization?.userRole === "owner";

  if (!isAdmin) {
    return (
      <PageWrapper title="Audit Log">
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground text-sm">
              Only admins and owners can view the audit log.
            </p>
          </CardContent>
        </Card>
      </PageWrapper>
    );
  }

  return (
    <PageWrapper title="Audit Log">
      <div className="space-y-4">
        {/* Filters */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Filters</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Date presets */}
            <div className="space-y-2">
              <Label className="text-sm">Date range</Label>
              <div className="flex flex-wrap gap-2">
                {(["7d", "30d", "90d", "custom"] as DatePreset[]).map((p) => (
                  <Button
                    key={p}
                    variant={datePreset === p ? "default" : "outline"}
                    size="sm"
                    onClick={() => setDatePreset(p)}
                  >
                    {p === "7d"
                      ? "Last 7 days"
                      : p === "30d"
                        ? "Last 30 days"
                        : p === "90d"
                          ? "Last 90 days"
                          : "Custom"}
                  </Button>
                ))}
              </div>
              {datePreset === "custom" && (
                <div className="flex gap-2">
                  <div className="flex-1 space-y-1">
                    <Label className="text-muted-foreground text-xs">
                      From
                    </Label>
                    <Input
                      type="date"
                      value={customFrom}
                      onChange={(e) => setCustomFrom(e.target.value)}
                    />
                  </div>
                  <div className="flex-1 space-y-1">
                    <Label className="text-muted-foreground text-xs">To</Label>
                    <Input
                      type="date"
                      value={customTo}
                      onChange={(e) => setCustomTo(e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-4">
              {/* Action category */}
              <div className="min-w-[200px] flex-1 space-y-1">
                <Label className="text-sm">Action type</Label>
                <Select
                  value={actionCategory}
                  onValueChange={(v) => setActionCategory(v as ActionCategory)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(
                      Object.keys(ACTION_CATEGORY_LABELS) as ActionCategory[]
                    ).map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {ACTION_CATEGORY_LABELS[cat]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* User filter */}
              <div className="min-w-[200px] flex-1 space-y-1">
                <Label className="text-sm">User</Label>
                <Select value={actorUserId} onValueChange={setActorUserId}>
                  <SelectTrigger>
                    <SelectValue placeholder="All users" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All users</SelectItem>
                    {members?.map((m) => (
                      <SelectItem key={m.userId} value={m.userId}>
                        {m.name ?? m.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results */}
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground text-sm">
            {logs !== undefined
              ? `${logs.length} event${logs.length !== 1 ? "s" : ""}`
              : "Loading…"}
          </p>
          <Button
            variant="outline"
            size="sm"
            disabled={!logs || logs.length === 0}
            onClick={() => logs && downloadCsv(logs as AuditLogRow[])}
          >
            <DownloadIcon className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>

        <Card>
          <CardContent className="p-0">
            {logs === undefined ? (
              <div className="p-6">
                <FormSkeleton />
              </div>
            ) : logs.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-16 text-center">
                <ShieldCheckIcon className="text-muted-foreground h-8 w-8" />
                <p className="text-muted-foreground text-sm">
                  No events found for this period.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[140px]">Date</TableHead>
                      <TableHead>Action</TableHead>
                      <TableHead className="hidden md:table-cell">
                        Actor
                      </TableHead>
                      <TableHead className="hidden lg:table-cell">
                        Resource
                      </TableHead>
                      <TableHead className="hidden xl:table-cell">IP</TableHead>
                      <TableHead className="hidden xl:table-cell">
                        Details
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {logs.map((log) => (
                      <AuditLogTableRow
                        key={log._id}
                        log={log}
                        members={members}
                      />
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PageWrapper>
  );
}

// ─── Row component ───────────────────────────────────────────────────────────

type Member = {
  userId: string;
  name: string | null | undefined;
  email: string;
};

function AuditLogTableRow({
  log,
  members,
}: {
  log: {
    _id: string;
    action: AuditAction;
    actorType: string;
    userId?: string;
    createdAt: number;
    ipAddress: string;
    documentId?: string;
    metadata?: { description?: string; source?: string };
    userAgent?: string;
  };
  members: Member[] | undefined;
}) {
  const [expanded, setExpanded] = useState(false);

  const actor = useMemo(() => {
    if (log.actorType === "system")
      return { label: "System", icon: ShieldCheckIcon };
    if (log.actorType === "recipient")
      return { label: "Recipient", icon: UserIcon };
    const member = members?.find((m) => m.userId === log.userId);
    return {
      label: member ? (member.name ?? member.email) : (log.userId ?? "Unknown"),
      icon: UsersIcon,
    };
  }, [log, members]);

  const ActorIcon = actor.icon;

  return (
    <>
      <TableRow
        className="hover:bg-muted/50 cursor-pointer"
        onClick={() => setExpanded((v) => !v)}
      >
        <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
          <span title={new Date(log.createdAt).toLocaleString()}>
            {relativeTime(log.createdAt)}
          </span>
        </TableCell>
        <TableCell>
          <Badge
            variant={getActionBadgeVariant(log.action)}
            className="text-xs"
          >
            {getActionLabel(log.action)}
          </Badge>
        </TableCell>
        <TableCell className="hidden md:table-cell">
          <div className="flex items-center gap-1.5 text-sm">
            <ActorIcon className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
            <span className="max-w-[160px] truncate">{actor.label}</span>
          </div>
        </TableCell>
        <TableCell className="hidden lg:table-cell">
          {log.documentId ? (
            <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
              <FileTextIcon className="h-3.5 w-3.5 shrink-0" />
              <span className="max-w-[120px] truncate font-mono">
                {log.documentId.slice(-8)}
              </span>
            </div>
          ) : (
            <span className="text-muted-foreground text-xs">—</span>
          )}
        </TableCell>
        <TableCell className="text-muted-foreground hidden font-mono text-xs xl:table-cell">
          {log.ipAddress !== "unknown" ? log.ipAddress : "—"}
        </TableCell>
        <TableCell className="text-muted-foreground hidden max-w-[200px] truncate text-xs xl:table-cell">
          {log.metadata?.description ?? "—"}
        </TableCell>
      </TableRow>
      {expanded && (
        <TableRow>
          <TableCell colSpan={6} className="bg-muted/30 p-4">
            <div className="grid gap-1 text-xs">
              <div className="flex gap-2">
                <span className="text-muted-foreground w-24 shrink-0">
                  Time
                </span>
                <span>{new Date(log.createdAt).toLocaleString()}</span>
              </div>
              <div className="flex gap-2">
                <span className="text-muted-foreground w-24 shrink-0">
                  Actor type
                </span>
                <span className="capitalize">{log.actorType}</span>
              </div>
              {log.userId && (
                <div className="flex gap-2">
                  <span className="text-muted-foreground w-24 shrink-0">
                    User ID
                  </span>
                  <span className="font-mono">{log.userId}</span>
                </div>
              )}
              {log.documentId && (
                <div className="flex gap-2">
                  <span className="text-muted-foreground w-24 shrink-0">
                    Document
                  </span>
                  <span className="font-mono">{log.documentId}</span>
                </div>
              )}
              {log.ipAddress !== "unknown" && (
                <div className="flex gap-2">
                  <span className="text-muted-foreground w-24 shrink-0">
                    IP address
                  </span>
                  <span className="font-mono">{log.ipAddress}</span>
                </div>
              )}
              {log.metadata?.source && (
                <div className="flex gap-2">
                  <span className="text-muted-foreground w-24 shrink-0">
                    Source
                  </span>
                  <span className="capitalize">{log.metadata.source}</span>
                </div>
              )}
              {log.metadata?.description && (
                <div className="flex gap-2">
                  <span className="text-muted-foreground w-24 shrink-0">
                    Description
                  </span>
                  <span>{log.metadata.description}</span>
                </div>
              )}
              {log.userAgent && (
                <div className="flex gap-2">
                  <span className="text-muted-foreground w-24 shrink-0">
                    User agent
                  </span>
                  <span className="break-all">{log.userAgent}</span>
                </div>
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}
