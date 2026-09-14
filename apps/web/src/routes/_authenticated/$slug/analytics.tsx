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
import { Tabs } from "@cloudflare/kumo/components/tabs";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  BarChart3Icon,
  CalendarIcon,
  CheckCircle2Icon,
  ClockIcon,
  DownloadIcon,
  FileTextIcon,
  TrendingUpIcon,
  UsersIcon,
  XCircleIcon,
} from "lucide-react";
import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { DateRange } from "react-day-picker";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

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

  // Auto-switch admins to team scope on first data load
  useEffect(() => {
    if (isAdmin && scope === "personal") {
      setScope("team");
    }
  }, [isAdmin, scope]);

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
    <div className="space-y-6">
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

      <div className="space-y-4">
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
    <LayerCard>
      <LayerCard.Primary className="flex flex-row items-center justify-between space-y-0 pb-2">
        <h3 className="text-sm font-medium">{title}</h3>
        <span className="text-muted-foreground">{icon}</span>
      </LayerCard.Primary>
      <div>
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold">{value}</span>
          {trend === "up" && <ArrowUpIcon className="text-success h-4 w-4" />}
          {trend === "down" && (
            <ArrowDownIcon className="text-destructive h-4 w-4" />
          )}
        </div>
        {progress !== undefined && (
          <Meter
            label=""
            aria-label={title}
            value={progress}
            showValue={false}
            className="mt-2"
          />
        )}
        {description && (
          <p className="text-muted-foreground mt-1 text-xs">{description}</p>
        )}
      </div>
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

  const chartData = useMemo(() => {
    return trends.map((item) => ({
      ...item,
      displayDate: new Date(item.date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
    }));
  }, [trends]);

  const hasData = chartData.some((d) => d.created > 0 || d.completed > 0);

  return (
    <LayerCard>
      <LayerCard.Primary className="pb-2">
        <h3 className="text-base">Document Trends</h3>
        <p>Documents created and completed over the selected period</p>
      </LayerCard.Primary>
      <div className="pl-0 sm:pl-6">
        {hasData ? (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chartData} margin={{ left: 0, right: 8 }}>
              <defs>
                <linearGradient
                  id="analyticsCreated"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="5%"
                    stopColor="var(--primary)"
                    stopOpacity={0.3}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--primary)"
                    stopOpacity={0}
                  />
                </linearGradient>
                <linearGradient
                  id="analyticsCompleted"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop
                    offset="5%"
                    stopColor="var(--success)"
                    stopOpacity={0.3}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--success)"
                    stopOpacity={0}
                  />
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
                  backgroundColor: "var(--background)",
                  border: "1px solid var(--border)",
                  borderRadius: "6px",
                  fontSize: "12px",
                }}
              />
              <Area
                type="monotone"
                dataKey="created"
                stroke="var(--primary)"
                fillOpacity={1}
                fill="url(#analyticsCreated)"
                name="Created"
              />
              <Area
                type="monotone"
                dataKey="completed"
                stroke="var(--success)"
                fillOpacity={1}
                fill="url(#analyticsCompleted)"
                name="Completed"
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-muted-foreground flex h-[300px] items-center justify-center text-sm">
            No document activity yet. Create your first document to see trends.
          </div>
        )}
      </div>
    </LayerCard>
  );
}

const STATUS_COLORS: Record<string, string> = {
  draft: "var(--muted-foreground)",
  sent: "var(--info)",
  in_progress: "var(--warning)",
  completed: "var(--success)",
  cancelled: "var(--destructive)",
  declined: "var(--destructive)",
  expired: "var(--expired)",
};

function StatusPieChart({ scope }: { scope: "personal" | "team" }) {
  const { slug } = Route.useParams();
  const { data: stats } = useSuspenseQuery({
    queryKey: ["analytics", "stats", scope, slug],
    queryFn: () => getAnalyticsStats(slug, scope),
  });

  const pieData = useMemo(() => {
    const items = [
      { name: "Draft", value: stats.draft, color: STATUS_COLORS.draft },
      { name: "Sent", value: stats.sent, color: STATUS_COLORS.sent },
      {
        name: "In Progress",
        value: stats.inProgress,
        color: STATUS_COLORS.in_progress,
      },
      {
        name: "Completed",
        value: stats.completed,
        color: STATUS_COLORS.completed,
      },
      {
        name: "Cancelled",
        value: stats.cancelled,
        color: STATUS_COLORS.cancelled,
      },
      {
        name: "Declined",
        value: stats.declined,
        color: STATUS_COLORS.declined,
      },
      { name: "Expired", value: stats.expired, color: STATUS_COLORS.expired },
    ];
    return items.filter((item) => item.value > 0);
  }, [stats]);

  if (pieData.length === 0) {
    return (
      <LayerCard>
        <LayerCard.Primary>
          <h3 className="text-base">Status Distribution</h3>
        </LayerCard.Primary>
        <div>
          <div className="text-muted-foreground flex h-[250px] items-center justify-center text-sm">
            No documents yet
          </div>
        </div>
      </LayerCard>
    );
  }

  return (
    <LayerCard>
      <LayerCard.Primary className="pb-2">
        <h3 className="text-base">Status Distribution</h3>
        <p>Current document status breakdown</p>
      </LayerCard.Primary>
      <div>
        <ResponsiveContainer width="100%" height={250}>
          <PieChart>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={90}
              paddingAngle={2}
              dataKey="value"
            >
              {pieData.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--background)",
                border: "1px solid var(--border)",
                borderRadius: "6px",
                fontSize: "12px",
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="mt-2 flex flex-wrap justify-center gap-3">
          {pieData.map((entry) => (
            <div key={entry.name} className="flex items-center gap-1.5 text-xs">
              <div
                className="size-2.5 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-muted-foreground">
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
      { name: "Draft", value: stats.draft, fill: STATUS_COLORS.draft },
      { name: "Sent", value: stats.sent, fill: STATUS_COLORS.sent },
      {
        name: "In Progress",
        value: stats.inProgress,
        fill: STATUS_COLORS.in_progress,
      },
      {
        name: "Completed",
        value: stats.completed,
        fill: STATUS_COLORS.completed,
      },
      {
        name: "Cancelled",
        value: stats.cancelled,
        fill: STATUS_COLORS.cancelled,
      },
      { name: "Declined", value: stats.declined, fill: STATUS_COLORS.declined },
      { name: "Expired", value: stats.expired, fill: STATUS_COLORS.expired },
    ],
    [stats]
  );

  return (
    <LayerCard>
      <LayerCard.Primary className="pb-2">
        <h3 className="text-base">Status Counts</h3>
        <p>Document count by workflow status</p>
      </LayerCard.Primary>
      <div>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={barData} margin={{ left: 0, right: 8 }}>
            <XAxis
              dataKey="name"
              tick={{ fontSize: 10 }}
              tickLine={false}
              axisLine={false}
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
                backgroundColor: "var(--background)",
                border: "1px solid var(--border)",
                borderRadius: "6px",
                fontSize: "12px",
              }}
            />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {barData.map((entry) => (
                <Cell key={entry.name} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
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
          <div className="text-muted-foreground flex items-center justify-center text-sm">
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
          <h3 className="text-base">Recent Activity</h3>
        </LayerCard.Primary>
        <div>
          <div className="text-muted-foreground flex h-32 items-center justify-center text-sm">
            No activity recorded yet
          </div>
        </div>
      </LayerCard>
    );
  }

  return (
    <LayerCard>
      <LayerCard.Primary className="pb-2">
        <h3 className="text-base">Recent Activity</h3>
        <p>Latest actions across your workspace</p>
      </LayerCard.Primary>
      <div>
        <div className="space-y-3">
          {activity.map((item) => {
            const actionInfo = ACTION_LABELS[item.action];
            const actionLabel =
              actionInfo?.label ?? item.action.replace(/\./g, " ");

            return (
              <div key={item.id} className="flex items-start gap-3 py-1">
                <div className="text-muted-foreground mt-0.5 shrink-0">
                  {actionInfo?.icon ?? <BarChart3Icon className="h-3 w-3" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">
                      {item.actorName}
                    </span>
                    <Badge
                      variant={actionInfo?.variant ?? "secondary"}
                      className="shrink-0 text-[10px]"
                    >
                      {actionLabel}
                    </Badge>
                  </div>
                  {typeof item.metadata?.description === "string" && (
                    <p className="text-muted-foreground truncate text-xs">
                      {item.metadata.description}
                    </p>
                  )}
                </div>
                <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
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
          <div className="text-muted-foreground flex items-center justify-center text-sm">
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
          <h3 className="text-base">Team Member Activity</h3>
        </LayerCard.Primary>
        <div>
          <div className="text-muted-foreground flex h-32 items-center justify-center text-sm">
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
          <UsersIcon className="text-muted-foreground h-4 w-4" />
          <h3 className="text-base">Team Member Activity</h3>
        </div>
        <p>Document activity breakdown by workspace member</p>
      </LayerCard.Primary>
      <div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-muted-foreground border-b text-left text-xs">
                <th className="pr-4 pb-2 font-medium">Member</th>
                <th className="pr-4 pb-2 text-right font-medium">Created</th>
                <th className="pr-4 pb-2 text-right font-medium">Completed</th>
                <th className="pr-4 pb-2 text-right font-medium">Pending</th>
                <th className="pr-4 pb-2 text-right font-medium">Rate</th>
                <th className="pb-2 text-right font-medium">Avg. Time</th>
              </tr>
            </thead>
            <tbody>
              {memberActivity.map((member) => (
                <tr key={member.userId} className="border-b last:border-0">
                  <td className="py-2.5 pr-4">
                    <div>
                      <span className="font-medium">{member.name}</span>
                      <span className="text-muted-foreground ml-2 text-xs">
                        {member.email}
                      </span>
                    </div>
                  </td>
                  <td className="py-2.5 pr-4 text-right tabular-nums">
                    {member.created}
                  </td>
                  <td className="py-2.5 pr-4 text-right tabular-nums">
                    {member.completed}
                  </td>
                  <td className="py-2.5 pr-4 text-right tabular-nums">
                    {member.pending}
                  </td>
                  <td className="py-2.5 pr-4 text-right tabular-nums">
                    {member.completionRate}%
                  </td>
                  <td className="py-2.5 text-right tabular-nums">
                    {formatSigningTime(member.avgSigningTimeMs)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
        <h3 className="text-base">Export Documents</h3>
        <p>Download document data as CSV or PDF for external analysis</p>
      </LayerCard.Primary>
      <div className="space-y-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="space-y-1.5">
            <Select
              label="Status"
              className="w-[160px]"
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
              className="w-[160px]"
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
          >
            <DownloadIcon className="mr-2 h-4 w-4" />
            CSV
          </Button>
          <Button
            variant="outline"
            onClick={() => void handleExportPdf()}
            disabled={isExporting || !exportData || exportData.length === 0}
          >
            <DownloadIcon className="mr-2 h-4 w-4" />
            PDF
          </Button>
        </div>

        <p className="text-muted-foreground text-xs">
          {exportData === undefined
            ? "Loading documents..."
            : `${exportData.length} document${exportData.length !== 1 ? "s" : ""} match your filters`}
        </p>
      </div>
    </LayerCard>
  );
}

// ─── Email Engagement Tab ─────────────────────

const EMAIL_FUNNEL_COLORS = {
  sent: "var(--info)",
  delivered: "var(--primary)",
  opened: "var(--success)",
  clicked: "var(--warning)",
};

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
        <div className="flex h-[200px] items-center justify-center">
          <p className="text-muted-foreground text-sm">
            No email data available yet
          </p>
        </div>
      </LayerCard>
    );
  }

  const funnelData = [
    { name: "Sent", value: engagement.total, fill: EMAIL_FUNNEL_COLORS.sent },
    {
      name: "Delivered",
      value: Math.round((engagement.deliveryRate / 100) * engagement.total),
      fill: EMAIL_FUNNEL_COLORS.delivered,
    },
    {
      name: "Opened",
      value: Math.round(
        (engagement.openRate / 100) *
          (engagement.deliveryRate / 100) *
          engagement.total
      ),
      fill: EMAIL_FUNNEL_COLORS.opened,
    },
    {
      name: "Clicked",
      value: Math.round(
        (engagement.clickRate / 100) *
          (engagement.openRate / 100) *
          (engagement.deliveryRate / 100) *
          engagement.total
      ),
      fill: EMAIL_FUNNEL_COLORS.clicked,
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
          <h3 className="text-base">Email Funnel</h3>
          <p>Email engagement progression (last 30 days)</p>
        </LayerCard.Primary>
        <div>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={funnelData} margin={{ left: 0, right: 8 }}>
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
                width={40}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "var(--background)",
                  border: "1px solid var(--border)",
                  borderRadius: "6px",
                  fontSize: "12px",
                }}
              />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {funnelData.map((entry) => (
                  <Cell key={entry.name} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </LayerCard>
    </div>
  );
}

// ─── Recipient Timing Tab ─────────────────────

const TIMING_BUCKET_COLORS: Record<string, string> = {
  "<1h": "var(--success)",
  "1-6h": "var(--info)",
  "6-24h": "var(--primary)",
  "1-3d": "var(--warning)",
  "3-7d": "var(--destructive)",
  "7d+": "var(--expired)",
};

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
        <div className="flex h-[200px] items-center justify-center">
          <p className="text-muted-foreground text-sm">
            No signed documents in the last 30 days
          </p>
        </div>
      </LayerCard>
    );
  }

  const distributionData = timing.distribution.map((d) => ({
    name: d.bucket,
    value: d.count,
    fill: TIMING_BUCKET_COLORS[d.bucket] ?? "var(--muted-foreground)",
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
          <h3 className="text-base">Signing Time Distribution</h3>
          <p>How long recipients take to complete signing</p>
        </LayerCard.Primary>
        <div>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={distributionData} margin={{ left: 0, right: 8 }}>
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
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
                  backgroundColor: "var(--background)",
                  border: "1px solid var(--border)",
                  borderRadius: "6px",
                  fontSize: "12px",
                }}
              />
              <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                {distributionData.map((entry) => (
                  <Cell key={entry.name} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-2 flex flex-wrap justify-center gap-3">
            {distributionData.map((entry) => (
              <div
                key={entry.name}
                className="flex items-center gap-1.5 text-xs"
              >
                <div
                  className="size-2.5 rounded-full"
                  style={{ backgroundColor: entry.fill }}
                />
                <span className="text-muted-foreground">
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
        <div className="flex h-[200px] flex-col items-center justify-center gap-2">
          <TrendingUpIcon className="text-muted-foreground h-8 w-8" />
          <p className="text-muted-foreground text-sm">
            Template Performance is available on the Professional plan
          </p>
        </div>
      </LayerCard>
    );
  }

  if (templates.length === 0) {
    return (
      <LayerCard>
        <div className="flex h-[200px] items-center justify-center">
          <p className="text-muted-foreground text-sm">
            No template-based documents in the last 90 days
          </p>
        </div>
      </LayerCard>
    );
  }

  return (
    <div className="space-y-4">
      <LayerCard>
        <LayerCard.Primary className="pb-2">
          <h3 className="text-base">Template Comparison</h3>
          <p>Performance of templates over the last 90 days</p>
        </LayerCard.Primary>
        <div>
          <div className="space-y-3">
            {templates.map((t) => (
              <div
                key={t.templateId}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">
                    {t.templateName}
                  </p>
                  <p className="text-muted-foreground text-xs">
                    {t.docsSent} documents sent
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <p className="text-sm font-medium tabular-nums">
                      {t.completionRate}%
                    </p>
                    <p className="text-muted-foreground text-xs">Completed</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium tabular-nums">
                      {t.avgTurnaround ?? "—"}
                    </p>
                    <p className="text-muted-foreground text-xs">Avg time</p>
                  </div>
                  {t.declineRate > 0 && (
                    <Badge variant="error" className="text-xs">
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
