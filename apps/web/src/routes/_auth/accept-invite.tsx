import { createFileRoute, Navigate, useNavigate } from "@tanstack/react-router";
import {
  AcceptInviteScreen,
  AuthProvider,
} from "@vortex-api/better-auth-ui";

import { getBetterAuthUiClient } from "@/lib/better-auth-ui-adapter";

export const Route = createFileRoute("/_auth/accept-invite")({
  component: AcceptInviteRoute,
  validateSearch: (search: Record<string, unknown>): { token?: string } => ({
    token: typeof search.token === "string" ? search.token : undefined,
  }),
});

function AcceptInviteRoute() {
  const { token } = Route.useSearch();
  const navigate = useNavigate();
  const client = getBetterAuthUiClient();

  if (client === null || !token) {
    return <Navigate to="/sign-in" replace />;
  }

  return (
    <AuthProvider client={client}>
      <AcceptInviteScreen
        token={token}
        onSuccess={() => {
          void navigate({ to: "/app", replace: true });
        }}
        onSignIn={() => {
          void navigate({
            to: "/sign-in",
            search: { token },
          });
        }}
        onSignUp={() => {
          void navigate({
            to: "/sign-up",
            search: { token },
          });
        }}
      />
    </AuthProvider>
  );
}
