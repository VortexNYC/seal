/**
 * EnforceOrganization Component
 *
 * Ensures that authenticated users have an organization membership.
 * If user has no organization, redirects to organization selection/creation flow.
 */

import { Navigate, useLocation } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { type ReactNode, useEffect, useState } from "react";

import { buildOrganizationPath, isPathWithinOrganization } from "@/lib/organization-path";
import { api } from "@seal/backend/convex/_generated/api";

interface EnforceOrganizationProps {
  children: ReactNode;
}

export function EnforceOrganization({ children }: EnforceOrganizationProps) {
  const location = useLocation();
  const organizationStatus = useQuery(api.check_membership.hasOrganization);
  const ensureActiveOrganization = useMutation(api.check_membership.ensureActiveOrganization);
  const isOnboardingRoute = location.pathname.startsWith("/onboarding");
  const isPublicRoute = location.pathname.startsWith("/docs");

  const [isFixingOrg, setIsFixingOrg] = useState(false);
  const [fixedSlug, setFixedSlug] = useState<string | null>(null);

  const isLoading = organizationStatus === undefined;
  const hasOrganization = organizationStatus?.hasOrganization ?? false;
  const needsActiveOrgFix = organizationStatus?.needsActiveOrgFix ?? false;
  const activeOrganizationSlug = fixedSlug ?? organizationStatus?.activeOrganizationSlug ?? null;

  // Auto-fix activeOrganizationId if user has membership but no active org set
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
    return null;
  }

  if (!hasOrganization || !activeOrganizationSlug) {
    return isOnboardingRoute ? children : <Navigate to="/onboarding/choose-organization" replace />;
  }

  // Allow /onboarding/choose-organization even if user has an organization
  // (they might want to switch or create new workspace)
  if (isOnboardingRoute && location.pathname === "/onboarding/choose-organization") {
    return <>{children}</>;
  }

  // Redirect other onboarding routes if user already has organization
  if (isOnboardingRoute) {
    const params = new URLSearchParams(location.search ?? "");
    const returnTo = params.get("returnTo");
    const target = returnTo
      ? buildOrganizationPath(activeOrganizationSlug, returnTo)
      : buildOrganizationPath(activeOrganizationSlug, "/home");

    return <Navigate to={target} replace />;
  }

  // Allow public routes like /docs to render without organization path check
  if (isPublicRoute) {
    return <>{children}</>;
  }

  const isWithinOrg = isPathWithinOrganization(activeOrganizationSlug, location.pathname);

  if (!isWithinOrg) {
    // Check if the path looks like it's under a different org slug
    // (e.g. /some-other-slug/home). In that case, let the $slug route
    // handle the error — don't silently redirect to the user's org.
    const segments = location.pathname.split("/").filter(Boolean);
    const looksLikeOrgPath = segments.length >= 1 && segments[0] !== activeOrganizationSlug;
    if (looksLikeOrgPath) {
      return <>{children}</>;
    }

    const redirectPath = buildOrganizationPath(activeOrganizationSlug, "/home");
    return <Navigate to={redirectPath} replace />;
  }

  return <>{children}</>;
}
