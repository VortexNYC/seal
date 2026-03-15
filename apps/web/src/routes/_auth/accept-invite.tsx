/**
 * Accept Invite Route
 *
 * Handles Clerk organization invitation acceptance
 * When a user clicks an invitation link, Clerk automatically handles the signup/signin
 * and redirects back to the app. This route is just a landing page.
 */

import { SignIn, useAuth } from "@clerk/clerk-react";
import { createFileRoute, Navigate } from "@tanstack/react-router";

import { useTheme } from "@/components/theme-provider";
import { getClerkAuthAppearance } from "@/lib/clerk-auth-theme";

export const Route = createFileRoute("/_auth/accept-invite")({
  component: AcceptInviteRoute,
});

function AcceptInviteRoute() {
  const { isSignedIn, isLoaded } = useAuth();
  const { resolvedTheme } = useTheme();

  // Wait for Clerk to load
  if (!isLoaded) {
    return (
      <div className="flex h-dvh flex-col items-center justify-center gap-2 text-center">
        <div className="border-primary h-8 w-8 animate-spin rounded-full border-b-2" />
        <p className="text-muted-foreground text-sm">Loading...</p>
      </div>
    );
  }

  // If user is already signed in, redirect to app
  if (isSignedIn) {
    return <Navigate to="/app" replace />;
  }

  // Render embedded SignIn so the invitation token present in the URL
  // is preserved and processed by Clerk. This avoids losing the token
  // via a redirect to a different path.
  return (
    <SignIn
      routing="virtual"
      signUpUrl="/sign-up"
      appearance={getClerkAuthAppearance(resolvedTheme === "dark")}
    />
  );
}
