import { api } from "@seal/backend/convex/_generated/api";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  type VortexAuthOrganizationChooserItem,
  VortexAuthOrganizationChooserPage,
  VortexCreateOrganization,
} from "@vortexnyc/auth/react";
import { useMutation, useQuery } from "convex/react";
import { useMemo, useState } from "react";

import Loader from "@/components/loader";
import { Button } from "@/components/ui/button";
import { buildOrganizationPath } from "@/lib/organization-path";

export const Route = createFileRoute(
  "/_authenticated/onboarding/choose-organization/"
)({
  component: RouteComponent,
});

function RouteComponent() {
  const navigate = useNavigate();
  const organizations = useQuery(api.check_membership.listUserOrganizations);
  const setActiveOrganization = useMutation(
    api.check_membership.setActiveOrganizationBySlug
  );
  const ensurePersonalOrganization = useMutation(
    api.organizations.mutations.ensurePersonalOrganization
  );
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const chooserItems = useMemo(():
    | readonly VortexAuthOrganizationChooserItem[]
    | undefined => {
    if (organizations === undefined || organizations === null) {
      return undefined;
    }
    return organizations.map((org) => ({
      _id: org.organizationSlug,
      name: org.organizationName,
      canSelect: true,
      roleTemplate: org.role,
    }));
  }, [organizations]);

  const handleSelectOrganization = async (
    organization: VortexAuthOrganizationChooserItem
  ): Promise<void> => {
    await setActiveOrganization({ organizationSlug: organization._id });
    void navigate({
      to: buildOrganizationPath(organization._id, "/home"),
      replace: true,
    });
  };

  const handleCreate = async (input: {
    name: string;
    slug: string;
  }): Promise<void> => {
    setIsCreating(true);
    setCreateError(null);
    try {
      await ensurePersonalOrganization({
        organizationName: input.name,
        organizationSlug: input.slug,
      });
      void navigate({ to: "/app", replace: true });
    } catch (error) {
      setCreateError(
        error instanceof Error ? error.message : "Failed to create workspace"
      );
      setIsCreating(false);
    }
  };

  if (chooserItems === undefined) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Loader />
      </div>
    );
  }

  if (showCreate || chooserItems.length === 0) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-6 p-4">
        <VortexCreateOrganization
          errorMessage={createError}
          isLoading={isCreating}
          onCancel={
            chooserItems.length > 0
              ? () => {
                  setShowCreate(false);
                  setCreateError(null);
                }
              : undefined
          }
          onCreate={handleCreate}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-6 p-4">
      <VortexAuthOrganizationChooserPage
        description="Select a workspace to continue, or create a new one."
        emptyDescription="Create your workspace to get started."
        emptyTitle="No workspaces yet"
        onSelectOrganization={handleSelectOrganization}
        organizations={chooserItems}
        title="Choose a workspace"
      />
      <Button
        onClick={() => {
          setShowCreate(true);
        }}
        type="button"
        variant="link"
      >
        Create a new workspace
      </Button>
    </div>
  );
}
