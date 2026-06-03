/**
 * Accept Invite Route
 *
 * Component-based invitation acceptance (P7). The email link points here with
 * ?token=<raw token>. If the invitee isn't signed in, render sign-up (so they
 * create a Better-Auth account, returning here afterwards); once signed in,
 * redeem the token → join the org → land in the app.
 */
import { api } from "@seal/backend/convex/_generated/api";
import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { useEffect, useRef, useState } from "react";

import Loader from "@/components/loader";
import {
  authRoutePaths,
  captureAuthEvent,
  markPendingAuthFlow,
  markPendingPostSignUpSync,
  runtime,
  useAppAuth,
} from "@/lib/auth-runtime.better-auth";

export const Route = createFileRoute("/_auth/accept-invite")({
  component: AcceptInviteRoute,
  validateSearch: (search: Record<string, unknown>): { token?: string } => ({
    token: typeof search.token === "string" ? search.token : undefined,
  }),
});

function AcceptInviteRoute() {
  const { token } = Route.useSearch();
  const { isLoaded, isSignedIn } = useAppAuth();
  const navigate = useNavigate();
  const redeemInvitation = useMutation(api.invitations.redeemInvitation);
  const [error, setError] = useState<string | null>(null);
  const redeemedRef = useRef(false);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !token || redeemedRef.current) {
      return;
    }
    redeemedRef.current = true;
    redeemInvitation({ token })
      .then(() => navigate({ to: "/app", replace: true }))
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to accept invitation");
      });
  }, [isLoaded, isSignedIn, token, redeemInvitation, navigate]);

  if (!isLoaded) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-2 text-center">
        <Loader />
        <p className="text-muted-foreground text-sm">Loading...</p>
      </div>
    );
  }

  if (!token) {
    return <Navigate to="/sign-in" replace />;
  }

  // Signed in → redeeming (or showing an error).
  if (isSignedIn) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-2 text-center">
        {error ? (
          <p className="text-destructive text-sm">{error}</p>
        ) : (
          <>
            <Loader />
            <p className="text-muted-foreground text-sm">Joining workspace...</p>
          </>
        )}
      </div>
    );
  }

  // Not signed in → create an account, then return here to redeem.
  return (
    <runtime.AuthSignUpRoutePage
      signInPath={authRoutePaths.signInPath}
      postSignUpPath={`/accept-invite?token=${encodeURIComponent(token)}`}
      markPendingAuthFlow={markPendingAuthFlow}
      markPendingPostSignUpSync={markPendingPostSignUpSync}
      captureAuthEvent={captureAuthEvent}
    />
  );
}
