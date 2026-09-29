/**
 * Workspace Home/Dashboard — what needs you, then KPIs / recent.
 * Route: /{slug}/home
 */

import { LayerCard } from "@cloudflare/kumo/components/layer-card";
import { SkeletonLine } from "@cloudflare/kumo/components/loader";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Suspense } from "react";

import { AllClear } from "@/components/dashboard/all-clear";
import { ExportDataDialog } from "@/components/dashboard/export-data-dialog";
import { NeedsAttention } from "@/components/dashboard/needs-attention";
import { QuickActions } from "@/components/dashboard/quick-actions";
import { RecentDocuments } from "@/components/dashboard/recent-documents";
import { StatsCards } from "@/components/dashboard/stats-cards";
import { PageWrapper } from "@/components/page-wrapper";
import { DashboardSkeleton } from "@/components/skeletons/dashboard-skeleton";
import { useSuspenseOrganization } from "@/hooks/use-organization";
import { getDocumentAttention } from "@/lib/api-client";
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

function StatsCardsFallback(): React.ReactElement {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <LayerCard key={i} className="flex flex-col gap-2 p-4">
          <SkeletonLine className="h-3 w-1/2" />
          <SkeletonLine className="h-6 w-1/3" />
        </LayerCard>
      ))}
    </div>
  );
}

function RecentDocsFallback(): React.ReactElement {
  return (
    <LayerCard className="flex flex-col gap-3 p-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <SkeletonLine key={i} className="h-10 w-full" />
      ))}
    </LayerCard>
  );
}

function WorkspaceHome(): React.ReactElement {
  const { slug } = Route.useParams();
  const { data: organization } = useSuspenseOrganization(slug);
  const { data: attention, isPending: attentionPending } = useQuery({
    queryKey: ["api", "documents", "attention", slug],
    queryFn: () => getDocumentAttention(slug),
  });

  if (!organization) {
    return <DashboardSkeleton />;
  }

  const issueCount = attention?.totalIssues ?? 0;

  return (
    <PageWrapper title="Dashboard" headerActions={<ExportDataDialog />}>
      <div
        className="mx-auto flex max-w-5xl flex-col gap-5"
        data-seal-stagger
      >
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
            {organization.name}
          </h2>
          <p className="text-muted-foreground text-sm">
            {issueCount > 0
              ? `${issueCount} item${issueCount === 1 ? "" : "s"} need you`
              : "What needs you — and what agents already moved"}
          </p>
        </div>

        {attentionPending ? (
          <StatsCardsFallback />
        ) : issueCount > 0 ? (
          <NeedsAttention organizationSlug={slug} />
        ) : (
          <AllClear slug={slug} />
        )}

        <Suspense fallback={<StatsCardsFallback />}>
          <StatsCards organizationSlug={slug} />
        </Suspense>

        <div className="flex items-baseline justify-between gap-3">
          <p className="text-muted-foreground text-sm">Trends and team activity</p>
          <Link
            to="/$slug/analytics"
            params={{ slug }}
            className="text-primary text-sm font-medium underline-offset-4 hover:underline"
          >
            Open analytics
          </Link>
        </div>

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
