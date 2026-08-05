/**
 * Password reset completion — linked from the recovery email (?token=…).
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { VortexResetPasswordForm } from "@vortexnyc/auth/react";

import { authClient } from "@/lib/auth-runtime.better-auth";
import { createPageMeta, pageSEO } from "@/lib/seo";

export const Route = createFileRoute("/_auth/reset-password")({
  component: ResetPasswordRoute,
  validateSearch: (search: Record<string, unknown>): { token?: string } => ({
    token: typeof search.token === "string" ? search.token : undefined,
  }),
  head: () => createPageMeta(pageSEO.signIn, "/reset-password"),
});

function ResetPasswordRoute() {
  const { token } = Route.useSearch();

  if (!token) {
    return (
      <div className="space-y-3 text-center">
        <p className="text-sm">
          This reset link is missing a token. Request a new password reset from
          your profile or the sign-in page.
        </p>
        <Link className="text-sm underline underline-offset-4" to="/sign-in">
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <VortexResetPasswordForm
      authClient={authClient}
      onReset={() => {
        window.location.assign("/sign-in");
      }}
      token={token}
    />
  );
}
