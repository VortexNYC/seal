import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import Loader from "@/components/loader";
import { useAppAuth } from "@/lib/auth-runtime.better-auth";
import {
  listUserOrganizations,
  setActiveOrganization,
} from "@/lib/api-client";
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
  const { data: organizations } = useQuery({
    queryKey: ["api", "auth", "organization", "list"],
    queryFn: listUserOrganizations,
  });

  const activeOrganizationSlug = fixedSlug ?? organizations?.[0]?.slug ?? null;

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
    setActiveOrganization(first.slug)
      .then(() => {
        setFixedSlug(first.slug);
      })
      .catch((error) => {
        console.error("Failed to set active organization:", error);
      })
      .finally(() => {
        setIsFixing(false);
      });
  }, [organizations, isFixing, fixedSlug, activeOrganizationSlug]);

  const isLoading =
    organizations === undefined ||
    (organizations.length > 0 && !activeOrganizationSlug && isFixing);

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
