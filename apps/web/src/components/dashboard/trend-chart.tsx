/**
 * Dashboard Trend Chart
 *
 * 30-day area chart showing documents created vs completed.
 * Uses semantic color tokens (no hardcoded hex values) and fades in on mount.
 */

import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getDocumentTrends } from "@/lib/api-client";

export function TrendChart(): React.ReactElement {
  const { data: trends } = useSuspenseQuery({
    queryKey: ["api", "documents", "trends", 30],
    queryFn: () => getDocumentTrends(30),
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
    <Card
      data-testid="document-activity-section"
      className="lg:col-span-2"
      style={{
        animation: "fadeInUp var(--duration-slow) var(--ease-enter) both",
        animationDelay: "200ms",
      }}
    >
      <CardHeader className="pb-2 sm:pb-6">
        <CardTitle className="text-base sm:text-lg">
          Document Activity
        </CardTitle>
        <CardDescription className="text-xs sm:text-sm">
          Created and completed over the last 30 days
        </CardDescription>
      </CardHeader>
      <CardContent className="pl-0 sm:pl-6">
        {hasData ? (
          <div
            style={{
              animation:
                "fadeIn var(--duration-deliberate) var(--ease-enter) both",
              animationDelay: "400ms",
            }}
          >
            <ResponsiveContainer
              width="100%"
              height={200}
              className="sm:h-[250px]"
            >
              <AreaChart data={chartData} margin={{ left: 0, right: 8 }}>
                <defs>
                  <linearGradient id="colorCreated" x1="0" y1="0" x2="0" y2="1">
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
                    id="colorCompleted"
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
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                  tickLine={false}
                  axisLine={false}
                  allowDecimals={false}
                  width={30}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--card)",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="created"
                  stroke="var(--primary)"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorCreated)"
                  name="Created"
                />
                <Area
                  type="monotone"
                  dataKey="completed"
                  stroke="var(--success)"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorCompleted)"
                  name="Completed"
                />
              </AreaChart>
            </ResponsiveContainer>
            {/* Accessible chart summary */}
            <p className="sr-only">
              Area chart showing document creation and completion trends over 30
              days.
              {chartData.length > 0 &&
                ` Most recent day: ${chartData[chartData.length - 1]?.displayDate}, ${chartData[chartData.length - 1]?.created} created, ${chartData[chartData.length - 1]?.completed} completed.`}
            </p>
          </div>
        ) : (
          <div className="text-muted-foreground flex h-[200px] flex-col items-center justify-center gap-2 text-sm sm:h-[250px]">
            <div className="bg-muted flex h-12 w-12 items-center justify-center rounded-full">
              <svg
                className="text-muted-foreground/60 h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.5}
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z"
                />
              </svg>
            </div>
            <span>No document activity yet</span>
            <span className="text-muted-foreground/60 text-xs">
              Create your first document to see trends
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
