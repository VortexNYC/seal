/**
 * Accept Invite Route
 *
 * Better-Auth invitation landing. When the user is not signed in, render the
 * sign-in page (the invitation token in the URL is preserved); once signed in,
 * redirect into the app — Seal's membership materialization picks them up.
 * Full component-side invitation redemption is wired in P7 alongside the
 * invitation-component routing.
 */
import * as Sentry from "@sentry/react";
import { createFileRoute, Navigate } from "@tanstack/react-router";

import Loader from "@/components/loader";
import {
  authRoutePaths,
  captureAuthEvent,
  markPendingAuthFlow,
  runtime,
  useAppAuth,
} from "@/lib/auth-runtime.better-auth";

export const Route = createFileRoute("/_auth/accept-invite")({
  component: AcceptInviteRoute,
});

function AcceptInviteRoute() {
  const { isLoaded, isSignedIn } = useAppAuth();

  if (!isLoaded) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-2 text-center">
        <Loader />
        <p className="text-muted-foreground text-sm">Loading...</p>
      </div>
    );
  }

  if (isSignedIn) {
    return <Navigate to="/app" replace />;
  }

  return (
    <runtime.AuthSignInRoutePage
      signUpPath={authRoutePaths.signUpPath}
      postSignInPath="/app"
      markPendingAuthFlow={markPendingAuthFlow}
      captureAuthEvent={captureAuthEvent}
      captureException={(error: unknown) => Sentry.captureException(error)}
    />
  );
}
