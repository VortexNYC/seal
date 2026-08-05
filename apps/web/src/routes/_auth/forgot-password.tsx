/**
 * Forgot password — request a reset email (Core VortexForgotPasswordForm).
 * Recovery links land on /reset-password?token=…
 */
import { createFileRoute, Link } from "@tanstack/react-router";
import { VortexForgotPasswordForm } from "@vortexnyc/auth/react";

import { authClient } from "@/lib/auth-runtime.better-auth";
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
  const resetPasswordUrl = `${resolveAppOrigin()}/reset-password`;

  return (
    <div className="space-y-4">
      <VortexForgotPasswordForm
        authClient={authClient}
        resetPasswordUrl={resetPasswordUrl}
      />
      <p className="text-muted-foreground text-center text-sm">
        <Link className="underline underline-offset-4" to="/sign-in">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
