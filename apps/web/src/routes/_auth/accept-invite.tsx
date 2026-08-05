/**
 * Accept Invite Route
 *
 * Email link lands here with ?token=<raw>. Unsigned users go through Core
 * accept-invite → sign-up, then return here. Signed-in users redeem via Convex
 * and land in /app (Seal-specific; Core page only routes into auth).
 */
import { api } from "@seal/backend/convex/_generated/api";
import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import { VortexAuthAcceptInvitePage } from "@vortexnyc/auth/react";
import { useMutation } from "convex/react";
import { useEffect, useRef, useState } from "react";

import Loader from "@/components/loader";
import {
  authRoutePaths,
  toSafeRedirectPath,
  useAppAuth,
  useAppAuthActions,
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
  const actions = useAppAuthActions();
  const navigate = useNavigate();
  const redeemInvitation = useMutation(api.invitations.redeemInvitation);
  const [error, setError] = useState<string | null>(null);
  const redeemedRef = useRef(false);

  const postSignUpPath = token
    ? `/accept-invite?token=${encodeURIComponent(token)}`
    : authRoutePaths.postSignUpPath;

  useEffect(() => {
    if (!isLoaded || !isSignedIn || !token || redeemedRef.current) {
      return;
    }
    redeemedRef.current = true;
    redeemInvitation({ token })
      .then(() => navigate({ to: "/app", replace: true }))
      .catch((err: unknown) => {
        setError(
          err instanceof Error ? err.message : "Failed to accept invitation"
        );
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

  if (isSignedIn) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-2 text-center">
        {error ? (
          <p className="text-destructive text-sm">{error}</p>
        ) : (
          <>
            <Loader />
            <p className="text-muted-foreground text-sm">
              Joining workspace...
            </p>
          </>
        )}
      </div>
    );
  }

  return (
    <VortexAuthAcceptInvitePage
      buildSignUpUrl={actions.buildSignUpUrl}
      description="Create an account or sign in to join the workspace that invited you."
      eyebrow="Seal invite"
      postSignUpPath={postSignUpPath}
      redirectToSignIn={actions.redirectToSignIn}
      signInPath={authRoutePaths.signInPath}
      signUpPath={authRoutePaths.signUpPath}
      title="You're invited"
      toSafeRedirectPath={toSafeRedirectPath}
    />
  );
}
