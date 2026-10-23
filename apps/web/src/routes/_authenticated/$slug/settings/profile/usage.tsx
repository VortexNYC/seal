/**
 * Profile Settings Page - Usage
 *
 * User usage statistics and analytics
 * Route: /{slug}/settings/profile/usage
 */

import { Banner } from "@cloudflare/kumo/components/banner";
import { Badge } from "@cloudflare/kumo/components/badge";
import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Meter } from "@cloudflare/kumo/components/meter";
import { Text } from "@cloudflare/kumo/components/text";
import { Separator } from "@cloudflare/kumo/primitives/separator";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { CheckCircle, Clock, FileText, HardDrive, PaperPlaneTilt as Send, TrendUp as TrendingUp } from "@phosphor-icons/react";

import { SettingsBody } from "@/components/settings-body";
import { FormSkeleton } from "@/components/skeletons";
import { getUserUsageStatistics } from "@/lib/api-client";
import { cn } from "@/lib/utils";

export const Route = createFileRoute(
  "/_authenticated/$slug/settings/profile/usage"
)({
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
  const navigate = useNavigate();
  const {
    data: stats,
    isPending,
    isError,
    error,
  } = useQuery({
    queryKey: ["api", "users", "me", "usage", slug],
    queryFn: () => getUserUsageStatistics(slug),
  });

  if (isPending) {
    return <FormSkeleton />;
  }

  if (isError || !stats) {
    return (
      <LayerCard>
        <LayerCard.Primary className="py-10 text-center">
          <Text as="p" variant="secondary">
            Could not load usage
          </Text>
          <Text as="p" variant="secondary" size="sm">
            {error instanceof Error ? error.message : "Try again in a moment."}
          </Text>
        </LayerCard.Primary>
      </LayerCard>
    );
  }

  const isApproachingDocumentLimit = stats.documentsPercentUsed >= 80;
  const isApproachingStorageLimit = stats.storagePercentUsed >= 80;
  const showUpgradePrompt =
    stats.plan === "free" &&
    (isApproachingDocumentLimit || isApproachingStorageLimit);

  return (
    <SettingsBody>
      <div className="flex flex-col gap-5">
        {/* Upgrade prompt */}
        {showUpgradePrompt && (
          <Banner
            variant="alert"
            title="Approaching usage limits"
            description="Upgrade to Professional for higher limits and more features."
            action={
              <Banner.Action
                onClick={() =>
                  navigate({ to: "/$slug/settings", params: { slug } })
                }
              >
                Upgrade
              </Banner.Action>
            }
          />
        )}

        {/* Plan Overview */}
        <LayerCard>
          <LayerCard.Secondary>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                <Text as="h2" variant="heading">
                  Plan Overview
                </Text>
              </div>
              <Badge variant={stats.plan === "pro" ? "primary" : "secondary"}>
                {stats.plan === "pro" ? "Pro Plan" : "Free Plan"}
              </Badge>
            </div>
            <Text variant="secondary">
              Your current subscription and usage limits
            </Text>
          </LayerCard.Secondary>
          <LayerCard.Primary>
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-2">
                <Meter
                  label="Documents this month"
                  value={stats.documentsPercentUsed}
                  customValue={`${stats.documentsThisMonth} / ${stats.documentsLimit}`}
                  indicatorClassName={
                    isApproachingDocumentLimit ? "bg-kumo-warning" : undefined
                  }
                />
                {isApproachingDocumentLimit && (
                  <Text as="p" size="xs">{Math.round(stats.documentsPercentUsed)}% of monthly limit
                    used</Text>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <Meter
                  label="Storage used"
                  value={stats.storagePercentUsed}
                  customValue={`${formatBytes(stats.storageUsedBytes)} / ${formatBytes(stats.storageLimitBytes)}`}
                  indicatorClassName={
                    isApproachingStorageLimit ? "bg-kumo-warning" : undefined
                  }
                />
                {isApproachingStorageLimit && (
                  <Text as="p" size="xs">{Math.round(stats.storagePercentUsed)}% of storage limit
                    used</Text>
                )}
              </div>
            </div>
          </LayerCard.Primary>
        </LayerCard>

        {/* Document Statistics */}
        <LayerCard>
          <LayerCard.Secondary>
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              <Text as="h2" variant="heading">
                Document Statistics
              </Text>
            </div>
            <Text variant="secondary">Overview of your document activity</Text>
          </LayerCard.Secondary>
          <LayerCard.Primary>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                icon={FileText}
                label="Total Documents"
                value={stats.totalDocuments}
              />
              <StatCard
                icon={Send}
                label="Sent This Month"
                value={stats.sentThisMonth}
              />
              <StatCard
                icon={CheckCircle}
                label="Completed"
                value={stats.completedThisMonth}
                className="text-kumo-success"
              />
              <StatCard
                icon={Clock}
                label="Pending"
                value={
                  stats.workflowCounts.sent + stats.workflowCounts.in_progress
                }
                className="text-kumo-warning"
              />
            </div>
          </LayerCard.Primary>
        </LayerCard>

        {/* Workflow Breakdown */}
        <LayerCard>
          <LayerCard.Secondary>
            <Text as="h2" variant="heading">
              Document Status Breakdown
            </Text>
            <Text variant="secondary">
              Documents grouped by their current workflow status
            </Text>
          </LayerCard.Secondary>
          <LayerCard.Primary>
            <div className="space-y-3">
              <StatusRow
                label="Draft"
                count={stats.workflowCounts.draft}
                total={stats.totalDocuments}
                color="bg-kumo-fill"
              />
              <StatusRow
                label="Sent"
                count={stats.workflowCounts.sent}
                total={stats.totalDocuments}
                color="bg-kumo-info"
              />
              <StatusRow
                label="In Progress"
                count={stats.workflowCounts.in_progress}
                total={stats.totalDocuments}
                color="bg-kumo-warning"
              />
              <StatusRow
                label="Completed"
                count={stats.workflowCounts.completed}
                total={stats.totalDocuments}
                color="bg-kumo-success"
              />
              <StatusRow
                label="Cancelled"
                count={stats.workflowCounts.cancelled}
                total={stats.totalDocuments}
                color="bg-kumo-fill"
              />
              <StatusRow
                label="Declined"
                count={stats.workflowCounts.declined}
                total={stats.totalDocuments}
                color="bg-kumo-danger"
              />
            </div>
          </LayerCard.Primary>
        </LayerCard>

        {/* Completion Rate */}
        <LayerCard>
          <LayerCard.Secondary>
            <Text as="h2" variant="heading">
              Completion Rate
            </Text>
            <Text variant="secondary">
              Percentage of sent documents that were completed this month
            </Text>
          </LayerCard.Secondary>
          <LayerCard.Primary>
            <div className="flex items-center gap-4">
              <div className="bg-kumo-elevated flex h-20 w-20 items-center justify-center rounded-full">
                <span className="text-2xl font-bold">
                  {stats.completionRate}%
                </span>
              </div>
              <div className="space-y-1">
                <Text as="p" variant="secondary" size="sm">{stats.completedThisMonth} of {stats.sentThisMonth} documents
                  completed</Text>
                {stats.sentThisMonth > 0 && stats.completionRate >= 80 && (
                  <Text as="p" variant="success" size="sm">Great completion rate!</Text>
                )}
                {stats.sentThisMonth > 0 && stats.completionRate < 50 && (
                  <Text as="p" size="sm">Consider sending reminders to improve completion</Text>
                )}
              </div>
            </div>
          </LayerCard.Primary>
        </LayerCard>

        {/* Storage Details */}
        <LayerCard>
          <LayerCard.Secondary>
            <div className="flex items-center gap-2">
              <HardDrive className="h-5 w-5" />
              <Text as="h2" variant="heading">
                Storage Details
              </Text>
            </div>
            <Text variant="secondary">
              Breakdown of your document storage usage
            </Text>
          </LayerCard.Secondary>
          <LayerCard.Primary>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-kumo-secondary text-sm">
                  Used Storage
                </span>
                <span className="font-medium">
                  {formatBytes(stats.storageUsedBytes)}
                </span>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-kumo-secondary text-sm">
                  Available Storage
                </span>
                <span className="font-medium">
                  {formatBytes(
                    stats.storageLimitBytes - stats.storageUsedBytes
                  )}
                </span>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-kumo-secondary text-sm">
                  Total Limit
                </span>
                <span className="font-medium">
                  {formatBytes(stats.storageLimitBytes)}
                </span>
              </div>
            </div>
          </LayerCard.Primary>
        </LayerCard>
      </div>
    </SettingsBody>
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
    <LayerCard className="p-4">
      <div className="flex items-center gap-2">
        <Icon className={cn("text-kumo-secondary h-4 w-4", className)} />
        <Text as="span" variant="secondary">
          {label}
        </Text>
      </div>
      <Text as="p" size="lg" bold DANGEROUS_className={cn("mt-2", className)}>
        {value}
      </Text>
    </LayerCard>
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
        <div className="bg-kumo-elevated h-2 overflow-hidden rounded-full">
          <div
            className={cn("h-full", color)}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
      <span className="text-kumo-secondary w-12 text-right text-sm">
        {count}
      </span>
    </div>
  );
}
