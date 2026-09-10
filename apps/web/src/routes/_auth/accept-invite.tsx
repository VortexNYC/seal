import { useMutation } from "@tanstack/react-query";
import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useEffect } from "react";

import Loader from "@/components/loader";
import { betterAuthClient } from "@/lib/better-auth";

export const Route = createFileRoute("/_auth/accept-invite")({
  component: AcceptInviteRoute,
  validateSearch: (search: Record<string, unknown>): { token?: string } => ({
    token: typeof search.token === "string" ? search.token : undefined,
  }),
});

function AcceptInviteRoute() {
  const { token } = Route.useSearch();

  if (betterAuthClient === null || !token) {
    return <Navigate to="/sign-in" replace />;
  }

  return <AcceptInviteLoaded token={token} />;
}

function AcceptInviteLoaded({ token }: { token: string }) {
  const { data: sessionData, isPending: isSessionPending } =
    betterAuthClient!.useSession();
  const accept = useMutation({
    mutationFn: async (invitationId: string) => {
      const result = await betterAuthClient!.organization.acceptInvitation({
        invitationId,
      });
      if (result.error) {
        throw new Error(result.error.message);
      }
      return result.data;
    },
  });

  useEffect(() => {
    if (sessionData && token && accept.isIdle) {
      accept.mutate(token);
    }
  }, [sessionData, token, accept]);

  if (isSessionPending || accept.isPending) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
        <Loader />
        <p className="text-muted-foreground max-w-sm text-sm">
          Accepting your invitation…
        </p>
      </div>
    );
  }

  if (!sessionData) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-muted-foreground max-w-sm text-sm">
          Sign in or create an account to accept this invitation.
        </p>
        <Link
          className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium"
          to="/sign-in"
          search={{ token }}
        >
          Sign in to accept invite
        </Link>
      </div>
    );
  }

  if (accept.isSuccess) {
    return <Navigate to="/app" replace />;
  }

  return (
    <div className="flex h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <p className="text-destructive max-w-sm text-sm">
        {accept.error?.message ?? "This invitation could not be accepted."}
      </p>
      <Link
        className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium"
        to="/sign-in"
      >
        Sign in
      </Link>
    </div>
  );
}
