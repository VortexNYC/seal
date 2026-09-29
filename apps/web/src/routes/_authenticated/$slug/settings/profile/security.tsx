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
  SetPasswordForm,
} from "@vortex-api/better-auth-ui";

import { FormSkeleton } from "@/components/skeletons";
import { SettingsBody } from "@/components/settings-body";
import { getBetterAuthUiClient } from "@/lib/better-auth-ui-adapter";
import { toast } from "@/lib/toast";

export const Route = createFileRoute(
  "/_authenticated/$slug/settings/profile/security"
)({
  component: SecuritySettings,
  pendingComponent: FormSkeleton,
});

function SecuritySettings() {
  const client = getBetterAuthUiClient();

  if (client === null) {
    return <FormSkeleton />;
  }

  return (
    <AuthProvider client={client}>
      <SettingsBody className="items-stretch">
        <div className="flex w-full flex-col gap-5">
          <SessionList
            className="w-full max-w-none"
            showRevokeOthersAction
            onRevoke={() => {
              toast.success("Session revoked");
            }}
          />
          <EnableTwoFactorForm
            className="w-full max-w-none"
            issuer="Seal"
            onSuccess={() => {
              toast.success("Two-factor authentication enabled");
            }}
          />
          <GenerateBackupCodesForm
            className="w-full max-w-none"
            onSuccess={() => {
              toast.success("Backup codes regenerated");
            }}
          />
          <DisableTwoFactorForm
            className="w-full max-w-none"
            onSuccess={() => {
              toast.success("Two-factor authentication disabled");
            }}
          />
          <ChangePasswordForm
            className="w-full max-w-none"
            onSuccess={() => {
              toast.success("Password changed");
            }}
          />
          <SetPasswordForm
            className="w-full max-w-none"
            onSuccess={() => {
              toast.success("Password set");
            }}
          />
        </div>
      </SettingsBody>
    </AuthProvider>
  );
}
