/**
 * Dashboard Status Breakdown
 *
 * Shows document distribution by status using a stacked horizontal bar
 * for visual impact, with a legend below. Replaces the previous individual
 * progress-bar-per-status approach with a single proportional visualization.
 */

import { useSuspenseQuery } from "@tanstack/react-query";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getDocumentStats } from "@/lib/api-client";
import { cn } from "@/lib/utils";

interface StatusSegment {
  label: string;
  count: number;
  color: string;
  dotColor: string;
}

export function StatusBreakdown(): React.ReactElement {
  const { data: stats } = useSuspenseQuery({
    queryKey: ["api", "documents", "stats"],
    queryFn: getDocumentStats,
  });

  const breakdown: StatusSegment[] = [
    {
      label: "Draft",
      count: stats.draft,
      color: "bg-muted-foreground",
      dotColor: "bg-muted-foreground",
    },
    { label: "Sent", count: stats.sent, color: "bg-info", dotColor: "bg-info" },
    {
      label: "In Progress",
      count: stats.inProgress,
      color: "bg-warning",
      dotColor: "bg-warning",
    },
    {
      label: "Completed",
      count: stats.completed,
      color: "bg-success",
      dotColor: "bg-success",
    },
    {
      label: "Cancelled",
      count: stats.cancelled,
      color: "bg-destructive/70",
      dotColor: "bg-destructive/70",
    },
    {
      label: "Declined",
      count: stats.declined,
      color: "bg-destructive",
      dotColor: "bg-destructive",
    },
    {
      label: "Expired",
      count: stats.expired,
      color: "bg-expired",
      dotColor: "bg-expired",
    },
  ].filter((item) => item.count > 0);

  const total = stats.total || 1;

  return (
    <Card
      style={{
        animation: "fadeInUp var(--duration-slow) var(--ease-enter) both",
        animationDelay: "280ms",
      }}
    >
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
          <div className="space-y-4">
            {/* Stacked horizontal bar */}
            <div
              className="flex h-3 w-full overflow-hidden rounded-full"
              role="img"
              aria-label={`Status breakdown: ${breakdown.map((b) => `${b.label} ${b.count}`).join(", ")}`}
            >
              {breakdown.map((item) => (
                <div
                  key={item.label}
                  className={cn(
                    "transition-all duration-[var(--duration-slow)] ease-[var(--ease-enter)]",
                    item.color
                  )}
                  style={{ width: `${(item.count / total) * 100}%` }}
                  title={`${item.label}: ${item.count} (${Math.round((item.count / total) * 100)}%)`}
                />
              ))}
            </div>

            {/* Legend */}
            <div className="flex flex-wrap gap-x-4 gap-y-1.5">
              {breakdown.map((item) => (
                <div key={item.label} className="flex items-center gap-1.5">
                  <div className={cn("h-2 w-2 rounded-full", item.dotColor)} />
                  <span className="text-xs">
                    <span className="text-muted-foreground">{item.label}</span>{" "}
                    <span className="font-medium tabular-nums">
                      {item.count}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
