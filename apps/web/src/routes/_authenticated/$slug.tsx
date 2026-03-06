/**
 * Workspace Layout Route
 *
 * Main layout for organization workspaces with sidebar navigation
 * Route: /{slug}/*
 */

import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useQuery } from "convex/react";

import { AppSidebar } from "@/components/app-sidebar";
import { CommandPalette, useCommandPalette } from "@/components/command-palette";
import { PostHogIdentify } from "@/components/posthog-identify";
import { WorkspaceLayoutSkeleton } from "@/components/skeletons/workspace-layout-skeleton";
import { DotPattern } from "@/components/ui/patterns";
import { SidebarProvider } from "@/components/ui/sidebar";
import { api } from "@seal/backend/convex/_generated/api";
import type { Id } from "@seal/backend/convex/_generated/dataModel";

export const Route = createFileRoute("/_authenticated/$slug")({
  component: WorkspaceLayout,
  pendingComponent: WorkspaceLayoutSkeleton,
});

function WorkspaceLayout() {
  const { slug } = Route.useParams();
  const { open: cmdKOpen, setOpen: setCmdKOpen } = useCommandPalette();

  const organization = useQuery(api.organizations.queries.getOrganization, {
    slug,
  });

  const orgId = organization?._id as Id<"organizations"> | undefined;

  const permissions = useQuery(
    api.organizations.queries.getUserPermissions,
    orgId ? { organizationId: orgId } : "skip",
  );

  // Loading state handled by pendingComponent
  if (!organization || !orgId) {
    return null;
  }

  const orgData = {
    _id: orgId,
    name: organization.name,
    slug: organization.slug,
  };

  return (
    <SidebarProvider>
      <PostHogIdentify organization={orgData} />
      <DotPattern className="fixed inset-0 z-0" />
      <div className="bg-background/80 relative z-10 flex h-dvh w-full overflow-hidden">
        <AppSidebar slug={slug} organization={orgData} permissions={permissions} />
        <main className="h-full min-h-0 flex-1 overflow-hidden">
          <Outlet />
        </main>
      </div>
      <CommandPalette open={cmdKOpen} onOpenChange={setCmdKOpen} />
    </SidebarProvider>
  );
}
