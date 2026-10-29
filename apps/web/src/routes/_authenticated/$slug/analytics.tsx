/**
 * Analytics Page
 *
 * View workspace analytics and insights
 * Route: /{slug}/analytics
 */

import { Badge } from "@cloudflare/kumo/components/badge";
import { Button } from "@cloudflare/kumo/components/button";
import { DatePicker } from "@cloudflare/kumo/components/date-picker";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Meter } from "@cloudflare/kumo/components/meter";
import { Popover } from "@cloudflare/kumo/components/popover";
import { Select } from "@cloudflare/kumo/components/select";
import { Table } from "@cloudflare/kumo/components/table";
import { Tabs } from "@cloudflare/kumo/components/tabs";
import { Text } from "@cloudflare/kumo/components/text";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowDown as ArrowDownIcon, ArrowUp as ArrowUpIcon, Calendar as CalendarIcon, ChartBar as BarChart3Icon, CheckCircle as CheckCircle2Icon, Clock as ClockIcon, DownloadSimple as DownloadIcon, FileText as FileTextIcon, TrendUp as TrendingUpIcon, Users as UsersIcon, XCircle as XCircleIcon } from "@phosphor-icons/react";
import {
  type Dispatch,
  type ReactElement,
  type SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { DateRange } from "react-day-picker";

import { Chart, echarts, kumoPaint, TimeseriesChart } from "@/lib/kumo-charts";

import { PageWrapper } from "@/components/page-wrapper";
import {
  AnalyticsSkeleton,
  AnalyticsTabSkeleton,
} from "@/components/skeletons/analytics-skeleton";
import { useSubscriptionLimits } from "@/hooks/use-subscription-limits";
import {
  getAnalyticsDocumentsForExport,
  getAnalyticsPeriodStats,
  getAnalyticsStats,
  getAnalyticsTrends,
  getEmailEngagementStats,
  getMemberActivity,
  getRecentActivity,
  getRecipientTimingStats,
  getTemplatePerformance,
} from "@/lib/api-client";
import { parseSelectValue } from "@/lib/select-values";
import { pageSEO } from "@/lib/seo";

export const Route = createFileRoute("/_authenticated/$slug/analytics")({
  component: AnalyticsPage,
  pendingComponent: AnalyticsSkeleton,
  head: () => ({
    meta: [
      { title: pageSEO.analytics.title },
      { name: "description", content: pageSEO.analytics.description },
    ],
  }),
});

function AnalyticsPage() {
  const { slug } = Route.useParams();
  const [activeTab, setActiveTab] = useState("activity");
  const [scope, setScope] = useState<AnalyticsScope>("personal");
  const [adminScopeInitialized, setAdminScopeInitialized] = useState(false);
  const [trendPreset, setTrendPreset] = useState<TrendPreset>("30");
  const [customRange, setCustomRange] = useState<DateRange | undefined>(
    undefined
  );

  // Use useQuery (not useSuspenseQuery) so real-time updates don't trigger Suspense remounts
  const { data: stats } = useQuery({
    queryKey: ["analytics", "stats", scope, slug],
    queryFn: () => getAnalyticsStats(slug, scope),
  });
  const isAdmin = stats?.isAdmin ?? false;

  // Default admins to team once — never re-lock after they pick Personal
  useEffect(() => {
    if (!isAdmin || adminScopeInitialized) {
      return;
    }
    setScope("team");
    setAdminScopeInitialized(true);
  }, [isAdmin, adminScopeInitialized]);

  // Non-admins are forced to personal scope
  const effectiveScope = isAdmin ? scope : "personal";

  if (!stats) {
    return <AnalyticsSkeleton />;
  }

  return (
    <PageWrapper title="Analytics">
      <AnalyticsContent
        stats={stats}
        isAdmin={isAdmin}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        scope={scope}
        effectiveScope={effectiveScope}
        onScopeChange={setScope}
        trendPreset={trendPreset}
        onTrendPresetChange={setTrendPreset}
        customRange={customRange}
        onCustomRangeChange={setCustomRange}
      />
    </PageWrapper>
  );
}

type AnalyticsScope = "personal" | "team";

type TrendPreset = "7" | "30" | "90" | "custom";

function AnalyticsContent({
  stats,
  isAdmin,
  activeTab,
  onTabChange,
  scope,
  effectiveScope,
  onScopeChange,
  trendPreset,
  onTrendPresetChange,
  customRange,
  onCustomRangeChange,
}: {
  stats: {
    total: number;
    draft: number;
    sent: number;
    inProgress: number;
    completed: number;
    cancelled: number;
    declined: number;
    pending: number;
    completionRate: number;
    avgSigningTimeMs: number | null;
    isAdmin: boolean;
  };
  isAdmin: boolean;
  activeTab: string;
  onTabChange: Dispatch<SetStateAction<string>>;
  scope: AnalyticsScope;
  effectiveScope: AnalyticsScope;
  onScopeChange: Dispatch<SetStateAction<AnalyticsScope>>;
  trendPreset: TrendPreset;
  onTrendPresetChange: Dispatch<SetStateAction<TrendPreset>>;
  customRange: DateRange | undefined;
  onCustomRangeChange: Dispatch<SetStateAction<DateRange | undefined>>;
}) {
  return (
    <div className="flex w-full flex-col gap-5">
      {isAdmin && (
        <div className="flex items-center justify-between">
          <Tabs
            variant="segmented"
            size="sm"
            value={scope}
            onValueChange={(value) => onScopeChange(value as AnalyticsScope)}
            tabs={[
              { value: "team", label: "Team" },
              { value: "personal", label: "Personal" },
            ]}
          />
        </div>
      )}

      <OverviewStats stats={stats} scope={effectiveScope} />

      <div className="flex flex-col gap-4">
        <Tabs
          tabs={[
            { value: "activity", label: "Document Activity" },
            { value: "status", label: "Status Breakdown" },
            { value: "timeline", label: "Recent Activity" },
            { value: "emails", label: "Email Engagement" },
            { value: "timing", label: "Recipient Timing" },
            { value: "templates", label: "Template Performance" },
            { value: "export", label: "Export" },
            ...(isAdmin ? [{ value: "members", label: "Team Members" }] : []),
          ]}
          value={activeTab}
          onValueChange={onTabChange}
        />

        {activeTab === "activity" && (
          <div className="space-y-4">
            <TrendControls
              preset={trendPreset}
              onPresetChange={onTrendPresetChange}
              customRange={customRange}
              onCustomRangeChange={onCustomRangeChange}
            />
            <TrendChart
              preset={trendPreset}
              customRange={customRange}
              scope={effectiveScope}
            />
          </div>
        )}

        {activeTab === "status" && (
          <div className="grid gap-4 md:grid-cols-2">
            <StatusPieChart scope={effectiveScope} />
            <StatusBarChart scope={effectiveScope} />
          </div>
        )}

        {activeTab === "timeline" && <RecentActivityFeed />}

        {activeTab === "emails" && <EmailEngagementTab />}

        {activeTab === "timing" && <RecipientTimingTab />}

        {activeTab === "templates" && <TemplatePerformanceTab />}

        {activeTab === "export" && <ExportPanel />}

        {isAdmin && activeTab === "members" && <MemberActivityTable />}
      </div>
    </div>
  );
}

function OverviewStats({
  stats,
  scope,
}: {
  stats: {
    total: number;
    draft: number;
    sent: number;
    inProgress: number;
    completed: number;
    cancelled: number;
    declined: number;
    pending: number;
    completionRate: number;
    avgSigningTimeMs: number | null;
    isAdmin: boolean;
  };
  scope: AnalyticsScope;
}) {
  const { slug } = Route.useParams();
  const { data: weekStats } = useQuery({
    queryKey: ["analytics", "period", "week", scope, slug],
    queryFn: () => getAnalyticsPeriodStats(slug, "week", scope),
  });
  const { data: monthStats } = useQuery({
    queryKey: ["analytics", "period", "month", scope, slug],
    queryFn: () => getAnalyticsPeriodStats(slug, "month", scope),
  });

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
      <StatCard
        title="Total Documents"
        value={stats.total}
        icon={<FileTextIcon className="h-4 w-4" />}
        description={
          weekStats ? `${weekStats.created} created this week` : undefined
        }
      />
      <StatCard
        title="Pending Signatures"
        value={stats.pending}
        icon={<ClockIcon className="h-4 w-4" />}
        description={`${stats.sent} sent, ${stats.inProgress} in progress`}
      />
      <StatCard
        title="Completed"
        value={stats.completed}
        icon={<CheckCircle2Icon className="h-4 w-4" />}
        description={
          monthStats ? `${monthStats.completed} this month` : undefined
        }
        trend={stats.completed > 0 ? "up" : undefined}
      />
      <StatCard
        title="Avg. Signing Time"
        value={formatSigningTime(stats.avgSigningTimeMs)}
        icon={<ClockIcon className="h-4 w-4" />}
        description={
          stats.avgSigningTimeMs !== null ? "sent to completed" : undefined
        }
      />
      <StatCard
        title="Completion Rate"
        value={`${stats.completionRate}%`}
        icon={<TrendingUpIcon className="h-4 w-4" />}
        description={`${stats.cancelled + stats.declined} cancelled/declined`}
        progress={stats.completionRate}
      />
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
  description,
  trend,
  progress,
}: {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  description?: string;
  trend?: "up" | "down";
  progress?: number;
}) {
  return (
    <LayerCard className="flex flex-col p-4">
      <div className="flex items-center justify-between gap-2">
        <Text as="h3" variant="heading">{title}</Text>
        <span className="text-kumo-secondary">{icon}</span>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <Text as="p" size="lg" bold>
          {value}
        </Text>
        {trend === "up" && <ArrowUpIcon className="text-kumo-success h-4 w-4" />}
        {trend === "down" && (
          <ArrowDownIcon className="text-kumo-danger h-4 w-4" />
        )}
      </div>
      {progress !== undefined ? (
        <Meter label={title} value={progress} />
      ) : null}
      {description ? (
        <Text as="p" variant="secondary" size="xs" DANGEROUS_className="mt-1">{description}</Text>
      ) : null}
    </LayerCard>
  );
}

function formatDateLabel(range: DateRange | undefined): string {
  if (!range?.from) return "Pick dates";
  const from = range.from.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  if (!range.to) return from;
  const to = range.to.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  return `${from} – ${to}`;
}

function TrendControls({
  preset,
  onPresetChange,
  customRange,
  onCustomRangeChange,
}: {
  preset: TrendPreset;
  onPresetChange: Dispatch<SetStateAction<TrendPreset>>;
  customRange: DateRange | undefined;
  onCustomRangeChange: Dispatch<SetStateAction<DateRange | undefined>>;
}) {
  return (
    <div className="flex items-center gap-2">
      <Tabs
        variant="segmented"
        size="sm"
        value={preset}
        onValueChange={(value) => onPresetChange(value as TrendPreset)}
        tabs={[
          { value: "7", label: "7 days" },
          { value: "30", label: "30 days" },
          { value: "90", label: "90 days" },
          { value: "custom", label: "Custom" },
        ]}
      />
      {preset === "custom" && (
        <Popover>
          <Popover.Trigger
            render={
              <Button variant="outline" size="sm" className="ml-1 gap-1.5">
                <CalendarIcon className="h-3.5 w-3.5" />
                {formatDateLabel(customRange)}
              </Button>
            }
          />
          <Popover.Content className="w-auto p-0" align="start">
            <DatePicker
              mode="range"
              selected={customRange}
              onChange={onCustomRangeChange}
              numberOfMonths={2}
              disabled={{ after: new Date() }}
            />
          </Popover.Content>
        </Popover>
      )}
    </div>
  );
}

function TrendChart({
  preset,
  customRange,
  scope,
}: {
  preset: TrendPreset;
  customRange: DateRange | undefined;
  scope: AnalyticsScope;
}) {
  const { slug } = Route.useParams();
  const queryArgs = useMemo(() => {
    if (preset === "custom" && customRange?.from) {
      const startDate = customRange.from.getTime();
      const endDate = customRange.to
        ? customRange.to.getTime() + 24 * 60 * 60 * 1000 - 1
        : Date.now();
      return { startDate, endDate, scope };
    }
    return { days: Number(preset), scope };
  }, [preset, customRange, scope]);

  const { data: trends } = useSuspenseQuery({
    queryKey: ["analytics", "trends", queryArgs, slug],
    queryFn: () => getAnalyticsTrends(slug, queryArgs),
  });

  const chartData = useMemo(() => trends, [trends]);

  const hasData = chartData.some((d) => d.created > 0 || d.completed > 0);

  return (
    <LayerCard>
      <LayerCard.Primary className="pb-2">
        <Text as="h3" variant="heading">Document Trends</Text>
        <Text as="p" variant="secondary" size="sm">Documents created and completed over the selected period</Text>
      </LayerCard.Primary>
      <div className="pl-0 sm:pl-6">
        {hasData ? (
          <TimeseriesChart
            echarts={echarts}
            height={300}
            gradient
            yAxisMinInterval={1}
            ariaDescription="Documents created and completed over the selected period"
            xAxisTickFormat={(timestamp) =>
              new Date(timestamp).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })
            }
            data={[
              {
                name: "Created",
                color: kumoPaint("--kumo-primary"),
                data: chartData.map((item) => [
                  Date.parse(item.date),
                  item.created,
                ]),
              },
              {
                name: "Completed",
                color: kumoPaint("--kumo-success"),
                data: chartData.map((item) => [
                  Date.parse(item.date),
                  item.completed,
                ]),
              },
            ]}
          />
        ) : (
          <div className="text-kumo-secondary flex h-75 items-center justify-center text-sm">
            No document activity yet. Create your first document to see trends.
          </div>
        )}
      </div>
    </LayerCard>
  );
}

function statusColor(status: string): string {
  switch (status) {
    case "sent":
      return kumoPaint("--kumo-info");
    case "in_progress":
      return kumoPaint("--kumo-warning");
    case "completed":
      return kumoPaint("--kumo-success");
    case "cancelled":
    case "declined":
    case "expired":
      return kumoPaint("--kumo-danger");
    default:
      return kumoPaint("--kumo-subtle");
  }
}

function CategoryBars({
  rows,
}: {
  rows: readonly { name: string; value: number; color: string }[];
}): ReactElement {
  return (
    <Chart
      echarts={echarts}
      height={250}
      options={{
        grid: { left: 36, right: 12, top: 16, bottom: 32 },
        tooltip: { trigger: "axis" },
        xAxis: {
          type: "category",
          data: rows.map((row) => row.name),
          axisTick: { show: false },
        },
        yAxis: { type: "value", minInterval: 1 },
        series: [
          {
            type: "bar",
            data: rows.map((row) => ({
              value: row.value,
              itemStyle: { color: row.color },
            })),
          },
        ],
      }}
    />
  );
}

function StatusPieChart({ scope }: { scope: "personal" | "team" }) {
  const { slug } = Route.useParams();
  const { data: stats } = useSuspenseQuery({
    queryKey: ["analytics", "stats", scope, slug],
    queryFn: () => getAnalyticsStats(slug, scope),
  });

  const pieData = useMemo(() => {
    const items = [
      { name: "Draft", value: stats.draft, color: statusColor("draft") },
      { name: "Sent", value: stats.sent, color: statusColor("sent") },
      {
        name: "In Progress",
        value: stats.inProgress,
        color: statusColor("in_progress"),
      },
      {
        name: "Completed",
        value: stats.completed,
        color: statusColor("completed"),
      },
      {
        name: "Cancelled",
        value: stats.cancelled,
        color: statusColor("cancelled"),
      },
      {
        name: "Declined",
        value: stats.declined,
        color: statusColor("declined"),
      },
      { name: "Expired", value: stats.expired, color: statusColor("expired") },
    ];
    return items.filter((item) => item.value > 0);
  }, [stats]);

  if (pieData.length === 0) {
    return (
      <LayerCard>
        <LayerCard.Primary>
          <Text as="h3" variant="heading">Status Distribution</Text>
        </LayerCard.Primary>
        <div>
          <div className="text-kumo-secondary flex h-62.5 items-center justify-center text-sm">
            No documents yet
          </div>
        </div>
      </LayerCard>
    );
  }

  return (
    <LayerCard>
      <LayerCard.Primary className="pb-2">
        <Text as="h3" variant="heading">Status Distribution</Text>
        <Text as="p" variant="secondary" size="sm">Current document status breakdown</Text>
      </LayerCard.Primary>
      <div>
        <Chart
          echarts={echarts}
          height={250}
          options={{
            tooltip: { trigger: "item" },
            series: [
              {
                type: "pie",
                radius: ["48%", "72%"],
                data: pieData.map((entry) => ({
                  name: entry.name,
                  value: entry.value,
                  itemStyle: { color: entry.color },
                })),
              },
            ],
          }}
        />
        <div className="mt-2 flex flex-wrap justify-center gap-3">
          {pieData.map((entry) => (
            <div key={entry.name} className="flex items-center gap-1.5 text-xs">
              <div
                className="size-2.5 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-kumo-secondary">
                {entry.name} ({entry.value})
              </span>
            </div>
          ))}
        </div>
      </div>
    </LayerCard>
  );
}

function StatusBarChart({ scope }: { scope: "personal" | "team" }) {
  const { slug } = Route.useParams();
  const { data: stats } = useSuspenseQuery({
    queryKey: ["analytics", "stats", scope, slug],
    queryFn: () => getAnalyticsStats(slug, scope),
  });

  const barData = useMemo(
    () => [
      { name: "Draft", value: stats.draft, color: statusColor("draft") },
      { name: "Sent", value: stats.sent, color: statusColor("sent") },
      {
        name: "In Progress",
        value: stats.inProgress,
        color: statusColor("in_progress"),
      },
      {
        name: "Completed",
        value: stats.completed,
        color: statusColor("completed"),
      },
      {
        name: "Cancelled",
        value: stats.cancelled,
        color: statusColor("cancelled"),
      },
      { name: "Declined", value: stats.declined, color: statusColor("declined") },
      { name: "Expired", value: stats.expired, color: statusColor("expired") },
    ],
    [stats]
  );

  return (
    <LayerCard>
      <LayerCard.Primary className="pb-2">
        <Text as="h3" variant="heading">Status Counts</Text>
        <Text as="p" variant="secondary" size="sm">Document count by workflow status</Text>
      </LayerCard.Primary>
      <div>
        <CategoryBars rows={barData} />
      </div>
    </LayerCard>
  );
}

const ACTION_LABELS: Record<
  string,
  {
    label: string;
    icon: React.ReactNode;
    variant: "primary" | "secondary" | "error" | "neutral";
  }
> = {
  "document.created": {
    label: "Created",
    icon: <FileTextIcon className="h-3 w-3" />,
    variant: "secondary",
  },
  "document.sent": {
    label: "Sent",
    icon: <ClockIcon className="h-3 w-3" />,
    variant: "primary",
  },
  "document.completed": {
    label: "Completed",
    icon: <CheckCircle2Icon className="h-3 w-3" />,
    variant: "primary",
  },
  "document.cancelled": {
    label: "Cancelled",
    icon: <XCircleIcon className="h-3 w-3" />,
    variant: "error",
  },
  "recipient.signed": {
    label: "Signed",
    icon: <CheckCircle2Icon className="h-3 w-3" />,
    variant: "primary",
  },
  "recipient.viewed": {
    label: "Viewed",
    icon: <FileTextIcon className="h-3 w-3" />,
    variant: "neutral",
  },
  "recipient.declined": {
    label: "Declined",
    icon: <XCircleIcon className="h-3 w-3" />,
    variant: "error",
  },
  "signature.created": {
    label: "Signature",
    icon: <CheckCircle2Icon className="h-3 w-3" />,
    variant: "primary",
  },
  "field.created": {
    label: "Field Added",
    icon: <BarChart3Icon className="h-3 w-3" />,
    variant: "secondary",
  },
};

function formatSigningTime(ms: number | null): string {
  if (ms === null) return "N/A";
  const hours = ms / (1000 * 60 * 60);
  if (hours < 1) return `${Math.round(ms / (1000 * 60))}m`;
  if (hours < 24) return `${Math.round(hours)}h`;
  const days = hours / 24;
  if (days < 1.05) return "1 day";
  return `${days.toFixed(1)} days`;
}

function formatRelativeTime(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(timestamp).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function RecentActivityFeed() {
  const { slug } = Route.useParams();
  const { data: activity } = useQuery({
    queryKey: ["api", "activity", 30, slug],
    queryFn: () => getRecentActivity(slug, 30),
  });

  if (!activity) {
    return (
      <LayerCard>
        <div className="py-8">
          <div className="text-kumo-secondary flex items-center justify-center text-sm">
            Loading activity...
          </div>
        </div>
      </LayerCard>
    );
  }

  if (activity.length === 0) {
    return (
      <LayerCard>
        <LayerCard.Primary>
          <Text as="h3" variant="heading">Recent Activity</Text>
        </LayerCard.Primary>
        <div>
          <div className="text-kumo-secondary flex h-32 items-center justify-center text-sm">
            No activity recorded yet
          </div>
        </div>
      </LayerCard>
    );
  }

  return (
    <LayerCard>
      <LayerCard.Primary className="pb-2">
        <Text as="h3" variant="heading">Recent Activity</Text>
        <Text as="p" variant="secondary" size="sm">Latest actions across your workspace</Text>
      </LayerCard.Primary>
      <div>
        <div className="space-y-3">
          {activity.map((item) => {
            const actionInfo = ACTION_LABELS[item.action];
            const actionLabel =
              actionInfo?.label ?? item.action.replace(/\./g, " ");

            return (
              <div key={item.id} className="flex items-start gap-3 py-1">
                <div className="text-kumo-secondary mt-0.5 shrink-0">
                  {actionInfo?.icon ?? <BarChart3Icon className="h-3 w-3" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">
                      {item.actorName}
                    </span>
                    <Badge
                      variant={actionInfo?.variant ?? "secondary"}
                      className="text-xs shrink-0"
                    >
                      {actionLabel}
                    </Badge>
                  </div>
                  {typeof item.metadata?.description === "string" && (
                    <Text as="p" variant="secondary" size="xs" truncate>{item.metadata.description}</Text>
                  )}
                </div>
                <span className="text-kumo-secondary shrink-0 text-xs tabular-nums">
                  {formatRelativeTime(item.timestamp)}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </LayerCard>
  );
}

function MemberActivityTable() {
  const { slug } = Route.useParams();
  const { data: memberActivity } = useQuery({
    queryKey: ["analytics", "member-activity", slug],
    queryFn: () => getMemberActivity(slug),
  });

  if (!memberActivity) {
    return (
      <LayerCard>
        <div className="py-8">
          <div className="text-kumo-secondary flex items-center justify-center text-sm">
            Loading member activity...
          </div>
        </div>
      </LayerCard>
    );
  }

  if (memberActivity.length === 0) {
    return (
      <LayerCard>
        <LayerCard.Primary>
          <Text as="h3" variant="heading">Team Member Activity</Text>
        </LayerCard.Primary>
        <div>
          <div className="text-kumo-secondary flex h-32 items-center justify-center text-sm">
            No team members found
          </div>
        </div>
      </LayerCard>
    );
  }

  return (
    <LayerCard>
      <LayerCard.Primary className="pb-4">
        <div className="flex items-center gap-2">
          <UsersIcon className="text-kumo-secondary h-4 w-4" />
          <Text as="h3" variant="heading">Team Member Activity</Text>
        </div>
        <Text as="p" variant="secondary" size="sm">Document activity breakdown by workspace member</Text>
      </LayerCard.Primary>
      <div>
        <div className="overflow-x-auto">
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.Head>Member</Table.Head>
                <Table.Head className="text-right">Created</Table.Head>
                <Table.Head className="text-right">Completed</Table.Head>
                <Table.Head className="text-right">Pending</Table.Head>
                <Table.Head className="text-right">Rate</Table.Head>
                <Table.Head className="text-right">Avg. Time</Table.Head>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {memberActivity.map((member) => (
                <Table.Row key={member.userId}>
                  <Table.Cell>
                    <Text size="sm">{member.name}</Text>
                    <Text variant="secondary" size="xs">
                      {member.email}
                    </Text>
                  </Table.Cell>
                  <Table.Cell className="text-right tabular-nums">
                    {member.created}
                  </Table.Cell>
                  <Table.Cell className="text-right tabular-nums">
                    {member.completed}
                  </Table.Cell>
                  <Table.Cell className="text-right tabular-nums">
                    {member.pending}
                  </Table.Cell>
                  <Table.Cell className="text-right tabular-nums">
                    {member.completionRate}%
                  </Table.Cell>
                  <Table.Cell className="text-right tabular-nums">
                    {formatSigningTime(member.avgSigningTimeMs)}
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        </div>
      </div>
    </LayerCard>
  );
}

type ExportStatus =
  | "all"
  | "draft"
  | "sent"
  | "in_progress"
  | "waiting_for_payment"
  | "completed"
  | "cancelled"
  | "declined";
type ExportPeriod = "all" | "week" | "month" | "quarter" | "year";

const EXPORT_STATUSES = [
  "all",
  "draft",
  "sent",
  "in_progress",
  "waiting_for_payment",
  "completed",
  "cancelled",
  "declined",
] as const satisfies readonly ExportStatus[];
const EXPORT_PERIODS = [
  "all",
  "week",
  "month",
  "quarter",
  "year",
] as const satisfies readonly ExportPeriod[];

function ExportPanel() {
  const { slug } = Route.useParams();
  const [statusFilter, setStatusFilter] = useState<ExportStatus>("all");
  const [periodFilter, setPeriodFilter] = useState<ExportPeriod>("all");
  const [isExporting, setIsExporting] = useState(false);

  // Build query args based on filters
  const queryArgs = useMemo(() => {
    const args: {
      workflowStatus?:
        | "draft"
        | "sent"
        | "in_progress"
        | "waiting_for_payment"
        | "completed"
        | "cancelled"
        | "declined";
      startDate?: number;
      endDate?: number;
    } = {};

    if (statusFilter !== "all") {
      args.workflowStatus = statusFilter;
    }

    if (periodFilter !== "all") {
      const now = Date.now();
      switch (periodFilter) {
        case "week":
          args.startDate = now - 7 * 24 * 60 * 60 * 1000;
          break;
        case "month":
          args.startDate = now - 30 * 24 * 60 * 60 * 1000;
          break;
        case "quarter":
          args.startDate = now - 90 * 24 * 60 * 60 * 1000;
          break;
        case "year":
          args.startDate = now - 365 * 24 * 60 * 60 * 1000;
          break;
      }
    }

    return args;
  }, [statusFilter, periodFilter]);

  const { data: exportData } = useQuery({
    queryKey: ["analytics", "documents", "export", queryArgs, slug],
    queryFn: () => getAnalyticsDocumentsForExport(slug, queryArgs),
  });

  const handleExportCsv = useCallback(() => {
    if (!exportData || exportData.length === 0) return;
    setIsExporting(true);

    try {
      const headers = [
        "Document Name",
        "Status",
        "Owner",
        "Owner Email",
        "Created",
        "Sent",
        "Completed",
        "Deadline",
        "Recipients",
        "Signed",
        "Pending",
      ];

      const rows = exportData.map((doc) => [
        doc.name,
        doc.status,
        doc.ownerName,
        doc.ownerEmail,
        new Date(doc.createdAt).toISOString(),
        doc.sentAt ? new Date(doc.sentAt).toISOString() : "",
        doc.completedAt ? new Date(doc.completedAt).toISOString() : "",
        doc.deadline ? new Date(doc.deadline).toISOString() : "",
        doc.recipientCount,
        doc.signedCount,
        doc.pendingCount,
      ]);

      const csvContent = [
        headers.join(","),
        ...rows.map((row) =>
          row
            .map((cell) => {
              const str = String(cell);
              // Escape cells that contain commas or quotes
              return str.includes(",") || str.includes('"')
                ? `"${str.replace(/"/g, '""')}"`
                : str;
            })
            .join(",")
        ),
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const dateStr = new Date().toISOString().split("T")[0];
      link.download = `seal-documents-export-${dateStr}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setIsExporting(false);
    }
  }, [exportData]);

  const handleExportPdf = useCallback(async () => {
    if (!exportData || exportData.length === 0) return;
    setIsExporting(true);

    try {
      const { default: jsPDF } = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");

      const doc = new jsPDF({ orientation: "landscape" });

      doc.setFontSize(16);
      doc.text("Seal — Document Export", 14, 20);

      doc.setFontSize(9);
      doc.setTextColor(100);
      const dateStr = new Date().toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      doc.text(`Generated ${dateStr} · ${exportData.length} documents`, 14, 27);

      const headers = [
        "Document Name",
        "Status",
        "Owner",
        "Created",
        "Sent",
        "Completed",
        "Recipients",
        "Signed",
      ];

      const rows = exportData.map((d) => [
        d.name,
        d.status,
        d.ownerName,
        new Date(d.createdAt).toLocaleDateString(),
        d.sentAt ? new Date(d.sentAt).toLocaleDateString() : "—",
        d.completedAt ? new Date(d.completedAt).toLocaleDateString() : "—",
        d.recipientCount,
        d.signedCount,
      ]);

      autoTable(doc, {
        head: [headers],
        body: rows,
        startY: 33,
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [30, 30, 30] },
      });

      doc.save(
        `seal-documents-export-${new Date().toISOString().split("T")[0]}.pdf`
      );
    } finally {
      setIsExporting(false);
    }
  }, [exportData]);

  return (
    <LayerCard>
      <LayerCard.Primary className="pb-4">
        <Text as="h3" variant="heading">Export Documents</Text>
        <Text as="p" variant="secondary" size="sm">Download document data as CSV or PDF for external analysis</Text>
      </LayerCard.Primary>
      <div className="space-y-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1.5">
            <Select
              label="Status"
              className="w-40"
              value={statusFilter}
              onValueChange={(v) =>
                setStatusFilter(
                  parseSelectValue(v ?? "", EXPORT_STATUSES) ?? statusFilter
                )
              }
              items={{
                all: "All Statuses",
                draft: "Draft",
                sent: "Sent",
                in_progress: "In Progress",
                completed: "Completed",
                cancelled: "Cancelled",
                declined: "Declined",
              }}
            />
          </div>

          <div className="space-y-1.5">
            <Select
              label="Period"
              className="w-40"
              value={periodFilter}
              onValueChange={(v) =>
                setPeriodFilter(
                  parseSelectValue(v ?? "", EXPORT_PERIODS) ?? periodFilter
                )
              }
              items={{
                all: "All Time",
                week: "Last 7 Days",
                month: "Last 30 Days",
                quarter: "Last 90 Days",
                year: "Last Year",
              }}
            />
          </div>

          <Button
            onClick={handleExportCsv}
            disabled={isExporting || !exportData || exportData.length === 0}
           icon={DownloadIcon}>
            CSV
          </Button>
          <Button
            variant="outline"
            onClick={() => void handleExportPdf()}
            disabled={isExporting || !exportData || exportData.length === 0}
           icon={DownloadIcon}>
            PDF
          </Button>
        </div>

        <Text as="p" variant="secondary" size="xs">{exportData === undefined
            ? "Loading documents..."
            : `${exportData.length} document${exportData.length !== 1 ? "s" : ""} match your filters`}</Text>
      </div>
    </LayerCard>
  );
}

// ─── Email Engagement Tab ─────────────────────

function emailFunnelColor(stage: string): string {
  switch (stage) {
    case "delivered":
      return kumoPaint("--kumo-primary");
    case "opened":
      return kumoPaint("--kumo-success");
    case "clicked":
      return kumoPaint("--kumo-warning");
    default:
      return kumoPaint("--kumo-info");
  }
}

function EmailEngagementTab() {
  const { slug } = Route.useParams();
  const { data: engagement } = useQuery({
    queryKey: ["analytics", "email-engagement", 30, slug],
    queryFn: () => getEmailEngagementStats(slug, 30),
  });

  if (!engagement) {
    return <AnalyticsTabSkeleton />;
  }

  if (engagement.total === 0) {
    return (
      <LayerCard>
        <div className="flex h-50 items-center justify-center">
          <Text as="p" variant="secondary" size="sm">No email data available yet</Text>
        </div>
      </LayerCard>
    );
  }

  const funnelData = [
    {
      name: "Sent",
      value: engagement.total,
      color: emailFunnelColor("sent"),
    },
    {
      name: "Delivered",
      value: Math.round((engagement.deliveryRate / 100) * engagement.total),
      color: emailFunnelColor("delivered"),
    },
    {
      name: "Opened",
      value: Math.round(
        (engagement.openRate / 100) *
          (engagement.deliveryRate / 100) *
          engagement.total
      ),
      color: emailFunnelColor("opened"),
    },
    {
      name: "Clicked",
      value: Math.round(
        (engagement.clickRate / 100) *
          (engagement.openRate / 100) *
          (engagement.deliveryRate / 100) *
          engagement.total
      ),
      color: emailFunnelColor("clicked"),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <StatCard
          title="Emails Sent"
          value={engagement.total}
          icon={<BarChart3Icon className="h-4 w-4" />}
          description="Last 30 days"
        />
        <StatCard
          title="Delivery Rate"
          value={`${engagement.deliveryRate}%`}
          icon={<CheckCircle2Icon className="h-4 w-4" />}
          progress={engagement.deliveryRate}
        />
        <StatCard
          title="Open Rate"
          value={`${engagement.openRate}%`}
          icon={<TrendingUpIcon className="h-4 w-4" />}
          progress={engagement.openRate}
        />
        <StatCard
          title="Click Rate"
          value={`${engagement.clickRate}%`}
          icon={<TrendingUpIcon className="h-4 w-4" />}
          progress={engagement.clickRate}
        />
        <StatCard
          title="Avg Time to Open"
          value={engagement.avgTimeToOpen ?? "—"}
          icon={<ClockIcon className="h-4 w-4" />}
          description={
            engagement.bounceRate > 0
              ? `${engagement.bounceRate}% bounce rate`
              : undefined
          }
        />
      </div>

      <LayerCard>
        <LayerCard.Primary className="pb-2">
          <Text as="h3" variant="heading">Email Funnel</Text>
          <Text as="p" variant="secondary" size="sm">Email engagement progression (last 30 days)</Text>
        </LayerCard.Primary>
        <div>
          <CategoryBars rows={funnelData} />
        </div>
      </LayerCard>
    </div>
  );
}

// ─── Recipient Timing Tab ─────────────────────

function timingBucketColor(bucket: string): string {
  switch (bucket) {
    case "<1h":
      return kumoPaint("--kumo-success");
    case "1-6h":
      return kumoPaint("--kumo-info");
    case "6-24h":
      return kumoPaint("--kumo-primary");
    case "1-3d":
      return kumoPaint("--kumo-warning");
    default:
      return kumoPaint("--kumo-danger");
  }
}

function RecipientTimingTab() {
  const { slug } = Route.useParams();
  const { data: timing } = useQuery({
    queryKey: ["analytics", "recipient-timing", 30, slug],
    queryFn: () => getRecipientTimingStats(slug, 30),
  });

  if (!timing) {
    return <AnalyticsTabSkeleton />;
  }

  if (timing.sampleSize === 0) {
    return (
      <LayerCard>
        <div className="flex h-50 items-center justify-center">
          <Text as="p" variant="secondary" size="sm">No signed documents in the last 30 days</Text>
        </div>
      </LayerCard>
    );
  }

  const distributionData = timing.distribution.map((d) => ({
    name: d.bucket,
    value: d.count,
    color: timingBucketColor(d.bucket),
  }));

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Avg Time to View"
          value={timing.avgTimeToView ?? "—"}
          icon={<ClockIcon className="h-4 w-4" />}
          description="From sent to first viewed"
        />
        <StatCard
          title="Avg Time to Sign"
          value={timing.avgTimeToSign ?? "—"}
          icon={<ClockIcon className="h-4 w-4" />}
          description="From viewed to signed"
        />
        <StatCard
          title="Avg Total Turnaround"
          value={timing.avgTotalTurnaround ?? "—"}
          icon={<ClockIcon className="h-4 w-4" />}
          description="End-to-end signing time"
        />
        <StatCard
          title="Sample Size"
          value={timing.sampleSize}
          icon={<UsersIcon className="h-4 w-4" />}
          description="Recipients in last 30 days"
        />
      </div>

      <LayerCard>
        <LayerCard.Primary className="pb-2">
          <Text as="h3" variant="heading">Signing Time Distribution</Text>
          <Text as="p" variant="secondary" size="sm">How long recipients take to complete signing</Text>
        </LayerCard.Primary>
        <div>
          <CategoryBars rows={distributionData} />
          <div className="mt-2 flex flex-wrap justify-center gap-3">
            {distributionData.map((entry) => (
              <div
                key={entry.name}
                className="flex items-center gap-1.5 text-xs"
              >
                <div
                  className="size-2.5 rounded-full"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-kumo-secondary">
                  {entry.name} ({entry.value})
                </span>
              </div>
            ))}
          </div>
        </div>
      </LayerCard>
    </div>
  );
}

// ─── Template Performance Tab ─────────────────

function TemplatePerformanceTab() {
  const { slug } = Route.useParams();
  const { isPro, isLoading: isLoadingPlan } = useSubscriptionLimits();
  const { data: templates } = useQuery({
    queryKey: ["analytics", "template-performance", 90, slug],
    queryFn: () => getTemplatePerformance(slug, 90),
  });

  if (!templates || isLoadingPlan) {
    return <AnalyticsTabSkeleton />;
  }

  if (!isPro) {
    return (
      <LayerCard>
        <div className="flex h-50 flex-col items-center justify-center gap-2">
          <TrendingUpIcon className="text-kumo-secondary h-8 w-8" />
          <Text as="p" variant="secondary" size="sm">Template Performance is available on the Professional plan</Text>
        </div>
      </LayerCard>
    );
  }

  if (templates.length === 0) {
    return (
      <LayerCard>
        <div className="flex h-50 items-center justify-center">
          <Text as="p" variant="secondary" size="sm">No template-based documents in the last 90 days</Text>
        </div>
      </LayerCard>
    );
  }

  return (
    <div className="space-y-4">
      <LayerCard>
        <LayerCard.Primary className="pb-2">
          <Text as="h3" variant="heading">Template Comparison</Text>
          <Text as="p" variant="secondary" size="sm">Performance of templates over the last 90 days</Text>
        </LayerCard.Primary>
        <div>
          <div className="space-y-3">
            {templates.map((t) => (
              <div
                key={t.templateId}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div className="min-w-0 flex-1">
                  <Text as="p" size="sm" bold truncate>{t.templateName}</Text>
                  <Text as="p" variant="secondary" size="xs">{t.docsSent} documents sent</Text>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <Text as="p" size="sm" bold DANGEROUS_className="tabular-nums">{t.completionRate}%</Text>
                    <Text as="p" variant="secondary" size="xs">Completed</Text>
                  </div>
                  <div className="text-right">
                    <Text as="p" size="sm" bold DANGEROUS_className="tabular-nums">{t.avgTurnaround ?? "—"}</Text>
                    <Text as="p" variant="secondary" size="xs">Avg time</Text>
                  </div>
                  {t.declineRate > 0 && (
                    <Badge variant="error">
                      {t.declineRate}% declined
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </LayerCard>
    </div>
  );
}
