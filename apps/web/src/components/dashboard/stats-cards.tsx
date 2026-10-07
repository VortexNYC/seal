/**
 * Dashboard Stats Cards — compact KPIs (SEA-96).
 * Color only on status semantics (pending / completed), not decorative accents.
 */

import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Text } from "@cloudflare/kumo/components/text";
import { useSuspenseQuery } from "@tanstack/react-query";
import { CheckCircle as CheckCircle2Icon, Clock as ClockIcon, FileText as FileTextIcon, type Icon, TrendUp as TrendingUpIcon } from "@phosphor-icons/react";

import { getDocumentStats } from "@/lib/api-client";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle: string;
  icon: Icon;
  tone?: "neutral" | "warning" | "success";
  children?: React.ReactNode;
}

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  tone = "neutral",
  children,
}: StatCardProps): React.ReactElement {
  return (
    <LayerCard
      aria-label={`${title}: ${value}`}
      className="flex flex-col gap-1 p-4"
    >
      <div className="flex items-center justify-between gap-2">
        <Text variant="secondary" size="xs">
          {title}
        </Text>
        <Icon
          className={cn(
            "size-4 shrink-0",
            tone === "warning" && "text-kumo-warning",
            tone === "success" && "text-kumo-success",
            tone === "neutral" && "text-kumo-secondary"
          )}
          strokeWidth={2}
        />
      </div>
      <Text size="lg">{value}</Text>
      <Text variant="secondary" size="xs">
        {subtitle}
      </Text>
      {children}
    </LayerCard>
  );
}

interface StatsCardsProps {
  organizationSlug: string;
}

export function StatsCards({
  organizationSlug,
}: StatsCardsProps): React.ReactElement {
  const { data: stats } = useSuspenseQuery({
    queryKey: ["api", "documents", "stats", organizationSlug],
    queryFn: () => getDocumentStats(organizationSlug),
  });

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatCard
        title="Documents"
        value={stats.total}
        subtitle={`${stats.createdThisMonth} this month`}
        icon={FileTextIcon}
      />
      <StatCard
        title="Pending"
        value={stats.pending}
        subtitle={`${stats.sent} sent · ${stats.inProgress} in progress`}
        icon={ClockIcon}
        tone="warning"
      />
      <StatCard
        title="Completed"
        value={stats.completed}
        subtitle={`${stats.completedThisMonth} this month`}
        icon={CheckCircle2Icon}
        tone="success"
      />
      <StatCard
        title="Completion"
        value={`${stats.completionRate}%`}
        subtitle="Of all documents"
        icon={TrendingUpIcon}
      >
        <div
          className="bg-kumo-elevated mt-2 h-1.5 w-full overflow-hidden rounded-full"
          role="meter"
          aria-label="Completion rate"
          aria-valuenow={stats.completionRate}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="bg-foreground h-full rounded-full"
            style={{
              width: `${Math.min(100, Math.max(0, stats.completionRate))}%`,
            }}
          />
        </div>
      </StatCard>
    </div>
  );
}
