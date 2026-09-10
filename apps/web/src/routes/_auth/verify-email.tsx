/**
 * Email verification landing — linked from signup / change-email messages (?token=…).
 * Core VortexVerifyEmailScreen covers both flows (SEA-598).
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { VortexVerifyEmailScreen } from "@vortexnyc/auth/react";

import { useCurrentUser } from "@/hooks/use-current-user";
import { authClient } from "@/lib/better-auth";
import { createPageMeta, pageSEO } from "@/lib/seo";

export const Route = createFileRoute("/_auth/verify-email")({
  component: VerifyEmailRoute,
  validateSearch: (search: Record<string, unknown>): { token?: string } => ({
    token: typeof search.token === "string" ? search.token : undefined,
  }),
  head: () => createPageMeta(pageSEO.signIn, "/verify-email"),
});

function resolveAppOrigin(): string {
  const configured = import.meta.env.VITE_APP_URL;
  if (typeof configured === "string" && configured.length > 0) {
    return configured.replace(/\/$/, "");
  }
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return "https://app.seal.nyc";
}

function VerifyEmailRoute() {
  const { token } = Route.useSearch();
  const { user } = useCurrentUser();
  const userEmail = user?.primaryEmailAddress?.emailAddress ?? null;
  const verifyEmailUrl = `${resolveAppOrigin()}/verify-email`;

  return (
    <div className="space-y-4">
      <VortexVerifyEmailScreen
        authClient={authClient}
        onVerified={() => {
          window.location.assign("/sign-in");
        }}
        resendCallbackUrl={verifyEmailUrl}
        token={token ?? ""}
        userEmail={userEmail}
      />
      <p className="text-muted-foreground text-center text-sm">
        <Link className="underline underline-offset-4" to="/sign-in">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
