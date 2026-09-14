import { createFileRoute } from "@tanstack/react-router";
/**
 * Profile Settings Page - Security
 *
 * Sessions, two-factor enrollment, and password change via @vortex-api/better-auth-ui.
 * Route: /{slug}/settings/profile/security
 */
import {
  AuthProvider,
  ChangePasswordForm,
  EnableTwoFactorForm,
  SessionList,
} from "@vortex-api/better-auth-ui";
import { toast } from "sonner";

import { betterAuthClient } from "@/lib/better-auth";

export const Route = createFileRoute(
  "/_authenticated/$slug/settings/profile/security"
)({
  component: SecuritySettings,
});

function SecuritySettings() {
  const client = betterAuthClient;

  if (client === null) {
    return <p className="text-center text-sm">Auth client not configured.</p>;
  }

  return (
    <AuthProvider client={client}>
      <div className="space-y-6">
        <SessionList
          showRevokeOthersAction
          onRevoke={() => {
            toast.success("Session revoked");
          }}
        />
        <EnableTwoFactorForm
          issuer="Seal"
          onSuccess={() => {
            toast.success("Two-factor authentication enabled");
          }}
        />
        <ChangePasswordForm
          onSuccess={() => {
            toast.success("Password changed");
          }}
        />
      </div>
    </AuthProvider>
  );
}
