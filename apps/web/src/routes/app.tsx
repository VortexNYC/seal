import { api } from "@seal/backend/convex/_generated/api";
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useState } from "react";

import Loader from "@/components/loader";
import { useAppAuth } from "@/lib/auth-runtime.better-auth";
import { buildOrganizationPath } from "@/lib/organization-path";

export const Route = createFileRoute("/app")({
  component: AppRedirect,
});

function AppRedirect() {
  const { isLoaded, isSignedIn } = useAppAuth();

  if (!isLoaded) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Loader />
      </div>
    );
  }

  if (!isSignedIn) {
    return <Navigate to="/sign-in" replace />;
  }

  return <AuthenticatedRedirect />;
}

function AuthenticatedRedirect() {
  const organizationStatus = useQuery(api.check_membership.hasOrganization);
  const ensureActiveOrganization = useMutation(api.check_membership.ensureActiveOrganization);
  const [isFixingOrg, setIsFixingOrg] = useState(false);
  const [fixedSlug, setFixedSlug] = useState<string | null>(null);

  // null = backend saw no identity yet (auth still attaching). Treat as loading.
  const isLoading = organizationStatus === undefined || organizationStatus === null;
  const activeOrganizationSlug = fixedSlug ?? organizationStatus?.activeOrganizationSlug ?? null;
  const needsActiveOrgFix = organizationStatus?.needsActiveOrgFix ?? false;

  // Auto-fix activeOrganizationId if user has membership but no active org set.
  useEffect(() => {
    if (!isLoading && needsActiveOrgFix && !isFixingOrg && !fixedSlug) {
      setIsFixingOrg(true);
      ensureActiveOrganization({})
        .then((result) => {
          if (result.success && result.activeOrganizationSlug) {
            setFixedSlug(result.activeOrganizationSlug);
          }
        })
        .catch((error) => {
          console.error("Failed to fix active organization:", error);
        })
        .finally(() => {
          setIsFixingOrg(false);
        });
    }
  }, [isLoading, needsActiveOrgFix, isFixingOrg, fixedSlug, ensureActiveOrganization]);

  if (isLoading || isFixingOrg) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="text-center">
          <Loader />
          <p className="text-muted-foreground mt-4">
            {isFixingOrg ? "Setting up your workspace..." : "Loading..."}
          </p>
        </div>
      </div>
    );
  }

  if (activeOrganizationSlug) {
    return <Navigate to={buildOrganizationPath(activeOrganizationSlug, "/home")} replace />;
  }

  return <Navigate to="/onboarding/choose-organization" replace />;
}
