/**
 * Profile Settings Page - General
 *
 * User profile, email, and account management via @vortexnyc/better-auth-ui.
 * Route: /{slug}/settings/profile/ (index)
 */
import {
  AuthProvider,
  ChangeEmailForm,
  ChangePasswordForm,
  DeleteAccountForm,
  UserProfileForm,
} from "@seal/auth-ui";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";

import { getBetterAuthUiClient } from "@/lib/better-auth-ui-adapter";

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

export const Route = createFileRoute("/_authenticated/$slug/settings/profile/")(
  {
    component: ProfileSettings,
  }
);

function ProfileSettings() {
  const client = getBetterAuthUiClient();

  if (client === null) {
    return <p className="text-center text-sm">Auth client not configured.</p>;
  }

  const verifyCallbackUrl = `${resolveAppOrigin()}/verify-email`;

  return (
    <AuthProvider client={client}>
      <div className="space-y-6">
        <UserProfileForm
          onSuccess={() => {
            toast.success("Profile updated");
          }}
        />
        <ChangeEmailForm
          callbackURL={verifyCallbackUrl}
          onSuccess={() => {
            toast.success(
              "Confirmation email sent. Click the link from the new address to finish the change."
            );
          }}
        />
        <ChangePasswordForm
          onSuccess={() => {
            toast.success("Password updated");
          }}
        />
        <DeleteAccountForm
          onSuccess={() => {
            window.location.assign("/");
          }}
        />
      </div>
    </AuthProvider>
  );
}
