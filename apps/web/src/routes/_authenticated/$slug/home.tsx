/**
 * Workspace Home/Dashboard Page
 *
 * SEA-129: Sender Dashboard
 *
 * Main dashboard with stats, charts, recent documents, and activity.
 * Components are decomposed into `@/components/dashboard/*` for maintainability.
 * Route: /{slug}/home
 */

import { api } from "@seal/backend/convex/_generated/api";
import type { Id } from "@seal/backend/convex/_generated/dataModel";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { Suspense } from "react";

import { ExportDataDialog } from "@/components/dashboard/export-data-dialog";
import { NeedsAttention } from "@/components/dashboard/needs-attention";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { RecentActivity } from "@/components/dashboard/recent-activity";
import { RecentDocuments } from "@/components/dashboard/recent-documents";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { StatusBreakdown } from "@/components/dashboard/status-breakdown";
import { TeamOverview } from "@/components/dashboard/team-overview";
import { TrendChart } from "@/components/dashboard/trend-chart";
import { PageWrapper } from "@/components/page-wrapper";
import { DashboardSkeleton } from "@/components/skeletons/dashboard-skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useCurrentUser as useUser } from "@/hooks/use-current-user";
import { pageSEO } from "@/lib/seo";

export const Route = createFileRoute("/_authenticated/$slug/home")({
  component: WorkspaceHome,
  pendingComponent: DashboardSkeleton,
  head: () => ({
    meta: [
      { title: pageSEO.dashboard.title },
      { name: "description", content: pageSEO.dashboard.description },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

// ─── Greeting helper ──────────────────────────────────────────────────────

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

// ─── Skeleton fallbacks ───────────────────────────────────────────────────

function StatsCardsFallback(): React.ReactElement {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i} className="animate-pulse">
          <CardHeader className="pb-2">
            <div className="bg-muted h-4 w-1/2 rounded" />
          </CardHeader>
          <CardContent>
            <div className="bg-muted mb-2 h-8 w-1/4 rounded" />
            <div className="bg-muted h-3 w-3/4 rounded" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function ChartFallback(): React.ReactElement {
  return (
    <Card data-testid="document-activity-section" className="lg:col-span-2">
      <CardHeader className="pb-2 sm:pb-6">
        <div className="bg-muted mb-2 h-5 w-1/3 rounded" />
        <div className="bg-muted h-4 w-1/2 rounded" />
      </CardHeader>
      <CardContent>
        <div className="bg-muted h-[200px] animate-pulse rounded sm:h-[250px]" />
      </CardContent>
    </Card>
  );
}

function CardFallback(): React.ReactElement {
  return (
    <Card>
      <CardHeader>
        <div className="bg-muted mb-2 h-5 w-1/2 rounded" />
        <div className="bg-muted h-4 w-3/4 rounded" />
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-muted h-6 rounded" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function RecentDocsFallback(): React.ReactElement {
  return (
    <Card>
      <CardHeader>
        <div className="bg-muted mb-2 h-5 w-1/3 rounded" />
        <div className="bg-muted h-4 w-1/2 rounded" />
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex animate-pulse items-center gap-3">
              <div className="bg-muted h-10 w-10 rounded" />
              <div className="flex-1">
                <div className="bg-muted mb-2 h-4 w-1/2 rounded" />
                <div className="bg-muted h-3 w-1/3 rounded" />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main layout ──────────────────────────────────────────────────────────

function WorkspaceHome(): React.ReactElement | null {
  const { slug } = Route.useParams();
  const { user } = useUser();

  const organization = useQuery(api.organizations.queries.getOrganization, { slug });
  const orgId = organization?._id as Id<"organizations"> | undefined;

  if (!organization || !orgId) return null;

  const firstName = user?.firstName ?? "there";
  const greeting = getGreeting();

  return (
    <PageWrapper title="Dashboard" headerActions={<ExportDataDialog />}>
      <div className="space-y-6">
        {/* Greeting */}
        <div
          style={{
            animation: "fadeInUp var(--duration-slow) var(--ease-enter) both",
          }}
        >
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {greeting}, <span className="font-serif font-normal italic">{firstName}</span>
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Here&apos;s what&apos;s happening in{" "}
            <span className="text-foreground font-medium">{organization.name}</span>
          </p>
        </div>

        {/* Stats Cards */}
        <Suspense fallback={<StatsCardsFallback />}>
          <StatsCards />
        </Suspense>

        {/* Charts and Status Breakdown */}
        <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
          <Suspense fallback={<ChartFallback />}>
            <TrendChart />
          </Suspense>

          <Suspense fallback={<CardFallback />}>
            <StatusBreakdown />
          </Suspense>
        </div>

        {/* Recent Documents and Quick Actions */}
        <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Suspense fallback={<RecentDocsFallback />}>
              <RecentDocuments slug={slug} />
            </Suspense>
          </div>

          <QuickActions slug={slug} />
        </div>

        {/* Recent Activity */}
        <RecentActivity />

        {/* Needs Attention */}
        <Suspense fallback={null}>
          <NeedsAttention slug={slug} />
        </Suspense>

        {/* Team Overview */}
        <TeamOverview organizationName={organization.name} organizationId={orgId} />
      </div>
    </PageWrapper>
  );
}
