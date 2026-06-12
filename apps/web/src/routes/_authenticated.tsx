// Authenticated layout: gates all child routes behind vortex-auth + org membership.
import { createFileRoute, Navigate, Outlet } from "@tanstack/react-router";

import { EnforceOrganization } from "@/components/enforce-organization";
import Loader from "@/components/loader";
import { useAppAuth } from "@/lib/auth-runtime.better-auth";

export const Route = createFileRoute("/_authenticated")({
  component: AuthenticatedLayout,
  head: () => ({
    meta: [
      // Prevent search engines from indexing authenticated pages
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
});

function AuthenticatedLayout() {
  const { isLoaded, isSignedIn } = useAppAuth();

  if (!isLoaded) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Loader />
      </div>
    );
  }

  if (!isSignedIn) {
    return <Navigate to="/sign-in" />;
  }

  return (
    <EnforceOrganization>
      <Outlet />
    </EnforceOrganization>
  );
}
