import { api } from "@seal/backend/convex/_generated/api";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";

import Loader from "@/components/loader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buildOrganizationPath } from "@/lib/organization-path";

export const Route = createFileRoute("/_authenticated/onboarding/choose-organization/")({
  component: RouteComponent,
});

function RouteComponent() {
  const navigate = useNavigate();
  const organizations = useQuery(api.check_membership.listUserOrganizations);
  const setActiveOrganization = useMutation(api.check_membership.setActiveOrganizationBySlug);
  const ensurePersonalOrganization = useMutation(
    api.organizations.mutations.ensurePersonalOrganization,
  );
  const [isCreating, setIsCreating] = useState(false);

  const handleSelectOrganization = async (organizationSlug: string) => {
    try {
      await setActiveOrganization({ organizationSlug });
      navigate({
        to: buildOrganizationPath(organizationSlug, "/home"),
        replace: true,
      });
    } catch (error) {
      console.error("Failed to switch workspace:", error);
    }
  };

  const handleCreate = () => {
    setIsCreating(true);
    ensurePersonalOrganization({})
      .then(() => navigate({ to: "/app", replace: true }))
      .catch((error) => {
        console.error("Failed to create workspace:", error);
        setIsCreating(false);
      });
  };

  if (!organizations) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Loader />
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-6 p-4">
      <Card className="w-full">
        <CardHeader className="text-center">
          <CardTitle>Choose a workspace</CardTitle>
          <CardDescription>
            {organizations.length > 0
              ? "Select a workspace to continue, or create a new one."
              : "Create your workspace to get started."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          {organizations.map((org) => (
            <Button
              key={org.organizationId}
              variant="outline"
              className="w-full justify-start"
              onClick={() => void handleSelectOrganization(org.organizationSlug)}
            >
              {org.organizationName}
            </Button>
          ))}
          <Button className="mt-2 w-full" onClick={handleCreate} disabled={isCreating}>
            {isCreating ? "Creating..." : "Create a new workspace"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
