import { createFileRoute } from "@tanstack/react-router";
/**
 * Forgot password — request a reset email.
 */
import { AuthProvider, ForgotPasswordForm } from "@vortex-api/better-auth-ui";

import { betterAuthClient } from "@/lib/better-auth";
import { createPageMeta, pageSEO } from "@/lib/seo";

export const Route = createFileRoute("/_auth/forgot-password")({
  component: ForgotPasswordRoute,
  head: () => createPageMeta(pageSEO.signIn, "/forgot-password"),
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

function ForgotPasswordRoute() {
  const client = betterAuthClient;
  const resetPasswordUrl = `${resolveAppOrigin()}/reset-password`;

  if (client === null) {
    return <p className="text-center text-sm">Auth client not configured.</p>;
  }

  return (
    <AuthProvider client={client}>
      <ForgotPasswordForm
        resetPasswordUrl={resetPasswordUrl}
        signInUrl="/sign-in"
      />
    </AuthProvider>
  );
}
