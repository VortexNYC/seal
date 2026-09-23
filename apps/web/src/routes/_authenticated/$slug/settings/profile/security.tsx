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
  DisableTwoFactorForm,
  EnableTwoFactorForm,
  GenerateBackupCodesForm,
  SessionList,
} from "@vortex-api/better-auth-ui";

import { getBetterAuthUiClient } from "@/lib/better-auth-ui-adapter";
import { toast } from "@/lib/toast";

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
        <GenerateBackupCodesForm
          onSuccess={() => {
            toast.success("Backup codes regenerated");
          }}
        />
        <DisableTwoFactorForm
          onSuccess={() => {
            toast.success("Two-factor authentication disabled");
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
