/**
 * Workspace Layout Route
 *
 * Authenticated Seal product shell under `/{slug}/*` (SEA-606). Public
 * recipient signing is `/sign/$token`, not under this layout.
 * Route: /{slug}/*
 */

import { Sidebar } from "@cloudflare/kumo/components/sidebar";
import {
  type ErrorComponentProps,
  createFileRoute,
  Outlet,
} from "@tanstack/react-router";
import { useEffect } from "react";

import { AppSidebar } from "@/components/app-sidebar";
import {
  CommandPalette,
  useCommandPalette,
} from "@/components/command-palette";
import { FeedbackButton } from "@/components/feedback-button";
import { NotFoundPage } from "@/components/not-found-page";
import { PostHogIdentify } from "@/components/posthog-identify";
import { RouteErrorComponent } from "@/components/route-error-component";
import { WorkspaceLayoutSkeleton } from "@/components/skeletons/workspace-layout-skeleton";
import { useJamMetadata } from "@/hooks/use-jam-metadata";
import { useSuspenseOrganization } from "@/hooks/use-organization";
import { betterAuthClient } from "@/lib/better-auth";

export const Route = createFileRoute("/_authenticated/$slug")({
  component: WorkspaceLayout,
  pendingComponent: WorkspaceLayoutSkeleton,
  notFoundComponent: NotFoundPage,
  errorComponent: WorkspaceErrorComponent,
});

function WorkspaceErrorComponent(props: ErrorComponentProps) {
  const message =
    props.error instanceof Error ? props.error.message : String(props.error);

  const isNotFound =
    message.includes("not found") ||
    message.includes("No access") ||
    message.includes("does not match validator");

  if (isNotFound) {
    return <NotFoundPage />;
  }

  return <RouteErrorComponent {...props} />;
}

function WorkspaceLayout() {
  const { slug } = Route.useParams();
  const { open: cmdKOpen, setOpen: setCmdKOpen } = useCommandPalette();
  useJamMetadata();

  useEffect(() => {
    const client = betterAuthClient;
    if (client?.organization?.setActive === undefined) return;
    void client.organization.setActive({ organizationSlug: slug });
  }, [slug]);

  const { data: organization } = useSuspenseOrganization(slug);

  if (!organization) {
    return <NotFoundPage />;
  }

  const orgData = {
    id: organization.id,
    name: organization.name,
    slug: organization.slug,
  };

  return (
    <Sidebar.Provider collapsible="icon">
      <PostHogIdentify organization={orgData} />
      <div className="bg-background/80 relative z-10 flex h-dvh w-full overflow-hidden">
        <AppSidebar
          slug={slug}
          organization={orgData}
          permissions={undefined}
        />
        <main className="h-full min-h-0 flex-1 overflow-hidden">
          <Outlet />
        </main>
      </div>
      <CommandPalette open={cmdKOpen} onOpenChange={setCmdKOpen} />
      <FeedbackButton organizationSlug={slug} />
    </Sidebar.Provider>
  );
}
