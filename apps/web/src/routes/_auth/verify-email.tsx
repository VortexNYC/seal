import { createFileRoute, Link } from "@tanstack/react-router";
/**
 * Email verification landing — linked from signup / change-email messages (?token=…).
 */
import { AuthProvider, VerifyEmailForm } from "@vortex-api/better-auth-ui";

import { useCurrentUser } from "@/hooks/use-current-user";
import { AUTH_FORM_CARD_CLASS } from "@/lib/auth-form";
import { getBetterAuthUiClient } from "@/lib/better-auth-ui-adapter";
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
  const client = getBetterAuthUiClient();
  const userEmail = user?.primaryEmailAddress?.emailAddress ?? null;
  const callbackUrl = `${resolveAppOrigin()}/verify-email`;

  if (client === null) {
    return <p className="text-center text-sm">Auth client not configured.</p>;
  }

  return (
    <div className="space-y-4">
      <AuthProvider client={client}>
        <VerifyEmailForm
          className={AUTH_FORM_CARD_CLASS}
          callbackUrl={callbackUrl}
          token={token}
          userEmail={userEmail}
          onSuccess={() => {
            window.location.assign("/sign-in");
          }}
        />
      </AuthProvider>
      <p className="text-muted-foreground text-center text-sm">
        <Link className="underline underline-offset-4" to="/sign-in">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
