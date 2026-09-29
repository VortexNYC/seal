/**
 * Dashboard Stats Cards — compact KPIs (SEA-96).
 * Color only on status semantics (pending / completed), not decorative accents.
 */

import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { Progress } from "@cloudflare/kumo/primitives/progress";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
  CheckCircle2Icon,
  ClockIcon,
  FileTextIcon,
  TrendingUpIcon,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { getDocumentStats } from "@/lib/api-client";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle: string;
  icon: LucideIcon;
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
    <LayerCard aria-label={`${title}: ${value}`}>
      <LayerCard.Primary className="gap-1 p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            {title}
          </p>
          <Icon
            className={cn(
              "size-3.5 shrink-0",
              tone === "warning" && "text-warning",
              tone === "success" && "text-success",
              tone === "neutral" && "text-muted-foreground"
            )}
            strokeWidth={2}
          />
        </div>
        <p className="text-2xl font-semibold tracking-tight tabular-nums">
          {value}
        </p>
        <p className="text-muted-foreground text-xs">{subtitle}</p>
        {children}
      </LayerCard.Primary>
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
        <Progress.Root value={stats.completionRate}>
          <Progress.Track className="bg-muted mt-2 h-1 rounded-full">
            <Progress.Indicator className="bg-foreground rounded-full" />
          </Progress.Track>
        </Progress.Root>
      </StatCard>
    </div>
  );
}
