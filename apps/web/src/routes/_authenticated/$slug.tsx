/**
 * Workspace Layout Route
 *
 * Authenticated Seal product shell under `/{slug}/*` (SEA-606). Public
 * recipient signing is `/sign/$token`, not under this layout.
 * Route: /{slug}/*
 */

import { api } from "@seal/backend/convex/_generated/api";
import {
  type ErrorComponentProps,
  createFileRoute,
  Outlet,
} from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { ConvexError } from "convex/values";

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
import { DotPattern } from "@/components/ui/patterns";
import { SidebarProvider } from "@/components/ui/sidebar";
import { useJamMetadata } from "@/hooks/use-jam-metadata";

export const Route = createFileRoute("/_authenticated/$slug")({
  component: WorkspaceLayout,
  pendingComponent: WorkspaceLayoutSkeleton,
  notFoundComponent: NotFoundPage,
  errorComponent: WorkspaceErrorComponent,
});

function WorkspaceErrorComponent(props: ErrorComponentProps) {
  const message =
    props.error instanceof ConvexError
      ? String(props.error.data)
      : props.error instanceof Error
        ? props.error.message
        : "";

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

  const organization = useQuery(api.organizations.queries.getOrganization, {
    slug,
  });

  const orgId = organization?._id;

  const permissions = useQuery(
    api.organizations.queries.getUserPermissions,
    orgId ? { organizationId: orgId } : "skip"
  );

  // Still loading — pendingComponent handles initial load, but useQuery
  // returns undefined while the subscription is establishing
  if (organization === undefined) {
    return null;
  }

  // Organization not found or user has no access — Convex threw an error
  // that was caught, or the query returned null
  if (!organization || !orgId) {
    return <NotFoundPage />;
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
        <AppSidebar
          slug={slug}
          organization={orgData}
          permissions={permissions}
        />
        <main className="h-full min-h-0 flex-1 overflow-hidden">
          <Outlet />
        </main>
      </div>
      <CommandPalette open={cmdKOpen} onOpenChange={setCmdKOpen} />
      <FeedbackButton />
    </SidebarProvider>
  );
}
