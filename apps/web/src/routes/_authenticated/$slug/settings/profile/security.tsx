import { createFileRoute } from "@tanstack/react-router";
import { AccountSecurity, AuthProvider } from "@vortex-api/better-auth-ui";

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
        <AccountSecurity
          className="w-full"
          issuer="Seal"
          onSessionRevoked={() => {
            toast.success("Session revoked");
          }}
          onTwoFactorEnabled={() => {
            toast.success("Two-factor authentication enabled");
          }}
          onBackupCodesGenerated={() => {
            toast.success("Backup codes regenerated");
          }}
          onTwoFactorDisabled={() => {
            toast.success("Two-factor authentication disabled");
          }}
          onPasswordChanged={() => {
            toast.success("Password changed");
          }}
          onPasswordSet={() => {
            toast.success("Password set");
          }}
        />
      </SettingsBody>
    </AuthProvider>
  );
}
