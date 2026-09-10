/**
 * Authenticated layout: protects product routes behind sign-in and enforces an
 * active organization before opening Seal workspace paths.
 */
import { useQuery } from "@tanstack/react-query";
import {
  createFileRoute,
  Navigate,
  Outlet,
  useLocation,
} from "@tanstack/react-router";

import Loader from "@/components/loader";
import { betterAuthClient } from "@/lib/better-auth";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
  head: () => ({
    meta: [{ name: "robots", content: "noindex, nofollow" }],
  }),
});

function AuthenticatedLayout() {
  if (betterAuthClient === null) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Loader />
      </div>
    );
  }
  return <AuthenticatedLayoutLoaded />;
}

function AuthenticatedLayoutLoaded() {
  const { data: sessionData, isPending: isSessionPending } =
    betterAuthClient!.useSession();
  const { data: organizations, isPending: isListPending } = useQuery({
    queryKey: ["auth", "organization", "list"],
    queryFn: async () => {
      const result = await betterAuthClient!.organization.list();
      if (result.error) {
        throw new Error(result.error.message);
      }
      return result.data;
    },
  });
  const { pathname } = useLocation();

  if (isSessionPending || isListPending) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Loader />
      </div>
    );
  }

  if (!sessionData) {
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
