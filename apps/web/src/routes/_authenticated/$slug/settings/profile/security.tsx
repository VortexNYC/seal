/**
 * Profile Settings Page - Security
 *
 * Sessions, two-factor enrollment, and password change via @vortexnyc/better-auth-ui.
 * Route: /{slug}/settings/profile/security
 */
import {
  AuthProvider,
  ChangePasswordForm,
  EnableTwoFactorForm,
  SessionList,
} from "@seal/auth-ui";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";

import { getBetterAuthUiClient } from "@/lib/better-auth-ui-adapter";

export const Route = createFileRoute(
  "/_authenticated/$slug/settings/profile/security"
)({
  component: SecuritySettings,
});

function SecuritySettings() {
  const client = getBetterAuthUiClient();

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
