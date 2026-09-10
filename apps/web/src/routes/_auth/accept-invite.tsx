/**
 * Accept Invite Route
 *
 * Email link lands here with ?token=<raw>. Invitations are redeemed through
 * Vortex Auth.
 */
import { createFileRoute, Link, Navigate } from "@tanstack/react-router";

import Loader from "@/components/loader";
import { authRoutePaths } from "@/lib/auth-runtime.better-auth";

export const Route = createFileRoute("/_auth/accept-invite")({
  component: AcceptInviteRoute,
  validateSearch: (search: Record<string, unknown>): { token?: string } => ({
    token: typeof search.token === "string" ? search.token : undefined,
  }),
});

function AcceptInviteRoute() {
  const { token } = Route.useSearch();

  if (!token) {
    return <Navigate to={authRoutePaths.signInPath} replace />;
  }

  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <Loader />
      <p className="text-muted-foreground text-sm max-w-sm">
        Seal invitations are redeemed through Vortex Auth. Sign in or create an
        account to accept this invite.
      </p>
      <Link
        className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium"
        to={authRoutePaths.signInPath}
      >
        Sign in to accept invite
      </Link>
    </div>
  );
}
