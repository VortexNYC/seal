// Authenticated layout: gates all child routes behind vortex-auth + org membership.
import * as Sentry from "@sentry/react";
import { createFileRoute, Navigate, Outlet } from "@tanstack/react-router";
import { useEffect } from "react";

import { EnforceOrganization } from "@/components/enforce-organization";
import Loader from "@/components/loader";
import { useCurrentUser } from "@/hooks/use-current-user";
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

function SentryUserContext() {
  const { user } = useCurrentUser();

  useEffect(() => {
    if (user) {
      Sentry.setUser({
        id: user.id,
        email: user.primaryEmailAddress?.emailAddress,
      });
    }
    return () => {
      Sentry.setUser(null);
    };
  }, [user]);

  return null;
}

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
    <>
      <SentryUserContext />
      <EnforceOrganization>
        <Outlet />
      </EnforceOrganization>
    </>
  );
}
