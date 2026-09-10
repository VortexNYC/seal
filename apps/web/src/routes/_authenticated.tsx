/**
 * Authenticated layout: protects product routes behind sign-in and enforces an
 * active organization before opening Seal workspace paths.
 */
import {
  createFileRoute,
  Navigate,
  Outlet,
  useLocation,
} from "@tanstack/react-router";
import { useQuery } from "convex/react";

import { api } from "@seal/backend/convex/_generated/api";
import Loader from "@/components/loader";
import { useAppAuth } from "@/lib/auth-runtime.better-auth";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
  head: () => ({
    meta: [{ name: "robots", content: "noindex, nofollow" }],
  }),
});

function AuthenticatedLayout() {
  const { isLoaded, isSignedIn } = useAppAuth();
  const organizations = useQuery(api.check_membership.listUserOrganizations);
  const { pathname } = useLocation();

  if (!isLoaded || organizations === undefined) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Loader />
      </div>
    );
  }

  if (!isSignedIn) {
    return <Navigate to="/sign-in" replace />;
  }

  const isOnboardingRoute = pathname.startsWith("/onboarding");
  const isChooseOrganizationRoute =
    pathname === "/onboarding/choose-organization" ||
    pathname.startsWith("/onboarding/choose-organization/");
  const isPublicRoute = pathname.startsWith("/docs");

  const hasOrganizations = (organizations?.length ?? 0) > 0;

  if (isPublicRoute || isChooseOrganizationRoute) {
    return <Outlet />;
  }

  if (!hasOrganizations) {
    return <Navigate to="/onboarding/choose-organization" replace />;
  }

  if (isOnboardingRoute) {
    return <Navigate to="/app" replace />;
  }

  return <Outlet />;
}
