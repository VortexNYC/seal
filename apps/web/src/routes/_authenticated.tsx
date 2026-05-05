// Authenticated layout: gates all child routes behind Clerk auth + org membership.
import { SignedIn, SignedOut, useOrganization, useUser } from "@clerk/clerk-react";
import * as Sentry from "@sentry/react";
import { createFileRoute, Navigate, Outlet } from "@tanstack/react-router";
import { useEffect } from "react";

import { EnforceOrganization } from "@/components/enforce-organization";

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
  const { user } = useUser();
  const { organization } = useOrganization();

  useEffect(() => {
    if (user) {
      Sentry.setUser({
        id: user.id,
        email: user.primaryEmailAddress?.emailAddress,
      });
      if (organization) {
        Sentry.setTag("organization_id", organization.id);
        Sentry.setTag("organization_name", organization.name);
      }
    }
    return () => {
      Sentry.setUser(null);
    };
  }, [user, organization]);

  return null;
}

function AuthenticatedLayout() {
  return (
    <>
      <SignedOut>
        <Navigate to="/sign-in" />
      </SignedOut>
      <SignedIn>
        <SentryUserContext />
        <EnforceOrganization>
          <Outlet />
        </EnforceOrganization>
      </SignedIn>
    </>
  );
}
