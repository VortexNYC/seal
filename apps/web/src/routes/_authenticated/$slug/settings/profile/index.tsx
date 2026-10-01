import { createFileRoute } from "@tanstack/react-router";
/**
 * Profile Settings Page - General
 *
 * User profile, email, and account management via @vortex-api/better-auth-ui.
 * Route: /{slug}/settings/profile/ (index)
 */
import {
  AuthProvider,
  ChangeEmailForm,
  ConnectedAccounts,
  DeleteAccountForm,
  SettingsStack,
  UserProfileForm,
} from "@vortex-api/better-auth-ui";

import { SettingsBody } from "@/components/settings-body";
import { FormSkeleton } from "@/components/skeletons";
import { getBetterAuthUiClient } from "@/lib/better-auth-ui-adapter";
import { toast } from "@/lib/toast";

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
    pendingComponent: FormSkeleton,
  }
);

function ProfileSettings() {
  const client = getBetterAuthUiClient();

  if (client === null) {
    return <FormSkeleton />;
  }

  const verifyCallbackUrl = `${resolveAppOrigin()}/verify-email`;

  return (
    <AuthProvider client={client}>
      <SettingsBody narrow className="items-stretch">
        <SettingsStack className="w-full">
          <UserProfileForm
            className="w-full"
            title="Profile"
            description="Name and photo for this Seal account."
            onSuccess={() => {
              toast.success("Profile updated");
            }}
          />
          <ChangeEmailForm
            className="w-full"
            callbackURL={verifyCallbackUrl}
            onSuccess={() => {
              toast.success(
                "Confirmation email sent. Click the link from the new address to finish the change."
              );
            }}
          />
          <ConnectedAccounts
            className="w-full"
            onUnlinked={() => {
              toast.success("Account disconnected");
            }}
          />
          <DeleteAccountForm
            className="w-full"
            onSuccess={() => {
              window.location.assign("/");
            }}
          />
        </SettingsStack>
      </SettingsBody>
    </AuthProvider>
  );
}
