import { createFileRoute, Link } from "@tanstack/react-router";
/**
 * Password reset completion — linked from the recovery email (?token=…).
 */
import { AuthProvider, ResetPasswordForm } from "@vortex-api/better-auth-ui";

import { AUTH_FORM_CARD_CLASS } from "@/lib/auth-form";
import { getBetterAuthUiClient } from "@/lib/better-auth-ui-adapter";
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
  const client = getBetterAuthUiClient();

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

  if (client === null) {
    return <p className="text-center text-sm">Auth client not configured.</p>;
  }

  return (
    <AuthProvider client={client}>
      <ResetPasswordForm
        className={AUTH_FORM_CARD_CLASS}
        token={token}
        onSuccess={() => {
          window.location.assign("/sign-in");
        }}
      />
    </AuthProvider>
  );
}
