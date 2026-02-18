/**
 * Analytics Page
 *
 * View workspace analytics and insights
 * Route: /{slug}/analytics
 */

import { convexQuery } from "@convex-dev/react-query";
import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  BarChart3Icon,
  CheckCircle2Icon,
  ClockIcon,
  FileTextIcon,
  TrendingUpIcon,
  XCircleIcon,
} from "lucide-react";
import { Suspense, useMemo, useState } from "react";
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
import { DashboardSkeleton } from "@/components/skeletons/dashboard-skeleton";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { api } from "@seal/backend/convex/_generated/api";

export const Route = createFileRoute("/_authenticated/$slug/analytics")({
  component: AnalyticsPage,
  pendingComponent: DashboardSkeleton,
});

function AnalyticsPage() {
  return (
    <PageWrapper title="Analytics">
      <div className="space-y-6">
        <Suspense fallback={<DashboardSkeleton />}>
          <AnalyticsContent />
        </Suspense>
      </div>
    </PageWrapper>
  );
}

function AnalyticsContent() {
  const [trendDays, setTrendDays] = useState<30 | 7 | 90>(30);

  return (
    <div className="space-y-6">
      <OverviewStats />

      <Tabs defaultValue="activity" className="space-y-4">
        <TabsList>
          <TabsTrigger value="activity">Document Activity</TabsTrigger>
          <TabsTrigger value="status">Status Breakdown</TabsTrigger>
          <TabsTrigger value="timeline">Recent Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="activity" className="space-y-4">
          <div className="flex items-center gap-2">
            {([7, 30, 90] as const).map((days) => (
              <button
                key={days}
                type="button"
                onClick={() => setTrendDays(days)}
                className={cn(
                  "rounded-md px-3 py-1 text-sm transition-colors",
                  trendDays === days
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted",
                )}
              >
                {days === 7 ? "7 days" : days === 30 ? "30 days" : "90 days"}
              </button>
            ))}
          </div>
          <TrendChart days={trendDays} />
        </TabsContent>

        <TabsContent value="status" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <StatusPieChart />
            <StatusBarChart />
          </div>
        </TabsContent>

        <TabsContent value="timeline" className="space-y-4">
          <RecentActivityFeed />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function OverviewStats() {
  const { data: stats } = useSuspenseQuery(
    convexQuery(api.dashboard.queries.getDocumentStats, {}),
  );

  const weekStats = useQuery(api.dashboard.queries.getPeriodStats, { period: "week" });
  const monthStats = useQuery(api.dashboard.queries.getPeriodStats, { period: "month" });

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <StatCard
        title="Total Documents"
        value={stats.total}
        icon={<FileTextIcon className="h-4 w-4" />}
        description={weekStats ? `${weekStats.created} created this week` : undefined}
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
        description={monthStats ? `${monthStats.completed} this month` : undefined}
        trend={stats.completed > 0 ? "up" : undefined}
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
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <span className="text-muted-foreground">{icon}</span>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold">{value}</span>
          {trend === "up" && <ArrowUpIcon className="h-4 w-4 text-green-500" />}
          {trend === "down" && <ArrowDownIcon className="h-4 w-4 text-red-500" />}
        </div>
        {progress !== undefined && <Progress value={progress} className="mt-2 h-2" />}
        {description && (
          <p className="text-muted-foreground mt-1 text-xs">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}

function TrendChart({ days }: { days: number }) {
  const { data: trends } = useSuspenseQuery(
    convexQuery(api.dashboard.queries.getDocumentTrends, { days }),
  );

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
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Document Trends</CardTitle>
        <CardDescription>
          Documents created and completed over the last {days} days
        </CardDescription>
      </CardHeader>
      <CardContent className="pl-0 sm:pl-6">
        {hasData ? (
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chartData} margin={{ left: 0, right: 8 }}>
              <defs>
                <linearGradient id="analyticsCreated" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="analyticsCompleted" x1="0" y1="0" x2="0" y2="1">
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
                fill="url(#analyticsCreated)"
                name="Created"
              />
              <Area
                type="monotone"
                dataKey="completed"
                stroke="#22c55e"
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
      </CardContent>
    </Card>
  );
}

const STATUS_COLORS: Record<string, string> = {
  draft: "hsl(var(--muted-foreground))",
  sent: "hsl(210, 80%, 55%)",
  in_progress: "hsl(38, 92%, 50%)",
  completed: "#22c55e",
  cancelled: "hsl(0, 70%, 55%)",
  declined: "hsl(0, 50%, 45%)",
};

function StatusPieChart() {
  const { data: stats } = useSuspenseQuery(
    convexQuery(api.dashboard.queries.getDocumentStats, {}),
  );

  const pieData = useMemo(() => {
    const items = [
      { name: "Draft", value: stats.draft, color: STATUS_COLORS.draft },
      { name: "Sent", value: stats.sent, color: STATUS_COLORS.sent },
      { name: "In Progress", value: stats.inProgress, color: STATUS_COLORS.in_progress },
      { name: "Completed", value: stats.completed, color: STATUS_COLORS.completed },
      { name: "Cancelled", value: stats.cancelled, color: STATUS_COLORS.cancelled },
      { name: "Declined", value: stats.declined, color: STATUS_COLORS.declined },
    ];
    return items.filter((item) => item.value > 0);
  }, [stats]);

  if (pieData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Status Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-muted-foreground flex h-[250px] items-center justify-center text-sm">
            No documents yet
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Status Distribution</CardTitle>
        <CardDescription>Current document status breakdown</CardDescription>
      </CardHeader>
      <CardContent>
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
                backgroundColor: "hsl(var(--background))",
                border: "1px solid hsl(var(--border))",
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
      </CardContent>
    </Card>
  );
}

function StatusBarChart() {
  const { data: stats } = useSuspenseQuery(
    convexQuery(api.dashboard.queries.getDocumentStats, {}),
  );

  const barData = useMemo(
    () => [
      { name: "Draft", value: stats.draft, fill: STATUS_COLORS.draft },
      { name: "Sent", value: stats.sent, fill: STATUS_COLORS.sent },
      { name: "In Progress", value: stats.inProgress, fill: STATUS_COLORS.in_progress },
      { name: "Completed", value: stats.completed, fill: STATUS_COLORS.completed },
      { name: "Cancelled", value: stats.cancelled, fill: STATUS_COLORS.cancelled },
      { name: "Declined", value: stats.declined, fill: STATUS_COLORS.declined },
    ],
    [stats],
  );

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Status Counts</CardTitle>
        <CardDescription>Document count by workflow status</CardDescription>
      </CardHeader>
      <CardContent>
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
                backgroundColor: "hsl(var(--background))",
                border: "1px solid hsl(var(--border))",
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
      </CardContent>
    </Card>
  );
}

const ACTION_LABELS: Record<string, { label: string; icon: React.ReactNode; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  "document.created": { label: "Created", icon: <FileTextIcon className="h-3 w-3" />, variant: "secondary" },
  "document.sent": { label: "Sent", icon: <ClockIcon className="h-3 w-3" />, variant: "default" },
  "document.completed": { label: "Completed", icon: <CheckCircle2Icon className="h-3 w-3" />, variant: "default" },
  "document.cancelled": { label: "Cancelled", icon: <XCircleIcon className="h-3 w-3" />, variant: "destructive" },
  "recipient.signed": { label: "Signed", icon: <CheckCircle2Icon className="h-3 w-3" />, variant: "default" },
  "recipient.viewed": { label: "Viewed", icon: <FileTextIcon className="h-3 w-3" />, variant: "outline" },
  "recipient.declined": { label: "Declined", icon: <XCircleIcon className="h-3 w-3" />, variant: "destructive" },
  "signature.created": { label: "Signature", icon: <CheckCircle2Icon className="h-3 w-3" />, variant: "default" },
  "field.created": { label: "Field Added", icon: <BarChart3Icon className="h-3 w-3" />, variant: "secondary" },
};

function formatRelativeTime(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(timestamp).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function RecentActivityFeed() {
  const activity = useQuery(api.dashboard.queries.getRecentActivity, { limit: 30 });

  if (!activity) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-muted-foreground flex items-center justify-center text-sm">
            Loading activity...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (activity.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-muted-foreground flex h-32 items-center justify-center text-sm">
            No activity recorded yet
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Recent Activity</CardTitle>
        <CardDescription>Latest actions across your workspace</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {activity.map((item) => {
            const actionInfo = ACTION_LABELS[item.action];
            const actionLabel = actionInfo?.label ?? item.action.replace(/\./g, " ");

            return (
              <div key={item._id} className="flex items-start gap-3 py-1">
                <div className="text-muted-foreground mt-0.5 shrink-0">
                  {actionInfo?.icon ?? <BarChart3Icon className="h-3 w-3" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">
                      {item.actorName}
                    </span>
                    <Badge variant={actionInfo?.variant ?? "secondary"} className="shrink-0 text-[10px]">
                      {actionLabel}
                    </Badge>
                  </div>
                  {item.metadata?.description && (
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
      </CardContent>
    </Card>
  );
}
