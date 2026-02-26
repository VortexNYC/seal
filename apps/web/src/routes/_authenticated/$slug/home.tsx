/**
 * Workspace Home/Dashboard Page
 *
 * SEA-129: Sender Dashboard
 *
 * Main dashboard with stats, charts, recent documents, and activity
 * Route: /{slug}/home
 */

import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { Link, createFileRoute, useRouter } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import {
  ActivityIcon,
  AlertTriangleIcon,
  ArrowRightIcon,
  BarChart3Icon,
  CheckCircle2Icon,
  ClockIcon,
  FileEditIcon,
  FilePlusIcon,
  FileTextIcon,
  MailIcon,
  MailXIcon,
  PenToolIcon,
  TrendingUpIcon,
  UploadIcon,
  UserPlusIcon,
  UsersIcon,
  XCircleIcon,
} from "lucide-react";
import { Suspense, useMemo } from "react";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { ExportDataDialog } from "@/components/dashboard/export-data-dialog";
import { WorkflowStatusBadge } from "@/components/documents/workflow-status-badge";
import { PageWrapper } from "@/components/page-wrapper";
import { DashboardSkeleton } from "@/components/skeletons/dashboard-skeleton";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { pageSEO } from "@/lib/seo";
import { api } from "@seal/backend/convex/_generated/api";
import type { Id } from "@seal/backend/convex/_generated/dataModel";

export const Route = createFileRoute("/_authenticated/$slug/home")({
  component: WorkspaceHome,
  pendingComponent: DashboardSkeleton,
  head: () => ({
    meta: [
      { title: pageSEO.dashboard.title },
      { name: "description", content: pageSEO.dashboard.description },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

function StatsCards() {
  const { data: stats } = useSuspenseQuery(convexQuery(api.dashboard.queries.getDocumentStats, {}));

  const monthStats = useQuery(api.dashboard.queries.getPeriodStats, {
    period: "month",
  });

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Documents</CardTitle>
          <FileTextIcon className="text-muted-foreground h-4 w-4" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.total}</div>
          <p className="text-muted-foreground text-xs">
            {monthStats?.created ?? 0} created this month
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Pending Signatures</CardTitle>
          <ClockIcon className="text-warning h-4 w-4" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.pending}</div>
          <p className="text-muted-foreground text-xs">
            {stats.sent} sent, {stats.inProgress} in progress
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Completed</CardTitle>
          <CheckCircle2Icon className="text-success h-4 w-4" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.completed}</div>
          <p className="text-muted-foreground text-xs">
            {monthStats?.completed ?? 0} completed this month
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Completion Rate</CardTitle>
          <TrendingUpIcon className="text-info h-4 w-4" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.completionRate}%</div>
          <Progress value={stats.completionRate} className="mt-2 h-2" />
        </CardContent>
      </Card>
    </div>
  );
}

function TrendChart() {
  const { data: trends } = useSuspenseQuery(
    convexQuery(api.dashboard.queries.getDocumentTrends, { days: 30 }),
  );

  const chartData = useMemo(() => {
    return trends.map((item) => ({
      ...item,
      // Format date for display
      displayDate: new Date(item.date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
    }));
  }, [trends]);

  const hasData = chartData.some((d) => d.created > 0 || d.completed > 0);

  return (
    <Card className="lg:col-span-2">
      <CardHeader className="pb-2 sm:pb-6">
        <CardTitle className="text-base sm:text-lg">Document Activity</CardTitle>
        <CardDescription className="text-xs sm:text-sm">
          Documents created and completed over the last 30 days
        </CardDescription>
      </CardHeader>
      <CardContent className="pl-0 sm:pl-6">
        {hasData ? (
          <ResponsiveContainer width="100%" height={200} className="sm:h-[250px]">
            <AreaChart data={chartData} margin={{ left: 0, right: 8 }}>
              <defs>
                <linearGradient id="colorCreated" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="displayDate"
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
                width={30}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--background))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "6px",
                  fontSize: "12px",
                }}
              />
              <Area
                type="monotone"
                dataKey="created"
                stroke="hsl(var(--primary))"
                fillOpacity={1}
                fill="url(#colorCreated)"
                name="Created"
              />
              <Area
                type="monotone"
                dataKey="completed"
                stroke="#22c55e"
                fillOpacity={1}
                fill="url(#colorCompleted)"
                name="Completed"
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-muted-foreground flex h-[200px] items-center justify-center text-sm sm:h-[250px]">
            No document activity yet. Create your first document to see trends.
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RecentDocuments() {
  const { slug } = Route.useParams();
  const router = useRouter();

  const { data: recentDocs } = useSuspenseQuery(
    convexQuery(api.dashboard.queries.getRecentDocuments, { limit: 5 }),
  );

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffHours < 1) {
      return "Just now";
    }
    if (diffHours < 24) {
      return `${diffHours}h ago`;
    }
    if (diffDays < 7) {
      return `${diffDays}d ago`;
    }
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Recent Documents</CardTitle>
          <CardDescription>Your latest documents</CardDescription>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.navigate({ to: "/$slug/documents", params: { slug }, search: { folderId: undefined } })}
        >
          View all
          <ArrowRightIcon className="ml-2 h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent>
        {recentDocs.length === 0 ? (
          <div className="text-muted-foreground flex h-32 items-center justify-center text-sm">
            No documents yet
          </div>
        ) : (
          <div className="space-y-2 sm:space-y-4">
            {recentDocs.map((doc) => (
              <div
                key={doc._id}
                className="hover:bg-muted/50 -mx-2 flex min-h-[56px] cursor-pointer items-center justify-between rounded-lg px-2 py-3 transition-colors sm:py-2"
                onClick={() =>
                  router.navigate({
                    to: "/$slug/documents/$documentId",
                    params: { slug, documentId: doc._id },
                  })
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    router.navigate({
                      to: "/$slug/documents/$documentId",
                      params: { slug, documentId: doc._id },
                    });
                  }
                }}
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <div className="bg-muted flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded">
                    {doc.thumbnailDataUrl ? (
                      <img
                        src={doc.thumbnailDataUrl}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <FileTextIcon className="text-muted-foreground h-5 w-5" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-1 truncate text-sm font-medium">{doc.name}</p>
                    <p className="text-muted-foreground text-xs">
                      {formatDate(doc.updatedAt)} · {doc.signedCount}/{doc.recipientCount} signed
                    </p>
                  </div>
                </div>
                <WorkflowStatusBadge status={doc.workflowStatus} />
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function QuickActions() {
  const { slug } = Route.useParams();
  const router = useRouter();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Quick Actions</CardTitle>
        <CardDescription>Get started quickly</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <Button
          className="min-h-[44px] w-full justify-start"
          onClick={() => router.navigate({ to: "/$slug/documents", params: { slug }, search: { folderId: undefined } })}
        >
          <UploadIcon className="mr-2 h-4 w-4" />
          Upload Document
        </Button>
        <Button
          variant="outline"
          className="min-h-[44px] w-full justify-start"
          onClick={() => router.navigate({ to: "/$slug/templates", params: { slug }, search: { folderId: undefined } })}
        >
          <FileTextIcon className="mr-2 h-4 w-4" />
          Use Template
        </Button>
        <Button
          variant="outline"
          className="min-h-[44px] w-full justify-start"
          onClick={() => router.navigate({ to: "/$slug/documents", params: { slug }, search: { folderId: undefined } })}
        >
          <FileTextIcon className="mr-2 h-4 w-4" />
          View All Documents
        </Button>
        <Button
          variant="outline"
          className="min-h-[44px] w-full justify-start"
          onClick={() => router.navigate({ to: "/$slug/analytics", params: { slug } })}
        >
          <BarChart3Icon className="mr-2 h-4 w-4" />
          View Analytics
        </Button>
      </CardContent>
    </Card>
  );
}

const ACTION_LABELS: Record<string, { label: string; icon: typeof ActivityIcon }> = {
  "document.created": { label: "created a document", icon: FilePlusIcon },
  "document.updated": { label: "updated a document", icon: FileEditIcon },
  "document.deleted": { label: "deleted a document", icon: XCircleIcon },
  "document.sent": { label: "sent a document for signing", icon: MailIcon },
  "document.viewed": { label: "viewed a document", icon: FileTextIcon },
  "document.completed": { label: "completed a document", icon: CheckCircle2Icon },
  "document.cancelled": { label: "cancelled a document", icon: XCircleIcon },
  "recipient.added": { label: "added a recipient", icon: UserPlusIcon },
  "recipient.signed": { label: "signed a document", icon: PenToolIcon },
  "recipient.declined": { label: "declined to sign", icon: XCircleIcon },
  "recipient.viewed": { label: "viewed a document", icon: FileTextIcon },
  "member.invited": { label: "invited a team member", icon: UserPlusIcon },
  "member.joined": { label: "joined the team", icon: UsersIcon },
  "member.removed": { label: "removed a team member", icon: XCircleIcon },
};

function getActionLabel(action: string): { label: string; icon: typeof ActivityIcon } {
  return ACTION_LABELS[action] ?? { label: action.replace(".", " "), icon: ActivityIcon };
}

function RecentActivity() {
  const activities = useQuery(api.dashboard.queries.getRecentActivity, { limit: 10 });

  const formatTimestamp = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMinutes < 1) return "Just now";
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  if (activities === undefined) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <CardDescription>Latest actions in your workspace</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex animate-pulse items-center gap-3">
                <div className="bg-muted h-8 w-8 rounded-full" />
                <div className="flex-1">
                  <div className="bg-muted mb-1 h-4 w-3/4 rounded" />
                  <div className="bg-muted h-3 w-1/4 rounded" />
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
        <CardDescription>Latest actions in your workspace</CardDescription>
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <div className="text-muted-foreground flex h-32 items-center justify-center text-sm">
            No recent activity
          </div>
        ) : (
          <div className="space-y-3">
            {activities.map((activity) => {
              const { label, icon: Icon } = getActionLabel(activity.action);
              return (
                <div key={activity._id} className="flex items-start gap-3">
                  <div className="bg-muted flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full">
                    <Icon className="text-muted-foreground h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">
                      <span className="font-medium">{activity.actorName}</span>{" "}
                      <span className="text-muted-foreground">{label}</span>
                    </p>
                    <p className="text-muted-foreground text-xs">
                      {formatTimestamp(activity.timestamp)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StatusBreakdown() {
  const { data: stats } = useSuspenseQuery(convexQuery(api.dashboard.queries.getDocumentStats, {}));

  const breakdown = [
    { label: "Draft", count: stats.draft, color: "bg-gray-400" },
    { label: "Sent", count: stats.sent, color: "bg-blue-500" },
    { label: "In Progress", count: stats.inProgress, color: "bg-amber-500" },
    { label: "Completed", count: stats.completed, color: "bg-green-500" },
    { label: "Cancelled", count: stats.cancelled, color: "bg-red-400" },
    { label: "Declined", count: stats.declined, color: "bg-red-600" },
  ].filter((item) => item.count > 0);

  const total = stats.total || 1; // Prevent division by zero

  return (
    <Card>
      <CardHeader>
        <CardTitle>Status Breakdown</CardTitle>
        <CardDescription>Document distribution by status</CardDescription>
      </CardHeader>
      <CardContent>
        {breakdown.length === 0 ? (
          <div className="text-muted-foreground flex h-24 items-center justify-center text-sm">
            No documents yet
          </div>
        ) : (
          <div className="space-y-3">
            {breakdown.map((item) => (
              <div key={item.label} className="flex items-center gap-3">
                <div className={`h-3 w-3 rounded-full ${item.color}`} />
                <div className="flex-1">
                  <div className="flex justify-between text-sm">
                    <span>{item.label}</span>
                    <span className="text-muted-foreground">
                      {item.count} ({Math.round((item.count / total) * 100)}%)
                    </span>
                  </div>
                  <Progress value={(item.count / total) * 100} className="mt-1 h-1.5" />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function WorkspaceHome() {
  const { slug } = Route.useParams();

  const organization = useQuery(api.organizations.queries.getOrganization, {
    slug,
  });

  const orgId = organization?._id as Id<"organizations"> | undefined;

  const memberCount = useQuery(
    api.organizations.queries.getOrganizationMemberCount,
    orgId ? { organizationId: orgId } : "skip",
  );

  // Loading state handled by pendingComponent
  if (!organization || !orgId) {
    return null;
  }

  return (
    <PageWrapper title="Dashboard" headerActions={<ExportDataDialog />}>
      <div className="space-y-6">
        {/* Stats Cards */}
        <Suspense
          fallback={
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Card key={i} className="animate-pulse">
                  <CardHeader className="pb-2">
                    <div className="bg-muted h-4 w-1/2 rounded" />
                  </CardHeader>
                  <CardContent>
                    <div className="bg-muted mb-2 h-8 w-1/4 rounded" />
                    <div className="bg-muted h-3 w-3/4 rounded" />
                  </CardContent>
                </Card>
              ))}
            </div>
          }
        >
          <StatsCards />
        </Suspense>

        {/* Charts and Recent Activity */}
        <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
          {/* Trend Chart */}
          <Suspense
            fallback={
              <Card className="lg:col-span-2">
                <CardHeader className="pb-2 sm:pb-6">
                  <div className="bg-muted mb-2 h-5 w-1/3 rounded" />
                  <div className="bg-muted h-4 w-1/2 rounded" />
                </CardHeader>
                <CardContent>
                  <div className="bg-muted h-[200px] animate-pulse rounded sm:h-[250px]" />
                </CardContent>
              </Card>
            }
          >
            <TrendChart />
          </Suspense>

          {/* Status Breakdown */}
          <Suspense
            fallback={
              <Card>
                <CardHeader>
                  <div className="bg-muted mb-2 h-5 w-1/2 rounded" />
                  <div className="bg-muted h-4 w-3/4 rounded" />
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="bg-muted h-6 rounded" />
                    ))}
                  </div>
                </CardContent>
              </Card>
            }
          >
            <StatusBreakdown />
          </Suspense>
        </div>

        {/* Recent Documents and Quick Actions */}
        <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Suspense
              fallback={
                <Card>
                  <CardHeader>
                    <div className="bg-muted mb-2 h-5 w-1/3 rounded" />
                    <div className="bg-muted h-4 w-1/2 rounded" />
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} className="flex animate-pulse items-center gap-3">
                          <div className="bg-muted h-10 w-10 rounded" />
                          <div className="flex-1">
                            <div className="bg-muted mb-2 h-4 w-1/2 rounded" />
                            <div className="bg-muted h-3 w-1/3 rounded" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              }
            >
              <RecentDocuments />
            </Suspense>
          </div>

          <QuickActions />
        </div>

        {/* Recent Activity */}
        <RecentActivity />

        {/* Needs Attention */}
        <Suspense fallback={null}>
          <NeedsAttention />
        </Suspense>

        {/* Team Info Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <div>
              <CardTitle>Team Overview</CardTitle>
              <CardDescription>{organization.name}</CardDescription>
            </div>
            <UsersIcon className="text-muted-foreground h-5 w-5" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{memberCount?.active ?? 0} active members</div>
            <p className="text-muted-foreground text-sm">
              {memberCount?.total ?? 0} total members ·{" "}
              {(memberCount?.total ?? 0) - (memberCount?.active ?? 0)} pending
            </p>
          </CardContent>
        </Card>
      </div>
    </PageWrapper>
  );
}

// ─── Needs Attention Section ──────────────────

function NeedsAttention() {
  const { slug } = Route.useParams();
  const attention = useQuery(api.dashboard.analytics_queries.getDocumentsNeedingAttention);

  if (!attention || attention.totalIssues === 0) return null;

  return (
    <Card className="border-amber-200 dark:border-amber-900">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <AlertTriangleIcon className="h-4 w-4 text-amber-500" />
          <CardTitle className="text-base">Needs Attention</CardTitle>
          <span className="text-muted-foreground text-xs">
            {attention.totalIssues} issue{attention.totalIssues !== 1 ? "s" : ""}
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {attention.staleRecipients.map((item) => (
            <Link
              key={`stale-${item.documentId}-${item.recipientEmail}`}
              to="/$slug/documents/$documentId"
              params={{ slug, documentId: item.documentId }}
              className="flex items-center gap-3 rounded-md p-2 transition-colors hover:bg-muted"
            >
              <ClockIcon className="h-4 w-4 shrink-0 text-amber-500" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">
                  <span className="font-medium">{item.recipientName}</span> hasn&apos;t viewed{" "}
                  <span className="font-medium">{item.documentName}</span>
                </p>
                <p className="text-muted-foreground text-xs">
                  Pending for {item.daysPending} day{item.daysPending !== 1 ? "s" : ""}
                </p>
              </div>
            </Link>
          ))}

          {attention.approachingDeadline.map((item) => (
            <Link
              key={`deadline-${item.documentId}`}
              to="/$slug/documents/$documentId"
              params={{ slug, documentId: item.documentId }}
              className="flex items-center gap-3 rounded-md p-2 transition-colors hover:bg-muted"
            >
              <AlertTriangleIcon className="h-4 w-4 shrink-0 text-red-500" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">
                  <span className="font-medium">{item.documentName}</span> deadline in{" "}
                  {item.daysRemaining} day{item.daysRemaining !== 1 ? "s" : ""}
                </p>
                <p className="text-muted-foreground text-xs">
                  {item.unsignedCount} unsigned recipient{item.unsignedCount !== 1 ? "s" : ""}
                </p>
              </div>
            </Link>
          ))}

          {attention.bouncedEmails.map((item) => (
            <Link
              key={`bounce-${item.documentId}-${item.recipientEmail}`}
              to="/$slug/documents/$documentId"
              params={{ slug, documentId: item.documentId }}
              className="flex items-center gap-3 rounded-md p-2 transition-colors hover:bg-muted"
            >
              <MailXIcon className="h-4 w-4 shrink-0 text-red-500" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">
                  Email bounced for <span className="font-medium">{item.recipientEmail}</span>
                </p>
                <p className="text-muted-foreground text-xs">{item.documentName}</p>
              </div>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
