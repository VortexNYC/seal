/**
 * Profile Settings Page - Usage
 *
 * User usage statistics and analytics
 * Route: /{slug}/settings/profile/usage
 */

import { api } from "@seal/backend/convex/_generated/api";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle,
  Clock,
  FileText,
  HardDrive,
  Send,
  TrendingUp,
} from "lucide-react";

import { FormSkeleton } from "@/components/skeletons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
<<<<<<< HEAD
=======
import { api } from "@seal/backend/convex/_generated/api";
>>>>>>> ddc9cdc (feat: pricing tier enforcement — Free/Professional/Enterprise (#72))

export const Route = createFileRoute("/_authenticated/$slug/settings/profile/usage")({
  component: UsageSettings,
  pendingComponent: FormSkeleton,
});

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${Number.parseFloat((bytes / k ** i).toFixed(1))} ${sizes[i]}`;
}

function UsageSettings() {
  const { slug } = Route.useParams();
  const stats = useQuery(api.user_profiles.queries.getUsageStatistics);

  if (!stats) {
    return <FormSkeleton />;
  }

  const isApproachingDocumentLimit = stats.documentsPercentUsed >= 80;
  const isApproachingStorageLimit = stats.storagePercentUsed >= 80;
  const showUpgradePrompt =
    stats.plan === "free" && (isApproachingDocumentLimit || isApproachingStorageLimit);

  return (
    <div className="space-y-6">
      {/* Upgrade prompt */}
      {showUpgradePrompt && (
        <Card className="border-warning/30 bg-warning-surface">
          <CardContent className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="text-warning h-5 w-5" />
              <div>
                <p className="text-warning font-medium">Approaching usage limits</p>
                <p className="text-warning text-sm">
<<<<<<< HEAD
                  Upgrade to Pro for higher limits and more features
=======
                  Upgrade to Professional for higher limits and more features
>>>>>>> ddc9cdc (feat: pricing tier enforcement — Free/Professional/Enterprise (#72))
                </p>
              </div>
            </div>
            <Button asChild size="sm">
              <Link to="/$slug/settings" params={{ slug }}>
                Upgrade <ArrowUpRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Plan Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              <CardTitle>Plan Overview</CardTitle>
            </div>
            <Badge variant={stats.plan === "pro" ? "default" : "secondary"}>
              {stats.plan === "pro" ? "Pro Plan" : "Free Plan"}
            </Badge>
          </div>
          <CardDescription>Your current subscription and usage limits</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Documents this month */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Documents this month</span>
              <span className="font-medium">
                {stats.documentsThisMonth} / {stats.documentsLimit}
              </span>
            </div>
            <Progress
              value={stats.documentsPercentUsed}
              className={cn(isApproachingDocumentLimit && "[&>div]:bg-warning")}
            />
            {isApproachingDocumentLimit && (
              <p className="text-warning text-xs">
                {Math.round(stats.documentsPercentUsed)}% of monthly limit used
              </p>
            )}
          </div>

          {/* Storage */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Storage used</span>
              <span className="font-medium">
                {formatBytes(stats.storageUsedBytes)} / {formatBytes(stats.storageLimitBytes)}
              </span>
            </div>
            <Progress
              value={stats.storagePercentUsed}
              className={cn(isApproachingStorageLimit && "[&>div]:bg-warning")}
            />
            {isApproachingStorageLimit && (
              <p className="text-warning text-xs">
                {Math.round(stats.storagePercentUsed)}% of storage limit used
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Document Statistics */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            <CardTitle>Document Statistics</CardTitle>
          </div>
          <CardDescription>Overview of your document activity</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard icon={FileText} label="Total Documents" value={stats.totalDocuments} />
            <StatCard icon={Send} label="Sent This Month" value={stats.sentThisMonth} />
            <StatCard
              icon={CheckCircle}
              label="Completed"
              value={stats.completedThisMonth}
              className="text-success"
            />
            <StatCard
              icon={Clock}
              label="Pending"
              value={stats.workflowCounts.sent + stats.workflowCounts.in_progress}
              className="text-warning"
            />
          </div>
        </CardContent>
      </Card>

      {/* Workflow Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Document Status Breakdown</CardTitle>
          <CardDescription>Documents grouped by their current workflow status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <StatusRow
              label="Draft"
              count={stats.workflowCounts.draft}
              total={stats.totalDocuments}
              color="bg-muted-foreground"
            />
            <StatusRow
              label="Sent"
              count={stats.workflowCounts.sent}
              total={stats.totalDocuments}
              color="bg-info"
            />
            <StatusRow
              label="In Progress"
              count={stats.workflowCounts.in_progress}
              total={stats.totalDocuments}
              color="bg-warning"
            />
            <StatusRow
              label="Completed"
              count={stats.workflowCounts.completed}
              total={stats.totalDocuments}
              color="bg-success"
            />
            <StatusRow
              label="Cancelled"
              count={stats.workflowCounts.cancelled}
              total={stats.totalDocuments}
              color="bg-muted-foreground"
            />
            <StatusRow
              label="Declined"
              count={stats.workflowCounts.declined}
              total={stats.totalDocuments}
              color="bg-destructive"
            />
          </div>
        </CardContent>
      </Card>

      {/* Completion Rate */}
      <Card>
        <CardHeader>
          <CardTitle>Completion Rate</CardTitle>
          <CardDescription>
            Percentage of sent documents that were completed this month
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <div className="bg-muted flex h-20 w-20 items-center justify-center rounded-full">
              <span className="text-2xl font-bold">{stats.completionRate}%</span>
            </div>
            <div className="space-y-1">
              <p className="text-muted-foreground text-sm">
                {stats.completedThisMonth} of {stats.sentThisMonth} documents completed
              </p>
              {stats.sentThisMonth > 0 && stats.completionRate >= 80 && (
                <p className="text-success text-sm">Great completion rate!</p>
              )}
              {stats.sentThisMonth > 0 && stats.completionRate < 50 && (
                <p className="text-warning text-sm">
                  Consider sending reminders to improve completion
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Storage Details */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <HardDrive className="h-5 w-5" />
            <CardTitle>Storage Details</CardTitle>
          </div>
          <CardDescription>Breakdown of your document storage usage</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-sm">Used Storage</span>
            <span className="font-medium">{formatBytes(stats.storageUsedBytes)}</span>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-sm">Available Storage</span>
            <span className="font-medium">
              {formatBytes(stats.storageLimitBytes - stats.storageUsedBytes)}
            </span>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground text-sm">Total Limit</span>
            <span className="font-medium">{formatBytes(stats.storageLimitBytes)}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface StatCardProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  className?: string;
}

function StatCard({ icon: Icon, label, value, className }: StatCardProps) {
  return (
    <div className="rounded-lg border p-4">
      <div className="flex items-center gap-2">
        <Icon className={cn("text-muted-foreground h-4 w-4", className)} />
        <span className="text-muted-foreground text-sm">{label}</span>
      </div>
      <p className={cn("mt-2 text-2xl font-bold", className)}>{value}</p>
    </div>
  );
}

interface StatusRowProps {
  label: string;
  count: number;
  total: number;
  color: string;
}

function StatusRow({ label, count, total, color }: StatusRowProps) {
  const percentage = total > 0 ? (count / total) * 100 : 0;

  return (
    <div className="flex items-center gap-3">
      <div className={cn("h-3 w-3 rounded-full", color)} />
      <span className="w-24 text-sm">{label}</span>
      <div className="flex-1">
        <div className="bg-muted h-2 overflow-hidden rounded-full">
          <div className={cn("h-full", color)} style={{ width: `${percentage}%` }} />
        </div>
      </div>
      <span className="text-muted-foreground w-12 text-right text-sm">{count}</span>
    </div>
  );
}
