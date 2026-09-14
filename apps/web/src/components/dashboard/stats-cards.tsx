/**
 * Dashboard Stats Cards
 *
 * Four KPI cards with visual hierarchy: Total Documents, Pending Signatures,
 * Completed, and Completion Rate. Uses semantic color tinting and staggered
 * entrance animations for a refined editorial feel.
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
  iconClassName: string;
  accentClassName?: string;
  index: number;
  children?: React.ReactNode;
}

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  iconClassName,
  accentClassName,
  index,
  children,
}: StatCardProps): React.ReactElement {
  return (
    <LayerCard
      className={cn("group relative overflow-hidden", accentClassName)}
      style={{
        animation: "fadeInUp var(--duration-slow) var(--ease-enter) both",
        animationDelay: `${index * 80}ms`,
      }}
      aria-label={`${title}: ${value}`}
    >
      {/* Decorative background icon */}
      <Icon
        className={cn(
          "pointer-events-none absolute -right-3 -bottom-3 h-24 w-24 opacity-[0.04]"
        )}
        strokeWidth={1}
      />

      <LayerCard.Secondary>
        <div className="flex flex-row items-center justify-between space-y-0 pb-2">
          <h3 className="text-muted-foreground text-sm font-medium tracking-wide">
            {title}
          </h3>
          <div
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-lg",
              iconClassName
            )}
          >
            <Icon className="h-4 w-4" />
          </div>
        </div>
      </LayerCard.Secondary>
      <LayerCard.Primary>
        <div className="font-serif text-3xl font-normal tracking-tight tabular-nums">
          {value}
        </div>
        <p className="text-muted-foreground mt-1 text-xs">{subtitle}</p>
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
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <StatCard
        title="Total Documents"
        value={stats.total}
        subtitle={`${stats.createdThisMonth} created this month`}
        icon={FileTextIcon}
        iconClassName="bg-secondary text-foreground/70"
        index={0}
      />

      <StatCard
        title="Pending Signatures"
        value={stats.pending}
        subtitle={`${stats.sent} sent, ${stats.inProgress} in progress`}
        icon={ClockIcon}
        iconClassName="bg-warning-surface text-warning"
        index={1}
      />

      <StatCard
        title="Completed"
        value={stats.completed}
        subtitle={`${stats.completedThisMonth} completed this month`}
        icon={CheckCircle2Icon}
        iconClassName="bg-success-surface text-success"
        index={2}
      />

      <StatCard
        title="Completion Rate"
        value={`${stats.completionRate}%`}
        subtitle="Of all documents"
        icon={TrendingUpIcon}
        iconClassName="bg-info-surface text-info"
        accentClassName="border-brand-200/40 dark:border-brand-800/30"
        index={3}
      >
        <Progress.Root value={stats.completionRate}>
          <Progress.Track className="mt-3 h-1.5">
            <Progress.Indicator />
          </Progress.Track>
        </Progress.Root>
      </StatCard>
    </div>
  );
}
