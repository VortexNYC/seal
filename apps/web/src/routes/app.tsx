import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useState } from "react";

import { api } from "@seal/backend/convex/_generated/api";
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
  const [isFixing, setIsFixing] = useState(false);
  const [fixedSlug, setFixedSlug] = useState<string | null>(null);
  const organizations = useQuery(api.check_membership.listUserOrganizations);
  const setActiveOrganization = useMutation(
    api.check_membership.setActiveOrganizationBySlug
  );

  const activeOrganizationSlug =
    fixedSlug ?? (organizations && organizations[0]?.organizationSlug) ?? null;

  useEffect(() => {
    if (
      !organizations ||
      organizations.length === 0 ||
      isFixing ||
      fixedSlug ||
      activeOrganizationSlug
    ) {
      return;
    }
    const first = organizations[0];
    if (!first) return;
    setIsFixing(true);
    setActiveOrganization({ organizationSlug: first.organizationSlug })
      .then(() => {
        setFixedSlug(first.organizationSlug);
      })
      .catch((error: unknown) => {
        console.error("Failed to set active organization:", error);
      })
      .finally(() => {
        setIsFixing(false);
      });
  }, [
    organizations,
    isFixing,
    fixedSlug,
    activeOrganizationSlug,
    setActiveOrganization,
  ]);

  const isLoading =
    organizations === undefined ||
    ((organizations?.length ?? 0) > 0 && !activeOrganizationSlug && isFixing);

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="text-center">
          <Loader />
          <p className="text-muted-foreground mt-4">
            {isFixing ? "Setting up your workspace..." : "Loading..."}
          </p>
        </div>
      </div>
    );
  }

  if (activeOrganizationSlug) {
    return (
      <Navigate
        to={buildOrganizationPath(activeOrganizationSlug, "/home")}
        replace
      />
    );
  }

  return <Navigate to="/onboarding/choose-organization" replace />;
}
