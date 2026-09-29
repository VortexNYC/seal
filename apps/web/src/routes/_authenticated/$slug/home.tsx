/**
 * Workspace Home/Dashboard Page
 *
 * SEA-96: Documenso-density oversight surface — blockers, KPIs, recent docs,
 * quick links. Charts / team / full activity live on Analytics & Settings.
 * Route: /{slug}/home
 */

import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { createFileRoute } from "@tanstack/react-router";
import { Suspense } from "react";

import { ExportDataDialog } from "@/components/dashboard/export-data-dialog";
import { NeedsAttention } from "@/components/dashboard/needs-attention";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { RecentDocuments } from "@/components/dashboard/recent-documents";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { PageWrapper } from "@/components/page-wrapper";
import { DashboardSkeleton } from "@/components/skeletons/dashboard-skeleton";
import { useCurrentUser as useUser } from "@/hooks/use-current-user";
import { useSuspenseOrganization } from "@/hooks/use-organization";
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

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function StatsCardsFallback(): React.ReactElement {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <LayerCard key={i} className="animate-pulse">
          <LayerCard.Primary className="space-y-2 p-4">
            <div className="bg-muted h-3 w-1/2 rounded" />
            <div className="bg-muted h-6 w-1/3 rounded" />
          </LayerCard.Primary>
        </LayerCard>
      ))}
    </div>
  );
}

function RecentDocsFallback(): React.ReactElement {
  return (
    <LayerCard>
      <LayerCard.Primary className="space-y-3 p-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="bg-muted h-10 animate-pulse rounded" />
        ))}
      </LayerCard.Primary>
    </LayerCard>
  );
}

function WorkspaceHome(): React.ReactElement | null {
  const { slug } = Route.useParams();
  const { user } = useUser();
  const { data: organization } = useSuspenseOrganization(slug);

  if (!organization) {
    return null;
  }

  const firstName = user?.firstName ?? "there";

  return (
    <PageWrapper title="Dashboard" headerActions={<ExportDataDialog />}>
      <div className="mx-auto flex max-w-5xl flex-col gap-5">
        <div>
          <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
            {getGreeting()},{" "}
            <span className="font-serif font-normal italic">{firstName}</span>
          </h2>
          <p className="text-muted-foreground mt-0.5 text-sm">
            What needs you in{" "}
            <span className="text-foreground font-medium">
              {organization.name}
            </span>
          </p>
        </div>

        <Suspense fallback={null}>
          <NeedsAttention organizationSlug={slug} />
        </Suspense>

        <Suspense fallback={<StatsCardsFallback />}>
          <StatsCards organizationSlug={slug} />
        </Suspense>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_14rem]">
          <Suspense fallback={<RecentDocsFallback />}>
            <RecentDocuments slug={slug} organizationSlug={slug} />
          </Suspense>
          <QuickActions slug={slug} />
        </div>
      </div>
    </PageWrapper>
  );
}
