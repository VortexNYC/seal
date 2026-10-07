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
  SettingsStack,
} from "@vortex-api/better-auth-ui";

import { SettingsBody } from "@/components/settings-body";
import { FormSkeleton } from "@/components/skeletons";
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
        <SettingsStack className="w-full">
          <SessionList
            className="w-full"
            showRevokeOthersAction
            onRevoke={() => {
              toast.success("Session revoked");
            }}
          />
          <EnableTwoFactorForm
            className="w-full"
            issuer="Seal"
            onSuccess={() => {
              toast.success("Two-factor authentication enabled");
            }}
          />
          <GenerateBackupCodesForm
            className="w-full"
            onSuccess={() => {
              toast.success("Backup codes regenerated");
            }}
          />
          <DisableTwoFactorForm
            className="w-full"
            onSuccess={() => {
              toast.success("Two-factor authentication disabled");
            }}
          />
          <ChangePasswordForm
            className="w-full"
            onSuccess={() => {
              toast.success("Password changed");
            }}
          />
          <SetPasswordForm
            className="w-full"
            onSuccess={() => {
              toast.success("Password set");
            }}
          />
        </SettingsStack>
      </SettingsBody>
    </AuthProvider>
  );
}
